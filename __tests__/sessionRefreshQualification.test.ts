import axios from 'axios';
import {http} from '../src/services/http';
import {logout} from '../src/services/authApi';
import {
  clearTokens,
  getTokens,
  saveTokens,
  type StoredTokens,
} from '../src/services/secureTokenStorage';
import {useAuthStore} from '../src/stores/authStore';
import {registerPrivateQueryCacheClearer} from '../src/privateQueryCache';

jest.mock('axios', () => {
  const client = Object.assign(
    jest.fn(async () => ({data: {}})),
    {
      post: jest.fn(async () => ({data: {}})),
      delete: jest.fn(async () => ({data: {}})),
      interceptors: {request: {use: jest.fn()}, response: {use: jest.fn()}},
    },
  );
  return {
    __esModule: true,
    default: {create: jest.fn(() => client), post: jest.fn()},
  };
});
jest.mock('../src/services/secureTokenStorage', () => ({
  getTokens: jest.fn(),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(async () => undefined),
}));

afterEach(() => {
  useAuthStore.getState().clearSession();
  registerPrivateQueryCacheClearer(() => undefined);
  jest.clearAllMocks();
});

it('keeps logout effective when an already pending JWT refresh finishes afterwards', async () => {
  let tokens: StoredTokens | null = {
    accessToken: 'fixture-expired',
    refreshToken: 'fixture-refresh',
  };
  jest.mocked(getTokens).mockImplementation(async () => tokens);
  jest.mocked(saveTokens).mockImplementation(async next => {
    tokens = next;
  });
  jest.mocked(clearTokens).mockImplementation(async () => {
    tokens = null;
  });
  useAuthStore.getState().setSession(tokens.accessToken, tokens.refreshToken, {
    id: 'fixture-patron',
    companyId: 'fixture-company',
    roleType: 'COMPANY_ADMIN',
    fullName: 'Compte fictif',
    email: 'fixture@example.invalid',
    permissions: [],
  });
  let resolveRefresh!: (value: {data: StoredTokens}) => void;
  let started!: () => void;
  const refreshStarted = new Promise<void>(resolve => {
    started = resolve;
  });
  const refreshResponse = new Promise<{data: StoredTokens}>(resolve => {
    resolveRefresh = resolve;
  });
  jest.mocked(axios.post).mockImplementationOnce(() => {
    started();
    return refreshResponse;
  });
  const register = http.interceptors.response.use as jest.Mock;
  const handle401 = register.mock.calls[0][1] as (
    error: unknown,
  ) => Promise<unknown>;
  const request = handle401({response: {status: 401}, config: {headers: {}}});
  await refreshStarted;
  await logout('fixture-refresh');
  expect(tokens).toBeNull();
  expect(useAuthStore.getState().accessToken).toBeNull();
  resolveRefresh({
    data: {
      accessToken: 'fixture-rotated',
      refreshToken: 'fixture-rotated-refresh',
    },
  });
  await request.catch(() => undefined);
  expect(tokens).toBeNull();
  expect(useAuthStore.getState()).toMatchObject({
    accessToken: null,
    refreshToken: null,
    user: null,
  });
});
