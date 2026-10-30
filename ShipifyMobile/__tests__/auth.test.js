import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { axiosError, networkError } from './helpers';

jest.mock('../src/lib/api', () => {
  const api = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };
  return { __esModule: true, default: api, setToken: jest.fn(), setHandlers: jest.fn(), errMsg: (e) => e?.response?.data?.msg || 'err' };
});
import api, { setHandlers, setToken } from '../src/lib/api';
import { storage } from '../src/lib/storage';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

let auth;
const Probe = () => { auth = useAuth(); return <Text>{auth.status}</Text>; };
const mount = async () => await render(<AuthProvider><Probe /></AuthProvider>);
const user = { id: 'u1', name: 'A', email: 'a@x.com', isVerified: true, termsAccepted: true };

beforeEach(async () => { jest.clearAllMocks(); [api.get, api.post, api.patch].forEach((f) => f.mockReset()); await storage.remove('token'); });

test('with no saved token the app starts logged out', async () => {
  const { findByText } = await mount();
  await findByText('out');
  expect(api.get).not.toHaveBeenCalled();
});

test('a saved token is checked with the server and restores the session', async () => {
  await storage.set('token', 'tok');
  api.get.mockResolvedValueOnce({ data: user });
  const { findByText } = await mount();
  await findByText('in');
  expect(setToken).toHaveBeenCalledWith('tok');
  expect(auth.user.id).toBe('u1');
});

test('a saved token the server rejects is thrown away', async () => {
  await storage.set('token', 'old');
  api.get.mockRejectedValueOnce(axiosError(401, { msg: 'expired' }));
  const { findByText } = await mount();
  await findByText('out');
  expect(await storage.get('token')).toBeNull();
});

test('if the server cannot be reached the token is kept and the app says offline', async () => {
  await storage.set('token', 'tok');
  api.get.mockRejectedValueOnce(networkError());
  const { findByText } = await mount();
  await findByText('offline');
  expect(await storage.get('token')).toBe('tok');
  api.get.mockResolvedValueOnce({ data: user });
  await act(async () => { await auth.retry(); });
  await findByText('in');
});

test('login stores the token and signs in; logout removes it', async () => {
  const { findByText } = await mount();
  await findByText('out');
  api.post.mockResolvedValueOnce({ data: { token: 'new', user } });
  await act(async () => { await auth.login('a@x.com', 'pw'); });
  await findByText('in');
  expect(await storage.get('token')).toBe('new');
  await act(async () => { await auth.signOut(); });
  await findByText('out');
  expect(await storage.get('token')).toBeNull();
  expect(setToken).toHaveBeenLastCalledWith(null);
});

test('a failed login leaves the user logged out and surfaces the error', async () => {
  const { findByText } = await mount();
  await findByText('out');
  api.post.mockRejectedValueOnce(axiosError(400, { msg: 'Invalid credentials' }));
  await expect(auth.login('a@x.com', 'bad')).rejects.toBeTruthy();
  expect(auth.status).toBe('out');
});

test('register always sends acceptTerms: true (the screen enforces the checkbox)', async () => {
  const { findByText } = await mount();
  await findByText('out');
  api.post.mockResolvedValueOnce({ data: {} });
  await auth.register('A', 'a@x.com', 'password1');
  expect(api.post).toHaveBeenCalledWith('/auth/register', { name: 'A', email: 'a@x.com', password: 'password1', acceptTerms: true });
});

test('a 401 anywhere signs the user out; TERMS_REQUIRED flips termsAccepted off', async () => {
  await storage.set('token', 'tok');
  api.get.mockResolvedValueOnce({ data: user });
  const { findByText } = await mount();
  await findByText('in');
  const handlers = setHandlers.mock.calls[0][0];
  await act(async () => { handlers.onTermsRequired(); });
  await waitFor(() => expect(auth.user.termsAccepted).toBe(false));
  await act(async () => { await handlers.onUnauthorized(); });
  await findByText('out');
});

test('accepting terms posts then refreshes the user', async () => {
  await storage.set('token', 'tok');
  api.get.mockResolvedValueOnce({ data: { ...user, termsAccepted: false } });
  const { findByText } = await mount();
  await findByText('in');
  api.post.mockResolvedValueOnce({ data: {} });
  api.get.mockResolvedValueOnce({ data: user });
  await act(async () => { await auth.acceptTerms(); });
  expect(api.post).toHaveBeenCalledWith('/auth/accept-terms', { accept: true });
  expect(auth.user.termsAccepted).toBe(true);
});
