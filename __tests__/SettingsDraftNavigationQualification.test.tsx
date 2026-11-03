import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import {BackHandler} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SettingsScreen} from '../src/screens/SettingsScreen';
import {
  getCompanyOperationSettings,
  saveBatterySettings,
  saveCompanyOperationSettings,
  type CompanyOperationSettingsResponse,
} from '../src/services/companyOperationSettingsApi';
import type {User} from '../src/types/api';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('../src/services/companyOperationSettingsApi', () => ({
  getCompanyOperationSettings: jest.fn(),
  saveBatterySettings: jest.fn(),
  saveCompanyOperationSettings: jest.fn(),
}));
jest.mock('../src/services/notificationPreferencesApi', () => ({
  getNotificationPreferences: jest.fn(async () => ({
    scanNotificationMode: 'ALL_SCANS',
  })),
  updateNotificationPreferences: jest.fn(),
  updateBatteryPreference: jest.fn(),
}));
jest.mock('../src/services/authApi', () => ({logout: jest.fn()}));
jest.mock('../src/services/mobileDevicesApi', () => ({
  revokeCurrentDevice: jest.fn(),
}));
jest.mock('../src/services/socketService', () => ({
  disconnectSocket: jest.fn(),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: mockUser, refreshToken: 'fixture-refresh'}),
}));
const admin: User = {
  id: 'fixture-admin-a',
  companyId: 'fixture-company-a',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Compte fictif A',
  email: 'a@example.invalid',
  permissions: ['companies.manage'],
};
const saved: CompanyOperationSettingsResponse = {
  configured: true,
  settings: {
    roundStartToleranceMinutes: 10,
    missedIfNotStartedAfterMinutes: 30,
    checkpointLateToleranceMinutes: 5,
    maxSessionDurationMinutes: 480,
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
};
let mockUser: User | null;
let mockFocused = true;
const clients: QueryClient[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  mockFocused = true;
  jest.mocked(getCompanyOperationSettings).mockResolvedValue(saved);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  jest.restoreAllMocks();
});
function screen() {
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
  return {...view, client, redraw: () => view.rerender(element())};
}
async function company(view: ReturnType<typeof screen>) {
  fireEvent.press(view.getByLabelText('Ouvrir Réglages société'));
  await view.findByLabelText('Tolérance de départ (minutes)');
  await view.findByLabelText('Seuil de batterie faible (%)');
}
const edits = [
  ['Tolérance de départ (minutes)', '12'],
  ['Délai avant ronde manquée (minutes)', '35'],
  ['Tolérance des points de contrôle (minutes)', '6'],
  ['Durée maximale des rondes (minutes)', '500'],
  ['Seuil de batterie faible (%)', '22'],
  ['Seuil de batterie critique (%)', '11'],
  ['Réarmement au-dessus de (%)', '28'],
];
it('retains all company and battery drafts through interface back without saving', async () => {
  const view = screen();
  await company(view);
  for (const [label, value] of edits)
    {fireEvent.changeText(view.getByLabelText(label), value);}
  fireEvent(
    view.getByLabelText('Notification de fin de ronde'),
    'valueChange',
    false,
  );
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  expect(view.queryByLabelText(edits[0][0])).toBeNull();
  fireEvent.press(view.getByLabelText('Ouvrir À propos'));
  fireEvent.press(view.getByLabelText('Retour aux paramètres'));
  await company(view);
  for (const [label, value] of edits)
    {expect(view.getByLabelText(label).props.value).toBe(value);}
  expect(view.getByLabelText('Notification de fin de ronde').props.value).toBe(
    false,
  );
  expect(saveCompanyOperationSettings).not.toHaveBeenCalled();
  expect(saveBatterySettings).not.toHaveBeenCalled();
});
it('retains drafts across Android back and a tab blur/focus, without implicit writes', async () => {
  let hardwareBack!: () => boolean | null | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      hardwareBack = callback;
      return {remove: jest.fn()};
    });
  const view = screen();
  await company(view);
  fireEvent.changeText(view.getByLabelText(edits[0][0]), '12');
  fireEvent.changeText(view.getByLabelText(edits[4][0]), '22');
  mockFocused = false;
  view.redraw();
  mockFocused = true;
  view.redraw();
  expect(view.getByLabelText(edits[0][0]).props.value).toBe('12');
  act(() => {
    expect(hardwareBack()).toBe(true);
  });
  await company(view);
  expect(view.getByLabelText(edits[0][0]).props.value).toBe('12');
  expect(view.getByLabelText(edits[4][0]).props.value).toBe('22');
  expect(saveCompanyOperationSettings).not.toHaveBeenCalled();
  expect(saveBatterySettings).not.toHaveBeenCalled();
});
it.each(['same-company', 'other-company'])(
  'purges drafts on an account change: %s',
  async scope => {
    const view = screen();
    await company(view);
    fireEvent.changeText(view.getByLabelText(edits[0][0]), '12');
    fireEvent.changeText(view.getByLabelText(edits[4][0]), '22');
    mockUser = {
      ...admin,
      id: 'fixture-admin-b',
      companyId:
        scope === 'same-company' ? admin.companyId : 'fixture-company-b',
    };
    view.redraw();
    await company(view);
    expect(view.getByLabelText(edits[0][0]).props.value).toBe('10');
    expect(view.getByLabelText(edits[4][0]).props.value).toBe('20');
    expect(saveCompanyOperationSettings).not.toHaveBeenCalled();
    expect(saveBatterySettings).not.toHaveBeenCalled();
  },
);
it.each(['rules', 'battery'] as const)(
  'never restores private cache from a late %s save after logout',
  async kind => {
    let finish!: (result: CompanyOperationSettingsResponse) => void;
    const pending = new Promise<CompanyOperationSettingsResponse>(resolve => {
      finish = resolve;
    });
    if (kind === 'rules')
      {jest.mocked(saveCompanyOperationSettings).mockReturnValueOnce(pending);}
    else {jest.mocked(saveBatterySettings).mockReturnValueOnce(pending);}
    const view = screen();
    await company(view);
    const [label, value] = edits[kind === 'rules' ? 0 : 4];
    fireEvent.changeText(view.getByLabelText(label), value);
    fireEvent.press(
      view.getByText(
        kind === 'rules'
          ? 'Enregistrer les règles'
          : 'Enregistrer les règles batterie',
      ),
    );
    await waitFor(() =>
      expect(
        kind === 'rules' ? saveCompanyOperationSettings : saveBatterySettings,
      ).toHaveBeenCalledTimes(1),
    );
    // Same ordering as logout: clear the private cache, then remove the authenticated tree.
    act(() => {
      view.client.clear();
      mockUser = null;
      view.redraw();
    });
    await act(async () => {
      finish(saved);
      await pending;
    });
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
  },
);
