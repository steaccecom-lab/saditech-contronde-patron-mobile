import React from 'react';
import {act, cleanup, fireEvent, render} from '@testing-library/react-native';
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {AgentRoundsScreen} from '../src/screens/AgentRoundsScreen';
import {getAgentRounds} from '../src/services/patronApi';
import * as clock from '../src/services/gpsClock';
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => ({params: {agentId: 'a', agentName: 'ALPHA'}}),
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: {id: 'u', companyId: 'c', roleType: 'COMPANY_ADMIN'}}),
}));
jest.mock('../src/services/patronApi', () => ({getAgentRounds: jest.fn()}));
it('shows the actual device timestamp in history and preserves round detail navigation', async () => {
  notifyManager.setNotifyFunction(fn => {
    act(fn);
  });
  const timer = jest.spyOn(clock, 'gpsElapsedTime').mockReturnValue(1000);
  jest
    .mocked(getAgentRounds)
    .mockResolvedValue({
      receivedAt: 1000,
      batteryDevices: [
        {
          id: 'phone',
          mobileDeviceId: null,
          batteryLevel: 84,
          batteryQuality: 'AVAILABLE',
          batteryChargingStatus: 'DISCHARGING',
          stale: false,
          levelClassification: 'NORMAL',
          severity: 'NORMAL',
          batteryCapturedAt: '2026-11-02T08:00:00Z',
          batteryReceivedAt: '2026-11-02T08:00:01Z',
          evaluatedAt: '2026-11-02T08:00:02Z',
          freshUntil: '2026-11-02T08:30:00Z',
        },
      ],
      items: [
        {
          id: 'r',
          status: 'STARTED',
          plannedStartAt: '2026-11-02T23:00:00Z',
          startedAt: '2026-11-02T23:00:00Z',
          finishedAt: null,
          progress: {validated: 1, total: 3},
          outOfOrderCount: 0,
          missedCheckpointCount: 0,
          agent: {id: 'a', name: 'ALPHA'},
          round: {id: 't', name: 'Ronde détail'},
          site: {id: 's', name: 'Site'},
        },
      ],
      pagination: {page: 1, total: 1, limit: 20, totalPages: 1},
    });
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: 0}},
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AgentRoundsScreen />
    </QueryClientProvider>,
  );
  try {
    await view.findByText('Dernière mesure : 02/11/2026 08:00');
    fireEvent.press(view.getByText('Ronde détail'));
    expect(mockNavigate).toHaveBeenCalledWith('RoundDetail', {id: 'r'});
    expect(
      client.getQueryCache().findAll({queryKey: ['agentRounds']})[0].queryKey,
    ).toEqual(['agentRounds', 'a', 'c', 'u', 'COMPANY_ADMIN']);
  } finally {
    cleanup();
    client.clear();
    timer.mockRestore();
    notifyManager.setNotifyFunction(fn => fn());
  }
}, 20000);
