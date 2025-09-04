--
-- PostgreSQL database dump
--

-- Dumped from database version 17rc1
-- Dumped by pg_dump version 17rc1

-- Started on 2025-07-05 20:03:59

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 341 (class 1255 OID 33469)
-- Name: auto_update_application_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_update_application_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    approved_status_id INTEGER;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.application_id IS NOT NULL THEN
        -- Знаходимо ID статусу "Approved" або "Схвалено"
        SELECT application_status_id INTO approved_status_id
        FROM application_statuses
        WHERE LOWER(application_status) IN ('approved', 'схвалено')
        LIMIT 1;
        
        -- Якщо статус знайдено, оновлюємо заявку
        IF approved_status_id IS NOT NULL THEN
            UPDATE applications 
            SET application_status_id = approved_status_id,
                approval_date = CURRENT_DATE
            WHERE application_id = NEW.application_id
              AND approval_date IS NULL; -- тільки якщо ще не схвалено
            
            RAISE NOTICE 'Application % automatically approved for student %', 
                NEW.application_id, NEW.student_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_update_application_status() OWNER TO postgres;

--
-- TOC entry 344 (class 1255 OID 33471)
-- Name: check_car_assignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_car_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    car_info TEXT;
    instructor_name TEXT;
BEGIN
    IF NEW.car_id IS NOT NULL THEN
        IF TG_OP = 'UPDATE' THEN
            IF EXISTS (
                SELECT 1 
                FROM instructors 
                WHERE car_id = NEW.car_id 
                  AND instructor_id != NEW.instructor_id
            ) THEN
                SELECT 
                    cb.car_brand_name || ' ' || cm.car_model_name || ' (' || c.license_plate || ')',
                    p.first_name || ' ' || p.last_name
                INTO car_info, instructor_name
                FROM cars c
                JOIN car_models cm ON c.car_model_id = cm.car_model_id
                JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
                JOIN instructors i ON i.car_id = c.car_id
                JOIN persons p ON i.person_id = p.person_id
                WHERE c.car_id = NEW.car_id 
                  AND i.instructor_id != NEW.instructor_id;
                
                RAISE EXCEPTION 'Car % is already assigned to instructor %', car_info, instructor_name;
            END IF;
        ELSIF TG_OP = 'INSERT' THEN
            IF EXISTS (
                SELECT 1 
                FROM instructors 
                WHERE car_id = NEW.car_id
            ) THEN
                SELECT 
                    cb.car_brand_name || ' ' || cm.car_model_name || ' (' || c.license_plate || ')',
                    p.first_name || ' ' || p.last_name
                INTO car_info, instructor_name
                FROM cars c
                JOIN car_models cm ON c.car_model_id = cm.car_model_id
                JOIN car_brands cb ON cm.car_brand_id = cb.car_brand_id
                JOIN instructors i ON i.car_id = c.car_id
                JOIN persons p ON i.person_id = p.person_id
                WHERE c.car_id = NEW.car_id;
                
                RAISE EXCEPTION 'Car % is already assigned to instructor %', car_info, instructor_name;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_car_assignment() OWNER TO postgres;

--
-- TOC entry 346 (class 1255 OID 34006)
-- Name: delete_exam_location_on_exam_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_exam_location_on_exam_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Видаляємо exam_location, що був пов'язаний з видаленим exam
    DELETE FROM public.exam_locations 
    WHERE exam_location_id = OLD.exam_location_id;
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION public.delete_exam_location_on_exam_delete() OWNER TO postgres;

