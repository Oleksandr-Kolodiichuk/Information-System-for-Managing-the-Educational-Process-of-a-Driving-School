import React, { useState, useEffect, useCallback } from 'react';
import './InstructorsComponent.css';

const InstructorsComponent = () => {
  const [instructors, setInstructors] = useState([]);
  const [allInstructors, setAllInstructors] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [instructorForm, setInstructorForm] = useState({
    TIN: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    phone: '',
    driving_category: '',
    experience_years: '',
    car_id: '',
    login: '',
    password: ''
  });
const [filters, setFilters] = useState({
  tin: '',
  firstName: '',
  lastName: '',
  birthDateFrom: '',
  birthDateTo: '',
  email: '',
  phone: '',
  drivingCategory: '',
  experienceFrom: '',
  experienceTo: '',
  carId: '',
  login: ''
});

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  useEffect(() => {
    fetchInstructors();
    fetchCars();
  }, []);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/InstructorsComponent/instructors', {
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch instructors');
      }
      
      const data = await response.json();
      setAllInstructors(data);
      setInstructors(data);
      setError(null);
    } catch (err) {
      setError('Error loading instructors: ' + err.message);
      setInstructors([]);
      setAllInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCars = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/InstructorsComponent/cars', {
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch cars');
      }
      
      const data = await response.json();
      setCars(data);
    } catch (err) {
      console.error('Error loading cars:', err.message);
      setCars([]);
    }
  };

  const filterInstructors = useCallback(() => {
    let filteredResults = [...allInstructors];
    
    if (filters.login) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.login && instructor.login.toLowerCase().includes(filters.login.toLowerCase())
      );
    }
    
    if (filters.tin) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.TIN && instructor.TIN.toString().includes(filters.tin)
      );
    }
    
    if (filters.firstName) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.first_name && instructor.first_name.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }
    
    if (filters.lastName) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.last_name && instructor.last_name.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }
    
    if (filters.drivingCategory) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.driving_category === filters.drivingCategory
      );
    }
    
    if (filters.experienceFrom) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.experience_years && instructor.experience_years >= parseInt(filters.experienceFrom)
      );
    }
    
    if (filters.experienceTo) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.experience_years && instructor.experience_years <= parseInt(filters.experienceTo)
      );
    }
    
    if (filters.carId) {
      filteredResults = filteredResults.filter(instructor => 
        instructor.car_id === parseInt(filters.carId)
      );
    }


if (filters.birthDateFrom) {
  filteredResults = filteredResults.filter(instructor => 
    instructor.birth_date && instructor.birth_date.split('T')[0] >= filters.birthDateFrom
  );
}

if (filters.birthDateTo) {
  filteredResults = filteredResults.filter(instructor => 
    instructor.birth_date && instructor.birth_date.split('T')[0] <= filters.birthDateTo
  );
}

if (filters.email) {
  filteredResults = filteredResults.filter(instructor => 
    instructor.email && instructor.email.toLowerCase().includes(filters.email.toLowerCase())
  );
}

