/**
 * useAuth Hook
 * @description Authentication state management for React apps
 */

import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface UseAuthOptions {
  baseURL?: string;
  storageKey?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseAuthReturn {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignUpCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}

/**
 * Parse an error response body into a message without throwing when the
 * body is not JSON (proxies/edge errors often return HTML).
 */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' && body !== null &&
      'message' in body && typeof (body as { message: unknown }).message === 'string' &&
      (body as { message: string }).message
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // Not JSON — fall through to the fallback message.
  }
  return fallback;
}

/**
 * Authentication hook for React apps
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    baseURL = '',
    storageKey = 'auth_token',
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
  } = options;

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  /**
   * Get stored token
   */
  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  }, [storageKey]);

  /**
   * Set token
   */
  const setToken = useCallback((token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, token);
  }, [storageKey]);

  /**
   * Clear token
   */
  const clearToken = useCallback((): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  /**
   * Validate session and fetch user data
   */
  const validateSession = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      const response = await fetch(`${baseURL}/api/auth/validate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid session');
      }

      const body = (await response.json()) as { user?: User };
      const { user } = body;

      setAuthState({
        user: user ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      clearToken();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Session validation failed',
      });
    }
  }, [baseURL, getToken, clearToken]);

  /**
   * Login
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Login failed'));
      }

      const body = (await response.json()) as { token?: string; user?: User };
      const { token, user } = body;

      if (!token) {
        throw new Error('Auth response did not include a token');
      }

      setToken(token);
      setAuthState({
        user: user ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, [baseURL, setToken]);

  /**
   * Signup
   */
  const signup = useCallback(async (credentials: LoginCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${baseURL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Signup failed'));
      }

      const body = (await response.json()) as { token?: string; user?: User };
      const { token, user } = body;

      if (!token) {
        throw new Error('Auth response did not include a token');
      }

      setToken(token);
      setAuthState({
        user: user ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Signup failed',
      }));
      throw error;
    }
  }, [baseURL, setToken]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = getToken();
      if (token) {
        await fetch(`${baseURL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Logout failures on the server must not block local session teardown
    } finally {
      clearToken();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, [baseURL, getToken, clearToken]);

  /**
   * Refresh session
   */
  const refresh = useCallback(async () => {
    await validateSession();
  }, [validateSession]);

  /**
   * Update user data
   */
  const updateUser = useCallback(async (updates: Partial<User>) => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = getToken();
      const response = await fetch(`${baseURL}/api/auth/user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Update failed'));
      }

      const body = (await response.json()) as { user?: User };
      const { user } = body;

      setAuthState((prev) => ({
        ...prev,
        user: user ?? prev.user,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Update failed',
      }));
      throw error;
    }
  }, [baseURL, getToken]);

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setAuthState((prev) => ({ ...prev, error: null }));
  }, []);

  // Validate session on mount
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Auto-refresh session
  useEffect(() => {
    if (!autoRefresh || !authState.isAuthenticated) return;

    const interval = setInterval(() => {
      validateSession();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, validateSession, authState.isAuthenticated]);

  return {
    authState,
    login,
    signup,
    logout,
    refresh,
    updateUser,
    clearError,
  };
}
