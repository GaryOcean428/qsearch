import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  user_id: string;
  provider: string;
  email: string;
  name: string;
  avatar_url: string;
}

export interface AuthProviders {
  google: boolean;
  microsoft: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  providers: AuthProviders;
  authEnabled: boolean;
  login: (provider: string) => void;
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
  const [providers, setProviders] = useState<AuthProviders>({ google: false, microsoft: false });
  const [authEnabled, setAuthEnabled] = useState(false);

  // Get API base URL from environment
  const apiBase = import.meta.env.VITE_QSEARCH_API_BASE || '';

  // Check authentication status and available providers
  const refreshUser = async () => {
    try {
      // Check which providers are enabled
      const providersRes = await fetch(`${apiBase}/api/v1/auth/providers`, {
        credentials: 'include',
      });
      
      if (providersRes.ok) {
        const providersData = await providersRes.json();
        setAuthEnabled(providersData.enabled || false);
        setProviders(providersData.providers || { google: false, microsoft: false });
      }

      // Check if user is authenticated
      if (authEnabled) {
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
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    refreshUser();
  }, []);

  // Login by redirecting to OAuth provider
  const login = (provider: string) => {
    window.location.href = `${apiBase}/api/v1/auth/${provider}/login`;
  };

  // Logout
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
    providers,
    authEnabled,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
