import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

let mockAuthState = {
  user: null as any,
  isAuthenticated: false,
  loading: false,
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

describe('ProtectedRoute', () => {
  it('shows loading when auth is loading', () => {
    mockAuthState = { user: null, isAuthenticated: false, loading: true };
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockAuthState = { user: null, isAuthenticated: false, loading: false };
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockAuthState = {
      user: { id: 1, username: 'u1', user_type: 'student' },
      isAuthenticated: true,
      loading: false,
    };
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects when user type does not match requiredType', () => {
    mockAuthState = {
      user: { id: 1, username: 'u1', user_type: 'student' },
      isAuthenticated: true,
      loading: false,
    };
    render(
      <MemoryRouter>
        <ProtectedRoute requiredType="teacher"><div>Teacher Only</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.queryByText('Teacher Only')).not.toBeInTheDocument();
  });

  it('renders when user type matches requiredType', () => {
    mockAuthState = {
      user: { id: 1, username: 'u1', user_type: 'teacher' },
      isAuthenticated: true,
      loading: false,
    };
    render(
      <MemoryRouter>
        <ProtectedRoute requiredType="teacher"><div>Teacher Only</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(screen.getByText('Teacher Only')).toBeInTheDocument();
  });
});
