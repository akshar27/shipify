import { departureOptions, money, senderActions, senderStatus } from '../src/lib/format';
import { errMsg } from '../src/lib/api';
import { axiosError, networkError } from './helpers';

const d = (status, paymentStatus = 'paid') => ({ status, paymentStatus });

test('money formats cents in the given currency', () => {
  expect(money(1050)).toBe('$10.50');
  expect(money(20000, 'usd')).toBe('$200.00');
});

test.each([
  [d('pending', 'unpaid'), ['pay']],
  [d('pending'), []],
  [d('accepted'), ['code', 'report']],
  [d('in-transit'), ['code', 'report']],
  [d('delivered'), ['confirm', 'report']],
  [d('confirmed'), ['rate']],
  [d('disputed'), []],
  [d('refunded', 'refunded'), []],
  [d('pending', 'refunded'), []],
])('a sender can do %j -> %j', (delivery, expected) => {
  expect(senderActions(delivery)).toEqual(expected);
});

test('an already-rated confirmed delivery offers nothing', () => {
  expect(senderActions(d('confirmed'), { rated: true })).toEqual([]);
});

test('status labels tell the sender what is happening', () => {
  expect(senderStatus(d('pending', 'unpaid')).label).toBe('Awaiting payment');
  expect(senderStatus(d('pending')).label).toBe('Finding a traveler');
  expect(senderStatus(d('delivered')).tone).toBe('warn');
  expect(senderStatus(d('refunded', 'refunded')).label).toBe('Refunded');
});

test('departure choices are in the future and in order', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const opts = departureOptions(now);
  expect(opts.every((o) => o.date > now)).toBe(true);
  expect(opts.map((o) => o.date.getTime())).toEqual([...opts.map((o) => o.date.getTime())].sort((a, b) => a - b));
});

describe('errMsg', () => {
  test('uses the server message', () => expect(errMsg(axiosError(400, { msg: 'Wrong code. 4 attempts left.' }))).toBe('Wrong code. 4 attempts left.'));
  test('falls back when the server gave none', () => expect(errMsg(axiosError(500, {}))).toMatch(/Something went wrong/));
  test('explains a network failure', () => expect(errMsg(networkError())).toMatch(/Can't reach the server/));
  test('explains a timeout', () => expect(errMsg(Object.assign(new Error('t'), { code: 'ECONNABORTED' }))).toMatch(/too long/));
});
