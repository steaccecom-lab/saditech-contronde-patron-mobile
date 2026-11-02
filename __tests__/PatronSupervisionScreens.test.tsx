import React from 'react';
import {Dimensions} from 'react-native';
import {fireEvent, render, waitFor, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {RoundDetailScreen} from '../src/screens/RoundDetailScreen';
import {getRoundDetail} from '../src/services/patronApi';
import {getCompanyOperationSettings} from '../src/services/companyOperationSettingsApi';
import {getNotificationPreferences} from '../src/services/notificationPreferencesApi';
import type {User} from '../src/types/api';
jest.mock('../src/services/patronApi', () => ({getRoundDetail: jest.fn()}));
jest.mock('../src/services/companyOperationSettingsApi', () => ({
  getCompanyOperationSettings: jest.fn(),
  saveCompanyOperationSettings: jest.fn(),
  saveBatterySettings: jest.fn(),
}));
jest.mock('../src/services/notificationPreferencesApi', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(),
}));
jest.mock('../src/services/authApi', () => ({logout: jest.fn()}));
jest.mock('../src/services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({params: {id: 'round'}}),
  useIsFocused: () => true,
}));
const admin: User = {
  id: 'admin',
  companyId: 'company',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Admin',
  email: 'admin@test.local',
  permissions: ['companies.manage'],
};
let mockUser: User;
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (value: unknown) => unknown) =>
    selector({user: mockUser, refreshToken: null}),
}));
const clients: QueryClient[] = [];
function screen(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false, gcTime: 0},
    },
  });
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
  if (element.type === SettingsScreen) {
    fireEvent.press(view.getByLabelText('Ouvrir Réglages société'));
  }
  return {...view, client};
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  jest.mocked(getNotificationPreferences).mockResolvedValue({
    scanNotificationMode: 'ALL_SCANS',
    batteryAlertsEnabled: true,
  });
  jest.mocked(getCompanyOperationSettings).mockResolvedValue({
    configured: true,
    settings: {
      roundStartToleranceMinutes: 10,
      checkpointLateToleranceMinutes: 5,
      maxSessionDurationMinutes: 480,
      missedIfNotStartedAfterMinutes: null,
      allowOutOfOrderScan: true,
      automaticMissedRoundDetection: true,
      criticalAnomalyDetection: true,
      notifyLateRound: true,
      notifyMissedRound: true,
      notifyCriticalAnomaly: true,
      notifyRoundFinished: true,
      batteryAlertsEnabled: false,
      batteryLowThreshold: 20,
      batteryCriticalThreshold: 10,
      batteryRearmThreshold: 25,
    },
  });
});
afterEach(() => {
  clients.splice(0).forEach(client => client.clear());
  jest.restoreAllMocks();
});
it.each([320, 800])(
  'renders company rules and personal preferences at width %s without fixed field widths',
  async width => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({width, height: 900, scale: 1, fontScale: 1});
    const view = screen(<SettingsScreen />);
    await waitFor(() =>
      expect(view.getByLabelText('Tolérance de départ (minutes)')).toBeTruthy(),
    );
    expect(view.getByText('Réglages société')).toBeTruthy();
    expect(view.getByText('Notifications de la société')).toBeTruthy();
    expect(view.getByText('Règles de la société')).toBeTruthy();
    expect(view.getByText('Tolérances des rondes')).toBeTruthy();
    expect(view.queryByText('Session')).toBeNull();
    expect(
      view.getByLabelText('Tolérance des points de contrôle (minutes)'),
    ).toBeTruthy();
  },
);
it('keeps the supervision draft if the personal preferences request fails', async () => {
  const view = screen(<SettingsScreen />);
  await waitFor(() =>
    expect(view.getByLabelText('Tolérance de départ (minutes)')).toBeTruthy(),
  );
  fireEvent.changeText(
    view.getByLabelText('Tolérance de départ (minutes)'),
    '23',
  );
  jest
    .mocked(getNotificationPreferences)
    .mockRejectedValueOnce(new Error('offline'));
  await act(async () => {
    await view.client.invalidateQueries({
      queryKey: ['notificationPreferences'],
    });
  });
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  fireEvent.press(view.getByLabelText('Ouvrir Mes notifications'));
  await waitFor(() =>
    expect(
      view.getByText('Impossible de charger les préférences personnelles.'),
    ).toBeTruthy(),
  );
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  fireEvent.press(view.getByLabelText('Ouvrir Réglages société'));
  expect(view.getByLabelText('Tolérance de départ (minutes)').props.value).toBe(
    '23',
  );
});
it('shows the steps warning in the actual round detail without adding notifications', async () => {
  jest.mocked(getRoundDetail).mockResolvedValue({
    id: 'round',
    status: 'FINISHED',
    plannedStartAt: '2026-10-24T12:00:00Z',
    startedAt: null,
    finishedAt: null,
    durationSeconds: null,
    progress: {validated: 0, total: 0},
    outOfOrderCount: 0,
    missedCheckpointCount: 0,
    agent: null,
    round: {id: 'r', name: 'Ronde'},
    site: {id: 's', name: 'Site'},
    checkpoints: [],
    anomalies: [],
    stepCount: 0,
    stepTrackingStatus: 'AVAILABLE',
  });
  const view = screen(<RoundDetailScreen />);
  await waitFor(() =>
    expect(view.getByText('0 pas — Aucun pas détecté !')).toBeTruthy(),
  );
  expect(getRoundDetail).toHaveBeenCalledWith('round');
});

