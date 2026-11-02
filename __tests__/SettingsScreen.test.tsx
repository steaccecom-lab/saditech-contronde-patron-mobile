import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateBatteryPreference,
} from '../src/services/notificationPreferencesApi';
import {Alert, BackHandler, NativeModules, StyleSheet} from 'react-native';
import {logout} from '../src/services/authApi';
import {revokeCurrentDevice} from '../src/services/mobileDevicesApi';
import {disconnectSocket} from '../src/services/socketService';
import type {ScanNotificationMode, User} from '../src/types/api';
jest.mock('../src/services/notificationPreferencesApi', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
  updateBatteryPreference: jest.fn(),
}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(),
}));
const admin: User = {
  id: 'admin',
  companyId: 'company',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Responsable Test',
  email: 'patron@example.test',
  permissions: [],
};
let mockUser: User | null;
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: mockUser, refreshToken: 'test-refresh'}),
}));
jest.mock('../src/components/CompanySupervisionSettings', () => ({
  CompanySupervisionSettings: () => null,
}));
jest.mock('../src/services/authApi', () => ({logout: jest.fn()}));
jest.mock('../src/services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
let serverMode: ScanNotificationMode;
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  delete NativeModules.PatronAppInfo;
  jest.restoreAllMocks();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  mockFocused = true;
  serverMode = 'ALL_SCANS';
  jest
    .mocked(getNotificationPreferences)
    .mockImplementation(async () => ({scanNotificationMode: serverMode}));
  jest.mocked(updateNotificationPreferences).mockImplementation(async mode => {
    serverMode = mode;
    return {scanNotificationMode: mode};
  });
});
function screen(
  page:
    | 'menu'
    | 'account'
    | 'notifications'
    | 'company'
    | 'about'
    | 'session' = 'notifications',
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false, gcTime: 0},
    },
  });
  clients.push(client);
  const element = () => (
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>
  );
  const view = render(element());
  const labels = {
    account: 'Mon compte',
    notifications: 'Mes notifications',
    company: 'Réglages société',
    about: 'À propos',
    session: 'Déconnexion',
  };
  if (
    page !== 'menu' &&
    mockUser?.companyId &&
    ['COMPANY_ADMIN', 'SUPERVISOR'].includes(mockUser.roleType)
  ) {
    fireEvent.press(view.getByLabelText(`Ouvrir ${labels[page]}`));
  }
  return {
    ...view,
    client,
    redraw: () => view.rerender(element()),
    changeUser: (user: User | null) => {
      mockUser = user;
      view.rerender(element());
    },
  };
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

it('opens personal preferences from a compact menu, keeping usable touch targets', async () => {
  const view = screen();
  await waitFor(() => expect(view.getAllByRole('radio')).toHaveLength(5));
  expect(view.getByText('Mes notifications')).toBeTruthy();
  expect(view.queryByText('Session')).toBeNull();
  expect(view.getByLabelText('Retour aux paramètres')).toBeTruthy();
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
  const view = screen('session');
  expect(view.getByText('Session')).toBeTruthy();
  view.client.setQueryData(['dashboard', 'private-snapshot'], {
    privateData: true,
  });
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
  expect(
    view.client.getQueryCache().findAll({queryKey: ['dashboard']}),
  ).toHaveLength(0);
  alert.mockRestore();
});

