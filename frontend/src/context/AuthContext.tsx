import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    full_name: string;
    user_type: string;
    password: string;
    password_confirm: string;
  }) => Promise<void>;
  logout: () => void;
  setAuthFromResponse: (response: AuthResponse) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/auth/me/');
      setUser(res.data);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (username: string, password: string) => {
    const res = await client.post<AuthResponse>('/auth/login/', { username, password });
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const register = async (data: {
    username: string;
    email: string;
    full_name: string;
    user_type: string;
    password: string;
    password_confirm: string;
  }) => {
    const res = await client.post<AuthResponse>('/auth/register/', data);
    localStorage.setItem('auth_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const setAuthFromResponse = (response: AuthResponse) => {
    localStorage.setItem('auth_token', response.token);
    setUser(response.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        setAuthFromResponse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