it('preserves society and battery drafts across menu returns, with independent validation and cancellation', async () => {
  const view = screen(<SettingsScreen />);
  await view.findByLabelText('Seuil de batterie faible (%)');
  fireEvent.changeText(
    view.getByLabelText('Tolérance de départ (minutes)'),
    '33',
  );
  fireEvent.changeText(
    view.getByLabelText('Seuil de batterie faible (%)'),
    '9',
  );
  expect(
    view.getByRole('button', {name: 'Enregistrer les règles batterie'}).props
      .accessibilityState.disabled,
  ).toBe(true);
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  expect(view.queryByLabelText('Seuil de batterie faible (%)')).toBeNull();
  fireEvent.press(view.getByLabelText('Ouvrir À propos'));
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  fireEvent.press(view.getByLabelText('Ouvrir Réglages société'));
  expect(view.getByLabelText('Seuil de batterie faible (%)').props.value).toBe(
    '9',
  );
  expect(view.getByLabelText('Tolérance de départ (minutes)').props.value).toBe(
    '33',
  );
  fireEvent.changeText(
    view.getByLabelText('Seuil de batterie faible (%)'),
    '22',
  );
  expect(
    view.getByRole('button', {name: 'Enregistrer les règles batterie'}).props
      .accessibilityState.disabled,
  ).toBe(false);
  fireEvent.press(view.getByText('Annuler les modifications batterie'));
  expect(view.getByLabelText('Seuil de batterie faible (%)').props.value).toBe(
    '20',
  );
  expect(view.getByLabelText('Tolérance de départ (minutes)').props.value).toBe(
    '33',
  );
  fireEvent.press(view.getByText('Annuler les modifications de supervision'));
  expect(view.getByLabelText('Tolérance de départ (minutes)').props.value).toBe(
    '10',
  );
  expect(getCompanyOperationSettings).toHaveBeenCalledTimes(1);
});
it('keeps supervisor society/battery controls read-only and personal notifications usable', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen(<SettingsScreen />);
  await view.findByLabelText('Seuil de batterie faible (%)');
  expect(
    view.getByLabelText('Tolérance de départ (minutes)').props.editable,
  ).toBe(false);
  expect(
    view.getByLabelText('Alertes batterie de la société').props.disabled,
  ).toBe(true);
  expect(view.queryByText('Enregistrer les règles batterie')).toBeNull();
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  fireEvent.press(view.getByLabelText('Ouvrir Mes notifications'));
  expect(view.getAllByRole('radio')).toHaveLength(5);
  expect(
    view.getByLabelText('Recevoir les alertes batterie').props.disabled,
  ).toBe(false);
});
