import * as Keychain from 'react-native-keychain';
import { clearTokens, getTokens, saveTokens } from '../src/services/secureTokenStorage';

describe('secure token storage', () => {
  it('stores tokens in Keychain, not AsyncStorage', async () => {
    await saveTokens({ accessToken: 'access', refreshToken: 'refresh' });

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'tokens',
      JSON.stringify({ accessToken: 'access', refreshToken: 'refresh' }),
      { service: 'contronde-patron.tokens' }
    );
  });

  it('reads and clears tokens from Keychain', async () => {
    jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
      username: 'tokens',
      password: JSON.stringify({ accessToken: 'access', refreshToken: 'refresh' }),
      service: 'contronde-patron.tokens',
      storage: 'keychain',
    } as never);

    await expect(getTokens()).resolves.toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    await clearTokens();
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'contronde-patron.tokens' });
  });
});