it('shows actual account and build metadata without API URLs or session secrets', async () => {
  NativeModules.PatronAppInfo = {
    versionName: '9.8.7-staging',
    versionCode: 123,
  };
  const view = screen('account');
  for (const label of [
    'Mon compte',
    admin.fullName,
    admin.email,
    'Responsable société',
  ]) {
    expect(view.getByText(label)).toBeTruthy();
  }
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  fireEvent.press(view.getByLabelText('Ouvrir À propos'));
  for (const label of [
    'À propos',
    'Contronde Patron',
    '9.8.7-staging',
    '123',
    'Développement',
    'SADITECH PRO',
  ]) {
    expect(view.getByText(label)).toBeTruthy();
  }
  expect(
    view.queryByText(/test-refresh|10\.0\.2\.2|api-contronde|https?:\/\//),
  ).toBeNull();
  expect(view.queryByText(/Synchroniser|Synchronisation manuelle/)).toBeNull();
});
it('retains the separate battery preference without changing the selected round preference', async () => {
  jest.mocked(getNotificationPreferences).mockResolvedValue({
    scanNotificationMode: 'LATE_ONLY',
    batteryAlertsEnabled: false,
  });
  jest.mocked(updateBatteryPreference).mockResolvedValue({
    scanNotificationMode: 'LATE_ONLY',
    batteryAlertsEnabled: true,
  });
  const view = screen();
  await view.findByLabelText('Recevoir les alertes batterie');
  fireEvent(
    view.getByLabelText('Recevoir les alertes batterie'),
    'valueChange',
    true,
  );
  await view.findByText('Préférence batterie sauvegardée.');
  expect(jest.mocked(updateBatteryPreference).mock.calls[0][0]).toBe(true);
  expect(updateNotificationPreferences).not.toHaveBeenCalled();
  expect(
    view.getByRole('radio', {name: 'Retards uniquement'}).props
      .accessibilityState.checked,
  ).toBe(true);
});
it('keeps another account isolated from a late personal preference response', async () => {
  let resolve!: (value: {scanNotificationMode: ScanNotificationMode}) => void;
  jest.mocked(updateNotificationPreferences).mockReturnValue(
    new Promise(yes => {
      resolve = yes;
    }),
  );
  const view = screen();
  await view.findByText('Tous les scans');
  fireEvent.press(view.getByText('Retards uniquement'));
  jest
    .mocked(getNotificationPreferences)
    .mockResolvedValue({scanNotificationMode: 'DISABLED'});
  view.changeUser({
    ...admin,
    id: 'other',
    companyId: 'other-company',
    fullName: 'Autre responsable',
  });
  expect(view.getByLabelText('Ouvrir Mes notifications')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Ouvrir Mes notifications'));
  await waitFor(() =>
    expect(
      view.getByRole('radio', {name: 'Notifications désactivées'}).props
        .accessibilityState.checked,
    ).toBe(true),
  );
  await act(async () => resolve({scanNotificationMode: 'LATE_ONLY'}));
  expect(
    view.getByRole('radio', {name: 'Notifications désactivées'}).props
      .accessibilityState.checked,
  ).toBe(true);
  expect(view.queryByText('Préférence sauvegardée.')).toBeNull();
  expect(view.queryByText(admin.fullName)).toBeNull();
});
it.each([
  null,
  {...admin, roleType: 'AGENT' as const},
  {...admin, companyId: null},
])('does not load private settings for an unauthorized identity', user => {
  mockUser = user;
  const view = screen();
  expect(getNotificationPreferences).not.toHaveBeenCalled();
  expect(view.queryByText('Mon compte')).toBeNull();
});

it('keeps five menu entries and shows only the chosen settings page', () => {
  const view = screen('menu');
  for (const label of [
    'Mon compte',
    'Mes notifications',
    'Réglages société',
    'À propos',
    'Déconnexion',
  ]) {
    expect(view.getByRole('button', {name: `Ouvrir ${label}`})).toBeTruthy();
  }
  expect(view.queryAllByRole('radio')).toHaveLength(0);
  expect(view.queryByText(admin.email)).toBeNull();
  fireEvent.press(view.getByLabelText('Ouvrir Mon compte'));
  expect(view.getByText(admin.email)).toBeTruthy();
  expect(view.queryByLabelText('Ouvrir À propos')).toBeNull();
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  expect(view.queryByText(admin.email)).toBeNull();
  expect(view.getByLabelText('Ouvrir À propos')).toBeTruthy();
  expect(updateNotificationPreferences).not.toHaveBeenCalled();
  expect(logout).not.toHaveBeenCalled();
});
it('handles Android back only inside a focused settings subpage', () => {
  let hardwareBack!: () => boolean | null | undefined;
  const remove = jest.fn();
  const listener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      hardwareBack = callback;
      return {remove};
    });
  const view = screen('account');
  expect(listener).toHaveBeenCalledWith(
    'hardwareBackPress',
    expect.any(Function),
  );
  act(() => {
    expect(hardwareBack()).toBe(true);
  });
  expect(view.getByLabelText('Ouvrir Mon compte')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Ouvrir Mon compte'));
  const count = remove.mock.calls.length;
  mockFocused = false;
  view.redraw();
  expect(remove.mock.calls.length).toBeGreaterThan(count);
});
