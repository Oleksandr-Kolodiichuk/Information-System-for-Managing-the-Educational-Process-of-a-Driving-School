import React, { useState, useEffect, useCallback } from 'react';
import './FleetManagementComponent.css';

const FleetManagementComponent = () => {
  const [cars, setCars] = useState([]);
  const [allCars, setAllCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [showCarModal, setShowCarModal] = useState(false);
  const [formMode, setFormMode] = useState('add');
  
  const [carForm, setCarForm] = useState({
    car_brand_name: '',
    car_model_name: '',
    car_condition_id: '',
    car_category_id: '',
    year_of_manufacture: '',
    license_plate: ''
  });
  
  const [filters, setFilters] = useState({
    car_brand: '',
    car_model: '',
    car_category: '',
    car_condition: '',
    yearFrom: '',
    yearTo: '',
    licensePlate: ''
  });
  
  const [carBrands, setCarBrands] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [carConditions, setCarConditions] = useState([]);
  const [carCategories, setCarCategories] = useState([]);

  useEffect(() => {
    fetchCars();
    fetchDropdownOptions();
  }, []);

  const getRequestHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'user-role': 'admin'
    };
  };

  const fetchDropdownOptions = async () => {
    try {
      const brandsResponse = await fetch('http://localhost:5000/api/admin/car-brands', {
        headers: getRequestHeaders()
      });
      if (!brandsResponse.ok) {
        throw new Error('Failed to fetch car brands');
      }
      const brandsData = await brandsResponse.json();
      setCarBrands(brandsData);
      
      const conditionsResponse = await fetch('http://localhost:5000/api/admin/car-conditions', {
        headers: getRequestHeaders()
      });
      if (!conditionsResponse.ok) {
        throw new Error('Failed to fetch car conditions');
      }
      const conditionsData = await conditionsResponse.json();
      setCarConditions(conditionsData);
      
      const categoriesResponse = await fetch('http://localhost:5000/api/admin/car-categories', {
        headers: getRequestHeaders()
      });
      if (!categoriesResponse.ok) {
        throw new Error('Failed to fetch car categories');
      }
      const categoriesData = await categoriesResponse.json();
      setCarCategories(categoriesData);
      
      const modelsResponse = await fetch('http://localhost:5000/api/admin/car-models', {
        headers: getRequestHeaders()
      });
      if (!modelsResponse.ok) {
        throw new Error('Failed to fetch car models');
      }
      const modelsData = await modelsResponse.json();
      setCarModels(modelsData);
      
    } catch (err) {
      setError('Error loading dropdown options: ' + err.message);
    }
  };

  const fetchCars = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/cars', {
        headers: getRequestHeaders()
      });
      if (!response.ok) {
        throw new Error('Failed to fetch cars');
      }
      const data = await response.json();
      setAllCars(data);
      setCars(data);
      setError(null);
    } catch (err) {
      setError('Error loading cars: ' + err.message);
      setCars([]);
      setAllCars([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCars = useCallback(() => {
    let filteredResults = [...allCars];
    
    if (filters.car_brand) {
      filteredResults = filteredResults.filter(car => 
        car.car_brand_name && car.car_brand_name.toLowerCase().includes(filters.car_brand.toLowerCase())
      );
    }
    
    if (filters.car_model) {
      filteredResults = filteredResults.filter(car => 
        car.car_model_name && car.car_model_name.toLowerCase().includes(filters.car_model.toLowerCase())
      );
    }
    
    if (filters.licensePlate) {
      filteredResults = filteredResults.filter(car => 
        car.license_plate && car.license_plate.toLowerCase().includes(filters.licensePlate.toLowerCase())
      );
    }
    
    if (filters.car_category) {
      filteredResults = filteredResults.filter(car => 
        car.car_category_name === filters.car_category
      );
    }
    
    if (filters.car_condition) {
      filteredResults = filteredResults.filter(car => 
        car.car_condition === filters.car_condition
      );
    }
    
    if (filters.yearFrom) {
      filteredResults = filteredResults.filter(car => 
        car.year_of_manufacture && car.year_of_manufacture >= parseInt(filters.yearFrom)
      );
    }
    
    if (filters.yearTo) {
      filteredResults = filteredResults.filter(car => 
        car.year_of_manufacture && car.year_of_manufacture <= parseInt(filters.yearTo)
      );
    }
    
    setCars(filteredResults);
  }, [allCars, filters]);

  useEffect(() => {
    filterCars();
  }, [filterCars]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      car_brand: '',
      car_model: '',
      car_category: '',
      car_condition: '',
      yearFrom: '',
      yearTo: '',
      licensePlate: ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    // Limit year field to 4 digits
    if (name === 'year_of_manufacture' && value.length > 4) {
      return;
    }
    
    setCarForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const openAddCarModal = () => {
    setSelectedCar(null);
    setCarForm({
      car_brand_name: '',
      car_model_name: '',
      car_condition_id: '',
      car_category_id: '',
      year_of_manufacture: '',
      license_plate: ''
    });
    setFormMode('add');
    setShowCarModal(true);
  };

  const openEditCarModal = (car) => {
    setSelectedCar(car);
    
    // Find the category ID based on the category name
    const category = carCategories.find(cat => cat.car_category_name === car.car_category_name);
    const categoryId = category ? category.car_category_id : '';
    
    setCarForm({
      car_brand_name: car.car_brand_name || '',
      car_model_name: car.car_model_name || '',
      car_condition_id: car.car_condition_id || '',
      car_category_id: categoryId,
      year_of_manufacture: car.year_of_manufacture || '',
      license_plate: car.license_plate || ''
    });
    setFormMode('edit');
    setShowCarModal(true);
  };

  const handleCarFormSubmit = async (e) => {
    e.preventDefault();
    
    // Validate year
    const currentYear = new Date().getFullYear();
    const year = parseInt(carForm.year_of_manufacture);
    if (year < 1980 || year > currentYear) {
      alert(`Year must be between 1980 and ${currentYear}`);
      return;
    }
    
    try {
      if (formMode === 'add') {
        // Use the correct endpoint for adding cars
        const response = await fetch('http://localhost:5000/api/admin/cars', {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify({
            ...carForm,
            year_of_manufacture: parseInt(carForm.year_of_manufacture)
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add car');
        }
        
        const result = await response.json();
        console.log('Car added successfully:', result);
        
        // Refresh the full list to get updated dropdown options
        await fetchDropdownOptions();
        await fetchCars();
        alert('Car added successfully!');
      } else {
        // Use the correct endpoint for updating cars
        const response = await fetch(`http://localhost:5000/api/admin/cars/${selectedCar.car_id}`, {
          method: 'PUT',
          headers: getRequestHeaders(),
          body: JSON.stringify({
            ...carForm,
            year_of_manufacture: parseInt(carForm.year_of_manufacture)
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update car');
        }
        
        const result = await response.json();
        console.log('Car updated successfully:', result);
        
        // Refresh the full list to get updated dropdown options
        await fetchDropdownOptions();
        await fetchCars();
        alert('Car updated successfully!');
      }
      
      setShowCarModal(false);
      setError(null);
    } catch (err) {
      console.error('Error in form submission:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteCar = async (id) => {
    if (window.confirm('Are you sure you want to delete this car?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/cars/${id}`, {
          method: 'DELETE',
          headers: getRequestHeaders()
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete car');
        }
        
        // Remove the car from both arrays
        setAllCars(prev => prev.filter(car => car.car_id !== id));
        setCars(prev => prev.filter(car => car.car_id !== id));
        
        alert('Car deleted successfully!');
      } catch (err) {
        console.error('Error deleting car:', err);
        alert('Error deleting car: ' + err.message);
      }
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const renderFiltersView = () => {
    return (
      <div className="fleet-management-filters">
        <h3 style={{ marginTop: '20px' }}>Filter Cars</h3>
        <div className="fleet-management-filters-form">
          <div className="fleet-management-filter-group">
            <label htmlFor="car_brand">Brand:</label>
            <select 
              id="car_brand" 
              name="car_brand" 
              value={filters.car_brand} 
              onChange={handleFilterChange}
              className="fleet-management-filter-select"
            >
              <option value="">All Brands</option>
              {carBrands.map(brand => (
                <option key={brand.car_brand_id} value={brand.car_brand_name}>{brand.car_brand_name}</option>
              ))}
            </select>
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="car_model">Model:</label>
            <select 
              id="car_model" 
              name="car_model" 
              value={filters.car_model} 
              onChange={handleFilterChange}
              className="fleet-management-filter-select"
            >
              <option value="">All Models</option>
              {carModels.map(model => (
                <option key={model.car_model_id} value={model.car_model_name}>{model.car_model_name}</option>
              ))}
            </select>
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="licensePlate">License Plate:</label>
            <input 
              type="text" 
              id="licensePlate" 
              name="licensePlate" 
              value={filters.licensePlate} 
              onChange={handleFilterChange} 
              maxLength="20"
              placeholder="Enter license plate"
              className="fleet-management-filter-input"
            />
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="car_category">Category:</label>
            <select 
              id="car_category" 
              name="car_category" 
              value={filters.car_category} 
              onChange={handleFilterChange}
              className="fleet-management-filter-select"
            >
              <option value="">All Categories</option>
              {carCategories.map(category => (
                <option key={category.car_category_id} value={category.car_category_name}>
                  {category.car_category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="car_condition">Condition:</label>
            <select 
              id="car_condition" 
              name="car_condition" 
              value={filters.car_condition} 
              onChange={handleFilterChange}
              className="fleet-management-filter-select"
            >
              <option value="">All Conditions</option>
              {carConditions.map(condition => (
                <option key={condition.car_condition_id} value={condition.car_condition}>
                  {condition.car_condition}
                </option>
              ))}
            </select>
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="yearFrom">Year From:</label>
            <input 
              type="number" 
              id="yearFrom" 
              name="yearFrom" 
              value={filters.yearFrom} 
              onChange={handleFilterChange}
              min="1980"
              max={new Date().getFullYear()}
              className="fleet-management-filter-input"
            />
          </div>
          <div className="fleet-management-filter-group">
            <label htmlFor="yearTo">Year To:</label>
            <input 
              type="number" 
              id="yearTo" 
              name="yearTo" 
              value={filters.yearTo} 
              onChange={handleFilterChange}
              min="1980"
              max={new Date().getFullYear()}
              className="fleet-management-filter-input"
            />
          </div>
          <div className="fleet-management-filters-buttons">
            <button type="button" className="fleet-management-action" onClick={handleClearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    return (
      <div className="fleet-management-table-wrapper">
        <table className="fleet-management-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Model</th>
              <th>Category</th>
              <th>Year</th>
              <th>License Plate</th>
              <th>Condition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cars.length > 0 ? (
              cars.map(car => (
                <tr key={car.car_id}>
                  <td>{car.car_brand_name || 'N/A'}</td>
                  <td>{car.car_model_name || 'N/A'}</td>
                  <td>{car.car_category_name || 'N/A'}</td>
                  <td>{car.year_of_manufacture || 'N/A'}</td>
                  <td>{car.license_plate || 'N/A'}</td>
                  <td>
                    <span className={`fleet-management-condition condition-${car.car_condition?.toLowerCase().replace(' ', '-') || 'unknown'}`}>
                      {car.car_condition || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="fleet-management-action fleet-management-edit" 
                      onClick={() => openEditCarModal(car)}
                    >
                      Edit
                    </button>
                    <button 
                      className="fleet-management-action fleet-management-delete" 
                      onClick={() => handleDeleteCar(car.car_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="fleet-management-loading"><i>No cars found</i></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fleet-management-page">
      <div className="fleet-management-toggle-container">
        <button 
          className="fleet-management-toggle-button" 
          onClick={toggleFilters}
        >
          {showFilters ? 'Show Table' : 'Show Filters'}
        </button>
        
        {!showFilters && (
          <button 
            className="fleet-management-add-car-button" 
            onClick={openAddCarModal}
          >
            Add New Car
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="fleet-management-loading">Loading cars...</div>
      ) : error ? (
        <div className="fleet-management-error">{error}</div>
      ) : (
        <div className="fleet-management-container">
          {showFilters ? renderFiltersView() : renderTableView()}
        </div>
      )}
        
      {showCarModal && (
        <>
          <div className="fleet-management-modal-backdrop" onClick={() => setShowCarModal(false)} />
          <div className="fleet-management-modal">
            <h3>{formMode === 'add' ? 'Add New Car' : 'Edit Car'}</h3>
            <form onSubmit={handleCarFormSubmit}>
              <div className="fleet-management-filter-group">
                <label htmlFor="car_brand_name">Brand:</label>
                <input 
                  type="text" 
                  id="car_brand_name" 
                  name="car_brand_name" 
                  value={carForm.car_brand_name} 
                  onChange={handleFormChange}
                  required
                  maxLength="50"
                  placeholder="Enter car brand (will be created if doesn't exist)"
                  className="fleet-management-filter-input"
                />
              </div>
              <div className="fleet-management-filter-group">
                <label htmlFor="car_model_name">Model:</label>
                <input 
                  type="text" 
                  id="car_model_name" 
                  name="car_model_name" 
                  value={carForm.car_model_name} 
                  onChange={handleFormChange}
                  required
                  maxLength="50"
                  placeholder="Enter car model (will be created if doesn't exist)"
                  className="fleet-management-filter-input"
                />
              </div>
              <div className="fleet-management-filter-group">
                <label htmlFor="car_category_id">Category:</label>
                <select 
                  id="car_category_id" 
                  name="car_category_id" 
                  value={carForm.car_category_id} 
                  onChange={handleFormChange}
                  required
                  className="fleet-management-filter-select"
                >
                  <option value="">Select Category</option>
                  {carCategories.map(category => (
                    <option key={category.car_category_id} value={category.car_category_id}>
                      {category.car_category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fleet-management-filter-group">
                <label htmlFor="year_of_manufacture">Year of Manufacture:</label>
                <input 
                  type="number" 
                  id="year_of_manufacture" 
                  name="year_of_manufacture" 
                  value={carForm.year_of_manufacture} 
                  onChange={handleFormChange}
                  min="1980"
                  max={new Date().getFullYear()}
                  maxLength="4"
                  required
                  className="fleet-management-filter-input"
                />
              </div>
              <div className="fleet-management-filter-group">
                <label htmlFor="license_plate">License Plate:</label>
                <input 
                  type="text" 
                  id="license_plate" 
                  name="license_plate" 
                  value={carForm.license_plate} 
                  onChange={handleFormChange}
                  required
                  maxLength="20"
                  className="fleet-management-filter-input"
                />
              </div>
              <div className="fleet-management-filter-group">
                <label htmlFor="car_condition_id">Condition:</label>
                <select 
                  id="car_condition_id" 
                  name="car_condition_id" 
                  value={carForm.car_condition_id} 
                  onChange={handleFormChange}
                  required
                  className="fleet-management-filter-select"
                >
                  <option value="">Select Condition</option>
                  {carConditions.map(condition => (
                    <option key={condition.car_condition_id} value={condition.car_condition_id}>
                      {condition.car_condition}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="submit" className="fleet-management-action fleet-management-edit">
                  {formMode === 'add' ? 'Add Car' : 'Save Changes'}
                </button>
                <button 
                  type="button" 
                  className="fleet-management-action fleet-management-delete"
                  onClick={() => setShowCarModal(false)}
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

export default FleetManagementComponent;