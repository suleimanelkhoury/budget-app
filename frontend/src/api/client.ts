/**
 * Axios instance configured with the backend API base URL.
 *
 * The base URL and prefix come from Vite environment variables
 * (see .env / .env.example). The JWT token is automatically attached
 * to every request via an interceptor, and 401 responses trigger logout.
 */

import axios, { type AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? '/api';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach JWT token ────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle 401 ────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear it and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Only redirect if we're not already on the login/register page
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
