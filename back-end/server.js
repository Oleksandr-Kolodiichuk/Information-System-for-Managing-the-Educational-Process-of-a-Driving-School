const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 5000;

const pools = {
  admin: new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user : process.env.DB_USERNAME_ADMIN,
    password: process.env.DB_PASSWORD_ADMIN,
  }),
  instructor: new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME_INSTRUCTOR,
    password: process.env.DB_PASSWORD_INSTRUCTOR,
  }),
  teacher: new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME_TEACHER,
    password: process.env.DB_PASSWORD_TEACHER,
  })
};

const defaultPool = pools.admin;

Object.keys(pools).forEach(role => {
  pools[role].connect()
    .then(() => console.log(`Connected to database with ${role} role successfully!`))
    .catch((err) => console.error(`Database connection error for ${role} role:`, err));
});

const getPoolByRole = (role) => {
  switch(role?.toLowerCase()) {
    case 'admin':
      return pools.admin;
    case 'instructor':
      return pools.instructor;
    case 'teacher':
      return pools.teacher;
    default:
      return pools.admin;
  }
};

const checkRoleAccess = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.headers['user-role']?.toLowerCase();
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    req.userRole = userRole;
    req.pool = getPoolByRole(userRole);
    next();
  };
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> LoginPage
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const query = `SELECT * FROM f_authenticate_user($1, $2)`;
    const result = await defaultPool.query(query, [username, password]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const user = result.rows[0];
    const profile = {};
    if (user.first_name) profile.first_name = user.first_name;
    if (user.last_name) profile.last_name = user.last_name;
    if (user.email) profile.email = user.email;
    if (user.phone) profile.phone = user.phone;
    if (user.experience_years !== null) profile.experience_years = user.experience_years;
    res.json({
      user: {
        username: user.login,
        role: user.role.toLowerCase(),
        ...profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> ApplicationsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/ApplicationsComponent/applications', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM f_get_all_applications()');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error while fetching applications' });
  }
});

app.get('/api/admin/ApplicationsComponent/groups', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM f_get_all_groups()');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Server error while fetching groups' });
  }
});

app.get('/api/admin/ApplicationComponent/instructors', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM f_get_all_instructors()');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({ message: 'Server error while fetching instructors' });
  }
});

app.put('/api/admin/ApplicationsComponent/applications/:id', checkRoleAccess(['admin']), async (req, res) => {
  const applicationId = req.params.id;
  const { status } = req.body;
  try {
    await req.pool.query('BEGIN');
    
    const result = await req.pool.query(
      'SELECT * FROM f_update_application_status($1, $2)', 
      [applicationId, status]
    );
    
    await req.pool.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await req.pool.query('ROLLBACK');
    console.error('Error updating application:', error);
    res.status(500).json({ message: 'Server error while updating application' });
  }
});

app.post('/api/admin/ApplicationsComponent/students', checkRoleAccess(['admin']), async (req, res) => {
  const {
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    tin,
    application_id,
    group_id,
    instructor_id
  } = req.body;
  try {
    await req.pool.query('BEGIN');
    const result = await req.pool.query(
      'SELECT * FROM f_create_student($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        first_name,
        last_name,
        birth_date,
        email,
        phone,
        tin,
        application_id,
        group_id,
        instructor_id
      ]
    );
    await req.pool.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await req.pool.query('ROLLBACK');
    console.error('Error creating student record:', error);
        res.status(500).json({ 
      message: error.message || 'Server error while creating student record'
    });
  }
});

app.delete('/api/admin/ApplicationsComponent/applications/:id', checkRoleAccess(['admin']), async (req, res) => {
  const applicationId = req.params.id;
  try {
    const result = await req.pool.query('SELECT f_delete_application($1)', [applicationId]);
    res.json({ success: result.rows[0].f_delete_application });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ message: 'Server error while deleting application' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> StudentsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/StudentsComponent/students', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        s.student_id,
        s.exam_result_id,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score IS NOT NULL THEN 'FAILED'
          ELSE 'NOT TAKEN'
        END as exam_result,
        swg.group_id,
        swi.instructor_id,
        s.application_id
      FROM public.students s
      JOIN public.persons p ON s.person_id = p.person_id
      LEFT JOIN public.exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN public.students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN public.students_with_instructor swi ON s.student_id = swi.student_id
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error while fetching students' });
  }
});

app.get('/api/admin/StudentsComponent/groups', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const query = 'SELECT group_id as id, name FROM public.groups';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Server error while fetching groups' });
  }
});

app.get('/api/admin/StudentsComponent/instructors', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        i.instructor_id as id,
        p.first_name,
        p.last_name
      FROM public.instructors i
      JOIN public.persons p ON i.person_id = p.person_id
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({ message: 'Server error while fetching instructors' });
  }
});

