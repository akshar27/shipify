import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { axiosError, renderInNav } from './helpers';

jest.mock('../src/lib/api', () => {
  const api = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };
  return { __esModule: true, default: api, setToken: jest.fn(), setHandlers: jest.fn(), errMsg: (e) => e?.response?.data?.msg || 'Something went wrong. Please try again.' };
});
jest.mock('../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
import api from '../src/lib/api';
import { useAuth } from '../src/auth/AuthContext';
import LoginScreen from '../src/screens/auth/LoginScreen';
import SignupScreen from '../src/screens/auth/SignupScreen';
import CreateDeliveryScreen from '../src/screens/sender/CreateDeliveryScreen';
import DeliveryDetailScreen from '../src/screens/sender/DeliveryDetailScreen';
import DeliveriesScreen from '../src/screens/sender/DeliveriesScreen';
import JobsScreen from '../src/screens/traveler/JobsScreen';
import PostTripScreen from '../src/screens/traveler/PostTripScreen';
import AccountScreen from '../src/screens/account/AccountScreen';

const ME = { id: 'me', name: 'Me Myself', email: 'me@x.com', role: 'user', isVerified: true, termsAccepted: true };
const auth = (over = {}) => ({ status: 'in', user: ME, login: jest.fn(), register: jest.fn(), signOut: jest.fn(), refresh: jest.fn(async () => ME), acceptTerms: jest.fn(), ...over });
const type = async (label, text) => fireEvent.changeText(screen.getByLabelText(label), text);
const press = async (text) => fireEvent.press(screen.getByText(text));

beforeEach(() => {
  jest.clearAllMocks();
  [api.get, api.post, api.patch].forEach((f) => f.mockReset());
  useAuth.mockReturnValue(auth());
});

// ------------------------------------------------------------------------------------------------ login / signup
describe('login', () => {
  test('needs both fields and calls nothing otherwise', async () => {
    const a = auth(); useAuth.mockReturnValue(a);
    await renderInNav(LoginScreen);
    await press('Log in');
    expect(await screen.findByText('Enter your email and password.')).toBeTruthy();
    expect(a.login).not.toHaveBeenCalled();
  });

  test('an unverified email offers to resend the verification mail', async () => {
    const a = auth({ login: jest.fn().mockRejectedValue(axiosError(401, { msg: 'Please verify your email first.' })) });
    useAuth.mockReturnValue(a);
    api.post.mockResolvedValue({ data: {} });
    await renderInNav(LoginScreen);
    await type('Email', ' a@x.com ');
    await type('Password', 'pw');
    await press('Log in');
    expect(await screen.findByText('Please verify your email first.')).toBeTruthy();
    expect(a.login).toHaveBeenCalledWith('a@x.com', 'pw');
    await press('Resend verification email');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'a@x.com' }));
  });

  test('wrong credentials show the server message and no resend button', async () => {
    useAuth.mockReturnValue(auth({ login: jest.fn().mockRejectedValue(axiosError(400, { msg: 'Invalid credentials' })) }));
    await renderInNav(LoginScreen);
    await type('Email', 'a@x.com'); await type('Password', 'bad');
    await press('Log in');
    expect(await screen.findByText('Invalid credentials')).toBeTruthy();
    expect(screen.queryByText('Resend verification email')).toBeNull();
  });
});

describe('signup', () => {
  const fill = async () => { await type('Full name', 'Ann Lee'); await type('Email', 'ann@x.com'); await type('Password', 'longenough1'); };

  test('cannot be submitted without accepting the terms', async () => {
    const a = auth(); useAuth.mockReturnValue(a);
    await renderInNav(SignupScreen);
    await fill();
    await press('Create account');
    expect(await screen.findByText(/must accept the Terms/)).toBeTruthy();
    expect(a.register).not.toHaveBeenCalled();
  });

  test('rejects a short password before calling the server', async () => {
    const a = auth(); useAuth.mockReturnValue(a);
    await renderInNav(SignupScreen);
    await type('Full name', 'Ann'); await type('Email', 'ann@x.com'); await type('Password', 'short');
    await fireEvent.press(screen.getByRole('checkbox'));
    await press('Create account');
    expect(await screen.findByText(/at least 8 characters/)).toBeTruthy();
    expect(a.register).not.toHaveBeenCalled();
  });

  test('success tells the person to check their email', async () => {
    const a = auth({ register: jest.fn().mockResolvedValue({}) }); useAuth.mockReturnValue(a);
    await renderInNav(SignupScreen);
    await fill();
    await fireEvent.press(screen.getByRole('checkbox'));
    await press('Create account');
    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(a.register).toHaveBeenCalledWith('Ann Lee', 'ann@x.com', 'longenough1');
  });
});

