import React, { useState, useEffect, useCallback } from 'react';
import './ExamsComponent.css';

const ExamsComponent = () => {
  const [exams, setExams] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [examiners, setExaminers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [examForm, setExamForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    type: 'theory',
    examiner_id: '',
    location_id: ''
  });
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    type: '',
    examinerId: '',
    locationId: ''
  });
  const [allExaminers, setAllExaminers] = useState([]);
  const [allLocations, setAllLocations] = useState([]);

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  useEffect(() => {
    fetchExams();
    fetchAllExaminers();
    fetchAllLocations();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/exams', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch exams');
      }
      const data = await response.json();
      setAllExams(data);
      setExams(data);
      setError(null);
    } catch (err) {
      setError('Error loading exams: ' + err.message);
      setExams([]);
      setAllExams([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllExaminers = async () => {
    try {
      const [theoryResponse, practiceResponse] = await Promise.all([
        fetch('http://localhost:5000/api/admin/examiners?type=theory', {
          headers: getRequestHeaders()
        }),
        fetch('http://localhost:5000/api/admin/examiners?type=practice', {
          headers: getRequestHeaders()
        })
      ]);

      if (!theoryResponse.ok || !practiceResponse.ok) {
        throw new Error('Failed to fetch examiners');
      }

      const theoryData = await theoryResponse.json();
      const practiceData = await practiceResponse.json();
      
      const combined = [...theoryData, ...practiceData];
      setAllExaminers(combined);
    } catch (err) {
      console.error('Error loading all examiners:', err.message);
    }
  };

  const fetchAllLocations = async () => {
    try {
      const [theoryResponse, practiceResponse] = await Promise.all([
        fetch('http://localhost:5000/api/admin/exam-locations?type=theory', {
          headers: getRequestHeaders()
        }),
        fetch('http://localhost:5000/api/admin/exam-locations?type=practice', {
          headers: getRequestHeaders()
        })
      ]);

      if (!theoryResponse.ok || !practiceResponse.ok) {
        throw new Error('Failed to fetch locations');
      }

      const theoryData = await theoryResponse.json();
      const practiceData = await practiceResponse.json();
      
      const combined = [...theoryData, ...practiceData];
      setAllLocations(combined);
    } catch (err) {
      console.error('Error loading all locations:', err.message);
    }
  };

  const fetchExaminers = async (examType) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/examiners?type=${examType}`, {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch examiners');
      }
      const data = await response.json();
      setExaminers(data);
    } catch (err) {
      console.error('Error loading examiners:', err.message);
      setExaminers([]);
    }
  };

  const fetchLocations = async (examType) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/exam-locations?type=${examType}`, {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error('Error loading locations:', err.message);
      setLocations([]);
    }
  };

  const filterExams = useCallback(() => {
    let filteredResults = [...allExams];
    
    // Filter by from date
    if (filters.fromDate) {
      filteredResults = filteredResults.filter(exam => {
        if (!exam.start_time) return false;
        const examDate = new Date(exam.start_time).toISOString().split('T')[0];
        return examDate >= filters.fromDate;
      });
    }
    
    // Filter by to date
    if (filters.toDate) {
      filteredResults = filteredResults.filter(exam => {
        if (!exam.start_time) return false;
        const examDate = new Date(exam.start_time).toISOString().split('T')[0];
        return examDate <= filters.toDate;
      });
    }
    
    // Filter by type
    if (filters.type) {
      filteredResults = filteredResults.filter(exam => 
        exam.type && exam.type.toLowerCase() === filters.type.toLowerCase()
      );
    }
    
    // Filter by examiner
    if (filters.examinerId) {
      filteredResults = filteredResults.filter(exam => {
        const examinerIdStr = filters.examinerId;
        return (exam.instructor_id && exam.instructor_id.toString() === examinerIdStr) ||
               (exam.teacher_id && exam.teacher_id.toString() === examinerIdStr);
      });
    }
    
    // Filter by location
    if (filters.locationId) {
      filteredResults = filteredResults.filter(exam => {
        const locationIdStr = filters.locationId;
        return (exam.classroom_id && exam.classroom_id.toString() === locationIdStr) ||
               (exam.car_id && exam.car_id.toString() === locationIdStr);
      });
    }
    
    setExams(filteredResults);
  }, [allExams, filters]);

  useEffect(() => {
    filterExams();
  }, [filterExams]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      fromDate: '',
      toDate: '',
      type: '',
      examinerId: '',
      locationId: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === 'type') {
      setExamForm(prev => ({
        ...prev,
        [name]: value,
        examiner_id: '',
        location_id: ''
      }));
      fetchExaminers(value);
      fetchLocations(value);
    } else {
      setExamForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const openAddExamModal = async () => {
    setSelectedExam(null);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().substring(0, 5);
    
    setExamForm({
      date: dateStr,
      start_time: timeStr,
      end_time: timeStr,
      type: 'theory',
      examiner_id: '',
      location_id: ''
    });
    setFormMode('add');
    
    await Promise.all([
      fetchExaminers('theory'),
      fetchLocations('theory')
    ]);
    setShowExamModal(true);
  };

  const openEditExamModal = async (exam) => {
    setSelectedExam(exam);
    const parseDateTime = (datetimeStr) => {
      if (!datetimeStr) return { date: '', time: '' };
      const date = new Date(datetimeStr);
      return {
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().substring(0, 5)
      };
    };
    
    const startDateTime = parseDateTime(exam.start_time);
    const endDateTime = parseDateTime(exam.end_time);
    const examType = exam.type ? exam.type.toLowerCase() : 'theory';
    const currentExaminerId = exam.instructor_id || exam.teacher_id || '';
    const currentLocationId = examType === 'theory' ? exam.classroom_id : exam.car_id;
    
    setExamForm({
      date: startDateTime.date,
      start_time: startDateTime.time,
      end_time: endDateTime.time,
      type: examType,
      examiner_id: currentExaminerId.toString(),
      location_id: currentLocationId ? currentLocationId.toString() : ''
    });
    
    setFormMode('edit');
    
    await Promise.all([
      fetchExaminers(examType),
      fetchLocations(examType)
    ]);
    setShowExamModal(true);
  };

  const handleExamFormSubmit = async (e) => {
    e.preventDefault();

    if (!examForm.date || !examForm.start_time || !examForm.end_time) {
      alert('Please fill in all date and time fields');
      return;
    }
    
    if (!examForm.examiner_id) {
      alert('Please select an examiner');
      return;
    }

    if (!examForm.location_id) {
      alert('Please select a location');
      return;
    }
    
    try {
      const createDateTimeString = (dateStr, timeStr) => {
        if (!dateStr || !timeStr) return null;
        return `${dateStr}T${timeStr}:00`;
      };
      const startDateTime = createDateTimeString(examForm.date, examForm.start_time);
      const endDateTime = createDateTimeString(examForm.date, examForm.end_time);
      
      if (new Date(endDateTime) <= new Date(startDateTime)) {
        alert('End time must be after start time');
        return;
      }
      
      const formData = {
        start_time: startDateTime,
        end_time: endDateTime,
        type: examForm.type.toLowerCase(),
        examiner_id: parseInt(examForm.examiner_id, 10),
        location_id: parseInt(examForm.location_id, 10)
      };

      console.log('Submitting exam data:', formData); // Debug log

      let response;
      if (formMode === 'add') {
        response = await fetch('http://localhost:5000/api/admin/exams', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
      } else {
        response = await fetch(`http://localhost:5000/api/admin/exams/${selectedExam.exam_id}`, {
          method: 'PUT',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${formMode} exam`);
      }
      
      setShowExamModal(false);
      await fetchExams();
      
      alert(`Exam ${formMode === 'add' ? 'added' : 'updated'} successfully!`);
      
    } catch (err) {
      console.error('Error submitting exam:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteExam = async (exam_id) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/exams/${exam_id}`, {
          method: 'DELETE',
          headers: getRequestHeaders()
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete exam');
        }
        
        setAllExams(prev => prev.filter(exam => exam.exam_id !== exam_id));
        setExams(prev => prev.filter(exam => exam.exam_id !== exam_id));
        alert('Exam deleted successfully!');
      } catch (err) {
        alert('Error deleting exam: ' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'N/A';
    const date = new Date(datetimeStr);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  const getExaminerName = (exam) => {
    if (exam.examiner_name) {
      return exam.examiner_name;
    }
    const examinerId = exam.instructor_id || exam.teacher_id;
    if (examinerId) {
      const examiner = allExaminers.find(e => e.examiner_id === examinerId);
      if (examiner) {
        return examiner.examiner_name || `${examiner.last_name || ''} ${examiner.first_name || ''}`.trim() || 'Unknown';
      }
    }
    
    return 'N/A';
  };

  const getLocationName = (exam) => {
    if (exam.type && exam.type.toLowerCase() === 'theory') {
      return exam.classroom_name || 'N/A';
    } else if (exam.type && exam.type.toLowerCase() === 'practice') {
      return exam.car_info || 'N/A';
    }
    return 'N/A';
  };

  const getExaminerNameById = (examinerId, examinersList = allExaminers) => {
    const examiner = examinersList.find(e => e.examiner_id === parseInt(examinerId));
    if (!examiner) return 'N/A';
    
    return examiner.examiner_name || `${examiner.last_name || ''} ${examiner.first_name || ''}`.trim() || 'Unknown';
  };

  const getLocationNameById = (locationId, locationsList = allLocations) => {
    const location = locationsList.find(l => l.location_id === parseInt(locationId));
    if (!location) return 'N/A';
    
    return location.location_name || 'Unknown';
  };

  const getExaminerRole = (exam) => {
    if (exam.examiner_role) {
      return exam.examiner_role === 'teacher' ? 'Theory' : 'Practice';
    }
    if (exam.teacher_id) return 'Theory';
    if (exam.instructor_id) return 'Practice';
    
    return '';
  };

  const formatExamType = (examType) => {
    if (!examType) return 'N/A';
    const normalizedType = examType.toLowerCase();
    if (normalizedType === 'theory') {
      return 'Theory';
    } else if (normalizedType === 'practice') {
      return 'Practice';
    }
    return examType.charAt(0).toUpperCase() + examType.slice(1).toLowerCase();
  };

  const renderFiltersView = () => {
    return (
      <div className="exams-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Exams</h3>
        <div className="exams-filters-form">
          <div className="exams-filter-group">
            <label htmlFor="fromDate">From Date:</label>
            <input 
              type="date" 
              id="fromDate" 
              name="fromDate" 
              value={filters.fromDate} 
              onChange={handleFilterChange}
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="toDate">To Date:</label>
            <input 
              type="date" 
              id="toDate" 
              name="toDate" 
              value={filters.toDate} 
              onChange={handleFilterChange}
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="type">Type:</label>
            <select
              id="type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Types</option>
              <option value="theory">Theory</option>
              <option value="practice">Practice</option>
            </select>
          </div>
          <div className="exams-filter-group">
            <label htmlFor="examinerId">Examiner:</label>
            <select
              id="examinerId"
              name="examinerId"
              value={filters.examinerId}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Examiners</option>
              {allExaminers.map(examiner => (
                <option key={examiner.examiner_id} value={examiner.examiner_id}>
                  {getExaminerNameById(examiner.examiner_id)}
                </option>
              ))}
            </select>
          </div>
          <div className="exams-filter-group">
            <label htmlFor="locationId">Location:</label>
            <select
              id="locationId"
              name="locationId"
              value={filters.locationId}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Locations</option>
              {allLocations.map(location => (
                <option key={location.location_id} value={location.location_id}>
                  {getLocationNameById(location.location_id)}
                </option>
              ))}
            </select>
          </div>
          <div className="exams-filters-buttons">
            <button type="button" className="exams-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="exams-table-wrapper">
        <table className="exams-table">
          <thead>
            <tr>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Type</th>
              <th>Examiner</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.length > 0 ? (
              exams.map(exam => (
                <tr key={exam.exam_id}>
                  <td>{formatDateTime(exam.start_time)}</td>
                  <td>{formatDateTime(exam.end_time)}</td>
                  <td>{formatExamType(exam.type)}</td>
                  <td>
                    {getExaminerName(exam)}
                  </td>
                  <td>
                    {getLocationName(exam)}
                  </td>
                  <td>
                    <button 
                      className="exams-action exams-edit" 
                      onClick={() => openEditExamModal(exam)}
                    >
                      Edit
                    </button>
                    <button 
                      className="exams-action exams-delete" 
                      onClick={() => handleDeleteExam(exam.exam_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="exams-loading"><i>No exams found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="exams-page">
      <div className="exams-toggle-container" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button 
          className="exams-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && (
          <button 
            className="exams-add-exam-button" 
            onClick={openAddExamModal}
          >
            Add New Exam
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="exams-loading">Loading exams...</div>
      ) : error ? (
        <div className="exams-error">{error}</div>
      ) : (
        <div className="exams-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showExamModal && (
        <>
          <div className="exams-modal-backdrop" onClick={() => setShowExamModal(false)} />
          <div className="exams-modal">
            <h3>{formMode === 'add' ? 'Add New Exam' : 'Edit Exam'}</h3>
            <form onSubmit={handleExamFormSubmit}>
              <div className="exams-filter-group">
                <label htmlFor="type">Exam Type:</label>
                <select
                  id="type"
                  name="type"
                  value={examForm.type}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-select"
                >
                  <option value="theory">Theory</option>
                  <option value="practice">Practice</option>
                </select>
              </div>
              
              <div className="exams-filter-group">
                <label htmlFor="examiner_id">Examiner:</label>
                <select
                  id="examiner_id"
                  name="examiner_id"
                  value={examForm.examiner_id}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-select"
                >
                  <option value="">Select Examiner</option>
                  {examiners.map(examiner => (
                    <option key={examiner.examiner_id} value={examiner.examiner_id}>
                      {examiner.examiner_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="exams-filter-group">
                <label htmlFor="location_id">
                  {examForm.type === 'theory' ? 'Classroom:' : 'Car:'}
                </label>
                <select
                  id="location_id"
                  name="location_id"
                  value={examForm.location_id}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-select"
                >
                  <option value="">
                    {examForm.type === 'theory' ? 'Select Classroom' : 'Select Car'}
                  </option>
                  {locations.map(location => (
                    <option key={location.location_id} value={location.location_id}>
                      {location.location_name}
                      {location.condition && ` - ${location.condition}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="exams-filter-group">
                <label htmlFor="date">Date:</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={examForm.date}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-input"
                />
              </div>
              <div className="exams-filter-group">
                <label htmlFor="start_time">Start Time:</label>
                <input
                  type="time"
                  id="start_time"
                  name="start_time"
                  value={examForm.start_time}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-input"
                />
              </div>
              <div className="exams-filter-group">
                <label htmlFor="end_time">End Time:</label>
                <input
                  type="time"
                  id="end_time"
                  name="end_time"
                  value={examForm.end_time}
                  onChange={handleFormChange}
                  required
                  className="exams-filter-input"
                />
              </div>
              <div>
                <button type="submit" className="exams-action exams-edit">
                  {formMode === 'add' ? 'Add Exam' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="exams-action exams-delete"
                  onClick={() => setShowExamModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ExamsComponent;