import axios from 'axios';
import { API_BASE } from '../config';

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

let token = null;
let handlers = { onUnauthorized: () => {}, onTermsRequired: () => {} };

export const setToken = (t) => { token = t; };
export const setHandlers = (h) => { handlers = { ...handlers, ...h }; };

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    // An expired or revoked token: sign out. (Not while logging in: there a 401 is "verify your email first".)
    if (status === 401 && token) handlers.onUnauthorized();
    // The server refused because the current Terms are not accepted: the root navigator then shows the accept screen.
    if (status === 403 && data?.code === 'TERMS_REQUIRED') handlers.onTermsRequired();
    return Promise.reject(err);
  }
);

/** A sentence safe to show a person, for any failed request. */
export const errMsg = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.response) return err.response.data?.msg || fallback;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
  if (err?.request) return "Can't reach the server. Check your connection and try again.";
  return fallback;
};

export default api;
