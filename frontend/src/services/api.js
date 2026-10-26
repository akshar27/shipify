import axios from 'axios';
import { API_BASE } from '../config';

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
    if (err.response?.status === 403 && err.response.data?.code === 'TERMS_REQUIRED' && window.location.pathname !== '/accept-terms') {
      window.location.assign('/accept-terms');
    }
    return Promise.reject(err);
  }
);

export default API;
