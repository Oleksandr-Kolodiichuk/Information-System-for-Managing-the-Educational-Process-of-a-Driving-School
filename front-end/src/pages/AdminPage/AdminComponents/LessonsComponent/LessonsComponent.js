import React, { useState, useEffect, useCallback } from 'react';
import './LessonsComponent.css';

const LessonsComponent = () => {
const [lessonTypes, setLessonTypes] = useState([]);
const [lessonStatuses, setLessonStatuses] = useState([]);
const [lessonTopics, setLessonTopics] = useState([]);
const [selectedModalDate, setSelectedModalDate] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [allLessons, setAllLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [formMode, setFormMode] = useState('add');
const [lessonForm, setLessonForm] = useState({
  start_time: '',
  end_time: '',
  lesson_type_id: '',
  lesson_status_id: '',
  lesson_topic_id: '',
  classroom_id: '',
  group_id: '',
  instructor_id: '',
  student_id: ''
});
  const [filters, setFilters] = useState({
    startDate: '',
    groupId: '',
    type: '',
    instructorId: '',
    status: '',
    classroom: ''
  });
  const [classrooms, setClassrooms] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

useEffect(() => {
  fetchLessons();
  fetchGroups();
  fetchInstructors();
  fetchStudents();
  fetchClassrooms();
  fetchLessonTypes();
  fetchLessonStatuses();
  fetchLessonTopics();
}, []);

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  const fetchLessonTypes = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/admin/lesson_types', {
      headers: getRequestHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch lesson types');
    }
    const data = await response.json();
    setLessonTypes(data);
  } catch (err) {
    console.error('Error loading lesson types:', err.message);
  }
};

const fetchLessonStatuses = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/admin/lesson_statuses', {
      headers: getRequestHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch lesson statuses');
    }
    const data = await response.json();
    setLessonStatuses(data);
  } catch (err) {
    console.error('Error loading lesson statuses:', err.message);
  }
};

const fetchLessonTopics = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/admin/lesson_topics', {
      headers: getRequestHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch lesson topics');
    }
    const data = await response.json();
    setLessonTopics(data);
  } catch (err) {
    console.error('Error loading lesson topics:', err.message);
  }
};

  const fetchClassrooms = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/classrooms',{
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch classrooms');
      }
      const data = await response.json();
      setClassrooms(data);
    } catch (err) {
      console.error('Error loading classrooms:', err.message);
    }
  };

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/lessons', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch lessons');
      }
      const data = await response.json();
      setAllLessons(data);
      setLessons(data);
      setError(null);
    } catch (err) {
      setError('Error loading lessons: ' + err.message);
      setLessons([]);
      setAllLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/groups', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err.message);
    }
  };

  const fetchInstructors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/instructors', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch instructors');
      }
      const data = await response.json();
      setInstructors(data);
    } catch (err) {
      console.error('Error loading instructors:', err.message);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/students', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      console.error('Error loading students:', err.message);
    }
  };

  const filterLessons = useCallback(() => {
    let filteredResults = [...allLessons];
    
    if (filters.startDate) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.start_time && lesson.start_time.includes(filters.startDate)
      );
    }
    
    if (filters.groupId) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.group_id && lesson.group_id.toString() === filters.groupId
      );
    }
    
    if (filters.type) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.type && lesson.type.toLowerCase() === filters.type.toLowerCase()
      );
    }
    
    if (filters.instructorId) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.instructor_id && lesson.instructor_id.toString() === filters.instructorId
      );
    }
    
    if (filters.status) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.status && lesson.status.toLowerCase() === filters.status.toLowerCase()
      );
    }

    if (filters.classroom) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.classroom && lesson.classroom === filters.classroom
      );
    }
    
    setLessons(filteredResults);
  }, [allLessons, filters]);

  useEffect(() => {
    filterLessons();
  }, [filterLessons]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      groupId: '',
      type: '',
      instructorId: '',
      status: '',
      classroom: ''
    });
  };

  const handleFormChange = (e) => {
  const { name, value } = e.target;
  
  if (name === 'lesson_type_id') {
    const selectedType = lessonTypes.find(type => type.lesson_type_id.toString() === value);
    const isTheory = selectedType && (selectedType.lesson_type.toLowerCase() === 'theory' || selectedType.lesson_type.toLowerCase() === 'теорія');
    
    setLessonForm(prev => ({
      ...prev,
      [name]: value,
      instructor_id: isTheory ? '' : prev.instructor_id,
      student_id: isTheory ? '' : prev.student_id,
      group_id: !isTheory ? '' : prev.group_id,
      classroom_id: !isTheory ? '' : prev.classroom_id
    }));
  } else {
    setLessonForm(prev => ({
      ...prev,
      [name]: value
    }));
  }
};

