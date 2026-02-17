import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredType?: 'teacher' | 'student';
}

export default function ProtectedRoute({ children, requiredType }: ProtectedRouteProps) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-5"><p>Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredType && user?.user_type !== requiredType) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
