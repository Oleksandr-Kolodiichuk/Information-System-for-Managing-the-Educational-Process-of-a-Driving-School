import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage/LoginPage';
import AdminPage from './pages/AdminPage/AdminPage';
import InstructorPage from './pages/InstructorPage/InstructorPage';
import TeacherPage from './pages/TeacherPage/TeacherPage';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/instructor/*" 
          element={
            <ProtectedRoute>
              <InstructorPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/teacher/*" 
          element={
            <ProtectedRoute>
              <TeacherPage />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;