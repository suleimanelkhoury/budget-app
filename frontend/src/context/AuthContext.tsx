/**
 * Authentication context — manages JWT token and user state.
 *
 * Provides login, register, and logout functions, plus the current user
 * and an `isAuthenticated` flag. The token is persisted in localStorage
 * so it survives page refreshes.
 */

import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api';
import type { User, UserCreate, UserLogin } from '../types';

interface AuthContextValue {
  /** The currently logged-in user, or null if not authenticated. */
  user: User | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the auth state is still loading (e.g. on initial mount). */
  isLoading: boolean;
  /** Log in with email + password. */
  login: (data: UserLogin) => Promise<void>;
  /** Register a new account and automatically log in. */
  register: (data: UserCreate) => Promise<void>;
  /** Log out and clear the stored token. */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

/** Read the stored user from localStorage (used for lazy initial state). */
function getStoredUser(): User | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);

  if (token && storedUser) {
    try {
      return JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initial state — reads from localStorage on first render, no effect needed
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [isLoading] = useState(false); // Synchronous init, no loading needed

  // ── Login ──────────────────────────────────
  const login = useCallback(async (data: UserLogin) => {
    const token = await authApi.login(data);
    localStorage.setItem(TOKEN_KEY, token.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(token.user));
    setUser(token.user);
  }, []);

  // ── Register ───────────────────────────────
  const register = useCallback(async (data: UserCreate) => {
    const token = await authApi.register(data);
    localStorage.setItem(TOKEN_KEY, token.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(token.user));
    setUser(token.user);
  }, []);

  // ── Logout ─────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
