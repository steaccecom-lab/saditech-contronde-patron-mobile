import React from 'react';
import {AppState, FlatList, RefreshControl} from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {AxiosError} from 'axios';
import {AgentsScreen} from '../src/screens/AgentsScreen';
import {getAgents, getSites} from '../src/services/patronApi';
import {getLiveAgents} from '../src/services/liveGpsApi';
import * as clock from '../src/services/gpsClock';
import type {AgentItem, AgentsResponse, User} from '../src/types/api';
import type {GpsSnapshot} from '../src/utils/agentGpsPresentation';

const mockNavigate = jest.fn();
let mockUser: User | null;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: mockUser}),
}));
jest.mock('../src/services/patronApi', () => ({
  getAgents: jest.fn(),
  getSites: jest.fn(),
}));
jest.mock('../src/services/liveGpsApi', () => ({
  ...jest.requireActual('../src/services/liveGpsApi'),
  getLiveAgents: jest.fn(),
}));
jest.mock('../src/components/LiveAgentsMap', () => ({
  LiveAgentsMap: () => {
    const R = require('react');
    const {Text} = require('react-native');
    return R.createElement(Text, null, 'Carte GPS existante');
  },
}));
const at = '2026-11-02T08:00:00Z';
const admin: User = {
  id: 'u',
  companyId: 'c',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Patron',
  email: 'p@test.local',
  permissions: ['dashboard.read'],
};
const sites = [
  {id: 's1', name: 'Site A', status: 'ACTIVE'},
  {id: 's2', name: 'Site B', status: 'ACTIVE'},
];
const agent: AgentItem = {
  id: 'a',
  name: 'ALPHA',
  email: 'a@test.local',
  batteryDevices: [
    {
      id: 'phone-a',
      mobileDeviceId: null,
      batteryLevel: 84,
      batteryQuality: 'AVAILABLE',
      batteryChargingStatus: 'DISCHARGING',
      batteryCapturedAt: at,
      batteryReceivedAt: at,
      levelClassification: 'NORMAL',
      evaluatedAt: at,
      freshUntil: '2026-11-02T08:01:00Z',
      stale: false,
      severity: 'NORMAL',
    },
  ],
  lastRound: {
    scheduledRoundId: 'r1',
    roundName: 'Ronde de nuit',
    siteName: 'Site A',
    status: 'STARTED',
    plannedStartAt: '2026-11-02T23:00:00Z',
    startedAt: at,
    finishedAt: null,
    progress: {validated: 1, total: 3},
    outOfOrderCount: 0,
  },
};
const gps: GpsSnapshot = {
  receivedAt: 1000,
  serverTime: at,
  items: [
    {
      agentId: 'a',
      companyId: 'c',
      siteId: 's1',
      sessionId: 'session',
      startedAt: at,
      finishedAt: null,
      mode: 'ROUND',
      endsAt: null,
      agentName: 'ALPHA',
      siteName: 'Site A',
      roundName: 'Nuit',
      progress: {validated: 1, total: 3},
      lastCheckpoint: null,
      nextCheckpoint: null,
      seenAt: at,
      position: {latitude: 33, longitude: -7, accuracy: 10, capturedAt: at},
      status: 'LIVE',
    },
  ],
};
let elapsed = 1000;
const reply = (
  items: AgentItem[],
  page = 1,
  total = items.length,
  receivedAt = 1000,
): AgentsResponse => ({
  items,
  receivedAt,
  pagination: {page, limit: 20, total, totalPages: Math.ceil(total / 20)},
});
const clients: QueryClient[] = [];
function screen() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: 0}},
  });
  clients.push(client);
  const element = () => (
    <QueryClientProvider client={client}>
      <AgentsScreen />
    </QueryClientProvider>
  );
  const view = render(element());
  return {
    ...view,
    client,
    changeUser: (user: User | null) => {
      mockUser = user;
      view.rerender(element());
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return {resolve, promise};
}
function forbidden() {
  return new AxiosError('Forbidden', '', undefined, null, {
    status: 403,
    statusText: '',
    data: {},
    headers: {},
    config: {} as never,
  });
}
beforeAll(() =>
  notifyManager.setNotifyFunction(fn => {
    act(fn);
  }),
);
afterAll(() => notifyManager.setNotifyFunction(fn => fn()));
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  elapsed = 1000;
  AppState.currentState = 'active';
  jest.spyOn(clock, 'gpsElapsedTime').mockImplementation(() => elapsed);
  jest.mocked(getSites).mockResolvedValue(sites);
  jest.mocked(getAgents).mockResolvedValue(reply([agent]));
  jest.mocked(getLiveAgents).mockResolvedValue(gps);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  jest.restoreAllMocks();
});

