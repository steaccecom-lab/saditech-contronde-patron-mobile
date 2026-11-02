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
import {HomeScreen} from '../src/screens/HomeScreen';
import {MetricCard} from '../src/components/MetricCard';
import {HomeAgentCard} from '../src/components/HomeAgentCard';
import {
  getAgents,
  getDashboard,
  getRounds,
  getSites,
} from '../src/services/patronApi';
import {getLiveAgents} from '../src/services/liveGpsApi';
import * as clock from '../src/services/gpsClock';
import type {
  AgentItem,
  AgentsResponse,
  DashboardResponse,
  RoundsResponse,
  User,
} from '../src/types/api';
import type {GpsSnapshot} from '../src/utils/agentGpsPresentation';

const mockNavigate = jest.fn();
jest.setTimeout(20000);
let mockUser: User | null;
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: mockUser}),
}));
jest.mock('../src/services/patronApi', () => ({
  getAgents: jest.fn(),
  getDashboard: jest.fn(),
  getRounds: jest.fn(),
  getSites: jest.fn(),
}));
jest.mock('../src/services/liveGpsApi', () => ({
  ...jest.requireActual('../src/services/liveGpsApi'),
  getLiveAgents: jest.fn(),
}));
const at = '2026-09-19T23:15:00Z'; // 20/09 00:15 in Casablanca (before the offset transition).
const admin: User = {
  id: 'u',
  companyId: 'c',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Patron',
  email: 'p@test.local',
  permissions: ['dashboard.read', 'scheduled_rounds.read'],
};
const sites = [
  {id: 's1', name: 'Site A', status: 'ACTIVE'},
  {id: 's2', name: 'Site B', status: 'ACTIVE'},
];
const agent: AgentItem = {
  id: 'a',
  name: 'ALPHA',
  email: 'a@test.local',
  lastRound: null,
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
      freshUntil: '2026-09-19T23:45:00Z',
      stale: false,
      severity: 'NORMAL',
    },
  ],
};
const dashboard: DashboardResponse = {
  generatedAt: at,
  timezone: 'Africa/Casablanca',
  summary: {completedToday: 37, late: 12, missed: 9},
  liveActivity: [
    {
      scanId: 'scan',
      sessionId: 'session',
      scheduledRoundId: null,
      scannedAt: at,
      isOutOfOrder: true,
      expectedOrder: 1,
      scanOrder: 2,
      agent: {id: 'a', name: 'ALPHA'},
      site: {id: 's1', name: 'Site A'},
      round: {id: 'r1', name: 'Ronde de nuit'},
      checkpoint: {id: 'qr', name: 'Entrée'},
    },
  ],
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
const pending: RoundsResponse = {
  items: [],
  pagination: {page: 1, limit: 1, total: 18, totalPages: 18},
};
let elapsed = 1000;
const clients: QueryClient[] = [];
function screen() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: 0}},
  });
  clients.push(client);
  const element = () => (
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>
  );
  const view = render(element());
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return {resolve, promise};
}
const forbidden = () => ({response: {status: 403}});
const refresh = (view: ReturnType<typeof screen>) =>
  act(() => {
    view.UNSAFE_getByType(RefreshControl).props.onRefresh();
  });
const metric = (view: ReturnType<typeof screen>, label: string) =>
  view
    .UNSAFE_getAllByType(MetricCard)
    .find(item => item.props.label === label)!;
beforeAll(() =>
  notifyManager.setNotifyFunction(fn => {
    act(fn);
  }),
);
afterAll(() => notifyManager.setNotifyFunction(fn => fn()));
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  mockFocused = true;
  elapsed = 1000;
  AppState.currentState = 'active';
  jest.spyOn(clock, 'gpsElapsedTime').mockImplementation(() => elapsed);
  jest.mocked(getDashboard).mockResolvedValue(dashboard);
  jest.mocked(getRounds).mockResolvedValue(pending);
  jest.mocked(getSites).mockResolvedValue(sites);
  jest.mocked(getAgents).mockResolvedValue(reply([agent]));
  jest.mocked(getLiveAgents).mockResolvedValue(gps);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  jest.restoreAllMocks();
});

