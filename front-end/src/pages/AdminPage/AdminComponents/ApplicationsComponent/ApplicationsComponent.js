import React, { useState, useEffect, useCallback, useMemo } from 'react';

const ApplicationsComponent = () => {
  const [applications, setApplications] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    status: ''
  });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStudentDataModal, setShowStudentDataModal] = useState(false);
  const [studentDataForm, setStudentDataForm] = useState({
    group_id: '',
    instructor_id: ''
  });
  const [groups, setGroups] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    fromDate: '',
    toDate: '',
    name: '',
    tin: '',
    firstName: '',
    lastName: '',
    birthDateFrom: '',
    birthDateTo: '',
    email: '',
    phone: '',
    submissionDateFrom: '',
    submissionDateTo: '',
    approvalDateFrom: '',
    approvalDateTo: ''
  });

  const getAuthHeaders = () => {
    const userRole = localStorage.getItem('userRole');
    return {
      'Content-Type': 'application/json',
      'user-role': userRole || 'admin'
    };
  };

  useEffect(() => {
    fetchApplications();
    fetchGroups();
    fetchInstructors();
  }, []); 

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/ApplicationsComponent/applications', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setAllApplications(data);
      setApplications(data);
      setError(null);
    } catch (err) {
      setError('Error loading applications: ' + err.message);
      setApplications([]);
      setAllApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/ApplicationsComponent/groups', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err.message);
    }
  };

  const fetchInstructors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/ApplicationComponent/instructors', {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch instructors: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setInstructors(data);
    } catch (err) {
      console.error('Error loading instructors:', err.message);
    }
  };

  const filterApplications = useCallback(() => {
    let filteredResults = [...allApplications];
    if (filters.name) {
      filteredResults = filteredResults.filter(app => 
        `${app.first_name} ${app.last_name}`
          .toLowerCase()
          .includes(filters.name.toLowerCase())
      );
    }
    if (filters.tin) {
      filteredResults = filteredResults.filter(app => 
        app.TIN && app.TIN.includes(filters.tin)
      );
    }
    if (filters.status) {
      filteredResults = filteredResults.filter(app => 
        app.status === filters.status
      );
    }
    if (filters.category) {
      filteredResults = filteredResults.filter(app => 
        app.study_category === filters.category
      );
    }
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      filteredResults = filteredResults.filter(app => 
        app.submission_date && new Date(app.submission_date) >= fromDate
      );
    }
    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      toDate.setHours(23, 59, 59);
      filteredResults = filteredResults.filter(app => 
        app.submission_date && new Date(app.submission_date) <= toDate
      );
    }
    if (filters.firstName) {
      filteredResults = filteredResults.filter(app => 
        app.first_name && app.first_name.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }
    if (filters.lastName) {
      filteredResults = filteredResults.filter(app => 
        app.last_name && app.last_name.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }
    if (filters.birthDateFrom) {
      const fromDate = new Date(filters.birthDateFrom);
      filteredResults = filteredResults.filter(app => 
        app.birth_date && new Date(app.birth_date) >= fromDate
      );
    }
    if (filters.birthDateTo) {
      const toDate = new Date(filters.birthDateTo);
      toDate.setHours(23, 59, 59);
      filteredResults = filteredResults.filter(app => 
        app.birth_date && new Date(app.birth_date) <= toDate
      );
    }
    if (filters.email) {
      filteredResults = filteredResults.filter(app => 
        app.email && app.email.toLowerCase().includes(filters.email.toLowerCase())
      );
    }
    if (filters.phone) {
      filteredResults = filteredResults.filter(app => 
        app.phone && app.phone.includes(filters.phone)
      );
    }
    if (filters.submissionDateFrom) {
      const fromDate = new Date(filters.submissionDateFrom);
      filteredResults = filteredResults.filter(app => 
        app.submission_date && new Date(app.submission_date) >= fromDate
      );
    }
    if (filters.submissionDateTo) {
      const toDate = new Date(filters.submissionDateTo);
      toDate.setHours(23, 59, 59);
      filteredResults = filteredResults.filter(app => 
        app.submission_date && new Date(app.submission_date) <= toDate
      );
    }
    if (filters.approvalDateFrom) {
      const fromDate = new Date(filters.approvalDateFrom);
      filteredResults = filteredResults.filter(app => 
        app.approval_date && new Date(app.approval_date) >= fromDate
      );
    }
    if (filters.approvalDateTo) {
      const toDate = new Date(filters.approvalDateTo);
      toDate.setHours(23, 59, 59);
      filteredResults = filteredResults.filter(app => 
        app.approval_date && new Date(app.approval_date) <= toDate
      );
    }

    setApplications(filteredResults);
  }, [allApplications, filters]);

  useEffect(() => {
    filterApplications();
  }, [filterApplications]);

  const formatDate = useMemo(() => (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA');
  }, []);

  const formatDateTime = useMemo(() => (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('uk-UA') + ' ' + date.toLocaleTimeString('uk-UA');
  }, []);

  const openStatusModal = (application) => {
      if (application.status === 'Approved') {
    alert('Cannot update status of already approved applications');
    return;
  }
    setSelectedApplication(application);
    setStatusUpdateForm({
      status: application.status || ''
    });
    setShowStatusModal(true);
  };

  const handleStatusFormChange = (e) => {
    const { name, value } = e.target;
    setStatusUpdateForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      category: '',
      fromDate: '',
      toDate: '',
      name: '',
      tin: '',
      firstName: '',
      lastName: '',
      birthDateFrom: '',
      birthDateTo: '',
      email: '',
      phone: '',
      submissionDateFrom: '',
      submissionDateTo: '',
      approvalDateFrom: '',
      approvalDateTo: ''
    });
  };

  const handleStudentDataFormChange = (e) => {
    const { name, value } = e.target;
    setStudentDataForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedApplication) return;
    if (statusUpdateForm.status === 'Approved') {
      setShowStatusModal(false);
      setStudentDataForm({
        group_id: '',
        instructor_id: ''
      });
      setShowStudentDataModal(true);
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:5000/api/admin/ApplicationsComponent/applications/${selectedApplication.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: statusUpdateForm.status
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to update application status: ${response.status} ${response.statusText}`);
      }
      const updatedApplication = await response.json();
      updateApplicationsState(updatedApplication);
      setShowStatusModal(false);
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleStudentDataSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApplication) return;
    try {
      const appResponse = await fetch(`http://localhost:5000/api/admin/ApplicationsComponent/applications/${selectedApplication.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'Approved'
        })
      });
      if (!appResponse.ok) {
        throw new Error(`Failed to update application status: ${appResponse.status} ${appResponse.statusText}`);
      }
      const updatedApplication = await appResponse.json();
      const studentData = {
        first_name: selectedApplication.first_name,
        last_name: selectedApplication.last_name,
        birth_date: selectedApplication.birth_date,
        email: selectedApplication.email,
        phone: selectedApplication.phone,
        tin: selectedApplication.TIN,
        application_id: selectedApplication.id,
        group_id: selectedApplication.study_category === 'Theory' ? studentDataForm.group_id : null,
        instructor_id: selectedApplication.study_category !== 'Theory' ? studentDataForm.instructor_id : null
      };
      const studentResponse = await fetch('http://localhost:5000/api/admin/ApplicationsComponent/students', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(studentData)
      });
        if (!studentResponse.ok) {
      const errorData = await studentResponse.json();
      throw new Error(errorData.message || `Failed to create student record: ${studentResponse.status} ${studentResponse.statusText}`);
    }
      updateApplicationsState(updatedApplication);
      setShowStudentDataModal(false);
      alert('Application approved and student record created successfully!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const updateApplicationsState = (updatedApplication) => {
    setApplications(prevApplications => 
      prevApplications.map(app => 
        app.id === updatedApplication.id ? updatedApplication : app
      )
    );
    setAllApplications(prevApplications => 
      prevApplications.map(app => 
        app.id === updatedApplication.id ? updatedApplication : app
      )
    );
  };

  const handleDeleteApplication = async (id) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/ApplicationsComponent/applications/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          throw new Error(`Failed to delete application: ${response.status} ${response.statusText}`);
        }
        setApplications(prevApplications => 
          prevApplications.filter(app => app.id !== id)
        );
        setAllApplications(prevApplications => 
          prevApplications.filter(app => app.id !== id)
        );
        alert('Application deleted successfully!');
      } catch (err) {
        alert('Error deleting application: ' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const renderFiltersView = () => {
    return (
      <div className="filters-container">
        <h3 className="filters-title">Filter Applications</h3>
        <div className="filters-form">
          <div className="filter-group">
            <label htmlFor="firstName">First Name:</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={filters.firstName} 
              onChange={handleFilterChange} 
              placeholder="Enter first name"
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="lastName">Last Name:</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={filters.lastName} 
              onChange={handleFilterChange} 
              placeholder="Enter last name"
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="tin">TIN:</label>
            <input 
              type="text" 
              id="tin" 
              name="tin" 
              value={filters.tin} 
              onChange={handleFilterChange} 
              placeholder="Enter TIN"
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="email">Email:</label>
            <input 
              type="text" 
              id="email" 
              name="email" 
              value={filters.email} 
              onChange={handleFilterChange} 
              placeholder="Enter email"
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="phone">Phone:</label>
            <input 
              type="text" 
              id="phone" 
              name="phone" 
              value={filters.phone} 
              onChange={handleFilterChange} 
              placeholder="Enter phone"
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="birthDateFrom">Birth Date From:</label>
            <input 
              type="date" 
              id="birthDateFrom" 
              name="birthDateFrom" 
              value={filters.birthDateFrom} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="birthDateTo">Birth Date To:</label>
            <input 
              type="date" 
              id="birthDateTo" 
              name="birthDateTo" 
              value={filters.birthDateTo} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="submissionDateFrom">Submission Date From:</label>
            <input 
              type="date" 
              id="submissionDateFrom" 
              name="submissionDateFrom" 
              value={filters.submissionDateFrom} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="submissionDateTo">Submission Date To:</label>
            <input 
              type="date" 
              id="submissionDateTo" 
              name="submissionDateTo" 
              value={filters.submissionDateTo} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="approvalDateFrom">Approval Date From:</label>
            <input 
              type="date" 
              id="approvalDateFrom" 
              name="approvalDateFrom" 
              value={filters.approvalDateFrom} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="approvalDateTo">Approval Date To:</label>
            <input 
              type="date" 
              id="approvalDateTo" 
              name="approvalDateTo" 
              value={filters.approvalDateTo} 
              onChange={handleFilterChange}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="status">Status:</label>
            <select 
              id="status" 
              name="status" 
              value={filters.status} 
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="category">Category:</label>
            <select 
              id="category" 
              name="category" 
              value={filters.category} 
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="Category A">Category A</option>
              <option value="Category B">Category B</option>
              <option value="Category C">Category C</option>
              <option value="Category D">Category D</option>
              <option value="Theory">Theory</option>
            </select>
          </div>
          <div className="filters-buttons">
            <button type="button" className="clear-filters-button" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="table-wrapper dynamic-height">
        <table className="applications-table">
          <thead>
            <tr>
              <th>TIN</th>
              <th>Name</th>
              <th>Birth Date</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Submission Date</th>
              <th>Category</th>
              <th>Status</th>
              <th>Approval Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.length > 0 ? (
              applications.map(app => (
                <tr key={app.id}>
                  <td>{app.TIN || 'N/A'}</td>
                  <td>{`${app.first_name} ${app.last_name}`}</td>
                  <td>{formatDate(app.birth_date)}</td>
                  <td>{app.email}</td>
                  <td>{app.phone}</td>
                  <td>{formatDate(app.submission_date)}</td>
                  <td>{app.study_category}</td>
                  <td>
                    <span className={`status-badge status-${app.status?.toLowerCase() || 'pending'}`}>
                      {app.status || 'Pending'}
                    </span>
                  </td>
                  <td>{formatDate(app.approval_date)}</td>
<td>
  {app.status === 'Approved' ? (
    <button 
      className="action-button delete-button" 
      onClick={() => handleDeleteApplication(app.id)}
    >
      Delete
    </button>
  ) : (
    <>
      <button 
        className="action-button edit-button" 
        onClick={() => openStatusModal(app)}
      >
        Update Status
      </button>
      <button 
        className="action-button delete-button" 
        onClick={() => handleDeleteApplication(app.id)}
      >
        Delete
      </button>
    </>
  )}
</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="no-records">No applications found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-content">
      <div className="toggle-container"
        style={{ display: 'flex', justifyContent: 'center'}}>
        <button 
          className={`toggle-view-button ${!showFilters ? 'active' : ''}`} 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
      </div>
      {loading ? (
        <div className="loading-indicator">Loading applications...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="applications-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
      {showStatusModal && selectedApplication && (
        <>
          <div className="modal-backdrop" onClick={() => setShowStatusModal(false)} />
          <div className="modal-container">
            <h3>Update Application Status</h3>
            <p>Applicant: {selectedApplication.first_name} {selectedApplication.last_name}</p>
            <form onSubmit={handleStatusUpdate} className="status-form">
              <div className="form-group">
                <label htmlFor="status">Status:</label>
                <select 
                  id="status" 
                  name="status" 
                  value={statusUpdateForm.status} 
                  onChange={handleStatusFormChange}
                  required
                >
                  <option value="">Select Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="form-note">
                <p>Note: The approval date will be automatically set when status changes to "Approved".</p>
                {selectedApplication.approval_date && (
                  <p>Current approval date: {formatDate(selectedApplication.approval_date)}</p>
                )}
              </div>
              <div className="modal-buttons">
                <button type="submit" className="save-button">Save Changes</button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowStatusModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
      {showStudentDataModal && selectedApplication && (
        <>
          <div className="modal-backdrop" onClick={() => setShowStudentDataModal(false)} />
          <div className="modal-container">
            <h3>Add Student Information</h3>
            <p>Applicant: {selectedApplication.first_name} {selectedApplication.last_name}</p>
            <form onSubmit={handleStudentDataSubmit} className="student-data-form">
              {selectedApplication.study_category === 'Theory' ? (
                <div className="form-group">
                  <label htmlFor="group_id">Group:</label>
                  <select 
                    id="group_id" 
                    name="group_id" 
                    value={studentDataForm.group_id} 
                    onChange={handleStudentDataFormChange}
                    required
                  >
                    <option value="">Select Group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="instructor_id">Instructor:</label>
                  <select 
                    id="instructor_id" 
                    name="instructor_id" 
                    value={studentDataForm.instructor_id} 
                    onChange={handleStudentDataFormChange}
                    required
                  >
                    <option value="">Select Instructor</option>
                    {instructors.map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.first_name} {instructor.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="student-fields-info">
                <p>The following information will be automatically transferred:</p>
                <ul>
                  <li><strong>First Name:</strong> {selectedApplication.first_name}</li>
                  <li><strong>Last Name:</strong> {selectedApplication.last_name}</li>
                  <li><strong>Birth Date:</strong> {formatDate(selectedApplication.birth_date)}</li>
                  <li><strong>Email:</strong> {selectedApplication.email}</li>
                  <li><strong>Phone:</strong> {selectedApplication.phone}</li>
                  <li><strong>TIN:</strong> {selectedApplication.TIN}</li>
                </ul>
              </div>
              <div className="modal-buttons">
                <button type="submit" className="save-button">Create Student Record</button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowStudentDataModal(false)}
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

export default ApplicationsComponent;