if (filters.phone) {
  filteredResults = filteredResults.filter(instructor => 
    instructor.phone && instructor.phone.includes(filters.phone)
  );
}
    
    setInstructors(filteredResults);
  }, [allInstructors, filters]);

  useEffect(() => {
    filterInstructors();
  }, [filterInstructors]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

const handleClearFilters = () => {
  setFilters({
    tin: '',
    firstName: '',
    lastName: '',
    birthDateFrom: '',
    birthDateTo: '',
    email: '',
    phone: '',
    drivingCategory: '',
    experienceFrom: '',
    experienceTo: '',
    carId: '',
    login: ''
  });
};

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setInstructorForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

 const openAddInstructorModal = () => {
  setSelectedInstructor(null);
  setInstructorForm({
    TIN: '',
    first_name: '',
    last_name: '',
    birth_date: '',
    email: '',
    phone: '',
    driving_category: '',
    experience_years: '',
    car_id: '',
    login: '',
    password: ''
  });
  setFormMode('add');
  setShowInstructorModal(true);
};

const openEditInstructorModal = (instructor) => {
  setSelectedInstructor(instructor);
  setInstructorForm({
    TIN: instructor.TIN || '',
    first_name: instructor.first_name || '',
    last_name: instructor.last_name || '',
    birth_date: instructor.birth_date ? instructor.birth_date.split('T')[0] : '',
    email: instructor.email || '',
    phone: instructor.phone || '',
    driving_category: instructor.driving_category || '',
    experience_years: instructor.experience_years || '',
    car_id: instructor.car_id?.toString() || '',
    login: instructor.login || '',
    password: ''
  });
  setFormMode('edit');
  setShowInstructorModal(true);
};

const handleInstructorFormSubmit = async (e) => {
  e.preventDefault();
  try {
    const formData = {
      ...instructorForm,
      experience_years: parseInt(instructorForm.experience_years),
      car_id: instructorForm.car_id ? parseInt(instructorForm.car_id) : null
    };

    if (formMode === 'add') {
      const response = await fetch('http://localhost:5000/api/admin/InstructorsComponent/instructors', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(formData)
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        // Змінено з errorData.error на errorData.message
        throw new Error(errorData.message || 'Failed to add instructor');
      }
      
      const newInstructor = await response.json();
      setAllInstructors(prev => [...prev, newInstructor]);
      alert('Instructor added successfully!');
    } else {
      const response = await fetch(`http://localhost:5000/api/admin/InstructorsComponent/instructors/${selectedInstructor.TIN}`, {
        method: 'PUT',
        headers: getRequestHeaders(),
        body: JSON.stringify(formData)
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        // Змінено з errorData.error на errorData.message
        throw new Error(errorData.message || 'Failed to update instructor');
      }
      
      const updatedInstructor = await response.json();
      setAllInstructors(prev => 
        prev.map(instructor => instructor.TIN === selectedInstructor.TIN ? updatedInstructor : instructor)
      );
      alert('Instructor updated successfully!');
    }
    
    setShowInstructorModal(false);
    filterInstructors();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

const handleDeleteInstructor = async (TIN) => {
  if (window.confirm('Are you sure you want to delete this instructor?')) {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/InstructorsComponent/instructors/${TIN}`, {
        method: 'DELETE',
        headers: getRequestHeaders()
      });
      
      if (response.status === 403) {
        throw new Error('Access denied: insufficient permissions');
      }
      
      // Якщо відповідь не успішна, отримуємо деталі помилки
      if (!response.ok) {
        const errorData = await response.json();
        // Використовуємо повідомлення з сервера або загальне повідомлення
        throw new Error(errorData.message || 'Failed to delete instructor');
      }
      
      // Успішне видалення
      setAllInstructors(prev => prev.filter(instructor => instructor.TIN !== TIN));
      setInstructors(prev => prev.filter(instructor => instructor.TIN !== TIN));
      alert('Instructor deleted successfully!');
      
    } catch (err) {
      // Показуємо конкретну помилку користувачу
      alert('Error deleting instructor: ' + err.message);
    }
  }
};

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const getCarDetails = (carId) => {
    const car = cars.find(car => car.id === carId);
    return car ? `${car.brand} ${car.model} (${car.license_plate})` : 'N/A';
  };

  const renderFiltersView = () => {
    return (
      <div className="instructors-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Instructors</h3>
        <div className="instructors-filters-form">
          <div className="instructors-filter-group">
            <label htmlFor="tin">TIN:</label>
            <input 
              type="text" 
              id="tin" 
              name="tin" 
              value={filters.tin} 
              onChange={handleFilterChange} 
              placeholder="Enter TIN"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="login">Login:</label>
            <input 
              type="text" 
              id="login" 
              name="login" 
              value={filters.login} 
              onChange={handleFilterChange}
              placeholder="Enter login"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="firstName">First Name:</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={filters.firstName} 
              onChange={handleFilterChange} 
              placeholder="Enter first name"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="lastName">Last Name:</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={filters.lastName} 
              onChange={handleFilterChange} 
              placeholder="Enter last name"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
  <label htmlFor="email">Email:</label>
  <input 
    type="text" 
    id="email" 
    name="email" 
    value={filters.email} 
    onChange={handleFilterChange} 
    placeholder="Enter email"
    className="instructors-filter-input"
  />
</div>
<div className="instructors-filter-group">
  <label htmlFor="phone">Phone:</label>
  <input 
    type="text" 
    id="phone" 
    name="phone" 
    value={filters.phone} 
    onChange={handleFilterChange} 
    placeholder="Enter phone"
    className="instructors-filter-input"
  />
</div>
<div className="instructors-filter-group">
  <label htmlFor="birthDateFrom">Birth Date From:</label>
  <input 
    type="date" 
    id="birthDateFrom" 
    name="birthDateFrom" 
    value={filters.birthDateFrom} 
    onChange={handleFilterChange}
    className="instructors-filter-input"
  />
</div>
<div className="instructors-filter-group">
  <label htmlFor="birthDateTo">Birth Date To:</label>
  <input 
    type="date" 
    id="birthDateTo" 
    name="birthDateTo" 
    value={filters.birthDateTo} 
    onChange={handleFilterChange}
    className="instructors-filter-input"
  />
</div>
          <div className="instructors-filter-group">
            <label htmlFor="drivingCategory">Driving Category:</label>
            <select 
              id="drivingCategory" 
              name="drivingCategory" 
              value={filters.drivingCategory} 
              onChange={handleFilterChange}
              className="instructors-filter-select"
            >
              <option value="">All Categories</option>
              <option value="A">Category A</option>
              <option value="B">Category B</option>
              <option value="C">Category C</option>
              <option value="D">Category D</option>
              <option value="E">Category E</option>
            </select>
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="experienceFrom">Experience From (years):</label>
            <input 
              type="number" 
              id="experienceFrom" 
              name="experienceFrom" 
              value={filters.experienceFrom} 
              onChange={handleFilterChange}
              min="0"
              max="50"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="experienceTo">Experience To (years):</label>
            <input 
              type="number" 
              id="experienceTo" 
              name="experienceTo" 
              value={filters.experienceTo} 
              onChange={handleFilterChange}
              min="0"
              max="50"
              className="instructors-filter-input"
            />
          </div>
          <div className="instructors-filter-group">
            <label htmlFor="carId">Car:</label>
            <select 
              id="carId" 
              name="carId" 
              value={filters.carId} 
              onChange={handleFilterChange}
              className="instructors-filter-select"
            >
              <option value="">All Cars</option>
              {cars.map(car => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model} ({car.license_plate})
                </option>
              ))}
            </select>
          </div>
          <div className="instructors-filters-buttons">
            <button type="button" className="instructors-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

const renderTableView = () => {
  return (
    <div className="instructors-table-wrapper">
      <table className="instructors-table">
        <thead>
          <tr>
            <th>TIN</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Birth Date</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Driving Category</th>
            <th>Experience (years)</th>
            <th>Car</th>
            <th>Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {instructors.length > 0 ? (
            instructors.map(instructor => (
              <tr key={instructor.TIN}>
                <td>{instructor.TIN || 'N/A'}</td>
                <td>{instructor.first_name || 'N/A'}</td>
                <td>{instructor.last_name || 'N/A'}</td>
                <td>{instructor.birth_date ? new Date(instructor.birth_date).toLocaleDateString() : 'N/A'}</td>
                <td>{instructor.email || 'N/A'}</td>
                <td>{instructor.phone || 'N/A'}</td>
                <td>{instructor.driving_category || 'N/A'}</td>
                <td>{instructor.experience_years || 'N/A'}</td>
                <td>{instructor.car_id ? getCarDetails(instructor.car_id) : 'N/A'}</td>
                <td>{instructor.login || 'N/A'}</td>
                <td>
                  <button 
                    className="instructors-action instructors-edit" 
                    onClick={() => openEditInstructorModal(instructor)}
                  >
                    Edit
                  </button>
                  <button 
                    className="instructors-action instructors-delete" 
                    onClick={() => handleDeleteInstructor(instructor.TIN)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="11" className="instructors-loading"><i>No instructors found</i></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

  return (
    <div className="instructors-page">
      <div className="instructors-toggle-container">
        <button 
          className="instructors-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && (
          <button 
            className="instructors-add-instructor-button" 
            onClick={openAddInstructorModal}
          >
            Add New Instructor
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="instructors-loading">Loading instructors...</div>
      ) : error ? (
        <div className="instructors-error">{error}</div>
      ) : (
        <div className="instructors-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showInstructorModal && (
        <>
          <div className="instructors-modal-backdrop" onClick={() => setShowInstructorModal(false)} />
          <div className="instructors-modal">
            <h3>{formMode === 'add' ? 'Add New Instructor' : 'Edit Instructor'}</h3>
            <form onSubmit={handleInstructorFormSubmit}>
              <div className="instructors-filter-group">
                <label htmlFor="TIN">TIN:</label>
                <input 
                  type="text" 
                  id="TIN" 
                  name="TIN" 
                  value={instructorForm.TIN} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="first_name">First Name:</label>
                <input 
                  type="text" 
                  id="first_name" 
                  name="first_name" 
                  value={instructorForm.first_name} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="last_name">Last Name:</label>
                <input 
                  type="text" 
                  id="last_name" 
                  name="last_name" 
                  value={instructorForm.last_name} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="login">Login:</label>
                <input 
                  type="text" 
                  id="login" 
                  name="login" 
                  value={instructorForm.login} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                  placeholder="Enter login"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="password">Password:</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  value={instructorForm.password} 
                  onChange={handleFormChange}
                  required={formMode === 'add'}
                  minLength="4"
                  className="instructors-filter-input"
                  placeholder={formMode === 'add' ? 'Enter password (min 4 characters)' : 'Leave empty to keep current password'}
                />
                {formMode === 'edit' && (
                  <small style={{color: '#666', fontSize: '12px'}}>
                    Leave empty to keep current password
                  </small>
                )}
              </div>
<div className="instructors-filter-group">
  <label htmlFor="birth_date">Birth Date:</label>
  <input 
    type="date" 
    id="birth_date" 
    name="birth_date" 
    value={instructorForm.birth_date} 
    onChange={handleFormChange}
    required
    max={new Date().toISOString().split('T')[0]}
    className="instructors-filter-input"
  />
</div>
              <div className="instructors-filter-group">
                <label htmlFor="email">Email:</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={instructorForm.email} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="phone">Phone:</label>
                <input 
                  type="text" 
                  id="phone" 
                  name="phone" 
                  value={instructorForm.phone} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="driving_category">Driving Category:</label>
                <select 
                  id="driving_category" 
                  name="driving_category" 
                  value={instructorForm.driving_category} 
                  onChange={handleFormChange}
                  required
                  className="instructors-filter-select"
                >
                  <option value="">Select Category</option>
                  <option value="A">Category A</option>
                  <option value="B">Category B</option>
                  <option value="C">Category C</option>
                  <option value="D">Category D</option>
                  <option value="E">Category E</option>
                </select>
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="experience_years">Experience (years):</label>
                <input 
                  type="number" 
                  id="experience_years" 
                  name="experience_years" 
                  value={instructorForm.experience_years} 
                  onChange={handleFormChange}
                  min="0"
                  max="50"
                  required
                  className="instructors-filter-input"
                />
              </div>
              <div className="instructors-filter-group">
                <label htmlFor="car_id">Car:</label>
                <select 
                  id="car_id" 
                  name="car_id" 
                  value={instructorForm.car_id} 
                  onChange={handleFormChange}
                  className="instructors-filter-select"
                >
                  <option value="">Select Car</option>
                  {cars.map(car => (
                    <option key={car.id} value={car.id}>
                      {car.brand} {car.model} ({car.license_plate})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="submit" className="instructors-action instructors-edit">
                  {formMode === 'add' ? 'Add Instructor' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="instructors-action instructors-delete"
                  onClick={() => setShowInstructorModal(false)}
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

export default InstructorsComponent;