// ------------------------------------------------------------------------------------------------ create delivery
describe('create delivery', () => {
  const RULES = { data: { maxItemValueCents: 20000, currency: 'usd' } };
  const fill = async () => {
    await type('Pickup address', '1 Main St, Oakland'); await type('Drop-off address', '2 Elm St, Austin');
    await type('What are you sending?', 'a book'); await type('Weight (kg)', '1.5'); await type('Declared value', '40');
  };
  beforeEach(() => api.get.mockResolvedValue(RULES));

  test('refuses a value over the cap and an unticked prohibited-items box', async () => {
    await renderInNav(CreateDeliveryScreen);
    await fill(); await type('Declared value', '500');
    await fireEvent.press(screen.getByRole('checkbox'));
    await press('Create delivery');
    expect(await screen.findByText(/cannot be more than \$200\.00/)).toBeTruthy();

    await type('Declared value', '40');
    await fireEvent.press(screen.getByRole('checkbox')); // untick
    await press('Create delivery');
    expect(await screen.findByText(/Confirm the package contains nothing/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('sends the declared value and confirmation, with coordinates, then opens the new delivery', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1' } });
    const { navigation } = await renderInNav(CreateDeliveryScreen);
    await fill();
    await fireEvent.press(screen.getByRole('checkbox'));
    await press('Create delivery');
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/deliveries', expect.objectContaining({
      pickup: '1 Main St, Oakland', weight: 1.5, declaredValue: 40, contentsConfirmed: true, size: 'small', pickupLat: 37.8, dropoffLng: -122.3,
    }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('DeliveryDetail', { id: 'd1', justCreated: true }));
  });

  test('shows the terms-accepted server error instead of crashing', async () => {
    api.post.mockRejectedValue(axiosError(403, { msg: 'User not verified' }));
    await renderInNav(CreateDeliveryScreen);
    await fill();
    await fireEvent.press(screen.getByRole('checkbox'));
    await press('Create delivery');
    expect(await screen.findByText('User not verified')).toBeTruthy();
  });
});

// ------------------------------------------------------------------------------------------------ sender list + detail
const delivery = (over = {}) => ({ id: 'd1', pickup: 'Oakland', dropoff: 'Austin', itemType: 'book', size: 'small', weight: 1, declaredValueCents: 4000, status: 'pending', paymentStatus: 'unpaid', ...over });
const loadDetail = async (d, extra = {}) => {
  api.get.mockImplementation(async (url) => {
    if (url === '/deliveries/mine') return { data: [d] };
    if (url.startsWith('/ratings/delivery')) return { data: extra.rating ?? null };
    if (url.startsWith('/payments/delivery')) return { data: { paymentStatus: extra.paid ? 'paid' : 'unpaid' } };
    if (url.endsWith('/handover-code')) return { data: { code: '482915' } };
    throw new Error(`unexpected GET ${url}`);
  });
  return renderInNav(DeliveryDetailScreen, { route: { params: { id: d.id } } });
};

describe('delivery list', () => {
  test('lists deliveries with their status and a verify prompt for unverified users', async () => {
    useAuth.mockReturnValue(auth({ user: { ...ME, isVerified: false } }));
    api.get.mockResolvedValue({ data: [delivery(), delivery({ id: 'd2', status: 'delivered', paymentStatus: 'paid' })] });
    await renderInNav(DeliveriesScreen);
    expect(await screen.findByText('Awaiting payment')).toBeTruthy();
    expect(screen.getByText('Delivered: confirm')).toBeTruthy();
    expect(screen.getByText(/Verify your ID before/)).toBeTruthy();
  });

  test('an empty list says so', async () => {
    api.get.mockResolvedValue({ data: [] });
    await renderInNav(DeliveriesScreen);
    expect(await screen.findByText("You haven't sent anything yet.")).toBeTruthy();
  });
});

describe('delivery detail', () => {
  test.each([
    ['pending unpaid', { status: 'pending', paymentStatus: 'unpaid' }, ['Pay and publish'], ['Show the code', 'Confirm it arrived']],
    ['paid, waiting', { status: 'pending', paymentStatus: 'paid' }, [], ['Pay and publish', 'Show the code', 'Report a problem']],
    ['accepted', { status: 'accepted', paymentStatus: 'paid' }, ['Show the code', 'Report a problem'], ['Pay and publish', 'Confirm it arrived']],
    ['delivered', { status: 'delivered', paymentStatus: 'paid' }, ['Confirm it arrived', 'Report a problem'], ['Show the code']],
    ['confirmed', { status: 'confirmed', paymentStatus: 'paid' }, ['Submit rating'], ['Report a problem', 'Confirm it arrived']],
    ['disputed', { status: 'disputed', paymentStatus: 'paid' }, [], ['Report a problem', 'Confirm it arrived', 'Submit rating']],
  ])('%s shows only the right actions', async (_n, over, shown, hidden) => {
    await loadDetail(delivery(over));
    await screen.findByText('Oakland → Austin');
    shown.forEach((t) => expect(screen.getByText(t)).toBeTruthy());
    hidden.forEach((t) => expect(screen.queryByText(t)).toBeNull());
  });

  test('an already rated confirmed delivery does not ask again', async () => {
    await loadDetail(delivery({ status: 'confirmed', paymentStatus: 'paid' }), { rating: { id: 'r1' } });
    await screen.findByText('Oakland → Austin');
    expect(screen.queryByText('Submit rating')).toBeNull();
  });

  test('paying opens Stripe, and success is only shown once the server says paid', async () => {
    api.post.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' } });
    await loadDetail(delivery(), { paid: true });
    await press('Pay and publish');
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://checkout.stripe.test/x'));
    expect(api.post).toHaveBeenCalledWith('/payments/create-checkout-session', { deliveryId: 'd1' });
    expect(await screen.findByText(/Payment received/)).toBeTruthy();
  });

  test('a payment error (e.g. Stripe not configured) is shown, not swallowed', async () => {
    api.post.mockRejectedValue(axiosError(503, { msg: 'Payments are not configured' }));
    await loadDetail(delivery());
    await press('Pay and publish');
    expect(await screen.findByText('Payments are not configured')).toBeTruthy();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  test('the handover code is hidden until asked for', async () => {
    await loadDetail(delivery({ status: 'accepted', paymentStatus: 'paid' }));
    await screen.findByText('Show the code');
    expect(screen.queryByText('482915')).toBeNull();
    await press('Show the code');
    expect(await screen.findByText('482915')).toBeTruthy();
  });

  test('confirming takes two taps, so one slip cannot pay the traveler', async () => {
    api.post.mockResolvedValue({ data: {} });
    await loadDetail(delivery({ status: 'delivered', paymentStatus: 'paid' }));
    await press('Confirm it arrived');
    expect(api.post).not.toHaveBeenCalled();
    await press('Yes, it arrived');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/deliveries/d1/confirm'));
  });

  test('a report needs a real description before it is sent', async () => {
    api.post.mockResolvedValue({ data: {} });
    await loadDetail(delivery({ status: 'in-transit', paymentStatus: 'paid' }));
    await press('Report a problem');
    await type('What went wrong?', 'bad');
    await press('Send report');
    expect(await screen.findByText(/at least 10 characters/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    await type('What went wrong?', 'The traveler never showed up');
    await press('Send report');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/deliveries/d1/dispute', { reason: 'The traveler never showed up' }));
  });

  test('rating needs a star, then posts the rating', async () => {
    api.post.mockResolvedValue({ data: {} });
    await loadDetail(delivery({ status: 'confirmed', paymentStatus: 'paid' }));
    await press('Submit rating');
    expect(await screen.findByText('Choose 1 to 5 stars.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('4 stars'));
    await press('Submit rating');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ratings', { deliveryId: 'd1', rating: 4, comment: undefined }));
    expect(await screen.findByText('Thanks for rating!')).toBeTruthy();
  });
});

// ------------------------------------------------------------------------------------------------ traveler
describe('traveler jobs', () => {
  const open = delivery({ id: 'open1', paymentStatus: 'paid', status: 'pending', sender: { id: 's', name: 'Sam Sender', email: 's@x.com' } });
  const mine = delivery({ id: 'mine1', paymentStatus: 'paid', status: 'accepted', travelerId: 'me', pickup: 'SF', dropoff: 'LA' });
  const rows = (...ds) => ({ data: ds.map((d) => ({ tripId: 't', deliveryId: d.id, delivery: d })) });

  test('separates your jobs from packages you could take, and never shows the sender email', async () => {
    api.get.mockResolvedValue(rows(open, mine, mine)); // same delivery matched by two trips: listed once
    await renderInNav(JobsScreen);
    expect(await screen.findByText('Your jobs')).toBeTruthy();
    expect(screen.getAllByText('SF → LA')).toHaveLength(1);
    expect(screen.getByText('Packages going your way')).toBeTruthy();
    expect(screen.getByText('Sender: Sam')).toBeTruthy();
    expect(screen.queryByText(/s@x\.com/)).toBeNull();
    expect(screen.getByText(/worth \$40\.00/)).toBeTruthy();
  });

  test('accepting calls the API and reloads', async () => {
    api.get.mockResolvedValueOnce(rows(open)).mockResolvedValueOnce(rows({ ...open, status: 'accepted', travelerId: 'me' }));
    api.patch.mockResolvedValue({ data: {} });
    await renderInNav(JobsScreen);
    await fireEvent.press(await screen.findByTestId('accept-open1'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/deliveries/open1/accept'));
    expect(await screen.findByText(/Accepted!/)).toBeTruthy();
    expect(screen.getByText('Your jobs')).toBeTruthy();
  });

  test('losing a race for a package shows the server message and refreshes the list', async () => {
    api.get.mockResolvedValue(rows(open));
    api.patch.mockRejectedValue(axiosError(409, { msg: 'This delivery is not available' }));
    await renderInNav(JobsScreen);
    await fireEvent.press(await screen.findByTestId('accept-open1'));
    expect(await screen.findByText('This delivery is not available')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('delivery needs a 6-digit code, and a wrong code shows how many tries are left', async () => {
    api.get.mockResolvedValue(rows(mine));
    api.patch.mockRejectedValue(axiosError(400, { msg: 'Wrong code. 4 attempts left.' }));
    await renderInNav(JobsScreen);
    await screen.findByText('Your jobs');
    await fireEvent.press(screen.getByTestId('complete-mine1'));
    expect(await screen.findByText('Enter the 6-digit code from the recipient.')).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();

    await type('Handover code', '12ab34 56'); // non-digits are stripped
    await fireEvent.press(screen.getByTestId('complete-mine1'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/deliveries/mine1/complete', { code: '123456' }));
    expect(await screen.findByText('Wrong code. 4 attempts left.')).toBeTruthy();
  });

  test('a successful code explains when the traveler is paid', async () => {
    api.get.mockResolvedValue(rows(mine));
    api.patch.mockResolvedValue({ data: {} });
    await renderInNav(JobsScreen);
    await screen.findByText('Your jobs');
    await type('Handover code', '123456');
    await fireEvent.press(screen.getByTestId('complete-mine1'));
    expect(await screen.findByText(/paid once the sender confirms/)).toBeTruthy();
  });

  test('no matches explains what to do next', async () => {
    api.get.mockResolvedValue({ data: [] });
    await renderInNav(JobsScreen);
    expect(await screen.findByText(/Nothing matches your trips yet/)).toBeTruthy();
  });
});

describe('post trip', () => {
  test('requires both places', async () => {
    await renderInNav(PostTripScreen);
    await press('Post trip');
    expect(await screen.findByText(/Enter where you are leaving from/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('posts with coordinates and a departure time, then goes back', async () => {
    api.post.mockResolvedValue({ data: {} });
    const { navigation } = await renderInNav(PostTripScreen);
    await type('Leaving from', 'Oakland, CA'); await type('Going to', 'Austin, TX');
    await press('In 2 days');
    await press('Post trip');
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = api.post.mock.calls[0];
    expect(body).toMatchObject({ start: 'Oakland, CA', end: 'Austin, TX', startLat: 37.8, endLng: -122.3 });
    expect(new Date(body.departure) > new Date()).toBe(true);
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
  });

  test('an unfindable place is reported instead of posting a trip that can never match', async () => {
    require('expo-location').geocodeAsync.mockResolvedValueOnce([]);
    await renderInNav(PostTripScreen);
    await type('Leaving from', 'zzzz'); await type('Going to', 'Austin, TX');
    await press('Post trip');
    expect(await screen.findByText(/couldn't find one of those places/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('account', () => {
  test('an unverified user is pointed at ID verification', async () => {
    useAuth.mockReturnValue(auth({ user: { ...ME, isVerified: false } }));
    const { navigation } = await renderInNav(AccountScreen);
    expect(await screen.findByText('Not verified')).toBeTruthy();
    await press('Verify my ID');
    expect(navigation.navigate).toHaveBeenCalledWith('Verification');
  });

  test('a verified user sees the badge and can log out', async () => {
    const a = auth(); useAuth.mockReturnValue(a);
    await renderInNav(AccountScreen);
    expect(await screen.findByText('Verified')).toBeTruthy();
    await press('Log out');
    expect(a.signOut).toHaveBeenCalled();
  });
});
