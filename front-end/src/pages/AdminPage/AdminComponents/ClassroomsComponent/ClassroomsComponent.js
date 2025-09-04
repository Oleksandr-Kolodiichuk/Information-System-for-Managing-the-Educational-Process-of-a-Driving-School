import React, { useState, useEffect, useCallback } from 'react';
import './ClassroomsComponent.css';

const ClassroomsComponent = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [allClassrooms, setAllClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [userRole, setUserRole] = useState('');
  const [classroomForm, setClassroomForm] = useState({
    name: '',
    is_available: true
  });

  const [filters, setFilters] = useState({
    name: '',
    is_available: ''
  });

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  const getCurrentUserRole = () => {
    return localStorage.getItem('userRole') || 'admin';
  };

  const handleAuthError = (response) => {
    if (response.status === 403) {
      setError('Access denied: insufficient permissions for this operation');
      return true;
    } else if (response.status === 401) {
      setError('Unauthorized: please log in again');
      return true;
    }
    return false;
  };

  useEffect(() => {
    const role = getCurrentUserRole();
    setUserRole(role);
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/classrooms', {
        method: 'GET',
        headers: getRequestHeaders()
      });
      
      if (handleAuthError(response)) {
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch classrooms: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setAllClassrooms(data);
      setClassrooms(data);
      setError(null);
    } catch (err) {
      setError('Error loading classrooms: ' + err.message);
      setClassrooms([]);
      setAllClassrooms([]);
    } finally {
      setLoading(false);
    }
  };

  const filterClassrooms = useCallback(() => {
    let filteredResults = [...allClassrooms];
    
    if (filters.name) {
      filteredResults = filteredResults.filter(classroom => 
        classroom.name && classroom.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    
    if (filters.is_available !== '') {
      const isAvailable = filters.is_available === 'true';
      filteredResults = filteredResults.filter(classroom => 
        classroom.is_available === isAvailable
      );
    }
    
    setClassrooms(filteredResults);
  }, [allClassrooms, filters]);

  useEffect(() => {
    filterClassrooms();
  }, [filterClassrooms]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      name: '',
      is_available: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setClassroomForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openAddClassroomModal = () => {
    const currentRole = getCurrentUserRole();
    if (currentRole !== 'admin') {
      alert('Access denied: Only administrators can add new classrooms');
      return;
    }
    
    setSelectedClassroom(null);
    setClassroomForm({
      name: '',
      is_available: true
    });
    setFormMode('add');
    setShowClassroomModal(true);
  };

  const openEditClassroomModal = (classroom) => {
    const currentRole = getCurrentUserRole();
    if (!['admin', 'instructor'].includes(currentRole)) {
      alert('Access denied: Insufficient permissions to edit classrooms');
      return;
    }
    
    setSelectedClassroom(classroom);
    setClassroomForm({
      name: classroom.name || '',
      is_available: classroom.is_available !== undefined ? classroom.is_available : true
    });
    
    setFormMode('edit');
    setShowClassroomModal(true);
  };

  const handleClassroomFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = {
        name: classroomForm.name,
        is_available: classroomForm.is_available
      };

      const currentRole = getCurrentUserRole();
      let response;
      
      if (formMode === 'add') {
        if (currentRole !== 'admin') {
          throw new Error('Access denied: Only administrators can add new classrooms');
        }
        
        response = await fetch('http://localhost:5000/api/admin/classrooms', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
        
      } else {
        if (!['admin', 'instructor'].includes(currentRole)) {
          throw new Error('Access denied: Insufficient permissions to edit classrooms');
        }
        
        response = await fetch(`http://localhost:5000/api/admin/classrooms/${selectedClassroom.classroom_id}`, {
          method: 'PUT',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
      }
      
      if (handleAuthError(response)) {
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${formMode} classroom`);
      }
      
      const result = await response.json();
      
      if (formMode === 'add') {
        setAllClassrooms(prev => [...prev, result]);
        setClassrooms(prev => [...prev, result]);
        alert('Classroom added successfully!');
      } else {
        setAllClassrooms(prev => 
          prev.map(classroom => classroom.classroom_id === selectedClassroom.classroom_id ? result : classroom)
        );
        setClassrooms(prev => 
          prev.map(classroom => classroom.classroom_id === selectedClassroom.classroom_id ? result : classroom)
        );
        alert('Classroom updated successfully!');
      }
      
      setShowClassroomModal(false);
      await fetchClassrooms();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteClassroom = async (classroom_id) => {
    const currentRole = getCurrentUserRole();
    if (currentRole !== 'admin') {
      alert('Access denied: Only administrators can delete classrooms');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this classroom?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/classrooms/${classroom_id}`, {
          method: 'DELETE',
          headers: getRequestHeaders()
        });
        
        if (handleAuthError(response)) {
          return;
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete classroom');
        }
        
        setAllClassrooms(prev => prev.filter(classroom => classroom.classroom_id !== classroom_id));
        setClassrooms(prev => prev.filter(classroom => classroom.classroom_id !== classroom_id));
        alert('Classroom deleted successfully!');
      } catch (err) {
        alert('Error deleting classroom: ' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const renderFiltersView = () => {
    return (
      <div className="classrooms-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Classrooms</h3>
        <div className="classrooms-filters-form">
          <div className="classrooms-filter-group">
            <label htmlFor="name">Room Name:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={filters.name} 
              onChange={handleFilterChange}
              className="classrooms-filter-input"
              placeholder="Enter room name"
            />
          </div>
          <div className="classrooms-filter-group">
            <label htmlFor="is_available">Availability:</label>
            <select
              id="is_available"
              name="is_available"
              value={filters.is_available}
              onChange={handleFilterChange}
              className="classrooms-filter-select"
            >
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Not Available</option>
            </select>
          </div>
          <div className="classrooms-filters-buttons">
            <button type="button" className="classrooms-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="classrooms-table-wrapper">
        <table className="classrooms-table">
          <thead>
            <tr>
              <th>Room Name</th>
              <th>Availability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {classrooms.length > 0 ? (
              classrooms.map(classroom => (
                <tr key={classroom.classroom_id}>
                  <td>{classroom.name}</td>
                  <td>
                    <span className={`classrooms-status ${classroom.is_available ? 'status-available' : 'status-unavailable'}`}>
                      {classroom.is_available ? 'Available' : 'Not Available'}
                    </span>
                  </td>
                  <td>
                    {['admin', 'instructor'].includes(getCurrentUserRole()) && (
                      <button 
                        className="classrooms-action classrooms-edit" 
                        onClick={() => openEditClassroomModal(classroom)}
                      >
                        Edit
                      </button>
                    )}
                    {getCurrentUserRole() === 'admin' && (
                      <button 
                        className="classrooms-action classrooms-delete" 
                        onClick={() => handleDeleteClassroom(classroom.classroom_id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="classrooms-loading"><i>No classrooms found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="classrooms-page">
      <div className="classrooms-toggle-container">
        <button 
          className="classrooms-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && getCurrentUserRole() === 'admin' && (
          <button 
            className="classrooms-add-classroom-button" 
            onClick={openAddClassroomModal}
          >
            Add New Classroom
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="classrooms-loading">Loading classrooms...</div>
      ) : error ? (
        <div className="classrooms-error">{error}</div>
      ) : (
        <div className="classrooms-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showClassroomModal && (
        <>
          <div className="classrooms-modal-backdrop" onClick={() => setShowClassroomModal(false)} />
          <div className="classrooms-modal">
            <h3>{formMode === 'add' ? 'Add New Classroom' : 'Edit Classroom'}</h3>
            <form onSubmit={handleClassroomFormSubmit}>
              <div className="classrooms-filter-group">
                <label htmlFor="name">Room Name:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={classroomForm.name}
                  onChange={handleFormChange}
                  required
                  className="classrooms-filter-input"
                  placeholder="Enter room name"
                  maxLength="50"
                />
              </div>
              <div className="classrooms-filter-group">
                <label htmlFor="is_available">Available:</label>
                <input
                  type="checkbox"
                  id="is_available"
                  name="is_available"
                  checked={classroomForm.is_available}
                  onChange={handleFormChange}
                  className="classrooms-filter-checkbox"
                />
              </div>
              <div>
                <button type="submit" className="classrooms-action classrooms-edit">
                  {formMode === 'add' ? 'Add Classroom' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="classrooms-action classrooms-delete"
                  onClick={() => setShowClassroomModal(false)}
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

export default ClassroomsComponent;