it('renders all four server counts without deriving totals from scans or list items', async () => {
  const view = screen();
  await view.findByText('37');
  await view.findByText('18');
  expect(metric(view, 'Rondes en attente').props.value).toBe(18);
  expect(metric(view, "Terminées aujourd'hui").props.value).toBe(37);
  expect(metric(view, "En retard aujourd'hui").props.value).toBe(12);
  expect(metric(view, "Manquées aujourd'hui").props.value).toBe(9);
  expect(getRounds).toHaveBeenCalledWith(
    {page: 1, limit: 1, period: 'today', status: 'PLANNED', siteId: undefined},
    expect.any(AbortSignal),
  );
  expect(getDashboard).toHaveBeenCalledWith(
    {siteId: undefined},
    expect.any(AbortSignal),
  );
  expect(metric(view, "Terminées aujourd'hui").props.detail).toBe(
    'Selon la date réelle de fin',
  );
  expect(metric(view, "En retard aujourd'hui").props.detail).toBe(
    'Selon la date planifiée',
  );
  expect(view.getByText('Situation du 20/09/2026 · Casablanca')).toBeTruthy();
  expect(view.queryByText(/Dernière synchronisation/)).toBeNull();
  expect(view.getByText('ALPHA · Entrée')).toBeTruthy();
  expect(view.getByText('! Ordre non respecté')).toBeTruthy();
  expect(view.getByText('Ronde de nuit · Site A')).toBeTruthy();
});
it('filters all endpoints on the server and never retains another site snapshot during loading', async () => {
  const view = screen();
  await view.findByText('37');
  const later = deferred<DashboardResponse>();
  jest
    .mocked(getDashboard)
    .mockImplementation(params =>
      params?.siteId ? later.promise : Promise.resolve(dashboard),
    );
  jest
    .mocked(getAgents)
    .mockImplementation(params =>
      Promise.resolve(
        reply(params.siteId ? [{...agent, id: 'b', name: 'BETA'}] : [agent]),
      ),
    );
  fireEvent.press(view.getByLabelText("Filtrer l'accueil par site"));
  fireEvent.press(view.getByLabelText('Site : Site B'));
  expect(view.queryByText('37')).toBeNull();
  await view.findByText('BETA');
  expect(getDashboard).toHaveBeenLastCalledWith(
    {siteId: 's2'},
    expect.any(AbortSignal),
  );
  expect(getRounds).toHaveBeenLastCalledWith(
    expect.objectContaining({siteId: 's2', period: 'today', status: 'PLANNED'}),
    expect.any(AbortSignal),
  );
  expect(getAgents).toHaveBeenLastCalledWith(
    {page: 1, limit: 20, period: 'today', siteId: 's2'},
    expect.any(AbortSignal),
  );
  expect(getLiveAgents).toHaveBeenLastCalledWith('s2', expect.any(AbortSignal));
  expect(view.queryByText('ALPHA')).toBeNull();
  act(() =>
    later.resolve({
      ...dashboard,
      summary: {completedToday: 5, late: 0, missed: 0},
      liveActivity: [],
    }),
  );
  await view.findByText('5');
});
it('never allocates unassigned/multi-agent occurrences or fabricates a per-agent completed/planned ratio', async () => {
  jest
    .mocked(getAgents)
    .mockResolvedValue(
      reply([agent, {...agent, id: 'b', name: 'BETA', lastRound: null}]),
    );
  const view = screen();
  await view.findByText('BETA');
  expect(view.UNSAFE_getAllByType(HomeAgentCard)).toHaveLength(2);
  expect(getRounds).toHaveBeenCalledTimes(1);
  for (const card of view.UNSAFE_getAllByType(HomeAgentCard)) {
    expect(within(card).queryByText(/terminées|prévues|18|37/)).toBeNull();
  }
  expect(view.queryByText(/En ligne|4G|5G/)).toBeNull();
  expect(view.queryByText(/terminées\/prévues/)).toBeNull();
  fireEvent.press(view.getByText('ALPHA'));
  expect(mockNavigate).toHaveBeenCalledWith('AgentRounds', {
    agentId: 'a',
    agentName: 'ALPHA',
  });
});
it('shows old battery/GPS and preserves separate phones instead of claiming current measurements', async () => {
  jest.mocked(getAgents).mockResolvedValue(
    reply([
      {
        ...agent,
        batteryDevices: [
          {...agent.batteryDevices![0], stale: true},
          {
            ...agent.batteryDevices![0],
            id: 'phone-b',
            batteryLevel: 10,
            levelClassification: 'CRITICAL',
          },
        ],
      },
    ]),
  );
  jest.mocked(getLiveAgents).mockResolvedValue({
    ...gps,
    items: gps.items.map(row => ({
      ...row,
      position: {...row.position!, capturedAt: '2026-09-19T23:14:00Z'},
    })),
  });
  const view = screen();
  await view.findByText('GPS · Position ancienne');
  const phoneA = within(view.getByLabelText('Appareil phone-a'));
  expect(phoneA.getByText('84 % · ancienne')).toBeTruthy();
  expect(
    phoneA.getByLabelText('Dernier niveau : 84 %. Mesure ancienne'),
  ).toBeTruthy();
  const phoneB = within(view.getByLabelText('Appareil phone-b'));
  expect(phoneB.getByText('10 %')).toBeTruthy();
  expect(phoneB.getByLabelText('10 %. Mesure récente')).toBeTruthy();
});
it('handles absent battery and GPS without inferring phone disconnection', async () => {
  jest
    .mocked(getAgents)
    .mockResolvedValue(reply([{...agent, batteryDevices: []}]));
  jest.mocked(getLiveAgents).mockResolvedValue({...gps, items: []});
  const view = screen();
  await view.findByLabelText('Batterie indisponible');
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
  expect(view.queryByText(/déconnecté|Hors ligne|Offline|En ligne/)).toBeNull();
});
it('ages cached measurements using server and monotonic references even if the PC clock is shifted', async () => {
  const view = screen();
  await view.findByText('GPS · Position récente');
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2050-12-31T00:00:00Z'));
  elapsed += 31 * 60000;
  view.redraw();
  expect(
    view.getByLabelText('Dernier niveau : 84 %. Mesure ancienne'),
  ).toBeTruthy();
  expect(view.getByText('84 % · ancienne')).toBeTruthy();
  expect(view.getByText('GPS · Position indisponible')).toBeTruthy();
  expect(metric(view, "Terminées aujourd'hui").props.value).toBe(37);
});
it('does not call the rounds endpoint without its permission and shows an unknown pending count', async () => {
  mockUser = {...admin, permissions: ['dashboard.read']};
  const view = screen();
  await view.findByText('37');
  expect(getRounds).not.toHaveBeenCalled();
  expect(metric(view, 'Rondes en attente').props.value).toBeNull();
  expect(view.getByText('Lecture des rondes non autorisée')).toBeTruthy();
});
it.each([
  null,
  {...admin, roleType: 'AGENT' as const},
  {...admin, companyId: null},
  {...admin, permissions: []},
])(
  'refuses an unauthenticated/unauthorized owner without reading any API',
  user => {
    mockUser = user;
    screen();
    expect(getDashboard).not.toHaveBeenCalled();
    expect(getRounds).not.toHaveBeenCalled();
    expect(getAgents).not.toHaveBeenCalled();
    expect(getLiveAgents).not.toHaveBeenCalled();
  },
);
it('waits for supervisor scope and never reads agents/counts for an empty site assignment', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  jest.mocked(getSites).mockResolvedValue([]);
  const view = screen();
  await view.findByText('Aucun site ne vous est actuellement affecté.');
  expect(getDashboard).not.toHaveBeenCalled();
  expect(getAgents).not.toHaveBeenCalled();
  expect(getRounds).not.toHaveBeenCalled();
  expect(getLiveAgents).not.toHaveBeenCalled();
});
it('resets the site on account/company changes and hides prior counters, agents and activity', async () => {
  const view = screen();
  await view.findByText('37');
  fireEvent.press(view.getByLabelText("Filtrer l'accueil par site"));
  fireEvent.press(view.getByLabelText('Site : Site A'));
  await waitFor(() =>
    expect(getDashboard).toHaveBeenLastCalledWith(
      {siteId: 's1'},
      expect.any(AbortSignal),
    ),
  );
  const other = deferred<DashboardResponse>();
  jest.mocked(getDashboard).mockReturnValue(other.promise);
  jest.mocked(getAgents).mockResolvedValue(reply([]));
  jest.mocked(getLiveAgents).mockResolvedValue({...gps, items: []});
  view.changeUser({...admin, id: 'other', companyId: 'other-company'});
  expect(view.queryByText('37')).toBeNull();
  expect(view.queryByText('ALPHA')).toBeNull();
  expect(view.queryByText('ALPHA · Entrée')).toBeNull();
  expect(view.getByText('Tous les sites')).toBeTruthy();
  await waitFor(() =>
    expect(getDashboard).toHaveBeenLastCalledWith(
      {siteId: undefined},
      expect.any(AbortSignal),
    ),
  );
  act(() =>
    other.resolve({
      ...dashboard,
      summary: {completedToday: 0, late: 0, missed: 0},
      liveActivity: [],
    }),
  );
  await view.findByText(/Les prochains scans/);
});
it('drops previous supervisor scope immediately when assignments change', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen();
  await view.findByText('37');
  const other = deferred<DashboardResponse>();
  jest.mocked(getDashboard).mockReturnValue(other.promise);
  jest.mocked(getAgents).mockReturnValue(new Promise(() => {}));
  act(() => {
    view.client.setQueryData(
      [
        'sites',
        {userId: 'u', companyId: 'c', roleType: 'SUPERVISOR', status: null},
      ],
      [sites[1]],
    );
  });
  await waitFor(() => {
    expect(view.queryByText('37')).toBeNull();
    expect(view.queryByText('ALPHA')).toBeNull();
  });
  act(() => other.resolve({...dashboard, liveActivity: []}));
});
it('removes a revoked snapshot and does not resurrect it after a subsequent network error', async () => {
  const view = screen();
  await view.findByText('37');
  jest.mocked(getDashboard).mockRejectedValue(forbidden());
  jest.mocked(getAgents).mockRejectedValue(forbidden());
  jest.mocked(getLiveAgents).mockRejectedValue(forbidden());
  jest.mocked(getRounds).mockRejectedValue(forbidden());
  refresh(view);
  await view.findByText('Accès aux indicateurs refusé.');
  expect(view.queryByText('37')).toBeNull();
  expect(view.queryByText('ALPHA')).toBeNull();
  expect(metric(view, 'Rondes en attente').props.value).toBeNull();
  jest.mocked(getDashboard).mockRejectedValue(new Error('offline'));
  jest.mocked(getAgents).mockRejectedValue(new Error('offline'));
  jest.mocked(getLiveAgents).mockRejectedValue(new Error('offline'));
  jest.mocked(getRounds).mockRejectedValue(new Error('offline'));
  refresh(view);
  await view.findByText("Impossible d'actualiser les indicateurs.");
  expect(view.queryByText('37')).toBeNull();
  expect(view.queryByText('ALPHA')).toBeNull();
  expect(view.queryByText('ALPHA · Entrée')).toBeNull();
});
it('keeps per-page battery receipt timestamps and guards duplicate pagination requests', async () => {
  jest
    .mocked(getAgents)
    .mockImplementation(params =>
      Promise.resolve(
        params.page === 1
          ? reply([agent], 1, 21)
          : reply([{...agent, id: 'b', name: 'BETA'}], 2, 21, 2000000),
      ),
    );
  const view = screen();
  await view.findByText('ALPHA');
  elapsed = 2000000;
  act(() => {
    const list = view.UNSAFE_getByType(FlatList);
    list.props.onEndReached();
    list.props.onEndReached();
  });
  await view.findByText('BETA');
  const cards = view.UNSAFE_getAllByType(HomeAgentCard);
  expect(within(cards[0]).getByText('84 % · ancienne')).toBeTruthy();
  expect(within(cards[1]).getByText('84 %')).toBeTruthy();
  expect(getAgents).toHaveBeenCalledTimes(2);
});
it('stops background/unfocused reads while retaining notification-compatible query prefixes', async () => {
  mockFocused = false;
  const view = screen();
  expect(getDashboard).not.toHaveBeenCalled();
  expect(getAgents).not.toHaveBeenCalled();
  mockFocused = true;
  view.redraw();
  await view.findByText('37');
  expect(
    view.client.getQueryCache().findAll({queryKey: ['dashboard']}),
  ).toHaveLength(1);
  expect(
    view.client.getQueryCache().findAll({queryKey: ['agents']}),
  ).toHaveLength(1);
  mockFocused = false;
  view.redraw();
  expect(
    view.client
      .getQueryCache()
      .findAll({queryKey: ['dashboard']})[0]
      .isActive(),
  ).toBe(false);
});
it('shows an empty realtime activity state independently of the agents list', async () => {
  jest.mocked(getDashboard).mockResolvedValue({...dashboard, liveActivity: []});
  const view = screen();
  await view.findByText(/Les prochains scans/);
  expect(view.getByText('Activité en temps réel')).toBeTruthy();
  expect(view.getByText('ALPHA')).toBeTruthy();
});
