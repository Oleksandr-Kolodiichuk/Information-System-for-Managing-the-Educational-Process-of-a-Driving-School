import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPage.css';
import './AdminComponents/ApplicationsComponent/ApplicationsComponent.css';
import './AdminComponents/TeachersComponent/TeachersComponent.css';
import './AdminComponents/FleetManagementComponent/FleetManagementComponent.css';
import './AdminComponents/InstructorsComponent/InstructorsComponent.css';
import './AdminComponents/TrainingGroupsComponent/TrainingGroupsComponent.css';
import './AdminComponents/LessonsComponent/LessonsComponent.css';
import './AdminComponents/ClassroomsComponent/ClassroomsComponent.css';
import './AdminComponents/ExamsComponent/ExamsComponent.css';
import './AdminComponents/StudentsComponent/StudentsComponent.css'
import './AdminComponents/AnalyticsComponent/AnalyticsComponent.css';
import ApplicationsComponent from './AdminComponents/ApplicationsComponent/ApplicationsComponent';
import FleetManagementComponent from './AdminComponents/FleetManagementComponent/FleetManagementComponent';
import InstructorsComponent from './AdminComponents/InstructorsComponent/InstructorsComponent';
import TeachersComponent from './AdminComponents/TeachersComponent/TeachersComponent';
import TrainingGroupsComponent from './AdminComponents/TrainingGroupsComponent/TrainingGroupsComponent';
import LessonsComponent from './AdminComponents/LessonsComponent/LessonsComponent';
import ClassroomsComponent from './AdminComponents/ClassroomsComponent/ClassroomsComponent';
import ExamsComponent from './AdminComponents/ExamsComponent/ExamsComponent';
import StudentsComponent from './AdminComponents/StudentsComponent/StudentsComponent';
import AnalyticsComponent from './AdminComponents/AnalyticsComponent/AnalyticsComponent';

const AdminPage = () => {
  const [selectedPage, setSelectedPage] = useState(1);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [username, setUsername] = useState('Admin');
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
        return <ApplicationsComponent />;
      case 2:
        return <StudentsComponent />;
      case 3:
        return <InstructorsComponent />;
      case 4:
        return <TeachersComponent />;
      case 5:
        return <TrainingGroupsComponent />;
      case 6:
        return <LessonsComponent />;
      case 7:
        return <ExamsComponent />;
      case 8:
        return <FleetManagementComponent />;
      case 9:
        return <ClassroomsComponent />;
      case 10:
        return <AnalyticsComponent />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">Welcome, {username}!</h1>
      <div className="logout-button-container">
        <button className="logout-button" onClick={handleLogoutClick}>Logout</button>
      </div>
      <nav className="navbar">
        <ul className="nav-list">
          <li>
            <button 
              onClick={() => handlePageChange(1)} 
              className={`nav-item ${selectedPage === 1 ? 'active' : ''}`}
            >
              Applications
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(2)} 
              className={`nav-item ${selectedPage === 2 ? 'active' : ''}`}
            >
              Students
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(3)} 
              className={`nav-item ${selectedPage === 3 ? 'active' : ''}`}
            >
              Instructors
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(4)} 
              className={`nav-item ${selectedPage === 4 ? 'active' : ''}`}
            >
              Teachers
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(5)} 
              className={`nav-item ${selectedPage === 5 ? 'active' : ''}`}
            >
              Groups
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(6)} 
              className={`nav-item ${selectedPage === 6 ? 'active' : ''}`}
            >
              Lessons
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(7)} 
              className={`nav-item ${selectedPage === 7 ? 'active' : ''}`}
            >
              Exams
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(8)} 
              className={`nav-item ${selectedPage === 8 ? 'active' : ''}`}
            >
              Cars
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(9)} 
              className={`nav-item ${selectedPage === 9 ? 'active' : ''}`}
            >
              Classrooms
            </button>
          </li>
          <li>
            <button 
              onClick={() => handlePageChange(10)} 
              className={`nav-item ${selectedPage === 10 ? 'active' : ''}`}
            >
              Analytics
            </button>
          </li>
        </ul>
      </nav>
      {renderPageContent()}
      {showLogoutConfirmation && (
        <>
          <div className="logout-backdrop" />
          <div className="logout-confirmation">
            <p>Are you sure you want to log out?</p>
            <div className="buttons-container">
              <button className="logout-button" onClick={() => handleLogoutConfirm(true)}>Yes</button>
              <button className="cancel-button" onClick={() => handleLogoutConfirm(false)}>No</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPage;