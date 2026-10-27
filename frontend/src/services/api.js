import axios from 'axios';
import { API_BASE } from '../config';
import { clearSession } from './session';

const API = axios.create({
  baseURL: API_BASE,
});

// Automatically include token
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// When the server refuses an action because the current Terms have not been accepted, send the person to accept them.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // A token that is expired, or for an account that no longer exists: drop it and ask the person to log in again.
    // (A 401 from the login/signup/reset forms themselves is just a wrong answer, not a dead session.)
    const authForm = /\/auth\/(login|register|forgot-password|reset-password|resend-verification|google-login)/.test(err.config?.url || '');
    if (err.response?.status === 401 && !authForm && localStorage.getItem('token')) {
      clearSession();
      if (!['/login', '/signup'].includes(window.location.pathname)) window.location.assign('/login');
    }
    if (err.response?.status === 403 && err.response.data?.code === 'TERMS_REQUIRED' && window.location.pathname !== '/accept-terms') {
      window.location.assign('/accept-terms');
    }
    return Promise.reject(err);
  }
);

export default API;