app.put('/api/admin/StudentsComponent/students/:TIN', checkRoleAccess(['admin']), async (req, res) => {
  try {
    await req.pool.query('BEGIN');
    const oldTIN = req.params.TIN;
    const {
      TIN,
      first_name,
      last_name,
      birth_date,
      email,
      phone,
      group_id,
      instructor_id,
      exam_score,
      application_id
    } = req.body;
    
    const updatePersonQuery = `
      UPDATE public.persons
      SET 
        "TIN" = $1,
        first_name = $2,
        last_name = $3,
        birth_date = $4,
        email = $5,
        phone = $6
      WHERE "TIN" = $7
      RETURNING person_id
    `;
    const personResult = await req.pool.query(updatePersonQuery, [
      TIN, first_name, last_name, birth_date, email, phone, oldTIN
    ]);

const today = new Date();
const birthDate = new Date(birth_date);
const age = today.getFullYear() - birthDate.getFullYear();
const monthDiff = today.getMonth() - birthDate.getMonth();
if (age < 16 || (age === 16 && monthDiff < 0) || (age === 16 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
  return res.status(400).json({ message: 'Student must be at least 16 years old' });
}
    
    if (personResult.rows.length === 0) {
      await req.pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const personId = personResult.rows[0].person_id;
    let examResultId = null;
    
    if (exam_score !== null && exam_score !== '' && exam_score !== undefined) {
      const upsertExamResult = `
        INSERT INTO public.exam_results (exam_score)
        VALUES ($1)
        RETURNING exam_result_id
      `;
      const examResult = await req.pool.query(upsertExamResult, [exam_score]);
      examResultId = examResult.rows[0].exam_result_id;
    }
    
    const updateStudentQuery = `
      UPDATE public.students
      SET 
        exam_result_id = $1,
        application_id = $2
      WHERE person_id = $3
      RETURNING student_id
    `;
    const studentResult = await req.pool.query(updateStudentQuery, [
      examResultId,
      application_id || null,
      personId
    ]);
    
    if (studentResult.rows.length === 0) {
      await req.pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Student record not found' });
    }
    
    const studentId = studentResult.rows[0].student_id;
    
    await req.pool.query('DELETE FROM public.students_with_group WHERE student_id = $1', [studentId]);
    if (group_id) {
      await req.pool.query(
        'INSERT INTO public.students_with_group (student_id, group_id) VALUES ($1, $2)',
        [studentId, group_id]
      );
    }
    
    await req.pool.query('DELETE FROM public.students_with_instructor WHERE student_id = $1', [studentId]);
    if (instructor_id) {
      await req.pool.query(
        'INSERT INTO public.students_with_instructor (student_id, instructor_id) VALUES ($1, $2)',
        [studentId, instructor_id]
      );
    }
    
    await req.pool.query('COMMIT');
    
    const getUpdatedStudentQuery = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        s.student_id,
        s.exam_result_id,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score IS NOT NULL THEN 'FAILED'
          ELSE 'NOT TAKEN'
        END as exam_result,
        swg.group_id,
        swi.instructor_id,
        s.application_id
      FROM public.students s
      JOIN public.persons p ON s.person_id = p.person_id
      LEFT JOIN public.exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN public.students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN public.students_with_instructor swi ON s.student_id = swi.student_id
      WHERE p."TIN" = $1
    `;
    const updatedStudent = await req.pool.query(getUpdatedStudentQuery, [TIN]);
    res.json(updatedStudent.rows[0]);
    
  } catch (error) {
    await req.pool.query('ROLLBACK');
    console.error('Error updating student:', error);
    
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Email is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('phone')) {
        return res.status(409).json({ message: 'Phone number is already used by another user' });
      }
      if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
        return res.status(409).json({ message: 'TIN is already used by another user' });
      }
      return res.status(409).json({ message: 'Data already exists in the system' });
    }
    
    if (error.code === '23514') {
      if (error.constraint && error.constraint.includes('first_name_check')) {
        return res.status(400).json({ message: 'First name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('last_name_check')) {
        return res.status(400).json({ message: 'Last name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('email_check')) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }
      if (error.constraint && error.constraint.includes('phone_check')) {
        return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
      }
      if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
        return res.status(400).json({ message: 'TIN must contain 10 digits' });
      }
      if (error.constraint && error.constraint.includes('birth_date_check')) {
        return res.status(400).json({ message: 'Birth date cannot be in the future' });
      }
   if (error.constraint && error.constraint.includes('exam_results_exam_score_check')) {
  return res.status(400).json({ message: 'Exam score must be between 0 and 100' });
}
      return res.status(400).json({ message: 'Invalid data format or constraint violation' });
    }
        if (error.code === '22003') {
  return res.status(400).json({ message: 'Exam score must be between 0 and 100' });
}
    if (error.code === '23503') {
      if (error.constraint && error.constraint.includes('group_id')) {
        return res.status(400).json({ message: 'Invalid group ID' });
      }
      if (error.constraint && error.constraint.includes('instructor_id')) {
        return res.status(400).json({ message: 'Invalid instructor ID' });
      }
      if (error.constraint && error.constraint.includes('application_id')) {
        return res.status(400).json({ message: 'Invalid application ID' });
      }
      return res.status(400).json({ message: 'Referenced record does not exist' });
    }
    
    res.status(500).json({ message: 'Server error while updating student' });
  }
});

app.delete('/api/admin/StudentsComponent/students/:TIN', checkRoleAccess(['admin']), async (req, res) => {
  try {
    await req.pool.query('BEGIN');
    const TIN = req.params.TIN;
    
    const personQuery = 'SELECT person_id FROM public.persons WHERE "TIN" = $1';
    const personResult = await req.pool.query(personQuery, [TIN]);
    
    if (personResult.rows.length === 0) {
      await req.pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const personId = personResult.rows[0].person_id;
    
    await req.pool.query('DELETE FROM public.students WHERE person_id = $1', [personId]);
    await req.pool.query('DELETE FROM public.persons WHERE person_id = $1', [personId]);
    
    await req.pool.query('COMMIT');
    res.json({ message: 'Student deleted successfully' });
    
  } catch (error) {
    await req.pool.query('ROLLBACK');
    console.error('Error deleting student:', error);
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Cannot delete student: record is referenced by other data' });
    }
    
    res.status(500).json({ message: 'Server error while deleting student' });
  }
});

app.post('/api/admin/StudentsComponent/students', checkRoleAccess(['admin']), async (req, res) => {
  const {
    TIN,
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    group_id,
    instructor_id,
    exam_score,
    application_id
  } = req.body;
  
  try {
    await req.pool.query('BEGIN');
    
    const createPersonQuery = `
      INSERT INTO public.persons (first_name, last_name, birth_date, email, phone, "TIN")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING person_id
    `;
    const personResult = await req.pool.query(createPersonQuery, [
      first_name,
      last_name,
      birth_date,
      email,
      phone,
      TIN
    ]);
    const personId = personResult.rows[0].person_id;
    const today = new Date();
const birthDate = new Date(birth_date);
const age = today.getFullYear() - birthDate.getFullYear();
const monthDiff = today.getMonth() - birthDate.getMonth();
if (age < 16 || (age === 16 && monthDiff < 0) || (age === 16 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
  return res.status(400).json({ message: 'Student must be at least 16 years old' });
}
    let examResultId = null;
    if (exam_score !== null && exam_score !== '' && exam_score !== undefined) {
      const createExamResultQuery = `
        INSERT INTO public.exam_results (exam_score)
        VALUES ($1)
        RETURNING exam_result_id
      `;
      const examResult = await req.pool.query(createExamResultQuery, [exam_score]);
      examResultId = examResult.rows[0].exam_result_id;
    }
    
    const createStudentQuery = `
      INSERT INTO public.students (person_id, application_id, exam_result_id)
      VALUES ($1, $2, $3)
      RETURNING student_id
    `;
    const studentResult = await req.pool.query(createStudentQuery, [
      personId,
      application_id || null,
      examResultId
    ]);
    const studentId = studentResult.rows[0].student_id;
    
    if (group_id) {
      const groupAssocQuery = `
        INSERT INTO public.students_with_group (student_id, group_id)
        VALUES ($1, $2)
      `;
      await req.pool.query(groupAssocQuery, [studentId, group_id]);
    }
    
    if (instructor_id) {
      const instructorAssocQuery = `
        INSERT INTO public.students_with_instructor (student_id, instructor_id)
        VALUES ($1, $2)
      `;
      await req.pool.query(instructorAssocQuery, [studentId, instructor_id]);
    }
    
    await req.pool.query('COMMIT');
    
    const getCreatedStudentQuery = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        s.student_id,
        s.exam_result_id,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score IS NOT NULL THEN 'FAILED'
          ELSE 'NOT TAKEN'
        END as exam_result,
        swg.group_id,
        swi.instructor_id,
        s.application_id
      FROM public.students s
      JOIN public.persons p ON s.person_id = p.person_id
      LEFT JOIN public.exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN public.students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN public.students_with_instructor swi ON s.student_id = swi.student_id
      WHERE s.student_id = $1
    `;
    const createdStudent = await req.pool.query(getCreatedStudentQuery, [studentId]);
    res.status(201).json(createdStudent.rows[0]);
    
  } catch (error) {
    await req.pool.query('ROLLBACK');
    console.error('Error creating student:', error);
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Email is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('phone')) {
        return res.status(409).json({ message: 'Phone number is already used by another user' });
      }
      if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
        return res.status(409).json({ message: 'TIN is already used by another user' });
      }
      return res.status(409).json({ message: 'Data already exists in the system' });
    }
    
    if (error.code === '23514') {
      if (error.constraint && error.constraint.includes('first_name_check')) {
        return res.status(400).json({ message: 'First name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('last_name_check')) {
        return res.status(400).json({ message: 'Last name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('email_check')) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }
      if (error.constraint && error.constraint.includes('phone_check')) {
        return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
      }
      if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
        return res.status(400).json({ message: 'TIN must contain 10 digits' });
      }
      if (error.constraint && error.constraint.includes('birth_date_check')) {
        return res.status(400).json({ message: 'Birth date cannot be in the future' });
      }
      if (error.constraint && error.constraint.includes('exam_results_exam_score_check')) {
  return res.status(400).json({ message: 'Exam score must be between 0 and 100' });
}
      return res.status(400).json({ message: 'Invalid data format or constraint violation' });
    }
    if (error.code === '22003') {
  return res.status(400).json({ message: 'Exam score must be between 0 and 100' });
}
    if (error.code === '23503') { // foreign_key_violation
      if (error.constraint && error.constraint.includes('group_id')) {
        return res.status(400).json({ message: 'Invalid group ID' });
      }
      if (error.constraint && error.constraint.includes('instructor_id')) {
        return res.status(400).json({ message: 'Invalid instructor ID' });
      }
      if (error.constraint && error.constraint.includes('application_id')) {
        return res.status(400).json({ message: 'Invalid application ID' });
      }
      return res.status(400).json({ message: 'Referenced record does not exist' });
    }
    
    res.status(500).json({ message: 'Server error while creating student' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> InstructorsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/InstructorsComponent/instructors', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        i.experience_years,
        dc.driving_category,
        i.car_id,
        i.login
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      ORDER BY p.last_name, p.first_name
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({ message: 'Server error while fetching instructors' });
  }
});

app.get('/api/admin/InstructorsComponent/cars', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        c.car_id as id,
        cb.car_brand_name as brand,
        cm.car_model_name as model,
        c.license_plate,
        c.year_of_manufacture
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      ORDER BY cb.car_brand_name, cm.car_model_name
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ message: 'Server error while fetching cars' });
  }
});

app.post('/api/admin/InstructorsComponent/instructors', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { TIN, first_name, last_name, birth_date, email, phone, driving_category, experience_years, car_id, login, password } = req.body;
    
    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }
    
    const personQuery = `
      INSERT INTO persons ("TIN", first_name, last_name, birth_date, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING person_id
    `;
    const personResult = await client.query(personQuery, [TIN, first_name, last_name, birth_date, email, phone]);
    const personId = personResult.rows[0].person_id;
    
    const categoryQuery = `
      SELECT driving_category_id 
      FROM driving_categories 
      WHERE driving_category = $1
    `;
    const categoryResult = await client.query(categoryQuery, [driving_category]);
    
    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid driving category' });
    }
    
    const drivingCategoryId = categoryResult.rows[0].driving_category_id;
    
    const userQuery = `
      INSERT INTO system_users (login, password, system_user_role_id, db_username, db_role)
      VALUES ($1, $2, (SELECT system_user_role_id FROM system_users_roles WHERE system_user_role = 'Instructor'), $3, $4)
      RETURNING login
    `;
    await client.query(userQuery, [
      login, 
      password, 
      process.env.DB_USERNAME_INSTRUCTOR, 
      'instructor_role'
    ]);
    
    const instructorQuery = `
      INSERT INTO instructors (person_id, car_id, login, driving_category_id, experience_years)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING instructor_id
    `;
    await client.query(instructorQuery, [personId, car_id || null, login, drivingCategoryId, experience_years]);
    
    await client.query('COMMIT');
    
    const newInstructorQuery = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        i.experience_years,
        dc.driving_category,
        i.car_id,
        i.login
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      WHERE p."TIN" = $1
    `;
    const newInstructor = await client.query(newInstructorQuery, [TIN]);
    res.json(newInstructor.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding instructor:', error);
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Email is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('phone')) {
        return res.status(409).json({ message: 'Phone number is already used by another user' });
      }
      if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
        return res.status(409).json({ message: 'TIN is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('login')) {
        return res.status(409).json({ message: 'Login is already used by another user' });
      }
      return res.status(409).json({ message: 'Data already exists in the system' });
    }
    
    if (error.code === '23514') {
      if (error.constraint && error.constraint.includes('first_name_check')) {
        return res.status(400).json({ message: 'First name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('last_name_check')) {
        return res.status(400).json({ message: 'Last name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('email_check')) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }
      if (error.constraint && error.constraint.includes('phone_check')) {
        return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
      }
      if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
        return res.status(400).json({ message: 'TIN must contain 10 digits' });
      }
      if (error.constraint && error.constraint.includes('birth_date_check')) {
        return res.status(400).json({ message: 'Birth date cannot be in the future' });
      }
      if (error.constraint && error.constraint.includes('experience_years_check')) {
        return res.status(400).json({ message: 'Experience years must be greater than 0' });
      }
      if (error.constraint && error.constraint.includes('password_check')) {
        return res.status(400).json({ message: 'Password must be at least 4 characters long' });
      }
      return res.status(400).json({ message: 'Invalid data format or constraint violation' });
    }
    
    if (error.code === '23503') {
      if (error.constraint && error.constraint.includes('car_id')) {
        return res.status(400).json({ message: 'Invalid car ID' });
      }
      if (error.constraint && error.constraint.includes('driving_category_id')) {
        return res.status(400).json({ message: 'Invalid driving category' });
      }
      if (error.constraint && error.constraint.includes('system_user_role_id')) {
        return res.status(400).json({ message: 'Invalid system user role' });
      }
      return res.status(400).json({ message: 'Referenced record does not exist' });
    }
if (error.code === 'P0001') {
  return res.status(400).json({ message: error.message });
}
    
    res.status(500).json({ message: 'Server error while creating instructor' });
  } finally {
    client.release();
  }
});

// Update instructor
app.put('/api/admin/InstructorsComponent/instructors/:tin', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { tin } = req.params;
    const { TIN, first_name, last_name, birth_date, email, phone, driving_category, experience_years, car_id, login, password } = req.body;
    
    if (password && password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }
    
    const updatePersonQuery = `
      UPDATE persons 
      SET "TIN" = $1, first_name = $2, last_name = $3, birth_date = $4, email = $5, phone = $6
      WHERE "TIN" = $7
      RETURNING person_id
    `;
    const personResult = await client.query(updatePersonQuery, [TIN, first_name, last_name, birth_date, email, phone, tin]);
    
    if (personResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Instructor not found' });
    }
    
    const personId = personResult.rows[0].person_id;
    
    const categoryQuery = `
      SELECT driving_category_id 
      FROM driving_categories 
      WHERE driving_category = $1
    `;
    const categoryResult = await client.query(categoryQuery, [driving_category]);
    
    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid driving category' });
    }
    
    const drivingCategoryId = categoryResult.rows[0].driving_category_id;
    
    const oldLoginQuery = `
      SELECT login FROM instructors WHERE person_id = $1
    `;
    const oldLoginResult = await client.query(oldLoginQuery, [personId]);
    const oldLogin = oldLoginResult.rows[0].login;
    
    if (password) {
      await client.query(`
        UPDATE system_users 
        SET login = $1, password = $2
        WHERE login = $3
      `, [login, password, oldLogin]);
    } else {
      if (oldLogin !== login) {
        await client.query(`
          UPDATE system_users 
          SET login = $1 
          WHERE login = $2
        `, [login, oldLogin]);
      }
    }
    
    const updateInstructorQuery = `
      UPDATE instructors 
      SET car_id = $1, driving_category_id = $2, experience_years = $3, login = $4
      WHERE person_id = $5
    `;
    await client.query(updateInstructorQuery, [car_id || null, drivingCategoryId, experience_years, login, personId]);
    
    await client.query('COMMIT');
    
    const updatedInstructorQuery = `
      SELECT 
        p."TIN",
        p.first_name,
        p.last_name,
        p.birth_date,
        p.email,
        p.phone,
        i.experience_years,
        dc.driving_category,
        i.car_id,
        i.login
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      WHERE p."TIN" = $1
    `;
    const updatedInstructor = await client.query(updatedInstructorQuery, [TIN]);
    res.json(updatedInstructor.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating instructor:', error);
    if (error.code === '23505') {
      if (error.constraint && error.constraint.includes('email')) {
        return res.status(409).json({ message: 'Email is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('phone')) {
        return res.status(409).json({ message: 'Phone number is already used by another user' });
      }
      if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
        return res.status(409).json({ message: 'TIN is already used by another user' });
      }
      if (error.constraint && error.constraint.includes('login')) {
        return res.status(409).json({ message: 'Login is already used by another user' });
      }
      return res.status(409).json({ message: 'Data already exists in the system' });
    }
    
    if (error.code === '23514') {
      if (error.constraint && error.constraint.includes('first_name_check')) {
        return res.status(400).json({ message: 'First name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('last_name_check')) {
        return res.status(400).json({ message: 'Last name can contain only 2-50 letters' });
      }
      if (error.constraint && error.constraint.includes('email_check')) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }
      if (error.constraint && error.constraint.includes('phone_check')) {
        return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
      }
      if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
        return res.status(400).json({ message: 'TIN must contain 10 digits' });
      }
      if (error.constraint && error.constraint.includes('birth_date_check')) {
        return res.status(400).json({ message: 'Birth date cannot be in the future' });
      }
      if (error.constraint && error.constraint.includes('experience_years_check')) {
        return res.status(400).json({ message: 'Experience years must be greater than 0' });
      }
      if (error.constraint && error.constraint.includes('password_check')) {
        return res.status(400).json({ message: 'Password must be at least 4 characters long' });
      }
      return res.status(400).json({ message: 'Invalid data format or constraint violation' });
    }
    
    if (error.code === '23503') { // foreign_key_violation
      if (error.constraint && error.constraint.includes('car_id')) {
        return res.status(400).json({ message: 'Invalid car ID' });
      }
      if (error.constraint && error.constraint.includes('driving_category_id')) {
        return res.status(400).json({ message: 'Invalid driving category' });
      }
      if (error.constraint && error.constraint.includes('system_user_role_id')) {
        return res.status(400).json({ message: 'Invalid system user role' });
      }
      return res.status(400).json({ message: 'Referenced record does not exist' });
    }
if (error.code === 'P0001') {
  return res.status(400).json({ message: error.message });
}
    
    res.status(500).json({ message: 'Server error while updating instructor' });
  } finally {
    client.release();
  }
});

// Delete instructor
app.delete('/api/admin/InstructorsComponent/instructors/:tin', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { tin } = req.params;
    const getInstructorQuery = `
      SELECT i.login, p.person_id, i.instructor_id
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      WHERE p."TIN" = $1
    `;
    const instructorResult = await client.query(getInstructorQuery, [tin]);
    
    if (instructorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Instructor not found' });
    }
    
    const { login, person_id, instructor_id } = instructorResult.rows[0];
    const individualLessonsQuery = `
      SELECT COUNT(*) as count 
      FROM individual_lessons il
      WHERE il.instructor_id = $1
    `;
    const individualLessonsResult = await client.query(individualLessonsQuery, [instructor_id]);
    const individualLessonsCount = parseInt(individualLessonsResult.rows[0].count);
    const examsQuery = `
      SELECT COUNT(*) as count 
      FROM exams e
      WHERE e.instructor_id = $1
    `;
    const examsResult = await client.query(examsQuery, [instructor_id]);
    const examsCount = parseInt(examsResult.rows[0].count);
    const studentsQuery = `
      SELECT COUNT(*) as count 
      FROM students_with_instructor swi
      WHERE swi.instructor_id = $1
    `;
    const studentsResult = await client.query(studentsQuery, [instructor_id]);
    const studentsCount = parseInt(studentsResult.rows[0].count);

    const dependencies = [];
    if (individualLessonsCount > 0) {
      dependencies.push(`${individualLessonsCount} individual lesson${individualLessonsCount > 1 ? 's' : ''}`);
    }
    if (examsCount > 0) {
      dependencies.push(`${examsCount} exam${examsCount > 1 ? 's' : ''}`);
    }
    if (studentsCount > 0) {
      dependencies.push(`${studentsCount} assigned student${studentsCount > 1 ? 's' : ''}`);
    }
    
    if (dependencies.length > 0) {
      await client.query('ROLLBACK');
      const dependencyText = dependencies.length === 1 
        ? dependencies[0]
        : dependencies.slice(0, -1).join(', ') + ' and ' + dependencies[dependencies.length - 1];
      
      return res.status(400).json({ 
        message: `Cannot delete instructor: instructor has ${dependencyText}. Please remove these dependencies first.`
      });
    }
    
    await client.query('DELETE FROM system_users WHERE login = $1', [login]);
    await client.query('DELETE FROM persons WHERE person_id = $1', [person_id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Instructor deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting instructor:', error);
    if (error.code === '23503') { 
      if (error.constraint && error.constraint.includes('individual_lessons_instructor_id_fkey')) {
        return res.status(400).json({ message: 'Cannot delete instructor: instructor has individual lessons' });
      }
      if (error.constraint && error.constraint.includes('exams_instructor_id_fkey')) {
        return res.status(400).json({ message: 'Cannot delete instructor: instructor has exams' });
      }
      if (error.constraint && error.constraint.includes('students_with_instructor_instructor_id_fkey')) {
        return res.status(400).json({ message: 'Cannot delete instructor: instructor has assigned students' });
      }
      if (error.constraint && error.constraint.includes('instructor_id')) {
        return res.status(400).json({ message: 'Cannot delete instructor: instructor has active lessons or exams' });
      }
      if (error.constraint && error.constraint.includes('person_id')) {
        return res.status(400).json({ message: 'Cannot delete instructor: person record is referenced elsewhere' });
      }
      return res.status(400).json({ message: 'Cannot delete instructor: record is referenced by other data' });
    }
    if (error.code === 'P0001') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error while deleting instructor' });
  } finally {
    client.release();
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> TeachersComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/TeachersComponent/teachers', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
    try {
        const query = `
            SELECT 
                t.teacher_id,
                t.login,
                p.first_name,
                p.last_name,
                p.birth_date,
                p.email,
                p.phone,
                p."TIN"
            FROM teachers t
            JOIN persons p ON t.person_id = p.person_id
        `;
        const result = await req.pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching teachers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/TeachersComponent/teachers/:id', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                t.teacher_id,
                t.login,
                p.first_name,
                p.last_name,
                p.birth_date,
                p.email,
                p.phone,
                p."TIN"
            FROM teachers t
            JOIN persons p ON t.person_id = p.person_id
            WHERE t.teacher_id = $1
        `;
        const result = await req.pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching teacher:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/admin/TeachersComponent/teachers', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const {
            first_name,
            last_name,
            birth_date,
            email,
            phone,
            TIN,
            login,
            password
        } = req.body;

        if (!password || password.length < 4) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Password is required and must be at least 4 characters' });
        }
        const birthDate = new Date(birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();
        
        const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);
        
        if (actualAge < 21) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Teacher must be at least 21 years old' });
        }

        const roleQuery = `
            SELECT system_user_role_id 
            FROM system_users_roles 
            WHERE system_user_role = 'Teacher'
        `;
        const roleResult = await client.query(roleQuery);
        if (roleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Teacher role not found in system' });
        }
        const system_user_role_id = roleResult.rows[0].system_user_role_id;

        const personQuery = `
            INSERT INTO persons (first_name, last_name, birth_date, email, phone, "TIN")
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING person_id
        `;
        const personResult = await client.query(personQuery, [
            first_name, last_name, birth_date, email, phone, TIN
        ]);

        const userQuery = `
            INSERT INTO system_users (login, password, system_user_role_id, db_username, db_role)
            VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(userQuery, [login, password, system_user_role_id, 'teacher_user', 'teacher_role']);

        const teacherQuery = `
            INSERT INTO teachers (login, person_id)
            VALUES ($1, $2)
            RETURNING teacher_id
        `;
        const teacherResult = await client.query(teacherQuery, [
            login, personResult.rows[0].person_id
        ]);

        await client.query('COMMIT');
        res.status(201).json({
            teacher_id: teacherResult.rows[0].teacher_id,
            message: 'Teacher created successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating teacher:', error);
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('email')) {
                return res.status(409).json({ message: 'Email is already used by another user' });
            }
            if (error.constraint && error.constraint.includes('phone')) {
                return res.status(409).json({ message: 'Phone number is already used by another user' });
            }
            if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
                return res.status(409).json({ message: 'TIN is already used by another user' });
            }
            if (error.constraint && error.constraint.includes('login')) {
                return res.status(409).json({ message: 'Login is already used by another user' });
            }
            return res.status(409).json({ message: 'Data already exists in the system' });
        }

        if (error.code === '23514') {
            if (error.constraint && error.constraint.includes('first_name_check')) {
                return res.status(400).json({ message: 'First name must be at least 2 characters and contain only letters' });
            }
            if (error.constraint && error.constraint.includes('last_name_check')) {
                return res.status(400).json({ message: 'Last name must be at least 2 characters and contain only letters' });
            }
            if (error.constraint && error.constraint.includes('email_check')) {
                return res.status(400).json({ message: 'Invalid email address format' });
            }
            if (error.constraint && error.constraint.includes('phone_check')) {
                return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
            }
            if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
                return res.status(400).json({ message: 'TIN must contain exactly 10 digits' });
            }
            if (error.constraint && error.constraint.includes('birth_date_check')) {
                return res.status(400).json({ message: 'Birth date cannot be in the future' });
            }
            if (error.constraint && error.constraint.includes('password_check')) {
                return res.status(400).json({ message: 'Password must be at least 4 characters' });
            }
            return res.status(400).json({ message: 'Invalid data format or constraint violation' });
        }

        if (error.code === '23503') {
            if (error.constraint && error.constraint.includes('system_user_role_id')) {
                return res.status(400).json({ message: 'Invalid system user role' });
            }
            return res.status(400).json({ message: 'Referenced record does not exist' });
        }

        res.status(500).json({ message: 'Server error while creating teacher' });
    } finally {
        client.release();
    }
});

app.put('/api/admin/TeachersComponent/teachers/:id', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const {
            first_name,
            last_name,
            birth_date,
            email,
            phone,
            TIN,
            login,
            password
        } = req.body;

        const teacherQuery = 'SELECT person_id, login FROM teachers WHERE teacher_id = $1';
        const teacherResult = await client.query(teacherQuery, [id]);
        if (teacherResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const currentLogin = teacherResult.rows[0].login;
        const personId = teacherResult.rows[0].person_id;
        const birthDate = new Date(birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();
        
        const actualAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);
        
        if (actualAge < 21) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Teacher must be at least 21 years old' });
        }

        const updatePersonQuery = `
            UPDATE persons
            SET 
                first_name = $1,
                last_name = $2,
                birth_date = $3,
                email = $4,
                phone = $5,
                "TIN" = $6
            WHERE person_id = $7
        `;
        await client.query(updatePersonQuery, [
            first_name,
            last_name,
            birth_date,
            email,
            phone,
            TIN,
            personId
        ]);

        if (login && login.trim() !== '' && login !== currentLogin) {
            const updateUserLoginQuery = `
                UPDATE system_users
                SET login = $1
                WHERE login = $2
            `;
            await client.query(updateUserLoginQuery, [login, currentLogin]);

            const updateTeacherLoginQuery = `
                UPDATE teachers
                SET login = $1
                WHERE teacher_id = $2
            `;
            await client.query(updateTeacherLoginQuery, [login, id]);
        }

        if (password && password.trim() !== '') {
            if (password.length < 4) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Password must be at least 4 characters' });
            }
            const loginToUse = (login && login.trim() !== '' && login !== currentLogin) ? login : currentLogin;
            const updatePasswordQuery = `
                UPDATE system_users
                SET password = $1
                WHERE login = $2
            `;
            await client.query(updatePasswordQuery, [password, loginToUse]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Teacher updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating teacher:', error);
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('email')) {
                return res.status(409).json({ message: 'Email is already used by another user' });
            }
            if (error.constraint && error.constraint.includes('phone')) {
                return res.status(409).json({ message: 'Phone number is already used by another user' });
            }
            if (error.constraint && (error.constraint.includes('TIN') || error.constraint.includes('tin'))) {
                return res.status(409).json({ message: 'TIN is already used by another user' });
            }
            if (error.constraint && error.constraint.includes('login')) {
                return res.status(409).json({ message: 'Login is already used by another user' });
            }
            return res.status(409).json({ message: 'Data already exists in the system' });
        }

        if (error.code === '23514') {
            if (error.constraint && error.constraint.includes('first_name_check')) {
                return res.status(400).json({ message: 'First name must be at least 2 characters and contain only letters' });
            }
            if (error.constraint && error.constraint.includes('last_name_check')) {
                return res.status(400).json({ message: 'Last name must be at least 2 characters and contain only letters' });
            }
            if (error.constraint && error.constraint.includes('email_check')) {
                return res.status(400).json({ message: 'Invalid email address format' });
            }
            if (error.constraint && error.constraint.includes('phone_check')) {
                return res.status(400).json({ message: 'Invalid phone number format (9-15 digits, may start with +)' });
            }
            if (error.constraint && (error.constraint.includes('TIN_check') || error.constraint.includes('tin_check'))) {
                return res.status(400).json({ message: 'TIN must contain exactly 10 digits' });
            }
            if (error.constraint && error.constraint.includes('birth_date_check')) {
                return res.status(400).json({ message: 'Birth date cannot be in the future' });
            }
            if (error.constraint && error.constraint.includes('password_check')) {
                return res.status(400).json({ message: 'Password must be at least 4 characters' });
            }
            return res.status(400).json({ message: 'Invalid data format or constraint violation' });
        }

        if (error.code === '23503') {
            if (error.constraint && error.constraint.includes('person_id')) {
                return res.status(400).json({ message: 'Invalid person reference' });
            }
            if (error.constraint && error.constraint.includes('login')) {
                return res.status(400).json({ message: 'Invalid login reference' });
            }
            return res.status(400).json({ message: 'Referenced record does not exist' });
        }

        res.status(500).json({ message: 'Server error while updating teacher' });
    } finally {
        client.release();
    }
});

// Delete teacher
app.delete('/api/admin/TeachersComponent/teachers/:id', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const getTeacherQuery = `
      SELECT t.login, t.person_id, t.teacher_id
      FROM teachers t
      WHERE t.teacher_id = $1
    `;
    const teacherResult = await client.query(getTeacherQuery, [id]);
    
    if (teacherResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    const { login, person_id, teacher_id } = teacherResult.rows[0];
    const groupsQuery = `
      SELECT COUNT(*) as count 
      FROM groups g
      WHERE g.teacher_id = $1
    `;
    const groupsResult = await client.query(groupsQuery, [teacher_id]);
    const groupsCount = parseInt(groupsResult.rows[0].count);
    
    const examsQuery = `
      SELECT COUNT(*) as count 
      FROM exams e
      WHERE e.teacher_id = $1
    `;
    const examsResult = await client.query(examsQuery, [teacher_id]);
    const examsCount = parseInt(examsResult.rows[0].count);
    
    const dependencies = [];
    if (groupsCount > 0) {
      dependencies.push(`${groupsCount} group${groupsCount > 1 ? 's' : ''}`);
    }
    if (examsCount > 0) {
      dependencies.push(`${examsCount} exam${examsCount > 1 ? 's' : ''}`);
    }
    
    if (dependencies.length > 0) {
      await client.query('ROLLBACK');
      const dependencyText = dependencies.length === 1 
        ? dependencies[0]
        : dependencies.slice(0, -1).join(', ') + ' and ' + dependencies[dependencies.length - 1];
      
      return res.status(400).json({ 
        message: `Cannot delete teacher: teacher has ${dependencyText}. Please remove these dependencies first.`
      });
    }

    await client.query('DELETE FROM system_users WHERE login = $1', [login]);
    await client.query('DELETE FROM persons WHERE person_id = $1', [person_id]);
    
    await client.query('COMMIT');
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting teacher:', error);
    
    if (error.code === '23503') {
      if (error.constraint && error.constraint.includes('groups_teacher_id_fkey')) {
        return res.status(400).json({ message: 'Cannot delete teacher: teacher has assigned groups' });
      }
      if (error.constraint && error.constraint.includes('exams_teacher_id_fkey')) {
        return res.status(400).json({ message: 'Cannot delete teacher: teacher has exams' });
      }
      if (error.constraint && error.constraint.includes('teacher_id')) {
        return res.status(400).json({ message: 'Cannot delete teacher: teacher has active groups or exams' });
      }
      if (error.constraint && error.constraint.includes('person_id')) {
        return res.status(400).json({ message: 'Cannot delete teacher: person record is referenced elsewhere' });
      }
      return res.status(400).json({ message: 'Cannot delete teacher: record is referenced by other data' });
    }

    if (error.code === 'P0001') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error while deleting teacher' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/TeachersComponent/teachers/:id/groups', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                g.group_id,
                g.name,
                g.current_students
            FROM groups g
            WHERE g.teacher_id = $1
        `;
        const result = await req.pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching teacher groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/admin/teachers/:id', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const groupsCheck = await client.query(
            'SELECT COUNT(*) as group_count FROM groups WHERE teacher_id = $1', 
            [id]
        );
        if (parseInt(groupsCheck.rows[0].group_count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot delete teacher: teacher has active groups. Please reassign or delete the groups first.',
                hasActiveGroups: true,
                groupCount: parseInt(groupsCheck.rows[0].group_count)
            });
        }
        const examsCheck = await client.query(
            'SELECT COUNT(*) as exam_count FROM exams WHERE teacher_id = $1', 
            [id]
        );
        if (parseInt(examsCheck.rows[0].exam_count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot delete teacher: teacher has scheduled exams. Please reassign the exams first.',
                hasActiveExams: true,
                examCount: parseInt(examsCheck.rows[0].exam_count)
            });
        }
        const deleteResult = await client.query(
            'DELETE FROM teachers WHERE teacher_id = $1 RETURNING *', 
            [id]
        );
        if (deleteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Teacher not found' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting teacher:', err);
        if (err.code === '23503') {
            return res.status(400).json({ 
                error: 'Cannot delete teacher: teacher has associated records. Please remove associated data first.',
                constraint: err.constraint
            });
        }
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.delete('/api/admin/teachers/:id/force', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { reassignToTeacherId } = req.body;
        if (reassignToTeacherId) {
            await client.query(
                'UPDATE groups SET teacher_id = $1 WHERE teacher_id = $2',
                [reassignToTeacherId, id]
            );
            await client.query(
                'UPDATE exams SET teacher_id = $1 WHERE teacher_id = $2',
                [reassignToTeacherId, id]
            );
        } else {
            await client.query('DELETE FROM groups WHERE teacher_id = $1', [id]);
            await client.query('DELETE FROM exams WHERE teacher_id = $1', [id]);
        }
        const deleteResult = await client.query(
            'DELETE FROM teachers WHERE teacher_id = $1 RETURNING *', 
            [id]
        );
        if (deleteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Teacher not found' });
        }
        await client.query('COMMIT');
        res.json({ 
            message: 'Teacher deleted successfully',
            reassigned: !!reassignToTeacherId
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error force deleting teacher:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

app.get('/api/admin/teachers/:id/dependencies', checkRoleAccess(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const groupsQuery = `
            SELECT g.group_id, g.name, g.current_students
            FROM groups g
            WHERE g.teacher_id = $1
            ORDER BY g.name
        `;
        const examsQuery = `
            SELECT e.exam_id, e.type, e.start_time, e.end_time
            FROM exams e
            WHERE e.teacher_id = $1
            ORDER BY e.start_time
        `;
        const [groupsResult, examsResult] = await Promise.all([
            req.pool.query(groupsQuery, [id]),
            req.pool.query(examsQuery, [id])
        ]);
        res.json({
            groups: groupsResult.rows,
            exams: examsResult.rows,
            canDelete: groupsResult.rows.length === 0 && examsResult.rows.length === 0
        });
    } catch (err) {
        console.error('Error fetching teacher dependencies:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/admin/teachers/:id/reassign-groups', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { newTeacherId } = req.body;
        if (!newTeacherId) {
            return res.status(400).json({ error: 'New teacher ID is required' });
        }
        const teacherCheck = await client.query(
            'SELECT teacher_id FROM teachers WHERE teacher_id = $1',
            [newTeacherId]
        );
        if (teacherCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'New teacher not found' });
        }
        const updateResult = await client.query(
            'UPDATE groups SET teacher_id = $1 WHERE teacher_id = $2 RETURNING group_id, name',
            [newTeacherId, id]
        );
        await client.query(
            'UPDATE exams SET teacher_id = $1 WHERE teacher_id = $2',
            [newTeacherId, id]
        );
        await client.query('COMMIT');
        res.json({
            message: 'Groups and exams reassigned successfully',
            reassignedGroups: updateResult.rows
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error reassigning groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> GroupsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get all groups
app.get('/api/admin/groups', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
    try {
        const query = `
            SELECT g.group_id, g.name, g.teacher_id, g.current_students,
                   p.first_name, p.last_name
            FROM groups g
            LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
            LEFT JOIN persons p ON t.person_id = p.person_id
            ORDER BY g.group_id
        `;
        const result = await req.pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new group
app.post('/api/admin/groups', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { name, teacher_id, current_students } = req.body;
        const insertQuery = `
            INSERT INTO groups (name, teacher_id, current_students)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await client.query(insertQuery, [
            name, 
            teacher_id, 
            current_students || 0
        ]);
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating group:', error);
      
        if (error.code === '23505') { 
            if (error.constraint && error.constraint.includes('name')) {
                return res.status(409).json({ message: 'Group name already exists' });
            }
            return res.status(409).json({ message: 'Data already exists in the system' });
        }
        
        if (error.code === '23514') { 
            if (error.constraint && error.constraint.includes('name_check')) {
                return res.status(400).json({ message: 'Group name must be between 2 and 50 characters' });
            }
            if (error.constraint && error.constraint.includes('current_students_check')) {
                return res.status(400).json({ message: 'Current students count cannot be negative' });
            }
            return res.status(400).json({ message: 'Invalid data format or constraint violation' });
        }
        
        if (error.code === '22001') { 
            return res.status(400).json({ message: 'Group name must be between 2 and 50 characters' });
        }
        
        if (error.code === '23503') { 
            if (error.constraint && error.constraint.includes('teacher_id')) {
                return res.status(400).json({ message: 'Invalid teacher ID' });
            }
            return res.status(400).json({ message: 'Referenced record does not exist' });
        }
        
        res.status(500).json({ message: 'Server error while creating group' });
    } finally {
        client.release();
    }
});


// Update group
app.put('/api/admin/groups/:id', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { name, teacher_id, current_students } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Group name is required' });
        }
        
        if (!teacher_id) {
            return res.status(400).json({ message: 'Teacher ID is required' });
        }
        let finalCurrentStudents = current_students;
        
        if (current_students === null || current_students === undefined || current_students === '') {
            const currentGroupQuery = 'SELECT current_students FROM groups WHERE group_id = $1';
            const currentGroupResult = await client.query(currentGroupQuery, [id]);
            
            if (currentGroupResult.rows.length === 0) {
                return res.status(404).json({ error: 'Group not found' });
            }
            
            finalCurrentStudents = currentGroupResult.rows[0].current_students;
        }
        if (isNaN(finalCurrentStudents) || finalCurrentStudents < 0) {
            return res.status(400).json({ message: 'Current students count must be a non-negative number' });
        }
        
        const updateQuery = `
            UPDATE groups 
            SET name = $1, 
                teacher_id = $2, 
                current_students = $3
            WHERE group_id = $4
            RETURNING *
        `;
        
        const result = await client.query(updateQuery, [
            name.trim(),
            teacher_id,
            parseInt(finalCurrentStudents),
            id
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        await client.query('COMMIT');
        res.json(result.rows[0]);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating group:', error);

        if (error.code === '23502') {
            if (error.column === 'current_students') {
                return res.status(400).json({ message: 'Current students count is required' });
            }
            return res.status(400).json({ message: 'Required field is missing' });
        }
        
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('name')) {
                return res.status(409).json({ message: 'Group name already exists' });
            }
            return res.status(409).json({ message: 'Data already exists in the system' });
        }
        
        if (error.code === '23514') {
            if (error.constraint && error.constraint.includes('name_check')) {
                return res.status(400).json({ message: 'Group name must be between 2 and 50 characters' });
            }
            if (error.constraint && error.constraint.includes('current_students_check')) {
                return res.status(400).json({ message: 'Current students count cannot be negative' });
            }
            return res.status(400).json({ message: 'Invalid data format or constraint violation' });
        }
        
        if (error.code === '22001') {
            return res.status(400).json({ message: 'Group name must be between 2 and 50 characters' });
        }
        
        if (error.code === '23503') {
            if (error.constraint && error.constraint.includes('teacher_id')) {
                return res.status(400).json({ message: 'Invalid teacher ID' });
            }
            return res.status(400).json({ message: 'Referenced record does not exist' });
        }
        
        res.status(500).json({ message: 'Server error while updating group' });
    } finally {
        client.release();
    }
});

// Delete group
app.delete('/api/admin/groups/:id', checkRoleAccess(['admin']), async (req, res) => {
    const client = await req.pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const studentsCheck = await client.query('SELECT COUNT(*) FROM students_with_group WHERE group_id = $1', [id]);
        if (parseInt(studentsCheck.rows[0].count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot delete group with students. Please remove all students from the group first.' 
            });
        }
        const lessonsCheck = await client.query('SELECT COUNT(*) FROM group_lessons WHERE group_id = $1', [id]);
        if (parseInt(lessonsCheck.rows[0].count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot delete group with scheduled lessons. Please remove all lessons for this group first.' 
            });
        }
        
        const result = await client.query('DELETE FROM groups WHERE group_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Group not found' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Group deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting group:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Get all teachers
app.get('/api/admin/teachers', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
    try {
        const query = `
            SELECT t.teacher_id, p.first_name, p.last_name, p."TIN"
            FROM teachers t
            JOIN persons p ON t.person_id = p.person_id
            ORDER BY p.last_name, p.first_name
        `;
        const result = await req.pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching teachers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> LessonsComponent (with Role-Based Access) - Updated for classroom_id migration
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get all lessons with related information
app.get('/api/admin/lessons', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const query = `
      SELECT 
        l.lesson_id,
        l.lesson_type_id,
        l.lesson_status_id,
        l.lesson_topic_id,
        l.start_time,
        l.end_time,
        lt.lesson_type,
        ls.lesson_status,
        ltp.lesson_topic,
        gl.classroom_id,
        c.name as classroom_name,
        gl.group_id,
        g.name as group_name,
        il.instructor_id,
        il.student_id,
        CONCAT(p_i.last_name, ' ', p_i.first_name) as instructor_name,
        CONCAT(p_s.last_name, ' ', p_s.first_name) as student_name
      FROM lessons l
      LEFT JOIN lesson_types lt ON l.lesson_type_id = lt.lesson_type_id
      LEFT JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      LEFT JOIN lesson_topics ltp ON l.lesson_topic_id = ltp.lesson_topic_id
      LEFT JOIN group_lessons gl ON l.lesson_id = gl.lesson_id
      LEFT JOIN classrooms c ON gl.classroom_id = c.classroom_id
      LEFT JOIN groups g ON gl.group_id = g.group_id
      LEFT JOIN individual_lessons il ON l.lesson_id = il.lesson_id
      LEFT JOIN instructors i ON il.instructor_id = i.instructor_id
      LEFT JOIN persons p_i ON i.person_id = p_i.person_id
      LEFT JOIN students s ON il.student_id = s.student_id
      LEFT JOIN persons p_s ON s.person_id = p_s.person_id
      ORDER BY l.start_time`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all lesson types
app.get('/api/admin/lesson_types', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const { rows } = await pool.query('SELECT * FROM lesson_types ORDER BY lesson_type');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all lesson statuses
app.get('/api/admin/lesson_statuses', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const { rows } = await pool.query('SELECT * FROM lesson_statuses ORDER BY lesson_status');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all lesson topics
app.get('/api/admin/lesson_topics', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const { rows } = await pool.query('SELECT * FROM lesson_topics ORDER BY lesson_topic');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new lesson (admin and teacher only)
app.post('/api/admin/lessons', checkRoleAccess(['admin', 'teacher']), async (req, res) => {
  const pool = req.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      classroom_id,
      start_time,
      end_time,
      group_id,
      instructor_id,
      student_id
    } = req.body;
    const lessonQuery = `
      INSERT INTO lessons (
        lesson_type_id,
        lesson_status_id,
        lesson_topic_id,
        start_time,
        end_time
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING lesson_id`;
    const { rows: [lesson] } = await client.query(lessonQuery, [
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      start_time,
      end_time
    ]);
    const lessonTypeQuery = 'SELECT lesson_type FROM lesson_types WHERE lesson_type_id = $1';
    const { rows: [lessonTypeResult] } = await client.query(lessonTypeQuery, [lesson_type_id]);
    if (!lessonTypeResult) {
      throw new Error(`Lesson type with ID ${lesson_type_id} not found`);
    }
    const lesson_type = lessonTypeResult.lesson_type.toLowerCase();
    if (lesson_type.includes('theory') ) {
      if (!group_id) {
        throw new Error('group_id is required for theory/group lessons');
      }
      await client.query(
        'INSERT INTO group_lessons (lesson_id, group_id, classroom_id) VALUES ($1, $2, $3)',
        [lesson.lesson_id, group_id, classroom_id]
      );
    } else if (lesson_type.includes('practical')) {
      if (!instructor_id || !student_id) {
        throw new Error('instructor_id and student_id are required for practice/individual lessons');
      }
      await client.query(
        'INSERT INTO individual_lessons (lesson_id, instructor_id, student_id) VALUES ($1, $2, $3)',
        [lesson.lesson_id, instructor_id, student_id]
      );
    } else {
      console.warn(`Unknown lesson type: "${lesson_type}". Available types should include 'theory', 'practice', 'group', or 'individual'`);
      throw new Error(`Unknown lesson type: ${lesson_type}`);
    }
    await client.query('COMMIT');
    res.status(201).json(lesson);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding lesson:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update lesson (admin and teacher only)
app.put('/api/admin/lessons/:id', checkRoleAccess(['admin', 'teacher']), async (req, res) => {
  const pool = req.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const {
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      classroom_id,
      start_time,
      end_time,
      group_id,
      instructor_id,
      student_id
    } = req.body;
    const updateQuery = `
      UPDATE lessons
      SET lesson_type_id = $1,
          lesson_status_id = $2,
          lesson_topic_id = $3,
          start_time = $4,
          end_time = $5
      WHERE lesson_id = $6
      RETURNING *`;
    const { rows: [updatedLesson] } = await client.query(updateQuery, [
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      start_time,
      end_time,
      id
    ]);
    if (!updatedLesson) {
      throw new Error(`Lesson with ID ${id} not found`);
    }
    const lessonTypeQuery = 'SELECT lesson_type FROM lesson_types WHERE lesson_type_id = $1';
    const { rows: [lessonTypeResult] } = await client.query(lessonTypeQuery, [lesson_type_id]);
    if (!lessonTypeResult) {
      throw new Error(`Lesson type with ID ${lesson_type_id} not found`);
    }
    const lesson_type = lessonTypeResult.lesson_type.toLowerCase();
    await client.query('DELETE FROM group_lessons WHERE lesson_id = $1', [id]);
    await client.query('DELETE FROM individual_lessons WHERE lesson_id = $1', [id]);
    if (lesson_type.includes('theory')) {
      if (!group_id) {
        throw new Error('group_id is required for theory/group lessons');
      }
      await client.query(
        'INSERT INTO group_lessons (lesson_id, group_id, classroom_id) VALUES ($1, $2, $3)',
        [id, group_id, classroom_id]
      );
    } else if (lesson_type.includes('practical')) {
      if (!instructor_id || !student_id) {
        throw new Error('instructor_id and student_id are required for practice/individual lessons');
      }
      await client.query(
        'INSERT INTO individual_lessons (lesson_id, instructor_id, student_id) VALUES ($1, $2, $3)',
        [id, instructor_id, student_id]
      );
    } else {
      console.warn(`Unknown lesson type: "${lesson_type}". Available types should include 'theory', 'practice', 'group', or 'individual'`);
      throw new Error(`Unknown lesson type: ${lesson_type}`);
    }
    await client.query('COMMIT');
    res.json(updatedLesson);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating lesson:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete lesson (admin only)
app.delete('/api/admin/lessons/:id', checkRoleAccess(['admin']), async (req, res) => {
  const pool = req.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    await client.query('DELETE FROM group_lessons WHERE lesson_id = $1', [id]);
    await client.query('DELETE FROM individual_lessons WHERE lesson_id = $1', [id]);
    await client.query('DELETE FROM lessons WHERE lesson_id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update lesson status (instructors can update only status for their lessons)
app.patch('/api/admin/lessons/:id/status', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  const pool = req.pool;
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { lesson_status_id } = req.body;
    const userRole = req.userRole;
    let updateQuery = `
      UPDATE lessons
      SET lesson_status_id = $1
      WHERE lesson_id = $2`;
    let queryParams = [lesson_status_id, id];
    if (userRole === 'instructor') {
      updateQuery += ` AND lesson_id IN (
        SELECT il.lesson_id 
        FROM individual_lessons il 
        JOIN instructors i ON il.instructor_id = i.instructor_id 
        JOIN system_users su ON i.login = su.login 
        WHERE su.login = $3
      )`;
      queryParams.push(req.headers['user-login'] || '');
    }
    updateQuery += ' RETURNING *';
    const { rows } = await client.query(updateQuery, queryParams);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found or access denied' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin/instructors', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const query = `
      SELECT 
        i.instructor_id,
        i.person_id,
        i.login,
        CONCAT(p.last_name, ' ', p.first_name) as instructor_name,
        p.first_name,
        p.last_name,
        p.phone,
        p.email
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      ORDER BY p.last_name, p.first_name`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/students', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const pool = req.pool;
    const query = `
      SELECT 
        s.student_id,
        s.person_id,
        s.application_id,
        s.exam_result_id,
        CONCAT(p.last_name, ' ', p.first_name) as student_name,
        p.first_name,
        p.last_name,
        p.phone,
        p.email
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      ORDER BY p.last_name, p.first_name`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> ExamsComponent (Updated with exam locations support)
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get all exams with location info
app.get('/api/admin/exams', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const query = `
      SELECT 
        e.exam_id,
        e.start_time,
        e.end_time,
        e.type,
        e.instructor_id,
        e.teacher_id,
        e.exam_location_id,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN CONCAT(pi.first_name, ' ', pi.last_name)
          WHEN e.teacher_id IS NOT NULL THEN CONCAT(pt.first_name, ' ', pt.last_name)
        END as examiner_name,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN 'instructor'
          WHEN e.teacher_id IS NOT NULL THEN 'teacher'
        END as examiner_role,
        -- Location info
        el.classroom_id,
        el.car_id,
        cr.name as classroom_name,
        CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')') as car_info
      FROM exams e
      LEFT JOIN instructors i ON e.instructor_id = i.instructor_id
      LEFT JOIN persons pi ON i.person_id = pi.person_id
      LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
      LEFT JOIN persons pt ON t.person_id = pt.person_id
      LEFT JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      LEFT JOIN classrooms cr ON el.classroom_id = cr.classroom_id
      LEFT JOIN cars c ON el.car_id = c.car_id
      LEFT JOIN car_models cm ON c.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      ORDER BY e.start_time DESC
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available examiners based on exam type
app.get('/api/admin/examiners', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const { type } = req.query;
    let query = '';
    if (type === 'theory') {
      query = `
        SELECT 
          t.teacher_id AS examiner_id,
          'teacher' AS role_type,
          CONCAT(p.first_name, ' ', p.last_name) AS examiner_name
        FROM teachers t
        JOIN persons p ON t.person_id = p.person_id
        ORDER BY examiner_name
      `;
    } else if (type === 'practice') {
      query = `
        SELECT 
          i.instructor_id AS examiner_id,
          'instructor' AS role_type,
          CONCAT(p.first_name, ' ', p.last_name) AS examiner_name
        FROM instructors i
        JOIN persons p ON i.person_id = p.person_id
        ORDER BY examiner_name
      `;
    } else {
      return res.status(400).json({ error: 'Invalid exam type. Must be "theory" or "practice".' });
    }
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching examiners:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available locations based on exam type
app.get('/api/admin/exam-locations', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const { type } = req.query;
    let query = '';
    if (type === 'theory') {
      query = `
        SELECT 
          classroom_id as location_id,
          name as location_name,
          'classroom' as location_type
        FROM classrooms
        WHERE is_available = true
        ORDER BY name
      `;
    } else if (type === 'practice') {
      query = `
        SELECT 
          c.car_id as location_id,
          CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')') as location_name,
          'car' as location_type,
          cc.car_condition as condition
        FROM cars c
        JOIN car_models cm ON c.car_model_id = cm.car_model_id
        JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
        JOIN car_conditions cc ON c.car_condition_id = cc.car_condition_id
        ORDER BY cb.car_brand_name, cm.car_model_name
      `;
    } else {
      return res.status(400).json({ error: 'Invalid exam type. Must be "theory" or "practice".' });
    }
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exam locations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new exam with location
app.post('/api/admin/exams', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { start_time, end_time, type, examiner_id, location_id } = req.body;
    if (!start_time || !end_time || !type || !examiner_id || !location_id) {
      return res.status(400).json({ error: 'Start time, end time, type, examiner_id, and location_id are required' });
    }
    const normalizedType = type.toLowerCase();
    if (!['theory', 'practice'].includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid exam type. Must be theory or practice' });
    }
    const dbType = normalizedType === 'theory' ? 'Theory' : 'Practice';
    let instructorId = null;
    let teacherId = null;
    let examinerTable = '';
    let examinerColumn = '';
    if (normalizedType === 'practice') {
      instructorId = examiner_id;
      examinerTable = 'instructors';
      examinerColumn = 'instructor_id';
    } else {
      teacherId = examiner_id;
      examinerTable = 'teachers';
      examinerColumn = 'teacher_id';
    }
    const examinerQuery = `SELECT ${examinerColumn} FROM ${examinerTable} WHERE ${examinerColumn} = $1`;
    const examinerResult = await client.query(examinerQuery, [examiner_id]);
    if (examinerResult.rows.length === 0) {
      return res.status(400).json({ error: `Invalid ${normalizedType === 'practice' ? 'instructor' : 'teacher'} ID` });
    }
    let locationQuery = '';
    let locationColumn = '';
    if (normalizedType === 'theory') {
      locationQuery = 'SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND is_available = true';
      locationColumn = 'classroom_id';
    } else {
      locationQuery = 'SELECT car_id FROM cars WHERE car_id = $1';
      locationColumn = 'car_id';
    }
    const locationResult = await client.query(locationQuery, [location_id]);
    if (locationResult.rows.length === 0) {
      return res.status(400).json({ error: `Invalid ${normalizedType === 'practice' ? 'car' : 'classroom'} ID` });
    }
    let examLocationId;
    if (normalizedType === 'theory') {
      const existingLocationQuery = `
        SELECT exam_location_id FROM exam_locations 
        WHERE classroom_id = $1 AND car_id IS NULL
      `;
      const existingLocationResult = await client.query(existingLocationQuery, [location_id]);
      if (existingLocationResult.rows.length > 0) {
        examLocationId = existingLocationResult.rows[0].exam_location_id;
      } else {
        const createLocationQuery = `
          INSERT INTO exam_locations (exam_location_id, classroom_id, car_id)
          VALUES ((SELECT COALESCE(MAX(exam_location_id), 0) + 1 FROM exam_locations), $1, NULL)
          RETURNING exam_location_id
        `;
        const newLocationResult = await client.query(createLocationQuery, [location_id]);
        examLocationId = newLocationResult.rows[0].exam_location_id;
      }
    } else {
      const existingLocationQuery = `
        SELECT exam_location_id FROM exam_locations 
        WHERE car_id = $1 AND classroom_id IS NULL
      `;
      const existingLocationResult = await client.query(existingLocationQuery, [location_id]);
      if (existingLocationResult.rows.length > 0) {
        examLocationId = existingLocationResult.rows[0].exam_location_id;
      } else {
        const createLocationQuery = `
          INSERT INTO exam_locations (exam_location_id, classroom_id, car_id)
          VALUES ((SELECT COALESCE(MAX(exam_location_id), 0) + 1 FROM exam_locations), NULL, $1)
          RETURNING exam_location_id
        `;
        const newLocationResult = await client.query(createLocationQuery, [location_id]);
        examLocationId = newLocationResult.rows[0].exam_location_id;
      }
    }
    const conflictQuery = `
      SELECT exam_id FROM exams 
      WHERE (instructor_id = $1 OR teacher_id = $1)
      AND (
        ($2 BETWEEN start_time AND end_time) OR
        ($3 BETWEEN start_time AND end_time) OR
        (start_time BETWEEN $2 AND $3) OR
        (end_time BETWEEN $2 AND $3)
      )
    `;
    const conflictResult = await client.query(conflictQuery, [examiner_id, start_time, end_time]);
    if (conflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'Examiner has a conflicting exam at this time' });
    }
    const locationConflictQuery = `
      SELECT exam_id FROM exams 
      WHERE exam_location_id = $1
      AND (
        ($2 BETWEEN start_time AND end_time) OR
        ($3 BETWEEN start_time AND end_time) OR
        (start_time BETWEEN $2 AND $3) OR
        (end_time BETWEEN $2 AND $3)
      )
    `;
    const locationConflictResult = await client.query(locationConflictQuery, [examLocationId, start_time, end_time]);
    if (locationConflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'Location is already booked at this time' });
    }
    const insertQuery = `
      INSERT INTO exams (start_time, end_time, type, instructor_id, teacher_id, exam_location_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING exam_id, start_time, end_time, type, instructor_id, teacher_id, exam_location_id
    `;
    const result = await client.query(insertQuery, [start_time, end_time, dbType, instructorId, teacherId, examLocationId]);
    await client.query('COMMIT');
    const newExamQuery = `
      SELECT 
        e.exam_id,
        e.start_time,
        e.end_time,
        e.type,
        e.instructor_id,
        e.teacher_id,
        e.exam_location_id,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN CONCAT(pi.first_name, ' ', pi.last_name)
          WHEN e.teacher_id IS NOT NULL THEN CONCAT(pt.first_name, ' ', pt.last_name)
        END as examiner_name,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN 'instructor'
          WHEN e.teacher_id IS NOT NULL THEN 'teacher'
        END as examiner_role,
        el.classroom_id,
        el.car_id,
        cr.name as classroom_name,
        CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')') as car_info
      FROM exams e
      LEFT JOIN instructors i ON e.instructor_id = i.instructor_id
      LEFT JOIN persons pi ON i.person_id = pi.person_id
      LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
      LEFT JOIN persons pt ON t.person_id = pt.person_id
      LEFT JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      LEFT JOIN classrooms cr ON el.classroom_id = cr.classroom_id
      LEFT JOIN cars c ON el.car_id = c.car_id
      LEFT JOIN car_models cm ON c.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      WHERE e.exam_id = $1
    `;
    const newExamResult = await client.query(newExamQuery, [result.rows[0].exam_id]);
    res.status(201).json(newExamResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding exam:', err);
            // Загальна перевірка для всіх помилок з тригерів
  if (err.code === 'P0001') {
    return res.status(400).json({ error: err.message });
  }
    if (err.constraint) {
      if (err.constraint.includes('examiner_exclusive_check')) {
        return res.status(400).json({ error: 'Exam must have either instructor or teacher, not both' });
      }
      if (err.constraint.includes('type_examiner_match_check')) {
        return res.status(400).json({ error: 'Theory exams must have teacher, Practice exams must have instructor' });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update exam with location
app.put('/api/admin/exams/:exam_id', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { exam_id } = req.params;
    const { start_time, end_time, type, examiner_id, location_id } = req.body;
    const existsQuery = `SELECT exam_id FROM exams WHERE exam_id = $1`;
    const existsResult = await client.query(existsQuery, [exam_id]);
    if (existsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    if (!start_time || !end_time || !type || !examiner_id || !location_id) {
      return res.status(400).json({ error: 'Start time, end time, type, examiner_id, and location_id are required' });
    }
    const normalizedType = type.toLowerCase();
    if (!['theory', 'practice'].includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid exam type. Must be theory or practice' });
    }
    const dbType = normalizedType === 'theory' ? 'Theory' : 'Practice';
    let instructorId = null;
    let teacherId = null;
    let examinerTable = '';
    let examinerColumn = '';
    if (normalizedType === 'practice') {
      instructorId = examiner_id;
      examinerTable = 'instructors';
      examinerColumn = 'instructor_id';
    } else {
      teacherId = examiner_id;
      examinerTable = 'teachers';
      examinerColumn = 'teacher_id';
    }
    const examinerQuery = `SELECT ${examinerColumn} FROM ${examinerTable} WHERE ${examinerColumn} = $1`;
    const examinerResult = await client.query(examinerQuery, [examiner_id]);
    if (examinerResult.rows.length === 0) {
      return res.status(400).json({ error: `Invalid ${normalizedType === 'practice' ? 'instructor' : 'teacher'} ID` });
    }
    let locationQuery = '';
    if (normalizedType === 'theory') {
      locationQuery = 'SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND is_available = true';
    } else {
      locationQuery = 'SELECT car_id FROM cars WHERE car_id = $1';
    }
    const locationResult = await client.query(locationQuery, [location_id]);
    if (locationResult.rows.length === 0) {
      return res.status(400).json({ error: `Invalid ${normalizedType === 'practice' ? 'car' : 'classroom'} ID` });
    }
    let examLocationId;
    if (normalizedType === 'theory') {
      const existingLocationQuery = `
        SELECT exam_location_id FROM exam_locations 
        WHERE classroom_id = $1 AND car_id IS NULL
      `;
      const existingLocationResult = await client.query(existingLocationQuery, [location_id]);
      if (existingLocationResult.rows.length > 0) {
        examLocationId = existingLocationResult.rows[0].exam_location_id;
      } else {
        const createLocationQuery = `
          INSERT INTO exam_locations (exam_location_id, classroom_id, car_id)
          VALUES ((SELECT COALESCE(MAX(exam_location_id), 0) + 1 FROM exam_locations), $1, NULL)
          RETURNING exam_location_id
        `;
        const newLocationResult = await client.query(createLocationQuery, [location_id]);
        examLocationId = newLocationResult.rows[0].exam_location_id;
      }
    } else {
      const existingLocationQuery = `
        SELECT exam_location_id FROM exam_locations 
        WHERE car_id = $1 AND classroom_id IS NULL
      `;
      const existingLocationResult = await client.query(existingLocationQuery, [location_id]);
      if (existingLocationResult.rows.length > 0) {
        examLocationId = existingLocationResult.rows[0].exam_location_id;
      } else {
        const createLocationQuery = `
          INSERT INTO exam_locations (exam_location_id, classroom_id, car_id)
          VALUES ((SELECT COALESCE(MAX(exam_location_id), 0) + 1 FROM exam_locations), NULL, $1)
          RETURNING exam_location_id
        `;
        const newLocationResult = await client.query(createLocationQuery, [location_id]);
        examLocationId = newLocationResult.rows[0].exam_location_id;
      }
    }
    const conflictQuery = `
      SELECT exam_id FROM exams 
      WHERE (instructor_id = $1 OR teacher_id = $1)
      AND exam_id != $2
      AND (
        ($3 BETWEEN start_time AND end_time) OR
        ($4 BETWEEN start_time AND end_time) OR
        (start_time BETWEEN $3 AND $4) OR
        (end_time BETWEEN $3 AND $4)
      )
    `;
    const conflictResult = await client.query(conflictQuery, [examiner_id, exam_id, start_time, end_time]);
    if (conflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'Examiner has a conflicting exam at this time' });
    }
    const locationConflictQuery = `
      SELECT exam_id FROM exams 
      WHERE exam_location_id = $1
      AND exam_id != $2
      AND (
        ($3 BETWEEN start_time AND end_time) OR
        ($4 BETWEEN start_time AND end_time) OR
        (start_time BETWEEN $3 AND $4) OR
        (end_time BETWEEN $3 AND $4)
      )
    `;
    const locationConflictResult = await client.query(locationConflictQuery, [examLocationId, exam_id, start_time, end_time]);
    if (locationConflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'Location is already booked at this time' });
    }
    const updateQuery = `
      UPDATE exams 
      SET start_time = $1, end_time = $2, type = $3, instructor_id = $4, teacher_id = $5, exam_location_id = $6
      WHERE exam_id = $7
      RETURNING exam_id, start_time, end_time, type, instructor_id, teacher_id, exam_location_id
    `;
    await client.query(updateQuery, [start_time, end_time, dbType, instructorId, teacherId, examLocationId, exam_id]);
    await client.query('COMMIT');
    const updatedExamQuery = `
      SELECT 
        e.exam_id,
        e.start_time,
        e.end_time,
        e.type,
        e.instructor_id,
        e.teacher_id,
        e.exam_location_id,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN CONCAT(pi.first_name, ' ', pi.last_name)
          WHEN e.teacher_id IS NOT NULL THEN CONCAT(pt.first_name, ' ', pt.last_name)
        END as examiner_name,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN 'instructor'
          WHEN e.teacher_id IS NOT NULL THEN 'teacher'
        END as examiner_role,
        el.classroom_id,
        el.car_id,
        cr.name as classroom_name,
        CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')') as car_info
      FROM exams e
      LEFT JOIN instructors i ON e.instructor_id = i.instructor_id
      LEFT JOIN persons pi ON i.person_id = pi.person_id
      LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
      LEFT JOIN persons pt ON t.person_id = pt.person_id
      LEFT JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      LEFT JOIN classrooms cr ON el.classroom_id = cr.classroom_id
      LEFT JOIN cars c ON el.car_id = c.car_id
      LEFT JOIN car_models cm ON c.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      WHERE e.exam_id = $1
    `;
    const updatedExamResult = await client.query(updatedExamQuery, [exam_id]);
    res.json(updatedExamResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating exam:', err);
  if (err.code === 'P0001') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.constraint) {
    if (err.constraint.includes('examiner_exclusive_check')) {
      return res.status(400).json({ error: 'Exam must have either instructor or teacher, not both' });
    }
    if (err.constraint.includes('type_examiner_match_check')) {
      return res.status(400).json({ error: 'Theory exams must have teacher, Practice exams must have instructor' });
    }
  }
    if (err.constraint) {
      if (err.constraint.includes('examiner_exclusive_check')) {
        return res.status(400).json({ error: 'Exam must have either instructor or teacher, not both' });
      }
      if (err.constraint.includes('type_examiner_match_check')) {
        return res.status(400).json({ error: 'Theory exams must have teacher, Practice exams must have instructor' });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Delete exam
app.delete('/api/admin/exams/:exam_id', checkRoleAccess(['admin']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const { exam_id } = req.params;
    const existsQuery = `SELECT exam_id FROM exams WHERE exam_id = $1`;
    const existsResult = await client.query(existsQuery, [exam_id]);
    if (existsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    const associatedDataQuery = `
      SELECT 
        (SELECT COUNT(*) FROM students WHERE exam_result_id IS NOT NULL) as result_count
    `;
    const associatedResult = await client.query(associatedDataQuery);
    const deleteQuery = `DELETE FROM exams WHERE exam_id = $1`;
    await client.query(deleteQuery, [exam_id]);
    await client.query('COMMIT');
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting exam:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get exams for specific examiner (for teachers/instructors to see their own exams)
app.get('/api/examiner/exams', checkRoleAccess(['teacher', 'instructor']), async (req, res) => {
  try {
    const userRole = req.userRole;
    const login = req.headers['user-login'];
    if (!login) {
      return res.status(400).json({ error: 'User login is required' });
    }
    let query = '';
    if (userRole === 'teacher') {
      query = `
        SELECT 
          e.exam_id,
          e.start_time,
          e.end_time,
          e.type,
          e.instructor_id,
          e.teacher_id,
          CONCAT(p.first_name, ' ', p.last_name) as examiner_name,
          'teacher' as examiner_role
        FROM exams e
        JOIN teachers t ON e.teacher_id = t.teacher_id
        JOIN persons p ON t.person_id = p.person_id
        WHERE t.login = $1
        ORDER BY e.start_time DESC
      `;
    } else if (userRole === 'instructor') {
      query = `
        SELECT 
          e.exam_id,
          e.start_time,
          e.end_time,
          e.type,
          e.instructor_id,
          e.teacher_id,
          CONCAT(p.first_name, ' ', p.last_name) as examiner_name,
          'instructor' as examiner_role
        FROM exams e
        JOIN instructors i ON e.instructor_id = i.instructor_id
        JOIN persons p ON i.person_id = p.person_id
        WHERE i.login = $1
        ORDER BY e.start_time DESC
      `;
    } else {
      return res.status(400).json({ error: 'Invalid user role' });
    }
    const result = await req.pool.query(query, [login]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching examiner exams:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exam details by ID (useful for detailed view)
app.get('/api/admin/exams/:exam_id', checkRoleAccess(['admin', 'teacher', 'instructor']), async (req, res) => {
  try {
    const { exam_id } = req.params;
    const query = `
      SELECT 
        e.exam_id,
        e.start_time,
        e.end_time,
        e.type,
        e.instructor_id,
        e.teacher_id,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN CONCAT(pi.first_name, ' ', pi.last_name)
          WHEN e.teacher_id IS NOT NULL THEN CONCAT(pt.first_name, ' ', pt.last_name)
        END as examiner_name,
        CASE 
          WHEN e.instructor_id IS NOT NULL THEN 'instructor'
          WHEN e.teacher_id IS NOT NULL THEN 'teacher'
        END as examiner_role
      FROM exams e
      LEFT JOIN instructors i ON e.instructor_id = i.instructor_id
      LEFT JOIN persons pi ON i.person_id = pi.person_id
      LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
      LEFT JOIN persons pt ON t.person_id = pt.person_id
      WHERE e.exam_id = $1
    `;
    const result = await req.pool.query(query, [exam_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching exam details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> CarsComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/car-brands', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM car_brands ORDER BY car_brand_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching car brands:', err);
    res.status(500).json({ error: 'Failed to fetch car brands' });
  }
});

app.get('/api/admin/car-categories', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM car_categories ORDER BY car_category_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching car categories:', err);
    res.status(500).json({ error: 'Failed to fetch car categories' });
  }
});

app.get('/api/admin/car-conditions', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM car_conditions ORDER BY car_condition');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching car conditions:', err);
    res.status(500).json({ error: 'Failed to fetch car conditions' });
  }
});

app.get('/api/admin/car-models', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    let query = `
      SELECT cm.car_model_id, cm.car_brand_id, cm.car_category_id, cm.car_model_name, 
             cb.car_brand_name, cc.car_category_name
      FROM car_models cm
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_categories cc ON cm.car_category_id = cc.car_category_id
    `;
    const params = [];
    if (req.query.brand_id) {
      query += ' WHERE cm.car_brand_id = $1';
      params.push(req.query.brand_id);
    }
    query += ' ORDER BY cm.car_model_name';
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching car models:', err);
    res.status(500).json({ error: 'Failed to fetch car models' });
  }
});

app.get('/api/admin/cars', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    let query = `
      SELECT c.car_id, c.car_model_id, c.car_condition_id, c.year_of_manufacture, c.license_plate,
             cm.car_model_name, cb.car_brand_name, cb.car_brand_id, cc.car_category_name, cond.car_condition
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_categories cc ON cm.car_category_id = cc.car_category_id
      JOIN car_conditions cond ON c.car_condition_id = cond.car_condition_id
    `;
    if (req.userRole === 'instructor') {
      query += ` WHERE c.car_id IN (
        SELECT car_id FROM instructors 
        WHERE instructor_id IN (
          SELECT instructor_id FROM instructors i
          JOIN system_users su ON i.login = su.login
          WHERE su.login = $1
        )
      )`;
    }
    query += ' ORDER BY cb.car_brand_name, cm.car_model_name';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cars:', err);
    res.status(500).json({ error: 'Failed to fetch cars' });
  }
});

app.get('/api/admin/cars/:id', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    let query = `
      SELECT c.car_id, c.car_model_id, c.car_condition_id, c.year_of_manufacture, c.license_plate,
             cm.car_model_name, cb.car_brand_name, cb.car_brand_id, cc.car_category_name, cond.car_condition
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_categories cc ON cm.car_category_id = cc.car_category_id
      JOIN car_conditions cond ON c.car_condition_id = cond.car_condition_id
      WHERE c.car_id = $1
    `;
    const result = await req.pool.query(query, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }
    // // If instructor, check if this is their assigned car
    // if (req.userRole === 'instructor') {
    //   // Additional check would go here for instructor's assigned car
    //   // For now, allowing access to all cars for instructors
    // }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching car:', err);
    res.status(500).json({ error: 'Failed to fetch car' });
  }
});

app.post('/api/admin/cars', checkRoleAccess(['admin']), async (req, res) => {
  const { 
    car_brand_name, 
    car_model_name, 
    car_condition_id, 
    car_category_id, 
    year_of_manufacture, 
    license_plate 
  } = req.body;

  // Validate required fields
  if (!car_brand_name || !car_model_name || !car_condition_id || !car_category_id || !year_of_manufacture || !license_plate) {
    return res.status(400).json({ 
      error: 'All fields are required' 
    });
  }

  // Validate year
  const currentYear = new Date().getFullYear();
  if (year_of_manufacture < 1980 || year_of_manufacture > currentYear) {
    return res.status(400).json({ 
      error: `Year must be between 1980 and ${currentYear}` 
    });
  }

  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    const existingCarResult = await client.query(
      'SELECT car_id FROM cars WHERE license_plate = $1',
      [license_plate]
    );

    if (existingCarResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'License plate already exists' 
      });
    }

    // 1. Insert or get brand
    let brandId;
    const existingBrand = await client.query(
      'SELECT car_brand_id FROM car_brands WHERE LOWER(car_brand_name) = LOWER($1)',
      [car_brand_name]
    );

    if (existingBrand.rows.length > 0) {
      brandId = existingBrand.rows[0].car_brand_id;
    } else {
      const newBrand = await client.query(
        'INSERT INTO car_brands (car_brand_name) VALUES ($1) RETURNING car_brand_id',
        [car_brand_name]
      );
      brandId = newBrand.rows[0].car_brand_id;
    }

    // 2. Insert or get model
    let modelId;
    const existingModel = await client.query(
      'SELECT car_model_id FROM car_models WHERE LOWER(car_model_name) = LOWER($1)',
      [car_model_name]
    );

    if (existingModel.rows.length > 0) {
      modelId = existingModel.rows[0].car_model_id;
      await client.query(
        'UPDATE car_models SET car_brand_id = $1, car_category_id = $2 WHERE car_model_id = $3',
        [brandId, car_category_id, modelId]
      );
    } else {
      const newModel = await client.query(
        'INSERT INTO car_models (car_model_name, car_brand_id, car_category_id) VALUES ($1, $2, $3) RETURNING car_model_id',
        [car_model_name, brandId, car_category_id]
      );
      modelId = newModel.rows[0].car_model_id;
    }

    // 3. Insert the car
    const carResult = await client.query(
      `INSERT INTO cars (car_model_id, car_condition_id, year_of_manufacture, license_plate) 
       VALUES ($1, $2, $3, $4) RETURNING car_id`,
      [modelId, car_condition_id, year_of_manufacture, license_plate]
    );

    // 4. Get the complete car data with all related information
    const newCarResult = await client.query(`
      SELECT 
        c.car_id,
        c.year_of_manufacture,
        c.license_plate,
        cb.car_brand_name,
        cm.car_model_name,
        cat.car_category_name,
        cond.car_condition,
        c.car_condition_id
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_categories cat ON cm.car_category_id = cat.car_category_id
      JOIN car_conditions cond ON c.car_condition_id = cond.car_condition_id
      WHERE c.car_id = $1
    `, [carResult.rows[0].car_id]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Car added successfully',
      car: newCarResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding car:', error);
    
    if (error.code === '23505') {
      if (error.constraint === 'cars_license_plate_key') {
        return res.status(400).json({ error: 'License plate already exists' });
      }
      return res.status(400).json({ error: 'Duplicate entry' });
    }
    
    res.status(500).json({ 
      error: 'Internal server error while adding car' 
    });
  } finally {
    client.release();
  }
});

app.put('/api/admin/cars/:id', checkRoleAccess(['admin']), async (req, res) => {
  const carId = req.params.id;
  const { 
    car_brand_name, 
    car_model_name, 
    car_condition_id, 
    car_category_id, 
    year_of_manufacture, 
    license_plate 
  } = req.body;

  // Validate required fields
  if (!car_brand_name || !car_model_name || !car_condition_id || !car_category_id || !year_of_manufacture || !license_plate) {
    return res.status(400).json({ 
      error: 'All fields are required' 
    });
  }

  // Validate year
  const currentYear = new Date().getFullYear();
  if (year_of_manufacture < 1980 || year_of_manufacture > currentYear) {
    return res.status(400).json({ 
      error: `Year must be between 1980 and ${currentYear}` 
    });
  }

  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if car exists and get current model_id for cleanup
    const existingCar = await client.query(
      'SELECT car_id, car_model_id FROM cars WHERE car_id = $1',
      [carId]
    );

    if (existingCar.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Car not found' });
    }

    const oldModelId = existingCar.rows[0].car_model_id;

    // Check if license plate is taken by another car
    const licenseCheck = await client.query(
      'SELECT car_id FROM cars WHERE license_plate = $1 AND car_id != $2',
      [license_plate, carId]
    );

    if (licenseCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'License plate already exists for another car' 
      });
    }

    // Get old brand_id for potential cleanup
    const oldModelInfo = await client.query(
      'SELECT car_brand_id FROM car_models WHERE car_model_id = $1',
      [oldModelId]
    );
    const oldBrandId = oldModelInfo.rows[0]?.car_brand_id;

    // 1. Insert or get brand
    let brandId;
    const existingBrand = await client.query(
      'SELECT car_brand_id FROM car_brands WHERE LOWER(car_brand_name) = LOWER($1)',
      [car_brand_name]
    );

    if (existingBrand.rows.length > 0) {
      brandId = existingBrand.rows[0].car_brand_id;
    } else {
      const newBrand = await client.query(
        'INSERT INTO car_brands (car_brand_name) VALUES ($1) RETURNING car_brand_id',
        [car_brand_name]
      );
      brandId = newBrand.rows[0].car_brand_id;
    }

    // 2. Insert or get model
    let modelId;
    const existingModel = await client.query(
      'SELECT car_model_id FROM car_models WHERE LOWER(car_model_name) = LOWER($1)',
      [car_model_name]
    );

    if (existingModel.rows.length > 0) {
      modelId = existingModel.rows[0].car_model_id;
      
      // Update existing model to ensure it has correct brand and category
      await client.query(
        'UPDATE car_models SET car_brand_id = $1, car_category_id = $2 WHERE car_model_id = $3',
        [brandId, car_category_id, modelId]
      );
    } else {
      const newModel = await client.query(
        'INSERT INTO car_models (car_model_name, car_brand_id, car_category_id) VALUES ($1, $2, $3) RETURNING car_model_id',
        [car_model_name, brandId, car_category_id]
      );
      modelId = newModel.rows[0].car_model_id;
    }

    // 3. Update the car
    await client.query(
      `UPDATE cars 
       SET car_model_id = $1, car_condition_id = $2, year_of_manufacture = $3, license_plate = $4 
       WHERE car_id = $5`,
      [modelId, car_condition_id, year_of_manufacture, license_plate, carId]
    );

    // 4. Clean up unused old model (if different from new model)
    if (oldModelId !== modelId) {
      await cleanupUnusedModel(client, oldModelId);
    }

    // 5. Clean up unused old brand (if different from new brand and no longer used)
    if (oldBrandId && oldBrandId !== brandId) {
      await cleanupUnusedBrand(client, oldBrandId);
    }

    // 6. Get the updated car data with all related information
    const updatedCarResult = await client.query(`
      SELECT 
        c.car_id,
        c.year_of_manufacture,
        c.license_plate,
        cb.car_brand_name,
        cm.car_model_name,
        cat.car_category_name,
        cond.car_condition,
        c.car_condition_id
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_categories cat ON cm.car_category_id = cat.car_category_id
      JOIN car_conditions cond ON c.car_condition_id = cond.car_condition_id
      WHERE c.car_id = $1
    `, [carId]);

    await client.query('COMMIT');

    res.json({
      message: 'Car updated successfully',
      car: updatedCarResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating car:', error);
    
    if (error.code === '23505') {
      if (error.constraint === 'cars_license_plate_key') {
        return res.status(400).json({ error: 'License plate already exists' });
      }
      return res.status(400).json({ error: 'Duplicate entry' });
    }
    
    res.status(500).json({ 
      error: 'Internal server error while updating car' 
    });
  } finally {
    client.release();
  }
});

// Helper function to clean up unused models
async function cleanupUnusedModel(client, modelId) {
  // Check if model is still used by any cars
  const modelUsage = await client.query(
    'SELECT COUNT(*) as count FROM cars WHERE car_model_id = $1',
    [modelId]
  );

  if (parseInt(modelUsage.rows[0].count) === 0) {
    // Get brand_id before deleting the model
    const modelInfo = await client.query(
      'SELECT car_brand_id FROM car_models WHERE car_model_id = $1',
      [modelId]
    );
    
    const brandId = modelInfo.rows[0]?.car_brand_id;

    // Delete unused model
    await client.query(
      'DELETE FROM car_models WHERE car_model_id = $1',
      [modelId]
    );

    console.log(`Deleted unused model with ID: ${modelId}`);

    // Check if brand is now unused
    if (brandId) {
      await cleanupUnusedBrand(client, brandId);
    }
  }
}

// Helper function to clean up unused brands
async function cleanupUnusedBrand(client, brandId) {
  // Check if brand is still used by any models
  const brandUsage = await client.query(
    'SELECT COUNT(*) as count FROM car_models WHERE car_brand_id = $1',
    [brandId]
  );

  if (parseInt(brandUsage.rows[0].count) === 0) {
    // Delete unused brand
    await client.query(
      'DELETE FROM car_brands WHERE car_brand_id = $1',
      [brandId]
    );

    console.log(`Deleted unused brand with ID: ${brandId}`);
  }
}

app.delete('/api/admin/cars/:id', checkRoleAccess(['admin']), async (req, res) => {
  const car_id = req.params.id;
  try {
    const carCheck = await req.pool.query('SELECT * FROM cars WHERE car_id = $1', [car_id]);
    if (carCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }
    const instructorCheck = await req.pool.query('SELECT * FROM instructors WHERE car_id = $1', [car_id]);
    if (instructorCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete car that is assigned to instructors' });
    }
    await req.pool.query('DELETE FROM cars WHERE car_id = $1', [car_id]);
    res.status(200).json({ message: 'Car deleted successfully' });
  } catch (err) {
    console.error('Error deleting car:', err);
    res.status(500).json({ error: 'Failed to delete car' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> ClassroomsComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/admin/classrooms', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT classroom_id, name, is_available 
      FROM classrooms 
      ORDER BY classroom_id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch classrooms'
    });
  }
});

app.get('/api/admin/classrooms/:id', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Invalid classroom ID',
        message: 'Classroom ID must be a valid number'
      });
    }
    const result = await req.pool.query(`
      SELECT classroom_id, name, is_available 
      FROM classrooms 
      WHERE classroom_id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Classroom not found',
        message: `Classroom with ID ${id} does not exist`
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching classroom:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch classroom'
    });
  }
});

app.post('/api/admin/classrooms', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const { name, is_available = true } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Invalid name',
        message: 'Name is required and must be at least 2 characters long'
      });
    }
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ 
        error: 'Invalid availability',
        message: 'is_available must be a boolean value'
      });
    }
    const existingClassroom = await req.pool.query(
      'SELECT classroom_id FROM classrooms WHERE name = $1',
      [name.trim()]
    );
    if (existingClassroom.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Name already exists',
        message: 'A classroom with this name already exists'
      });
    }
    const result = await req.pool.query(`
      INSERT INTO classrooms (name, is_available)
      VALUES ($1, $2)
      RETURNING classroom_id, name, is_available
    `, [name.trim(), is_available]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating classroom:', error);
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Name already exists',
        message: 'A classroom with this name already exists'
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to create classroom'
    });
  }
});

app.put('/api/admin/classrooms/:id', checkRoleAccess(['admin', 'instructor']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_available } = req.body;
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Invalid classroom ID',
        message: 'Classroom ID must be a valid number'
      });
    }
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Invalid name',
        message: 'Name is required and must be at least 2 characters long'
      });
    }
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({ 
        error: 'Invalid availability',
        message: 'is_available must be a boolean value'
      });
    }
    const existingClassroom = await req.pool.query(
      'SELECT classroom_id FROM classrooms WHERE classroom_id = $1',
      [id]
    );
    if (existingClassroom.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Classroom not found',
        message: `Classroom with ID ${id} does not exist`
      });
    }
    const nameCheck = await req.pool.query(
      'SELECT classroom_id FROM classrooms WHERE name = $1 AND classroom_id != $2',
      [name.trim(), id]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Name already exists',
        message: 'A classroom with this name already exists'
      });
    }
    const result = await req.pool.query(`
      UPDATE classrooms 
      SET name = $1, is_available = $2
      WHERE classroom_id = $3
      RETURNING classroom_id, name, is_available
    `, [name.trim(), is_available, id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating classroom:', error);
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Name already exists',
        message: 'A classroom with this name already exists'
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update classroom'
    });
  }
});

app.delete('/api/admin/classrooms/:id', checkRoleAccess(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({ 
        error: 'Invalid classroom ID',
        message: 'Classroom ID must be a valid number'
      });
    }
    const existingClassroom = await req.pool.query(
      'SELECT classroom_id FROM classrooms WHERE classroom_id = $1',
      [id]
    );
    if (existingClassroom.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Classroom not found',
        message: `Classroom with ID ${id} does not exist`
      });
    }
    const lessonsCheck = await req.pool.query(
      'SELECT lesson_id FROM group_lessons WHERE classroom_id = $1 LIMIT 1',
      [id]
    );
    if (lessonsCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Classroom is in use',
        message: 'Cannot delete classroom that is referenced by lessons. Please reassign or delete the related lessons first.'
      });
    }
    const examLocationsCheck = await req.pool.query(
      'SELECT exam_location_id FROM exam_locations WHERE classroom_id = $1 LIMIT 1',
      [id]
    );
    if (examLocationsCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Classroom is in use',
        message: 'Cannot delete classroom that is referenced by exam locations. Please reassign or delete the related exam locations first.'
      });
    }
    await req.pool.query('DELETE FROM classrooms WHERE classroom_id = $1', [id]);
    res.status(200).json({ 
      message: 'Classroom deleted successfully',
      classroom_id: parseInt(id)
    });
  } catch (error) {
    console.error('Error deleting classroom:', error);
    if (error.code === '23503') {
      return res.status(409).json({ 
        error: 'Classroom is in use',
        message: 'Cannot delete classroom that is referenced by other records'
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to delete classroom'
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// InstructorPage -> MyCarComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get instructor's car information
app.get('/api/instructor/car/info', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const instructorRaw = req.headers['instructor-login'];
let instructorLogin;
try {
  const parsed = JSON.parse(instructorRaw);
  instructorLogin = parsed.username;
} catch (e) {
  instructorLogin = instructorRaw;
}
if (!instructorLogin) {
  return res.status(400).json({ 
    error: 'Instructor login (username) is missing' 
  });
}
    if (!instructorLogin) {
      return res.status(400).json({ 
        error: 'Instructor login is required in headers' 
      });
    }
    const query = `
      SELECT 
    c.car_id,
    c.license_plate,
    c.year_of_manufacture AS year,
    cb.car_brand_name AS make,
    cm.car_model_name AS model,
    cc.car_category_name AS category,
    cond.car_condition AS condition,
    dc.driving_category,
    i.experience_years AS instructor_experience
FROM cars c
    JOIN car_models cm ON c.car_model_id = cm.car_model_id
    JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
    JOIN car_categories cc ON cm.car_category_id = cc.car_category_id
    JOIN car_conditions cond ON c.car_condition_id = cond.car_condition_id
    JOIN instructors i ON c.car_id = i.car_id
    JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
WHERE i.login = $1;
    `;
    const result = await req.pool.query(query, [instructorLogin]);
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No car assigned to this instructor or instructor not found' 
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching car info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch car information',
      details: error.message 
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InstructorPage -> MyExamsComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get('/api/instructor/my-exams', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const instructorQuery = `
      SELECT i.instructor_id 
      FROM instructors i 
      WHERE i.login = $1
    `;
    const instructorResult = await req.pool.query(instructorQuery, [username]);
    if (instructorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }
    const instructorId = instructorResult.rows[0].instructor_id;
    const query = `
      SELECT 
        e.exam_id,
        e.type,
        e.start_time,
        e.end_time,
        e.instructor_id,
        e.teacher_id,
        -- Classroom information for theory exams
        CASE 
          WHEN e.type = 'Theory' THEN c.name
          ELSE NULL
        END as classroom_name,
        -- Car information for practice exams  
        CASE 
          WHEN e.type = 'Practice' THEN 
            CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', cars.license_plate, ')')
          ELSE NULL
        END as car_info,
        -- Location IDs
        CASE 
          WHEN e.type = 'Theory' THEN el.classroom_id
          ELSE NULL
        END as classroom_id,
        CASE 
          WHEN e.type = 'Practice' THEN el.car_id
          ELSE NULL
        END as car_id
      FROM exams e
      JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      -- Join for classroom (theory exams)
      LEFT JOIN classrooms c ON el.classroom_id = c.classroom_id
      -- Join for car information (practice exams)
      LEFT JOIN cars ON el.car_id = cars.car_id
      LEFT JOIN car_models cm ON cars.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      WHERE e.instructor_id = $1
      ORDER BY e.start_time DESC
    `;
    const result = await req.pool.query(query, [instructorId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor exams:', error);
    res.status(500).json({ error: 'Failed to fetch exams', details: error.message });
  }
});

// GET - Отримати статистику екзаменів для інструктора
app.get('/api/instructor/my-exams/stats', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const instructorQuery = `
      SELECT i.instructor_id 
      FROM instructors i 
      WHERE i.login = $1
    `;
    const instructorResult = await req.pool.query(instructorQuery, [username]);
    if (instructorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }
    const instructorId = instructorResult.rows[0].instructor_id;
    const statsQuery = `
      SELECT 
        COUNT(*) as total_exams,
        COUNT(CASE WHEN start_time > NOW() THEN 1 END) as upcoming_exams,
        COUNT(CASE WHEN start_time <= NOW() AND end_time >= NOW() THEN 1 END) as ongoing_exams,
        COUNT(CASE WHEN end_time < NOW() THEN 1 END) as completed_exams,
        COUNT(CASE WHEN type = 'Theory' THEN 1 END) as theory_exams,
        COUNT(CASE WHEN type = 'Practice' THEN 1 END) as practice_exams
      FROM exams 
      WHERE instructor_id = $1
    `;
    const statsResult = await req.pool.query(statsQuery, [instructorId]);
    res.json(statsResult.rows[0]);
  } catch (error) {
    console.error('Error fetching instructor exam stats:', error);
    res.status(500).json({ error: 'Failed to fetch exam statistics', details: error.message });
  }
});

// GET - Отримати екзамени інструктора за певний період
app.get('/api/instructor/my-exams/period', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const username = req.headers['username'];
    const { start_date, end_date, type } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const instructorQuery = `
      SELECT i.instructor_id 
      FROM instructors i 
      WHERE i.login = $1
    `;
    const instructorResult = await req.pool.query(instructorQuery, [username]);
    if (instructorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }
    const instructorId = instructorResult.rows[0].instructor_id;
    let query = `
      SELECT 
        e.exam_id,
        e.type,
        e.start_time,
        e.end_time,
        e.instructor_id,
        -- Classroom information for theory exams
        CASE 
          WHEN e.type = 'Theory' THEN c.name
          ELSE NULL
        END as classroom_name,
        -- Car information for practice exams  
        CASE 
          WHEN e.type = 'Practice' THEN 
            CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', cars.license_plate, ')')
          ELSE NULL
        END as car_info
      FROM exams e
      JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      -- Join for classroom (theory exams)
      LEFT JOIN classrooms c ON el.classroom_id = c.classroom_id
      -- Join for car information (practice exams)
      LEFT JOIN cars ON el.car_id = cars.car_id
      LEFT JOIN car_models cm ON cars.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      WHERE e.instructor_id = $1
    `;
    const queryParams = [instructorId];
    let paramIndex = 2;
    if (start_date) {
      query += ` AND DATE(e.start_time) >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      query += ` AND DATE(e.start_time) <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }
    if (type) {
      query += ` AND LOWER(e.type) = LOWER($${paramIndex})`;
      queryParams.push(type);
      paramIndex++;
    }
    query += ` ORDER BY e.start_time ASC`;
    const result = await req.pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor exams by period:', error);
    res.status(500).json({ error: 'Failed to fetch exams', details: error.message });
  }
});

// Route to get all cars with complete information
app.get('/api/cars', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const query = `
      SELECT 
        c.car_id,
        c.license_plate,
        c.year_of_manufacture,
        cb.car_brand_name as brand_name,
        cm.car_model_name as model_name,
        cc.car_condition,
        ccat.car_category_name as category_name,
        CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')') as car_info
      FROM cars c
      JOIN car_models cm ON c.car_model_id = cm.car_model_id
      JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      JOIN car_conditions cc ON c.car_condition_id = cc.car_condition_id
      JOIN car_categories ccat ON cm.car_category_id = ccat.car_category_id
      ORDER BY cb.car_brand_name, cm.car_model_name, c.license_plate
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cars',
      details: error.message 
    });
  }
});

