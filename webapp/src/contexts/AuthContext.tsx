import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  user_id: string;
  email: string;
  name: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  authEnabled: boolean;
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(true);

  const apiBase = import.meta.env.VITE_QSEARCH_API_BASE || '';

  const refreshUser = async () => {
    try {
      const meRes = await fetch(`${apiBase}/api/v1/auth/me`, {
        credentials: 'include',
      });

      if (meRes.ok) {
        const data = await meRes.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const register = async (email: string, password: string, name?: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false, error: data.detail || 'Registration failed' };
    } catch (error) {
      return { ok: false, error: 'Network error' };
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false, error: data.detail || 'Login failed' };
    } catch (error) {
      return { ok: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiBase}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    authenticated: !!user,
    authEnabled,
    register,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
