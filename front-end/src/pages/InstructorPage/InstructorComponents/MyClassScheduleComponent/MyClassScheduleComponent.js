import React, { useState, useEffect, useCallback } from 'react';
import './MyClassScheduleComponent.css';

const MyClassScheduleComponent = () => {
  const [lessonTypes, setLessonTypes] = useState([]);
  const [lessonStatuses, setLessonStatuses] = useState([]);
  const [lessonTopics, setLessonTopics] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [allLessons, setAllLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    status: ''
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [instructorId, setInstructorId] = useState(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [selectedWeatherDate, setSelectedWeatherDate] = useState(null);
  const [selectedWeatherHour, setSelectedWeatherHour] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [updating, setUpdating] = useState(false);
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getRequestHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'instructor'
    };
  }, []);

  const fetchInstructorId = useCallback(async (username) => {
    try {
      const response = await fetch(`http://localhost:5000/api/instructor/profile/${username}`, {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch instructor information');
      }
      const data = await response.json();
      setInstructorId(data.instructor_id);
    } catch (err) {
      setError('Error loading instructor information: ' + err.message);
      setLoading(false);
    }
  }, [getRequestHeaders]);

  const fetchLessonTypes = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/instructor/lesson_types', {
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
  }, [getRequestHeaders]);

  const fetchLessonStatuses = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/instructor/lesson_statuses', {
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
  }, [getRequestHeaders]);

  const fetchLessonTopics = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/instructor/lesson_topics', {
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
  }, [getRequestHeaders]);

  const fetchInstructorLessons = useCallback(async () => {
    if (!instructorId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/instructor/lessons/${instructorId}`, {
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
  }, [instructorId, getRequestHeaders]);

  const updateLessonStatus = useCallback(async (lessonId, statusId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/instructor/lessons/${lessonId}/status`, {
        method: 'PUT',
        headers: getRequestHeaders(),
        body: JSON.stringify({ statusId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update lesson status');
      }
      
      const result = await response.json();
      
      // Оновити дані після успішної зміни статусу
      await fetchInstructorLessons();
      
      return result;
    } catch (err) {
      console.error('Error updating lesson status:', err);
      throw err;
    }
  }, [getRequestHeaders, fetchInstructorLessons]);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/instructor/students', {
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
  }, [getRequestHeaders]);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username) {
      fetchInstructorId(username);
    } else {
      setError('No instructor information found. Please log in again.');
      setLoading(false);
    }
  }, [fetchInstructorId]);

  useEffect(() => {
    if (instructorId) {
      fetchInstructorLessons();
      fetchStudents();
      fetchLessonTypes();
      fetchLessonStatuses();
      fetchLessonTopics();
    }
  }, [instructorId, fetchInstructorLessons, fetchStudents, fetchLessonTypes, fetchLessonStatuses, fetchLessonTopics]);

  const filterLessons = useCallback(() => {
    let filteredResults = [...allLessons];
    
    if (filters.startDate) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.start_time && lesson.start_time.includes(filters.startDate)
      );
    }
    
    if (filters.status) {
      filteredResults = filteredResults.filter(lesson => 
        lesson.status && lesson.status.toLowerCase() === filters.status.toLowerCase()
      );
    }
    
    setLessons(filteredResults);
  }, [allLessons, filters]);

  useEffect(() => {
    filterLessons();
  }, [filterLessons]);

  // Rest of your component code remains the same...
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
      status: ''
    });
  };

  const getLessonTypeName = (lessonTypeId) => {
    const type = lessonTypes.find(t => t.lesson_type_id === lessonTypeId);
    return type ? type.lesson_type : 'N/A';
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const getStudentName = (studentId) => {
    const student = students.find(s => s.student_id === studentId);
    return student ? student.student_name : 'N/A';
  };

  const getLessonStatusName = (lessonStatusId) => {
    const status = lessonStatuses.find(s => s.lesson_status_id === lessonStatusId);
    return status ? status.lesson_status : 'N/A';
  };

  const getLessonTopicName = (lessonTopicId) => {
    const topic = lessonTopics.find(t => t.lesson_topic_id === lessonTopicId);
    return topic ? topic.lesson_topic : 'N/A';
  };

  const handleDayClick = (date) => {
    const lessonsForDay = getLessonsForDate(date);
    if (lessonsForDay.length > 0) {
      setSelectedDate(date);
      setShowDayModal(true);
    }
  };

  const closeDayModal = () => {
    setShowDayModal(false);
    setSelectedDate(null);
  };

  const isFutureDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate > today;
  };

  const isWithin14Days = (date) => {
    const today = new Date();
    const maxDate = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
    return date <= maxDate;
  };

  const handleWeatherClick = async (date, event) => {
    event.stopPropagation();
    if (!isFutureDate(date) || !isWithin14Days(date)) {
      return;
    }
    
    setSelectedWeatherDate(date);
    setSelectedWeatherHour('');
    setShowWeatherModal(true);
  };

  const openStatusModal = (lesson) => {
    setSelectedLesson(lesson);
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedLesson(null);
    setUpdating(false);
  };

  const handleStatusUpdate = async (statusId) => {
    if (!selectedLesson) return;
    
    setUpdating(true);
    try {
      await updateLessonStatus(selectedLesson.lesson_id, statusId);
      closeStatusModal();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const renderStatusModal = () => {
    if (!showStatusModal || !selectedLesson) return null;
    
    return (
      <div className="modal-overlay" onClick={closeStatusModal}>
        <div className="status-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{ background: 'rgb(200, 157, 217)' }}>
            <h3>Change Lesson Status</h3>
            <button className="modal-close-btn" onClick={closeStatusModal}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="lesson-info">
              <p><strong>Student:</strong> {getStudentName(selectedLesson.student_id)}</p>
              <p><strong>Topic:</strong> {getLessonTopicName(selectedLesson.lesson_topic_id)}</p>
              <p><strong>Time:</strong> {formatTime(selectedLesson.start_time)} - {formatTime(selectedLesson.end_time)}</p>
              <p><strong>Current Status:</strong> {getLessonStatusName(selectedLesson.lesson_status_id)}</p>
            </div>
            
            <div className="status-buttons">
              <h4>Select New Status:</h4>
              <div className="status-options">
                {lessonStatuses.map(status => (
                  <button
                    key={status.lesson_status_id}
                    className={`status-btn ${status.lesson_status_id === selectedLesson.lesson_status_id ? 'current' : ''}`}
                    onClick={() => handleStatusUpdate(status.lesson_status_id)}
                    disabled={updating || status.lesson_status_id === selectedLesson.lesson_status_id}
                  >
                    {updating ? 'Updating...' : status.lesson_status}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="modal-btn" onClick={closeStatusModal}>Cancel</button>
          </div>
        </div>
      </div>
    );
  };

  const WeatherApp = {
    async getWeatherForDate(date, hour = '') {
      try {
        const dateStr = date.toISOString().split('T')[0];
        const params = new URLSearchParams();
        if (hour !== '') {
          params.append('hour', hour);
        }
        const url = `http://localhost:5000/api/weather/${dateStr}?${params.toString()}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'user-role': 'instructor'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
        
      } catch (error) {
        console.error('Weather fetch error:', error);
        return null;
      }
    }
  };

  const WeatherComponent = ({ selectedDate, selectedHour }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      const fetchWeather = async () => {
        setLoading(true);
        const result = await WeatherApp.getWeatherForDate(selectedDate, selectedHour);
        if (result) {
          setWeatherData(result);
          setError(null);
        } else {
          setError('Failed to load weather data for Lviv');
        }
        setLoading(false);
      };

      fetchWeather();
    }, [selectedDate, selectedHour]);

    if (loading) return <div className="loading">🔄 Loading weather...</div>;
    if (error) return <div className="error">❌ {error}</div>;
    if (!weatherData) return <div className="error">No weather data available</div>;

    const { data, selectedHour: hour } = weatherData;
    const forecastDay = data.forecast.forecastday.find(day => 
      day.date === selectedDate.toISOString().split('T')[0]
    );

    if (!forecastDay) return <div className="error">No forecast data for selected date</div>;

    let displayData;
    let isHourly = false;

    if (hour !== '') {
      displayData = forecastDay.hour[parseInt(hour)];
      isHourly = true;
    } else {
      displayData = forecastDay.day;
    }

    const location = data.location;

    return (
      <div className="weather-container">
        <div className="weather-header">
          <div>
            <h3>{location.name}, {location.country}</h3>
            <div className="weather-condition">{displayData.condition.text}</div>
            <div style={{ fontSize: '0.9rem', color: '#636e72', marginTop: '5px' }}>
              {isHourly ? `${formatDate(selectedDate)} at ${hour.padStart(2, '0')}:00` : formatDate(selectedDate)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img 
              src={`https:${displayData.condition.icon}`} 
              alt={displayData.condition.text} 
              style={{ width: '64px', height: '64px' }}
            />
            <div className="weather-temp">
              {isHourly ? Math.round(displayData.temp_c) : Math.round(displayData.maxtemp_c)}°C
            </div>
            {!isHourly && (
              <div style={{ fontSize: '0.9rem', color: '#636e72' }}>
                Min: {Math.round(displayData.mintemp_c)}°C
              </div>
            )}
          </div>
        </div>

        <div className="weather-details">
          <div className="weather-item">
            <span>Humidity:</span> {isHourly ? displayData.humidity : displayData.avghumidity}%
          </div>
          <div className="weather-item">
            <span>Wind:</span> {isHourly ? displayData.wind_kph : displayData.maxwind_kph} km/h
          </div>
          <div className="weather-item">
            <span>Feels like:</span> {isHourly ? Math.round(displayData.feelslike_c) : 'N/A'}°C
          </div>
          <div className="weather-item">
            <span>Precipitation:</span> {isHourly ? displayData.precip_mm : displayData.totalprecip_mm} mm
          </div>
          <div className="weather-item">
            <span>UV Index:</span> {displayData.uv}
          </div>
          <div className="weather-item">
            <span>Visibility:</span> {isHourly ? displayData.vis_km : displayData.avgvis_km} km
          </div>
        </div>

        {!isHourly && (
          <div style={{ marginTop: '25px' }}>
            <h4 style={{ marginBottom: '15px', color: '#2d3436' }}>Hourly Forecast</h4>
            <div className="hourly-forecast" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
              gap: '10px' 
            }}>
              {forecastDay.hour.filter((_, index) => index % 3 === 0).map((hour, index) => {
                const time = new Date(hour.time).getHours();
                return (
                  <div key={index} className="hour-item" style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '15px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    fontSize: '0.9rem'
                  }}>
                    <div style={{ fontWeight: '600', color: '#2d3436', marginBottom: '8px' }}>
                      {time.toString().padStart(2, '0')}:00
                    </div>
                    <img src={`https:${hour.condition.icon}`} alt={hour.condition.text} 
                         style={{ width: '32px', height: '32px' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0984e3' }}>
                      {Math.round(hour.temp_c)}°
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#636e72' }}>
                      {Math.round(hour.chance_of_rain)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWeatherModal = () => {
    if (!showWeatherModal || !selectedWeatherDate) return null;
    
    return (
      <div className="modal-overlay" onClick={closeWeatherModal}>
        <div className="weather-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header-weather-forecast-for">
            <h2>🌤️ Weather Forecast for Lviv - {formatDate(selectedWeatherDate)}</h2>
            <button className="modal-close-btn" onClick={closeWeatherModal}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="weather-hour-selector" style={{ marginBottom: '20px' }}>
              <label htmlFor="hourSelect" style={{ marginRight: '10px', fontWeight: '600' }}>
                Select Time:
              </label>
              <select 
                id="hourSelect"
                value={selectedWeatherHour} 
                onChange={(e) => setSelectedWeatherHour(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  textAlign: 'center',
                  textAlignLast: 'center',
                  appearance: 'none',
                  overflow: 'hidden',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none'
                }}
              >
                <option value="">All day</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            
            <WeatherComponent 
              selectedDate={selectedWeatherDate} 
              selectedHour={selectedWeatherHour} 
            />
          </div>
          
          <div className="modal-footer">
            <button className="modal-btn" onClick={closeWeatherModal}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  const closeWeatherModal = () => {
    setShowWeatherModal(false);
    setSelectedWeatherDate(null);
    setSelectedWeatherHour('');
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
        <h3 style={{ marginTop: '20px' }}>Filter My Lessons</h3>
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

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 6. Оновлений компонент для відображення заняття в календарі
  const renderLessonItem = (lesson) => {
    const statusClass = lesson.lesson_status === 'conducted' ? 'conducted' : 'not-conducted';
    
    return (
      <div 
        key={lesson.lesson_id} 
        className={`calendar-lesson practice-lesson ${statusClass}`}
      >
        <div className="lesson-header">
          <div className="lesson-time">{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</div>
          <button 
            className="quick-status-btn"
            onClick={(e) => {
              e.stopPropagation();
              openStatusModal(lesson);
            }}
            title="Change status"
          >
            ⚙️
          </button>
        </div>
        <div className="lesson-title">Student: {getStudentName(lesson.student_id)}</div>
        <div className="lesson-topic">{getLessonTopicName(lesson.lesson_topic_id) || 'No topic'}</div>
      </div>
    );
  };

  const renderDetailedLessonCard = (lesson) => {
    const statusClass = lesson.lesson_status === 'conducted' ? 'conducted' : 'not-conducted';
    
    return (
      <div key={lesson.lesson_id} className={`detailed-lesson-card practice-lesson ${statusClass}`}>
        <div className="lesson-card-header">
          <div className="lesson-time-range">
            {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
          </div>
          <div className="lesson-actions">
            <div className="lesson-type-badge practice-lesson">
              {getLessonTypeName(lesson.lesson_type_id)}
            </div>
            <button 
              className="status-change-btn"
              onClick={() => openStatusModal(lesson)}
              title="Change status"
            >
              ⚙️
            </button>
          </div>
        </div>
        
        <div className="lesson-card-body">
          <div className="lesson-info-row">
            <strong>Topic:</strong> {getLessonTopicName(lesson.lesson_topic_id) || 'No topic'}
          </div>
          
          <div className="lesson-info-row">
            <strong>Student:</strong> {getStudentName(lesson.student_id)}
          </div>
          
          <div className="lesson-info-row">
            <strong>Status:</strong> 
            <span className={`status-badge ${statusClass}`}>
              {getLessonStatusName(lesson.lesson_status_id)}
            </span>
          </div>
          
          {lesson.notes && (
            <div className="lesson-info-row">
              <strong>Notes:</strong> {lesson.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDayModal = () => {
    if (!showDayModal || !selectedDate) return null;
    
    const lessonsForDay = getLessonsForDate(selectedDate);
    
    return (
      <div className="modal-overlay" onClick={closeDayModal}>
        <div className="day-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header-weather-forecast-for">
            <h2>My Lessons for {formatDate(selectedDate)}</h2>
            <button className="modal-close-btn" onClick={closeDayModal}>×</button>
          </div>
          
          <div className="modal-body">
            {lessonsForDay.length === 0 ? (
              <p>No lessons scheduled for this day.</p>
            ) : (
              <div className="lessons-list">
                {lessonsForDay
                  .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                  .map(lesson => renderDetailedLessonCard(lesson))
                }
              </div>
            )}
          </div>
          
          <div className="modal-footer">
            <button className="modal-btn" onClick={closeDayModal}>Close</button>
          </div>
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
      const hasLessons = lessonsForDay.length > 0;
      const canShowWeather = isFutureDate(date) && isWithin14Days(date);
      days.push(
        <div 
          key={`day-${day}`} 
          className={`calendar-day ${isToday ? 'today' : ''} ${hasLessons ? 'has-lessons' : ''}`}
        >
          <div className="day-header">
            <span className="day-number">{day}</span>
            <div className="day-header-buttons">
              {hasLessons && (
                <span 
                  className="lessons-count"
                  onClick={() => handleDayClick(date)}
                  style={{ cursor: 'pointer' }}
                >
                  {lessonsForDay.length}
                </span>
              )}
              <button 
                className={`weather-btn ${!canShowWeather ? 'disabled' : ''}`}
                onClick={(e) => handleWeatherClick(date, e)}
                title={canShowWeather ? "Check weather for Lviv" : "Weather available only for future dates (up to 14 days)"}
                disabled={!canShowWeather}
                style={{
                  opacity: canShowWeather ? 1 : 0.3,
                  cursor: canShowWeather ? 'pointer' : 'not-allowed'
                }}
              >
                🌤️
              </button>
            </div>
          </div>
          <div className="day-lessons" onClick={() => hasLessons && handleDayClick(date)}>
            {lessonsForDay.slice(0, 3).map(lesson => renderLessonItem(lesson))}
            {lessonsForDay.length > 3 && (
              <div className="more-lessons">+{lessonsForDay.length - 3} more</div>
            )}
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
            My Schedule - {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
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
        <div className="lessons-loading">Loading your lessons...</div>
      ) : error ? (
        <div className="lessons-error">{error}</div>
      ) : (
        <div className="lessons-container"style={{
  height: 'calc(100vh - 285px)',
  maxHeight: 'calc(100vh - 285px)',
  marginTop: '1.5rem'
}}>
          {showFilters ? renderFiltersView() : renderCalendarView()}
        </div>
      )}
      
      {renderDayModal()}
      {renderWeatherModal()}
      {renderStatusModal()}
    </div>
  );
};

export default MyClassScheduleComponent;