// Route to get instructor's exams with complete car information
app.get('/api/instructor/my-exams', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const query = `
      SELECT 
        e.exam_id,
        e.type,
        e.start_time,
        e.end_time,
        e.instructor_id,
        el.car_id,
        el.classroom_id,
        -- Car information
        CASE 
          WHEN e.type = 'Practice' AND el.car_id IS NOT NULL THEN
            CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', c.license_plate, ')')
          ELSE NULL
        END as car_info,
        -- Classroom information  
        CASE 
          WHEN e.type = 'Theory' AND el.classroom_id IS NOT NULL THEN
            cl.name
          ELSE NULL
        END as classroom_name
      FROM exams e
      JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      JOIN instructors i ON e.instructor_id = i.instructor_id
      LEFT JOIN cars c ON el.car_id = c.car_id
      LEFT JOIN car_models cm ON c.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      LEFT JOIN classrooms cl ON el.classroom_id = cl.classroom_id
      WHERE i.login = $1
      ORDER BY e.start_time DESC
    `;
    const result = await req.pool.query(query, [username]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor exams:', error);
    res.status(500).json({ 
      error: 'Failed to fetch exams',
      details: error.message 
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// InstructorPage -> MyClassScheduleComponent (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get instructor profile by username
app.get('/api/instructor/profile/:username', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { username } = req.params;
    const query = `
      SELECT i.instructor_id, p.first_name, p.last_name, p.email, p.phone
      FROM instructors i
      JOIN persons p ON i.person_id = p.person_id
      WHERE i.login = $1
    `;
    const result = await req.pool.query(query, [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Instructor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching instructor profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all lessons for specific instructor
app.get('/api/instructor/lessons/:instructorId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { instructorId } = req.params;
    const query = `
      SELECT 
        l.lesson_id,
        l.start_time,
        l.end_time,
        l.lesson_type_id,
        l.lesson_status_id,
        l.lesson_topic_id,
        il.student_id,
        ls.lesson_status,
        p.first_name || ' ' || p.last_name as student_name
      FROM lessons l
      JOIN individual_lessons il ON l.lesson_id = il.lesson_id
      JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      JOIN students s ON il.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      WHERE il.instructor_id = $1
      ORDER BY l.start_time DESC
    `;
    const result = await req.pool.query(query, [instructorId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor lessons:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all lesson types
app.get('/api/instructor/lesson_types', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_types ORDER BY lesson_type';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson types:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all lesson statuses
app.get('/api/instructor/lesson_statuses', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_statuses ORDER BY lesson_status';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson statuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all lesson topics
app.get('/api/instructor/lesson_topics', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_topics ORDER BY lesson_topic';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson topics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all students
app.get('/api/instructor/students', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const query = `
      SELECT 
        s.student_id,
        p.first_name || ' ' || p.last_name as student_name,
        p.email,
        p.phone
      FROM students s
      JOIN persons p ON s.person_id = p.person_id
      ORDER BY p.first_name, p.last_name
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get students assigned to specific instructor
app.get('/api/instructor/:instructorId/students', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { instructorId } = req.params;
    const query = `
      SELECT 
        s.student_id,
        p.first_name || ' ' || p.last_name as student_name,
        p.email,
        p.phone
      FROM students_with_instructor swi
      JOIN students s ON swi.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      WHERE swi.instructor_id = $1
      ORDER BY p.first_name, p.last_name
    `;
    const result = await req.pool.query(query, [instructorId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new lesson
app.post('/api/instructor/lessons', checkRoleAccess(['instructor']), async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');
    const {
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      start_time,
      end_time,
      instructor_id,
      student_id
    } = req.body;
    const lessonQuery = `
      INSERT INTO lessons (lesson_type_id, lesson_status_id, lesson_topic_id, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING lesson_id
    `;
    const lessonResult = await client.query(lessonQuery, [
      lesson_type_id, lesson_status_id, lesson_topic_id, start_time, end_time
    ]);
    const lessonId = lessonResult.rows[0].lesson_id;
    const individualLessonQuery = `
      INSERT INTO individual_lessons (lesson_id, instructor_id, student_id)
      VALUES ($1, $2, $3)
    `;
    await client.query(individualLessonQuery, [lessonId, instructor_id, student_id]);
    await client.query('COMMIT');
    res.status(201).json({ lesson_id: lessonId, message: 'Lesson created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating lesson:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update lesson
app.put('/api/instructor/lessons/:lessonId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const {
      lesson_type_id,
      lesson_status_id,
      lesson_topic_id,
      start_time,
      end_time
    } = req.body;
    const query = `
      UPDATE lessons 
      SET lesson_type_id = $1, lesson_status_id = $2, lesson_topic_id = $3, 
          start_time = $4, end_time = $5
      WHERE lesson_id = $6
      RETURNING lesson_id
    `;
    const result = await req.pool.query(query, [
      lesson_type_id, lesson_status_id, lesson_topic_id, 
      start_time, end_time, lessonId
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json({ message: 'Lesson updated successfully' });
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete lesson
app.delete('/api/instructor/lessons/:lessonId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const query = 'DELETE FROM lessons WHERE lesson_id = $1 RETURNING lesson_id';
    const result = await req.pool.query(query, [lessonId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get lessons filtered by date range and status
app.get('/api/instructor/lessons/:instructorId/filter', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { startDate, endDate, status } = req.query;
    let query = `
      SELECT 
        l.lesson_id,
        l.start_time,
        l.end_time,
        l.lesson_type_id,
        l.lesson_status_id,
        l.lesson_topic_id,
        il.student_id,
        ls.lesson_status,
        p.first_name || ' ' || p.last_name as student_name
      FROM lessons l
      JOIN individual_lessons il ON l.lesson_id = il.lesson_id
      JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      JOIN students s ON il.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      WHERE il.instructor_id = $1
    `;
    const params = [instructorId];
    let paramCount = 1;
    if (startDate) {
      paramCount++;
      query += ` AND DATE(l.start_time) >= $${paramCount}`;
      params.push(startDate);
    }
    if (endDate) {
      paramCount++;
      query += ` AND DATE(l.start_time) <= $${paramCount}`;
      params.push(endDate);
    }
    if (status) {
      paramCount++;
      query += ` AND ls.lesson_status = $${paramCount}`;
      params.push(status);
    }
    query += ' ORDER BY l.start_time DESC';
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error filtering lessons:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get lesson details by ID
app.get('/api/instructor/lessons/detail/:lessonId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const query = `
      SELECT 
        l.lesson_id,
        l.start_time,
        l.end_time,
        l.lesson_type_id,
        l.lesson_status_id,
        l.lesson_topic_id,
        lt.lesson_type,
        ls.lesson_status,
        lto.lesson_topic,
        il.student_id,
        il.instructor_id,
        p.first_name || ' ' || p.last_name as student_name,
        p.email as student_email,
        p.phone as student_phone
      FROM lessons l
      JOIN individual_lessons il ON l.lesson_id = il.lesson_id
      JOIN lesson_types lt ON l.lesson_type_id = lt.lesson_type_id
      JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      JOIN lesson_topics lto ON l.lesson_topic_id = lto.lesson_topic_id
      JOIN students s ON il.student_id = s.student_id
      JOIN persons p ON s.person_id = p.person_id
      WHERE l.lesson_id = $1
    `;
    const result = await req.pool.query(query, [lessonId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lesson details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update lesson status
app.patch('/api/instructor/lessons/:lessonId/status', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { lesson_status_id } = req.body;
    const query = `
      UPDATE lessons 
      SET lesson_status_id = $1
      WHERE lesson_id = $2
      RETURNING lesson_id
    `;
    const result = await req.pool.query(query, [lesson_status_id, lessonId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json({ message: 'Lesson status updated successfully' });
  } catch (error) {
    console.error('Error updating lesson status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get instructor statistics
app.get('/api/instructor/:instructorId/statistics', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { month, year } = req.query;
    let query = `
      SELECT 
        COUNT(*) as total_lessons,
        COUNT(CASE WHEN ls.lesson_status = 'conducted' THEN 1 END) as conducted_lessons,
        COUNT(CASE WHEN ls.lesson_status = 'not_conducted' THEN 1 END) as not_conducted_lessons,
        COUNT(DISTINCT il.student_id) as unique_students
      FROM lessons l
      JOIN individual_lessons il ON l.lesson_id = il.lesson_id
      JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      WHERE il.instructor_id = $1
    `;
    const params = [instructorId];
    let paramCount = 1;
    if (month && year) {
      paramCount++;
      query += ` AND EXTRACT(MONTH FROM l.start_time) = $${paramCount}`;
      params.push(month);
      paramCount++;
      query += ` AND EXTRACT(YEAR FROM l.start_time) = $${paramCount}`;
      params.push(year);
    }
    const result = await req.pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching instructor statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Weather API Route (with Role-Based Access)
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get weather forecast for a specific date
app.get('/api/weather/:date', checkRoleAccess(['instructor', 'admin', 'teacher']), async (req, res) => {
  try {
    const { date } = req.params;
    const { hour } = req.query;
    const city = process.env.WEATHER_CITY;
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Weather API key not configured' });
    }
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    const today = new Date();
    const daysDiff = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) {
      return res.status(400).json({ error: 'Weather data is only available for future dates' });
    }
    if (daysDiff > 14) {
      return res.status(400).json({ error: 'Weather data is only available for the next 14 days' });
    }
    const days = Math.max(1, Math.min(14, daysDiff + 1));
    const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=${days}&aqi=yes&alerts=no`;
    const fetch = require('node-fetch');
    const response = await fetch(weatherUrl);
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Weather API error: ${response.status}` 
      });
    }
    const weatherData = await response.json();
    res.json({
      data: weatherData,
      selectedDate: date,
      selectedHour: hour || '',
      city: city
    });
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      message: error.message 
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// InstructorPage -> MyStudentsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get all students assigned to the instructor
app.get('/api/instructor/my-students', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const query = `
      SELECT DISTINCT
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        er.exam_score,
        sc.study_category
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      INNER JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      WHERE i.login = $1
      ORDER BY p.last_name, p.first_name
    `;
    const result = await req.pool.query(query, [username]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Update exam score for a student
app.put('/api/instructor/update-exam-score/:studentId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { exam_score } = req.body;
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (exam_score !== null && exam_score !== undefined) {
      const score = parseFloat(exam_score);
      if (isNaN(score) || score < 0 || score > 100) {
        return res.status(400).json({ error: 'Exam score must be a number between 0 and 100' });
      }
    }
    const accessCheckQuery = `
      SELECT s.student_id 
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const accessCheck = await req.pool.query(accessCheckQuery, [studentId, username]);
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to update this student\'s score' });
    }
    const client = await req.pool.connect();
    try {
      await client.query('BEGIN');
      const studentQuery = `
        SELECT s.student_id, s.exam_result_id
        FROM students s
        WHERE s.student_id = $1
      `;
      const studentResult = await client.query(studentQuery, [studentId]);
      if (studentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }
      const student = studentResult.rows[0];
      let examResultId = student.exam_result_id;
      if (examResultId) {
        const updateExamResultQuery = `
          UPDATE exam_results 
          SET exam_score = $1
          WHERE exam_result_id = $2
        `;
        await client.query(updateExamResultQuery, [exam_score, examResultId]);
      } else {
        const createExamResultQuery = `
          INSERT INTO exam_results (exam_score)
          VALUES ($1)
          RETURNING exam_result_id
        `;
        const newExamResult = await client.query(createExamResultQuery, [exam_score]);
        examResultId = newExamResult.rows[0].exam_result_id;
        const updateStudentQuery = `
          UPDATE students 
          SET exam_result_id = $1
          WHERE student_id = $2
        `;
        await client.query(updateStudentQuery, [examResultId, studentId]);
      }
      await client.query('COMMIT');
      res.json({ 
        success: true, 
        message: 'Exam score updated successfully',
        exam_score: exam_score 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating exam score:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Failed to update exam score',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all study categories
app.get('/api/study-categories', checkRoleAccess(['instructor', 'admin', 'teacher']), async (req, res) => {
  try {
    const query = `
      SELECT * FROM study_categories 
      WHERE LOWER(study_category) != 'theory' 
      ORDER BY study_category
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching study categories:', error);
    res.status(500).json({ error: 'Failed to fetch study categories' });
  }
});

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;

// Generate PDF report for a student
app.get('/api/instructor/generate-student-pdf/:studentId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const accessCheckQuery = `
      SELECT s.student_id 
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const accessCheck = await req.pool.query(accessCheckQuery, [studentId, username]);
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to access this student' });
    }
    const studentQuery = `
      SELECT DISTINCT
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        er.exam_score,
        sc.study_category,
        app.submission_date as application_date,
        app.approval_date,
        app_status.application_status,
        i.person_id as instructor_person_id,
        inst_p.first_name as instructor_first_name,
        inst_p.last_name as instructor_last_name,
        dc.driving_category,
        cb.car_brand_name,
        cm.car_model_name,
        cars.year_of_manufacture,
        cars.license_plate,
        cc.car_condition,
        i.experience_years
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      INNER JOIN persons p ON s.person_id = p.person_id
      INNER JOIN persons inst_p ON i.person_id = inst_p.person_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      LEFT JOIN cars ON i.car_id = cars.car_id
      LEFT JOIN car_models cm ON cars.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      LEFT JOIN car_conditions cc ON cars.car_condition_id = cc.car_condition_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentResult.rows[0];
    const doc = new PDFDocument({ 
      margin: 30,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Student Report - ${student.first_name} ${student.last_name}`,
        Author: 'Driving School Management System',
        Subject: `Student Report ID: ${student.student_id}`,
        Keywords: 'student, report, driving school'
      }
    });
    try {
      const fontsPath = path.join(__dirname, 'fonts');
      const regularFontPath = path.join(fontsPath, 'DejaVuSans.ttf');
      const boldFontPath = path.join(fontsPath, 'DejaVuSans-Bold.ttf');
      if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
        doc.registerFont('DejaVuSans', regularFontPath);
        doc.registerFont('DejaVuSans-Bold', boldFontPath);
        doc.font('DejaVuSans');
      } else {
        doc.font('Helvetica');
      }
    } catch (fontError) {
      console.warn('Font registration failed, using system fonts:', fontError.message);
      doc.font('Helvetica');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.pdf"`);
    doc.pipe(res);
    const formatDate = (dateStr) => {
      if (!dateStr) return 'Not specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) {
        return { text: 'NOT TAKEN', passed: false, color: '#666666' };
      }
      const numScore = parseFloat(score);
      return {
        text: numScore >= 50 ? 'PASSED' : 'FAILED',
        passed: numScore >= 50,
        color: numScore >= 50 ? '#28a745' : '#dc3545'
      };
    };
    const safeText = (text, options = {}) => {
      if (!text) return doc.text('N/A', options);
      return doc.text(String(text), options);
    };
    doc.fontSize(22);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#2c3e50');
    safeText('STUDENT REPORT', { align: 'center' });
    doc.fontSize(11);
    try {
      doc.font('DejaVuSans');
    } catch (e) {
      doc.font('Helvetica');
    }
    doc.fillColor('#7f8c8d');
    safeText(`Generated: ${formatDate(new Date())} | Student ID: ${student.student_id}`, { align: 'center' });
    doc.moveTo(30, doc.y + 10)
       .lineTo(565, doc.y + 10)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();
    doc.moveDown(1);
    const leftX = 30;
    let currentY = doc.y;
    currentY += 16;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('PERSONAL DATA', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    const studentInfo = [
      ['First Name:', student.first_name || 'Not specified'],
      ['Last Name:', student.last_name || 'Not specified'],
      ['TIN:', student.TIN || 'Not specified'],
      ['Email:', student.email || 'Not specified'],
      ['Phone:', student.phone || 'Not specified'],
      ['Birth Date:', formatDate(student.birth_date)]
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    studentInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('STUDY INFORMATION', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    const studyInfo = [
      ['Category:', student.study_category || 'Not specified'],
      ['Applied:', formatDate(student.application_date)],
      ['Approved:', formatDate(student.approval_date)],
      ['Status:', student.application_status || 'Not specified'],
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    studyInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('INSTRUCTOR INFO', leftX, currentY, { align: 'center', width: 535 });
    const instructorName = `${student.instructor_first_name || ''} ${student.instructor_last_name || ''}`.trim() || 'Not assigned';
    const carInfo = student.car_brand_name && student.car_model_name 
      ? `${student.car_brand_name} ${student.car_model_name}`
      : 'Not assigned';
    currentY += 12;
    const instructorInfo = [
      ['Instructor:', instructorName],
      ['Experience:', student.experience_years ? `${student.experience_years} years` : 'N/A'],
      ['Vehicle:', carInfo],
      ['Year:', student.year_of_manufacture ? String(student.year_of_manufacture) : 'N/A'],
      ['License Plate:', student.license_plate || 'N/A']
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    instructorInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('EXAM', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    currentY += 19;
    const examBoxWidth = 535;
    const examBoxX = leftX;
    doc.fillColor('#ecf0f1')
       .rect(examBoxX, currentY - 5, examBoxWidth, 80)
       .fill();
    const examResult = getExamResult(student.exam_score);
    let examYPos = currentY + 15;
    doc.fontSize(12).fillColor('#2c3e50');
    if (student.exam_score !== null && student.exam_score !== undefined) {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text('Score:', examBoxX + 20, examYPos, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${student.exam_score}/100`);
      doc.fontSize(12);
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.fillColor('#2c3e50');
      doc.text('Result:', examBoxX + 170, examYPos, { continued: true });
      doc.fillColor(examResult.color);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${examResult.text}`);
      const progressWidth = 200;
      const scorePercentage = student.exam_score / 100;
      const progressFillWidth = progressWidth * scorePercentage;
      examYPos += 25;
      doc.fillColor('#bdc3c7')
         .rect(examBoxX + 20, examYPos, progressWidth, 12)
         .fill();
      doc.fillColor(examResult.color)
         .rect(examBoxX + 20, examYPos, progressFillWidth, 12)
         .fill();
      doc.fontSize(9);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fillColor('#2c3e50');
      doc.text(`${student.exam_score}%`, examBoxX + 20 + progressWidth + 10, examYPos + 2);
    } else {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text('Exam Status:', examBoxX + 20, examYPos, { continued: true });
      doc.fillColor(examResult.color);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${examResult.text}`);
    }
    const footerY = 750;
    doc.fontSize(9);
    try {
      doc.font('DejaVuSans');
    } catch (e) {
      doc.font('Helvetica');
    }
    doc.fillColor('#95a5a6');
    doc.moveTo(30, footerY - 15)
       .lineTo(565, footerY - 15)
       .strokeColor('#bdc3c7')
       .lineWidth(1)
       .stroke();
    doc.text('Document generated automatically by Driving School Management System', 30, footerY, { 
      align: 'center', 
      width: 535 
    });
    doc.text(`Generated: ${new Date().toLocaleString('en-US')} | Confidential Document`, 30, footerY + 12, { 
      align: 'center', 
      width: 535 
    });
    doc.end();
    console.log(`PDF generated successfully for student ${studentId} by instructor ${username}`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
});

// Generate CSV report for a student
app.get('/api/instructor/generate-student-csv/:studentId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const accessCheckQuery = `
      SELECT s.student_id 
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const accessCheck = await req.pool.query(accessCheckQuery, [studentId, username]);
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to access this student' });
    }
    const studentQuery = `
      SELECT DISTINCT
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        er.exam_score,
        sc.study_category,
        app.submission_date as application_date,
        app.approval_date,
        app_status.application_status,
        i.person_id as instructor_person_id,
        inst_p.first_name as instructor_first_name,
        inst_p.last_name as instructor_last_name,
        dc.driving_category,
        cb.car_brand_name,
        cm.car_model_name,
        cars.year_of_manufacture,
        cars.license_plate,
        cc.car_condition,
        i.experience_years
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      INNER JOIN persons p ON s.person_id = p.person_id
      INNER JOIN persons inst_p ON i.person_id = inst_p.person_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      LEFT JOIN cars ON i.car_id = cars.car_id
      LEFT JOIN car_models cm ON cars.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      LEFT JOIN car_conditions cc ON cars.car_condition_id = cc.car_condition_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentResult.rows[0];
    const formatDate = (dateStr) => {
      if (!dateStr) return 'Not specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US');
      } catch (error) {
        return 'Invalid date';
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) return 'NOT TAKEN';
      const numScore = parseFloat(score);
      return numScore >= 50 ? 'PASSED' : 'FAILED';
    };
    const csvData = [
      ['Field', 'Value'],
      ['Student ID', student.student_id || ''],
      ['First Name', student.first_name || ''],
      ['Last Name', student.last_name || ''],
      ['TIN', student.TIN || ''],
      ['Email', student.email || ''],
      ['Phone', student.phone || ''],
      ['Birth Date', formatDate(student.birth_date)],
      ['Study Category', student.study_category || ''],
      ['Application Date', formatDate(student.application_date)],
      ['Approval Date', formatDate(student.approval_date)],
      ['Application Status', student.application_status || ''],
      ['Instructor Name', `${student.instructor_first_name || ''} ${student.instructor_last_name || ''}`.trim()],
      ['Instructor Experience', student.experience_years ? `${student.experience_years} years` : ''],
      ['Vehicle', student.car_brand_name && student.car_model_name ? `${student.car_brand_name} ${student.car_model_name}` : ''],
      ['Vehicle Year', student.year_of_manufacture || ''],
      ['License Plate', student.license_plate || ''],
      ['Exam Score', student.exam_score !== null ? `${student.exam_score}/100` : ''],
      ['Exam Result', getExamResult(student.exam_score)],
      ['Report Generated', new Date().toLocaleString('en-US')]
    ];
    const csvString = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.csv"`);
    res.send(csvString);
    console.log(`CSV generated successfully for student ${studentId} by instructor ${username}`);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ 
      error: 'Failed to generate CSV',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Generate JSON report for a student
app.get('/api/instructor/generate-student-json/:studentId', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const accessCheckQuery = `
      SELECT s.student_id 
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const accessCheck = await req.pool.query(accessCheckQuery, [studentId, username]);
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to access this student' });
    }
    const studentQuery = `
      SELECT DISTINCT
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        er.exam_score,
        sc.study_category,
        app.submission_date as application_date,
        app.approval_date,
        app_status.application_status,
        i.person_id as instructor_person_id,
        inst_p.first_name as instructor_first_name,
        inst_p.last_name as instructor_last_name,
        dc.driving_category,
        cb.car_brand_name,
        cm.car_model_name,
        cars.year_of_manufacture,
        cars.license_plate,
        cc.car_condition,
        i.experience_years
      FROM students s
      INNER JOIN students_with_instructor swi ON s.student_id = swi.student_id
      INNER JOIN instructors i ON swi.instructor_id = i.instructor_id
      INNER JOIN persons p ON s.person_id = p.person_id
      INNER JOIN persons inst_p ON i.person_id = inst_p.person_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN driving_categories dc ON i.driving_category_id = dc.driving_category_id
      LEFT JOIN cars ON i.car_id = cars.car_id
      LEFT JOIN car_models cm ON cars.car_model_id = cm.car_model_id
      LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
      LEFT JOIN car_conditions cc ON cars.car_condition_id = cc.car_condition_id
      WHERE s.student_id = $1 AND i.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentResult.rows[0];
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US');
      } catch (error) {
        return null;
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) {
        return { status: 'NOT_TAKEN', passed: false };
      }
      const numScore = parseFloat(score);
      return { 
        status: numScore >= 50 ? 'PASSED' : 'FAILED', 
        passed: numScore >= 50 
      };
    };
    const jsonData = {
      report_info: {
        generated_at: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        generated_by: username,
        report_type: 'student_report'
      },
      student_info: {
        id: student.student_id,
        personal_data: {
          first_name: student.first_name,
          last_name: student.last_name,
          tin: student.TIN,
          email: student.email,
          phone: student.phone,
          birth_date: formatDate(student.birth_date)
        },
        study_information: {
          category: student.study_category,
          application_date: formatDate(student.application_date),
          approval_date: formatDate(student.approval_date),
          status: student.application_status
        },
        instructor: {
          name: `${student.instructor_first_name || ''} ${student.instructor_last_name || ''}`.trim() || null,
          experience_years: student.experience_years,
          vehicle: {
            brand: student.car_brand_name,
            model: student.car_model_name,
            year: student.year_of_manufacture,
            license_plate: student.license_plate,
            condition: student.car_condition
          }
        },
        exam: {
          score: student.exam_score,
          max_score: 100,
          result: getExamResult(student.exam_score),
          percentage: student.exam_score !== null ? Math.round((student.exam_score / 100) * 100) : null
        }
      }
    };
    const prettyJsonString = JSON.stringify(jsonData, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.json"`);
    res.send(prettyJsonString);
    console.log(`JSON generated successfully for student ${studentId} by instructor ${username}`);
  } catch (error) {
    console.error('Error generating JSON:', error);
    res.status(500).json({ 
      error: 'Failed to generate JSON',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Email notification for upcoming lessons and exams
///////////////////////////////////////////////////////////////////////////////////////////////////

const nodemailer = require('nodemailer');
const cron = require('node-cron');

const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

emailTransporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

async function getUpcomingLessons(studentId) {
    const query = `
        SELECT 
            l.lesson_id,
            l.start_time,
            l.end_time,
            lt.lesson_type,
            lto.lesson_topic,
            ls.lesson_status,
            CASE 
                WHEN gl.lesson_id IS NOT NULL THEN 'group'
                WHEN il.lesson_id IS NOT NULL THEN 'individual'
            END as lesson_format,
            CASE 
                WHEN gl.lesson_id IS NOT NULL THEN g.name
                ELSE CONCAT(p_inst.first_name, ' ', p_inst.last_name)
            END as instructor_or_group,
            CASE 
                WHEN gl.lesson_id IS NOT NULL THEN c.name
                ELSE CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', ca.license_plate, ')')
            END as location_info
        FROM lessons l
        JOIN lesson_types lt ON l.lesson_type_id = lt.lesson_type_id
        JOIN lesson_topics lto ON l.lesson_topic_id = lto.lesson_topic_id
        JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
        LEFT JOIN group_lessons gl ON l.lesson_id = gl.lesson_id
        LEFT JOIN groups g ON gl.group_id = g.group_id
        LEFT JOIN classrooms c ON gl.classroom_id = c.classroom_id
        LEFT JOIN students_with_group swg ON g.group_id = swg.group_id AND swg.student_id = $1
        LEFT JOIN individual_lessons il ON l.lesson_id = il.lesson_id AND il.student_id = $1
        LEFT JOIN instructors i ON il.instructor_id = i.instructor_id
        LEFT JOIN persons p_inst ON i.person_id = p_inst.person_id
        LEFT JOIN cars ca ON i.car_id = ca.car_id
        LEFT JOIN car_models cm ON ca.car_model_id = cm.car_model_id
        LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
        WHERE (swg.student_id = $1 OR il.student_id = $1)
        AND l.start_time > NOW()
        AND ls.lesson_status != 'Cancelled'
        ORDER BY l.start_time ASC
        LIMIT 5
    `;
    const result = await defaultPool.query(query, [studentId]);
    return result.rows;
}

async function getUpcomingExams(studentId) {
    const query = `
        SELECT 
            e.exam_id,
            e.type,
            e.start_time,
            e.end_time,
            CASE 
                WHEN e.type = 'Theory' THEN c.name
                ELSE CONCAT(cb.car_brand_name, ' ', cm.car_model_name, ' (', ca.license_plate, ')')
            END as location_info,
            CASE 
                WHEN e.type = 'Theory' THEN CONCAT(p_teacher.first_name, ' ', p_teacher.last_name)
                ELSE CONCAT(p_inst.first_name, ' ', p_inst.last_name)
            END as examiner_name
        FROM exams e
        JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
        LEFT JOIN classrooms c ON el.classroom_id = c.classroom_id
        LEFT JOIN cars ca ON el.car_id = ca.car_id
        LEFT JOIN car_models cm ON ca.car_model_id = cm.car_model_id
        LEFT JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
        LEFT JOIN teachers t ON e.teacher_id = t.teacher_id
        LEFT JOIN persons p_teacher ON t.person_id = p_teacher.person_id
        LEFT JOIN instructors i ON e.instructor_id = i.instructor_id
        LEFT JOIN persons p_inst ON i.person_id = p_inst.person_id
        JOIN students s ON s.student_id = $1
        JOIN applications a ON s.application_id = a.application_id
        WHERE e.start_time > NOW()
        AND a.application_status_id IN (
            SELECT application_status_id 
            FROM application_statuses 
            WHERE application_status IN ('Approved', 'In Progress')
        )
        ORDER BY e.start_time ASC
        LIMIT 3
    `;
    const result = await defaultPool.query(query, [studentId]);
    return result.rows;
}

async function getAllStudents() {
    const query = `
        SELECT 
            s.student_id,
            p.first_name,
            p.last_name,
            p.email,
            p.phone
        FROM students s
        JOIN persons p ON s.person_id = p.person_id
        WHERE p.email IS NOT NULL AND p.email != ''
    `;
    const result = await defaultPool.query(query);
    return result.rows;
}

function getTimeDifference(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'Вже минув';
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffDays > 0) {
        return `${diffDays} днів ${diffHours} годин`;
    } else if (diffHours > 0) {
        return `${diffHours} годин ${diffMinutes} хвилин`;
    } else {
        return `${diffMinutes} хвилин`;
    }
}

function formatDateTime(dateTime) {
    return new Date(dateTime).toLocaleString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function sendReminderEmail(student, lessons, exams) {
    const { first_name, last_name, email } = student;
    
    let emailContent = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .section { margin-bottom: 30px; }
                .lesson, .exam { 
                    background-color: #f9f9f9; 
                    border-left: 4px solid #4CAF50; 
                    padding: 15px; 
                    margin: 10px 0; 
                }
                .exam { border-left-color: #FF9800; }
                .time-left { 
                    font-weight: bold; 
                    color: #FF5722; 
                    font-size: 1.1em; 
                }
                .urgent { color: #F44336; }
                .footer { 
                    background-color: #f0f0f0; 
                    padding: 10px; 
                    text-align: center; 
                    font-size: 0.9em; 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚗 Нагадування від Автошколи</h1>
            </div>
            <div class="content">
                <h2>Привіт, ${first_name} ${last_name}!</h2>
                <p>Це ваше щоденне нагадування про заплановані заняття та іспити.</p>
    `;
    if (exams.length > 0) {
        emailContent += `
            <div class="section">
                <h3>📋 Найближчі іспити:</h3>
        `;
        exams.forEach(exam => {
            const timeLeft = getTimeDifference(exam.start_time);
            const isUrgent = new Date(exam.start_time).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;
            emailContent += `
                <div class="exam">
                    <h4>${exam.type === 'Theory' ? '📚 Теоретичний іспит' : '🚗 Практичний іспит'}</h4>
                    <p><strong>Дата та час:</strong> ${formatDateTime(exam.start_time)}</p>
                    <p><strong>Місце:</strong> ${exam.location_info}</p>
                    <p><strong>Екзаменатор:</strong> ${exam.examiner_name}</p>
                    <p class="time-left ${isUrgent ? 'urgent' : ''}">
                        ⏰ Залишилось: ${timeLeft}
                    </p>
                </div>
            `;
        });
        emailContent += `</div>`;
    }
    if (lessons.length > 0) {
        emailContent += `
            <div class="section">
                <h3>📚 Найближчі заняття:</h3>
        `;
        lessons.forEach(lesson => {
            const timeLeft = getTimeDifference(lesson.start_time);
            const isUrgent = new Date(lesson.start_time).getTime() - new Date().getTime() < 2 * 60 * 60 * 1000;
            emailContent += `
                <div class="lesson">
                    <h4>${lesson.lesson_format === 'group' ? '👥 Групове заняття' : '👤 Індивідуальне заняття'}</h4>
                    <p><strong>Тема:</strong> ${lesson.lesson_topic}</p>
                    <p><strong>Тип:</strong> ${lesson.lesson_type}</p>
                    <p><strong>Дата та час:</strong> ${formatDateTime(lesson.start_time)}</p>
                    <p><strong>${lesson.lesson_format === 'group' ? 'Група' : 'Інструктор'}:</strong> ${lesson.instructor_or_group}</p>
                    <p><strong>Місце:</strong> ${lesson.location_info}</p>
                    <p class="time-left ${isUrgent ? 'urgent' : ''}">
                        ⏰ Залишилось: ${timeLeft}
                    </p>
                </div>
            `;
        });
        emailContent += `</div>`;
    }
    if (lessons.length === 0 && exams.length === 0) {
        emailContent += `
            <div class="section">
                <h3>✅ Сьогодні у вас немає запланованих занять або іспитів</h3>
                <p>Скористайтесь цим часом для повторення теоретичного матеріалу або відпочинку! 😊</p>
            </div>
        `;
    }
    emailContent += `
                <div class="section">
                    <p><strong>Важливі нагадування:</strong></p>
                    <ul>
                        <li>Не забудьте взяти з собою документи на заняття та іспити</li>
                        <li>Приходьте за 10-15 хвилин до початку</li>
                        <li>У разі неможливості відвідати заняття, повідомте заздалегідь</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Це автоматичне повідомлення від системи автошколи</p>
                <p>Успіхів у навчанні! 🚗💨</p>
            </div>
        </body>
        </html>
    `;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🚗 Щоденне нагадування - ${new Date().toLocaleDateString('uk-UA')}`,
        html: emailContent
    };
    try {
        await emailTransporter.sendMail(mailOptions);
        console.log(`Reminder email sent to ${email} (${first_name} ${last_name})`);
        return true;
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        return false;
    }
}

async function sendDailyReminders() {
    console.log('Starting daily reminder process...');
    try {
        const students = await getAllStudents();
        console.log(`Found ${students.length} students to send reminders to`);
        let successCount = 0;
        let failureCount = 0;
        for (const student of students) {
            try {
                const lessons = await getUpcomingLessons(student.student_id);
                const exams = await getUpcomingExams(student.student_id);
                const emailSent = await sendReminderEmail(student, lessons, exams);
                if (emailSent) {
                    successCount++;
                } else {
                    failureCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error processing student ${student.student_id}:`, error);
                failureCount++;
            }
        }
        console.log(`Daily reminders completed: ${successCount} sent, ${failureCount} failed`); 
    } catch (error) {
        console.error('Error in sendDailyReminders:', error);
    }
}

cron.schedule('47 16 * * *', async () => {
    console.log('Cron job triggered: sending daily reminders');
    await sendDailyReminders();
}, {
    scheduled: true,
    timezone: "Europe/Kiev"
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// TeacherPage -> MyClassScheduleComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

// Get teacher profile by username
app.get('/api/teacher/profile/:username', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const { username } = req.params;
    const query = `
      SELECT t.teacher_id, p.first_name, p.last_name, p.email, p.phone
      FROM teachers t
      JOIN persons p ON t.person_id = p.person_id
      WHERE t.login = $1
    `;
    const result = await req.pool.query(query, [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    res.status(500).json({ error: 'Failed to fetch teacher profile' });
  }
});

// Get all lesson types
app.get('/api/teacher/lesson_types', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_types ORDER BY lesson_type';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson types:', error);
    res.status(500).json({ error: 'Failed to fetch lesson types' });
  }
});

// Get all lesson statuses
app.get('/api/teacher/lesson_statuses', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_statuses ORDER BY lesson_status';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson statuses:', error);
    res.status(500).json({ error: 'Failed to fetch lesson statuses' });
  }
});

// Get all lesson topics
app.get('/api/teacher/lesson_topics', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const query = 'SELECT * FROM lesson_topics ORDER BY lesson_topic';
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lesson topics:', error);
    res.status(500).json({ error: 'Failed to fetch lesson topics' });
  }
});

// Get teacher's lessons
app.get('/api/teacher/lessons/:teacherId', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const query = `
      SELECT 
        l.lesson_id,
        l.lesson_type_id,
        l.lesson_status_id,
        l.lesson_topic_id,
        l.start_time,
        l.end_time,
        gl.group_id,
        gl.classroom_id,
        ls.lesson_status,
        lt.lesson_type,
        ltp.lesson_topic,
        c.name as classroom_name
      FROM lessons l
      JOIN group_lessons gl ON l.lesson_id = gl.lesson_id
      JOIN groups g ON gl.group_id = g.group_id
      LEFT JOIN lesson_statuses ls ON l.lesson_status_id = ls.lesson_status_id
      LEFT JOIN lesson_types lt ON l.lesson_type_id = lt.lesson_type_id
      LEFT JOIN lesson_topics ltp ON l.lesson_topic_id = ltp.lesson_topic_id
      LEFT JOIN classrooms c ON gl.classroom_id = c.classroom_id
      WHERE g.teacher_id = $1
      ORDER BY l.start_time DESC
    `;
    const result = await req.pool.query(query, [teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher lessons:', error);
    res.status(500).json({ error: 'Failed to fetch teacher lessons' });
  }
});

// Get teacher's groups
app.get('/api/teacher/groups/:teacherId', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const query = `
      SELECT group_id, name as group_name, current_students
      FROM groups 
      WHERE teacher_id = $1
      ORDER BY name
    `;
    const result = await req.pool.query(query, [teacherId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher groups:', error);
    res.status(500).json({ error: 'Failed to fetch teacher groups' });
  }
});



///////////////////////////////////////////////////////////////////////////////////////////////////
// TeacherPage -> MyStudentsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////


// Routes for Teacher Student Management

// Get teacher's students
app.get('/api/teacher/my-students', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const username = req.headers['username'];
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const query = `
      SELECT 
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        g.name as group_name,
        er.exam_score
      FROM students s
      INNER JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN groups g ON swg.group_id = g.group_id
      LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      WHERE t.login = $1
      ORDER BY p.last_name, p.first_name
    `;

    const result = await req.pool.query(query, [username]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get teacher's groups
app.get('/api/teacher/my-groups', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const username = req.headers['username'];
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const query = `
      SELECT 
        g.group_id,
        g.name,
        g.current_students
      FROM groups g
      INNER JOIN teachers t ON g.teacher_id = t.teacher_id
      WHERE t.login = $1
      ORDER BY g.name
    `;

    const result = await req.pool.query(query, [username]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teacher groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Update student exam score
app.put('/api/teacher/update-exam-score/:studentId', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { exam_score } = req.body;
    const username = req.headers['username'];

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (exam_score < 0 || exam_score > 100) {
      return res.status(400).json({ error: 'Exam score must be between 0 and 100' });
    }

    // Check if teacher has access to this student
    const accessQuery = `
      SELECT s.student_id
      FROM students s
      INNER JOIN students_with_group swg ON s.student_id = swg.student_id
      INNER JOIN groups g ON swg.group_id = g.group_id
      INNER JOIN teachers t ON g.teacher_id = t.teacher_id
      WHERE s.student_id = $1 AND t.login = $2
    `;

    const accessResult = await req.pool.query(accessQuery, [studentId, username]);
    
    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this student' });
    }

    // Update or create exam result
    const updateQuery = `
      WITH exam_result AS (
        INSERT INTO exam_results (exam_score)
        VALUES ($2)
        ON CONFLICT DO NOTHING
        RETURNING exam_result_id
      ),
      updated_student AS (
        UPDATE students 
        SET exam_result_id = COALESCE(
          (SELECT exam_result_id FROM exam_result),
          (SELECT exam_result_id FROM exam_results WHERE exam_score = $2 LIMIT 1)
        )
        WHERE student_id = $1
        RETURNING *
      )
      SELECT * FROM updated_student
    `;

    await req.pool.query(updateQuery, [studentId, exam_score]);
    res.json({ message: 'Exam score updated successfully' });
  } catch (error) {
    console.error('Error updating exam score:', error);
    res.status(500).json({ error: 'Failed to update exam score' });
  }
});

// Generate PDF report for student
app.get('/api/teacher/generate-student-pdf/:studentId', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    const studentQuery = `
      SELECT 
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        g.name as group_name,
        tp.first_name as teacher_first_name,
        tp.last_name as teacher_last_name,
        sc.study_category,
        app_status.application_status,
        app.submission_date,
        app.approval_date,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score < 50 THEN 'FAILED'
          ELSE 'NO SCORE'
        END as exam_result
      FROM students s
      INNER JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN groups g ON swg.group_id = g.group_id
      LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
      LEFT JOIN persons tp ON t.person_id = tp.person_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      WHERE s.student_id = $1 AND t.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }
    const student = studentResult.rows[0];
    const doc = new PDFDocument({ 
      margin: 30,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Student Report - ${student.first_name} ${student.last_name}`,
        Author: 'Driving School Management System',
        Subject: `Student Report ID: ${student.student_id}`,
        Keywords: 'student, report, driving school'
      }
    });
    try {
      const fontsPath = path.join(__dirname, 'fonts');
      const regularFontPath = path.join(fontsPath, 'DejaVuSans.ttf');
      const boldFontPath = path.join(fontsPath, 'DejaVuSans-Bold.ttf');
      if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
        doc.registerFont('DejaVuSans', regularFontPath);
        doc.registerFont('DejaVuSans-Bold', boldFontPath);
        doc.font('DejaVuSans');
      } else {
        doc.font('Helvetica');
      }
    } catch (fontError) {
      console.warn('Font registration failed, using system fonts:', fontError.message);
      doc.font('Helvetica');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.pdf"`);
    doc.pipe(res);
    const formatDate = (dateStr) => {
      if (!dateStr) return 'Not specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) {
        return { text: 'NOT TAKEN', passed: false, color: '#666666' };
      }
      const numScore = parseFloat(score);
      return {
        text: numScore >= 50 ? 'PASSED' : 'FAILED',
        passed: numScore >= 50,
        color: numScore >= 50 ? '#28a745' : '#dc3545'
      };
    };
    const safeText = (text, options = {}) => {
      if (!text) return doc.text('N/A', options);
      return doc.text(String(text), options);
    };
    doc.fontSize(22);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#2c3e50');
    safeText('STUDENT REPORT', { align: 'center' });
    doc.fontSize(11);
    try {
      doc.font('DejaVuSans');
    } catch (e) {
      doc.font('Helvetica');
    }
    doc.fillColor('#7f8c8d');
    safeText(`Generated: ${formatDate(new Date())} | Student ID: ${student.student_id}`, { align: 'center' });
    doc.moveTo(30, doc.y + 10)
       .lineTo(565, doc.y + 10)
       .strokeColor('#3498db')
       .lineWidth(2)
       .stroke();
    doc.moveDown(1);
    const leftX = 30;
    let currentY = doc.y;
    currentY += 16;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('PERSONAL DATA', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    const studentInfo = [
      ['First Name:', student.first_name || 'Not specified'],
      ['Last Name:', student.last_name || 'Not specified'],
      ['TIN:', student.TIN || 'Not specified'],
      ['Email:', student.email || 'Not specified'],
      ['Phone:', student.phone || 'Not specified'],
      ['Birth Date:', formatDate(student.birth_date)]
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    studentInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('STUDY INFORMATION', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    const studyInfo = [
      ['Type:', student.study_category || 'Not specified'],
      ['Applied:', formatDate(student.submission_date)],
      ['Approved:', formatDate(student.approval_date)],
      ['Status:', student.application_status || 'Not specified']
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    studyInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('ACADEMIC INFORMATION', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    const teacherName = student.teacher_first_name && student.teacher_last_name 
      ? `${student.teacher_first_name} ${student.teacher_last_name}` 
      : 'Not assigned';
    const academicInfo = [
      ['Group:', student.group_name || 'Not assigned'],
      ['Teacher:', teacherName]
    ];
    currentY += 16;
    doc.fontSize(12).fillColor('#2c3e50');
    academicInfo.forEach(([label, value]) => {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text(label, leftX, currentY, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.text(` ${value}`);
      currentY += 18;
    });
    currentY += 15;
    doc.fontSize(15);
    try {
      doc.font('DejaVuSans-Bold');
    } catch (e) {
      doc.font('Helvetica-Bold');
    }
    doc.fillColor('#8e44ad');
    doc.text('EXAM', leftX, currentY, { align: 'center', width: 535 });
    currentY += 12;
    currentY += 19;
    const examBoxWidth = 535;
    const examBoxX = leftX;
    doc.fillColor('#ecf0f1')
       .rect(examBoxX, currentY - 5, examBoxWidth, 80)
       .fill();
    const examResult = getExamResult(student.exam_score);
    let examYPos = currentY + 15;
    doc.fontSize(12).fillColor('#2c3e50');
    if (student.exam_score !== null && student.exam_score !== undefined) {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text('Score:', examBoxX + 20, examYPos, { continued: true });
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${student.exam_score}/100`);
      doc.fontSize(12);
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.fillColor('#2c3e50');
      doc.text('Result:', examBoxX + 170, examYPos, { continued: true });
      doc.fillColor(examResult.color);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${examResult.text}`);
      const progressWidth = 200;
      const scorePercentage = student.exam_score / 100;
      const progressFillWidth = progressWidth * scorePercentage;
      examYPos += 25;
      doc.fillColor('#bdc3c7')
         .rect(examBoxX + 20, examYPos, progressWidth, 12)
         .fill();
      doc.fillColor(examResult.color)
         .rect(examBoxX + 20, examYPos, progressFillWidth, 12)
         .fill();
      doc.fontSize(9);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fillColor('#2c3e50');
      doc.text(`${student.exam_score}%`, examBoxX + 20 + progressWidth + 10, examYPos + 2);
    } else {
      try {
        doc.font('DejaVuSans');
      } catch (e) {
        doc.font('Helvetica');
      }
      doc.text('Exam Status:', examBoxX + 20, examYPos, { continued: true });
      doc.fillColor(examResult.color);
      try {
        doc.font('DejaVuSans-Bold');
      } catch (e) {
        doc.font('Helvetica-Bold');
      }
      doc.fontSize(15).text(` ${examResult.text}`);
    }
    const footerY = 750;
    doc.fontSize(9);
    try {
      doc.font('DejaVuSans');
    } catch (e) {
      doc.font('Helvetica');
    }
    doc.fillColor('#95a5a6');
    doc.moveTo(30, footerY - 15)
       .lineTo(565, footerY - 15)
       .strokeColor('#bdc3c7')
       .lineWidth(1)
       .stroke();
    doc.text('Document generated automatically by Driving School Management System', 30, footerY, { 
      align: 'center', 
      width: 535 
    });
    doc.text(`Generated: ${new Date().toLocaleString('en-US')} | Confidential Document`, 30, footerY + 12, { 
      align: 'center', 
      width: 535 
    });
    console.log(`PDF generated successfully for student ${studentId} by teacher ${username}`);
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Generate CSV report for student
app.get('/api/teacher/generate-student-csv/:studentId', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    const studentQuery = `
      SELECT 
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        g.name as group_name,
        tp.first_name as teacher_first_name,
        tp.last_name as teacher_last_name,
        sc.study_category,
        app_status.application_status,
        app.submission_date,
        app.approval_date,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score < 50 THEN 'FAILED'
          ELSE 'NO SCORE'
        END as exam_result
      FROM students s
      INNER JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN groups g ON swg.group_id = g.group_id
      LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
      LEFT JOIN persons tp ON t.person_id = tp.person_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      WHERE s.student_id = $1 AND t.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }
    const student = studentResult.rows[0];
    const formatDate = (dateStr) => {
      if (!dateStr) return 'Not specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US');
      } catch (error) {
        return 'Invalid date';
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) return 'NOT TAKEN';
      const numScore = parseFloat(score);
      return numScore >= 50 ? 'PASSED' : 'FAILED';
    };
    const teacherName = student.teacher_first_name && student.teacher_last_name 
      ? `${student.teacher_first_name} ${student.teacher_last_name}` 
      : 'Not assigned';
    const csvData = [
      ['Field', 'Value'],
      ['Student ID', student.student_id || ''],
      ['First Name', student.first_name || ''],
      ['Last Name', student.last_name || ''],
      ['TIN', student.TIN || ''],
      ['Email', student.email || ''],
      ['Phone', student.phone || ''],
      ['Birth Date', formatDate(student.birth_date)],
      ['Study Type', student.study_category || ''],
      ['Applied Date', formatDate(student.submission_date)],
      ['Approved Date', formatDate(student.approval_date)],
      ['Application Status', student.application_status || ''],
      ['Group', student.group_name || ''],
      ['Teacher', teacherName],
      ['Exam Score', student.exam_score !== null ? `${student.exam_score}/100` : ''],
      ['Exam Result', getExamResult(student.exam_score)],
      ['Report Generated', new Date().toLocaleString('en-US')]
    ];
    const csvString = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.csv"`);
    res.send(csvString);
    console.log(`CSV generated successfully for student ${studentId} by teacher ${username}`);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

// Generate JSON report for student
app.get('/api/teacher/generate-student-json/:studentId', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const username = req.headers['username'];
    const studentQuery = `
      SELECT 
        s.student_id,
        p.first_name,
        p.last_name,
        p.email,
        p.phone,
        p.birth_date,
        p."TIN",
        g.name as group_name,
        tp.first_name as teacher_first_name,
        tp.last_name as teacher_last_name,
        sc.study_category,
        app_status.application_status,
        app.submission_date,
        app.approval_date,
        er.exam_score,
        CASE 
          WHEN er.exam_score >= 50 THEN 'PASSED'
          WHEN er.exam_score < 50 THEN 'FAILED'
          ELSE 'NO SCORE'
        END as exam_result
      FROM students s
      INNER JOIN persons p ON s.person_id = p.person_id
      LEFT JOIN students_with_group swg ON s.student_id = swg.student_id
      LEFT JOIN groups g ON swg.group_id = g.group_id
      LEFT JOIN teachers t ON g.teacher_id = t.teacher_id
      LEFT JOIN persons tp ON t.person_id = tp.person_id
      LEFT JOIN applications app ON s.application_id = app.application_id
      LEFT JOIN study_categories sc ON app.study_category_id = sc.study_category_id
      LEFT JOIN application_statuses app_status ON app.application_status_id = app_status.application_status_id
      LEFT JOIN exam_results er ON s.exam_result_id = er.exam_result_id
      WHERE s.student_id = $1 AND t.login = $2
    `;
    const studentResult = await req.pool.query(studentQuery, [studentId, username]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }
    const student = studentResult.rows[0];
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US');
      } catch (error) {
        return null;
      }
    };
    const getExamResult = (score) => {
      if (score === null || score === undefined) {
        return { status: 'NOT_TAKEN', passed: false };
      }
      const numScore = parseFloat(score);
      return { 
        status: numScore >= 50 ? 'PASSED' : 'FAILED', 
        passed: numScore >= 50 
      };
    };
    const teacherName = student.teacher_first_name && student.teacher_last_name 
      ? `${student.teacher_first_name} ${student.teacher_last_name}` 
      : null;
    const jsonData = {
      report_info: {
        generated_at: new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }),
        generated_by: username,
        report_type: 'student_report'
      },
      student_info: {
        id: student.student_id,
        personal_data: {
          first_name: student.first_name,
          last_name: student.last_name,
          tin: student.TIN,
          email: student.email,
          phone: student.phone,
          birth_date: formatDate(student.birth_date)
        },
        study_information: {
          type: student.study_category,
          applied_date: formatDate(student.submission_date),
          approved_date: formatDate(student.approval_date),
          status: student.application_status
        },
        academic_information: {
          group_name: student.group_name,
          teacher_name: teacherName
        },
        exam: {
          score: student.exam_score,
          max_score: 100,
          result: getExamResult(student.exam_score),
          percentage: student.exam_score !== null ? Math.round((student.exam_score / 100) * 100) : null
        }
      }
    };
    const prettyJsonString = JSON.stringify(jsonData, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${student.first_name}_${student.last_name}_report.json"`);
    res.send(prettyJsonString);
    console.log(`JSON generated successfully for student ${studentId} by teacher ${username}`);
  } catch (error) {
    console.error('Error generating JSON:', error);
    res.status(500).json({ error: 'Failed to generate JSON' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// TeacherPage -> MyExamsComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

// Route to fetch teacher's exams with classroom and group information
app.get('/api/teacher/my-exams', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required in headers' });
    }
    const teacherQuery = `
      SELECT t.teacher_id 
      FROM teachers t 
      WHERE t.login = $1
    `;
    const teacherResult = await req.pool.query(teacherQuery, [username]);
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const teacherId = teacherResult.rows[0].teacher_id;
    const examsQuery = `
      SELECT 
        e.exam_id,
        e.type,
        e.start_time,
        e.end_time,
        e.teacher_id,
        el.classroom_id,
        c.name as classroom_name,
        COALESCE(
          JSON_AGG(
            CASE 
              WHEN g.group_id IS NOT NULL 
              THEN JSON_BUILD_OBJECT(
                'group_id', g.group_id,
                'group_name', g.name,
                'current_students', g.current_students
              )
              ELSE NULL
            END
          ) FILTER (WHERE g.group_id IS NOT NULL), 
          '[]'
        ) as groups
      FROM exams e
      JOIN exam_locations el ON e.exam_location_id = el.exam_location_id
      LEFT JOIN classrooms c ON el.classroom_id = c.classroom_id
      LEFT JOIN groups g ON g.teacher_id = e.teacher_id
      LEFT JOIN students_with_group swg ON swg.group_id = g.group_id
      WHERE e.teacher_id = $1
      GROUP BY e.exam_id, e.type, e.start_time, e.end_time, e.teacher_id, 
               el.classroom_id, c.name
      ORDER BY e.start_time ASC
    `;
    const examsResult = await req.pool.query(examsQuery, [teacherId]);
    res.json(examsResult.rows);
  } catch (error) {
    console.error('Error fetching teacher exams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch teacher's lessons with group information
app.get('/api/teacher/my-groups', checkRoleAccess(['teacher']), async (req, res) => {
  try {
    const username = req.headers['username'];
    if (!username) {
      return res.status(400).json({ error: 'Username is required in headers' });
    }
    const teacherQuery = `
      SELECT t.teacher_id 
      FROM teachers t 
      WHERE t.login = $1
    `;
    const teacherResult = await req.pool.query(teacherQuery, [username]);
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const teacherId = teacherResult.rows[0].teacher_id;
    const groupsQuery = `
      SELECT 
        group_id,
        name,
        current_students
      FROM groups
      WHERE teacher_id = $1
      ORDER BY name ASC
    `;
    const groupsResult = await req.pool.query(groupsQuery, [teacherId]);
    res.json(groupsResult.rows);
  } catch (error) {
    console.error('Error fetching teacher groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch available classrooms for exams
app.get('/api/classrooms', checkRoleAccess(['teacher', 'admin']), async (req, res) => {
  try {
    const classroomsQuery = `
      SELECT 
        classroom_id,
        name,
        is_available
      FROM classrooms
      WHERE is_available = true
      ORDER BY name ASC
    `;
    const result = await req.pool.query(classroomsQuery);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// TeacherPage -> MyLecturesComponent
///////////////////////////////////////////////////////////////////////////////////////////////////

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'LecturesForTeachersPDFs');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('❌ Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}.pdf`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Get all PDF files
app.get('/api/pdf-files', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const query = `
      SELECT id, original_name, file_name, file_size, upload_date
      FROM pdf_files 
      ORDER BY upload_date DESC
    `;
    const result = await req.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching PDF files:', error);
    res.status(500).json({ message: 'Error fetching PDF files' });
  }
});

// Upload new PDF file
app.post('/api/pdf-files/upload', checkRoleAccess(['admin', 'instructor', 'teacher']), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }
    const fileId = uuidv4();
    const query = `
      INSERT INTO pdf_files (id, original_name, file_name, file_path, file_size, upload_date)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const values = [
      fileId,
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.size
    ];
    const result = await req.pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error uploading PDF file:', error);
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('❌ Error cleaning up file:', unlinkError);
      }
    }
    res.status(500).json({ message: 'Error uploading PDF file' });
  }
});

// Get specific PDF file
app.get('/api/pdf-files/:id', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  const fileId = req.params.id;
  try {
    const query = `
      SELECT * FROM pdf_files 
      WHERE id = $1
    `;
    const result = await req.pool.query(query, [fileId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'PDF file not found' });
    }
    const file = result.rows[0];
    const filePath = file.file_path;
    try {
      await fs.access(filePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
      res.sendFile(path.resolve(filePath));
    } catch (fileError) {
      console.error('❌ Physical file not found on disk:', fileError);
      res.status(404).json({ message: 'PDF file not found on disk' });
    }
  } catch (error) {
    console.error('❌ Error retrieving PDF file:', error);
    res.status(500).json({ message: 'Error retrieving PDF file' });
  }
});

// Get PDF file info
app.get('/api/pdf-files/:id/info', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  const fileId = req.params.id;
  try {
    const query = `
      SELECT id, original_name, file_name, file_size, upload_date
      FROM pdf_files 
      WHERE id = $1
    `;
    const result = await req.pool.query(query, [fileId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'PDF file not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error retrieving PDF file info:', error);
    res.status(500).json({ message: 'Error retrieving PDF file info' });
  }
});

// Delete PDF file
app.delete('/api/pdf-files/:id', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  const fileId = req.params.id;
  try {
    const selectQuery = `
      SELECT * FROM pdf_files 
      WHERE id = $1
    `;
    const selectResult = await req.pool.query(selectQuery, [fileId]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ message: 'PDF file not found' });
    }
    const file = selectResult.rows[0];
    const deleteQuery = `
      DELETE FROM pdf_files 
      WHERE id = $1
    `;
    await req.pool.query(deleteQuery, [fileId]);
    try {
      await fs.unlink(file.file_path);
    } catch (fileError) {
      console.error('❌ Error deleting physical file (continuing anyway):', fileError);
    }
    res.json({ message: 'PDF file deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting PDF file:', error);
    res.status(500).json({ message: 'Error deleting PDF file' });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AdminPage -> AnalyticsComponent - Enhanced with Additional Analytics - FIXED
///////////////////////////////////////////////////////////////////////////////////////////////////

// Route to fetch analytics dashboard data
app.get('/api/analytics/dashboard', checkRoleAccess(['admin', 'instructor', 'teacher']), async (req, res) => {
  try {
    const pool = req.pool;
    //
    // APPLICATIONS ANALYTICS - Using Views
    //
    const applicationStatusQuery = 'SELECT * FROM v_application_status_analytics';
    const monthlyApplicationsQuery = 'SELECT * FROM v_monthly_applications_analytics';
    const categoryDistributionQuery = 'SELECT * FROM v_category_distribution_analytics';
    const applicationsSummaryQuery = 'SELECT * FROM v_applications_summary_analytics';
    const applicationsByDayQuery = 'SELECT * FROM v_applications_by_day_analytics';
    const processingTimeQuery = 'SELECT * FROM v_processing_time_analytics';
    const applicationDemographicsQuery = 'SELECT * FROM v_application_demographics_analytics';
    //
    // STUDENTS ANALYTICS
    //
    const monthlyStudentsQuery = 'SELECT * FROM v_monthly_students_analytics';
    const examResultsQuery = 'SELECT * FROM v_exam_results_analytics';
    const ageDistributionQuery = 'SELECT * FROM v_age_distribution_analytics';
    const studentsSummaryQuery = 'SELECT * FROM v_students_summary_analytics';
    const groupParticipationQuery = 'SELECT * FROM v_group_participation_analytics';
    const individualLessonsQuery = 'SELECT * FROM v_individual_lessons_analytics';
    const categoryPerformanceQuery = 'SELECT * FROM v_category_performance_analytics';
    const completionRateQuery = 'SELECT * FROM v_completion_rate_analytics';
//
// INSTRUCTORS ANALYTICS
//
const instructorsSummaryQuery = `SELECT * FROM instructors_summary`;
const instructorsByExperienceQuery = `SELECT * FROM instructors_by_experience`;
const instructorsByCategoryQuery = `SELECT * FROM instructors_by_category`;
const instructorsWorkloadQuery = `SELECT * FROM instructors_workload`;
const instructorCarStatusQuery = `SELECT * FROM instructor_car_status`;
const instructorAgeDistributionQuery = `SELECT * FROM instructor_age_distribution`;
//
// TEACHERS ANALYTICS
//
const teachersSummaryQuery = `SELECT * FROM teachers_summary`;
const teachersWorkloadQuery = `SELECT * FROM teachers_workload`;
const teacherAgeDistributionQuery = `SELECT * FROM teacher_age_distribution`;
const groupsPerformanceQuery = `SELECT * FROM groups_performance`;
//
// LESSONS ANALYTICS
//
const lessonsSummaryQuery = `SELECT * FROM lessons_summary`;
const lessonsMonthlyTrendsQuery = `SELECT * FROM lessons_monthly_trends`;
const lessonsTypeDistributionQuery = `SELECT * FROM lessons_type_distribution`;
const lessonsStatusDistributionQuery = `SELECT * FROM lessons_status_distribution`;
const lessonsTopicDistributionQuery = `SELECT * FROM lessons_topic_distribution`;
const lessonsByDayOfWeekQuery = `SELECT * FROM lessons_by_day_of_week`;
const groupLessonsAnalysisQuery = `SELECT * FROM group_lessons_analysis`;
const individualLessonsAnalysisQuery = `SELECT * FROM individual_lessons_analysis`;
//
// EXAMS ANALYTICS
//
const examsSummaryQuery = `SELECT * FROM exams_summary`;
const examsMonthlyTrendsQuery = `SELECT * FROM exams_monthly_trends`;
const examsTypeDistributionQuery = `SELECT * FROM exams_type_distribution`;
const examsByDayOfWeekQuery = `SELECT * FROM exams_by_day_of_week`;
const examsLocationDistributionQuery = `SELECT * FROM exams_location_distribution`;
const theoryExamsAnalysisQuery = `SELECT * FROM theory_exams_analysis`;
const practiceExamsAnalysisQuery = `SELECT * FROM practice_exams_analysis`;
const examsUtilizationQuery = `SELECT * FROM exams_utilization`;
//
// CLASSROOM ANALYTICS
//
const classroomsSummaryQuery = `SELECT * FROM classrooms_summary`;
//
// CARS ANALYTICS
//
const carsConditionDistributionQuery = `SELECT * FROM cars_condition_distribution`;
const carsYearDistributionQuery = `SELECT * FROM cars_year_distribution`;
const carsCategoryDistributionQuery = `SELECT * FROM cars_category_distribution`;
const carsInstructorAssignmentQuery = `SELECT * FROM cars_instructor_assignment`;
const carsSummaryQuery = `SELECT * FROM cars_summary`;
    const [
      applicationStatus,
      monthlyApplications,
      categoryDistribution,
      applicationsSummary,
      applicationsByDay,
      processingTime,
      applicationDemographics,
      monthlyStudents,
      examResults,
      ageDistribution,
      studentsSummary,
      groupParticipation,
      individualLessons,
      categoryPerformance,
      completionRate,
        instructorsSummary,
  instructorsByExperience,
  instructorsByCategory,
  instructorsWorkload,
  instructorCarStatus,
  instructorAgeDistribution,
  teachersSummary,
  teachersWorkload,
  teacherAgeDistribution,
  groupsPerformance,
  lessonsSummary,
  lessonsMonthlyTrends,
  lessonsTypeDistribution,
  lessonsStatusDistribution,
  lessonsTopicDistribution,
  lessonsByDayOfWeek,
  groupLessonsAnalysis,
  individualLessonsAnalysis,
  examsSummary,
  examsMonthlyTrends,
  examsTypeDistribution,
  examsByDayOfWeek,
  examsLocationDistribution,
  theoryExamsAnalysis,
  practiceExamsAnalysis,
  examsUtilization,
  classroomsSummary,
        carsConditionDistribution,
      carsYearDistribution,
      carsCategoryDistribution,
      carsInstructorAssignment,
      carsSummary
  
    ] = await Promise.all([
      pool.query(applicationStatusQuery),
      pool.query(monthlyApplicationsQuery),
      pool.query(categoryDistributionQuery),
      pool.query(applicationsSummaryQuery),
      pool.query(applicationsByDayQuery),
      pool.query(processingTimeQuery),
      pool.query(applicationDemographicsQuery),
      pool.query(monthlyStudentsQuery),
      pool.query(examResultsQuery),
      pool.query(ageDistributionQuery),
      pool.query(studentsSummaryQuery),
      pool.query(groupParticipationQuery),
      pool.query(individualLessonsQuery),
      pool.query(categoryPerformanceQuery),
      pool.query(completionRateQuery),
        pool.query(instructorsSummaryQuery),
  pool.query(instructorsByExperienceQuery),
  pool.query(instructorsByCategoryQuery),
  pool.query(instructorsWorkloadQuery),
  pool.query(instructorCarStatusQuery),
  pool.query(instructorAgeDistributionQuery),
  pool.query(teachersSummaryQuery),
  pool.query(teachersWorkloadQuery),
  pool.query(teacherAgeDistributionQuery),
  pool.query(groupsPerformanceQuery),
      pool.query(lessonsSummaryQuery),
      pool.query(lessonsMonthlyTrendsQuery),
      pool.query(lessonsTypeDistributionQuery),
      pool.query(lessonsStatusDistributionQuery),
      pool.query(lessonsTopicDistributionQuery),
      pool.query(lessonsByDayOfWeekQuery),
      pool.query(groupLessonsAnalysisQuery),
      pool.query(individualLessonsAnalysisQuery),
      pool.query(examsSummaryQuery),
      pool.query(examsMonthlyTrendsQuery),
      pool.query(examsTypeDistributionQuery),
      pool.query(examsByDayOfWeekQuery),
      pool.query(examsLocationDistributionQuery),
      pool.query(theoryExamsAnalysisQuery),
      pool.query(practiceExamsAnalysisQuery),
      pool.query(examsUtilizationQuery),
      pool.query(classroomsSummaryQuery),
           pool.query(carsConditionDistributionQuery),
      pool.query(carsYearDistributionQuery),
      pool.query(carsCategoryDistributionQuery),
      pool.query(carsInstructorAssignmentQuery),
      pool.query(carsSummaryQuery)
    ]);
    const analyticsData = {
      applicationsAnalytics: {
        statusDistribution: applicationStatus.rows.map(row => ({
          status: row.status,
          name: row.status,
          count: parseInt(row.count)
        })),
        monthlyTrends: monthlyApplications.rows.map(row => ({
          month: row.month,
          applications: parseInt(row.applications)
        })),
        categoryDistribution: categoryDistribution.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count)
        })),
        summary: {
          total: parseInt(applicationsSummary.rows[0].total),
          pending: parseInt(applicationsSummary.rows[0].pending),
          approved: parseInt(applicationsSummary.rows[0].approved),
          rejected: parseInt(applicationsSummary.rows[0].rejected)
        },
        dayOfWeekDistribution: applicationsByDay.rows.map(row => ({
          day: row.day_name.trim(),
          applications: parseInt(row.applications),
          dayNumber: parseInt(row.day_number)
        })),
        processingTimeAnalysis: processingTime.rows.map(row => ({
          timeRange: row.processing_time,
          count: parseInt(row.count),
          avgDays: parseFloat(row.avg_days)
        })),
        applicantDemographics: applicationDemographics.rows.map(row => ({
          ageGroup: row.age_group,
          applications: parseInt(row.applications)
        }))
      },
      studentsAnalytics: {
        monthlyRegistrations: monthlyStudents.rows.map(row => ({
          month: row.month,
          students: parseInt(row.students)
        })),
        examResults: examResults.rows.map(row => ({
          range: row.range,
          count: parseInt(row.count)
        })),
        ageDistribution: ageDistribution.rows.map(row => ({
          name: row.name,
          count: parseInt(row.count)
        })),
        summary: {
          total: parseInt(studentsSummary.rows[0].total),
          withResults: parseInt(studentsSummary.rows[0].withresults),
          averageScore: parseFloat(studentsSummary.rows[0].averagescore)
        },
        groupParticipation: groupParticipation.rows.map(row => ({
          groupName: row.group_name,
          currentStudents: parseInt(row.current_students),
          enrolledStudents: parseInt(row.enrolled_students),
          teacherName: row.teacher_name
        })),
        instructorStudents: individualLessons.rows.map(row => ({
          instructorName: row.instructor_name,
          drivingCategory: row.driving_category,
          studentsCount: parseInt(row.students_count)
        })),
        categoryPerformance: categoryPerformance.rows.map(row => ({
          category: row.study_category,
          totalStudents: parseInt(row.total_students),
          studentsWithResults: parseInt(row.students_with_results),
          avgScore: parseFloat(row.avg_score),
          passedStudents: parseInt(row.passed_students),
          passRate: row.students_with_results > 0 
            ? parseFloat(((parseInt(row.passed_students) / parseInt(row.students_with_results)) * 100).toFixed(1))
            : 0
        })),
        completionRateByMonth: completionRate.rows.map(row => ({
          month: row.approval_month,
          totalStudents: parseInt(row.total_students),
          completedExams: parseInt(row.completed_exams),
          completionRate: parseFloat(row.completion_rate || 0)
        }))
      },
        instructorsAnalytics: {
    summary: {
      total: parseInt(instructorsSummary.rows[0].total),
      avgExperience: parseFloat(instructorsSummary.rows[0].avg_experience || 0),
      withCars: parseInt(instructorsSummary.rows[0].with_cars),
      withoutCars: parseInt(instructorsSummary.rows[0].without_cars)
    },
    experienceDistribution: instructorsByExperience.rows.map(row => ({
      experienceRange: row.experience_range,
      count: parseInt(row.count)
    })),
    categoryDistribution: instructorsByCategory.rows.map(row => ({
      category: row.driving_category,
      count: parseInt(row.count),
      avgExperience: parseFloat(row.avg_experience || 0)
    })),
    workloadAnalysis: instructorsWorkload.rows.map(row => ({
      instructorName: row.instructor_name,
      drivingCategory: row.driving_category,
      experienceYears: parseInt(row.experience_years),
      totalStudents: parseInt(row.total_students),
      totalLessons: parseInt(row.total_lessons),
      totalExams: parseInt(row.total_exams)
    })),
    carStatus: instructorCarStatus.rows.map(row => ({
      status: row.car_status,
      count: parseInt(row.count)
    })),
    ageDistribution: instructorAgeDistribution.rows.map(row => ({
      ageGroup: row.age_group,
      count: parseInt(row.count)
    }))
  },
  teachersAnalytics: {
    summary: {
      total: parseInt(teachersSummary.rows[0].total),
      totalGroups: parseInt(teachersSummary.rows[0].total_groups || 0),
      avgStudentsPerGroup: parseFloat(teachersSummary.rows[0].avg_students_per_group || 0)
    },
    workloadAnalysis: teachersWorkload.rows.map(row => ({
      teacherName: row.teacher_name,
      totalGroups: parseInt(row.total_groups),
      totalStudents: parseInt(row.total_students),
      totalLessons: parseInt(row.total_lessons),
      totalExams: parseInt(row.total_exams)
    })),
    ageDistribution: teacherAgeDistribution.rows.map(row => ({
      ageGroup: row.age_group,
      count: parseInt(row.count)
    })),
    groupsPerformance: groupsPerformance.rows.map(row => ({
      groupName: row.group_name,
      currentStudents: parseInt(row.current_students),
      teacherName: row.teacher_name,
      enrolledStudents: parseInt(row.enrolled_students),
      studentsWithResults: parseInt(row.students_with_results || 0),
      avgScore: parseFloat(row.avg_score || 0)
    }))
  },
lessonsAnalytics: {
  summary: {
    total: parseInt(lessonsSummary.rows[0].total),
    completed: parseInt(lessonsSummary.rows[0].completed || 0),
    scheduled: parseInt(lessonsSummary.rows[0].scheduled || 0),
    cancelled: parseInt(lessonsSummary.rows[0].cancelled || 0)
  },
  monthlyTrends: lessonsMonthlyTrends.rows.map(row => ({
    month: row.month,
    lessons: parseInt(row.lessons)
  })),
  typeDistribution: lessonsTypeDistribution.rows.map(row => ({
    type: row.lesson_type,
    count: parseInt(row.count || 0),
    avgDurationHours: parseFloat(row.avg_duration_hours || 0)
  })),
  statusDistribution: lessonsStatusDistribution.rows.map(row => ({
    status: row.status,
    count: parseInt(row.count || 0)
  })),
  topicDistribution: lessonsTopicDistribution.rows.map(row => ({
    topic: row.lesson_topic,
    count: parseInt(row.count || 0)
  })),
  dayOfWeekDistribution: lessonsByDayOfWeek.rows.map(row => ({
    day: row.day_name.trim(),
    lessons: parseInt(row.lessons),
    dayNumber: parseInt(row.day_number)
  })),
  groupLessonsAnalysis: groupLessonsAnalysis.rows.map(row => ({
    groupName: row.group_name,
    teacherName: row.teacher_name,
    totalLessons: parseInt(row.total_lessons || 0),
    completedLessons: parseInt(row.completed_lessons || 0),
    classroomName: row.classroom_name
  })),
  individualLessonsAnalysis: individualLessonsAnalysis.rows.map(row => ({
    instructorName: row.instructor_name,
    drivingCategory: row.driving_category,
    totalLessons: parseInt(row.total_lessons || 0),
    completedLessons: parseInt(row.completed_lessons || 0),
    uniqueStudents: parseInt(row.unique_students || 0)
  }))
},
examsAnalytics: {
  summary: {
    total: parseInt(examsSummary.rows[0].total),
    theoryExams: parseInt(examsSummary.rows[0].theory_exams || 0),
    practiceExams: parseInt(examsSummary.rows[0].practice_exams || 0),
    avgDurationHours: parseFloat(examsSummary.rows[0].avg_duration_hours || 0)
  },
  monthlyTrends: examsMonthlyTrends.rows.map(row => ({
    month: row.month,
    exams: parseInt(row.exams)
  })),
  typeDistribution: examsTypeDistribution.rows.map(row => ({
    type: row.type,
    count: parseInt(row.count)
  })),
  dayOfWeekDistribution: examsByDayOfWeek.rows.map(row => ({
    day: row.day_name.trim(),
    exams: parseInt(row.exams),
    dayNumber: parseInt(row.day_number)
  })),
  locationDistribution: examsLocationDistribution.rows.map(row => ({
    location: row.location_name,
    count: parseInt(row.count || 0)
  })),
  theoryExamsAnalysis: theoryExamsAnalysis.rows.map(row => ({
    teacherName: row.teacher_name,
    totalTheoryExams: parseInt(row.total_theory_exams || 0),
    classroomName: row.classroom_name
  })),
  practiceExamsAnalysis: practiceExamsAnalysis.rows.map(row => ({
    instructorName: row.instructor_name,
    drivingCategory: row.driving_category,
    totalPracticeExams: parseInt(row.total_practice_exams || 0),
    carLicensePlate: row.car_license_plate,
    carInfo: row.car_info
  })),
  utilizationByDate: examsUtilization.rows.map(row => ({
    examDate: row.exam_date,
    totalExams: parseInt(row.total_exams),
    theoryCount: parseInt(row.theory_count || 0),
    practiceCount: parseInt(row.practice_count || 0)
  }))
},
classroomsAnalytics: {
  summary: {
    total: parseInt(classroomsSummary.rows[0].total),
    available: parseInt(classroomsSummary.rows[0].available),
    unavailable: parseInt(classroomsSummary.rows[0].unavailable)
  }
},
carsAnalytics: {
  summary: {
    total: parseInt(carsSummary.rows[0].total),
    assigned: parseInt(carsSummary.rows[0].assigned),
    unassigned: parseInt(carsSummary.rows[0].unassigned),
    avgYear: parseInt(carsSummary.rows[0].avg_year)
  },
  conditionDistribution: carsConditionDistribution.rows.map(row => ({
    condition: row.condition,
    count: parseInt(row.count)
  })),
  yearDistribution: carsYearDistribution.rows.map(row => ({
    yearRange: row.year_range,
    count: parseInt(row.count)
  })),
  categoryDistribution: carsCategoryDistribution.rows.map(row => ({
    category: row.category,
    count: parseInt(row.count)
  })),
  instructorAssignment: carsInstructorAssignment.rows.map(row => ({
    carId: parseInt(row.car_id),
    licensePlate: row.license_plate,
    brand: row.car_brand_name,
    model: row.car_model_name,
    category: row.car_category_name,
    year: parseInt(row.year_of_manufacture),
    condition: row.car_condition,
    instructorName: row.instructor_name,
    drivingCategory: row.driving_category
  }))
}
    };
    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ 
      message: 'Error fetching analytics data',
      error: error.message 
    });
  }
});

app.put('/api/teacher/update-exam-score/:studentId', async (req, res) => {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    const studentId = parseInt(req.params.studentId);
    const { exam_score } = req.body;
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }
    if (exam_score !== null && exam_score !== undefined) {
      if (typeof exam_score !== 'number' || exam_score < 0 || exam_score > 100) {
        return res.status(400).json({ error: 'Exam score must be a number between 0 and 100, or null to remove' });
      }
    }
    const studentCheckQuery = `
      SELECT student_id 
      FROM students 
      WHERE student_id = $1
    `;
    
    const studentResult = await client.query(studentCheckQuery, [studentId]);
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    let updateQuery;
    let queryParams;
    
    if (exam_score === null || exam_score === undefined) {
      updateQuery = `
        WITH deleted_exam AS (
          DELETE FROM exam_results 
          WHERE exam_result_id = (
            SELECT exam_result_id 
            FROM students 
            WHERE student_id = $1
          )
          RETURNING exam_result_id
        )
        UPDATE students 
        SET exam_result_id = NULL 
        WHERE student_id = $1
        RETURNING student_id
      `;
      queryParams = [studentId];
    } else {
      updateQuery = `
        WITH upsert_exam_result AS (
          INSERT INTO exam_results (exam_score)
          VALUES ($2)
          ON CONFLICT DO NOTHING
          RETURNING exam_result_id
        ),
        get_or_create_exam_result AS (
          SELECT exam_result_id FROM upsert_exam_result
          UNION ALL
          SELECT exam_result_id FROM exam_results WHERE exam_score = $2
          LIMIT 1
        ),
        update_existing_exam AS (
          UPDATE exam_results 
          SET exam_score = $2
          WHERE exam_result_id = (
            SELECT exam_result_id 
            FROM students 
            WHERE student_id = $1
          )
          RETURNING exam_result_id
        )
        UPDATE students 
        SET exam_result_id = COALESCE(
          (SELECT exam_result_id FROM update_existing_exam),
          (SELECT exam_result_id FROM get_or_create_exam_result)
        )
        WHERE student_id = $1
        RETURNING student_id
      `;
      queryParams = [studentId, exam_score];
    }
    
    const result = await client.query(updateQuery, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update exam score' });
    }
    res.json({ 
      success: true, 
      message: exam_score === null ? 'Exam score removed successfully' : 'Exam score updated successfully',
      student_id: studentId,
      exam_score: exam_score
    });
    
  } catch (error) {
    console.error('Error updating exam score:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    await client.end();
  }
});

app.put('/api/instructor/lessons/:lessonId/status', checkRoleAccess(['instructor']), async (req, res) => {
  const { lessonId } = req.params;
  const { statusId } = req.body;
  
  try {
    const checkLessonQuery = `
      SELECT il.lesson_id, il.instructor_id, l.lesson_status_id 
      FROM individual_lessons il
      JOIN lessons l ON il.lesson_id = l.lesson_id
      WHERE il.lesson_id = $1
    `;
    
    const checkResult = await req.pool.query(checkLessonQuery, [lessonId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found or not accessible' });
    }
    
    const checkStatusQuery = `
      SELECT lesson_status_id FROM lesson_statuses WHERE lesson_status_id = $1
    `;
    
    const statusResult = await req.pool.query(checkStatusQuery, [statusId]);
    
    if (statusResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid lesson status' });
    }
    
    const updateQuery = `
      UPDATE lessons 
      SET lesson_status_id = $1 
      WHERE lesson_id = $2
      RETURNING lesson_id, lesson_status_id
    `;
    
    const result = await req.pool.query(updateQuery, [statusId, lessonId]);
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update lesson status' });
    }
    
    res.json({ 
      message: 'Lesson status updated successfully', 
      lesson: result.rows[0] 
    });
    
  } catch (error) {
    console.error('Error updating lesson status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/instructor/lesson_statuses', checkRoleAccess(['instructor']), async (req, res) => {
  try {
    const query = `
      SELECT lesson_status_id, lesson_status 
      FROM lesson_statuses 
      ORDER BY lesson_status_id
    `;
    
    const result = await req.pool.query(query);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching lesson statuses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});