import React, { useState, useEffect, useCallback } from 'react';
import './TeachersComponent.css';

const TeachersComponent = () => {
  const [teachers, setTeachers] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [teacherForm, setTeacherForm] = useState({
    TIN: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    login: '',
    password: ''
  });
  const [filters, setFilters] = useState({
    TIN: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    login: '',
    birthDateFrom: '',
    birthDateTo: ''
  });

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/TeachersComponent/teachers', {
        method: 'GET',
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: Insufficient permissions');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch teachers');
      }
      const data = await response.json();
      setAllTeachers(data);
      setTeachers(data);
      setError(null);
    } catch (err) {
      setError('Error loading teachers: ' + err.message);
      setTeachers([]);
      setAllTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterTeachers = useCallback(() => {
    let filteredResults = [...allTeachers];
    
    if (filters.TIN) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.TIN && teacher.TIN.toLowerCase().includes(filters.TIN.toLowerCase())
      );
    }
    
    if (filters.firstName) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.first_name && teacher.first_name.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }
    
    if (filters.lastName) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.last_name && teacher.last_name.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }
    
    if (filters.email) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.email && teacher.email.toLowerCase().includes(filters.email.toLowerCase())
      );
    }

if (filters.birthDateFrom) {
  filteredResults = filteredResults.filter(teacher => {
    if (!teacher.birth_date) return false;
    const teacherBirthDate = new Date(teacher.birth_date);
    const filterFromDate = new Date(filters.birthDateFrom);
    return teacherBirthDate >= filterFromDate;
  });
}

