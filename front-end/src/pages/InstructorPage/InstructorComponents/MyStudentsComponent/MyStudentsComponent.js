import React, { useState, useEffect, useCallback } from 'react';
import './MyStudentsComponent.css';

const MyStudentsComponent = () => {
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState([]);
  const [studyCategories, setStudyCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [updatingScore, setUpdatingScore] = useState({});
  const [generatingPdf, setGeneratingPdf] = useState({});
  const [pdfError, setPdfError] = useState({});
  const [filters, setFilters] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studyCategory: '',
    hasExamScore: ''
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
    fetchMyStudents();
    fetchStudyCategories();
  }, []);

  const fetchMyStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = getRequestHeaders();
      console.log('Request headers:', headers);
      
      if (!headers.username) {
        throw new Error('Username not found in localStorage');
      }
      
      const response = await fetch('http://localhost:5000/api/instructor/my-students', {
        method: 'GET',
        headers: headers
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch students');
      }
      
      const data = await response.json();
      console.log('Fetched students data:', data);
      
      setAllStudents(data);
      setStudents(data);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Error loading students: ' + err.message);
      setStudents([]);
      setAllStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudyCategories = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/study-categories', {
        headers: {
          'Content-Type': 'application/json',
          'user-role': 'instructor'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch study categories');
      }

      const data = await response.json();
      setStudyCategories(data);
    } catch (err) {
      console.error('Error loading study categories:', err.message);
    }
  };

  const updateExamScore = async (studentId, score) => {
    try {
      setUpdatingScore(prev => ({ ...prev, [studentId]: true }));
      
      const headers = getRequestHeaders();
      const response = await fetch(`http://localhost:5000/api/instructor/update-exam-score/${studentId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ exam_score: score })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update exam score');
      }

      const updatedStudents = allStudents.map(student => 
        student.student_id === studentId 
          ? { ...student, exam_score: score }
          : student
      );
      
      setAllStudents(updatedStudents);
      setStudents(updatedStudents.filter(student => 
        (!filters.firstName || student.first_name?.toLowerCase().includes(filters.firstName.toLowerCase())) &&
        (!filters.lastName || student.last_name?.toLowerCase().includes(filters.lastName.toLowerCase())) &&
        (!filters.email || student.email?.toLowerCase().includes(filters.email.toLowerCase())) &&
        (!filters.studyCategory || student.study_category === filters.studyCategory) &&
        (!filters.hasExamScore || 
          (filters.hasExamScore === 'yes' && student.exam_score !== null && student.exam_score !== undefined) ||
          (filters.hasExamScore === 'no' && (student.exam_score === null || student.exam_score === undefined))
        )
      ));
      
    } catch (err) {
      console.error('Error updating exam score:', err);
      alert('Error updating exam score: ' + err.message);
    } finally {
      setUpdatingScore(prev => ({ ...prev, [studentId]: false }));
    }
  };

  const generatePdf = async (studentId) => {
    try {
      setGeneratingPdf(prev => ({ ...prev, [studentId]: true }));
      setPdfError(prev => ({ ...prev, [studentId]: null }));
      const headers = getRequestHeaders();
      const downloadHeaders = { ...headers };
      delete downloadHeaders['Content-Type'];
      
      const response = await fetch(`http://localhost:5000/api/instructor/generate-student-pdf/${studentId}`, {
        method: 'GET',
        headers: downloadHeaders
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Server did not return a valid PDF file');
      }
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Received empty PDF file');
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const student = students.find(s => s.student_id === studentId);
      const fileName = student 
        ? `${student.first_name}_${student.last_name}_report.pdf`
        : `student_${studentId}_report.pdf`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      console.log(`PDF generated successfully for student ${studentId}`);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      setPdfError(prev => ({ ...prev, [studentId]: err.message }));
      alert(`Помилка генерації PDF: ${err.message}`);
    } finally {
      setGeneratingPdf(prev => ({ ...prev, [studentId]: false }));
    }
  };