--
-- TOC entry 355 (class 1255 OID 33999)
-- Name: delete_unused_model_and_brand(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_unused_model_and_brand() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_model_id INTEGER := OLD.car_model_id;
    v_brand_id INTEGER;
BEGIN
    -- Отримати brand_id цієї моделі
    SELECT car_brand_id INTO v_brand_id 
    FROM car_models 
    WHERE car_model_id = v_model_id;

    -- Якщо більше немає машин з цією моделлю
    IF NOT EXISTS (
        SELECT 1 FROM cars WHERE car_model_id = v_model_id
    ) THEN
        -- Видалити модель
        DELETE FROM car_models WHERE car_model_id = v_model_id;

        -- Якщо більше немає моделей з цим брендом
        IF NOT EXISTS (
            SELECT 1 FROM car_models WHERE car_brand_id = v_brand_id
        ) THEN
            -- Видалити бренд
            DELETE FROM car_brands WHERE car_brand_id = v_brand_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.delete_unused_model_and_brand() OWNER TO postgres;

--
-- TOC entry 345 (class 1255 OID 33741)
-- Name: f_authenticate_user(character varying, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_authenticate_user(p_username character varying, p_password character varying) RETURNS TABLE(login character varying, role character varying, db_username character varying, db_role character varying, first_name character varying, last_name character varying, email character varying, phone character varying, experience_years integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    user_record RECORD;
    v_first_name VARCHAR(50);
    v_last_name VARCHAR(50);
    v_email VARCHAR(100);
    v_phone VARCHAR(20);
    v_experience_years INTEGER;
BEGIN
    SELECT 
        su.login,
        sur.system_user_role,
        su.db_username,
        su.db_role
    INTO user_record
    FROM public.system_users su
    JOIN public.system_users_roles sur ON su.system_user_role_id = sur.system_user_role_id
    WHERE su.login = p_username AND su.password = p_password;
    
    IF user_record.login IS NULL THEN
        RETURN;
    END IF;
    
    v_first_name := NULL;
    v_last_name := NULL;
    v_email := NULL;
    v_phone := NULL;
    v_experience_years := NULL;
    
    IF user_record.system_user_role = 'TEACHER' THEN
        SELECT p.first_name, p.last_name, p.email, p.phone
        INTO v_first_name, v_last_name, v_email, v_phone
        FROM public.teachers t
        JOIN public.persons p ON p.person_id = t.person_id
        WHERE t.login = p_username;
        
    ELSIF user_record.system_user_role = 'INSTRUCTOR' THEN
        SELECT p.first_name, p.last_name, p.email, p.phone, i.experience_years
        INTO v_first_name, v_last_name, v_email, v_phone, v_experience_years
        FROM public.instructors i
        JOIN public.persons p ON p.person_id = i.person_id
        WHERE i.login = p_username;
    END IF;
    
    RETURN QUERY SELECT 
        user_record.login,
        user_record.system_user_role,
        user_record.db_username,
        user_record.db_role,
        v_first_name,
        v_last_name,
        v_email,
        v_phone,
        v_experience_years;
END;
$$;


ALTER FUNCTION public.f_authenticate_user(p_username character varying, p_password character varying) OWNER TO postgres;

--
-- TOC entry 353 (class 1255 OID 33892)
-- Name: f_create_student(character varying, character varying, date, character varying, character varying, character varying, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_create_student(p_first_name character varying, p_last_name character varying, p_birth_date date, p_email character varying, p_phone character varying, p_tin character varying, p_application_id integer, p_group_id integer DEFAULT NULL::integer, p_instructor_id integer DEFAULT NULL::integer) RETURNS TABLE(success boolean, student_id integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_person_id integer;
    v_student_id integer;
BEGIN
    -- Create person record
    INSERT INTO public.persons (first_name, last_name, birth_date, email, phone, "TIN")
    VALUES (p_first_name, p_last_name, p_birth_date, p_email, p_phone, p_tin)
    RETURNING person_id INTO v_person_id;
    
    -- Create student record
    INSERT INTO public.students (person_id, application_id)
    VALUES (v_person_id, p_application_id)
    RETURNING students.student_id INTO v_student_id;
    
    -- Associate with group if provided
    IF p_group_id IS NOT NULL THEN
        INSERT INTO public.students_with_group (student_id, group_id)
        VALUES (v_student_id, p_group_id);
    END IF;
    
    -- Associate with instructor if provided
    IF p_instructor_id IS NOT NULL THEN
        INSERT INTO public.students_with_instructor (student_id, instructor_id)
        VALUES (v_student_id, p_instructor_id);
    END IF;
    
    RETURN QUERY SELECT true, v_student_id;
END;
$$;


ALTER FUNCTION public.f_create_student(p_first_name character varying, p_last_name character varying, p_birth_date date, p_email character varying, p_phone character varying, p_tin character varying, p_application_id integer, p_group_id integer, p_instructor_id integer) OWNER TO postgres;

--
-- TOC entry 352 (class 1255 OID 33893)
-- Name: f_delete_application(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_delete_application(p_application_id integer) RETURNS boolean
    LANGUAGE sql
    AS $$
    DELETE FROM public.applications WHERE application_id = p_application_id;
    SELECT true;
$$;


ALTER FUNCTION public.f_delete_application(p_application_id integer) OWNER TO postgres;

--
-- TOC entry 347 (class 1255 OID 33887)
-- Name: f_get_all_applications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_get_all_applications() RETURNS TABLE(id integer, first_name character varying, last_name character varying, birth_date date, email character varying, phone character varying, "TIN" character varying, submission_date date, approval_date date, study_category character varying, status character varying)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM v_applications_full;
$$;


ALTER FUNCTION public.f_get_all_applications() OWNER TO postgres;

--
-- TOC entry 348 (class 1255 OID 33888)
-- Name: f_get_all_groups(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_get_all_groups() RETURNS TABLE(id integer, name character varying)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM v_groups;
$$;


ALTER FUNCTION public.f_get_all_groups() OWNER TO postgres;

--
-- TOC entry 349 (class 1255 OID 33889)
-- Name: f_get_all_instructors(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_get_all_instructors() RETURNS TABLE(id integer, first_name character varying, last_name character varying)
    LANGUAGE sql STABLE
    AS $$
    SELECT * FROM v_instructors;
$$;


ALTER FUNCTION public.f_get_all_instructors() OWNER TO postgres;

--
-- TOC entry 350 (class 1255 OID 33890)
-- Name: f_get_status_id(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_get_status_id(p_status character varying) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT application_status_id 
    FROM public.application_statuses 
    WHERE application_status = p_status;
$$;


ALTER FUNCTION public.f_get_status_id(p_status character varying) OWNER TO postgres;

--
-- TOC entry 351 (class 1255 OID 33891)
-- Name: f_update_application_status(integer, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_update_application_status(p_application_id integer, p_status character varying) RETURNS TABLE(id integer, first_name character varying, last_name character varying, birth_date date, email character varying, phone character varying, "TIN" character varying, submission_date date, approval_date date, study_category character varying, status character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status_id integer;
    v_approval_date date;
BEGIN
    -- Get status ID
    v_status_id := f_get_status_id(p_status);
    
    -- Set approval date if status is 'Approved'
    v_approval_date := CASE WHEN p_status = 'Approved' THEN CURRENT_DATE ELSE NULL END;
    
    -- Update application
    UPDATE public.applications 
    SET 
        application_status_id = v_status_id,
        approval_date = v_approval_date
    WHERE application_id = p_application_id;
    
    -- Return updated application data
    RETURN QUERY
    SELECT * FROM v_applications_full 
    WHERE v_applications_full.id = p_application_id;
END;
$$;


ALTER FUNCTION public.f_update_application_status(p_application_id integer, p_status character varying) OWNER TO postgres;

--
-- TOC entry 323 (class 1255 OID 33412)
-- Name: update_group_current_students(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_group_current_students() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE groups 
        SET current_students = (
            SELECT COUNT(*) 
            FROM students_with_group 
            WHERE group_id = NEW.group_id
        )
        WHERE group_id = NEW.group_id;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE groups 
        SET current_students = (
            SELECT COUNT(*) 
            FROM students_with_group 
            WHERE group_id = OLD.group_id
        )
        WHERE group_id = OLD.group_id;
        
        RETURN OLD;
    END IF;
    

    IF TG_OP = 'UPDATE' THEN

        IF OLD.group_id != NEW.group_id THEN
            UPDATE groups 
            SET current_students = (
                SELECT COUNT(*) 
                FROM students_with_group 
                WHERE group_id = OLD.group_id
            )
            WHERE group_id = OLD.group_id;
        END IF;
        
        UPDATE groups 
        SET current_students = (
            SELECT COUNT(*) 
            FROM students_with_group 
            WHERE group_id = NEW.group_id
        )
        WHERE group_id = NEW.group_id;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_group_current_students() OWNER TO postgres;

--
-- TOC entry 321 (class 1255 OID 33439)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 322 (class 1255 OID 33447)
-- Name: validate_applicant_age(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_applicant_age() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF EXTRACT(YEAR FROM AGE(NEW.birth_date)) < 16 THEN
        RAISE EXCEPTION 'Applicant must be at least 16 years old. Current age: % years', 
            EXTRACT(YEAR FROM AGE(NEW.birth_date));
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_applicant_age() OWNER TO postgres;

--
-- TOC entry 324 (class 1255 OID 33449)
-- Name: validate_application_logic(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_application_logic() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Перевірка: якщо є approval_date, статус має бути "Approved"
    IF NEW.approval_date IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM application_statuses 
                      WHERE application_status_id = NEW.application_status_id 
                      AND LOWER(application_status) IN ('approved', 'схвалено')) THEN
            RAISE EXCEPTION 'Applications with approval_date must have status "Approved"';
        END IF;
    END IF;
    
    -- Перевірка: submission_date не може бути у майбутньому
    IF NEW.submission_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Submission date cannot be in the future';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_application_logic() OWNER TO postgres;

--
-- TOC entry 325 (class 1255 OID 33451)
-- Name: validate_car_plate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_car_plate() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
    -- Перевірка формату номерного знаку (українські стандарти)
    IF NEW.license_plate !~ '^[A-Z]{2}[0-9]{4}[A-Z]{2}$|^[0-9]{4}[A-Z]{2}$' THEN
        RAISE NOTICE 'License plate format may not match Ukrainian standards: %', NEW.license_plate;
    END IF;
    RETURN NEW;
END;
$_$;


ALTER FUNCTION public.validate_car_plate() OWNER TO postgres;

--
-- TOC entry 342 (class 1255 OID 33465)
-- Name: validate_classroom_availability(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_classroom_availability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    lesson_start TIMESTAMP;
    lesson_end TIMESTAMP;
    conflict_count INTEGER;
    classroom_available BOOLEAN;
BEGIN
    -- Перевіряємо, чи аудиторія взагалі доступна
    SELECT is_available INTO classroom_available
    FROM classrooms
    WHERE classroom_id = NEW.classroom_id;
    
    IF NOT classroom_available THEN
        RAISE EXCEPTION 'Classroom is not available for booking';
    END IF;
    
    -- Отримуємо час уроку
    SELECT start_time, end_time INTO lesson_start, lesson_end
    FROM lessons
    WHERE lesson_id = NEW.lesson_id;
    
    -- Перевіряємо конфлікти аудиторії
    SELECT COUNT(*) INTO conflict_count
    FROM group_lessons gl
    JOIN lessons l ON gl.lesson_id = l.lesson_id
    WHERE gl.classroom_id = NEW.classroom_id
    AND gl.lesson_id != NEW.lesson_id
    AND ((l.start_time <= lesson_start AND l.end_time > lesson_start)
         OR (l.start_time < lesson_end AND l.end_time >= lesson_end)
         OR (l.start_time >= lesson_start AND l.end_time <= lesson_end));
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Classroom is already booked for this time slot';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_classroom_availability() OWNER TO postgres;

--
-- TOC entry 338 (class 1255 OID 33457)
-- Name: validate_exam_schedule(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_exam_schedule() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    duration_minutes INTEGER;
BEGIN
    duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    
    -- Теоретичний іспит: 30-60 хв, практичний: 15-45 хв
    IF NEW.type = 'Theory' THEN
        IF duration_minutes < 30 OR duration_minutes > 60 THEN
            RAISE EXCEPTION 'Theory exam duration must be between 30-60 minutes. Current: % minutes', duration_minutes;
        END IF;
    ELSIF NEW.type = 'Practice' THEN
        IF duration_minutes < 15 OR duration_minutes > 45 THEN
            RAISE EXCEPTION 'Practice exam duration must be between 15-45 minutes. Current: % minutes', duration_minutes;
        END IF;
    END IF;
    
    -- Іспити тільки у робочі дні (понеділок-п'ятниця)
    IF EXTRACT(DOW FROM NEW.start_time) IN (0, 6) THEN
        RAISE EXCEPTION 'Exams can only be scheduled on weekdays (Monday-Friday)';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_exam_schedule() OWNER TO postgres;

--
-- TOC entry 354 (class 1255 OID 33461)
-- Name: validate_group_student_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_group_student_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_count INTEGER;
    max_capacity INTEGER := 30;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Перевіряємо кількість студентів у групі
        SELECT COUNT(*) INTO current_count
        FROM students_with_group
        WHERE group_id = NEW.group_id;
        
        IF current_count > max_capacity THEN
            RAISE EXCEPTION 'Group is full. Maximum capacity: % students', max_capacity;
        END IF;
        
        -- Оновлюємо лічильник у таблиці groups
        UPDATE groups 
        SET current_students = current_count + 1
        WHERE group_id = NEW.group_id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Зменшуємо лічильник у таблиці groups
        UPDATE groups 
        SET current_students = current_students - 1
        WHERE group_id = OLD.group_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_group_student_count() OWNER TO postgres;

--
-- TOC entry 340 (class 1255 OID 33463)
-- Name: validate_individual_lesson_conflicts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_individual_lesson_conflicts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    lesson_start TIMESTAMP;
    lesson_end TIMESTAMP;
    conflict_count INTEGER;
BEGIN
    -- Отримуємо час уроку
    SELECT start_time, end_time INTO lesson_start, lesson_end
    FROM lessons
    WHERE lesson_id = NEW.lesson_id;
    
    -- Перевіряємо конфлікти для інструктора
    SELECT COUNT(*) INTO conflict_count
    FROM individual_lessons il
    JOIN lessons l ON il.lesson_id = l.lesson_id
    WHERE il.instructor_id = NEW.instructor_id
    AND il.lesson_id != NEW.lesson_id
    AND ((l.start_time <= lesson_start AND l.end_time > lesson_start)
         OR (l.start_time < lesson_end AND l.end_time >= lesson_end)
         OR (l.start_time >= lesson_start AND l.end_time <= lesson_end));
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Instructor has conflicting lesson at this time';
    END IF;
    
    -- Перевіряємо конфлікти для студента
    SELECT COUNT(*) INTO conflict_count
    FROM individual_lessons il
    JOIN lessons l ON il.lesson_id = l.lesson_id
    WHERE il.student_id = NEW.student_id
    AND il.lesson_id != NEW.lesson_id
    AND ((l.start_time <= lesson_start AND l.end_time > lesson_start)
         OR (l.start_time < lesson_end AND l.end_time >= lesson_end)
         OR (l.start_time >= lesson_start AND l.end_time <= lesson_end));
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Student has conflicting lesson at this time';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_individual_lesson_conflicts() OWNER TO postgres;

--
-- TOC entry 339 (class 1255 OID 33459)
-- Name: validate_instructor_experience(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_instructor_experience() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    instructor_age INTEGER;
BEGIN
    -- Отримуємо вік інструктора
    SELECT EXTRACT(YEAR FROM AGE(p.birth_date)) 
    INTO instructor_age
    FROM persons p 
    WHERE p.person_id = NEW.person_id;
    
    -- Мінімальний вік для інструктора - 21 рік
    IF instructor_age < 21 THEN
        RAISE EXCEPTION 'Instructor must be at least 21 years old. Current age: % years', instructor_age;
    END IF;
    
    -- Досвід не може перевищувати (вік - 18) років
    IF NEW.experience_years > (instructor_age - 18) THEN
        RAISE EXCEPTION 'Experience years (%) cannot exceed age minus 18 (% years)', 
            NEW.experience_years, (instructor_age - 18);
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_instructor_experience() OWNER TO postgres;

--
-- TOC entry 326 (class 1255 OID 33455)
-- Name: validate_lesson_duration(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_lesson_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    duration_minutes INTEGER;
BEGIN
    duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    
    -- Мінімум 45 хвилин, максимум 3 години
    IF duration_minutes < 45 THEN
        RAISE EXCEPTION 'Lesson duration must be at least 45 minutes. Current: % minutes', duration_minutes;
    END IF;
    
    IF duration_minutes > 180 THEN
        RAISE EXCEPTION 'Lesson duration cannot exceed 3 hours. Current: % minutes', duration_minutes;
    END IF;
    
    -- Перевірка робочого часу (8:00 - 20:00)
    IF EXTRACT(HOUR FROM NEW.start_time) < 8 OR EXTRACT(HOUR FROM NEW.end_time) > 20 THEN
        RAISE EXCEPTION 'Lessons must be scheduled between 8:00 and 20:00';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_lesson_duration() OWNER TO postgres;

--
-- TOC entry 343 (class 1255 OID 33467)
-- Name: validate_password_strength(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_password_strength() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Перевірка на наявність цифр та літер
    IF NEW.password !~ '[0-9]' THEN
        RAISE EXCEPTION 'Password must contain at least one digit';
    END IF;
    
    IF NEW.password !~ '[A-Za-z]' THEN
        RAISE EXCEPTION 'Password must contain at least one letter';
    END IF;
    
    -- Перевірка на слабкі паролі
    IF LOWER(NEW.password) IN ('password', '123456', 'qwerty', 'admin', 'user') THEN
        RAISE EXCEPTION 'Password is too weak. Please choose a stronger password';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_password_strength() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 32300)
-- Name: applicants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applicants (
    applicant_id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    birth_date date NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    "TIN" character varying(20) NOT NULL,
    CONSTRAINT "applicants_TIN_check" CHECK ((("TIN")::text ~ '^[0-9A-Za-z]{8,20}$'::text)),
    CONSTRAINT applicants_birth_date_check CHECK ((birth_date <= CURRENT_DATE)),
    CONSTRAINT applicants_email_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT applicants_first_name_check CHECK ((length((first_name)::text) >= 2)),
    CONSTRAINT applicants_last_name_check CHECK ((length((last_name)::text) >= 2)),
    CONSTRAINT applicants_phone_check CHECK (((phone)::text ~ '^\+?[0-9]{9,15}$'::text))
);


ALTER TABLE public.applicants OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 32299)
-- Name: applicants_applicant_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.applicants_applicant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.applicants_applicant_id_seq OWNER TO postgres;

--
-- TOC entry 5548 (class 0 OID 0)
-- Dependencies: 222
-- Name: applicants_applicant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applicants_applicant_id_seq OWNED BY public.applicants.applicant_id;


--
-- TOC entry 227 (class 1259 OID 32326)
-- Name: application_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_statuses (
    application_status_id integer NOT NULL,
    application_status character varying(20) NOT NULL,
    CONSTRAINT application_statuses_application_status_check CHECK ((length((application_status)::text) >= 3))
);


ALTER TABLE public.application_statuses OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 32325)
-- Name: application_statuses_application_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.application_statuses_application_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.application_statuses_application_status_id_seq OWNER TO postgres;

--
-- TOC entry 5551 (class 0 OID 0)
-- Dependencies: 226
-- Name: application_statuses_application_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.application_statuses_application_status_id_seq OWNED BY public.application_statuses.application_status_id;


--
-- TOC entry 268 (class 1259 OID 32832)
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    application_id integer NOT NULL,
    applicant_id integer NOT NULL,
    study_category_id integer NOT NULL,
    application_status_id integer NOT NULL,
    submission_date date NOT NULL,
    approval_date date,
    CONSTRAINT applications_check CHECK (((approval_date IS NULL) OR (approval_date >= submission_date)))
);


ALTER TABLE public.applications OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 32831)
-- Name: applications_application_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.applications_application_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.applications_application_id_seq OWNER TO postgres;

--
-- TOC entry 5554 (class 0 OID 0)
-- Dependencies: 267
-- Name: applications_application_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applications_application_id_seq OWNED BY public.applications.application_id;


--
-- TOC entry 237 (class 1259 OID 32387)
-- Name: car_brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_brands (
    car_brand_id integer NOT NULL,
    car_brand_name character varying(50) NOT NULL,
    CONSTRAINT brands_brand_name_check CHECK ((length((car_brand_name)::text) >= 2))
);


ALTER TABLE public.car_brands OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 32386)
-- Name: brands_brand_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_brand_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_brand_id_seq OWNER TO postgres;

--
-- TOC entry 5557 (class 0 OID 0)
-- Dependencies: 236
-- Name: brands_brand_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_brand_id_seq OWNED BY public.car_brands.car_brand_id;


--
-- TOC entry 235 (class 1259 OID 32377)
-- Name: car_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_categories (
    car_category_id integer NOT NULL,
    car_category_name character varying(20) NOT NULL,
    CONSTRAINT car_categories_car_category_name_check CHECK ((length((car_category_name)::text) >= 1))
);


ALTER TABLE public.car_categories OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 32376)
-- Name: car_categories_car_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_categories_car_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_categories_car_category_id_seq OWNER TO postgres;

--
-- TOC entry 5560 (class 0 OID 0)
-- Dependencies: 234
-- Name: car_categories_car_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_categories_car_category_id_seq OWNED BY public.car_categories.car_category_id;


--
-- TOC entry 241 (class 1259 OID 32407)
-- Name: car_conditions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_conditions (
    car_condition_id integer NOT NULL,
    car_condition character varying(50) NOT NULL,
    CONSTRAINT car_conditions_car_condition_check CHECK ((length((car_condition)::text) >= 3))
);


ALTER TABLE public.car_conditions OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 32406)
-- Name: car_conditions_car_condition_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_conditions_car_condition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_conditions_car_condition_id_seq OWNER TO postgres;

--
-- TOC entry 5563 (class 0 OID 0)
-- Dependencies: 240
-- Name: car_conditions_car_condition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_conditions_car_condition_id_seq OWNED BY public.car_conditions.car_condition_id;


--
-- TOC entry 251 (class 1259 OID 32622)
-- Name: car_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_models (
    car_model_id integer NOT NULL,
    car_brand_id integer NOT NULL,
    car_category_id integer NOT NULL,
    car_model_name character varying(50) NOT NULL,
    CONSTRAINT car_models_car_model_name_check CHECK ((length((car_model_name)::text) >= 2))
);


ALTER TABLE public.car_models OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 32621)
-- Name: car_models_model_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.car_models_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_models_model_id_seq OWNER TO postgres;

--
-- TOC entry 5566 (class 0 OID 0)
-- Dependencies: 250
-- Name: car_models_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.car_models_model_id_seq OWNED BY public.car_models.car_model_id;


--
-- TOC entry 254 (class 1259 OID 32647)
-- Name: cars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cars (
    car_id integer NOT NULL,
    car_model_id integer NOT NULL,
    car_condition_id integer NOT NULL,
    year_of_manufacture integer NOT NULL,
    license_plate character varying(20) NOT NULL,
    CONSTRAINT cars_year_of_manufacture_check CHECK (((year_of_manufacture >= 1980) AND ((year_of_manufacture)::numeric <= EXTRACT(year FROM CURRENT_DATE))))
);


ALTER TABLE public.cars OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 32646)
-- Name: cars_car_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cars_car_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cars_car_id_seq OWNER TO postgres;

--
-- TOC entry 5569 (class 0 OID 0)
-- Dependencies: 253
-- Name: cars_car_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cars_car_id_seq OWNED BY public.cars.car_id;


--
-- TOC entry 314 (class 1259 OID 33713)
-- Name: cars_category_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cars_category_distribution AS
 SELECT cat.car_category_name AS category,
    count(c.car_id) AS count
   FROM ((public.car_categories cat
     LEFT JOIN public.car_models cm ON ((cat.car_category_id = cm.car_category_id)))
     LEFT JOIN public.cars c ON ((cm.car_model_id = c.car_model_id)))
  GROUP BY cat.car_category_id, cat.car_category_name
  ORDER BY (count(c.car_id)) DESC;


ALTER VIEW public.cars_category_distribution OWNER TO postgres;

--
-- TOC entry 312 (class 1259 OID 33705)
-- Name: cars_condition_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cars_condition_distribution AS
 SELECT cc.car_condition AS condition,
    count(c.car_id) AS count
   FROM (public.car_conditions cc
     LEFT JOIN public.cars c ON ((cc.car_condition_id = c.car_condition_id)))
  GROUP BY cc.car_condition_id, cc.car_condition
  ORDER BY (count(c.car_id)) DESC;


ALTER VIEW public.cars_condition_distribution OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 32397)
-- Name: driving_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driving_categories (
    driving_category_id integer NOT NULL,
    driving_category character varying(10) NOT NULL,
    CONSTRAINT driving_categories_driving_category_check CHECK ((length((driving_category)::text) >= 1))
);


ALTER TABLE public.driving_categories OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 32667)
-- Name: instructors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instructors (
    instructor_id integer NOT NULL,
    car_id integer,
    login character varying(50) NOT NULL,
    driving_category_id integer NOT NULL,
    person_id integer NOT NULL,
    experience_years integer NOT NULL,
    CONSTRAINT instructors_experience_years_check CHECK ((experience_years > 0))
);


ALTER TABLE public.instructors OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 32357)
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    person_id integer NOT NULL,
    "TIN" character varying(20) NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    birth_date date NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    CONSTRAINT persons_birth_date_check CHECK ((birth_date <= CURRENT_DATE)),
    CONSTRAINT persons_email_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT persons_first_name_check CHECK (((length((first_name)::text) >= 2) AND ((first_name)::text ~* '^[A-Za-zА-Яа-яЇїІіЄєҐґ]+$'::text))),
    CONSTRAINT persons_last_name_check CHECK (((length((last_name)::text) >= 2) AND ((last_name)::text ~* '^[A-Za-zА-Яа-яЇїІіЄєҐґ]+$'::text))),
    CONSTRAINT persons_phone_check CHECK (((phone)::text ~ '^\+?[0-9]{9,15}$'::text)),
    CONSTRAINT persons_tin_check CHECK ((("TIN")::text ~ '^[0-9]{10}$'::text))
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 33717)
-- Name: cars_instructor_assignment; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cars_instructor_assignment AS
 SELECT c.car_id,
    c.license_plate,
    cb.car_brand_name,
    cm.car_model_name,
    cat.car_category_name,
    c.year_of_manufacture,
    cc.car_condition,
        CASE
            WHEN (i.instructor_id IS NOT NULL) THEN concat(p.first_name, ' ', p.last_name)
            ELSE 'Unassigned'::text
        END AS instructor_name,
        CASE
            WHEN (i.instructor_id IS NOT NULL) THEN dc.driving_category
            ELSE NULL::character varying
        END AS driving_category
   FROM (((((((public.cars c
     JOIN public.car_models cm ON ((c.car_model_id = cm.car_model_id)))
     JOIN public.car_brands cb ON ((cm.car_brand_id = cb.car_brand_id)))
     JOIN public.car_categories cat ON ((cm.car_category_id = cat.car_category_id)))
     JOIN public.car_conditions cc ON ((c.car_condition_id = cc.car_condition_id)))
     LEFT JOIN public.instructors i ON ((c.car_id = i.car_id)))
     LEFT JOIN public.persons p ON ((i.person_id = p.person_id)))
     LEFT JOIN public.driving_categories dc ON ((i.driving_category_id = dc.driving_category_id)))
  ORDER BY
        CASE
            WHEN (i.instructor_id IS NOT NULL) THEN concat(p.first_name, ' ', p.last_name)
            ELSE 'Unassigned'::text
        END, c.license_plate;


ALTER VIEW public.cars_instructor_assignment OWNER TO postgres;

--
-- TOC entry 316 (class 1259 OID 33722)
-- Name: cars_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cars_summary AS
 SELECT count(*) AS total,
    count(
        CASE
            WHEN (i.instructor_id IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS assigned,
    count(
        CASE
            WHEN (i.instructor_id IS NULL) THEN 1
            ELSE NULL::integer
        END) AS unassigned,
    round(avg(c.year_of_manufacture), 0) AS avg_year
   FROM (public.cars c
     LEFT JOIN public.instructors i ON ((c.car_id = i.car_id)));


ALTER VIEW public.cars_summary OWNER TO postgres;

--
-- TOC entry 313 (class 1259 OID 33709)
-- Name: cars_year_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cars_year_distribution AS
 SELECT
        CASE
            WHEN (year_of_manufacture >= 2020) THEN '2020+'::text
            WHEN (year_of_manufacture >= 2015) THEN '2015-2019'::text
            WHEN (year_of_manufacture >= 2010) THEN '2010-2014'::text
            WHEN (year_of_manufacture >= 2005) THEN '2005-2009'::text
            ELSE 'Before 2005'::text
        END AS year_range,
    count(*) AS count
   FROM public.cars
  GROUP BY
        CASE
            WHEN (year_of_manufacture >= 2020) THEN '2020+'::text
            WHEN (year_of_manufacture >= 2015) THEN '2015-2019'::text
            WHEN (year_of_manufacture >= 2010) THEN '2010-2014'::text
            WHEN (year_of_manufacture >= 2005) THEN '2005-2009'::text
            ELSE 'Before 2005'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.cars_year_distribution OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 32427)
-- Name: classrooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classrooms (
    classroom_id integer NOT NULL,
    name character varying(50) NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    CONSTRAINT classrooms_name_check CHECK ((length((name)::text) >= 2))
);


ALTER TABLE public.classrooms OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 32426)
-- Name: classrooms_classroom_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classrooms_classroom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classrooms_classroom_id_seq OWNER TO postgres;

--
-- TOC entry 5580 (class 0 OID 0)
-- Dependencies: 242
-- Name: classrooms_classroom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classrooms_classroom_id_seq OWNED BY public.classrooms.classroom_id;


--
-- TOC entry 311 (class 1259 OID 33701)
-- Name: classrooms_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.classrooms_summary AS
 SELECT count(*) AS total,
    count(
        CASE
            WHEN (is_available = true) THEN 1
            ELSE NULL::integer
        END) AS available,
    count(
        CASE
            WHEN (is_available = false) THEN 1
            ELSE NULL::integer
        END) AS unavailable
   FROM public.classrooms;


ALTER VIEW public.classrooms_summary OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 32396)
-- Name: driving_categories_driving_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.driving_categories_driving_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driving_categories_driving_category_id_seq OWNER TO postgres;

--
-- TOC entry 5583 (class 0 OID 0)
-- Dependencies: 238
-- Name: driving_categories_driving_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.driving_categories_driving_category_id_seq OWNED BY public.driving_categories.driving_category_id;


--
-- TOC entry 269 (class 1259 OID 33329)
-- Name: exam_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_locations (
    exam_location_id integer NOT NULL,
    classroom_id integer,
    car_id integer,
    CONSTRAINT exam_locations_check CHECK ((((classroom_id IS NOT NULL) AND (car_id IS NULL)) OR ((classroom_id IS NULL) AND (car_id IS NOT NULL))))
);


ALTER TABLE public.exam_locations OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 32346)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_results (
    exam_result_id integer NOT NULL,
    exam_score numeric(5,2),
    CONSTRAINT exam_results_exam_score_check CHECK (((exam_score >= (0)::numeric) AND (exam_score <= (100)::numeric)))
);


ALTER TABLE public.exam_results OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 32345)
-- Name: exam_results_exam_result_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_results_exam_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_results_exam_result_id_seq OWNER TO postgres;

--
-- TOC entry 5587 (class 0 OID 0)
-- Dependencies: 230
-- Name: exam_results_exam_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_results_exam_result_id_seq OWNED BY public.exam_results.exam_result_id;


--
-- TOC entry 266 (class 1259 OID 32798)
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    type character varying(50) NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    instructor_id integer,
    teacher_id integer,
    exam_location_id integer NOT NULL,
    CONSTRAINT exams_check CHECK ((end_time > start_time)),
    CONSTRAINT exams_examiner_exclusive_check CHECK ((((instructor_id IS NOT NULL) AND (teacher_id IS NULL)) OR ((instructor_id IS NULL) AND (teacher_id IS NOT NULL)))),
    CONSTRAINT exams_type_check CHECK ((length((type)::text) >= 3)),
    CONSTRAINT exams_type_enum_check CHECK (((type)::text = ANY ((ARRAY['Theory'::character varying, 'Practice'::character varying])::text[]))),
    CONSTRAINT exams_type_examiner_match_check CHECK (((((type)::text = 'Theory'::text) AND (teacher_id IS NOT NULL) AND (instructor_id IS NULL)) OR (((type)::text = 'Practice'::text) AND (instructor_id IS NOT NULL) AND (teacher_id IS NULL))))
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- TOC entry 307 (class 1259 OID 33678)
-- Name: exams_by_day_of_week; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_by_day_of_week AS
 SELECT to_char(start_time, 'Day'::text) AS day_name,
    EXTRACT(dow FROM start_time) AS day_number,
    count(*) AS exams
   FROM public.exams
  GROUP BY (EXTRACT(dow FROM start_time)), (to_char(start_time, 'Day'::text))
  ORDER BY (EXTRACT(dow FROM start_time));


ALTER VIEW public.exams_by_day_of_week OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 32797)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_exam_id_seq OWNER TO postgres;

--
-- TOC entry 5591 (class 0 OID 0)
-- Dependencies: 265
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- TOC entry 308 (class 1259 OID 33682)
-- Name: exams_location_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_location_distribution AS
 SELECT
        CASE
            WHEN (cl.name IS NOT NULL) THEN concat('Classroom: ', cl.name)
            WHEN (ca.license_plate IS NOT NULL) THEN concat('Car: ', ca.license_plate)
            ELSE 'Unknown Location'::text
        END AS location_name,
    count(e.exam_id) AS count
   FROM (((public.exams e
     JOIN public.exam_locations el ON ((e.exam_location_id = el.exam_location_id)))
     LEFT JOIN public.classrooms cl ON ((el.classroom_id = cl.classroom_id)))
     LEFT JOIN public.cars ca ON ((el.car_id = ca.car_id)))
  GROUP BY
        CASE
            WHEN (cl.name IS NOT NULL) THEN concat('Classroom: ', cl.name)
            WHEN (ca.license_plate IS NOT NULL) THEN concat('Car: ', ca.license_plate)
            ELSE 'Unknown Location'::text
        END
  ORDER BY (count(e.exam_id)) DESC;


ALTER VIEW public.exams_location_distribution OWNER TO postgres;

--
-- TOC entry 305 (class 1259 OID 33669)
-- Name: exams_monthly_trends; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_monthly_trends AS
 SELECT to_char(date_trunc('month'::text, months.month), 'YYYY-MM'::text) AS month,
    COALESCE(exam_data.exams, (0)::bigint) AS exams
   FROM (( SELECT generate_series((date_trunc('month'::text, (CURRENT_DATE - '11 mons'::interval)))::timestamp with time zone, date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone), '1 mon'::interval) AS month) months
     LEFT JOIN ( SELECT date_trunc('month'::text, exams.start_time) AS month,
            count(*) AS exams
           FROM public.exams
          WHERE (exams.start_time >= (CURRENT_DATE - '11 mons'::interval))
          GROUP BY (date_trunc('month'::text, exams.start_time))) exam_data ON ((months.month = exam_data.month)))
  ORDER BY months.month;


