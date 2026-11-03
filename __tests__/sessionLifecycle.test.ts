import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as Keychain from 'react-native-keychain';
import {waitFor} from '@testing-library/react-native';
import {QueryClient} from '@tanstack/react-query';
import {http} from '../src/services/http';
import {logout, restoreSession, signIn} from '../src/services/authApi';
import {registerDevice} from '../src/services/mobileDevicesApi';
import * as storage from '../src/services/secureTokenStorage';
import {useAuthStore} from '../src/stores/authStore';
import {registerPrivateQueryCacheClearer} from '../src/privateQueryCache';
import type {User} from '../src/types/api';

const a: User = {
  id: 'fixture-a',
  companyId: 'fixture-company-a',
  fullName: 'Compte A',
  email: 'a@example.invalid',
  roleType: 'COMPANY_ADMIN',
  permissions: ['dashboard.read'],
};
const b: User = {
  ...a,
  id: 'fixture-b',
  companyId: 'fixture-company-b',
  fullName: 'Compte B',
  email: 'b@example.invalid',
};
const initial = {
  accessToken: 'fixture-a-expired',
  refreshToken: 'fixture-a-refresh',
};
const rotated = {
  accessToken: 'fixture-a-rotated',
  refreshToken: 'fixture-a-next-refresh',
};
const other = {
  accessToken: 'fixture-b-access',
  refreshToken: 'fixture-b-refresh',
};
let stored: storage.StoredTokens | null;
let cache: QueryClient;
let adapter: jest.Mock;
let refresh: jest.SpyInstance;
function gate<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
}
function ok(
  config: InternalAxiosRequestConfig,
  data: unknown = {},
): AxiosResponse {
  return {config, data, status: 200, statusText: 'OK', headers: {}};
}
function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    ...ok(config),
    status: 401,
  });
}
function observe<T>(promise: Promise<T>) {
  return promise.then(
    value => ({value, error: null}),
    error => ({value: null, error}),
  );
}
function nativeCredentials(): Awaited<
  ReturnType<typeof Keychain.getGenericPassword>
> {
  return stored
    ? ({
        username: 'tokens',
        password: JSON.stringify(stored),
        service: 'contronde-patron.tokens',
        storage: 'keychain',
      } as never)
    : false;
}
async function serve(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  if (config.url === '/auth/login') {
    return ok(config, {...other, user: b});
  }
  if (
    config.url === '/auth/logout' ||
    config.url === '/mobile-devices/current'
  ) {
    return ok(config);
  }
  if (
    config.headers.Authorization === `Bearer ${initial.accessToken}` ||
    config.headers.Authorization === 'Bearer fixture-b-expired'
  ) {
    throw unauthorized(config);
  }
  return ok(
    config,
    config.url === '/auth/me'
      ? {
          user: String(config.headers.Authorization).includes('fixture-b')
            ? b
            : a,
        }
      : {private: true},
  );
}
function startA() {
  stored = {...initial};
  useAuthStore
    .getState()
    .setSession(initial.accessToken, initial.refreshToken, a);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    sessionGeneration: 0,
    user: null,
    accessToken: null,
    refreshToken: null,
    pendingRoundId: null,
  });
  stored = {...initial};
  jest.mocked(Keychain.getGenericPassword).mockImplementation(async options =>
    options?.service === 'contronde-patron.device'
      ? ({
          username: 'deviceId',
          password: 'fixture-device',
          service: options.service,
        } as never)
      : nativeCredentials(),
  );
  jest
    .mocked(Keychain.setGenericPassword)
    .mockImplementation(async (_name, value) => {
      stored = JSON.parse(value);
      return {storage: 'keychain'} as never;
    });
  jest.mocked(Keychain.resetGenericPassword).mockImplementation(async () => {
    stored = null;
    return true;
  });
  adapter = jest.fn(serve);
  http.defaults.adapter = adapter;
  refresh = jest.spyOn(axios, 'post').mockResolvedValue({data: rotated});
  cache = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false, gcTime: 0},
    },
  });
  cache.setQueryData(['dashboard', a.companyId], {private: true});
  registerPrivateQueryCacheClearer(() => cache.clear());
});
afterEach(async () => {
  useAuthStore.getState().clearSession();
  await storage.clearTokens();
  cache.clear();
  registerPrivateQueryCacheClearer(() => undefined);
  jest.restoreAllMocks();
});

