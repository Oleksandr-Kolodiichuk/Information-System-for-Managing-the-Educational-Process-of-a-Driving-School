import React, { useState, useEffect, useCallback } from 'react';
import './MyExamsComponent.css';

const MyExamsComponent = () => {
  const [exams, setExams] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [allClassrooms, setAllClassrooms] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    classroomId: '',
    groupId: ''
  });

  const getRequestHeaders = () => {
    const username = localStorage.getItem('username');
    
    console.log('Username from localStorage:', username);
    
    return {
      'Content-Type': 'application/json',
      'user-role': 'teacher',
      'username': username
    };
  };

  useEffect(() => {
    fetchMyExams();
    fetchAllClassrooms();
    fetchAllGroups();
  }, []);

  const fetchMyExams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = getRequestHeaders();
      console.log('Request headers:', headers);
      
      if (!headers.username) {
        throw new Error('Username not found in localStorage');
      }
      
      const response = await fetch('http://localhost:5000/api/teacher/my-exams', {
        method: 'GET',
        headers: headers
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch exams');
      }
      
      const data = await response.json();
      console.log('Fetched exams data:', data);
      
      setAllExams(data);
      setExams(data);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Error loading exams: ' + err.message);
      setExams([]);
      setAllExams([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClassrooms = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/classrooms', {
        headers: {
          'Content-Type': 'application/json',
          'user-role': 'teacher'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch classrooms');
      }

      const data = await response.json();
      setAllClassrooms(data);
    } catch (err) {
      console.error('Error loading classrooms:', err.message);
    }
  };

  const fetchAllGroups = async () => {
    try {
      const headers = getRequestHeaders();
      const response = await fetch('http://localhost:5000/api/teacher/my-groups', {
        headers: headers
      });

      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      setAllGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err.message);
    }
  };

  const filterExams = useCallback(() => {
    let filteredResults = [...allExams];
    
    if (filters.startDate) {
      filteredResults = filteredResults.filter(exam => {
        if (!exam.start_time) return false;
        const examDate = new Date(exam.start_time).toISOString().split('T')[0];
        return examDate === filters.startDate;
      });
    }
    
    if (filters.classroomId) {
      filteredResults = filteredResults.filter(exam => 
        exam.classroom_id && exam.classroom_id.toString() === filters.classroomId
      );
    }

    if (filters.groupId) {
      filteredResults = filteredResults.filter(exam => 
        exam.groups && exam.groups.some(group => group.group_id.toString() === filters.groupId)
      );
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
      startDate: '',
      classroomId: '',
      groupId: ''
    });
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'N/A';
    try {
      const date = new Date(datetimeStr);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const getClassroomName = (exam) => {
    return exam.classroom_name || 'N/A';
  };

  const getClassroomInfoById = (classroomId) => {
    const classroom = allClassrooms.find(c => c.classroom_id === parseInt(classroomId));
    if (!classroom) return 'N/A';
    return classroom.name || 'Unknown Classroom';
  };

  const getGroupInfoById = (groupId) => {
    const group = allGroups.find(g => g.group_id === parseInt(groupId));
    if (!group) return 'N/A';
    return group.name || 'Unknown Group';
  };

  const formatGroupNames = (exam) => {
    if (!exam.groups || exam.groups.length === 0) {
      return 'No groups';
    }
    
    return exam.groups.map(group => group.group_name).join(', ');
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
        <h3 style={{ marginTop: '20px' }}>Filter My Exams</h3>
        <div className="exams-filters-form">
          <div className="exams-filter-group">
            <label htmlFor="startDate">Date:</label>
            <input 
              type="date" 
              id="startDate" 
              name="startDate" 
              value={filters.startDate} 
              onChange={handleFilterChange}
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="classroomId">Classroom:</label>
            <select
              id="classroomId"
              name="classroomId"
              value={filters.classroomId}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Classrooms</option>
              {allClassrooms.map(classroom => (
                <option key={classroom.classroom_id} value={classroom.classroom_id}>
                  {getClassroomInfoById(classroom.classroom_id)}
                </option>
              ))}
            </select>
          </div>
          <div className="exams-filter-group">
            <label htmlFor="groupId">Group:</label>
            <select
              id="groupId"
              name="groupId"
              value={filters.groupId}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Groups</option>
              {allGroups.map(group => (
                <option key={group.group_id} value={group.group_id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="exams-filters-buttons">
            <button type="button" className="exams-action" onClick={handleClearFilters}>
              Clear Filters
            </button>
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
              <th>Classroom</th>
              <th>Group</th>
            </tr>
          </thead>
          <tbody>
            {exams.length > 0 ? (
              exams.map(exam => (
                <tr key={exam.exam_id}>
                  <td>{formatDateTime(exam.start_time)}</td>
                  <td>{formatDateTime(exam.end_time)}</td>
                  <td>{formatExamType(exam.type)}</td>
                  <td>{getClassroomName(exam)}</td>
                  <td>{formatGroupNames(exam)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="exams-loading">
                  <i>No exams found</i>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };
  
  const username = localStorage.getItem('username');
  if (!username) {
    return (
      <div className="exams-page">
        <div className="exams-error">
          Please log in to view your exams.
        </div>
      </div>
    );
  }

  return (
    <div className="exams-page">
      <div className="exams-toggle-container">
        <button 
          className="exams-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
      </div>
      
      {loading ? (
        <div className="exams-loading">Loading my exams...</div>
      ) : error ? (
        <div className="exams-error">
          {error}
          <button 
            className="exams-action retry-btn" 
            onClick={fetchMyExams}
            style={{ marginLeft: '10px' }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="exams-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
    </div>
  );
};

export default MyExamsComponent;