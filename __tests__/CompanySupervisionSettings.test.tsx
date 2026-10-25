import React from 'react';
import {fireEvent, render, waitFor, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {CompanySupervisionSettings} from '../src/components/CompanySupervisionSettings';
import {
  getCompanyOperationSettings,
  saveCompanyOperationSettings,
  type CompanyOperationSettings,
} from '../src/services/companyOperationSettingsApi';
import type {User} from '../src/types/api';
jest.mock('../src/services/companyOperationSettingsApi', () => ({
  getCompanyOperationSettings: jest.fn(),
  saveCompanyOperationSettings: jest.fn(),
}));
const settings: CompanyOperationSettings = {
  roundStartToleranceMinutes: 10,
  missedIfNotStartedAfterMinutes: null,
  checkpointLateToleranceMinutes: 5,
  maxSessionDurationMinutes: 480,
  allowOutOfOrderScan: true,
  automaticMissedRoundDetection: true,
  criticalAnomalyDetection: true,
  notifyLateRound: true,
  notifyMissedRound: true,
  notifyCriticalAnomaly: true,
  notifyRoundFinished: true,
};
const admin: User = {
  id: 'admin',
  companyId: 'company-a',
  roleType: 'COMPANY_ADMIN',
  permissions: ['companies.manage'],
  fullName: 'Admin',
  email: 'admin@test.local',
};
const clients: QueryClient[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getCompanyOperationSettings).mockResolvedValue({settings, configured: true});
  jest
    .mocked(saveCompanyOperationSettings)
    .mockImplementation(async (_id, _section, values) => ({settings: values, configured: true}));
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));
function screen(user = admin) {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: 0}, mutations: {retry: false, gcTime: 0}},
  });
  clients.push(client);
  const element = (current: User) => (
    <QueryClientProvider client={client}>
      <CompanySupervisionSettings key={`${current.companyId}:${current.id}`} user={current} />
    </QueryClientProvider>
  );
  return {...render(element(user)), client, element};
}
const label = 'Tolérance de départ (minutes)';
it('loads and saves rules without losing an unsaved notification', async () => {
  const view = screen();
  await waitFor(() => expect(view.getByLabelText(label).props.value).toBe('10'));
  fireEvent.changeText(view.getByLabelText(label), '12');
  fireEvent(view.getByLabelText('Notification de fin de ronde'), 'valueChange', false);
  fireEvent.press(view.getByText('Enregistrer les règles'));
  await waitFor(() => expect(view.getByText('Règles de supervision enregistrées.')).toBeTruthy());
  expect(saveCompanyOperationSettings).toHaveBeenNthCalledWith(
    1,
    'company-a',
    'rules',
    expect.objectContaining({
      roundStartToleranceMinutes: 12,
      notifyRoundFinished: true,
      missedIfNotStartedAfterMinutes: null,
    }),
  );
  expect(view.getByLabelText('Notification de fin de ronde').props.value).toBe(false);
  fireEvent.changeText(view.getByLabelText(label), '13');
  fireEvent.press(view.getByText('Enregistrer les notifications société'));
  await waitFor(() => expect(view.getByText('Notifications société enregistrées.')).toBeTruthy());
  expect(saveCompanyOperationSettings).toHaveBeenNthCalledWith(
    2,
    'company-a',
    'notifications',
    expect.objectContaining({roundStartToleranceMinutes: 12, notifyRoundFinished: false}),
  );
  expect(view.getByLabelText(label).props.value).toBe('13');
});
it.each(['-1', '1.5', '1441', 'abc', ''])(
  'rejects invalid departure tolerance %s',
  async (value) => {
    const view = screen();
    await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
    fireEvent.changeText(view.getByLabelText(label), value);
    expect(
      view.getByRole('button', {name: 'Enregistrer les règles'}).props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(view.getByText('Enregistrer les règles'));
    expect(saveCompanyOperationSettings).not.toHaveBeenCalled();
  },
);
it('rejects a missed delay at or below departure tolerance', async () => {
  const view = screen();
  await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText('Délai avant ronde manquée (minutes)'), '10');
  expect(
    view.getByText('Le délai avant ronde manquée doit dépasser la tolérance de départ.'),
  ).toBeTruthy();
});
it.each([
  {...admin, roleType: 'SUPERVISOR' as const},
  {...admin, permissions: []},
])('keeps rules read-only without write authorization', async (user) => {
  const view = screen(user);
  await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
  expect(view.getByLabelText(label).props.editable).toBe(false);
  expect(view.getByLabelText('Notification de fin de ronde').props.disabled).toBe(true);
  expect(view.queryByText('Enregistrer les règles')).toBeNull();
});
it('preserves drafts on background refresh, network failure and retry', async () => {
  const view = screen();
  await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText(label), '22');
  await act(async () => {
    view.client.setQueryData(['companyOperationSettings', 'company-a', 'admin'], {
      settings: {...settings, roundStartToleranceMinutes: 11},
      configured: true,
    });
  });
  expect(view.getByLabelText(label).props.value).toBe('22');
  jest.mocked(saveCompanyOperationSettings).mockRejectedValueOnce(new Error('Réseau indisponible'));
  fireEvent.press(view.getByText('Enregistrer les règles'));
  await waitFor(() => expect(view.getByText(/Vos modifications sont conservées/)).toBeTruthy());
  expect(view.getByLabelText(label).props.value).toBe('22');
  fireEvent.press(view.getByText('Enregistrer les règles'));
  await waitFor(() => expect(view.getByText('Règles de supervision enregistrées.')).toBeTruthy());
});
it('does not carry drafts or cached values into another company', async () => {
  const view = screen();
  await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText(label), '33');
  view.rerender(view.element({...admin, id: 'other', companyId: 'company-b'}));
  await waitFor(() => expect(getCompanyOperationSettings).toHaveBeenCalledWith('company-b'));
  await waitFor(() => expect(view.getByLabelText(label).props.value).toBe('10'));
});
it('reports loading errors and retries without inventing defaults', async () => {
  jest.mocked(getCompanyOperationSettings).mockRejectedValueOnce(new Error('Réseau indisponible'));
  const view = screen();
  await waitFor(() => expect(view.getByText('Réessayer le chargement')).toBeTruthy());
  expect(view.queryByLabelText(label)).toBeNull();
  fireEvent.press(view.getByText('Réessayer le chargement'));
  await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
});
it('allows cancellation and shows planning fallback explicitly', async () => {
  jest.mocked(getCompanyOperationSettings).mockResolvedValue({settings, configured: false});
  const view = screen();
  await waitFor(() => expect(view.getByText(/Enregistrer les règles activera/)).toBeTruthy());
  fireEvent.changeText(view.getByLabelText(label), '20');
  fireEvent.press(view.getByText('Annuler les modifications de supervision'));
  expect(view.getByLabelText(label).props.value).toBe('10');
});