it('renews normally through the real Axios interceptors and keeps the same user', async () => {
  startA();
  await http.get('/private');
  expect(stored).toEqual(rotated);
  expect(useAuthStore.getState()).toMatchObject({...rotated, user: a});
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledWith(
    expect.stringMatching(/\/auth\/refresh$/),
    {refreshToken: initial.refreshToken},
    {timeout: 15000},
  );
  expect(adapter).toHaveBeenCalledTimes(2);
});
it('shares one rotation across two concurrent expired requests', async () => {
  startA();
  const response = gate<unknown>();
  refresh.mockReturnValueOnce(response.promise);
  const first = observe(http.get('/private/one'));
  const second = observe(http.get('/private/two'));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  response.resolve({data: rotated});
  expect((await first).error).toBeNull();
  expect((await second).error).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
});
it('reuses the new bearer for a delayed 401 instead of rotating a second time', async () => {
  startA();
  const delayed = gate<AxiosResponse>();
  let original!: InternalAxiosRequestConfig;
  adapter.mockImplementation(async config => {
    if (config.url === '/slow' && !config._retry) {
      original = config;
      return delayed.promise;
    }
    return serve(config);
  });
  const slow = observe(http.get('/slow'));
  await waitFor(() => expect(original).toBeDefined());
  await http.get('/fast');
  delayed.reject(unauthorized(original));
  expect((await slow).error).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(1);
});
it('invalidates logout immediately even while remote revocation and refresh are pending', async () => {
  startA();
  const response = gate<unknown>();
  const remote = gate<void>();
  refresh.mockReturnValueOnce(response.promise);
  adapter.mockImplementation(async config => {
    if (config.url === '/mobile-devices/current') {
      await remote.promise;
    }
    return serve(config);
  });
  const request = observe(http.get('/private'));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  const exit = logout(initial.refreshToken);
  expect(useAuthStore.getState().user).toBeNull();
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
  response.resolve({data: rotated});
  expect((await request).error).toMatchObject({name: 'SessionChangedError'});
  remote.resolve();
  await exit;
  expect(stored).toBeNull();
  expect(adapter.mock.calls.filter(([c]) => c.url === '/private')).toHaveLength(
    1,
  );
  const cleanup = adapter.mock.calls.find(
    ([c]) => c.url === '/auth/logout',
  )![0];
  expect(cleanup.headers.Authorization).toBe(`Bearer ${initial.accessToken}`);
  expect(cleanup._skipRefresh).toBe(true);
});
it.each(['success', 'refused'])(
  'does not overwrite or clear account B when account A refresh finishes with %s',
  async result => {
    startA();
    const response = gate<unknown>();
    refresh.mockReturnValueOnce(response.promise);
    const request = observe(http.get('/private'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await signIn(b.email, 'fixture-password');
    if (result === 'success') {
      response.resolve({data: rotated});
    } else {
      response.reject(new AxiosError('Refresh refused'));
    }
    expect((await request).error).toMatchObject({name: 'SessionChangedError'});
    expect(stored).toEqual(other);
    expect(useAuthStore.getState()).toMatchObject({...other, user: b});
  },
);
it('keeps account B single-flight independent of an obsolete account A refresh', async () => {
  startA();
  const old = gate<unknown>();
  const next = gate<unknown>();
  refresh.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const first = observe(http.get('/private/a'));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  await signIn(b.email, 'fixture-password');
  stored = {...other, accessToken: 'fixture-b-expired'};
  useAuthStore
    .getState()
    .updateAccessToken(stored.accessToken, stored.refreshToken);
  const second = observe(http.get('/private/b'));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  old.resolve({data: rotated});
  expect((await first).error).not.toBeNull();
  const third = observe(http.get('/private/b-again'));
  await waitFor(() =>
    expect(adapter.mock.calls.some(([c]) => c.url === '/private/b-again')).toBe(
      true,
    ),
  );
  next.resolve({data: {...other, accessToken: 'fixture-b-rotated'}});
  expect((await second).error).toBeNull();
  expect((await third).error).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().user).toEqual(b);
});
it('rechecks ownership when a received refresh response waits for the storage lock', async () => {
  startA();
  const response = gate<unknown>();
  const read = gate<void>();
  const started = gate<void>();
  refresh.mockReturnValueOnce(response.promise);
  const request = observe(http.get('/private'));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  jest.mocked(Keychain.getGenericPassword).mockImplementationOnce(async () => {
    started.resolve();
    await read.promise;
    return nativeCredentials();
  });
  const block = storage.getTokens();
  await started.promise;
  const saving = jest.spyOn(storage, 'saveTokens');
  response.resolve({data: rotated});
  await waitFor(() => expect(saving).toHaveBeenCalledTimes(1));
  const exit = logout(initial.refreshToken);
  read.resolve();
  await block;
  await exit;
  expect((await request).error).not.toBeNull();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  expect(stored).toBeNull();
});
it.each(['logout', 'account-change'])(
  'cleans an in-flight native write before %s can finish',
  async transition => {
    startA();
    const write = gate<void>();
    const entered = gate<void>();
    jest
      .mocked(Keychain.setGenericPassword)
      .mockImplementationOnce(async (_name, value) => {
        entered.resolve();
        await write.promise;
        stored = JSON.parse(value);
        return {storage: 'keychain'} as never;
      });
    const request = observe(http.get('/private'));
    await entered.promise;
    const exit =
      transition === 'logout'
        ? logout(initial.refreshToken)
        : signIn(b.email, 'fixture-password');
    expect(useAuthStore.getState().user).toBeNull();
    write.resolve();
    await exit;
    expect((await request).error).not.toBeNull();
    expect(stored).toEqual(transition === 'logout' ? null : other);
    expect(useAuthStore.getState().accessToken).toBe(
      transition === 'logout' ? null : other.accessToken,
    );
  },
);
it.each(['network', '401', 'timeout'])(
  'purges credentials and cache after refresh %s, with no retry loop',
  async reason => {
    startA();
    refresh.mockRejectedValueOnce(
      reason === '401'
        ? unauthorized({headers: {}} as InternalAxiosRequestConfig)
        : new AxiosError(
            reason,
            reason === 'timeout' ? 'ECONNABORTED' : 'ERR_NETWORK',
          ),
    );
    expect((await observe(http.get('/private'))).error).not.toBeNull();
    expect(stored).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(cache.getQueryCache().getAll()).toHaveLength(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
  },
);
it.each([
  {},
  {accessToken: ''},
  {accessToken: 'fixture-access', refreshToken: ''},
])('rejects an invalid refresh response: %j', async data => {
  startA();
  refresh.mockResolvedValueOnce({data});
  expect((await observe(http.get('/private'))).error).not.toBeNull();
  expect(stored).toBeNull();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
});
it('ends the session on a second 401 instead of refreshing without limit', async () => {
  startA();
  adapter.mockImplementation(async config => {
    throw unauthorized(config);
  });
  expect((await observe(http.get('/private'))).error).not.toBeNull();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(stored).toBeNull();
  expect(useAuthStore.getState().accessToken).toBeNull();
});
it('never renews credentials for a refused login', async () => {
  adapter.mockImplementation(async config => {
    throw unauthorized(config);
  });
  await expect(signIn(b.email, 'fixture-wrong')).rejects.toBeDefined();
  expect(refresh).not.toHaveBeenCalled();
  expect(stored).toBeNull();
});
it('rejects a late successful login after logout without storing its tokens', async () => {
  const response = gate<AxiosResponse>();
  let config!: InternalAxiosRequestConfig;
  adapter.mockImplementation(async c => {
    if (c.url === '/auth/login') {
      config = c;
      return response.promise;
    }
    return serve(c);
  });
  const login = observe(signIn(b.email, 'fixture-password'));
  await waitFor(() => expect(config).toBeDefined());
  await logout(null);
  response.resolve(ok(config, {...other, user: b}));
  expect((await login).error).toMatchObject({name: 'SessionChangedError'});
  expect(stored).toBeNull();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
});
it('restores once at bootstrap, preserving a rotation during /auth/me', async () => {
  const first = restoreSession();
  const second = restoreSession();
  expect(first).toBe(second);
  await expect(first).resolves.toEqual(a);
  expect(stored).toEqual(rotated);
  expect(useAuthStore.getState()).toMatchObject({...rotated, user: a});
  await logout(rotated.refreshToken);
  // Even a stale read must not bootstrap a session after an explicit logout.
  stored = {...initial};
  const reads = jest.mocked(Keychain.getGenericPassword).mock.calls.length;
  await expect(restoreSession()).resolves.toBeNull();
  expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(reads);
});
it('discards successful private responses arriving after logout', async () => {
  startA();
  const response = gate<AxiosResponse>();
  let config!: InternalAxiosRequestConfig;
  adapter.mockImplementation(async c => {
    if (c.url === '/private') {
      config = c;
      return response.promise;
    }
    return serve(c);
  });
  const request = observe(
    http.get('/private').then(value => {
      cache.setQueryData(['late-private'], value.data);
    }),
  );
  await waitFor(() => expect(config).toBeDefined());
  await logout(initial.refreshToken);
  response.resolve(ok(config, {private: true}));
  expect((await request).error).toMatchObject({name: 'SessionChangedError'});
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});
it('does not let a delayed 401 from account A renew or clear account B', async () => {
  startA();
  const response = gate<AxiosResponse>();
  let config!: InternalAxiosRequestConfig;
  adapter.mockImplementation(async c => {
    if (c.url === '/private') {
      config = c;
      return response.promise;
    }
    return serve(c);
  });
  const request = observe(http.get('/private'));
  await waitFor(() => expect(config).toBeDefined());
  await signIn(b.email, 'fixture-password');
  response.reject(unauthorized(config));
  expect((await request).error).toMatchObject({name: 'SessionChangedError'});
  expect(refresh).not.toHaveBeenCalled();
  expect(stored).toEqual(other);
});
it('fails closed on native write failure and keeps the storage queue usable', async () => {
  startA();
  jest.mocked(Keychain.setGenericPassword).mockResolvedValueOnce(false);
  expect((await observe(http.get('/private'))).error).not.toBeNull();
  expect(stored).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
  await signIn(b.email, 'fixture-password');
  expect(stored).toEqual(other);
});

it.each(['id', 'companyId', 'roleType'] as const)(
  'checks %s as well as generation before writing a refresh',
  async field => {
    startA();
    const response = gate<unknown>();
    refresh.mockReturnValueOnce(response.promise);
    const request = observe(http.get('/private'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const user = {
      ...a,
      [field]: field === 'roleType' ? 'SUPERVISOR' : 'fixture-other',
    } as User;
    useAuthStore.setState({user});
    response.resolve({data: rotated});
    expect((await request).error).toMatchObject({name: 'SessionChangedError'});
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(user);
  },
);

it('does not let an old logout completion purge account B or use its bearer', async () => {
  startA();
  const device =
    gate<Awaited<ReturnType<typeof Keychain.getGenericPassword>>>();
  jest
    .mocked(Keychain.getGenericPassword)
    .mockImplementationOnce(() => device.promise);
  const exit = logout(initial.refreshToken);
  await signIn(b.email, 'fixture-password');
  cache.setQueryData(['dashboard', b.companyId], {privateB: true});
  device.resolve({
    username: 'deviceId',
    password: 'fixture-device',
    service: 'contronde-patron.device',
  } as never);
  await exit;
  expect(stored).toEqual(other);
  expect(cache.getQueryData(['dashboard', b.companyId])).toEqual({
    privateB: true,
  });
  for (const [config] of adapter.mock.calls.filter(([c]) =>
    ['/auth/logout', '/mobile-devices/current'].includes(c.url),
  )) {
    expect(config.headers.Authorization).toBe(`Bearer ${initial.accessToken}`);
  }
});

it('does not disconnect a replacement account from an old confirmation callback', async () => {
  startA();
  await signIn(b.email, 'fixture-password');
  const calls = adapter.mock.calls.length;
  await logout(initial.refreshToken, a);
  expect(adapter).toHaveBeenCalledTimes(calls);
  expect(useAuthStore.getState().user).toEqual(b);
  expect(stored).toEqual(other);
});

it('does not register an old FCM callback against a replacement account after device lookup', async () => {
  startA();
  const device =
    gate<Awaited<ReturnType<typeof Keychain.getGenericPassword>>>();
  jest
    .mocked(Keychain.getGenericPassword)
    .mockImplementationOnce(() => device.promise);
  const registering = observe(registerDevice('fixture-fcm'));
  await signIn(b.email, 'fixture-password');
  device.resolve({
    username: 'deviceId',
    password: 'fixture-device',
    service: 'contronde-patron.device',
  } as never);
  expect((await registering).error).toMatchObject({
    name: 'SessionChangedError',
  });
  expect(
    adapter.mock.calls.some(([c]) => c.url === '/mobile-devices/register'),
  ).toBe(false);
  await registerDevice('fixture-fcm-b');
  const registration = adapter.mock.calls.find(
    ([c]) => c.url === '/mobile-devices/register',
  )![0];
  expect(registration.headers.Authorization).toBe(
    `Bearer ${other.accessToken}`,
  );
  expect(JSON.parse(registration.data)).toMatchObject({
    appType: 'PATRON',
    supportsBatteryAlerts: true,
    deviceId: 'fixture-device',
    fcmToken: 'fixture-fcm-b',
  });
});
