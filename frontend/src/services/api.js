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

export default API;
