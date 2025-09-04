import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MyClassScheduleComponent from './InstructorComponents/MyClassScheduleComponent/MyClassScheduleComponent';
import MyCarComponent from './InstructorComponents/MyCarComponent/MyCarComponent';
import MyExamsComponent from './InstructorComponents/MyExamsComponent/MyExamsComponent';
import MyStudentsComponent from './InstructorComponents/MyStudentsComponent/MyStudentsComponent';
import './InstructorPage.css';

const InstructorPage = () => {
  const [selectedPage, setSelectedPage] = useState(1);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [username, setUsername] = useState('Instructor');
  const navigate = useNavigate();
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);
  const handlePageChange = (pageNumber) => {
    setSelectedPage(pageNumber);
  };
  const handleLogoutClick = () => {
    setShowLogoutConfirmation(true);
  };
  const handleLogoutConfirm = (confirm) => {
    if (confirm) {
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      localStorage.removeItem('token');
      alert('You have logged out.');
      navigate('/');
    }
    setShowLogoutConfirmation(false);
  };
  const renderPageContent = () => {
    switch (selectedPage) {
      case 1:
        return <MyClassScheduleComponent />;
      case 2:
        return <MyStudentsComponent />;
      case 3:
        return <MyExamsComponent />;
      case 4:
        return <MyCarComponent />;
      default:
        return <MyClassScheduleComponent />;
    }
  };
  return (
    <div className="instructor-container">
      <h1 className="instructor-title">Welcome, {username}!</h1>
      <div className="instructor-logout-button-container">
        <button className="instructor-logout-button" onClick={handleLogoutClick}>Logout</button>
      </div>
      <nav className="instructor-navbar">
        <ul className="instructor-nav-list">
          <li>
            <button 
              onClick={() => handlePageChange(1)} 
              className={`instructor-nav-item ${selectedPage === 1 ? 'active' : ''}`}
            >
              My Class Schedule
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(2)} 
              className={`instructor-nav-item ${selectedPage === 2 ? 'active' : ''}`}
            >
              My Students
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(3)} 
              className={`instructor-nav-item ${selectedPage === 3 ? 'active' : ''}`}
            >
              My Exams
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(4)} 
              className={`instructor-nav-item ${selectedPage === 4 ? 'active' : ''}`}
            >
              My Car
            </button>
          </li>
        </ul>
      </nav>
      {renderPageContent()}
      {showLogoutConfirmation && (
        <>
          <div className="instructor-logout-backdrop" />
          <div className="instructor-logout-confirmation">
            <p>Are you sure you want to log out?</p>
            <div className="instructor-buttons-container">
              <button className="instructor-logout-button" onClick={() => handleLogoutConfirm(true)}>Yes</button>
              <button className="instructor-cancel-button" onClick={() => handleLogoutConfirm(false)}>No</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InstructorPage;