import React, { useState, useEffect, useCallback } from 'react';
import './StudentsComponent.css';

const StudentsComponent = () => {
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [formMode, setFormMode] = useState('edit');
  const [studentForm, setStudentForm] = useState({
    TIN: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    phone: '',
    group_id: '',
    exam_score: '',
    exam_result: '',
    instructor_id: '',
    application_id: ''
  });
  const [filters, setFilters] = useState({
    TIN: '',
    firstName: '',
    lastName: '',
    birthDateFrom: '',
    birthDateTo: '',
    email: '',
    phone: '',
    group: '',
    instructor: '',
    examScoreFrom: '',
    examScoreTo: '',
    examResult: '',
  });
  const [groups, setGroups] = useState([]);
  const [instructors, setInstructors] = useState([]);
  
  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  // Функція для обробки помилок від API
  const handleApiError = async (response) => {
    try {
      const errorData = await response.json();
      
      // Формуємо детальне повідомлення про помилку
      let errorMessage = errorData.message || 'An error occurred';
      
      if (errorData.error) {
        const { error } = errorData;
        
        // Додаємо деталі помилки якщо вони є
        if (error.detail) {
          errorMessage += `\n\nDetails: ${error.detail}`;
        }
        
        // Додаємо підказку якщо вона є
        if (error.hint) {
          errorMessage += `\n\nHint: ${error.hint}`;
        }
        
        // Додаємо інформацію про constraint якщо вона є
        if (error.constraint) {
          errorMessage += `\n\nConstraint: ${error.constraint}`;
        }
        
        // Додаємо інформацію про таблицю та колонку якщо вони є
        if (error.table) {
          errorMessage += `\n\nTable: ${error.table}`;
        }
        
        if (error.column) {
          errorMessage += `\n\nColumn: ${error.column}`;
        }
        
        // Якщо є код помилки, додаємо його
        if (error.code) {
          errorMessage += `\n\nError Code: ${error.code}`;
        }
      }
      
      return errorMessage;
    } catch (parseError) {
      // Якщо не вдалося розпарсити JSON, повертаємо статус помилки
      return `HTTP Error ${response.status}: ${response.statusText}`;
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchGroups();
    fetchInstructors();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/StudentsComponent/students', {
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const errorMessage = await handleApiError(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setAllStudents(data);
      setStudents(data);
      setError(null);
    } catch (err) {
      setError('Error loading students:\n' + err.message);
      setStudents([]);
      setAllStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/StudentsComponent/groups', {
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const errorMessage = await handleApiError(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err);
      alert('Error loading groups:\n' + err.message);
      setGroups([]);
    }
  };

  const fetchInstructors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/StudentsComponent/instructors', {
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const errorMessage = await handleApiError(response);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setInstructors(data);
    } catch (err) {
      console.error('Error loading instructors:', err);
      alert('Error loading instructors:\n' + err.message);
      setInstructors([]);
    }
  };

  const getGroupName = (groupId) => {
    if (!groupId) return '-';
    const group = groups.find(g => g.id === parseInt(groupId));
    return group ? group.name : '-';
  };

  const getInstructorName = (instructorId) => {
    if (!instructorId) return '-';
    const instructor = instructors.find(i => i.id === parseInt(instructorId));
    return instructor ? `${instructor.first_name} ${instructor.last_name}` : '-';
  };

  const filterStudents = useCallback(() => {
    let filteredResults = [...allStudents];
    
    if (filters.TIN) {
      filteredResults = filteredResults.filter(student => 
        student.TIN && student.TIN.toLowerCase().includes(filters.TIN.toLowerCase())
      );
    }
    
    if (filters.firstName) {
      filteredResults = filteredResults.filter(student => 
        student.first_name && student.first_name.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }
    
    if (filters.lastName) {
      filteredResults = filteredResults.filter(student => 
        student.last_name && student.last_name.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }

    if (filters.birthDateFrom || filters.birthDateTo) {
  filteredResults = filteredResults.filter(student => {
    if (!student.birth_date) return false;
    const studentDate = new Date(student.birth_date);
    
    if (filters.birthDateFrom) {
      const fromDate = new Date(filters.birthDateFrom);
      if (studentDate < fromDate) {
        return false;
      }
    }
    
    if (filters.birthDateTo) {
      const toDate = new Date(filters.birthDateTo);
      if (studentDate > toDate) {
        return false;
      }
    }
    
    return true;
  });
}
    
    if (filters.email) {
      filteredResults = filteredResults.filter(student => 
        student.email && student.email.toLowerCase().includes(filters.email.toLowerCase())
      );
    }
    
    if (filters.phone) {
      filteredResults = filteredResults.filter(student => 
        student.phone && student.phone.toLowerCase().includes(filters.phone.toLowerCase())
      );
    }
    
    if (filters.group) {
      filteredResults = filteredResults.filter(student => 
        student.group_id && parseInt(student.group_id) === parseInt(filters.group)
      );
    }

    if (filters.instructor) {
      filteredResults = filteredResults.filter(student => 
        student.instructor_id && parseInt(student.instructor_id) === parseInt(filters.instructor)
      );
    }

    if (filters.examScoreFrom || filters.examScoreTo) {
  filteredResults = filteredResults.filter(student => {
    if (!student.exam_score) return false;
    const score = parseFloat(student.exam_score);
    
    if (filters.examScoreFrom && score < parseFloat(filters.examScoreFrom)) {
      return false;
    }
    
    if (filters.examScoreTo && score > parseFloat(filters.examScoreTo)) {
      return false;
    }
    
    return true;
  });
}
    
    if (filters.examResult) {
      filteredResults = filteredResults.filter(student => 
        student.exam_result && student.exam_result.toLowerCase().includes(filters.examResult.toLowerCase())
      );
    }
    
    setStudents(filteredResults);
  }, [allStudents, filters, groups, instructors]);

  useEffect(() => {
    filterStudents();
  }, [filterStudents]);

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
      birthDateFrom: '',
      birthDateTo: '',
      email: '',
      phone: '',
      group: '',
      instructor: '',
      examScoreFrom: '',
      examScoreTo: '',
      examResult: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setStudentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openEditStudentModal = (student) => {
    setSelectedStudent(student);
    setStudentForm({
      TIN: student.TIN || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      birth_date: student.birth_date ? new Date(student.birth_date).toISOString().split('T')[0] : '',
      email: student.email || '',
      phone: student.phone || '',
      group_id: student.group_id || '',
      exam_score: student.exam_score || '',
      exam_result: student.exam_result || '',
      instructor_id: student.instructor_id || '',
      application_id: student.application_id || ''
    });
    setFormMode('edit');
    setShowStudentModal(true);
  };

  const handleStudentFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = {
        ...studentForm,
        group_id: studentForm.group_id ? parseInt(studentForm.group_id) : null,
        exam_score: studentForm.exam_score ? parseFloat(studentForm.exam_score) : null,
        instructor_id: studentForm.instructor_id ? parseInt(studentForm.instructor_id) : null,
        application_id: studentForm.application_id ? parseInt(studentForm.application_id) : null
      };
      
      const response = await fetch(`http://localhost:5000/api/admin/StudentsComponent/students/${selectedStudent.TIN}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorMessage = await handleApiError(response);
        throw new Error(errorMessage);
      }
      
      const updatedStudent = await response.json();
      if (selectedStudent.TIN !== formData.TIN) {
        setAllStudents(prev => 
          [...prev.filter(student => student.TIN !== selectedStudent.TIN), updatedStudent]
        );
      } else {
        setAllStudents(prev => 
          prev.map(student => student.TIN === selectedStudent.TIN ? updatedStudent : student)
        );
      }
      
      setShowStudentModal(false);
      filterStudents();
      
      // Показуємо повідомлення про успішне оновлення
      alert('Student updated successfully!');
      
    } catch (err) {
      alert('Error updating student:\n\n' + err.message);
    }
  };

  const handleDeleteStudent = async (TIN) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/StudentsComponent/students/${TIN}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        
        if (!response.ok) {
          const errorMessage = await handleApiError(response);
          throw new Error(errorMessage);
        }
        
        setAllStudents(prev => prev.filter(student => student.TIN !== TIN));
        setStudents(prev => prev.filter(student => student.TIN !== TIN));
        
        // Показуємо повідомлення про успішне видалення
        alert('Student deleted successfully!');
        
      } catch (err) {
        alert('Error deleting student:\n\n' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const renderFiltersView = () => {
    return (
      <div className="students-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Students</h3>
        <div className="students-filters-form">
          <div className="students-filter-group">
            <label htmlFor="TIN">TIN:</label>
            <input 
              type="text" 
              id="TIN" 
              name="TIN" 
              value={filters.TIN} 
              onChange={handleFilterChange} 
              placeholder="Enter TIN"
              className="students-filter-input"
            />
          </div>
          <div className="students-filter-group">
            <label htmlFor="firstName">First Name:</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={filters.firstName} 
              onChange={handleFilterChange} 
              placeholder="Enter first name"
              className="students-filter-input"
            />
          </div>
          <div className="students-filter-group">
            <label htmlFor="lastName">Last Name:</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={filters.lastName} 
              onChange={handleFilterChange} 
              placeholder="Enter last name"
              className="students-filter-input"
            />
          </div>
<div className="students-filter-group">
  <label htmlFor="birthDateFrom">Birth Date From:</label>
  <input 
    type="date" 
    id="birthDateFrom" 
    name="birthDateFrom" 
    value={filters.birthDateFrom} 
    onChange={handleFilterChange}
    className="students-filter-input"
  />
</div>
<div className="students-filter-group">
  <label htmlFor="birthDateTo">Birth Date To:</label>
  <input 
    type="date" 
    id="birthDateTo" 
    name="birthDateTo" 
    value={filters.birthDateTo} 
    onChange={handleFilterChange}
    className="students-filter-input"
  />
</div>
          <div className="students-filter-group">
            <label htmlFor="email">Email:</label>
            <input 
              type="text" 
              id="email" 
              name="email" 
              value={filters.email} 
              onChange={handleFilterChange} 
              placeholder="Enter email"
              className="students-filter-input"
            />
          </div>
          <div className="students-filter-group">
            <label htmlFor="phone">Phone:</label>
            <input 
              type="text" 
              id="phone" 
              name="phone" 
              value={filters.phone} 
              onChange={handleFilterChange} 
              placeholder="Enter phone"
              className="students-filter-input"
            />
          </div>
          <div className="students-filter-group">
            <label htmlFor="group">Group:</label>
            <select 
              id="group" 
              name="group" 
              value={filters.group} 
              onChange={handleFilterChange}
              className="students-filter-input"
            >
              <option value="">-- All Groups --</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div className="students-filter-group">
            <label htmlFor="instructor">Instructor:</label>
            <select 
              id="instructor" 
              name="instructor" 
              value={filters.instructor} 
              onChange={handleFilterChange}
              className="students-filter-input"
            >
              <option value="">-- All Instructors --</option>
              {instructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.first_name} {instructor.last_name}
                </option>
              ))}
            </select>
          </div>
<div className="students-filter-group">
  <label htmlFor="examScoreFrom">Exam Score From:</label>
  <input 
    type="number" 
    id="examScoreFrom" 
    name="examScoreFrom" 
    value={filters.examScoreFrom} 
    onChange={handleFilterChange} 
    placeholder="Min score"
    step="0.01"
    className="students-filter-input"
  />
</div>
<div className="students-filter-group">
  <label htmlFor="examScoreTo">Exam Score To:</label>
  <input 
    type="number" 
    id="examScoreTo" 
    name="examScoreTo" 
    value={filters.examScoreTo} 
    onChange={handleFilterChange} 
    placeholder="Max score"
    step="0.01"
    className="students-filter-input"
  />
</div>
          <div className="students-filter-group">
            <label htmlFor="examResult">Exam Result:</label>
          <select
            id="examResult"
            name="examResult"
            value={filters.examResult}
            onChange={handleFilterChange}
            className="students-filter-input"
          >
            <option value="">-- All Results --</option>
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="NOT TAKEN">NOT TAKEN</option>
          </select>
          </div>
          <div className="students-filters-buttons">
            <button type="button" className="students-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="students-table-wrapper">
        <table className="students-table">
          <thead>
            <tr>
              <th>TIN</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Birth Date</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Group</th>
              <th>Instructor</th>
              <th>Exam Score</th>
              <th>Exam Result</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length > 0 ? (
              students.map(student => (
                <tr key={student.TIN}>
                  <td>{student.TIN || 'N/A'}</td>
                  <td>{student.first_name || 'N/A'}</td>
                  <td>{student.last_name || 'N/A'}</td>
                  <td>{student.birth_date ? new Date(student.birth_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{student.email || 'N/A'}</td>
                  <td>{student.phone || 'N/A'}</td>
                  <td>{getGroupName(student.group_id)}</td>
                  <td>{getInstructorName(student.instructor_id)}</td>
                  <td>{student.exam_score || 'N/A'}</td>
                  <td>{student.exam_result || 'N/A'}</td>
                  <td>
                    <button 
                      className="students-action students-edit" 
                      onClick={() => openEditStudentModal(student)}
                    >
                      Edit
                    </button>
                    <button 
                      className="students-action students-delete" 
                      onClick={() => handleDeleteStudent(student.TIN)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" className="students-loading"><i>No students found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="students-page">
      <div className="students-toggle-container">
        <button 
          className="students-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
      </div>
      
      {loading ? (
        <div className="students-loading">Loading students...</div>
      ) : error ? (
        <div className="students-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>
      ) : (
        <div className="students-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showStudentModal && (
        <>
          <div className="students-modal-backdrop" onClick={() => setShowStudentModal(false)} />
          <div className="students-modal">
            <h3>Edit Student</h3>
            <form onSubmit={handleStudentFormSubmit}>
              <div className="students-filter-group">
                <label htmlFor="TIN">TIN:</label>
                <input 
                  type="text" 
                  id="TIN" 
                  name="TIN" 
                  value={studentForm.TIN} 
                  onChange={handleFormChange}
                  required
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="first_name">First Name:</label>
                <input 
                  type="text" 
                  id="first_name" 
                  name="first_name" 
                  value={studentForm.first_name} 
                  onChange={handleFormChange}
                  required
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="last_name">Last Name:</label>
                <input 
                  type="text" 
                  id="last_name" 
                  name="last_name" 
                  value={studentForm.last_name} 
                  onChange={handleFormChange}
                  required
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="birth_date">Birth Date:</label>
                <input 
                  type="date" 
                  id="birth_date" 
                  name="birth_date" 
                  value={studentForm.birth_date} 
                  onChange={handleFormChange}
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="email">Email:</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={studentForm.email} 
                  onChange={handleFormChange}
                  required
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="phone">Phone:</label>
                <input 
                  type="text" 
                  id="phone" 
                  name="phone" 
                  value={studentForm.phone} 
                  onChange={handleFormChange}
                  required
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="group_id">Group:</label>
                <select 
                  id="group_id" 
                  name="group_id" 
                  value={studentForm.group_id} 
                  onChange={handleFormChange}
                  className="students-filter-input"
                >
                  <option value="">-- Select Group --</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
              <div className="students-filter-group">
                <label htmlFor="exam_score">Exam Score:</label>
                <input 
                  type="number" 
                  id="exam_score" 
                  name="exam_score" 
                  value={studentForm.exam_score} 
                  onChange={handleFormChange}
                  step="0.01"
                  className="students-filter-input"
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="exam_result">Exam Result:</label>
                <input 
                  type="text" 
                  id="exam_result" 
                  name="exam_result" 
                  value={studentForm.exam_result} 
                  readOnly
                  onChange={handleFormChange}
                  className="students-filter-input"
                      style={{
      backgroundColor: '#f5f5f5',
      cursor: 'not-allowed',
      color: '#666'
    }}
                />
              </div>
              <div className="students-filter-group">
                <label htmlFor="instructor_id">Instructor:</label>
                <select 
                  id="instructor_id" 
                  name="instructor_id" 
                  value={studentForm.instructor_id} 
                  onChange={handleFormChange}
                  className="students-filter-input"
                >
                  <option value="">-- Select Instructor --</option>
                  {instructors.map(instructor => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.first_name} {instructor.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="submit" className="students-action students-edit">
                  Save Changes
                </button>
                <button 
                  type="button" 
                  className="students-action students-delete"
                  onClick={() => setShowStudentModal(false)}
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

export default StudentsComponent;