ALTER VIEW public.exams_monthly_trends OWNER TO postgres;

--
-- TOC entry 304 (class 1259 OID 33665)
-- Name: exams_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_summary AS
 SELECT count(*) AS total,
    count(
        CASE
            WHEN ((type)::text = 'Theory'::text) THEN 1
            ELSE NULL::integer
        END) AS theory_exams,
    count(
        CASE
            WHEN ((type)::text = 'Practice'::text) THEN 1
            ELSE NULL::integer
        END) AS practice_exams,
    round(avg((EXTRACT(epoch FROM (end_time - start_time)) / (3600)::numeric)), 1) AS avg_duration_hours
   FROM public.exams;


ALTER VIEW public.exams_summary OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 33674)
-- Name: exams_type_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_type_distribution AS
 SELECT type,
    count(*) AS count
   FROM public.exams
  GROUP BY type
  ORDER BY (count(*)) DESC;


ALTER VIEW public.exams_type_distribution OWNER TO postgres;

--
-- TOC entry 310 (class 1259 OID 33697)
-- Name: exams_utilization; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.exams_utilization AS
 SELECT date(start_time) AS exam_date,
    count(*) AS total_exams,
    count(
        CASE
            WHEN ((type)::text = 'Theory'::text) THEN 1
            ELSE NULL::integer
        END) AS theory_count,
    count(
        CASE
            WHEN ((type)::text = 'Practice'::text) THEN 1
            ELSE NULL::integer
        END) AS practice_count
   FROM public.exams
  WHERE (start_time >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY (date(start_time))
  ORDER BY (date(start_time)) DESC
 LIMIT 30;


ALTER VIEW public.exams_utilization OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 32782)
-- Name: group_lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_lessons (
    lesson_id integer NOT NULL,
    group_id integer NOT NULL,
    classroom_id integer NOT NULL
);


ALTER TABLE public.group_lessons OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 32768)
-- Name: groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.groups (
    group_id integer NOT NULL,
    teacher_id integer NOT NULL,
    name character varying(50) NOT NULL,
    current_students integer NOT NULL,
    CONSTRAINT groups_current_students_check CHECK ((current_students >= 0))
);


ALTER TABLE public.groups OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 32280)
-- Name: lesson_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lesson_statuses (
    lesson_status_id integer NOT NULL,
    lesson_status character varying(20) NOT NULL,
    CONSTRAINT lesson_statuses_lesson_status_check CHECK ((length((lesson_status)::text) >= 3))
);


ALTER TABLE public.lesson_statuses OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 32699)
-- Name: lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lessons (
    lesson_id integer NOT NULL,
    lesson_type_id integer NOT NULL,
    lesson_status_id integer NOT NULL,
    lesson_topic_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    CONSTRAINT lessons_check CHECK ((end_time > start_time))
);


ALTER TABLE public.lessons OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 32747)
-- Name: teachers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teachers (
    teacher_id integer NOT NULL,
    login character varying(50) NOT NULL,
    person_id integer NOT NULL
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- TOC entry 302 (class 1259 OID 33655)
-- Name: group_lessons_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.group_lessons_analysis AS
 SELECT g.name AS group_name,
    concat(p.first_name, ' ', p.last_name) AS teacher_name,
    count(gl.lesson_id) AS total_lessons,
    count(
        CASE
            WHEN ((ls.lesson_status)::text = 'Completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_lessons,
    cl.name AS classroom_name
   FROM ((((((public.groups g
     JOIN public.teachers t ON ((g.teacher_id = t.teacher_id)))
     JOIN public.persons p ON ((t.person_id = p.person_id)))
     LEFT JOIN public.group_lessons gl ON ((g.group_id = gl.group_id)))
     LEFT JOIN public.lessons l ON ((gl.lesson_id = l.lesson_id)))
     LEFT JOIN public.lesson_statuses ls ON ((l.lesson_status_id = ls.lesson_status_id)))
     LEFT JOIN public.classrooms cl ON ((gl.classroom_id = cl.classroom_id)))
  GROUP BY g.group_id, g.name, p.first_name, p.last_name, cl.name
  ORDER BY (count(gl.lesson_id)) DESC;


ALTER VIEW public.group_lessons_analysis OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 32767)
-- Name: groups_group_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.groups_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.groups_group_id_seq OWNER TO postgres;

--
-- TOC entry 5604 (class 0 OID 0)
-- Dependencies: 262
-- Name: groups_group_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.groups_group_id_seq OWNED BY public.groups.group_id;


--
-- TOC entry 248 (class 1259 OID 32466)
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    student_id integer NOT NULL,
    exam_result_id integer,
    application_id integer,
    person_id integer NOT NULL
);


ALTER TABLE public.students OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 32641)
-- Name: students_with_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students_with_group (
    student_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.students_with_group OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 33623)
-- Name: groups_performance; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.groups_performance AS
 SELECT g.name AS group_name,
    g.current_students,
    concat(p.first_name, ' ', p.last_name) AS teacher_name,
    count(DISTINCT swg.student_id) AS enrolled_students,
    count(DISTINCT s.exam_result_id) AS students_with_results,
    COALESCE(round(avg(er.exam_score), 1), (0)::numeric) AS avg_score
   FROM (((((public.groups g
     JOIN public.teachers t ON ((g.teacher_id = t.teacher_id)))
     JOIN public.persons p ON ((t.person_id = p.person_id)))
     LEFT JOIN public.students_with_group swg ON ((g.group_id = swg.group_id)))
     LEFT JOIN public.students s ON ((swg.student_id = s.student_id)))
     LEFT JOIN public.exam_results er ON ((s.exam_result_id = er.exam_result_id)))
  GROUP BY g.group_id, g.name, g.current_students, p.first_name, p.last_name
  ORDER BY COALESCE(round(avg(er.exam_score), 1), (0)::numeric) DESC;


ALTER VIEW public.groups_performance OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 32726)
-- Name: individual_lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.individual_lessons (
    lesson_id integer NOT NULL,
    instructor_id integer NOT NULL,
    student_id integer NOT NULL
);


ALTER TABLE public.individual_lessons OWNER TO postgres;

--
-- TOC entry 303 (class 1259 OID 33660)
-- Name: individual_lessons_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.individual_lessons_analysis AS
 SELECT concat(p.first_name, ' ', p.last_name) AS instructor_name,
    dc.driving_category,
    count(il.lesson_id) AS total_lessons,
    count(
        CASE
            WHEN ((ls.lesson_status)::text = 'Completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_lessons,
    count(DISTINCT il.student_id) AS unique_students
   FROM (((((public.instructors i
     JOIN public.persons p ON ((i.person_id = p.person_id)))
     JOIN public.driving_categories dc ON ((i.driving_category_id = dc.driving_category_id)))
     LEFT JOIN public.individual_lessons il ON ((i.instructor_id = il.instructor_id)))
     LEFT JOIN public.lessons l ON ((il.lesson_id = l.lesson_id)))
     LEFT JOIN public.lesson_statuses ls ON ((l.lesson_status_id = ls.lesson_status_id)))
  GROUP BY i.instructor_id, p.first_name, p.last_name, dc.driving_category
  ORDER BY (count(il.lesson_id)) DESC;


ALTER VIEW public.individual_lessons_analysis OWNER TO postgres;

--
-- TOC entry 291 (class 1259 OID 33604)
-- Name: instructor_age_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructor_age_distribution AS
 SELECT
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (30)::numeric) THEN 'Under 30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (30)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '30-40'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (41)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (50)::numeric)) THEN '41-50'::text
            ELSE 'Over 50'::text
        END AS age_group,
    count(*) AS count
   FROM (public.instructors i
     JOIN public.persons p ON ((i.person_id = p.person_id)))
  GROUP BY
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (30)::numeric) THEN 'Under 30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (30)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '30-40'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (41)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (50)::numeric)) THEN '41-50'::text
            ELSE 'Over 50'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.instructor_age_distribution OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 33600)
-- Name: instructor_car_status; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructor_car_status AS
 SELECT
        CASE
            WHEN (car_id IS NOT NULL) THEN 'With car'::text
            ELSE 'Without car'::text
        END AS car_status,
    count(*) AS count
   FROM public.instructors i
  GROUP BY
        CASE
            WHEN (car_id IS NOT NULL) THEN 'With car'::text
            ELSE 'Without car'::text
        END;


ALTER VIEW public.instructor_car_status OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 33591)
-- Name: instructors_by_category; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructors_by_category AS
 SELECT dc.driving_category,
    count(i.instructor_id) AS count,
    round(avg(i.experience_years), 1) AS avg_experience
   FROM (public.driving_categories dc
     LEFT JOIN public.instructors i ON ((dc.driving_category_id = i.driving_category_id)))
  GROUP BY dc.driving_category_id, dc.driving_category
  ORDER BY (count(i.instructor_id)) DESC;


ALTER VIEW public.instructors_by_category OWNER TO postgres;

--
-- TOC entry 287 (class 1259 OID 33587)
-- Name: instructors_by_experience; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructors_by_experience AS
 SELECT
        CASE
            WHEN (experience_years < 2) THEN 'Under 2 years'::text
            WHEN ((experience_years >= 2) AND (experience_years <= 5)) THEN '2-5 years'::text
            WHEN ((experience_years >= 6) AND (experience_years <= 10)) THEN '6-10 years'::text
            ELSE 'Over 10 years'::text
        END AS experience_range,
    count(*) AS count
   FROM public.instructors
  GROUP BY
        CASE
            WHEN (experience_years < 2) THEN 'Under 2 years'::text
            WHEN ((experience_years >= 2) AND (experience_years <= 5)) THEN '2-5 years'::text
            WHEN ((experience_years >= 6) AND (experience_years <= 10)) THEN '6-10 years'::text
            ELSE 'Over 10 years'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.instructors_by_experience OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 32666)
-- Name: instructors_instructor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.instructors_instructor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.instructors_instructor_id_seq OWNER TO postgres;

--
-- TOC entry 5615 (class 0 OID 0)
-- Dependencies: 255
-- Name: instructors_instructor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.instructors_instructor_id_seq OWNED BY public.instructors.instructor_id;


--
-- TOC entry 286 (class 1259 OID 33583)
-- Name: instructors_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructors_summary AS
 SELECT count(*) AS total,
    round(avg(experience_years), 1) AS avg_experience,
    count(car_id) AS with_cars,
    (count(*) - count(car_id)) AS without_cars
   FROM public.instructors;


ALTER VIEW public.instructors_summary OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 32616)
-- Name: students_with_instructor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students_with_instructor (
    student_id integer NOT NULL,
    instructor_id integer NOT NULL
);


ALTER TABLE public.students_with_instructor OWNER TO postgres;

--
-- TOC entry 289 (class 1259 OID 33595)
-- Name: instructors_workload; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.instructors_workload AS
 SELECT concat(p.first_name, ' ', p.last_name) AS instructor_name,
    dc.driving_category,
    i.experience_years,
    count(DISTINCT swi.student_id) AS total_students,
    count(DISTINCT il.lesson_id) AS total_lessons,
    count(DISTINCT e.exam_id) AS total_exams
   FROM (((((public.instructors i
     JOIN public.persons p ON ((i.person_id = p.person_id)))
     JOIN public.driving_categories dc ON ((i.driving_category_id = dc.driving_category_id)))
     LEFT JOIN public.students_with_instructor swi ON ((i.instructor_id = swi.instructor_id)))
     LEFT JOIN public.individual_lessons il ON ((i.instructor_id = il.instructor_id)))
     LEFT JOIN public.exams e ON ((i.instructor_id = e.instructor_id)))
  GROUP BY i.instructor_id, p.first_name, p.last_name, dc.driving_category, i.experience_years
  ORDER BY (count(DISTINCT swi.student_id)) DESC;


ALTER VIEW public.instructors_workload OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 32201)
-- Name: lesson_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lesson_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_id_seq OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 32279)
-- Name: lesson_statuses_lesson_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lesson_statuses_lesson_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_statuses_lesson_status_id_seq OWNER TO postgres;

--
-- TOC entry 5621 (class 0 OID 0)
-- Dependencies: 218
-- Name: lesson_statuses_lesson_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lesson_statuses_lesson_status_id_seq OWNED BY public.lesson_statuses.lesson_status_id;


--
-- TOC entry 221 (class 1259 OID 32290)
-- Name: lesson_topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lesson_topics (
    lesson_topic_id integer NOT NULL,
    lesson_topic character varying(100) NOT NULL,
    CONSTRAINT lesson_topics_lesson_topic_check CHECK ((length((lesson_topic)::text) >= 3))
);


ALTER TABLE public.lesson_topics OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 32289)
-- Name: lesson_topics_lesson_topic_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lesson_topics_lesson_topic_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_topics_lesson_topic_id_seq OWNER TO postgres;

--
-- TOC entry 5624 (class 0 OID 0)
-- Dependencies: 220
-- Name: lesson_topics_lesson_topic_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lesson_topics_lesson_topic_id_seq OWNED BY public.lesson_topics.lesson_topic_id;


