import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../src/services/notificationPreferencesApi';
import type {ScanNotificationMode} from '../src/types/api';
jest.mock('../src/services/notificationPreferencesApi', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(),
}));
jest.mock('../src/stores/authStore', () => ({useAuthStore: () => null}));
jest.mock('../src/services/authApi', () => ({logout: jest.fn()}));
jest.mock('../src/services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
let serverMode: ScanNotificationMode;
const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach(client => client.clear());
});
beforeEach(() => {
  jest.clearAllMocks();
  serverMode = 'ALL_SCANS';
  jest
    .mocked(getNotificationPreferences)
    .mockImplementation(async () => ({scanNotificationMode: serverMode}));
  jest.mocked(updateNotificationPreferences).mockImplementation(async mode => {
    serverMode = mode;
    return {scanNotificationMode: mode};
  });
});
function screen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false, gcTime: 0},
    },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
}
it.each([
  ['Tous les scans', 'ALL_SCANS'],
  ['Seulement terminée', 'FINISHED_ONLY'],
  ['Seulement en retard', 'LATE_ONLY'],
  ['Seulement manquées', 'MISSED_ONLY'],
  ['Notifications désactivées', 'DISABLED'],
] as const)(
  'saves %s via API and reads it again on remount',
  async (label, mode) => {
    const view = screen();
    await waitFor(() => expect(view.getByText(label)).toBeTruthy());
    expect(view.queryByText('Seulement les scans hors ordre')).toBeNull();
    fireEvent.press(view.getByText(label));
    await waitFor(() =>
      expect(view.getByText('Préférence sauvegardée.')).toBeTruthy(),
    );
    expect(jest.mocked(updateNotificationPreferences).mock.calls[0][0]).toBe(
      mode,
    );
    view.unmount();
    const reloaded = screen();
    await waitFor(() =>
      expect(
        reloaded.getByRole('radio', {name: label}).props.accessibilityState
          .checked,
      ).toBe(true),
    );
    // Initial load, canonical reload after save, then a fresh screen/cache.
    expect(getNotificationPreferences).toHaveBeenCalledTimes(3);
  },
);
it('does not show a success confirmation when saving fails', async () => {
  jest
    .mocked(updateNotificationPreferences)
    .mockRejectedValueOnce(new Error('offline'));
  const view = screen();
  await waitFor(() =>
    expect(view.getByText('Seulement terminée')).toBeTruthy(),
  );
  fireEvent.press(view.getByText('Seulement terminée'));
  await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
  expect(view.queryByText('Préférence sauvegardée.')).toBeNull();
  expect(
    view.getByRole('radio', {name: 'Tous les scans'}).props.accessibilityState
      .checked,
  ).toBe(true);
});
