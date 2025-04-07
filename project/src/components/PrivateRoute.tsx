import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is logged in but hasn't completed registration, redirect to registration type
  // Only redirect if they're not already on a registration-related page
  if (
    user.role === 'client' && 
    !user.registrationType && 
    !location.pathname.startsWith('/register')
  ) {
    return <Navigate to="/register/type" replace />;
  }

  return <>{children}</>;
}