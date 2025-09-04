import psycopg2
from faker import Faker
import random
from datetime import datetime, timedelta
import re

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'driving_school_db',
    'user': 'postgres',
    'password': '123456789'
}

fake = Faker('en_US')

DATA = {
    'application_statuses': ["Pending", "Approved", "Rejected"],
    'car_categories': ["Sedan", "SUV", "Coupe", "Hatchback", "Truck", "Van", "Compact"],
    'car_conditions': ["Excellent", "Good", "Poor"],
    'driving_categories': ["A", "B", "C", "D"],
    'lesson_statuses': ["Scheduled", "Completed", "Canceled"],
    'lesson_topics': [
        "Road Signs", "Parking Techniques", "Highway Driving", "City Navigation", 
        "Emergency Procedures", "Night Driving", "Defensive Driving", "Traffic Rules"
    ],
    'lesson_types': ["Theory", "Practical"],
    'study_categories': ["Category A", "Category B", "Category C", "Category D", "Theory"],
    'system_users_roles': ["Admin", "Teacher", "Instructor"]
}

def connect_to_database():
    """Establish connection to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        return None

def generate_phone_number():
    """Generate a valid phone number matching the regex pattern"""
    country_codes = ['+1', '+44', '+380', '+49', '+33']
    country_code = random.choice(country_codes)
    if country_code == '+380':
        number = f"{country_code}{fake.random_int(min=500000000, max=999999999)}"
    else:
        number = f"{country_code}{fake.random_int(min=1000000000, max=9999999999)}"
    return number

def generate_tin():
    """Generate a valid TIN (Tax Identification Number)"""
    tin = ''.join([str(fake.random_int(min=0, max=9)) for _ in range(10)])
    while len(tin) != 10 or tin.isspace():
        tin = ''.join([str(fake.random_int(min=0, max=9)) for _ in range(10)])
    return tin

def generate_unique_email(used_emails):
    """Generate unique email address"""
    while True:
        email = fake.email()
        if email not in used_emails:
            used_emails.add(email)
            return email

def generate_unique_phone(used_phones):
    """Generate unique phone number"""
    while True:
        phone = generate_phone_number()
        if phone not in used_phones:
            used_phones.add(phone)
            return phone

def generate_unique_tin(used_tins):
    """Generate unique TIN - never returns None"""
    max_attempts = 1000
    attempts = 0
    while attempts < max_attempts:
        tin = generate_tin()
        if tin and tin not in used_tins and len(tin) == 10:
            used_tins.add(tin)
            return tin
        attempts += 1
    import time
    fallback_tin = f"{int(time.time()) % 1000000000:010d}"
    while fallback_tin in used_tins:
        fallback_tin = f"{(int(time.time()) + attempts) % 1000000000:010d}"
        attempts += 1
    used_tins.add(fallback_tin)
    return fallback_tin

def insert_static_data(cursor):
    """Insert static data for all reference tables"""
    print("Inserting static data for reference tables...")
    for status in DATA['application_statuses']:
        cursor.execute("""
            INSERT INTO public.application_statuses (application_status) 
            VALUES (%s) ON CONFLICT (application_status) DO NOTHING
        """, (status,))
    for category in DATA['car_categories']:
        cursor.execute("""
            INSERT INTO public.car_categories (car_category_name) 
            VALUES (%s) ON CONFLICT (car_category_name) DO NOTHING
        """, (category,))
    for condition in DATA['car_conditions']:
        cursor.execute("""
            INSERT INTO public.car_conditions (car_condition) 
            VALUES (%s) ON CONFLICT (car_condition) DO NOTHING
        """, (condition,))
    for category in DATA['driving_categories']:
        cursor.execute("""
            INSERT INTO public.driving_categories (driving_category) 
            VALUES (%s) ON CONFLICT (driving_category) DO NOTHING
        """, (category,))
    for status in DATA['lesson_statuses']:
        cursor.execute("""
            INSERT INTO public.lesson_statuses (lesson_status) 
            VALUES (%s) ON CONFLICT (lesson_status) DO NOTHING
        """, (status,))
    for topic in DATA['lesson_topics']:
        cursor.execute("""
            INSERT INTO public.lesson_topics (lesson_topic) 
            VALUES (%s) ON CONFLICT (lesson_topic) DO NOTHING
        """, (topic,))
    for lesson_type in DATA['lesson_types']:
        cursor.execute("""
            INSERT INTO public.lesson_types (lesson_type) 
            VALUES (%s) ON CONFLICT (lesson_type) DO NOTHING
        """, (lesson_type,))
    for category in DATA['study_categories']:
        cursor.execute("""
            INSERT INTO public.study_categories (study_category) 
            VALUES (%s) ON CONFLICT (study_category) DO NOTHING
        """, (category,))
    for role in DATA['system_users_roles']:
        cursor.execute("""
            INSERT INTO public.system_users_roles (system_user_role) 
            VALUES (%s) ON CONFLICT (system_user_role) DO NOTHING
        """, (role,))
    print("✅ Static data inserted successfully!")

def get_reference_ids(cursor):
    """Get IDs for reference tables to use in foreign keys"""
    reference_ids = {}
    cursor.execute("SELECT application_status_id, application_status FROM public.application_statuses")
    reference_ids['application_statuses'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT car_category_id, car_category_name FROM public.car_categories")
    reference_ids['car_categories'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT car_condition_id, car_condition FROM public.car_conditions")
    reference_ids['car_conditions'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT driving_category_id, driving_category FROM public.driving_categories")
    reference_ids['driving_categories'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT lesson_status_id, lesson_status FROM public.lesson_statuses")
    reference_ids['lesson_statuses'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT lesson_topic_id, lesson_topic FROM public.lesson_topics")
    reference_ids['lesson_topics'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT lesson_type_id, lesson_type FROM public.lesson_types")
    reference_ids['lesson_types'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT study_category_id, study_category FROM public.study_categories")
    reference_ids['study_categories'] = {row[1]: row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT system_user_role_id, system_user_role FROM public.system_users_roles")
    reference_ids['system_users_roles'] = {row[1]: row[0] for row in cursor.fetchall()}
    return reference_ids

def generate_applicants_data(num_records=1500):
    """Generate fake data for applicants table"""
    applicants_data = []
    used_emails = set()
    used_phones = set()
    used_tins = set()
    for i in range(num_records):
        min_age = 16
        max_age = 65
        birth_date = fake.date_of_birth(minimum_age=min_age, maximum_age=max_age)
        first_name = fake.first_name()
        while len(first_name) < 2:
            first_name = fake.first_name()
        last_name = fake.last_name()
        while len(last_name) < 2:
            last_name = fake.last_name()
        email = generate_unique_email(used_emails)
        phone = generate_unique_phone(used_phones)
        tin = generate_unique_tin(used_tins)
        applicant = {
            'first_name': first_name,
            'last_name': last_name,
            'birth_date': birth_date,
            'email': email,
            'phone': phone,
            'tin': tin
        }
        applicants_data.append(applicant)
        if (i + 1) % 100 == 0:
            print(f"Generated {i + 1} applicant records...")
    return applicants_data

def generate_applications_data(num_records=1500, reference_ids=None):
    """Generate fake data for applications table — all with 'Pending' status"""
    applications_data = []
    study_category_ids = list(reference_ids['study_categories'].values())
    pending_status_id = reference_ids['application_statuses']['Pending']
    for i in range(num_records):
        submission_date = fake.date_between(start_date='-2y', end_date='today')
        application = {
            'study_category_id': random.choice(study_category_ids),
            'application_status_id': pending_status_id,
            'submission_date': submission_date,
            'approval_date': None
        }
        applications_data.append(application)
        if (i + 1) % 100 == 0:
            print(f"Generated {i + 1} application records...")
    return applications_data

def insert_all_data_in_transaction(conn, applicants_data, applications_data):
    """Insert all data in a single transaction - all or nothing"""
    cursor = conn.cursor()
    applicants_insert_query = """
    INSERT INTO public.applicants (first_name, last_name, birth_date, email, phone, "TIN")
    VALUES (%s, %s, %s, %s, %s, %s)
    RETURNING applicant_id
    """
    applications_insert_query = """
    INSERT INTO public.applications (applicant_id, study_category_id, application_status_id, submission_date, approval_date)
    VALUES (%s, %s, %s, %s, %s)
    """
    try:
        print("Starting transaction...")
        insert_static_data(cursor)
        reference_ids = get_reference_ids(cursor)
        print("Inserting applicants data...")
        applicant_ids = []
        for i, applicant in enumerate(applicants_data):
            cursor.execute(applicants_insert_query, (
                applicant['first_name'],
                applicant['last_name'],
                applicant['birth_date'],
                applicant['email'],
                applicant['phone'],
                applicant['tin']
            ))
            applicant_id = cursor.fetchone()[0]
            applicant_ids.append(applicant_id)
            if (i + 1) % 200 == 0:
                print(f"  Inserted {i + 1} applicant records...")
        print(f"All {len(applicants_data)} applicant records inserted in transaction")
        print("Inserting applications data...")
        for i, application in enumerate(applications_data):
            actual_applicant_id = applicant_ids[i]
            cursor.execute(applications_insert_query, (
                actual_applicant_id,
                application['study_category_id'],
                application['application_status_id'],
                application['submission_date'],
                application['approval_date']
            ))
            if (i + 1) % 200 == 0:
                print(f"  Inserted {i + 1} application records...")
        print(f"All {len(applications_data)} application records inserted in transaction")
        print("Committing transaction...")
        conn.commit()
        print("✅ TRANSACTION SUCCESSFUL!")
        print(f"Successfully inserted:")
        print(f"  📋 Static reference data for {len(DATA)} tables")
        print(f"  👥 {len(applicants_data)} applicants")
        print(f"  📝 {len(applications_data)} applications")
        print(f"Applicant IDs range: {min(applicant_ids)} to {max(applicant_ids)}")
    except psycopg2.Error as e:
        print(f"❌ ERROR during transaction: {e}")
        print("Rolling back all changes...")
        conn.rollback()
        print("All changes have been rolled back. No data was inserted.")
        raise e
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")
        print("Rolling back all changes...")
        conn.rollback()
        print("All changes have been rolled back. No data was inserted.")
        raise e
    finally:
        cursor.close()

def main():
    """Main function to generate and insert data"""
    print("Starting enhanced data generation for driving school database...")
    print("Using TRANSACTION mode: All data will be created or none at all!")
    print(f"Static data tables: {list(DATA.keys())}")
    conn = connect_to_database()
    if not conn:
        print("Failed to connect to database. Exiting...")
        return
    try:
        print("\n" + "="*60)
        print("STEP 1: Generating applicants data...")
        applicants_data = generate_applicants_data(1500)
        print("\n" + "="*60)
        print("STEP 2: Preparing applications data generation...")
        print("\n" + "="*60)
        print("STEP 3: Inserting all data in single transaction...")
        print("⚠️  If any error occurs, ALL data will be rolled back!")
        cursor = conn.cursor()
        try:
            insert_static_data(cursor)
            reference_ids = get_reference_ids(cursor)
            applications_data = generate_applications_data(1500, reference_ids)
            cursor.close()
            insert_all_data_in_transaction(conn, applicants_data, applications_data)
        except Exception as e:
            cursor.close()
            raise e
        print("\n" + "="*60)
        print("🎉 DATA GENERATION COMPLETED SUCCESSFULLY!")
        print(f"✅ Static reference data for {len(DATA)} tables")
        print(f"✅ {len(applicants_data)} applicants created")
        print(f"✅ {len(applications_data)} applications created")
        print("✅ All data committed to database")
        print("\n📊 STATIC DATA SUMMARY:")
        for table, values in DATA.items():
            print(f"  {table}: {len(values)} records")
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        print("💥 NO DATA WAS INSERTED INTO DATABASE")
        print("Database remains in original state")
    finally:
        conn.close()
        print("\nDatabase connection closed.")

if __name__ == "__main__":
    main()