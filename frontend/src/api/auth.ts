/**
 * Auth API service — register and login.
 */

import { api } from './client';
import type { Token, UserCreate, UserLogin } from '../types';

export const authApi = {
  /** Register a new user and receive a JWT token. */
  register: async (data: UserCreate): Promise<Token> => {
    const response = await api.post<Token>('/auth/register', data);
    return response.data;
  },

  /** Log in with email + password and receive a JWT token. */
  login: async (data: UserLogin): Promise<Token> => {
    const response = await api.post<Token>('/auth/login', data);
    return response.data;
  },
};