it('shows the real context, battery and GPS, and navigates to history without inventing counts or presence', async () => {
  const view = screen();
  await view.findByText('ALPHA');
  await view.findByText('GPS · Position récente');
  expect(
    view.getByLabelText('Site de la dernière ronde : Site A'),
  ).toBeTruthy();
  expect(view.getByText('84 %')).toBeTruthy();
  expect(view.queryByText(/En ligne|4G|5G|terminées\/prévues/)).toBeNull();
  fireEvent.press(view.getByText('ALPHA'));
  expect(mockNavigate).toHaveBeenCalledWith('AgentRounds', {
    agentId: 'a',
    agentName: 'ALPHA',
  });
  expect(getAgents).toHaveBeenCalledWith(
    expect.objectContaining({page: 1, limit: 20, period: '7d'}),
    expect.anything(),
  );
}, 20000);
it('combines server search, site and period filters without filtering the server result locally', async () => {
  const view = screen();
  await view.findByText('ALPHA');
  fireEvent.changeText(view.getByLabelText('Rechercher un agent'), 'Omar');
  fireEvent.press(view.getByLabelText('Filtrer les agents par site'));
  fireEvent.press(await view.findByLabelText('Site : Site B'));
  fireEvent.press(view.getByText("Aujourd'hui"));
  await waitFor(() =>
    expect(getAgents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'Omar',
        siteId: 's2',
        period: 'today',
        page: 1,
      }),
      expect.anything(),
    ),
  );
  await view.findByText('ALPHA');
});
it('keeps search and filters across map/list switches, with list queries paused while hidden', async () => {
  const view = screen();
  await view.findByText('ALPHA');
  fireEvent.changeText(view.getByLabelText('Rechercher un agent'), 'ALI');
  await waitFor(() =>
    expect(getAgents).toHaveBeenLastCalledWith(
      expect.objectContaining({search: 'ALI'}),
      expect.anything(),
    ),
  );
  fireEvent.press(view.getByText('Carte'));
  expect(view.getByText('Carte GPS existante')).toBeTruthy();
  const agentsQuery = view.client
    .getQueryCache()
    .findAll({queryKey: ['agents']})
    .find(q => q.getObserversCount() > 0)!;
  expect(agentsQuery.isActive()).toBe(false);
  fireEvent.press(view.getByText('Liste'));
  expect(view.getByLabelText('Rechercher un agent').props.value).toBe('ALI');
});
it('handles missing battery and round information without inferring location or connection', async () => {
  jest
    .mocked(getAgents)
    .mockResolvedValue(
      reply([{...agent, batteryDevices: [], lastRound: null}]),
    );
  jest.mocked(getLiveAgents).mockResolvedValue({...gps, items: []});
  const view = screen();
  await view.findByText('ALPHA');
  expect(view.getByLabelText('Batterie indisponible')).toBeTruthy();
  expect(view.getByText('Aucune ronde sur cette période.')).toBeTruthy();
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
  expect(view.queryByText('0 %')).toBeNull();
});
it('shows old readings per device and preserves the relationship between level and freshness', async () => {
  jest.mocked(getAgents).mockResolvedValue(
    reply([
      {
        ...agent,
        batteryDevices: [
          agent.batteryDevices![0],
          {
            ...agent.batteryDevices![0],
            id: 'phone-b',
            batteryLevel: 8,
            stale: true,
          },
        ],
      },
    ]),
  );
  const view = screen();
  await view.findByText('ALPHA');
  expect(
    within(view.getByLabelText('Appareil phone-a')).getByText('84 %'),
  ).toBeTruthy();
  const old = within(view.getByLabelText('Appareil phone-b'));
  expect(old.getByText('8 % · ancienne')).toBeTruthy();
  expect(
    old.getByLabelText('Dernier niveau : 8 %. Mesure ancienne'),
  ).toBeTruthy();
});
it('shows old GPS independently from the agent last-round status', async () => {
  jest
    .mocked(getLiveAgents)
    .mockResolvedValue({...gps, items: [{...gps.items[0], status: 'STALE'}]});
  const view = screen();
  await view.findByText('GPS · Position ancienne');
  expect(view.queryByText(/En ligne|Offline/)).toBeNull();
});
it('keeps each page receipt time while paging and de-duplicates identities', async () => {
  const page = deferred<AgentsResponse>();
  jest
    .mocked(getAgents)
    .mockImplementation(params =>
      params.page === 2 ? page.promise : Promise.resolve(reply([agent], 1, 21)),
    );
  const view = screen();
  await view.findByText('ALPHA');
  elapsed = 100000;
  const list = () =>
    view.UNSAFE_getAllByType(FlatList).find(node => node.props.onEndReached)!;
  fireEvent(list(), 'onEndReached');
  fireEvent(list(), 'onEndReached');
  await waitFor(() =>
    expect(
      jest.mocked(getAgents).mock.calls.filter(([params]) => params.page === 2),
    ).toHaveLength(1),
  );
  const second = {
    ...agent,
    id: 'b',
    name: 'BETA',
    batteryDevices: [{...agent.batteryDevices![0], id: 'phone-b'}],
  };
  await act(async () => {
    page.resolve(reply([second], 2, 21, 100000));
  });
  await view.findByText('BETA');
  expect(
    within(view.getByLabelText('Appareil phone-a')).getByText(
      '84 % · ancienne',
    ),
  ).toBeTruthy();
  expect(
    within(view.getByLabelText('Appareil phone-b')).getByLabelText(
      '84 %. Mesure récente',
    ),
  ).toBeTruthy();
});
it('does not display cached agents after a forbidden refresh', async () => {
  const view = screen();
  await view.findByText('ALPHA');
  jest.mocked(getAgents).mockRejectedValue(forbidden());
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText(
    "Vous n'avez pas l'autorisation de consulter ces agents.",
  );
  expect(view.queryByText('ALPHA')).toBeNull();
});
it('keeps loaded agents on a failed page and retries only on request', async () => {
  jest
    .mocked(getAgents)
    .mockImplementation(params =>
      params.page === 2
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(reply([agent], 1, 21)),
    );
  const view = screen();
  await view.findByText('ALPHA');
  const list = () =>
    view.UNSAFE_getAllByType(FlatList).find(node => node.props.onEndReached)!;
  fireEvent(list(), 'onEndReached');
  await view.findByText("La suite des agents n'a pas pu être chargée.");
  const count = jest.mocked(getAgents).mock.calls.length;
  fireEvent(list(), 'onEndReached');
  expect(getAgents).toHaveBeenCalledTimes(count);
  expect(view.getByText('ALPHA')).toBeTruthy();
  jest
    .mocked(getAgents)
    .mockImplementation(params =>
      Promise.resolve(
        reply([agent, {...agent, id: 'b', name: 'BETA'}], params.page, 21),
      ),
    );
  fireEvent.press(view.getByText('Réessayer'));
  await view.findByText('BETA');
  expect(view.getAllByText('ALPHA')).toHaveLength(1);
});
it('does not request GPS without permission and retains an explicit map permission error', async () => {
  mockUser = {...admin, permissions: []};
  const view = screen();
  await view.findByText('ALPHA');
  expect(getLiveAgents).not.toHaveBeenCalled();
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
  fireEvent.press(view.getByText('Carte'));
  expect(
    view.getByText("Vous n'avez pas l'autorisation de consulter la carte."),
  ).toBeTruthy();
});
it('hides known GPS data after a permission failure and never revives it on a later offline failure', async () => {
  const view = screen();
  await view.findByText('GPS · Position récente');
  jest.mocked(getLiveAgents).mockRejectedValue(forbidden());
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText('GPS · Position indisponible');
  jest.mocked(getLiveAgents).mockRejectedValue(new Error('offline'));
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await waitFor(() =>
    expect(view.queryByText('GPS · Position récente')).toBeNull(),
  );
});
it('keeps supervisor queries closed when no accessible sites are available', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  jest.mocked(getSites).mockResolvedValue([]);
  const view = screen();
  await view.findByText('Aucun site ne vous est actuellement affecté.');
  expect(getAgents).not.toHaveBeenCalled();
  expect(getLiveAgents).not.toHaveBeenCalled();
});
it('partitions known site scopes and removes old snapshots while the new scope loads', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen();
  await view.findByText('ALPHA');
  const next = deferred<AgentsResponse>();
  jest.mocked(getSites).mockResolvedValue([sites[1]]);
  jest.mocked(getAgents).mockReturnValue(next.promise);
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText('Chargement des agents');
  expect(view.queryByText('ALPHA')).toBeNull();
  await act(async () => next.resolve(reply([{...agent, name: 'PÉRIMÈTRE B'}])));
  await view.findByText('PÉRIMÈTRE B');
});
it('isolates company changes and resets the local search', async () => {
  const view = screen();
  await view.findByText('ALPHA');
  fireEvent.changeText(view.getByLabelText('Rechercher un agent'), 'Ancien');
  jest
    .mocked(getAgents)
    .mockResolvedValue(reply([{...agent, id: 'new', name: 'SOCIÉTÉ B'}]));
  view.changeUser({...admin, id: 'u-b', companyId: 'c-b'});
  await view.findByText('SOCIÉTÉ B');
  expect(view.queryByText('ALPHA')).toBeNull();
  expect(view.getByLabelText('Rechercher un agent').props.value).toBe('');
  const keys = view.client
    .getQueryCache()
    .findAll({queryKey: ['agents']})
    .map(query => query.queryKey[1]);
  expect(keys).toContainEqual(
    expect.objectContaining({companyId: 'c-b', userId: 'u-b', search: ''}),
  );
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
});
it.each([
  null,
  {...admin, roleType: 'AGENT' as const},
  {...admin, companyId: null},
])('does not load private data for an unauthorized identity', user => {
  mockUser = user;
  screen();
  expect(getAgents).not.toHaveBeenCalled();
  expect(getLiveAgents).not.toHaveBeenCalled();
  expect(getSites).not.toHaveBeenCalled();
});
