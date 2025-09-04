import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MyClassScheduleComponent from './TeacherComponents/MyClassScheduleComponent/MyClassScheduleComponent';
import MyExamsComponent from './TeacherComponents/MyExamsComponent/MyExamsComponent';
import MyStudentsComponent from './TeacherComponents/MyStudentsComponent/MyStudentsComponent';
import MyLecturesComponent from './TeacherComponents/MyLecturesComponent/MyLecturesComponent';
import './TeacherPage.css';

const TeacherPage = () => {
  const [selectedPage, setSelectedPage] = useState(1);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [username, setUsername] = useState('Teacher');
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
        return <MyLecturesComponent />;
      default:
        return <MyClassScheduleComponent />;
    }
  };
  return (
    <div className="teacher-container">
      <h1 className="teacher-title">Welcome, {username}!</h1>
      <div className="teacher-logout-button-container">
        <button className="teacher-logout-button" onClick={handleLogoutClick}>Logout</button>
      </div>
      <nav className="teacher-navbar">
        <ul className="teacher-nav-list">
          <li>
            <button 
              onClick={() => handlePageChange(1)} 
              className={`teacher-nav-item ${selectedPage === 1 ? 'active' : ''}`}
            >
              My Class Schedule
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(2)} 
              className={`teacher-nav-item ${selectedPage === 2 ? 'active' : ''}`}
            >
              My Students
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(3)} 
              className={`teacher-nav-item ${selectedPage === 3 ? 'active' : ''}`}
            >
              My Exams
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(4)} 
              className={`teacher-nav-item ${selectedPage === 4 ? 'active' : ''}`}
            >
              My Lectures
            </button>
          </li>
        </ul>
      </nav>
      {renderPageContent()}
      {showLogoutConfirmation && (
        <>
          <div className="teacher-logout-backdrop" />
          <div className="teacher-logout-confirmation">
            <p>Are you sure you want to log out?</p>
            <div className="teacher-buttons-container">
              <button className="teacher-logout-button" onClick={() => handleLogoutConfirm(true)}>Yes</button>
              <button className="teacher-cancel-button" onClick={() => handleLogoutConfirm(false)}>No</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherPage;