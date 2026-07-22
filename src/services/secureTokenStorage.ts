import * as Keychain from 'react-native-keychain';

const tokenService = 'contronde-patron.tokens';
const deviceService = 'contronde-patron.device';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), { service: tokenService });
}

export async function getTokens(): Promise<StoredTokens | null> {
  const credentials = await Keychain.getGenericPassword({ service: tokenService });
  if (!credentials) {
    return null;
  }

  return JSON.parse(credentials.password) as StoredTokens;
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: tokenService });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: deviceService });
  if (existing) {
    return existing.password;
  }

  const deviceId = `patron-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await Keychain.setGenericPassword('deviceId', deviceId, { service: deviceService });
  return deviceId;
}
