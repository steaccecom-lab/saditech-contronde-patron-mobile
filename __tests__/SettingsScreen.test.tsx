import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../src/services/notificationPreferencesApi';
import {Alert, StyleSheet} from 'react-native';
import {logout} from '../src/services/authApi';
import {revokeCurrentDevice} from '../src/services/mobileDevicesApi';
import {disconnectSocket} from '../src/services/socketService';
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
  ['Rondes terminées uniquement', 'FINISHED_ONLY'],
  ['Retards uniquement', 'LATE_ONLY'],
  ['Rondes manquées uniquement', 'MISSED_ONLY'],
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
    expect(view.getByText('Rondes terminées uniquement')).toBeTruthy(),
  );
  fireEvent.press(view.getByText('Rondes terminées uniquement'));
  await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
  expect(view.queryByText('Préférence sauvegardée.')).toBeNull();
  expect(
    view.getByRole('radio', {name: 'Tous les scans'}).props.accessibilityState
      .checked,
  ).toBe(true);
});

it('groups personal notifications and session, keeping usable touch targets', async () => {
  const view = screen();
  await waitFor(() => expect(view.getAllByRole('radio')).toHaveLength(5));
  expect(view.getByText('Mes notifications')).toBeTruthy();
  expect(view.getByText('Session')).toBeTruthy();
  for (const radio of view.getAllByRole('radio')) {
    expect(
      StyleSheet.flatten(radio.props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
  }
});
it('keeps the existing out-of-order preference without saving it automatically', async () => {
  serverMode = 'OUT_OF_ORDER_ONLY';
  const view = screen();
  await waitFor(() =>
    expect(view.getByText(/Votre ancienne préférence/)).toBeTruthy(),
  );
  expect(view.getAllByRole('radio')).toHaveLength(5);
  expect(updateNotificationPreferences).not.toHaveBeenCalled();
});
it('retains logout confirmation and only logs out after confirmation', async () => {
  jest.mocked(revokeCurrentDevice).mockResolvedValue(undefined as never);
  jest.mocked(logout).mockResolvedValue(undefined as never);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = screen();
  await waitFor(() => expect(view.getByText('Tous les scans')).toBeTruthy());
  fireEvent.press(view.getByRole('button', {name: 'Se déconnecter'}));
  expect(logout).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons[0].text).toBe('Annuler');
  await act(async () => {
    await buttons[1].onPress!();
  });
  expect(revokeCurrentDevice).toHaveBeenCalledTimes(1);
  expect(logout).toHaveBeenCalledTimes(1);
  expect(disconnectSocket).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
