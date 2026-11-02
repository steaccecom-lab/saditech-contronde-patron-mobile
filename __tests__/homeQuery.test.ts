import {
  accessDenied,
  authorizedHomeRead,
  homeQueryKeys,
  serverCount,
} from '../src/query/homeQuery';
import {getDashboard} from '../src/services/patronApi';
import {http} from '../src/services/http';
import type {User} from '../src/types/api';
jest.mock('../src/services/http', () => ({http: {get: jest.fn()}}));
const user: User = {
  id: 'u',
  companyId: 'c',
  roleType: 'SUPERVISOR',
  fullName: 'P',
  email: '',
  permissions: ['dashboard.read', 'round_sessions.read'],
};
afterEach(() => jest.clearAllMocks());
it('forwards only the existing dashboard site filter and cancellation, preserving server counts and dates', async () => {
  const data = {
    generatedAt: '2026-09-19T23:15:00Z',
    timezone: 'Africa/Casablanca',
    summary: {completedToday: 4, late: 2, missed: 3},
    liveActivity: [],
  };
  jest.mocked(http.get).mockResolvedValue({data});
  const signal = new AbortController().signal;
  const result = await getDashboard({siteId: 's'}, signal);
  expect(http.get).toHaveBeenCalledWith('/patron/dashboard', {
    params: {siteId: 's'},
    signal,
  });
  expect(result).toBe(data);
  await getDashboard();
  expect(http.get).toHaveBeenLastCalledWith('/patron/dashboard', {});
});
it('isolates all new snapshots by owner, permissions, site and supervisor scope', () => {
  const keys = homeQueryKeys(user, undefined, ['b', 'a']);
  expect(keys).toEqual(
    homeQueryKeys(
      {...user, permissions: [...user.permissions].reverse()},
      undefined,
      ['a', 'b'],
    ),
  );
  expect(keys.dashboard[0]).toBe('dashboard');
  expect(keys.pending[0]).toBe('rounds');
  expect(keys.gps[0]).toBe('liveGps');
  for (const changed of [
    homeQueryKeys({...user, id: 'u2'}, undefined, ['a', 'b']),
    homeQueryKeys({...user, companyId: 'other'}, undefined, ['a', 'b']),
    homeQueryKeys({...user, permissions: []}, undefined, ['a', 'b']),
    homeQueryKeys(user, 's', ['a', 'b']),
    homeQueryKeys(user, undefined, ['b']),
  ]) {
    expect(changed.dashboard).not.toEqual(keys.dashboard);
    expect(changed.pending).not.toEqual(keys.pending);
  }
  expect(homeQueryKeys(user, 's').gps).not.toEqual(homeQueryKeys(user).gps);
});
it.each([undefined, null, -1, NaN, Infinity, 1.5, '4'])(
  'does not fabricate a zero for invalid count %p',
  value => expect(serverCount(value)).toBeNull(),
);
it.each([0, 14, 999])('preserves exact non-negative server count %p', value =>
  expect(serverCount(value)).toBe(value),
);
it.each([401, 403, 404])(
  'clears a rejected snapshot on %p but rethrows the error',
  async status => {
    const error = {response: {status}};
    const clear = jest.fn();
    await expect(
      authorizedHomeRead(() => Promise.reject(error), clear),
    ).rejects.toBe(error);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(accessDenied(error)).toBe(true);
  },
);
it('preserves an existing snapshot on temporary network failure and never changes successful data', async () => {
  const clear = jest.fn();
  const error = new Error('offline');
  await expect(
    authorizedHomeRead(() => Promise.reject(error), clear),
  ).rejects.toBe(error);
  expect(clear).not.toHaveBeenCalled();
  const data = {summary: {completedToday: 7}};
  expect(await authorizedHomeRead(() => Promise.resolve(data), clear)).toBe(
    data,
  );
});