const generateCsv = async (studentId) => {
  try {
    setGeneratingPdf(prev => ({ ...prev, [`${studentId}_csv`]: true }));
    setPdfError(prev => ({ ...prev, [`${studentId}_csv`]: null }));
    
    const headers = getRequestHeaders();
    delete headers['Content-Type'];
    
    const response = await fetch(`http://localhost:5000/api/instructor/generate-student-csv/${studentId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate CSV');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const student = students.find(s => s.student_id === studentId);
    const fileName = student 
      ? `${student.first_name}_${student.last_name}_report.csv`
      : `student_${studentId}_report.csv`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    
  } catch (err) {
    console.error('Error generating CSV:', err);
    setPdfError(prev => ({ ...prev, [`${studentId}_csv`]: err.message }));
    alert(`Помилка генерації CSV: ${err.message}`);
  } finally {
    setGeneratingPdf(prev => ({ ...prev, [`${studentId}_csv`]: false }));
  }
};

const generateJson = async (studentId) => {
  try {
    setGeneratingPdf(prev => ({ ...prev, [`${studentId}_json`]: true }));
    setPdfError(prev => ({ ...prev, [`${studentId}_json`]: null }));
    
    const headers = getRequestHeaders();
    delete headers['Content-Type'];
    
    const response = await fetch(`http://localhost:5000/api/instructor/generate-student-json/${studentId}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate JSON');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const student = students.find(s => s.student_id === studentId);
    const fileName = student 
      ? `${student.first_name}_${student.last_name}_report.json`
      : `student_${studentId}_report.json`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    
  } catch (err) {
    console.error('Error generating JSON:', err);
    setPdfError(prev => ({ ...prev, [`${studentId}_json`]: err.message }));
    alert(`Помилка генерації JSON: ${err.message}`);
  } finally {
    setGeneratingPdf(prev => ({ ...prev, [`${studentId}_json`]: false }));
  }
};

  const filterStudents = useCallback(() => {
    let filteredResults = [...allStudents];
    
    if (filters.firstName) {
      filteredResults = filteredResults.filter(student => 
        student.first_name?.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }
    
    if (filters.lastName) {
      filteredResults = filteredResults.filter(student => 
        student.last_name?.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }
    
    if (filters.email) {
      filteredResults = filteredResults.filter(student => 
        student.email?.toLowerCase().includes(filters.email.toLowerCase())
      );
    }
    
    if (filters.studyCategory) {
      filteredResults = filteredResults.filter(student => 
        student.study_category === filters.studyCategory
      );
    }
    
    if (filters.hasExamScore) {
      if (filters.hasExamScore === 'yes') {
        filteredResults = filteredResults.filter(student => 
          student.exam_score !== null && student.exam_score !== undefined
        );
      } else if (filters.hasExamScore === 'no') {
        filteredResults = filteredResults.filter(student => 
          student.exam_score === null || student.exam_score === undefined
        );
      }
    }
    
    setStudents(filteredResults);
  }, [allStudents, filters]);

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
      firstName: '',
      lastName: '',
      email: '',
      studyCategory: '',
      hasExamScore: ''
    });
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const handleScoreInputChange = (e, studentId) => {
    const value = e.target.value;
    if (value === '') {
      return;
    }
    if (!/^\d*\.?\d*$/.test(value)) {
      e.preventDefault();
      return;
    }
    const numValue = parseFloat(value);
    if (numValue < 0 || numValue > 100) {
      e.preventDefault();
      return;
    }
  };

  const handleScoreSubmit = (e, studentId) => {
    if (e.key === 'Enter') {
      const score = parseFloat(e.target.value);
      if (!isNaN(score) && score >= 0 && score <= 100) {
        updateExamScore(studentId, score);
      }
    }
  };

  const handleScoreBlur = (e, studentId) => {
    const score = parseFloat(e.target.value);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      updateExamScore(studentId, score);
    }
  };

  const getExamResult = (score) => {
    if (score === null || score === undefined) {
      return { text: 'NO SCORE', color: '#666', style: {} };
    }
    
    const numScore = parseFloat(score);
    if (numScore >= 50) {
      return { 
        text: 'PASSED', 
        color: '#28a745', 
        style: { fontWeight: 'bold', color: '#28a745' }
      };
    } else {
      return { 
        text: 'FAILED', 
        color: '#dc3545', 
        style: { fontWeight: 'bold', color: '#dc3545' }
      };
    }
  };

  const renderFiltersView = () => {
    return (
      <div className="exams-filters">
        <h3 style={{ marginTop: '20px' }}>Filter My Students</h3>
        <div className="exams-filters-form">
          <div className="exams-filter-group">
            <label htmlFor="firstName">First Name:</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={filters.firstName} 
              onChange={handleFilterChange}
              placeholder="Enter first name"
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="lastName">Last Name:</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={filters.lastName} 
              onChange={handleFilterChange}
              placeholder="Enter last name"
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="email">Email:</label>
            <input 
              type="text" 
              id="email" 
              name="email" 
              value={filters.email} 
              onChange={handleFilterChange}
              placeholder="Enter email"
              className="exams-filter-input"
            />
          </div>
          <div className="exams-filter-group">
            <label htmlFor="studyCategory">Study Category:</label>
            <select
              id="studyCategory"
              name="studyCategory"
              value={filters.studyCategory}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Categories</option>
              {studyCategories.map(category => (
                <option key={category.study_category_id} value={category.study_category}>
                  {category.study_category}
                </option>
              ))}
            </select>
          </div>
          <div className="exams-filter-group">
            <label htmlFor="hasExamScore">Has Exam Score:</label>
            <select
              id="hasExamScore"
              name="hasExamScore"
              value={filters.hasExamScore}
              onChange={handleFilterChange}
              className="exams-filter-select"
            >
              <option value="">All Students</option>
              <option value="yes">With Score</option>
              <option value="no">Without Score</option>
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
              <th>TIN</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Birth Date</th>
              <th>Study Category</th>
              <th>Exam Score</th>
              <th>Exam Result</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length > 0 ? (
              students.map(student => {
                const examResult = getExamResult(student.exam_score);
                return (
                  <tr key={student.student_id}>
                    <td>{student.TIN || 'N/A'}</td>
                    <td>{`${student.first_name || ''} ${student.last_name || ''}`.trim() || 'N/A'}</td>
                    <td>{student.email || 'N/A'}</td>
                    <td>{student.phone || 'N/A'}</td>
                    <td>{formatDate(student.birth_date)}</td>
                    <td>{student.study_category || 'N/A'}</td>
                    <td className="exam-score-cell">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        defaultValue={student.exam_score || ''}
                        placeholder="0-100"
                        onKeyPress={(e) => handleScoreInputChange(e, student.student_id)}
                        onKeyDown={(e) => handleScoreSubmit(e, student.student_id)}
                        onBlur={(e) => handleScoreBlur(e, student.student_id)}
                        disabled={updatingScore[student.student_id]}
                        className="exam-score-input"
                      />
                      {updatingScore[student.student_id] && (
                        <span className="updating-indicator">
                          Updating...
                        </span>
                      )}
                    </td>
                    <td style={examResult.style}>
                      {examResult.text}
                    </td>
                    <td className="export-actions-cell">
  <div className="export-buttons-container">
    <button
      onClick={() => generatePdf(student.student_id)}
      disabled={generatingPdf[student.student_id]}
      className="export-btn export-pdf-btn"
      title="Generate PDF Report"
    >
      {generatingPdf[student.student_id] ? (
        <span className="export-loading">⏳</span>
      ) : (
        <span className="export-icon">📄</span>
      )}
    </button>
    
    <button
      onClick={() => generateCsv(student.student_id)}
      disabled={generatingPdf[`${student.student_id}_csv`]}
      className="export-btn export-csv-btn"
      title="Generate CSV Report"
    >
      {generatingPdf[`${student.student_id}_csv`] ? (
        <span className="export-loading">⏳</span>
      ) : (
        <span className="export-icon">📊</span>
      )}
    </button>
    
    <button
      onClick={() => generateJson(student.student_id)}
      disabled={generatingPdf[`${student.student_id}_json`]}
      className="export-btn export-json-btn"
      title="Generate JSON Report"
    >
      {generatingPdf[`${student.student_id}_json`] ? (
        <span className="export-loading">⏳</span>
      ) : (
        <span className="export-icon">{"{ ; }"}</span>
      )}
    </button>
  </div>
  
  {(pdfError[student.student_id] || pdfError[`${student.student_id}_csv`] || pdfError[`${student.student_id}_json`]) && (
    <div className="export-error" title="Export Error">⚠️</div>
  )}
</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="exams-loading">
                  <i>No students found</i>
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
          Please log in to view your students.
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
        <div className="exams-loading">Loading my students...</div>
      ) : error ? (
        <div className="exams-error">
          {error}
          <button 
            className="exams-action retry-btn" 
            onClick={fetchMyStudents}
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

export default MyStudentsComponent;