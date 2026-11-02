import {QueryClient} from '@tanstack/react-query';
import {setupFirebaseMessaging} from '../src/services/firebaseMessagingService';
import {useAuthStore} from '../src/stores/authStore';
import {registerDevice} from '../src/services/mobileDevicesApi';
const mockFcm = {
  requestPermission: jest.fn(),
  getToken: jest.fn(),
  onTokenRefresh: jest.fn(),
  onMessage: jest.fn(),
  setBackgroundMessageHandler: jest.fn(),
  getInitialNotification: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
};
jest.mock('@react-native-firebase/messaging', () => () => mockFcm);
jest.mock('../src/services/mobileDevicesApi', () => ({
  registerDevice: jest.fn(),
}));
const user = {
  id: 'u',
  companyId: 'c',
  fullName: 'Patron',
  email: 'p@example.test',
  roleType: 'SUPERVISOR' as const,
  permissions: [],
};
let client: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient();
  useAuthStore.setState({
    user,
    accessToken: 'fixture-access',
    refreshToken: 'fixture-refresh',
    pendingRoundId: null,
  });
  mockFcm.getToken.mockResolvedValue('fixture-fcm');
  mockFcm.getInitialNotification.mockResolvedValue(null);
  for (const method of [
    mockFcm.onTokenRefresh,
    mockFcm.onMessage,
    mockFcm.onNotificationOpenedApp,
  ]) {
    method.mockReturnValue(jest.fn());
  }
});
afterEach(() => {
  client.clear();
  useAuthStore.getState().clearSession();
});
it('keeps initial/opened notification round IDs and releases all existing listeners', async () => {
  mockFcm.getInitialNotification.mockResolvedValue({
    data: {scheduledRoundId: 'round-initial'},
  });
  const unsubscribe = await setupFirebaseMessaging(client);
  expect(useAuthStore.getState().pendingRoundId).toBe('round-initial');
  useAuthStore
    .getState()
    .updateAccessToken('fixture-rotated-access', 'fixture-rotated-refresh');
  mockFcm.onNotificationOpenedApp.mock.calls[0][0]({
    data: {scheduledRoundId: 'round-opened'},
  });
  expect(useAuthStore.getState().pendingRoundId).toBe('round-opened');
  expect(registerDevice).toHaveBeenCalledWith('fixture-fcm');
  unsubscribe();
  for (const method of [
    mockFcm.onTokenRefresh,
    mockFcm.onMessage,
    mockFcm.onNotificationOpenedApp,
  ]) {
    expect(method.mock.results[0].value).toHaveBeenCalledTimes(1);
  }
});
it('does not reinstall a pending private round after logout while initial FCM lookup is pending', async () => {
  let resolve!: (value: unknown) => void;
  const waiting = new Promise(yes => {
    resolve = yes;
  });
  mockFcm.getInitialNotification.mockReturnValue(waiting);
  const setup = setupFirebaseMessaging(client);
  for (
    let attempt = 0;
    attempt < 12 && !mockFcm.getInitialNotification.mock.calls.length;
    attempt++
  ) {
    await Promise.resolve();
  }
  expect(mockFcm.getInitialNotification).toHaveBeenCalled();
  useAuthStore.getState().clearSession();
  resolve({data: {scheduledRoundId: 'old-private-round'}});
  const unsubscribe = await setup;
  expect(useAuthStore.getState().pendingRoundId).toBeNull();
  unsubscribe();
});
it('ignores old session callbacks after switching company while preserving battery event invalidation', async () => {
  const invalidate = jest
    .spyOn(client, 'invalidateQueries')
    .mockResolvedValue();
  const unsubscribe = await setupFirebaseMessaging(client);
  const incoming = mockFcm.onMessage.mock.calls[0][0];
  await incoming({
    data: {type: 'patron.battery.low', eventId: 'battery-fixture'},
  });
  expect(invalidate).toHaveBeenCalledWith({queryKey: ['agents']});
  expect(invalidate).toHaveBeenCalledWith({queryKey: ['agentRounds']});
  useAuthStore.setState({
    user: {...user, id: 'other', companyId: 'other-company'},
  });
  mockFcm.onNotificationOpenedApp.mock.calls[0][0]({
    data: {scheduledRoundId: 'old-private-round'},
  });
  expect(useAuthStore.getState().pendingRoundId).toBeNull();
  unsubscribe();
});
