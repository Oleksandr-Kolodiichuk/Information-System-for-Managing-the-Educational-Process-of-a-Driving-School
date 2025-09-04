import React, { useState, useEffect } from 'react';
import './MyCarComponent.css';

const MyCarComponent = () => {
  const [carInfo, setCarInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instructorLogin, setInstructorLogin] = useState('');
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setInstructorLogin(storedUser);
    }
  }, []);
  const getRequestHeaders = () => {
    console.log('Sending instructor login:', instructorLogin);
    
    return {
      'Content-Type': 'application/json',
      'user-role': 'instructor',
      'instructor-login': instructorLogin
    };
  };
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setInstructorLogin(storedUser);
    }
  }, []);
  useEffect(() => {
    if (instructorLogin) {
      fetchCarInfo();
    }
  }, [instructorLogin]);
  const fetchCarInfo = async () => {
    try {
      setLoading(true);
      console.log('Fetching car info with headers:', getRequestHeaders());
      
      const response = await fetch('http://localhost:5000/api/instructor/car/info', {
        headers: getRequestHeaders()
      });
      console.log('Response status:', response.status);
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      if (response.status === 404) {
        const errorData = await response.json();
        console.log('404 Error details:', errorData);
        throw new Error('No car assigned to this instructor');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        throw new Error('Failed to fetch car information');
      }
      
      const data = await response.json();
      console.log('Car info received:', data);
      setCarInfo(data);
      setError(null);
    } catch (err) {
      setError('Error loading car information: ' + err.message);
      console.error('Car info fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="car-loading">Loading car information...</div>;
  }

  if (error) {
    return <div className="car-error">{error}</div>;
  }

  if (!carInfo) {
    return <div className="car-no-data">No car information available</div>;
  }

  return (
    <div className="car-info-container">
      <div className="car-info-header">
        <div className="car-info-icon">🚗</div>
        <h2 className="car-info-title">My Car Information</h2>
      </div>
      
      <div className="car-details">
        <div className="car-detail-item">
          <div className="car-detail-label">Brand</div>
          <div className="car-detail-value">{carInfo.make}</div>
        </div>
        <div className="car-detail-item">
          <div className="car-detail-label">Model</div>
          <div className="car-detail-value">{carInfo.model}</div>
        </div>
        <div className="car-detail-item">
          <div className="car-detail-label">Year</div>
          <div className="car-detail-value">{carInfo.year}</div>
        </div>
        
        <div className="car-detail-item">
          <div className="car-detail-label">License Plate</div>
          <div className="car-detail-value">{carInfo.license_plate}</div>
        </div>
        
        <div className="car-detail-item">
          <div className="car-detail-label">Condition</div>
          <div className="car-detail-value">{carInfo.condition}</div>
        </div>
        
        <div className="car-detail-item">
          <div className="car-detail-label">Car Category</div>
          <div className="car-detail-value">{carInfo.category}</div>
        </div>
        
        <div className="car-detail-item">
          <div className="car-detail-label">Driving Category</div>
          <div className="car-detail-value">{carInfo.driving_category}</div>
        </div>
        
        <div className="car-detail-item">
          <div className="car-detail-label">My Experience</div>
          <div className="car-detail-value">{carInfo.instructor_experience} years</div>
        </div>
      </div>
    </div>
  );
};

export default MyCarComponent;