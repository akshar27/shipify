import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../src/lib/api', () => {
  const api = { get: jest.fn(async () => ({ data: [] })), post: jest.fn(), patch: jest.fn() };
  return { __esModule: true, default: api, setToken: jest.fn(), setHandlers: jest.fn(), errMsg: () => 'err' };
});
jest.mock('../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
import { useAuth } from '../src/auth/AuthContext';
import RootNavigator from '../src/navigation/RootNavigator';

const ME = { id: 'me', name: 'Me', email: 'me@x.com', role: 'user', isVerified: true, termsAccepted: true };
const state = (over) => useAuth.mockReturnValue({ status: 'in', user: ME, retry: jest.fn(), refresh: jest.fn(async () => ME), signOut: jest.fn(), ...over });

test('logged out people see the log in screen', async () => {
  state({ status: 'out', user: null });
  await render(<RootNavigator />);
  expect(await screen.findByText('Create an account')).toBeTruthy();
});

test('someone who has not accepted the current terms cannot reach the app', async () => {
  state({ user: { ...ME, termsAccepted: false } });
  await render(<RootNavigator />);
  expect(await screen.findByText('Please accept the Terms')).toBeTruthy();
  expect(screen.queryByText('New delivery')).toBeNull();
});

test('a normal user lands on the Send tab', async () => {
  state();
  await render(<RootNavigator />);
  expect(await screen.findByText('New delivery')).toBeTruthy();
});

test('offline offers a retry', async () => {
  const retry = jest.fn();
  state({ status: 'offline', user: null, retry });
  await render(<RootNavigator />);
  expect(await screen.findByText("Can't reach Shipify")).toBeTruthy();
});
