import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('username', data.user.username);
        alert('Login successful!');
        switch (data.user.role) {
          case 'admin':
            navigate('/admin');
            break;
          case 'instructor':
            navigate('/instructor');
            break;
          case 'teacher':
            navigate('/teacher');
            break;
          default:
            alert('Unknown user role');
        }
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Something went wrong! Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="login-container">
        <h1 className="login-page-h1">Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="username-password-labels" htmlFor="username">Username:</label>
            <input
              className="username-password-inputs"
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <label className="username-password-labels" htmlFor="password">Password:</label>
            <input
              className="username-password-inputs"
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button 
            className="login-button" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
      <div className="car-container">
        <div className="car-body">
          <div className="car-top">
            <div className="window-front"></div>
            <div className="window-back"></div>
          </div>
          <div className="car-light-front"></div>
          <div className="car-light-back"></div>
        </div>
        <div className="wheel wheel-front"></div>
        <div className="wheel wheel-back"></div>
      </div>
    </div>
  );
};

export default LoginPage;