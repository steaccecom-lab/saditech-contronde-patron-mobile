import { http } from './http';
import { clearTokens, getTokens, saveTokens } from './secureTokenStorage';
import type { AuthResponse, User } from '../types/api';
import { useAuthStore } from '../stores/authStore';
import { revokeCurrentDevice } from './mobileDevicesApi';
import {clearPrivateQueryCache} from '../privateQueryCache';

const allowedRoles = new Set(['COMPANY_ADMIN', 'SUPERVISOR']);

export async function signIn(email: string, password: string): Promise<User> {
  const response = await http.post<AuthResponse>('/auth/login', { email, password });
  await saveTokens({
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
  });
  clearPrivateQueryCache();
  useAuthStore
    .getState()
    .updateAccessToken(response.data.accessToken, response.data.refreshToken);
  const me = await currentUser();

  if (!allowedRoles.has(me.roleType)) {
    await signOutLocally();
    throw new Error('Cette application est réservée aux responsables et superviseurs.');
  }

  useAuthStore.getState().setSession(response.data.accessToken, response.data.refreshToken, me);
  return me;
}

export async function currentUser(): Promise<User> {
  const response = await http.get<{ user: User }>('/auth/me');
  return response.data.user;
}

export async function restoreSession(): Promise<User | null> {
  const tokens = await getTokens();
  if (!tokens) {
    return null;
  }

  try {
    useAuthStore.getState().updateAccessToken(tokens.accessToken, tokens.refreshToken);
    const user = await currentUser();
    if (!allowedRoles.has(user.roleType)) {
      await signOutLocally();
      throw new Error('Cette application est réservée aux responsables et superviseurs.');
    }
    clearPrivateQueryCache();
    useAuthStore.getState().setSession(tokens.accessToken, tokens.refreshToken, user);
    return user;
  } catch {
    await signOutLocally();
    return null;
  }
}

export async function logout(refreshToken: string | null): Promise<void> {
  await revokeCurrentDevice().catch(() => undefined);
  if (refreshToken) {
    await http.post('/auth/logout', { refreshToken }).catch(() => undefined);
  }
  await signOutLocally();
}

export async function signOutLocally(): Promise<void> {
  await clearTokens();
  clearPrivateQueryCache();
  useAuthStore.getState().clearSession();
}