--
-- TOC entry 229 (class 1259 OID 32336)
-- Name: lesson_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lesson_types (
    lesson_type_id integer NOT NULL,
    lesson_type character varying(20) NOT NULL,
    CONSTRAINT lesson_types_lesson_type_check CHECK ((length((lesson_type)::text) >= 3))
);


ALTER TABLE public.lesson_types OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 32335)
-- Name: lesson_types_lesson_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lesson_types_lesson_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_types_lesson_type_id_seq OWNER TO postgres;

--
-- TOC entry 5627 (class 0 OID 0)
-- Dependencies: 228
-- Name: lesson_types_lesson_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lesson_types_lesson_type_id_seq OWNED BY public.lesson_types.lesson_type_id;


--
-- TOC entry 301 (class 1259 OID 33651)
-- Name: lessons_by_day_of_week; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_by_day_of_week AS
 SELECT to_char(start_time, 'Day'::text) AS day_name,
    EXTRACT(dow FROM start_time) AS day_number,
    count(*) AS lessons
   FROM public.lessons
  GROUP BY (EXTRACT(dow FROM start_time)), (to_char(start_time, 'Day'::text))
  ORDER BY (EXTRACT(dow FROM start_time));


ALTER VIEW public.lessons_by_day_of_week OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 32698)
-- Name: lessons_lesson_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lessons_lesson_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lessons_lesson_id_seq OWNER TO postgres;

--
-- TOC entry 5630 (class 0 OID 0)
-- Dependencies: 257
-- Name: lessons_lesson_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lessons_lesson_id_seq OWNED BY public.lessons.lesson_id;


--
-- TOC entry 297 (class 1259 OID 33633)
-- Name: lessons_monthly_trends; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_monthly_trends AS
 SELECT to_char(date_trunc('month'::text, months.month), 'YYYY-MM'::text) AS month,
    COALESCE(lesson_data.lessons, (0)::bigint) AS lessons
   FROM (( SELECT generate_series((date_trunc('month'::text, (CURRENT_DATE - '11 mons'::interval)))::timestamp with time zone, date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone), '1 mon'::interval) AS month) months
     LEFT JOIN ( SELECT date_trunc('month'::text, lessons.start_time) AS month,
            count(*) AS lessons
           FROM public.lessons
          WHERE (lessons.start_time >= (CURRENT_DATE - '11 mons'::interval))
          GROUP BY (date_trunc('month'::text, lessons.start_time))) lesson_data ON ((months.month = lesson_data.month)))
  ORDER BY months.month;


ALTER VIEW public.lessons_monthly_trends OWNER TO postgres;

--
-- TOC entry 299 (class 1259 OID 33643)
-- Name: lessons_status_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_status_distribution AS
 SELECT ls.lesson_status AS status,
    count(l.lesson_id) AS count
   FROM (public.lesson_statuses ls
     LEFT JOIN public.lessons l ON ((ls.lesson_status_id = l.lesson_status_id)))
  GROUP BY ls.lesson_status_id, ls.lesson_status
  ORDER BY (count(l.lesson_id)) DESC;


ALTER VIEW public.lessons_status_distribution OWNER TO postgres;

--
-- TOC entry 296 (class 1259 OID 33628)
-- Name: lessons_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_summary AS
 SELECT count(*) AS total,
    count(
        CASE
            WHEN ((ls.lesson_status)::text = 'Completed'::text) THEN 1
            ELSE NULL::integer
        END) AS completed,
    count(
        CASE
            WHEN ((ls.lesson_status)::text = 'Scheduled'::text) THEN 1
            ELSE NULL::integer
        END) AS scheduled,
    count(
        CASE
            WHEN ((ls.lesson_status)::text = 'Cancelled'::text) THEN 1
            ELSE NULL::integer
        END) AS cancelled
   FROM (public.lessons l
     JOIN public.lesson_statuses ls ON ((l.lesson_status_id = ls.lesson_status_id)));


ALTER VIEW public.lessons_summary OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 33647)
-- Name: lessons_topic_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_topic_distribution AS
 SELECT lto.lesson_topic,
    count(l.lesson_id) AS count
   FROM (public.lesson_topics lto
     LEFT JOIN public.lessons l ON ((lto.lesson_topic_id = l.lesson_topic_id)))
  GROUP BY lto.lesson_topic_id, lto.lesson_topic
  ORDER BY (count(l.lesson_id)) DESC
 LIMIT 10;


ALTER VIEW public.lessons_topic_distribution OWNER TO postgres;

--
-- TOC entry 298 (class 1259 OID 33638)
-- Name: lessons_type_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.lessons_type_distribution AS
 SELECT lt.lesson_type,
    count(l.lesson_id) AS count,
    round(avg((EXTRACT(epoch FROM (l.end_time - l.start_time)) / (3600)::numeric)), 1) AS avg_duration_hours
   FROM (public.lesson_types lt
     LEFT JOIN public.lessons l ON ((lt.lesson_type_id = l.lesson_type_id)))
  GROUP BY lt.lesson_type_id, lt.lesson_type
  ORDER BY (count(l.lesson_id)) DESC;


ALTER VIEW public.lessons_type_distribution OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 33427)
-- Name: pdf_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pdf_files (
    id uuid NOT NULL,
    original_name character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL,
    upload_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pdf_files OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 32356)
-- Name: persons_person_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persons_person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persons_person_id_seq OWNER TO postgres;

--
-- TOC entry 5638 (class 0 OID 0)
-- Dependencies: 232
-- Name: persons_person_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persons_person_id_seq OWNED BY public.persons.person_id;


--
-- TOC entry 309 (class 1259 OID 33692)
-- Name: practice_exams_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.practice_exams_analysis AS
 SELECT concat(p.first_name, ' ', p.last_name) AS instructor_name,
    dc.driving_category,
    count(e.exam_id) AS total_practice_exams,
    ca.license_plate AS car_license_plate,
    concat(cb.car_brand_name, ' ', cm.car_model_name) AS car_info
   FROM (((((((public.instructors i
     JOIN public.persons p ON ((i.person_id = p.person_id)))
     JOIN public.driving_categories dc ON ((i.driving_category_id = dc.driving_category_id)))
     LEFT JOIN public.exams e ON (((i.instructor_id = e.instructor_id) AND ((e.type)::text = 'Practice'::text))))
     LEFT JOIN public.exam_locations el ON ((e.exam_location_id = el.exam_location_id)))
     LEFT JOIN public.cars ca ON ((el.car_id = ca.car_id)))
     LEFT JOIN public.car_models cm ON ((ca.car_model_id = cm.car_model_id)))
     LEFT JOIN public.car_brands cb ON ((cm.car_brand_id = cb.car_brand_id)))
  GROUP BY i.instructor_id, p.first_name, p.last_name, dc.driving_category, ca.license_plate, cb.car_brand_name, cm.car_model_name
  ORDER BY (count(e.exam_id)) DESC;


ALTER VIEW public.practice_exams_analysis OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 32465)
-- Name: students_student_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.students_student_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.students_student_id_seq OWNER TO postgres;

--
-- TOC entry 5641 (class 0 OID 0)
-- Dependencies: 247
-- Name: students_student_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.students_student_id_seq OWNED BY public.students.student_id;


--
-- TOC entry 225 (class 1259 OID 32316)
-- Name: study_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.study_categories (
    study_category_id integer NOT NULL,
    study_category character varying(20) NOT NULL,
    CONSTRAINT study_categories_study_category_check CHECK ((length((study_category)::text) >= 3))
);


ALTER TABLE public.study_categories OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 32315)
-- Name: study_categories_study_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.study_categories_study_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.study_categories_study_category_id_seq OWNER TO postgres;

--
-- TOC entry 5644 (class 0 OID 0)
-- Dependencies: 224
-- Name: study_categories_study_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.study_categories_study_category_id_seq OWNED BY public.study_categories.study_category_id;


--
-- TOC entry 246 (class 1259 OID 32449)
-- Name: system_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_users (
    login character varying(50) NOT NULL,
    system_user_role_id integer NOT NULL,
    password character varying(100) NOT NULL,
    db_username character varying(50),
    db_role character varying(20),
    CONSTRAINT system_users_password_check CHECK ((length((password)::text) >= 4))
);


ALTER TABLE public.system_users OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 32440)
-- Name: system_users_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_users_roles (
    system_user_role_id integer NOT NULL,
    system_user_role character varying(20) NOT NULL,
    CONSTRAINT system_users_roles_system_user_role_check CHECK ((length((system_user_role)::text) >= 3))
);


ALTER TABLE public.system_users_roles OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 32439)
-- Name: system_users_roles_system_user_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_users_roles_system_user_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_users_roles_system_user_role_id_seq OWNER TO postgres;

--
-- TOC entry 5648 (class 0 OID 0)
-- Dependencies: 244
-- Name: system_users_roles_system_user_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_users_roles_system_user_role_id_seq OWNED BY public.system_users_roles.system_user_role_id;


--
-- TOC entry 294 (class 1259 OID 33618)
-- Name: teacher_age_distribution; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.teacher_age_distribution AS
 SELECT
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (30)::numeric) THEN 'Under 30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (30)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '30-40'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (41)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (50)::numeric)) THEN '41-50'::text
            ELSE 'Over 50'::text
        END AS age_group,
    count(*) AS count
   FROM (public.teachers t
     JOIN public.persons p ON ((t.person_id = p.person_id)))
  GROUP BY
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (30)::numeric) THEN 'Under 30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (30)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '30-40'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (41)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (50)::numeric)) THEN '41-50'::text
            ELSE 'Over 50'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.teacher_age_distribution OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 33609)
-- Name: teachers_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.teachers_summary AS
 SELECT count(*) AS total,
    count(DISTINCT g.group_id) AS total_groups,
    round(avg(g.current_students), 1) AS avg_students_per_group
   FROM (public.teachers t
     LEFT JOIN public.groups g ON ((t.teacher_id = g.teacher_id)));


ALTER VIEW public.teachers_summary OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 32746)
-- Name: teachers_teacher_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.teachers_teacher_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teachers_teacher_id_seq OWNER TO postgres;

--
-- TOC entry 5652 (class 0 OID 0)
-- Dependencies: 260
-- Name: teachers_teacher_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.teachers_teacher_id_seq OWNED BY public.teachers.teacher_id;


--
-- TOC entry 293 (class 1259 OID 33613)
-- Name: teachers_workload; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.teachers_workload AS
 SELECT concat(p.first_name, ' ', p.last_name) AS teacher_name,
    count(DISTINCT g.group_id) AS total_groups,
    COALESCE(sum(g.current_students), (0)::bigint) AS total_students,
    count(DISTINCT gl.lesson_id) AS total_lessons,
    count(DISTINCT e.exam_id) AS total_exams
   FROM ((((public.teachers t
     JOIN public.persons p ON ((t.person_id = p.person_id)))
     LEFT JOIN public.groups g ON ((t.teacher_id = g.teacher_id)))
     LEFT JOIN public.group_lessons gl ON ((g.group_id = gl.group_id)))
     LEFT JOIN public.exams e ON ((t.teacher_id = e.teacher_id)))
  GROUP BY t.teacher_id, p.first_name, p.last_name
  ORDER BY COALESCE(sum(g.current_students), (0)::bigint) DESC;


ALTER VIEW public.teachers_workload OWNER TO postgres;

--
-- TOC entry 320 (class 1259 OID 33941)
-- Name: theory_exams_analysis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.theory_exams_analysis AS
 SELECT concat(p.first_name, ' ', p.last_name) AS teacher_name,
    count(e.exam_id) AS total_theory_exams,
    cl.name AS classroom_name
   FROM ((((public.teachers t
     JOIN public.persons p ON ((t.person_id = p.person_id)))
     LEFT JOIN public.exams e ON (((t.teacher_id = e.teacher_id) AND ((e.type)::text = 'Theory'::text))))
     LEFT JOIN public.exam_locations el ON ((e.exam_location_id = el.exam_location_id)))
     LEFT JOIN public.classrooms cl ON ((el.classroom_id = cl.classroom_id)))
  GROUP BY t.teacher_id, p.first_name, p.last_name, cl.name
  ORDER BY (count(e.exam_id)) DESC;


ALTER VIEW public.theory_exams_analysis OWNER TO postgres;

--
-- TOC entry 280 (class 1259 OID 33554)
-- Name: v_age_distribution_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_age_distribution_analytics AS
 SELECT
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (20)::numeric) THEN 'Under 20'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (20)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (25)::numeric)) THEN '20-25'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (26)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (35)::numeric)) THEN '26-35'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (36)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (45)::numeric)) THEN '36-45'::text
            ELSE 'Over 45'::text
        END AS name,
    count(*) AS count
   FROM (public.students s
     JOIN public.persons p ON ((s.person_id = p.person_id)))
  GROUP BY
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) < (20)::numeric) THEN 'Under 20'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (20)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (25)::numeric)) THEN '20-25'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (26)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (35)::numeric)) THEN '26-35'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) >= (36)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (p.birth_date)::timestamp with time zone)) <= (45)::numeric)) THEN '36-45'::text
            ELSE 'Over 45'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.v_age_distribution_analytics OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 33500)
-- Name: v_application_demographics_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_application_demographics_analytics AS
 SELECT
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) < (20)::numeric) THEN 'Under 20'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) >= (20)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) <= (30)::numeric)) THEN '20-30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) >= (31)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '31-40'::text
            ELSE 'Over 40'::text
        END AS age_group,
    count(*) AS applications
   FROM (public.applications a
     JOIN public.applicants ap ON ((a.applicant_id = ap.applicant_id)))
  GROUP BY
        CASE
            WHEN (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) < (20)::numeric) THEN 'Under 20'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) >= (20)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) <= (30)::numeric)) THEN '20-30'::text
            WHEN ((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) >= (31)::numeric) AND (EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (ap.birth_date)::timestamp with time zone)) <= (40)::numeric)) THEN '31-40'::text
            ELSE 'Over 40'::text
        END
  ORDER BY (count(*)) DESC;


ALTER VIEW public.v_application_demographics_analytics OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 33473)
-- Name: v_application_status_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_application_status_analytics AS
 SELECT ast.application_status AS status,
    count(a.application_id) AS count
   FROM (public.application_statuses ast
     LEFT JOIN public.applications a ON ((ast.application_status_id = a.application_status_id)))
  GROUP BY ast.application_status_id, ast.application_status
  ORDER BY (count(a.application_id)) DESC;


ALTER VIEW public.v_application_status_analytics OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 33491)
-- Name: v_applications_by_day_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_applications_by_day_analytics AS
 SELECT to_char((submission_date)::timestamp with time zone, 'Day'::text) AS day_name,
    EXTRACT(dow FROM submission_date) AS day_number,
    count(*) AS applications
   FROM public.applications
  GROUP BY (EXTRACT(dow FROM submission_date)), (to_char((submission_date)::timestamp with time zone, 'Day'::text))
  ORDER BY (EXTRACT(dow FROM submission_date));


ALTER VIEW public.v_applications_by_day_analytics OWNER TO postgres;

--
-- TOC entry 317 (class 1259 OID 33874)
-- Name: v_applications_full; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_applications_full AS
 SELECT a.application_id AS id,
    app.first_name,
    app.last_name,
    app.birth_date,
    app.email,
    app.phone,
    app."TIN",
    a.submission_date,
    a.approval_date,
    sc.study_category,
    ast.application_status AS status
   FROM (((public.applications a
     JOIN public.applicants app ON ((a.applicant_id = app.applicant_id)))
     JOIN public.study_categories sc ON ((a.study_category_id = sc.study_category_id)))
     JOIN public.application_statuses ast ON ((a.application_status_id = ast.application_status_id)));


ALTER VIEW public.v_applications_full OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 33486)
-- Name: v_applications_summary_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_applications_summary_analytics AS
 SELECT count(*) AS total,
    count(
        CASE
            WHEN ((ast.application_status)::text = 'Pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending,
    count(
        CASE
            WHEN ((ast.application_status)::text = 'Approved'::text) THEN 1
            ELSE NULL::integer
        END) AS approved,
    count(
        CASE
            WHEN ((ast.application_status)::text = 'Rejected'::text) THEN 1
            ELSE NULL::integer
        END) AS rejected
   FROM (public.applications a
     JOIN public.application_statuses ast ON ((a.application_status_id = ast.application_status_id)));


ALTER VIEW public.v_applications_summary_analytics OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 33482)
-- Name: v_category_distribution_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_category_distribution_analytics AS
 SELECT sc.study_category AS category,
    count(a.application_id) AS count
   FROM (public.study_categories sc
     LEFT JOIN public.applications a ON ((sc.study_category_id = a.study_category_id)))
  GROUP BY sc.study_category_id, sc.study_category
  ORDER BY (count(a.application_id)) DESC;


ALTER VIEW public.v_category_distribution_analytics OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 33573)
-- Name: v_category_performance_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_category_performance_analytics AS
 SELECT sc.study_category,
    count(s.student_id) AS total_students,
    count(s.exam_result_id) AS students_with_results,
    COALESCE(round(avg(er.exam_score), 1), (0)::numeric) AS avg_score,
    count(
        CASE
            WHEN (er.exam_score >= (60)::numeric) THEN 1
            ELSE NULL::integer
        END) AS passed_students
   FROM (((public.study_categories sc
     LEFT JOIN public.applications a ON ((sc.study_category_id = a.study_category_id)))
     LEFT JOIN public.students s ON ((a.application_id = s.application_id)))
     LEFT JOIN public.exam_results er ON ((s.exam_result_id = er.exam_result_id)))
  GROUP BY sc.study_category_id, sc.study_category
  ORDER BY COALESCE(round(avg(er.exam_score), 1), (0)::numeric) DESC;