const openAddLessonModal = (date = null) => {
  setSelectedLesson(null);
  if (date) {
    if (date instanceof Date) {
      setSelectedModalDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    } else {
      setSelectedModalDate(new Date(date));
    }
  } else {
    const now = new Date();
    setSelectedModalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const now = new Date();
  const timeStr = now.toTimeString().substring(0, 5);
  
  setLessonForm({
    start_time: timeStr,
    end_time: timeStr,
    lesson_type_id: lessonTypes.find(type => type.lesson_type.toLowerCase() === 'theory' || type.lesson_type.toLowerCase() === 'теорія')?.lesson_type_id || '',
    lesson_status_id: lessonStatuses.find(status => status.lesson_status.toLowerCase() === 'not conducted' || status.lesson_status.toLowerCase() === 'не проведено')?.lesson_status_id || '',
    lesson_topic_id: '',
    classroom_id: '',
    group_id: '',
    instructor_id: '',
    student_id: ''
  });
  setFormMode('add');
  setShowLessonModal(true);
};

const openEditLessonModal = (lesson) => {
  setSelectedLesson(lesson);
  
  const parseDateTime = (datetimeStr) => {
    if (!datetimeStr) return { date: '', time: '' };
    const date = new Date(datetimeStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  };
  
  const startDateTime = parseDateTime(lesson.start_time);
  const endDateTime = parseDateTime(lesson.end_time);
  
  setLessonForm({
    start_time: startDateTime.time,
    end_time: endDateTime.time,
    lesson_type_id: lesson.lesson_type_id?.toString() || '',
    lesson_status_id: lesson.lesson_status_id?.toString() || '',
    lesson_topic_id: lesson.lesson_topic_id?.toString() || '',
    classroom_id: lesson.classroom_id?.toString() || '',
    group_id: lesson.group_id?.toString() || '',
    instructor_id: lesson.instructor_id?.toString() || '',
    student_id: lesson.student_id?.toString() || ''
  });
  
  setFormMode('edit');
  setShowLessonModal(true);
};
const createLocalDate = (year, month, day) => {
  return new Date(year, month, day);
};
  const handleLessonFormSubmit = async (e) => {
  e.preventDefault();
  try {
    const createDateTimeString = (timeStr) => {
  if (!timeStr) return null;
  
  let currentDate;
  if (formMode === 'edit' && selectedLesson) {
    const lessonDate = new Date(selectedLesson.start_time);
    const year = lessonDate.getFullYear();
    const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
    const day = String(lessonDate.getDate()).padStart(2, '0');
    currentDate = `${year}-${month}-${day}`;
  } else if (selectedModalDate) {
    const year = selectedModalDate.getFullYear();
    const month = String(selectedModalDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedModalDate.getDate()).padStart(2, '0');
    currentDate = `${year}-${month}-${day}`;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    currentDate = `${year}-${month}-${day}`;
  }
  
  return `${currentDate}T${timeStr}:00`;
};

    console.log('lessonForm.lesson_type_id:', lessonForm.lesson_type_id);
    console.log('lessonTypes:', lessonTypes);
    if (!lessonForm.lesson_type_id) {
      throw new Error('Будь ласка, оберіть тип уроку');
    }
    const selectedType = lessonTypes.find(type => 
      type.lesson_type_id.toString() === lessonForm.lesson_type_id.toString()
    );
    
    console.log('selectedType:', selectedType);
    
    if (!selectedType) {
      throw new Error('Не вдалося знайти обраний тип уроку');
    }
    const lessonTypeLower = selectedType.lesson_type.toLowerCase();
    console.log('lessonTypeLower:', lessonTypeLower);
    const isTheory = lessonTypeLower.includes('theory');
    const isPractical = lessonTypeLower.includes('practical');
    console.log('isTheory:', isTheory, 'isPractical:', isPractical);

const formData = {
  lesson_type_id: parseInt(lessonForm.lesson_type_id),
  lesson_status_id: parseInt(lessonForm.lesson_status_id),
  lesson_topic_id: parseInt(lessonForm.lesson_topic_id),
  start_time: createDateTimeString(lessonForm.start_time),
  end_time: createDateTimeString(lessonForm.end_time)
};
    if (isTheory) {
      if (!lessonForm.group_id) {
        throw new Error('Будь ласка, оберіть групу для теоретичного уроку');
      }
      if (!lessonForm.classroom_id) {
        throw new Error('Будь ласка, оберіть аудиторію для теоретичного уроку');
      }
      
      formData.classroom_id = parseInt(lessonForm.classroom_id);
      formData.group_id = parseInt(lessonForm.group_id);
      formData.instructor_id = null;
      formData.student_id = null;
    } else if (isPractical) {
      if (!lessonForm.instructor_id) {
        throw new Error('Будь ласка, оберіть інструктора для практичного уроку');
      }
      if (!lessonForm.student_id) {
        throw new Error('Будь ласка, оберіть студента для практичного уроку');
      }
      
      formData.classroom_id = null;
      formData.group_id = null;
      formData.instructor_id = parseInt(lessonForm.instructor_id);
      formData.student_id = parseInt(lessonForm.student_id);
    } else {
      throw new Error(`Невідомий тип уроку: ${selectedType.lesson_type}`);
    }

    console.log('Відправляємо дані на сервер:', formData);

    if (formMode === 'add') {
      const response = await fetch('http://localhost:5000/api/admin/lessons', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add lesson');
      }
    } else {
      const response = await fetch(`http://localhost:5000/api/admin/lessons/${selectedLesson.lesson_id}`, {
        method: 'PUT',
        headers: getRequestHeaders(),
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update lesson');
      }
    }
    
    setShowLessonModal(false);
    await fetchLessons();
  } catch (err) {
    console.error('Помилка при обробці форми уроку:', err);
    alert('Error: ' + err.message);
  }
};

  const handleDeleteLesson = async (lessonId) => {
  if (window.confirm('Are you sure you want to delete this lesson?')) {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: getRequestHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete lesson');
      }
      
      await fetchLessons();
    } catch (err) {
      alert('Error deleting lesson: ' + err.message);
    }
  }
};

const getLessonTypeName = (lessonTypeId) => {
  const type = lessonTypes.find(t => t.lesson_type_id === lessonTypeId);
  return type ? type.lesson_type : 'N/A';
};

const isTheoryLesson = (lessonTypeId) => {
  const type = lessonTypes.find(t => t.lesson_type_id === lessonTypeId);
  return type && (type.lesson_type.toLowerCase() === 'theory' || type.lesson_type.toLowerCase() === 'теорія');
};
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

// 11. Виправити функції отримання назв
const getGroupName = (groupId) => {
  const group = groups.find(g => g.group_id === groupId);
  return group ? group.name : 'N/A';
};

const getInstructorName = (instructorId) => {
  const instructor = instructors.find(i => i.instructor_id === instructorId);
  return instructor ? instructor.instructor_name : 'N/A';
};

const getStudentName = (studentId) => {
  const student = students.find(s => s.student_id === studentId);
  return student ? student.student_name : 'N/A';
};

const getClassroomName = (classroomId) => {
  const classroom = classrooms.find(c => c.classroom_id === classroomId);
  return classroom ? classroom.name : 'N/A';
};

const getLessonStatusName = (lessonStatusId) => {
  const status = lessonStatuses.find(s => s.lesson_status_id === lessonStatusId);
  return status ? status.lesson_status : 'N/A';
};

const getLessonTopicName = (lessonTopicId) => {
  const topic = lessonTopics.find(t => t.lesson_topic_id === lessonTopicId);
  return topic ? topic.lesson_topic : 'N/A';
};

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderFiltersView = () => {
    return (
      <div className="lessons-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Lessons</h3>
        <div className="lessons-filters-form">
          <div className="lessons-filter-group">
            <label htmlFor="startDate">Date:</label>
            <input 
              type="date" 
              id="startDate" 
              name="startDate" 
              value={filters.startDate} 
              onChange={handleFilterChange}
              className="lessons-filter-input"
            />
          </div>
          <div className="lessons-filter-group">
            <label htmlFor="groupId">Group:</label>
            <select
              id="groupId"
              name="groupId"
              value={filters.groupId}
              onChange={handleFilterChange}
              className="lessons-filter-select"
            >
              <option value="">All Groups</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lessons-filter-group">
            <label htmlFor="type">Type:</label>
            <select
              id="type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="lessons-filter-select"
            >
              <option value="">All Types</option>
              <option value="theory">Theory</option>
              <option value="practice">Practice</option>
            </select>
          </div>
          <div className="lessons-filter-group">
            <label htmlFor="instructorId">Instructor:</label>
            <select
              id="instructorId"
              name="instructorId"
              value={filters.instructorId}
              onChange={handleFilterChange}
              className="lessons-filter-select"
            >
              <option value="">All Instructors</option>
              {instructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.last_name} {instructor.first_name}
                </option>
              ))}
            </select>
          </div>
          <div className="lessons-filter-group">
            <label htmlFor="classroom">Classroom:</label>
            <select
              id="classroom"
              name="classroom"
              value={filters.classroom}
              onChange={handleFilterChange}
              className="lessons-filter-select"
            >
              <option value="">All Classrooms</option>
              {classrooms.map(classroom => (
                <option key={classroom.id} value={classroom.name}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lessons-filter-group">
            <label htmlFor="status">Status:</label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="lessons-filter-select"
            >
              <option value="">All</option>
              <option value="conducted">Conducted</option>
              <option value="not_conducted">Not Conducted</option>
            </select>
          </div>
          <div className="lessons-filters-buttons">
            <button type="button" className="lessons-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

 const getFirstDayOfMonth = (year, month) => {
  let day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const getLessonsForDate = (date) => {
    return lessons.filter(lesson => {
      if (!lesson.start_time) return false;
      const lessonDate = new Date(lesson.start_time);
      return isSameDay(lessonDate, date);
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

const renderLessonItem = (lesson) => {
  const isTheory = isTheoryLesson(lesson.lesson_type_id);
  const typeClass = isTheory ? 'theory-lesson' : 'practice-lesson';
  const statusClass = lesson.lesson_status === 'conducted' ? 'conducted' : 'not-conducted';
  
  let title = '';
  if (isTheory) {
    title = `Group: ${lesson.group_name || 'N/A'}, Classroom: ${lesson.classroom_name || 'N/A'}`;
  } else {
    title = `Student: ${lesson.student_name || 'N/A'}, Instructor: ${lesson.instructor_name || 'N/A'}`;
  }
  
  return (
    <div 
      key={lesson.lesson_id} 
      className={`calendar-lesson ${typeClass} ${statusClass}`}
    >
      <div className="lesson-time">{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</div>
      <div className="lesson-title">{title}</div>
      <div className="lesson-topic">{lesson.lesson_topic || 'No topic'}</div>
      <div className="lesson-actions">
        <button 
          className="lesson-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            openEditLessonModal(lesson);
          }}
        >
          Edit
        </button>
        <button 
          className="lesson-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteLesson(lesson.lesson_id);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

  const renderMonthView = () => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  const today = new Date();
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const lessonsForDay = getLessonsForDate(date);
    const isToday = isSameDay(date, today);
    
    days.push(
      <div 
        key={`day-${day}`} 
        className={`calendar-day ${isToday ? 'today' : ''}`}
        onClick={() => openAddLessonModal(date)}
      >
        <div className="day-header">
          <span className="day-number">{day}</span>
        </div>
        <div className="day-lessons">
          {lessonsForDay.map(lesson => renderLessonItem(lesson))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="calendar-month-view">
      <div className="calendar-days-header">
        {daysOfWeek.map(day => (
          <div key={day} className="calendar-day-name">{day}</div>
        ))}
      </div>
      <div className="calendar-days-grid">
        {days}
      </div>
    </div>
  );
};

  const renderCalendarView = () => {
    return (
      <div className="calendar-container">
        <div className="calendar-toolbar">
          <div className="calendar-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <div className="calendar-navigation">
            <button className="calendar-nav-btn" onClick={prevMonth}>Previous</button>
            <button className="calendar-nav-btn today-btn" onClick={goToToday}>Today</button>
            <button className="calendar-nav-btn" onClick={nextMonth}>Next</button>
          </div>
        </div>
      
        {renderMonthView()}
      </div>
    );
  };

  return (
    <div className="lessons-page">
      {/* <div className="lessons-toggle-container">
        <button 
          className="lessons-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Calendar' : 'Show Filters'}
        </button>
      </div> */}
      
      {loading ? (
        <div className="lessons-loading">Loading lessons...</div>
      ) : error ? (
        <div className="lessons-error">{error}</div>
      ) : (
        <div className="lessons-container" style={{
  height: 'calc(100vh - 285px)',
  maxHeight: 'calc(100vh - 285px)',
  marginTop: '1.5rem'
}}>
  {showFilters ? renderFiltersView() : renderCalendarView()}
</div>
      )}
        
      {showLessonModal && (
        <>
          <div className="lessons-modal-backdrop" onClick={() => setShowLessonModal(false)} />
          <div className="lessons-modal">
            <h3>{formMode === 'add' ? 'Add New Lesson' : 'Edit Lesson'}</h3>
<form onSubmit={handleLessonFormSubmit}>
  <div className="lessons-filter-group">
    <label htmlFor="lesson_type_id">Lesson Type:</label>
    <select
      id="lesson_type_id"
      name="lesson_type_id"
      value={lessonForm.lesson_type_id}
      onChange={handleFormChange}
      required
      className="lessons-filter-select"
    >
      <option value="">Select Type</option>
      {lessonTypes.map(type => (
        <option key={type.lesson_type_id} value={type.lesson_type_id}>
          {type.lesson_type}
        </option>
      ))}
    </select>
  </div>
  {lessonForm.lesson_type_id && isTheoryLesson(parseInt(lessonForm.lesson_type_id)) && (
    <>
      <div className="lessons-filter-group">
        <label htmlFor="group_id">Group:</label>
        <select
          id="group_id"
          name="group_id"
          value={lessonForm.group_id}
          onChange={handleFormChange}
          required
          className="lessons-filter-select"
        >
          <option value="">Select Group</option>
          {groups.map(group => (
            <option key={group.group_id} value={group.group_id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="lessons-filter-group">
        <label htmlFor="classroom_id">Classroom:</label>
        <select
          id="classroom_id"
          name="classroom_id"
          value={lessonForm.classroom_id}
          onChange={handleFormChange}
          required
          className="lessons-filter-select"
        >
          <option value="">Select Classroom</option>
          {classrooms.map(classroom => (
            <option key={classroom.classroom_id} value={classroom.classroom_id}>
              {classroom.name}
            </option>
          ))}
        </select>
      </div>
    </>
  )}
  {lessonForm.lesson_type_id && !isTheoryLesson(parseInt(lessonForm.lesson_type_id)) && (
    <>
      <div className="lessons-filter-group">
        <label htmlFor="student_id">Student:</label>
        <select
          id="student_id"
          name="student_id"
          value={lessonForm.student_id}
          onChange={handleFormChange}
          required
          className="lessons-filter-select"
        >
          <option value="">Select Student</option>
          {students.map(student => (
            <option key={student.student_id} value={student.student_id}>
              {student.student_name}
            </option>
          ))}
        </select>
      </div>
      <div className="lessons-filter-group">
        <label htmlFor="instructor_id">Instructor:</label>
        <select
          id="instructor_id"
          name="instructor_id"
          value={lessonForm.instructor_id}
          onChange={handleFormChange}
          required
          className="lessons-filter-select"
        >
          <option value="">Select Instructor</option>
          {instructors.map(instructor => (
            <option key={instructor.instructor_id} value={instructor.instructor_id}>
              {instructor.instructor_name}
            </option>
          ))}
        </select>
      </div>
    </>
  )}
  <div className="lessons-form-row">
    <div className="lessons-filter-group half-width">
      <label htmlFor="start_time">Start Time:</label>
      <input
        type="time"
        id="start_time"
        name="start_time"
        value={lessonForm.start_time}
        onChange={handleFormChange}
        required
        className="lessons-filter-input"
      />
    </div>
        <div className="lessons-filter-group half-width">
      <label htmlFor="end_time">End Time:</label>
      <input
        type="time"
        id="end_time"
        name="end_time"
        value={lessonForm.end_time}
        onChange={handleFormChange}
        required
        className="lessons-filter-input"
      />
    </div>
  </div>
  <div className="lessons-filter-group">
    <label htmlFor="lesson_topic_id">Topic:</label>
    <select
      id="lesson_topic_id"
      name="lesson_topic_id"
      value={lessonForm.lesson_topic_id}
      onChange={handleFormChange}
      required
      className="lessons-filter-select"
    >
      <option value="">Select Topic</option>
      {lessonTopics.map(topic => (
        <option key={topic.lesson_topic_id} value={topic.lesson_topic_id}>
          {topic.lesson_topic}
        </option>
      ))}
    </select>
  </div>

  <div className="lessons-filter-group">
    <label htmlFor="lesson_status_id">Status:</label>
    <select
      id="lesson_status_id"
      name="lesson_status_id"
      value={lessonForm.lesson_status_id}
      onChange={handleFormChange}
      required
      className="lessons-filter-select"
    >
      <option value="">Select Status</option>
      {lessonStatuses.map(status => (
        <option key={status.lesson_status_id} value={status.lesson_status_id}>
          {status.lesson_status}
        </option>
      ))}
    </select>
  </div>

  <div className="lessons-modal-actions">
    <button type="submit" className="lessons-action lessons-action-primary">
      {formMode === 'add' ? 'Add Lesson' : 'Update Lesson'}
    </button>
    <button
      type="button"
      className="lessons-action lessons-action-secondary"
      onClick={() => setShowLessonModal(false)}
    >
      Cancel
    </button>
    {formMode === 'edit' && (
      <button
        type="button"
        className="lessons-action lessons-action-danger"
        onClick={() => {
          setShowLessonModal(false);
          handleDeleteLesson(selectedLesson.lesson_id);
        }}
      >
        Delete
      </button>
    )}
  </div>
</form>
</div>
</>
)}
</div>
);
};

export default LessonsComponent;