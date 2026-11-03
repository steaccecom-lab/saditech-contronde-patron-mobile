import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import {env} from '../config/env';
import {clearTokens, getTokens, saveTokens} from './secureTokenStorage';
import {
  assertCurrentSession,
  captureSession,
  isCurrentSession,
  SessionChangedError,
  useAuthStore,
  type SessionOwner,
} from '../stores/authStore';
import {parseApiError} from './apiError';
import {clearPrivateQueryCache} from '../privateQueryCache';
import {disconnectSocket} from './socketService';
import {resetEventDedup} from './eventDedup';

export type SessionRequestConfig = AxiosRequestConfig & {
  _session?: SessionOwner;
  _skipRefresh?: boolean;
  _sessionCleanup?: boolean;
};
type RetriableRequest = InternalAxiosRequestConfig &
  SessionRequestConfig & {_retry?: boolean};
let refreshFlight: {
  owner: SessionOwner;
  promise: Promise<string | null>;
} | null = null;

export const http = axios.create({baseURL: env.API_URL, timeout: 15000});

/** Local invalidation is synchronous; only the serialized Keychain deletion waits. */
export function invalidateSession(owner = captureSession()): Promise<void> {
  if (!isCurrentSession(owner)) {
    return Promise.resolve();
  }
  useAuthStore.getState().clearSession();
  clearPrivateQueryCache();
  disconnectSocket();
  resetEventDedup();
  const closed = captureSession();
  return clearTokens(() => isCurrentSession(closed));
}

/** Cleanup retains the departing owner's bearer, never the next account's token. */
export function sessionCleanupConfig(
  accessToken: string | null,
): SessionRequestConfig {
  return {
    _sessionCleanup: true,
    _skipRefresh: true,
    headers: accessToken ? {Authorization: `Bearer ${accessToken}`} : {},
  };
}

http.interceptors.request.use(config => {
  const request = config as RetriableRequest;
  if (request._sessionCleanup) {
    if (
      !(
        (request.method === 'post' && request.url === '/auth/logout') ||
        (request.method === 'delete' &&
          request.url === '/mobile-devices/current')
      )
    ) {
      throw new SessionChangedError();
    }
    return config;
  }
  request._session ??= captureSession();
  assertCurrentSession(request._session);
  const token = useAuthStore.getState().accessToken;
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  } else {
    delete request.headers.Authorization;
  }
  return config;
});

http.interceptors.response.use(
  response => {
    const request = response.config as RetriableRequest;
    if (!request._sessionCleanup && request._session) {
      assertCurrentSession(request._session);
    }
    return response;
  },
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    if (request?._session && !request._sessionCleanup) {
      assertCurrentSession(request._session);
    }
    if (
      error.response?.status !== 401 ||
      !request ||
      request._skipRefresh ||
      request._sessionCleanup ||
      request.url === '/auth/login' ||
      request.url === '/auth/logout'
    ) {
      throw translateError(error);
    }
    const owner = request._session ?? captureSession();
    request._session = owner;
    assertCurrentSession(owner);
    if (request._retry) {
      await invalidateSession(owner);
      throw translateError(error);
    }
    request._retry = true;
    // A late 401 for the previous bearer must reuse the rotation already completed.
    const current = useAuthStore.getState().accessToken;
    const sent = request.headers?.Authorization;
    const token =
      current && typeof sent === 'string' && sent !== `Bearer ${current}`
        ? current
        : await refreshAccessToken(owner);
    assertCurrentSession(owner);
    if (!token) {
      await invalidateSession(owner);
      throw translateError(error);
    }
    request.headers.Authorization = `Bearer ${token}`;
    return http(request);
  },
);

async function refreshAccessToken(owner: SessionOwner): Promise<string | null> {
  if (
    refreshFlight &&
    refreshFlight.owner.generation === owner.generation &&
    isCurrentSession(refreshFlight.owner)
  ) {
    return refreshFlight.promise;
  }
  const flight = {owner, promise: Promise.resolve<string | null>(null)};
  flight.promise = doRefresh(owner).finally(() => {
    if (refreshFlight === flight) {
      refreshFlight = null;
    }
  });
  refreshFlight = flight;
  return flight.promise;
}

async function doRefresh(owner: SessionOwner): Promise<string | null> {
  try {
    const tokens = await getTokens();
    assertCurrentSession(owner);
    if (
      !tokens?.refreshToken ||
      tokens.refreshToken !== useAuthStore.getState().refreshToken
    ) {
      return null;
    }
    const response = await axios.post(
      `${env.API_URL.replace(/\/$/, '')}/auth/refresh`,
      {refreshToken: tokens.refreshToken},
      {timeout: 15000},
    );
    assertCurrentSession(owner);
    const accessToken = response.data?.accessToken;
    const refreshToken = response.data?.refreshToken ?? tokens.refreshToken;
    if (
      typeof accessToken !== 'string' ||
      !accessToken.trim() ||
      typeof refreshToken !== 'string' ||
      !refreshToken.trim()
    ) {
      return null;
    }
    const ownsRotation = () =>
      isCurrentSession(owner) &&
      useAuthStore.getState().refreshToken === tokens.refreshToken;
    if (!ownsRotation()) {
      return null;
    }
    await saveTokens(
      {accessToken, refreshToken},
      {
        isCurrent: ownsRotation,
        onSaved: () =>
          useAuthStore.getState().updateAccessToken(accessToken, refreshToken),
      },
    );
    assertCurrentSession(owner);
    return accessToken;
  } catch {
    return null;
  }
}

function translateError(error: AxiosError): AxiosError {
  error.message = parseApiError(error).messages.join('\n');
  return error;
}
