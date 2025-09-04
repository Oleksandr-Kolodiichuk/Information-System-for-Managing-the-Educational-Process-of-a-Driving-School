import React, { useState, useEffect, useCallback } from 'react';
import './MyExamsComponent.css';

const MyExamsComponent = () => {
  const [exams, setExams] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [allCars, setAllCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    carId: ''
  });
  const getRequestHeaders = () => {
    const username = localStorage.getItem('username');
    console.log('Username from localStorage:', username);
    return {
      'Content-Type': 'application/json',
      'user-role': 'instructor',
      'username': username
    };
  };

  useEffect(() => {
    fetchMyExams();
    fetchAllCars();
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
      
      const response = await fetch('http://localhost:5000/api/instructor/my-exams', {
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

  const fetchAllCars = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/cars', {
        headers: {
          'Content-Type': 'application/json',
          'user-role': 'instructor'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cars');
      }

      const data = await response.json();
      setAllCars(data);
    } catch (err) {
      console.error('Error loading cars:', err.message);
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
    
    if (filters.carId) {
      filteredResults = filteredResults.filter(exam => 
        exam.car_id && exam.car_id.toString() === filters.carId
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
      carId: ''
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

  const getLocationName = (exam) => {
    if (exam.type && exam.type.toLowerCase() === 'theory') {
      return exam.classroom_name || 'N/A';
    } else if (exam.type && exam.type.toLowerCase() === 'practice') {
      return exam.car_info || 'N/A';
    }
    return 'N/A';
  };

  const getCarInfoById = (carId) => {
    const car = allCars.find(c => c.car_id === parseInt(carId));
    if (!car) return 'N/A';
    return car.car_info || `${car.brand_name || ''} ${car.model_name || ''}`.trim() || 'Unknown Car';
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
            <label htmlFor="carId">Car:</label>
            <select
              id="carId"
              name="carId"
              value={filters.carId}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Cars</option>
              {allCars.map(car => (
                <option key={car.car_id} value={car.car_id}>
                  {getCarInfoById(car.car_id)}
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
              <th>Car</th>
            </tr>
          </thead>
          <tbody>
            {exams.length > 0 ? (
              exams.map(exam => (
                <tr key={exam.exam_id}>
                  <td>{formatDateTime(exam.start_time)}</td>
                  <td>{formatDateTime(exam.end_time)}</td>
                  <td>{formatExamType(exam.type)}</td>
                  <td>{getLocationName(exam)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="exams-loading">
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