ALTER VIEW public.v_category_performance_analytics OWNER TO postgres;

--
-- TOC entry 285 (class 1259 OID 33578)
-- Name: v_completion_rate_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_completion_rate_analytics AS
 SELECT to_char(date_trunc('month'::text, (a.approval_date)::timestamp with time zone), 'YYYY-MM'::text) AS approval_month,
    count(s.student_id) AS total_students,
    count(s.exam_result_id) AS completed_exams,
    round((((count(s.exam_result_id))::numeric / (NULLIF(count(s.student_id), 0))::numeric) * (100)::numeric), 1) AS completion_rate
   FROM (public.applications a
     JOIN public.students s ON ((a.application_id = s.application_id)))
  WHERE ((a.approval_date IS NOT NULL) AND (a.approval_date >= (CURRENT_DATE - '1 year'::interval)))
  GROUP BY (date_trunc('month'::text, (a.approval_date)::timestamp with time zone))
  ORDER BY (to_char(date_trunc('month'::text, (a.approval_date)::timestamp with time zone), 'YYYY-MM'::text));


ALTER VIEW public.v_completion_rate_analytics OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 33549)
-- Name: v_exam_results_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_exam_results_analytics AS
 SELECT score_range AS range,
    count(*) AS count
   FROM ( SELECT
                CASE
                    WHEN (er.exam_score >= (90)::numeric) THEN '90-100'::text
                    WHEN (er.exam_score >= (80)::numeric) THEN '80-89'::text
                    WHEN (er.exam_score >= (70)::numeric) THEN '70-79'::text
                    WHEN (er.exam_score >= (60)::numeric) THEN '60-69'::text
                    ELSE 'Below 60'::text
                END AS score_range,
                CASE
                    WHEN (er.exam_score >= (90)::numeric) THEN 1
                    WHEN (er.exam_score >= (80)::numeric) THEN 2
                    WHEN (er.exam_score >= (70)::numeric) THEN 3
                    WHEN (er.exam_score >= (60)::numeric) THEN 4
                    ELSE 5
                END AS sort_order
           FROM (public.exam_results er
             JOIN public.students s ON ((er.exam_result_id = s.exam_result_id)))) scored_results
  GROUP BY score_range, sort_order
  ORDER BY sort_order;


ALTER VIEW public.v_exam_results_analytics OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 33563)
-- Name: v_group_participation_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_group_participation_analytics AS
 SELECT g.name AS group_name,
    g.current_students,
    count(swg.student_id) AS enrolled_students,
    concat(p.first_name, ' ', p.last_name) AS teacher_name
   FROM (((public.groups g
     LEFT JOIN public.students_with_group swg ON ((g.group_id = swg.group_id)))
     JOIN public.teachers t ON ((g.teacher_id = t.teacher_id)))
     JOIN public.persons p ON ((t.person_id = p.person_id)))
  GROUP BY g.group_id, g.name, g.current_students, p.first_name, p.last_name
  ORDER BY (count(swg.student_id)) DESC;


ALTER VIEW public.v_group_participation_analytics OWNER TO postgres;

--
-- TOC entry 318 (class 1259 OID 33879)
-- Name: v_groups; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_groups AS
 SELECT group_id AS id,
    name
   FROM public.groups;


ALTER VIEW public.v_groups OWNER TO postgres;

--
-- TOC entry 283 (class 1259 OID 33568)
-- Name: v_individual_lessons_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_individual_lessons_analytics AS
 SELECT concat(p.first_name, ' ', p.last_name) AS instructor_name,
    dc.driving_category,
    count(DISTINCT swi.student_id) AS students_count
   FROM (((public.instructors i
     JOIN public.persons p ON ((i.person_id = p.person_id)))
     JOIN public.driving_categories dc ON ((i.driving_category_id = dc.driving_category_id)))
     LEFT JOIN public.students_with_instructor swi ON ((i.instructor_id = swi.instructor_id)))
  GROUP BY i.instructor_id, p.first_name, p.last_name, dc.driving_category
  ORDER BY (count(DISTINCT swi.student_id)) DESC;


ALTER VIEW public.v_individual_lessons_analytics OWNER TO postgres;

--
-- TOC entry 319 (class 1259 OID 33883)
-- Name: v_instructors; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_instructors AS
 SELECT i.instructor_id AS id,
    p.first_name,
    p.last_name
   FROM (public.instructors i
     JOIN public.persons p ON ((p.person_id = i.person_id)));


ALTER VIEW public.v_instructors OWNER TO postgres;

--
-- TOC entry 272 (class 1259 OID 33477)
-- Name: v_monthly_applications_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_monthly_applications_analytics AS
 SELECT to_char(date_trunc('month'::text, months.month), 'YYYY-MM'::text) AS month,
    COALESCE(app_data.applications, (0)::bigint) AS applications
   FROM (( SELECT generate_series((date_trunc('month'::text, (CURRENT_DATE - '11 mons'::interval)))::timestamp with time zone, date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone), '1 mon'::interval) AS month) months
     LEFT JOIN ( SELECT date_trunc('month'::text, (applications.submission_date)::timestamp with time zone) AS month,
            count(*) AS applications
           FROM public.applications
          WHERE (applications.submission_date >= (CURRENT_DATE - '11 mons'::interval))
          GROUP BY (date_trunc('month'::text, (applications.submission_date)::timestamp with time zone))) app_data ON ((months.month = app_data.month)))
  ORDER BY months.month;


ALTER VIEW public.v_monthly_applications_analytics OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 33544)
-- Name: v_monthly_students_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_monthly_students_analytics AS
 SELECT to_char(date_trunc('month'::text, months.month), 'YYYY-MM'::text) AS month,
    COALESCE(student_data.students, (0)::bigint) AS students
   FROM (( SELECT generate_series((date_trunc('month'::text, (CURRENT_DATE - '11 mons'::interval)))::timestamp with time zone, date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone), '1 mon'::interval) AS month) months
     LEFT JOIN ( SELECT date_trunc('month'::text, (a.approval_date)::timestamp with time zone) AS month,
            count(DISTINCT s.student_id) AS students
           FROM (public.students s
             LEFT JOIN public.applications a ON ((s.application_id = a.application_id)))
          WHERE ((a.approval_date >= (CURRENT_DATE - '11 mons'::interval)) AND (a.approval_date IS NOT NULL))
          GROUP BY (date_trunc('month'::text, (a.approval_date)::timestamp with time zone))) student_data ON ((months.month = student_data.month)))
  ORDER BY months.month;


ALTER VIEW public.v_monthly_students_analytics OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 33495)
-- Name: v_processing_time_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_processing_time_analytics AS
 SELECT processing_time,
    count(*) AS count,
    round(avg(processing_days), 1) AS avg_days
   FROM ( SELECT
                CASE
                    WHEN ((applications.approval_date - applications.submission_date) <= 7) THEN '1-7 days'::text
                    WHEN ((applications.approval_date - applications.submission_date) <= 14) THEN '8-14 days'::text
                    WHEN ((applications.approval_date - applications.submission_date) <= 30) THEN '15-30 days'::text
                    ELSE 'Over 30 days'::text
                END AS processing_time,
            (applications.approval_date - applications.submission_date) AS processing_days
           FROM public.applications
          WHERE (applications.approval_date IS NOT NULL)) subquery
  GROUP BY processing_time
  ORDER BY
        CASE processing_time
            WHEN '1-7 days'::text THEN 1
            WHEN '8-14 days'::text THEN 2
            WHEN '15-30 days'::text THEN 3
            ELSE 4
        END;


ALTER VIEW public.v_processing_time_analytics OWNER TO postgres;

--
-- TOC entry 281 (class 1259 OID 33559)
-- Name: v_students_summary_analytics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_students_summary_analytics AS
 SELECT count(*) AS total,
    count(s.exam_result_id) AS withresults,
    COALESCE(round(avg(er.exam_score), 1), (0)::numeric) AS averagescore
   FROM (public.students s
     LEFT JOIN public.exam_results er ON ((s.exam_result_id = er.exam_result_id)));


ALTER VIEW public.v_students_summary_analytics OWNER TO postgres;

--
-- TOC entry 5006 (class 2604 OID 32303)
-- Name: applicants applicant_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicants ALTER COLUMN applicant_id SET DEFAULT nextval('public.applicants_applicant_id_seq'::regclass);


--
-- TOC entry 5008 (class 2604 OID 32329)
-- Name: application_statuses application_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_statuses ALTER COLUMN application_status_id SET DEFAULT nextval('public.application_statuses_application_status_id_seq'::regclass);


--
-- TOC entry 5027 (class 2604 OID 32835)
-- Name: applications application_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications ALTER COLUMN application_id SET DEFAULT nextval('public.applications_application_id_seq'::regclass);


--
-- TOC entry 5013 (class 2604 OID 32390)
-- Name: car_brands car_brand_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands ALTER COLUMN car_brand_id SET DEFAULT nextval('public.brands_brand_id_seq'::regclass);


--
-- TOC entry 5012 (class 2604 OID 32380)
-- Name: car_categories car_category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_categories ALTER COLUMN car_category_id SET DEFAULT nextval('public.car_categories_car_category_id_seq'::regclass);


--
-- TOC entry 5015 (class 2604 OID 32410)
-- Name: car_conditions car_condition_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_conditions ALTER COLUMN car_condition_id SET DEFAULT nextval('public.car_conditions_car_condition_id_seq'::regclass);


--
-- TOC entry 5020 (class 2604 OID 32625)
-- Name: car_models car_model_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models ALTER COLUMN car_model_id SET DEFAULT nextval('public.car_models_model_id_seq'::regclass);


--
-- TOC entry 5021 (class 2604 OID 32650)
-- Name: cars car_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars ALTER COLUMN car_id SET DEFAULT nextval('public.cars_car_id_seq'::regclass);


--
-- TOC entry 5016 (class 2604 OID 32430)
-- Name: classrooms classroom_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classrooms ALTER COLUMN classroom_id SET DEFAULT nextval('public.classrooms_classroom_id_seq'::regclass);


--
-- TOC entry 5014 (class 2604 OID 32400)
-- Name: driving_categories driving_category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driving_categories ALTER COLUMN driving_category_id SET DEFAULT nextval('public.driving_categories_driving_category_id_seq'::regclass);


--
-- TOC entry 5010 (class 2604 OID 32349)
-- Name: exam_results exam_result_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN exam_result_id SET DEFAULT nextval('public.exam_results_exam_result_id_seq'::regclass);


--
-- TOC entry 5026 (class 2604 OID 32801)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


