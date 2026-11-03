import * as Keychain from 'react-native-keychain';
import {SessionChangedError} from '../stores/authStore';

const tokenService = 'contronde-patron.tokens';
const deviceService = 'contronde-patron.device';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

// One queue for this service: a deletion cannot overtake an in-flight native write.
let tokenQueue: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = tokenQueue.then(operation, operation);
  tokenQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

type TokenWrite = {isCurrent: () => boolean; onSaved: () => void};

export async function saveTokens(
  tokens: StoredTokens,
  owner?: TokenWrite,
): Promise<void> {
  await serial(async () => {
    if (owner && !owner.isCurrent()) {
      throw new SessionChangedError();
    }
    try {
      const saved = await Keychain.setGenericPassword(
        'tokens',
        JSON.stringify(tokens),
        {
          service: tokenService,
        },
      );
      if (saved === false) {
        throw new Error('Stockage sécurisé indisponible.');
      }
    } catch (error) {
      if (owner && !owner.isCurrent()) {
        await Keychain.resetGenericPassword({service: tokenService});
      }
      throw error;
    }
    if (owner && !owner.isCurrent()) {
      // Hold the lock during cleanup: a new account's queued write must run last.
      await Keychain.resetGenericPassword({service: tokenService});
      throw new SessionChangedError();
    }
    owner?.onSaved();
  });
}

export async function getTokens(): Promise<StoredTokens | null> {
  return serial(async () => {
    const credentials = await Keychain.getGenericPassword({
      service: tokenService,
    });
    if (!credentials) {
      return null;
    }
    const tokens = JSON.parse(credentials.password) as StoredTokens;
    return typeof tokens.accessToken === 'string' &&
      !!tokens.accessToken.trim() &&
      typeof tokens.refreshToken === 'string' &&
      !!tokens.refreshToken.trim()
      ? tokens
      : null;
  });
}

export async function clearTokens(
  isCurrent: () => boolean = () => true,
): Promise<void> {
  await serial(async () => {
    if (isCurrent()) {
      await Keychain.resetGenericPassword({service: tokenService});
    }
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await Keychain.getGenericPassword({service: deviceService});
  if (existing) {
    return existing.password;
  }

  const deviceId = `patron-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
  await Keychain.setGenericPassword('deviceId', deviceId, {
    service: deviceService,
  });
  return deviceId;
}
