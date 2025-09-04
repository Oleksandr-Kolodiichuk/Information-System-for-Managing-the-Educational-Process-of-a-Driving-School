import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  const userRole = localStorage.getItem('userRole');
  const currentPath = window.location.pathname;
  if (!user || !userRole) {
    return <Navigate to="/" replace />;
  }
  const allowedRoutes = {
    'admin': ['/admin'],
    'instructor': ['/instructor'],
    'teacher': ['/teacher']
  };
  const userAllowedRoutes = allowedRoutes[userRole];
  const isRouteAllowed = userAllowedRoutes?.some(route => 
    currentPath.startsWith(route)
  );
  if (!isRouteAllowed) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default ProtectedRoute;