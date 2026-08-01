import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { clearTokens, getTokens, saveTokens } from './secureTokenStorage';
import { useAuthStore } from '../stores/authStore';
import { parseApiError } from './apiError';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

export const http = axios.create({
  baseURL: env.API_URL,
  timeout: 15000,
});

http.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken ?? (await getTokens())?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;

    if (error.response?.status !== 401 || !request || request._retry) {
      throw translateError(error);
    }

    request._retry = true;
    const token = await refreshAccessToken();

    if (!token) {
      await clearTokens();
      useAuthStore.getState().clearSession();
      throw translateError(error);
    }

    request.headers.Authorization = `Bearer ${token}`;
    return http(request);
  }
);

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function doRefresh(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) {
    return null;
  }

  try {
    const response = await axios.post(`${env.API_URL.replace(/\/$/, '')}/auth/refresh`, {
      refreshToken: tokens.refreshToken,
    });
    const nextRefreshToken = response.data.refreshToken ?? tokens.refreshToken;
    await saveTokens({ accessToken: response.data.accessToken, refreshToken: nextRefreshToken });
    useAuthStore.getState().updateAccessToken(response.data.accessToken, nextRefreshToken);
    return response.data.accessToken;
  } catch {
    return null;
  }
}

function translateError(error: AxiosError): AxiosError {
  const info = parseApiError(error);
  error.message = info.messages.join('\n');
  return error;
}
