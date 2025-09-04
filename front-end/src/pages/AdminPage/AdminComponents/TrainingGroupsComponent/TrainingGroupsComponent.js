import React, { useState, useEffect, useCallback } from 'react';
import './TrainingGroupsComponent.css';

const TrainingGroupsComponent = () => {
  const [groups, setGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [userRole, setUserRole] = useState('admin');
  const [groupForm, setGroupForm] = useState({
    id: '',
    name: '',
    teacher_id: '',
    current_students: '0'
  });
  const [filters, setFilters] = useState({
    name: '',
    currentStudents: ''
  });

  useEffect(() => {
    const storedRole = localStorage.getItem('userRole') || 'admin';
    setUserRole(storedRole.toLowerCase());
  }, []);

  const getRequestHeaders = (additionalHeaders = {}) => {
    return {
      'Content-Type': 'application/json',
      'user-role': userRole,
      ...additionalHeaders
    };
  };

  useEffect(() => {
    fetchGroups();
    fetchTeachers();
  }, [userRole]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/groups', {
        method: 'GET',
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions to view groups');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      
      const data = await response.json();
      setAllGroups(data);
      setGroups(data);
      setError(null);
    } catch (err) {
      setError('Error loading groups: ' + err.message);
      setGroups([]);
      setAllGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/teachers', {
        method: 'GET',
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        console.error('Access denied: insufficient permissions to view teachers');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch teachers');
      }
      
      const data = await response.json();
      setTeachers(data);
    } catch (err) {
      console.error('Error loading teachers:', err.message);
    }
  };

  const filterGroups = useCallback(() => {
    let filteredResults = [...allGroups];
    
    if (filters.name) {
      filteredResults = filteredResults.filter(group => 
        group.name && group.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    
    if (filters.currentStudents) {
      filteredResults = filteredResults.filter(group => 
        group.current_students && group.current_students.toString().includes(filters.currentStudents)
      );
    }
    
    setGroups(filteredResults);
  }, [allGroups, filters]);

  useEffect(() => {
    filterGroups();
  }, [filterGroups]);

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
      currentStudents: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setGroupForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddGroupModal = () => {
    if (userRole !== 'admin') {
      alert('Access denied: Only administrators can add new groups');
      return;
    }
    
    setSelectedGroup(null);
    setGroupForm({
      id: '',
      name: '',
      teacher_id: '',
      current_students: '0'
    });
    setFormMode('add');
    setShowGroupModal(true);
  };

  const openEditGroupModal = (group) => {
    if (userRole !== 'admin') {
      alert('Access denied: Only administrators can edit groups');
      return;
    }
    
    setSelectedGroup(group);
    setGroupForm({
      id: group.group_id,
      name: group.name || '',
      teacher_id: group.teacher_id || '',
      current_students: group.current_students || '0'
    });
    setFormMode('edit');
    setShowGroupModal(true);
  };

  useEffect(() => {
    if (showGroupModal) {
      fetchTeachers();
    }
  }, [showGroupModal]);

  const handleGroupFormSubmit = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert('Access denied: Only administrators can modify groups');
      return;
    }
    
    try {
      const formData = {
        name: groupForm.name,
        teacher_id: parseInt(groupForm.teacher_id)
      };

      if (formMode === 'add') {
        const response = await fetch('http://localhost:5000/api/admin/groups', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
        
        if (response.status === 403) {
          throw new Error('Access denied: insufficient permissions to create groups');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add group');
        }
        
        const newGroup = await response.json();
        setAllGroups(prev => [...prev, newGroup]);
        setGroups(prev => [...prev, newGroup]);
        alert('Group added successfully');
      } else {
        const response = await fetch(`http://localhost:5000/api/admin/groups/${selectedGroup.group_id}`, {
          method: 'PUT',
          headers: getRequestHeaders(),
          body: JSON.stringify(formData)
        });
        
        if (response.status === 403) {
          throw new Error('Access denied: insufficient permissions to update groups');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update group');
        }
        
        const updatedGroup = await response.json();
        
        setAllGroups(prev => 
          prev.map(group => group.group_id === selectedGroup.group_id ? updatedGroup : group)
        );
        setGroups(prev => 
          prev.map(group => group.group_id === selectedGroup.group_id ? updatedGroup : group)
        );
        alert('Group updated successfully');
      }
      
      setShowGroupModal(false);
      await fetchGroups();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

 const handleDeleteGroup = async (id) => {
    if (userRole !== 'admin') {
      alert('Access denied: Only administrators can delete groups');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/groups/${id}`, {
          method: 'DELETE',
          headers: getRequestHeaders()
        });
        
        if (response.status === 403) {
          throw new Error('Access denied: insufficient permissions to delete groups');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete group');
        }
        
        setAllGroups(prev => prev.filter(group => group.group_id !== id));
        setGroups(prev => prev.filter(group => group.group_id !== id));
        alert('Group deleted successfully');
      } catch (err) {
        alert('Error deleting group: ' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  
  const getTeacherName = (teacherId) => {
    const teacher = teachers.find(t => t.teacher_id === teacherId);
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : 'N/A';
  };

  const renderFiltersView = () => {
    return (
      <div className="groups-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Groups</h3>
        <div className="groups-filters-form">
          <div className="groups-filter-group">
            <label htmlFor="name">Name:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={filters.name} 
              onChange={handleFilterChange} 
              placeholder="Enter group name"
              className="groups-filter-input"
            />
          </div>
          <div className="groups-filter-group">
            <label htmlFor="currentStudents">Current Students:</label>
            <input 
              type="text" 
              id="currentStudents" 
              name="currentStudents" 
              value={filters.currentStudents} 
              onChange={handleFilterChange} 
              placeholder="Filter by number of students"
              className="groups-filter-input"
            />
          </div>
          <div className="groups-filters-buttons">
            <button type="button" className="groups-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="groups-table-wrapper">
        <table className="groups-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Teacher</th>
              <th>Current Students</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length > 0 ? (
              groups.map(group => (
                <tr key={group.group_id}>
                  <td>{group.name || 'N/A'}</td>
                  <td>{getTeacherName(group.teacher_id)}</td>
                  <td>{group.current_students || 0}</td>
                  <td>
                    {userRole === 'admin' ? (
                      <>
                        <button 
                          className="groups-action groups-edit" 
                          onClick={() => openEditGroupModal(group)}
                        >
                          Edit
                        </button>
                        <button 
                          className="groups-action groups-delete" 
                          onClick={() => handleDeleteGroup(group.group_id)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="groups-no-permissions">View Only</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="groups-loading"><i>No groups found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="groups-page">
      <div className="groups-toggle-container">
        <button 
          className="groups-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && userRole === 'admin' && (
          <button 
            className="groups-add-group-button" 
            onClick={openAddGroupModal}
          >
            Add New Group
          </button>
        )}
        
        {!showFilters && userRole !== 'admin' && (
          <div className="groups-role-info">
            Role: {userRole.toUpperCase()} (View Only)
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="groups-loading">Loading groups...</div>
      ) : error ? (
        <div className="groups-error">{error}</div>
      ) : (
        <div className="groups-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showGroupModal && (
        <>
          <div className="groups-modal-backdrop" onClick={() => setShowGroupModal(false)} />
          <div className="groups-modal">
            <h3>{formMode === 'add' ? 'Add New Group' : 'Edit Group'}</h3>
            <form onSubmit={handleGroupFormSubmit}>
              <div className="groups-filter-group">
                <label htmlFor="name">Group Name:</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  value={groupForm.name} 
                  onChange={handleFormChange}
                  required={formMode === 'add'}
                  className="groups-filter-input"
                />
              </div>
              <div className="groups-filter-group">
                <label htmlFor="teacher_id">Teacher:</label>
                <select
                  id="teacher_id"
                  name="teacher_id"
                  value={groupForm.teacher_id}
                  onChange={handleFormChange}
                  required={formMode === 'add'}
                  className="groups-filter-select"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map(teacher => (
                    <option 
                      key={teacher.teacher_id} 
                      value={teacher.teacher_id}
                    >
                      {teacher.last_name} {teacher.first_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="groups-filter-group">
                <label htmlFor="current_students">Current Students (Auto-calculated):</label>
                <input 
                  type="number" 
                  id="current_students" 
                  name="current_students" 
                  value={groupForm.current_students} 
                  readOnly
                  min="0"
                  className="groups-filter-input"
                  style={{
                    backgroundColor: '#f5f5f5',
                    cursor: 'not-allowed',
                    color: '#666'
                  }}
                />
              </div>
              <div>
                <button type="submit" className="groups-action groups-edit">
                  {formMode === 'add' ? 'Add Group' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="groups-action groups-delete"
                  onClick={() => setShowGroupModal(false)}
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

export default TrainingGroupsComponent;