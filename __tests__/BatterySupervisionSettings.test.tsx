import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BatterySupervisionSettings} from '../src/components/BatterySupervisionSettings';
import {
  saveBatterySettings,
  type CompanyOperationSettingsResponse,
} from '../src/services/companyOperationSettingsApi';
jest.mock('../src/services/companyOperationSettingsApi', () => ({
  saveBatterySettings: jest.fn(),
}));
const values = {
  batteryAlertsEnabled: false,
  batteryLowThreshold: 20,
  batteryCriticalThreshold: 10,
  batteryRearmThreshold: 25,
};
const data = {
  settings: values,
  configured: false,
} as CompanyOperationSettingsResponse;
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach(client => client.clear()));
beforeEach(() => jest.clearAllMocks());
function screen(canEdit = true, initial = data) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 10000},
      mutations: {retry: false, gcTime: 0},
    },
  });
  clients.push(client);
  const tree = (current: CompanyOperationSettingsResponse) => (
    <QueryClientProvider client={client}>
      <BatterySupervisionSettings
        companyId="company-a"
        canEdit={canEdit}
        data={current}
        queryKey={['companyOperationSettings', 'company-a', 'admin']}
      />
    </QueryClientProvider>
  );
  return {...render(tree(initial)), client, tree};
}
it('sends only battery values without activating round rules', async () => {
  jest.mocked(saveBatterySettings).mockResolvedValue({
    settings: {...values, batteryLowThreshold: 22},
    configured: false,
  } as CompanyOperationSettingsResponse);
  const view = screen();
  fireEvent.changeText(
    view.getByLabelText('Seuil de batterie faible (%)'),
    '22',
  );
  fireEvent.press(view.getByText('Enregistrer les règles batterie'));
  await waitFor(() =>
    expect(view.getByText('Règles batterie enregistrées.')).toBeTruthy(),
  );
  expect(saveBatterySettings).toHaveBeenCalledWith('company-a', {
    ...values,
    batteryLowThreshold: 22,
  });
  expect(
    view.client.getQueryData([
      'companyOperationSettings',
      'company-a',
      'admin',
    ]),
  ).toMatchObject({configured: false});
});
it.each(['-1', '20', '100', 'abc'])(
  'refuses invalid critical threshold %s',
  value => {
    const view = screen();
    fireEvent.changeText(
      view.getByLabelText('Seuil de batterie critique (%)'),
      value,
    );
    fireEvent.press(view.getByText('Enregistrer les règles batterie'));
    expect(saveBatterySettings).not.toHaveBeenCalled();
  },
);
it('preserves a draft after refresh and network failure; cancellation restores saved values', async () => {
  jest.mocked(saveBatterySettings).mockRejectedValueOnce(new Error('Réseau'));
  const view = screen();
  fireEvent.changeText(
    view.getByLabelText('Seuil de batterie faible (%)'),
    '22',
  );
  view.rerender(
    view.tree({...data, settings: {...data.settings, batteryLowThreshold: 21}}),
  );
  expect(view.getByLabelText('Seuil de batterie faible (%)').props.value).toBe(
    '22',
  );
  fireEvent.press(view.getByText('Enregistrer les règles batterie'));
  await waitFor(() =>
    expect(view.getByText(/Modifications conservées/)).toBeTruthy(),
  );
  expect(view.getByLabelText('Seuil de batterie faible (%)').props.value).toBe(
    '22',
  );
  await act(async () =>
    fireEvent.press(view.getByText('Annuler les modifications batterie')),
  );
  expect(view.getByLabelText('Seuil de batterie faible (%)').props.value).toBe(
    '21',
  );
});
it('keeps supervisor fields read-only', () => {
  const view = screen(false);
  expect(
    view.getByLabelText('Seuil de batterie faible (%)').props.editable,
  ).toBe(false);
  expect(
    view.getByLabelText('Alertes batterie de la société').props.disabled,
  ).toBe(true);
  expect(view.queryByText('Enregistrer les règles batterie')).toBeNull();
});
it('does not offer decorative editable settings against an old backend', () => {
  const view = screen(true, {
    settings: {},
    configured: false,
  } as CompanyOperationSettingsResponse);
  expect(view.queryByLabelText('Seuil de batterie faible (%)')).toBeNull();
  expect(view.getByText(/indisponibles sur cette version/)).toBeTruthy();
});