if (filters.birthDateTo) {
  filteredResults = filteredResults.filter(teacher => {
    if (!teacher.birth_date) return false;
    const teacherBirthDate = new Date(teacher.birth_date);
    const filterToDate = new Date(filters.birthDateTo);
    return teacherBirthDate <= filterToDate;
  });
}
    
    if (filters.phone) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.phone && teacher.phone.toLowerCase().includes(filters.phone.toLowerCase())
      );
    }
    
    if (filters.login) {
      filteredResults = filteredResults.filter(teacher => 
        teacher.login && teacher.login.toLowerCase().includes(filters.login.toLowerCase())
      );
    }
    
    setTeachers(filteredResults);
  }, [allTeachers, filters]);

  useEffect(() => {
    filterTeachers();
  }, [filterTeachers]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      TIN: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      login: '',
      birthDateFrom: '',
      birthDateTo: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setTeacherForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddTeacherModal = () => {
    setSelectedTeacher(null);
    setTeacherForm({
      TIN: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      birth_date: '',
      login: '',
      password: ''
    });
    setFormMode('add');
    setShowTeacherModal(true);
  };

  const openEditTeacherModal = (teacher) => {
    setSelectedTeacher(teacher);
    setTeacherForm({
      TIN: teacher.TIN || '',
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      birth_date: teacher.birth_date ? new Date(teacher.birth_date).toISOString().split('T')[0] : '',
      login: teacher.login || '',
      password: ''
    });
    setFormMode('edit');
    setShowTeacherModal(true);
  };

const handleTeacherFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = {
        ...teacherForm
      };

      if (formMode === 'add') {
        const response = await fetch('http://localhost:5000/api/admin/TeachersComponent/teachers', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
        
        if (response.status === 403) {
          throw new Error('Access denied: Insufficient permissions to add teacher');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          // Use the message field from the backend response
          throw new Error(errorData.message || errorData.error || 'Failed to add teacher');
        }
        
        await fetchTeachers();
        alert('Teacher added successfully!');
      } else {
        const response = await fetch(`http://localhost:5000/api/admin/TeachersComponent/teachers/${selectedTeacher.teacher_id}`, {
          method: 'PUT',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
        
        if (response.status === 403) {
          throw new Error('Access denied: Insufficient permissions to update teacher');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          // Use the message field from the backend response
          throw new Error(errorData.message || errorData.error || 'Failed to update teacher');
        }
        
        await fetchTeachers();
        alert('Teacher updated successfully!');
      }
      
      setShowTeacherModal(false);
    } catch (err) {
      console.error('Teacher form submission error:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
  if (window.confirm('Are you sure you want to delete this teacher?')) {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/TeachersComponent/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: Insufficient permissions to delete teacher');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // Use the specific error message from the backend
        throw new Error(data.message || 'Failed to delete teacher');
      }
      
      // Success - remove teacher from state
      setAllTeachers(prev => prev.filter(teacher => teacher.teacher_id !== teacherId));
      setTeachers(prev => prev.filter(teacher => teacher.teacher_id !== teacherId));
      alert(data.message || 'Teacher deleted successfully!');
      
    } catch (err) {
      alert('Error deleting teacher: ' + err.message);
    }
  }
};

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const renderFiltersView = () => {
    return (
      <div className="teachers-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Teachers</h3>
        <div className="teachers-filters-form">
          <div className="teachers-filter-group">
            <label htmlFor="TIN">TIN:</label>
            <input 
              type="text" 
              id="TIN" 
              name="TIN" 
              value={filters.TIN} 
              onChange={handleFilterChange} 
              placeholder="Enter TIN"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filter-group">
            <label htmlFor="firstName">First Name:</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={filters.firstName} 
              onChange={handleFilterChange} 
              placeholder="Enter first name"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filter-group">
            <label htmlFor="lastName">Last Name:</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={filters.lastName} 
              onChange={handleFilterChange} 
              placeholder="Enter last name"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filter-group">
            <label htmlFor="email">Email:</label>
            <input 
              type="text" 
              id="email" 
              name="email" 
              value={filters.email} 
              onChange={handleFilterChange} 
              placeholder="Enter email"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filter-group">
            <label htmlFor="phone">Phone:</label>
            <input 
              type="text" 
              id="phone" 
              name="phone" 
              value={filters.phone} 
              onChange={handleFilterChange} 
              placeholder="Enter phone"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filter-group">
  <label htmlFor="birthDateFrom">Birth Date From:</label>
  <input 
    type="date" 
    id="birthDateFrom" 
    name="birthDateFrom" 
    value={filters.birthDateFrom} 
    onChange={handleFilterChange}
    className="teachers-filter-input"
  />
</div>
<div className="teachers-filter-group">
  <label htmlFor="birthDateTo">Birth Date To:</label>
  <input 
    type="date" 
    id="birthDateTo" 
    name="birthDateTo" 
    value={filters.birthDateTo} 
    onChange={handleFilterChange}
    className="teachers-filter-input"
  />
</div>
          <div className="teachers-filter-group">
            <label htmlFor="login">Login:</label>
            <input 
              type="text" 
              id="login" 
              name="login" 
              value={filters.login} 
              onChange={handleFilterChange} 
              placeholder="Enter login"
              className="teachers-filter-input"
            />
          </div>
          <div className="teachers-filters-buttons">
            <button type="button" className="teachers-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="teachers-table-wrapper">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>TIN</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Birth Date</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length > 0 ? (
              teachers.map(teacher => (
                <tr key={teacher.teacher_id}>
                  <td>{teacher.TIN || 'N/A'}</td>
                  <td>{teacher.first_name || 'N/A'}</td>
                  <td>{teacher.last_name || 'N/A'}</td>
                  <td>{teacher.birth_date ? new Date(teacher.birth_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{teacher.email || 'N/A'}</td>
                  <td>{teacher.phone || 'N/A'}</td>
                  <td>{teacher.login || 'N/A'}</td>
                  <td>
                    <button 
                      className="teachers-action teachers-edit" 
                      onClick={() => openEditTeacherModal(teacher)}
                    >
                      Edit
                    </button>
                    <button 
                      className="teachers-action teachers-delete" 
                      onClick={() => handleDeleteTeacher(teacher.teacher_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="teachers-loading"><i>No teachers found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="teachers-page">
      <div className="teachers-toggle-container">
        <button 
          className="teachers-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && (
          <button 
            className="teachers-add-teacher-button" 
            onClick={openAddTeacherModal}
          >
            Add New Teacher
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="teachers-loading">Loading teachers...</div>
      ) : error ? (
        <div className="teachers-error">{error}</div>
      ) : (
        <div className="teachers-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showTeacherModal && (
        <>
          <div className="teachers-modal-backdrop" onClick={() => setShowTeacherModal(false)} />
          <div className="teachers-modal">
            <h3>{formMode === 'add' ? 'Add New Teacher' : 'Edit Teacher'}</h3>
            <form onSubmit={handleTeacherFormSubmit}>
              <div className="teachers-filter-group">
                <label htmlFor="TIN">TIN:</label>
                <input 
                  type="text" 
                  id="TIN" 
                  name="TIN" 
                  value={teacherForm.TIN} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="first_name">First Name:</label>
                <input 
                  type="text" 
                  id="first_name" 
                  name="first_name" 
                  value={teacherForm.first_name} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="last_name">Last Name:</label>
                <input 
                  type="text" 
                  id="last_name" 
                  name="last_name" 
                  value={teacherForm.last_name} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="login">Login:</label>
                <input 
                  type="text" 
                  id="login" 
                  name="login" 
                  value={teacherForm.login} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                  placeholder="Enter login"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="password">Password:</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  value={teacherForm.password} 
                  onChange={handleFormChange}
                  required={formMode === 'add'}
                  minLength="4"
                  className="teachers-filter-input"
                  placeholder={formMode === 'add' ? 'Enter password (min 4 characters)' : 'Leave empty to keep current password'}
                />
                {formMode === 'edit' && (
                  <small style={{color: '#666', fontSize: '12px'}}>
                    Leave empty to keep current password
                  </small>
                )}
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="email">Email:</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={teacherForm.email} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="birth_date">Birth Date:</label>
                <input 
                  type="date" 
                  id="birth_date" 
                  name="birth_date" 
                  value={teacherForm.birth_date} 
                  onChange={handleFormChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="teachers-filter-input"
                />
              </div>
              <div className="teachers-filter-group">
                <label htmlFor="phone">Phone:</label>
                <input 
                  type="text" 
                  id="phone" 
                  name="phone" 
                  value={teacherForm.phone} 
                  onChange={handleFormChange}
                  required
                  className="teachers-filter-input"
                />
              </div>
              <div>
                <button type="submit" className="teachers-action teachers-edit">
                  {formMode === 'add' ? 'Add Teacher' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="teachers-action teachers-delete"
                  onClick={() => setShowTeacherModal(false)}
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

export default TeachersComponent;