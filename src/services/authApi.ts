import {
  http,
  invalidateSession,
  sessionCleanupConfig,
  type SessionRequestConfig,
} from './http';
import {clearTokens, getTokens, saveTokens} from './secureTokenStorage';
import type {AuthResponse, User} from '../types/api';
import {
  assertCurrentSession,
  captureSession,
  isCurrentSession,
  useAuthStore,
  type SessionOwner,
} from '../stores/authStore';
import {revokeCurrentDevice} from './mobileDevicesApi';
import {clearPrivateQueryCache} from '../privateQueryCache';

const allowedRoles = new Set(['COMPANY_ADMIN', 'SUPERVISOR']);

function beginSession(): SessionOwner {
  useAuthStore.getState().beginSession();
  clearPrivateQueryCache();
  return captureSession();
}

function publishUser(owner: SessionOwner, user: User): User {
  assertCurrentSession(owner);
  if (!allowedRoles.has(user.roleType)) {
    throw new Error(
      'Cette application est réservée aux responsables et superviseurs.',
    );
  }
  // /auth/me may have renewed the bearer: never restore the pre-refresh tokens.
  const {accessToken, refreshToken} = useAuthStore.getState();
  if (!accessToken || !refreshToken) {
    throw new Error('Session indisponible.');
  }
  useAuthStore.getState().setSession(accessToken, refreshToken, user);
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const owner = beginSession();
  try {
    await clearTokens(() => isCurrentSession(owner));
    assertCurrentSession(owner);
    const config: SessionRequestConfig = {_session: owner, _skipRefresh: true};
    const response = await http.post<AuthResponse>(
      '/auth/login',
      {email, password},
      config,
    );
    assertCurrentSession(owner);
    const {accessToken, refreshToken} = response.data;
    if (
      typeof accessToken !== 'string' ||
      !accessToken.trim() ||
      typeof refreshToken !== 'string' ||
      !refreshToken.trim()
    ) {
      throw new Error('Session invalide.');
    }
    await saveTokens(
      {accessToken, refreshToken},
      {
        isCurrent: () => isCurrentSession(owner),
        onSaved: () =>
          useAuthStore.getState().updateAccessToken(accessToken, refreshToken),
      },
    );
    assertCurrentSession(owner);
    const me = await currentUser();
    return publishUser(owner, me);
  } catch (error) {
    await invalidateSession(owner);
    throw error;
  }
}

export async function currentUser(): Promise<User> {
  return (await http.get<{user: User}>('/auth/me')).data.user;
}

let restorePromise: Promise<User | null> | null = null;
export function restoreSession(): Promise<User | null> {
  if (restorePromise) {
    return restorePromise;
  }
  // Bootstrap only: an explicit logout must not rehydrate obsolete storage.
  if (useAuthStore.getState().sessionGeneration !== 0) {
    return Promise.resolve(useAuthStore.getState().user);
  }
  restorePromise = restoreInitialSession().finally(() => {
    restorePromise = null;
  });
  return restorePromise;
}

async function restoreInitialSession(): Promise<User | null> {
  const owner = beginSession();
  try {
    const tokens = await getTokens();
    assertCurrentSession(owner);
    if (!tokens) {
      await invalidateSession(owner);
      return null;
    }
    useAuthStore
      .getState()
      .updateAccessToken(tokens.accessToken, tokens.refreshToken);
    const user = await currentUser();
    return publishUser(owner, user);
  } catch {
    await invalidateSession(owner);
    return null;
  }
}

export async function logout(
  refreshToken: string | null,
  expectedUser?: User,
): Promise<void> {
  const owner = captureSession();
  if (expectedUser && useAuthStore.getState().user !== expectedUser) {
    return;
  }
  const accessToken = useAuthStore.getState().accessToken;
  const token = useAuthStore.getState().refreshToken ?? refreshToken;
  // Invalidate before any network/Keychain await, including device revocation.
  const deletion = invalidateSession(owner);
  const config = sessionCleanupConfig(accessToken);
  const cleanup = async () => {
    await revokeCurrentDevice(config).catch(() => undefined);
    if (token) {
      await http
        .post('/auth/logout', {refreshToken: token}, config)
        .catch(() => undefined);
    }
  };
  await Promise.all([deletion, cleanup()]);
}

export function signOutLocally(): Promise<void> {
  return invalidateSession();
}