--
-- TOC entry 5025 (class 2604 OID 32771)
-- Name: groups group_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups ALTER COLUMN group_id SET DEFAULT nextval('public.groups_group_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 32670)
-- Name: instructors instructor_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors ALTER COLUMN instructor_id SET DEFAULT nextval('public.instructors_instructor_id_seq'::regclass);


--
-- TOC entry 5004 (class 2604 OID 32283)
-- Name: lesson_statuses lesson_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_statuses ALTER COLUMN lesson_status_id SET DEFAULT nextval('public.lesson_statuses_lesson_status_id_seq'::regclass);


--
-- TOC entry 5005 (class 2604 OID 32293)
-- Name: lesson_topics lesson_topic_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_topics ALTER COLUMN lesson_topic_id SET DEFAULT nextval('public.lesson_topics_lesson_topic_id_seq'::regclass);


--
-- TOC entry 5009 (class 2604 OID 32339)
-- Name: lesson_types lesson_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_types ALTER COLUMN lesson_type_id SET DEFAULT nextval('public.lesson_types_lesson_type_id_seq'::regclass);


--
-- TOC entry 5023 (class 2604 OID 32702)
-- Name: lessons lesson_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons ALTER COLUMN lesson_id SET DEFAULT nextval('public.lessons_lesson_id_seq'::regclass);


--
-- TOC entry 5011 (class 2604 OID 32360)
-- Name: persons person_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons ALTER COLUMN person_id SET DEFAULT nextval('public.persons_person_id_seq'::regclass);


--
-- TOC entry 5019 (class 2604 OID 32469)
-- Name: students student_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students ALTER COLUMN student_id SET DEFAULT nextval('public.students_student_id_seq'::regclass);


--
-- TOC entry 5007 (class 2604 OID 32319)
-- Name: study_categories study_category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_categories ALTER COLUMN study_category_id SET DEFAULT nextval('public.study_categories_study_category_id_seq'::regclass);


--
-- TOC entry 5018 (class 2604 OID 32443)
-- Name: system_users_roles system_user_role_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users_roles ALTER COLUMN system_user_role_id SET DEFAULT nextval('public.system_users_roles_system_user_role_id_seq'::regclass);


--
-- TOC entry 5024 (class 2604 OID 32750)
-- Name: teachers teacher_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers ALTER COLUMN teacher_id SET DEFAULT nextval('public.teachers_teacher_id_seq'::regclass);


--
-- TOC entry 5077 (class 2606 OID 33132)
-- Name: applicants applicants_TIN_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT "applicants_TIN_key" UNIQUE ("TIN");


--
-- TOC entry 5079 (class 2606 OID 32354)
-- Name: applicants applicants_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_email_key UNIQUE (email);


--
-- TOC entry 5081 (class 2606 OID 32314)
-- Name: applicants applicants_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_phone_key UNIQUE (phone);


--
-- TOC entry 5083 (class 2606 OID 32310)
-- Name: applicants applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_pkey PRIMARY KEY (applicant_id);


--
-- TOC entry 5094 (class 2606 OID 32334)
-- Name: application_statuses application_statuses_application_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_statuses
    ADD CONSTRAINT application_statuses_application_status_key UNIQUE (application_status);


--
-- TOC entry 5096 (class 2606 OID 32332)
-- Name: application_statuses application_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_statuses
    ADD CONSTRAINT application_statuses_pkey PRIMARY KEY (application_status_id);


--
-- TOC entry 5265 (class 2606 OID 32838)
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (application_id);


--
-- TOC entry 5129 (class 2606 OID 32395)
-- Name: car_brands brands_brand_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands
    ADD CONSTRAINT brands_brand_name_key UNIQUE (car_brand_name);


--
-- TOC entry 5131 (class 2606 OID 32393)
-- Name: car_brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (car_brand_id);


--
-- TOC entry 5125 (class 2606 OID 32385)
-- Name: car_categories car_categories_car_category_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_categories
    ADD CONSTRAINT car_categories_car_category_name_key UNIQUE (car_category_name);


--
-- TOC entry 5127 (class 2606 OID 32383)
-- Name: car_categories car_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_categories
    ADD CONSTRAINT car_categories_pkey PRIMARY KEY (car_category_id);


--
-- TOC entry 5137 (class 2606 OID 32415)
-- Name: car_conditions car_conditions_car_condition_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_conditions
    ADD CONSTRAINT car_conditions_car_condition_key UNIQUE (car_condition);


--
-- TOC entry 5139 (class 2606 OID 32413)
-- Name: car_conditions car_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_conditions
    ADD CONSTRAINT car_conditions_pkey PRIMARY KEY (car_condition_id);


--
-- TOC entry 5174 (class 2606 OID 32630)
-- Name: car_models car_models_car_model_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_car_model_name_key UNIQUE (car_model_name);


--
-- TOC entry 5176 (class 2606 OID 32628)
-- Name: car_models car_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_pkey PRIMARY KEY (car_model_id);


--
-- TOC entry 5190 (class 2606 OID 32655)
-- Name: cars cars_license_plate_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_license_plate_key UNIQUE (license_plate);


--
-- TOC entry 5192 (class 2606 OID 32653)
-- Name: cars cars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (car_id);


--
-- TOC entry 5141 (class 2606 OID 32437)
-- Name: classrooms classrooms_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_name_key UNIQUE (name);


--
-- TOC entry 5143 (class 2606 OID 32435)
-- Name: classrooms classrooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classrooms
    ADD CONSTRAINT classrooms_pkey PRIMARY KEY (classroom_id);


--
-- TOC entry 5133 (class 2606 OID 32405)
-- Name: driving_categories driving_categories_driving_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driving_categories
    ADD CONSTRAINT driving_categories_driving_category_key UNIQUE (driving_category);


--
-- TOC entry 5135 (class 2606 OID 32403)
-- Name: driving_categories driving_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driving_categories
    ADD CONSTRAINT driving_categories_pkey PRIMARY KEY (driving_category_id);


--
-- TOC entry 5282 (class 2606 OID 33334)
-- Name: exam_locations exam_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_locations
    ADD CONSTRAINT exam_locations_pkey PRIMARY KEY (exam_location_id);


--
-- TOC entry 5103 (class 2606 OID 32352)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (exam_result_id);


--
-- TOC entry 5257 (class 2606 OID 32805)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 5252 (class 2606 OID 32786)
-- Name: group_lessons group_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_lessons
    ADD CONSTRAINT group_lessons_pkey PRIMARY KEY (lesson_id);


--
-- TOC entry 5241 (class 2606 OID 32776)
-- Name: groups groups_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_name_key UNIQUE (name);


--
-- TOC entry 5243 (class 2606 OID 32774)
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (group_id);


--
-- TOC entry 5231 (class 2606 OID 32730)
-- Name: individual_lessons individual_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.individual_lessons
    ADD CONSTRAINT individual_lessons_pkey PRIMARY KEY (lesson_id);


--
-- TOC entry 5211 (class 2606 OID 32675)
-- Name: instructors instructors_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_login_key UNIQUE (login);


--
-- TOC entry 5213 (class 2606 OID 32677)
-- Name: instructors instructors_person_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_person_id_key UNIQUE (person_id);


--
-- TOC entry 5215 (class 2606 OID 32673)
-- Name: instructors instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_pkey PRIMARY KEY (instructor_id);


--
-- TOC entry 5069 (class 2606 OID 32288)
-- Name: lesson_statuses lesson_statuses_lesson_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_statuses
    ADD CONSTRAINT lesson_statuses_lesson_status_key UNIQUE (lesson_status);


--
-- TOC entry 5071 (class 2606 OID 32286)
-- Name: lesson_statuses lesson_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_statuses
    ADD CONSTRAINT lesson_statuses_pkey PRIMARY KEY (lesson_status_id);


--
-- TOC entry 5073 (class 2606 OID 32298)
-- Name: lesson_topics lesson_topics_lesson_topic_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_topics
    ADD CONSTRAINT lesson_topics_lesson_topic_key UNIQUE (lesson_topic);


--
-- TOC entry 5075 (class 2606 OID 32296)
-- Name: lesson_topics lesson_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_topics
    ADD CONSTRAINT lesson_topics_pkey PRIMARY KEY (lesson_topic_id);


--
-- TOC entry 5099 (class 2606 OID 32344)
-- Name: lesson_types lesson_types_lesson_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_types
    ADD CONSTRAINT lesson_types_lesson_type_key UNIQUE (lesson_type);


--
-- TOC entry 5101 (class 2606 OID 32342)
-- Name: lesson_types lesson_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lesson_types
    ADD CONSTRAINT lesson_types_pkey PRIMARY KEY (lesson_type_id);


--
-- TOC entry 5225 (class 2606 OID 32705)
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (lesson_id);


--
-- TOC entry 5286 (class 2606 OID 33436)
-- Name: pdf_files pdf_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pdf_files
    ADD CONSTRAINT pdf_files_pkey PRIMARY KEY (id);


--
-- TOC entry 5117 (class 2606 OID 32372)
-- Name: persons persons_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_email_key UNIQUE (email);


--
-- TOC entry 5119 (class 2606 OID 32374)
-- Name: persons persons_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_phone_key UNIQUE (phone);


--
-- TOC entry 5121 (class 2606 OID 32368)
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (person_id);


--
-- TOC entry 5123 (class 2606 OID 32370)
-- Name: persons persons_tin_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_tin_key UNIQUE ("TIN");


--
-- TOC entry 5164 (class 2606 OID 32473)
-- Name: students students_person_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_person_id_key UNIQUE (person_id);


--
-- TOC entry 5166 (class 2606 OID 32471)
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- TOC entry 5188 (class 2606 OID 32645)
-- Name: students_with_group students_with_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_group
    ADD CONSTRAINT students_with_group_pkey PRIMARY KEY (student_id, group_id);


--
-- TOC entry 5172 (class 2606 OID 32620)
-- Name: students_with_instructor students_with_instructor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_instructor
    ADD CONSTRAINT students_with_instructor_pkey PRIMARY KEY (student_id, instructor_id);


--
-- TOC entry 5090 (class 2606 OID 32322)
-- Name: study_categories study_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_categories
    ADD CONSTRAINT study_categories_pkey PRIMARY KEY (study_category_id);


--
-- TOC entry 5092 (class 2606 OID 32324)
-- Name: study_categories study_categories_study_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.study_categories
    ADD CONSTRAINT study_categories_study_category_key UNIQUE (study_category);


--
-- TOC entry 5152 (class 2606 OID 33117)
-- Name: system_users system_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_pkey PRIMARY KEY (login);


--
-- TOC entry 5145 (class 2606 OID 32446)
-- Name: system_users_roles system_users_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users_roles
    ADD CONSTRAINT system_users_roles_pkey PRIMARY KEY (system_user_role_id);


--
-- TOC entry 5147 (class 2606 OID 32448)
-- Name: system_users_roles system_users_roles_system_user_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users_roles
    ADD CONSTRAINT system_users_roles_system_user_role_key UNIQUE (system_user_role);


--
-- TOC entry 5235 (class 2606 OID 32754)
-- Name: teachers teachers_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_login_key UNIQUE (login);


--
-- TOC entry 5237 (class 2606 OID 32756)
-- Name: teachers teachers_person_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_person_id_key UNIQUE (person_id);


--
-- TOC entry 5239 (class 2606 OID 32752)
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (teacher_id);


--
-- TOC entry 5084 (class 1259 OID 32872)
-- Name: idx_applicants_applicant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_applicants_applicant_id ON public.applicants USING btree (applicant_id);


--
-- TOC entry 5085 (class 1259 OID 32869)
-- Name: idx_applicants_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_applicants_email ON public.applicants USING btree (email);


--
-- TOC entry 5086 (class 1259 OID 32871)
-- Name: idx_applicants_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applicants_last_name ON public.applicants USING btree (last_name);


--
-- TOC entry 5087 (class 1259 OID 32903)
-- Name: idx_applicants_names; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applicants_names ON public.applicants USING btree (first_name, last_name);


--
-- TOC entry 5088 (class 1259 OID 32870)
-- Name: idx_applicants_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applicants_phone ON public.applicants USING btree (phone);


--
-- TOC entry 5266 (class 1259 OID 33922)
-- Name: idx_application_date_status_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_application_date_status_composite ON public.applications USING btree (submission_date, application_status_id, study_category_id);


--
-- TOC entry 5267 (class 1259 OID 32874)
-- Name: idx_application_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_application_id ON public.applications USING btree (application_id);


--
-- TOC entry 5097 (class 1259 OID 32873)
-- Name: idx_application_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_application_status_id ON public.application_statuses USING btree (application_status_id);


--
-- TOC entry 5268 (class 1259 OID 33918)
-- Name: idx_applications_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_active ON public.applications USING btree (applicant_id, submission_date) WHERE (application_status_id = ANY (ARRAY[1, 2, 3]));


--
-- TOC entry 5269 (class 1259 OID 32907)
-- Name: idx_applications_applicant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_applicant ON public.applications USING btree (applicant_id);


--
-- TOC entry 5270 (class 1259 OID 32875)
-- Name: idx_applications_applicant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_applicant_id ON public.applications USING btree (applicant_id);


--
-- TOC entry 5271 (class 1259 OID 33901)
-- Name: idx_applications_approval_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_approval_date ON public.applications USING btree (approval_date) WHERE (approval_date IS NOT NULL);


--
-- TOC entry 5272 (class 1259 OID 32905)
-- Name: idx_applications_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_category ON public.applications USING btree (study_category_id);


--
-- TOC entry 5273 (class 1259 OID 33911)
-- Name: idx_applications_created_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_created_updated ON public.applications USING btree (submission_date, approval_date) WHERE (approval_date IS NOT NULL);


--
-- TOC entry 5274 (class 1259 OID 32906)
-- Name: idx_applications_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_dates ON public.applications USING btree (submission_date, approval_date);


--
-- TOC entry 5275 (class 1259 OID 33897)
-- Name: idx_applications_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_full ON public.applications USING btree (submission_date, application_status_id, applicant_id);


--
-- TOC entry 5276 (class 1259 OID 32904)
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_status ON public.applications USING btree (application_status_id);


--
-- TOC entry 5277 (class 1259 OID 33923)
-- Name: idx_applications_status_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_status_date ON public.applications USING btree (application_status_id, submission_date, approval_date);


--
-- TOC entry 5278 (class 1259 OID 32876)
-- Name: idx_applications_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_status_id ON public.applications USING btree (application_status_id);


--
-- TOC entry 5279 (class 1259 OID 33900)
-- Name: idx_applications_status_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_status_submission ON public.applications USING btree (application_status_id, submission_date DESC);


--
-- TOC entry 5280 (class 1259 OID 32877)
-- Name: idx_applications_submission_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_applications_submission_date ON public.applications USING btree (submission_date);


--
-- TOC entry 5193 (class 1259 OID 32881)
-- Name: idx_car_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_car_id ON public.cars USING btree (car_id);


--
-- TOC entry 5177 (class 1259 OID 32940)
-- Name: idx_car_models_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_models_brand ON public.car_models USING btree (car_brand_id);


--
-- TOC entry 5178 (class 1259 OID 33920)
-- Name: idx_car_models_brand_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_models_brand_name ON public.car_models USING btree (car_brand_id, car_model_name);


--
-- TOC entry 5179 (class 1259 OID 32941)
-- Name: idx_car_models_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_models_category ON public.car_models USING btree (car_category_id);


--
-- TOC entry 5180 (class 1259 OID 32942)
-- Name: idx_car_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_models_name ON public.car_models USING btree (car_model_name);


--
-- TOC entry 5181 (class 1259 OID 32883)
-- Name: idx_cars_brand_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_brand_id ON public.car_models USING btree (car_brand_id);


--
-- TOC entry 5194 (class 1259 OID 32937)
-- Name: idx_cars_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_condition ON public.cars USING btree (car_condition_id);


--
-- TOC entry 5195 (class 1259 OID 32939)
-- Name: idx_cars_license; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_license ON public.cars USING btree (license_plate);


--
-- TOC entry 5196 (class 1259 OID 32936)
-- Name: idx_cars_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_model ON public.cars USING btree (car_model_id);


--
-- TOC entry 5197 (class 1259 OID 33928)
-- Name: idx_cars_model_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_model_full ON public.cars USING btree (car_model_id) INCLUDE (car_condition_id, license_plate);


--
-- TOC entry 5198 (class 1259 OID 32882)
-- Name: idx_cars_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_model_id ON public.cars USING btree (car_model_id);


--
-- TOC entry 5199 (class 1259 OID 32938)
-- Name: idx_cars_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cars_year ON public.cars USING btree (year_of_manufacture);


--
-- TOC entry 5258 (class 1259 OID 32886)
-- Name: idx_exam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_exam_id ON public.exams USING btree (exam_id);


--
-- TOC entry 5104 (class 1259 OID 32935)
-- Name: idx_exam_results_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exam_results_score ON public.exam_results USING btree (exam_score);


--
-- TOC entry 5105 (class 1259 OID 33938)
-- Name: idx_exam_results_score_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exam_results_score_composite ON public.exam_results USING btree (exam_score, exam_result_id);


--
-- TOC entry 5106 (class 1259 OID 33903)
-- Name: idx_exam_results_score_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exam_results_score_range ON public.exam_results USING btree (exam_score) WHERE (exam_score >= (50)::numeric);


--
-- TOC entry 5259 (class 1259 OID 33925)
-- Name: idx_exams_date_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_date_location ON public.exams USING btree (exam_location_id, start_time, end_time);


--
-- TOC entry 5260 (class 1259 OID 33931)
-- Name: idx_exams_instructor_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_instructor_full ON public.exams USING btree (instructor_id, start_time) INCLUDE (type);


--
-- TOC entry 5261 (class 1259 OID 33935)
-- Name: idx_exams_teacher_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_teacher_date ON public.exams USING btree (teacher_id, start_time);


--
-- TOC entry 5262 (class 1259 OID 32934)
-- Name: idx_exams_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_time ON public.exams USING btree (start_time, end_time);


--
-- TOC entry 5263 (class 1259 OID 32932)
-- Name: idx_exams_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_type ON public.exams USING btree (type);


--
-- TOC entry 5253 (class 1259 OID 33936)
-- Name: idx_group_lessons_classroom; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_lessons_classroom ON public.group_lessons USING btree (group_id) INCLUDE (classroom_id, lesson_id);


--
-- TOC entry 5254 (class 1259 OID 33930)
-- Name: idx_group_lessons_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_lessons_full ON public.group_lessons USING btree (group_id) INCLUDE (classroom_id);


--
-- TOC entry 5255 (class 1259 OID 32918)
-- Name: idx_group_lessons_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_group_lessons_group ON public.group_lessons USING btree (group_id);


--
-- TOC entry 5244 (class 1259 OID 32949)
-- Name: idx_groups_current_students; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_current_students ON public.groups USING btree (current_students);


--
-- TOC entry 5245 (class 1259 OID 32920)
-- Name: idx_groups_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_name ON public.groups USING btree (name);


--
-- TOC entry 5246 (class 1259 OID 33906)
-- Name: idx_groups_name_students; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_name_students ON public.groups USING btree (name, current_students);


--
-- TOC entry 5247 (class 1259 OID 32919)
-- Name: idx_groups_teacher; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_teacher ON public.groups USING btree (teacher_id);


--
-- TOC entry 5248 (class 1259 OID 33929)
-- Name: idx_groups_teacher_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_teacher_full ON public.groups USING btree (teacher_id) INCLUDE (name, current_students);


--
-- TOC entry 5249 (class 1259 OID 33921)
-- Name: idx_groups_teacher_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_teacher_name ON public.groups USING btree (teacher_id, name) INCLUDE (group_id, current_students);


--
-- TOC entry 5250 (class 1259 OID 33907)
-- Name: idx_groups_teacher_students; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_groups_teacher_students ON public.groups USING btree (teacher_id, current_students);


--
-- TOC entry 5226 (class 1259 OID 32916)
-- Name: idx_individual_lessons_instructor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_individual_lessons_instructor ON public.individual_lessons USING btree (instructor_id);


--
-- TOC entry 5227 (class 1259 OID 32944)
-- Name: idx_individual_lessons_instructor_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_individual_lessons_instructor_time ON public.individual_lessons USING btree (instructor_id) INCLUDE (lesson_id);


--
-- TOC entry 5228 (class 1259 OID 32917)
-- Name: idx_individual_lessons_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_individual_lessons_student ON public.individual_lessons USING btree (student_id);


--
-- TOC entry 5200 (class 1259 OID 33917)
-- Name: idx_instructors_basic_info; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_basic_info ON public.instructors USING btree (instructor_id) INCLUDE (person_id, driving_category_id, experience_years);


--
-- TOC entry 5201 (class 1259 OID 32929)
-- Name: idx_instructors_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_car ON public.instructors USING btree (car_id);


--
-- TOC entry 5202 (class 1259 OID 32950)
-- Name: idx_instructors_category_experience; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_category_experience ON public.instructors USING btree (driving_category_id, experience_years);


--
-- TOC entry 5203 (class 1259 OID 33927)
-- Name: idx_instructors_category_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_category_full ON public.instructors USING btree (driving_category_id) INCLUDE (person_id, car_id);


--
-- TOC entry 5204 (class 1259 OID 32925)
-- Name: idx_instructors_driving_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_driving_category ON public.instructors USING btree (driving_category_id);


--
-- TOC entry 5205 (class 1259 OID 32926)
-- Name: idx_instructors_experience; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_experience ON public.instructors USING btree (experience_years);


--
-- TOC entry 5206 (class 1259 OID 32927)
-- Name: idx_instructors_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_login ON public.instructors USING btree (login);


--
-- TOC entry 5207 (class 1259 OID 33933)
-- Name: idx_instructors_login_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_login_person ON public.instructors USING btree (login) INCLUDE (person_id);


--
-- TOC entry 5208 (class 1259 OID 32928)
-- Name: idx_instructors_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_person ON public.instructors USING btree (person_id);


--
-- TOC entry 5209 (class 1259 OID 33908)
-- Name: idx_instructors_person_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instructors_person_category ON public.instructors USING btree (person_id, driving_category_id);


--
-- TOC entry 5216 (class 1259 OID 33939)
-- Name: idx_lessons_date_filter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_date_filter ON public.lessons USING btree (start_time, end_time, lesson_status_id);


--
-- TOC entry 5217 (class 1259 OID 32945)
-- Name: idx_lessons_instructor_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_instructor_time ON public.lessons USING btree (lesson_id, start_time, end_time);


--
-- TOC entry 5229 (class 1259 OID 33934)
-- Name: idx_lessons_instructor_time_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_instructor_time_status ON public.individual_lessons USING btree (instructor_id, student_id) INCLUDE (lesson_id);


--
-- TOC entry 5218 (class 1259 OID 32912)
-- Name: idx_lessons_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_status ON public.lessons USING btree (lesson_status_id);


--
-- TOC entry 5219 (class 1259 OID 32947)
-- Name: idx_lessons_status_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_status_time ON public.lessons USING btree (lesson_status_id, start_time, end_time);


--
-- TOC entry 5220 (class 1259 OID 32911)
-- Name: idx_lessons_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_time ON public.lessons USING btree (start_time, end_time);


--
-- TOC entry 5221 (class 1259 OID 32914)
-- Name: idx_lessons_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_topic ON public.lessons USING btree (lesson_topic_id);


--
-- TOC entry 5222 (class 1259 OID 32913)
-- Name: idx_lessons_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_type ON public.lessons USING btree (lesson_type_id);


--
-- TOC entry 5223 (class 1259 OID 33926)
-- Name: idx_lessons_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lessons_type_status ON public.lessons USING btree (lesson_type_id, lesson_status_id, start_time);


--
-- TOC entry 5283 (class 1259 OID 33940)
-- Name: idx_pdf_files_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pdf_files_search ON public.pdf_files USING btree (file_name, upload_date);


--
-- TOC entry 5284 (class 1259 OID 33438)
-- Name: idx_pdf_files_upload_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pdf_files_upload_date ON public.pdf_files USING btree (upload_date DESC);


--
-- TOC entry 5107 (class 1259 OID 32900)
-- Name: idx_persons_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_email ON public.persons USING btree (email);


--
-- TOC entry 5108 (class 1259 OID 33914)
-- Name: idx_persons_email_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_email_lower ON public.persons USING btree (lower((email)::text));


--
-- TOC entry 5109 (class 1259 OID 33909)
-- Name: idx_persons_email_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_email_phone ON public.persons USING btree (email, phone) WHERE ((email IS NOT NULL) OR (phone IS NOT NULL));


--
-- TOC entry 5110 (class 1259 OID 33912)
-- Name: idx_persons_first_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_first_name_lower ON public.persons USING btree (lower((first_name)::text));


--
-- TOC entry 5111 (class 1259 OID 33913)
-- Name: idx_persons_last_name_lower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_last_name_lower ON public.persons USING btree (lower((last_name)::text));


--
-- TOC entry 5112 (class 1259 OID 32899)
-- Name: idx_persons_names; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_names ON public.persons USING btree (first_name, last_name);


--
-- TOC entry 5113 (class 1259 OID 32901)
-- Name: idx_persons_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_phone ON public.persons USING btree (phone);


--
-- TOC entry 5114 (class 1259 OID 32902)
-- Name: idx_persons_tin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_tin ON public.persons USING btree ("TIN");


--
-- TOC entry 5115 (class 1259 OID 33910)
-- Name: idx_persons_tin_names; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_tin_names ON public.persons USING btree ("TIN", first_name, last_name);


--
-- TOC entry 5153 (class 1259 OID 32909)
-- Name: idx_students_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_application ON public.students USING btree (application_id);


--
-- TOC entry 5154 (class 1259 OID 33915)
-- Name: idx_students_cascade_delete; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_cascade_delete ON public.students USING btree (person_id, student_id, application_id);


--
-- TOC entry 5155 (class 1259 OID 33896)
-- Name: idx_students_exam_covering; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_exam_covering ON public.students USING btree (exam_result_id, student_id, person_id);


--
-- TOC entry 5156 (class 1259 OID 32908)
-- Name: idx_students_exam_result; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_exam_result ON public.students USING btree (exam_result_id);


--
-- TOC entry 5157 (class 1259 OID 33895)
-- Name: idx_students_exam_result_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_exam_result_composite ON public.students USING btree (student_id, exam_result_id);


--
-- TOC entry 5158 (class 1259 OID 33916)
-- Name: idx_students_full_info; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_full_info ON public.students USING btree (student_id) INCLUDE (person_id, application_id, exam_result_id);


--
-- TOC entry 5182 (class 1259 OID 33924)
-- Name: idx_students_group_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_group_full ON public.students_with_group USING btree (group_id) INCLUDE (student_id);


--
-- TOC entry 5183 (class 1259 OID 33937)
-- Name: idx_students_group_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_group_status ON public.students_with_group USING btree (group_id, student_id);


--
-- TOC entry 5167 (class 1259 OID 33932)
-- Name: idx_students_instructor_full; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_instructor_full ON public.students_with_instructor USING btree (instructor_id) INCLUDE (student_id);


--
-- TOC entry 5159 (class 1259 OID 32910)
-- Name: idx_students_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_person ON public.students USING btree (person_id);


--
-- TOC entry 5160 (class 1259 OID 33902)
-- Name: idx_students_person_exam; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_person_exam ON public.students USING btree (person_id, exam_result_id);


--
-- TOC entry 5161 (class 1259 OID 32946)
-- Name: idx_students_study_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_study_category ON public.students USING btree (student_id) INCLUDE (application_id);


--
-- TOC entry 5162 (class 1259 OID 33919)
-- Name: idx_students_with_exams; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_exams ON public.students USING btree (student_id, exam_result_id) WHERE (exam_result_id IS NOT NULL);


--
-- TOC entry 5184 (class 1259 OID 32922)
-- Name: idx_students_with_group_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_group_group ON public.students_with_group USING btree (group_id);


--
-- TOC entry 5185 (class 1259 OID 33904)
-- Name: idx_students_with_group_group_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_group_group_student ON public.students_with_group USING btree (group_id, student_id);


--
-- TOC entry 5186 (class 1259 OID 32921)
-- Name: idx_students_with_group_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_group_student ON public.students_with_group USING btree (student_id);


--
-- TOC entry 5168 (class 1259 OID 32924)
-- Name: idx_students_with_instructor_instructor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_instructor_instructor ON public.students_with_instructor USING btree (instructor_id);


--
-- TOC entry 5169 (class 1259 OID 33905)
-- Name: idx_students_with_instructor_instructor_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_instructor_instructor_student ON public.students_with_instructor USING btree (instructor_id, student_id);


--
-- TOC entry 5170 (class 1259 OID 32923)
-- Name: idx_students_with_instructor_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_students_with_instructor_student ON public.students_with_instructor USING btree (student_id);


--
-- TOC entry 5148 (class 1259 OID 33898)
-- Name: idx_system_users_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_users_login ON public.system_users USING btree (login);


--
-- TOC entry 5149 (class 1259 OID 33899)
-- Name: idx_system_users_login_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_users_login_role ON public.system_users USING btree (login, system_user_role_id);


--
-- TOC entry 5150 (class 1259 OID 32943)
-- Name: idx_system_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_system_users_role ON public.system_users USING btree (system_user_role_id);


--
-- TOC entry 5232 (class 1259 OID 32930)
-- Name: idx_teachers_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teachers_login ON public.teachers USING btree (login);


--
-- TOC entry 5233 (class 1259 OID 32931)
-- Name: idx_teachers_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teachers_person ON public.teachers USING btree (person_id);


--
-- TOC entry 5325 (class 2620 OID 33470)
-- Name: students tr_auto_update_application_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_auto_update_application_status AFTER INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.auto_update_application_status();


--
-- TOC entry 5328 (class 2620 OID 34001)
-- Name: cars tr_cleanup_unused_models_and_brands; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_cleanup_unused_models_and_brands AFTER DELETE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.delete_unused_model_and_brand();


--
-- TOC entry 5335 (class 2620 OID 34007)
-- Name: exams tr_delete_exam_location; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_delete_exam_location AFTER DELETE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.delete_exam_location_on_exam_delete();


--
-- TOC entry 5323 (class 2620 OID 33448)
-- Name: applicants tr_validate_applicant_age; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_applicant_age BEFORE INSERT OR UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.validate_applicant_age();


--
-- TOC entry 5337 (class 2620 OID 33450)
-- Name: applications tr_validate_application_logic; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_application_logic BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.validate_application_logic();


--
-- TOC entry 5329 (class 2620 OID 33452)
-- Name: cars tr_validate_car_plate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_car_plate BEFORE INSERT OR UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.validate_car_plate();


--
-- TOC entry 5334 (class 2620 OID 33466)
-- Name: group_lessons tr_validate_classroom_availability; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_classroom_availability BEFORE INSERT OR UPDATE ON public.group_lessons FOR EACH ROW EXECUTE FUNCTION public.validate_classroom_availability();


--
-- TOC entry 5336 (class 2620 OID 33458)
-- Name: exams tr_validate_exam_schedule; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_exam_schedule BEFORE INSERT OR UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.validate_exam_schedule();


--
-- TOC entry 5326 (class 2620 OID 33462)
-- Name: students_with_group tr_validate_group_student_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_group_student_count AFTER INSERT OR DELETE ON public.students_with_group FOR EACH ROW EXECUTE FUNCTION public.validate_group_student_count();


--
-- TOC entry 5333 (class 2620 OID 33464)
-- Name: individual_lessons tr_validate_individual_lesson_conflicts; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_individual_lesson_conflicts BEFORE INSERT OR UPDATE ON public.individual_lessons FOR EACH ROW EXECUTE FUNCTION public.validate_individual_lesson_conflicts();


--
-- TOC entry 5330 (class 2620 OID 33460)
-- Name: instructors tr_validate_instructor_experience; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_instructor_experience BEFORE INSERT OR UPDATE ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.validate_instructor_experience();


--
-- TOC entry 5332 (class 2620 OID 33456)
-- Name: lessons tr_validate_lesson_duration; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_lesson_duration BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.validate_lesson_duration();


--
-- TOC entry 5324 (class 2620 OID 33468)
-- Name: system_users tr_validate_password_strength; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_validate_password_strength BEFORE INSERT OR UPDATE ON public.system_users FOR EACH ROW EXECUTE FUNCTION public.validate_password_strength();


--
-- TOC entry 5331 (class 2620 OID 33472)
-- Name: instructors trigger_check_car_assignment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_check_car_assignment BEFORE INSERT OR UPDATE OF car_id ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.check_car_assignment();


--
-- TOC entry 5327 (class 2620 OID 33413)
-- Name: students_with_group trigger_update_group_current_students; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_group_current_students AFTER INSERT OR DELETE OR UPDATE ON public.students_with_group FOR EACH ROW EXECUTE FUNCTION public.update_group_current_students();


--
-- TOC entry 5338 (class 2620 OID 33440)
-- Name: pdf_files update_pdf_files_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_pdf_files_updated_at BEFORE UPDATE ON public.pdf_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5318 (class 2606 OID 33375)
-- Name: applications applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(applicant_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5319 (class 2606 OID 33139)
-- Name: applications applications_application_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_application_status_id_fkey FOREIGN KEY (application_status_id) REFERENCES public.application_statuses(application_status_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5320 (class 2606 OID 33144)
-- Name: applications applications_study_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_study_category_id_fkey FOREIGN KEY (study_category_id) REFERENCES public.study_categories(study_category_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5293 (class 2606 OID 33989)
-- Name: car_models car_models_car_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_car_brand_id_fkey FOREIGN KEY (car_brand_id) REFERENCES public.car_brands(car_brand_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5294 (class 2606 OID 33994)
-- Name: car_models car_models_car_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_models
    ADD CONSTRAINT car_models_car_category_id_fkey FOREIGN KEY (car_category_id) REFERENCES public.car_categories(car_category_id) ON UPDATE CASCADE;


--
-- TOC entry 5297 (class 2606 OID 33159)
-- Name: cars cars_car_condition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_car_condition_id_fkey FOREIGN KEY (car_condition_id) REFERENCES public.car_conditions(car_condition_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5298 (class 2606 OID 33979)
-- Name: cars cars_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_model_id_fkey FOREIGN KEY (car_model_id) REFERENCES public.car_models(car_model_id) ON DELETE CASCADE;


--
-- TOC entry 5321 (class 2606 OID 33350)
-- Name: exam_locations exam_locations_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_locations
    ADD CONSTRAINT exam_locations_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(car_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5322 (class 2606 OID 33355)
-- Name: exam_locations exam_locations_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_locations
    ADD CONSTRAINT exam_locations_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(classroom_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5315 (class 2606 OID 33385)
-- Name: exams exams_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(instructor_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5316 (class 2606 OID 33390)
-- Name: exams exams_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(teacher_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5317 (class 2606 OID 33360)
-- Name: exams fk_exam_location; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_exam_location FOREIGN KEY (exam_location_id) REFERENCES public.exam_locations(exam_location_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5312 (class 2606 OID 33407)
-- Name: group_lessons group_lessons_classroom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_lessons
    ADD CONSTRAINT group_lessons_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(classroom_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5313 (class 2606 OID 33174)
-- Name: group_lessons group_lessons_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_lessons
    ADD CONSTRAINT group_lessons_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(group_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5314 (class 2606 OID 33179)
-- Name: group_lessons group_lessons_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_lessons
    ADD CONSTRAINT group_lessons_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(lesson_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5311 (class 2606 OID 33365)
-- Name: groups groups_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(teacher_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5306 (class 2606 OID 33380)
-- Name: individual_lessons individual_lessons_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.individual_lessons
    ADD CONSTRAINT individual_lessons_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(instructor_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5307 (class 2606 OID 33194)
-- Name: individual_lessons individual_lessons_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.individual_lessons
    ADD CONSTRAINT individual_lessons_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(lesson_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5308 (class 2606 OID 33199)
-- Name: individual_lessons individual_lessons_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.individual_lessons
    ADD CONSTRAINT individual_lessons_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5299 (class 2606 OID 33209)
-- Name: instructors instructors_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.cars(car_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5300 (class 2606 OID 33214)
-- Name: instructors instructors_driving_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_driving_category_id_fkey FOREIGN KEY (driving_category_id) REFERENCES public.driving_categories(driving_category_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5301 (class 2606 OID 33219)
-- Name: instructors instructors_login_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_login_fkey FOREIGN KEY (login) REFERENCES public.system_users(login) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5302 (class 2606 OID 33224)
-- Name: instructors instructors_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(person_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5303 (class 2606 OID 33234)
-- Name: lessons lessons_lesson_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_lesson_status_id_fkey FOREIGN KEY (lesson_status_id) REFERENCES public.lesson_statuses(lesson_status_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5304 (class 2606 OID 33239)
-- Name: lessons lessons_lesson_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_lesson_topic_id_fkey FOREIGN KEY (lesson_topic_id) REFERENCES public.lesson_topics(lesson_topic_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5305 (class 2606 OID 33244)
-- Name: lessons lessons_lesson_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_lesson_type_id_fkey FOREIGN KEY (lesson_type_id) REFERENCES public.lesson_types(lesson_type_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5288 (class 2606 OID 33370)
-- Name: students students_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(application_id) ON UPDATE RESTRICT ON DELETE SET NULL;


--
-- TOC entry 5289 (class 2606 OID 33254)
-- Name: students students_exam_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_exam_result_id_fkey FOREIGN KEY (exam_result_id) REFERENCES public.exam_results(exam_result_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5290 (class 2606 OID 33259)
-- Name: students students_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(person_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5295 (class 2606 OID 33264)
-- Name: students_with_group students_with_group_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_group
    ADD CONSTRAINT students_with_group_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(group_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5296 (class 2606 OID 33269)
-- Name: students_with_group students_with_group_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_group
    ADD CONSTRAINT students_with_group_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5291 (class 2606 OID 33274)
-- Name: students_with_instructor students_with_instructor_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_instructor
    ADD CONSTRAINT students_with_instructor_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(instructor_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5292 (class 2606 OID 33279)
-- Name: students_with_instructor students_with_instructor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students_with_instructor
    ADD CONSTRAINT students_with_instructor_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5287 (class 2606 OID 33284)
-- Name: system_users system_users_system_user_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_system_user_role_id_fkey FOREIGN KEY (system_user_role_id) REFERENCES public.system_users_roles(system_user_role_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5309 (class 2606 OID 33294)
-- Name: teachers teachers_login_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_login_fkey FOREIGN KEY (login) REFERENCES public.system_users(login) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5310 (class 2606 OID 33299)
-- Name: teachers teachers_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(person_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5539 (class 0 OID 0)
-- Dependencies: 345
-- Name: FUNCTION f_authenticate_user(p_username character varying, p_password character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_authenticate_user(p_username character varying, p_password character varying) TO admin_role;


--
-- TOC entry 5540 (class 0 OID 0)
-- Dependencies: 353
-- Name: FUNCTION f_create_student(p_first_name character varying, p_last_name character varying, p_birth_date date, p_email character varying, p_phone character varying, p_tin character varying, p_application_id integer, p_group_id integer, p_instructor_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_create_student(p_first_name character varying, p_last_name character varying, p_birth_date date, p_email character varying, p_phone character varying, p_tin character varying, p_application_id integer, p_group_id integer, p_instructor_id integer) TO admin_role;


--
-- TOC entry 5541 (class 0 OID 0)
-- Dependencies: 352
-- Name: FUNCTION f_delete_application(p_application_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_delete_application(p_application_id integer) TO admin_role;


--
-- TOC entry 5542 (class 0 OID 0)
-- Dependencies: 347
-- Name: FUNCTION f_get_all_applications(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_get_all_applications() TO admin_role;


--
-- TOC entry 5543 (class 0 OID 0)
-- Dependencies: 348
-- Name: FUNCTION f_get_all_groups(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_get_all_groups() TO admin_role;


--
-- TOC entry 5544 (class 0 OID 0)
-- Dependencies: 349
-- Name: FUNCTION f_get_all_instructors(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_get_all_instructors() TO admin_role;


--
-- TOC entry 5545 (class 0 OID 0)
-- Dependencies: 350
-- Name: FUNCTION f_get_status_id(p_status character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_get_status_id(p_status character varying) TO admin_role;


--
-- TOC entry 5546 (class 0 OID 0)
-- Dependencies: 351
-- Name: FUNCTION f_update_application_status(p_application_id integer, p_status character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.f_update_application_status(p_application_id integer, p_status character varying) TO admin_role;


--
-- TOC entry 5547 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE applicants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applicants TO admin_role;


--
-- TOC entry 5549 (class 0 OID 0)
-- Dependencies: 222
-- Name: SEQUENCE applicants_applicant_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.applicants_applicant_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.applicants_applicant_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.applicants_applicant_id_seq TO teacher_role;


--
-- TOC entry 5550 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE application_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.application_statuses TO admin_role;
GRANT SELECT ON TABLE public.application_statuses TO instructor_user;
GRANT SELECT ON TABLE public.application_statuses TO teacher_role;


--
-- TOC entry 5552 (class 0 OID 0)
-- Dependencies: 226
-- Name: SEQUENCE application_statuses_application_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.application_statuses_application_status_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.application_statuses_application_status_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.application_statuses_application_status_id_seq TO teacher_role;


--
-- TOC entry 5553 (class 0 OID 0)
-- Dependencies: 268
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applications TO admin_role;
GRANT SELECT ON TABLE public.applications TO instructor_user;
GRANT SELECT ON TABLE public.applications TO teacher_role;


--
-- TOC entry 5555 (class 0 OID 0)
-- Dependencies: 267
-- Name: SEQUENCE applications_application_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.applications_application_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.applications_application_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.applications_application_id_seq TO teacher_role;


--
-- TOC entry 5556 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE car_brands; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.car_brands TO admin_role;
GRANT SELECT ON TABLE public.car_brands TO instructor_role;


--
-- TOC entry 5558 (class 0 OID 0)
-- Dependencies: 236
-- Name: SEQUENCE brands_brand_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.brands_brand_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.brands_brand_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.brands_brand_id_seq TO teacher_role;


--
-- TOC entry 5559 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE car_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.car_categories TO admin_role;
GRANT SELECT ON TABLE public.car_categories TO instructor_role;


--
-- TOC entry 5561 (class 0 OID 0)
-- Dependencies: 234
-- Name: SEQUENCE car_categories_car_category_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.car_categories_car_category_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.car_categories_car_category_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.car_categories_car_category_id_seq TO teacher_role;


--
-- TOC entry 5562 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE car_conditions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.car_conditions TO admin_role;
GRANT SELECT ON TABLE public.car_conditions TO instructor_role;


--
-- TOC entry 5564 (class 0 OID 0)
-- Dependencies: 240
-- Name: SEQUENCE car_conditions_car_condition_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.car_conditions_car_condition_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.car_conditions_car_condition_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.car_conditions_car_condition_id_seq TO teacher_role;


--
-- TOC entry 5565 (class 0 OID 0)
-- Dependencies: 251
-- Name: TABLE car_models; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.car_models TO admin_role;
GRANT SELECT ON TABLE public.car_models TO instructor_role;


--
-- TOC entry 5567 (class 0 OID 0)
-- Dependencies: 250
-- Name: SEQUENCE car_models_model_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.car_models_model_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.car_models_model_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.car_models_model_id_seq TO teacher_role;


--
-- TOC entry 5568 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE cars; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cars TO admin_role;
GRANT SELECT ON TABLE public.cars TO instructor_role;


--
-- TOC entry 5570 (class 0 OID 0)
-- Dependencies: 253
-- Name: SEQUENCE cars_car_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cars_car_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.cars_car_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.cars_car_id_seq TO teacher_role;


--
-- TOC entry 5571 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE cars_category_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.cars_category_distribution TO admin_role;


--
-- TOC entry 5572 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE cars_condition_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.cars_condition_distribution TO admin_role;


--
-- TOC entry 5573 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE driving_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.driving_categories TO admin_role;
GRANT SELECT ON TABLE public.driving_categories TO instructor_role;


--
-- TOC entry 5574 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE instructors; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.instructors TO admin_role;
GRANT SELECT ON TABLE public.instructors TO instructor_role;


--
-- TOC entry 5575 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE persons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.persons TO admin_role;
GRANT SELECT ON TABLE public.persons TO instructor_role;
GRANT SELECT ON TABLE public.persons TO teacher_role;


--
-- TOC entry 5576 (class 0 OID 0)
-- Dependencies: 315
-- Name: TABLE cars_instructor_assignment; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.cars_instructor_assignment TO admin_role;


--
-- TOC entry 5577 (class 0 OID 0)
-- Dependencies: 316
-- Name: TABLE cars_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.cars_summary TO admin_role;


--
-- TOC entry 5578 (class 0 OID 0)
-- Dependencies: 313
-- Name: TABLE cars_year_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.cars_year_distribution TO admin_role;


--
-- TOC entry 5579 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE classrooms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.classrooms TO admin_role;
GRANT SELECT ON TABLE public.classrooms TO teacher_role;
GRANT SELECT ON TABLE public.classrooms TO instructor_role;


--
-- TOC entry 5581 (class 0 OID 0)
-- Dependencies: 242
-- Name: SEQUENCE classrooms_classroom_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.classrooms_classroom_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.classrooms_classroom_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.classrooms_classroom_id_seq TO teacher_role;


--
-- TOC entry 5582 (class 0 OID 0)
-- Dependencies: 311
-- Name: TABLE classrooms_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.classrooms_summary TO admin_role;


--
-- TOC entry 5584 (class 0 OID 0)
-- Dependencies: 238
-- Name: SEQUENCE driving_categories_driving_category_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.driving_categories_driving_category_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.driving_categories_driving_category_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.driving_categories_driving_category_id_seq TO teacher_role;


--
-- TOC entry 5585 (class 0 OID 0)
-- Dependencies: 269
-- Name: TABLE exam_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exam_locations TO instructor_role;
GRANT SELECT ON TABLE public.exam_locations TO teacher_role;
GRANT ALL ON TABLE public.exam_locations TO admin_role;


--
-- TOC entry 5586 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE exam_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exam_results TO admin_role;
GRANT SELECT,UPDATE ON TABLE public.exam_results TO instructor_user;
GRANT SELECT,INSERT,UPDATE ON TABLE public.exam_results TO instructor_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.exam_results TO teacher_role;


--
-- TOC entry 5588 (class 0 OID 0)
-- Dependencies: 230
-- Name: SEQUENCE exam_results_exam_result_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.exam_results_exam_result_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.exam_results_exam_result_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.exam_results_exam_result_id_seq TO teacher_role;


--
-- TOC entry 5589 (class 0 OID 0)
-- Dependencies: 266
-- Name: TABLE exams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exams TO admin_role;
GRANT SELECT,UPDATE ON TABLE public.exams TO instructor_role;
GRANT SELECT ON TABLE public.exams TO teacher_role;


--
-- TOC entry 5590 (class 0 OID 0)
-- Dependencies: 307
-- Name: TABLE exams_by_day_of_week; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_by_day_of_week TO admin_role;


--
-- TOC entry 5592 (class 0 OID 0)
-- Dependencies: 265
-- Name: SEQUENCE exams_exam_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.exams_exam_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.exams_exam_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.exams_exam_id_seq TO teacher_role;


--
-- TOC entry 5593 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE exams_location_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_location_distribution TO admin_role;


--
-- TOC entry 5594 (class 0 OID 0)
-- Dependencies: 305
-- Name: TABLE exams_monthly_trends; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_monthly_trends TO admin_role;


--
-- TOC entry 5595 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE exams_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_summary TO admin_role;


--
-- TOC entry 5596 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE exams_type_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_type_distribution TO admin_role;


--
-- TOC entry 5597 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE exams_utilization; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.exams_utilization TO admin_role;


--
-- TOC entry 5598 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE group_lessons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.group_lessons TO admin_role;
GRANT SELECT,UPDATE ON TABLE public.group_lessons TO teacher_role;


--
-- TOC entry 5599 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.groups TO admin_role;
GRANT SELECT ON TABLE public.groups TO teacher_role;


--
-- TOC entry 5600 (class 0 OID 0)
-- Dependencies: 219
-- Name: TABLE lesson_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lesson_statuses TO admin_role;
GRANT SELECT ON TABLE public.lesson_statuses TO instructor_role;
GRANT SELECT ON TABLE public.lesson_statuses TO teacher_role;


--
-- TOC entry 5601 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE lessons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lessons TO admin_role;
GRANT SELECT,UPDATE ON TABLE public.lessons TO instructor_role;
GRANT SELECT,UPDATE ON TABLE public.lessons TO teacher_role;


--
-- TOC entry 5602 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE teachers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.teachers TO admin_role;
GRANT SELECT ON TABLE public.teachers TO teacher_role;


--
-- TOC entry 5603 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE group_lessons_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.group_lessons_analysis TO admin_role;


--
-- TOC entry 5605 (class 0 OID 0)
-- Dependencies: 262
-- Name: SEQUENCE groups_group_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.groups_group_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.groups_group_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.groups_group_id_seq TO teacher_role;


--
-- TOC entry 5606 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE students; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.students TO admin_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.students TO instructor_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.students TO teacher_role;


--
-- TOC entry 5607 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE students_with_group; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.students_with_group TO admin_role;
GRANT SELECT ON TABLE public.students_with_group TO teacher_role;


--
-- TOC entry 5608 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE groups_performance; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.groups_performance TO admin_role;


--
-- TOC entry 5609 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE individual_lessons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.individual_lessons TO admin_role;
GRANT SELECT,UPDATE ON TABLE public.individual_lessons TO instructor_role;


--
-- TOC entry 5610 (class 0 OID 0)
-- Dependencies: 303
-- Name: TABLE individual_lessons_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.individual_lessons_analysis TO admin_role;


--
-- TOC entry 5611 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE instructor_age_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructor_age_distribution TO admin_role;


--
-- TOC entry 5612 (class 0 OID 0)
-- Dependencies: 290
-- Name: TABLE instructor_car_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructor_car_status TO admin_role;


--
-- TOC entry 5613 (class 0 OID 0)
-- Dependencies: 288
-- Name: TABLE instructors_by_category; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructors_by_category TO admin_role;


--
-- TOC entry 5614 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE instructors_by_experience; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructors_by_experience TO admin_role;


--
-- TOC entry 5616 (class 0 OID 0)
-- Dependencies: 255
-- Name: SEQUENCE instructors_instructor_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.instructors_instructor_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.instructors_instructor_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.instructors_instructor_id_seq TO teacher_role;


--
-- TOC entry 5617 (class 0 OID 0)
-- Dependencies: 286
-- Name: TABLE instructors_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructors_summary TO admin_role;


--
-- TOC entry 5618 (class 0 OID 0)
-- Dependencies: 249
-- Name: TABLE students_with_instructor; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.students_with_instructor TO admin_role;
GRANT SELECT ON TABLE public.students_with_instructor TO instructor_role;


--
-- TOC entry 5619 (class 0 OID 0)
-- Dependencies: 289
-- Name: TABLE instructors_workload; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.instructors_workload TO admin_role;


--
-- TOC entry 5620 (class 0 OID 0)
-- Dependencies: 217
-- Name: SEQUENCE lesson_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lesson_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.lesson_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.lesson_id_seq TO teacher_role;


--
-- TOC entry 5622 (class 0 OID 0)
-- Dependencies: 218
-- Name: SEQUENCE lesson_statuses_lesson_status_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lesson_statuses_lesson_status_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.lesson_statuses_lesson_status_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.lesson_statuses_lesson_status_id_seq TO teacher_role;


--
-- TOC entry 5623 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE lesson_topics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lesson_topics TO admin_role;
GRANT SELECT ON TABLE public.lesson_topics TO teacher_role;
GRANT SELECT ON TABLE public.lesson_topics TO instructor_role;


--
-- TOC entry 5625 (class 0 OID 0)
-- Dependencies: 220
-- Name: SEQUENCE lesson_topics_lesson_topic_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lesson_topics_lesson_topic_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.lesson_topics_lesson_topic_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.lesson_topics_lesson_topic_id_seq TO teacher_role;


--
-- TOC entry 5626 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE lesson_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lesson_types TO admin_role;
GRANT SELECT ON TABLE public.lesson_types TO instructor_role;
GRANT SELECT ON TABLE public.lesson_types TO teacher_role;


--
-- TOC entry 5628 (class 0 OID 0)
-- Dependencies: 228
-- Name: SEQUENCE lesson_types_lesson_type_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lesson_types_lesson_type_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.lesson_types_lesson_type_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.lesson_types_lesson_type_id_seq TO teacher_role;


--
-- TOC entry 5629 (class 0 OID 0)
-- Dependencies: 301
-- Name: TABLE lessons_by_day_of_week; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_by_day_of_week TO admin_role;


--
-- TOC entry 5631 (class 0 OID 0)
-- Dependencies: 257
-- Name: SEQUENCE lessons_lesson_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lessons_lesson_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.lessons_lesson_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.lessons_lesson_id_seq TO teacher_role;


--
-- TOC entry 5632 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE lessons_monthly_trends; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_monthly_trends TO admin_role;


--
-- TOC entry 5633 (class 0 OID 0)
-- Dependencies: 299
-- Name: TABLE lessons_status_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_status_distribution TO admin_role;


--
-- TOC entry 5634 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE lessons_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_summary TO admin_role;


--
-- TOC entry 5635 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE lessons_topic_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_topic_distribution TO admin_role;


--
-- TOC entry 5636 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE lessons_type_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.lessons_type_distribution TO admin_role;


--
-- TOC entry 5637 (class 0 OID 0)
-- Dependencies: 270
-- Name: TABLE pdf_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pdf_files TO teacher_role;


--
-- TOC entry 5639 (class 0 OID 0)
-- Dependencies: 232
-- Name: SEQUENCE persons_person_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.persons_person_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.persons_person_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.persons_person_id_seq TO teacher_role;


--
-- TOC entry 5640 (class 0 OID 0)
-- Dependencies: 309
-- Name: TABLE practice_exams_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.practice_exams_analysis TO admin_role;


--
-- TOC entry 5642 (class 0 OID 0)
-- Dependencies: 247
-- Name: SEQUENCE students_student_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.students_student_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.students_student_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.students_student_id_seq TO teacher_role;


--
-- TOC entry 5643 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE study_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.study_categories TO admin_role;
GRANT SELECT ON TABLE public.study_categories TO instructor_user;
GRANT SELECT ON TABLE public.study_categories TO teacher_role;


--
-- TOC entry 5645 (class 0 OID 0)
-- Dependencies: 224
-- Name: SEQUENCE study_categories_study_category_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.study_categories_study_category_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.study_categories_study_category_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.study_categories_study_category_id_seq TO teacher_role;


--
-- TOC entry 5646 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE system_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_users TO admin_role;


--
-- TOC entry 5647 (class 0 OID 0)
-- Dependencies: 245
-- Name: TABLE system_users_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.system_users_roles TO admin_role;


--
-- TOC entry 5649 (class 0 OID 0)
-- Dependencies: 244
-- Name: SEQUENCE system_users_roles_system_user_role_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.system_users_roles_system_user_role_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.system_users_roles_system_user_role_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.system_users_roles_system_user_role_id_seq TO teacher_role;


--
-- TOC entry 5650 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE teacher_age_distribution; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.teacher_age_distribution TO admin_role;


--
-- TOC entry 5651 (class 0 OID 0)
-- Dependencies: 292
-- Name: TABLE teachers_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.teachers_summary TO admin_role;


--
-- TOC entry 5653 (class 0 OID 0)
-- Dependencies: 260
-- Name: SEQUENCE teachers_teacher_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.teachers_teacher_id_seq TO admin_role;
GRANT USAGE ON SEQUENCE public.teachers_teacher_id_seq TO instructor_role;
GRANT USAGE ON SEQUENCE public.teachers_teacher_id_seq TO teacher_role;


--
-- TOC entry 5654 (class 0 OID 0)
-- Dependencies: 293
-- Name: TABLE teachers_workload; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.teachers_workload TO admin_role;


--
-- TOC entry 5655 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE theory_exams_analysis; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.theory_exams_analysis TO admin_role;


--
-- TOC entry 5656 (class 0 OID 0)
-- Dependencies: 280
-- Name: TABLE v_age_distribution_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_age_distribution_analytics TO admin_role;


--
-- TOC entry 5657 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE v_application_demographics_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_application_demographics_analytics TO admin_role;


--
-- TOC entry 5658 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE v_application_status_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_application_status_analytics TO admin_role;


--
-- TOC entry 5659 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE v_applications_by_day_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_applications_by_day_analytics TO admin_role;


--
-- TOC entry 5660 (class 0 OID 0)
-- Dependencies: 317
-- Name: TABLE v_applications_full; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_applications_full TO admin_role;


--
-- TOC entry 5661 (class 0 OID 0)
-- Dependencies: 274
-- Name: TABLE v_applications_summary_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_applications_summary_analytics TO admin_role;


--
-- TOC entry 5662 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE v_category_distribution_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_category_distribution_analytics TO admin_role;


--
-- TOC entry 5663 (class 0 OID 0)
-- Dependencies: 284
-- Name: TABLE v_category_performance_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_category_performance_analytics TO admin_role;


--
-- TOC entry 5664 (class 0 OID 0)
-- Dependencies: 285
-- Name: TABLE v_completion_rate_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_completion_rate_analytics TO admin_role;


--
-- TOC entry 5665 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE v_exam_results_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_exam_results_analytics TO admin_role;


--
-- TOC entry 5666 (class 0 OID 0)
-- Dependencies: 282
-- Name: TABLE v_group_participation_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_group_participation_analytics TO admin_role;


--
-- TOC entry 5667 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE v_groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_groups TO admin_role;


--
-- TOC entry 5668 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE v_individual_lessons_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_individual_lessons_analytics TO admin_role;


--
-- TOC entry 5669 (class 0 OID 0)
-- Dependencies: 319
-- Name: TABLE v_instructors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_instructors TO admin_role;


--
-- TOC entry 5670 (class 0 OID 0)
-- Dependencies: 272
-- Name: TABLE v_monthly_applications_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_monthly_applications_analytics TO admin_role;


--
-- TOC entry 5671 (class 0 OID 0)
-- Dependencies: 278
-- Name: TABLE v_monthly_students_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_monthly_students_analytics TO admin_role;


--
-- TOC entry 5672 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE v_processing_time_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_processing_time_analytics TO admin_role;


--
-- TOC entry 5673 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE v_students_summary_analytics; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.v_students_summary_analytics TO admin_role;


-- Completed on 2025-07-05 20:03:59

--
-- PostgreSQL database dump complete
--

