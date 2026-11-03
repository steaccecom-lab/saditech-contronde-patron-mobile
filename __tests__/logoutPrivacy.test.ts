import {QueryClient} from '@tanstack/react-query';
import * as Keychain from 'react-native-keychain';
import {logout} from '../src/services/authApi';
import {useAuthStore} from '../src/stores/authStore';
import {registerPrivateQueryCacheClearer} from '../src/privateQueryCache';
import {http} from '../src/services/http';
import {revokeCurrentDevice} from '../src/services/mobileDevicesApi';
import {disconnectSocket} from '../src/services/socketService';
import {resetEventDedup} from '../src/services/eventDedup';
jest.mock('../src/services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
jest.mock('../src/services/eventDedup', () => ({resetEventDedup: jest.fn()}));
jest.mock('../src/services/http', () => ({
  ...jest.requireActual('../src/services/http'),
  http: {post: jest.fn()},
}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
});
it.each([false, true])(
  'keeps real logout, Keychain erasure and cache purge even when offline=%s',
  async offline => {
    const client = new QueryClient();
    registerPrivateQueryCacheClearer(() => client.clear());
    client.setQueryData(['dashboard', {companyId: 'c'}], {privateData: true});
    client.setQueryData(['notificationPreferences', 'c', 'u'], {
      scanNotificationMode: 'ALL_SCANS',
    });
    useAuthStore.getState().setSession('fixture-access', 'fixture-refresh', {
      id: 'u',
      companyId: 'c',
      roleType: 'SUPERVISOR',
      fullName: 'S',
      email: 's@example.test',
      permissions: [],
    });
    useAuthStore.getState().setPendingRoundId('private-round');
    if (offline) {
      jest.mocked(http.post).mockRejectedValue(new Error('offline'));
      jest.mocked(revokeCurrentDevice).mockRejectedValue(new Error('offline'));
    } else {
      jest.mocked(http.post).mockResolvedValue({});
      jest.mocked(revokeCurrentDevice).mockResolvedValue(undefined);
    }
    await logout('fixture-refresh');
    expect(revokeCurrentDevice).toHaveBeenCalledTimes(1);
    expect(disconnectSocket).toHaveBeenCalledTimes(1);
    expect(resetEventDedup).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith(
      '/auth/logout',
      {
        refreshToken: 'fixture-refresh',
      },
      expect.objectContaining({_sessionCleanup: true, _skipRefresh: true}),
    );
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'contronde-patron.tokens',
    });
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalledWith({
      service: 'contronde-patron.device',
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      user: null,
      pendingRoundId: null,
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  },
);
