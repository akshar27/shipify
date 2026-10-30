import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import api, { setHandlers, setToken } from '../lib/api';
import { storage } from '../lib/storage';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = 'token';

export function AuthProvider({ children }) {
  // status: loading (reading the stored token) | out | in | offline (token present but the server could not be reached)
  const [state, setState] = useState({ status: 'loading', user: null });

  const signOut = useCallback(async () => {
    setToken(null);
    await storage.remove(TOKEN_KEY);
    setState({ status: 'out', user: null });
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setState((s) => (s.status === 'in' ? { status: 'in', user: data } : s));
    return data;
  }, []);

  const boot = useCallback(async () => {
    setState({ status: 'loading', user: null });
    const saved = await storage.get(TOKEN_KEY);
    if (!saved) return setState({ status: 'out', user: null });
    setToken(saved);
    try {
      const { data } = await api.get('/auth/me');
      setState({ status: 'in', user: data });
    } catch (err) {
      if (err.response) await signOut(); // the server answered and said no: the token is dead
      else setState({ status: 'offline', user: null });
    }
  }, [signOut]);

  useEffect(() => {
    setHandlers({
      onUnauthorized: signOut,
      onTermsRequired: () => setState((s) => (s.user ? { ...s, user: { ...s.user, termsAccepted: false } } : s)),
    });
    boot();
  }, [boot, signOut]);

  // Coming back to the app is when an admin's ID approval is most likely to have happened.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      retry: boot,
      signOut,
      async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password });
        setToken(data.token);
        await storage.set(TOKEN_KEY, data.token);
        setState({ status: 'in', user: data.user });
      },
      register: (name, email, password) => api.post('/auth/register', { name, email, password, acceptTerms: true }),
      async acceptTerms() {
        await api.post('/auth/accept-terms', { accept: true });
        await refresh();
      },
    }),
    [state, refresh, boot, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
