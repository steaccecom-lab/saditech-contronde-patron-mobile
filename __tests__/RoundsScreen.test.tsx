import React from 'react';
import {FlatList, RefreshControl} from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {AxiosError} from 'axios';
import {RoundsScreen} from '../src/screens/RoundsScreen';
import {getRounds, getSites} from '../src/services/patronApi';
import type {RoundItem, RoundsResponse, User} from '../src/types/api';

const mockNavigate = jest.fn();
let mockUser: User | null;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: {user: User | null}) => unknown) =>
    selector({user: mockUser}),
}));
jest.mock('../src/services/patronApi', () => ({
  getRounds: jest.fn(),
  getSites: jest.fn(),
}));
const admin: User = {
  id: 'admin',
  companyId: 'company-a',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Patron',
  email: 'p@test.local',
  permissions: ['scheduled_rounds.read', 'dashboard.read'],
};
const sites = [
  {id: 'site-a', name: 'Site Central', status: 'ACTIVE'},
  {id: 'site-b', name: 'Ancien site', status: 'INACTIVE'},
];
const round: RoundItem = {
  id: 'r1',
  status: 'STARTED',
  plannedStartAt: '2026-11-02T23:00:00.000Z',
  startedAt: '2026-11-02T23:00:00.000Z',
  finishedAt: null,
  progress: {validated: 1, total: 4},
  outOfOrderCount: 0,
  missedCheckpointCount: 0,
  agent: {id: 'a1', name: 'Agent A'},
  site: {id: 'site-a', name: 'Site Central'},
  round: {id: 't1', name: 'Ronde principale'},
};
const reply = (
  items: RoundItem[],
  page = 1,
  total = items.length,
): RoundsResponse => ({
  items,
  pagination: {page, limit: 20, total, totalPages: Math.ceil(total / 20)},
});
const clients: QueryClient[] = [];
function screen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false},
    },
  });
  clients.push(client);
  const element = () => (
    <QueryClientProvider client={client}>
      <RoundsScreen />
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
  return {promise, resolve};
}
function forbidden() {
  return new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 403,
    statusText: 'Forbidden',
    data: {},
    headers: {},
    config: {} as never,
  });
}
beforeAll(() =>
  notifyManager.setNotifyFunction(callback => {
    act(callback);
  }),
);
afterAll(() => notifyManager.setNotifyFunction(callback => callback()));
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {...admin};
  jest.mocked(getSites).mockResolvedValue(sites);
  jest.mocked(getRounds).mockResolvedValue(reply([round]));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  jest.restoreAllMocks();
});

it('requests the first page from the server, displays its total and opens the unchanged detail route', async () => {
  jest.mocked(getRounds).mockResolvedValue(reply([round], 1, 21));
  const view = screen();
  await view.findByText('Ronde principale');
  expect(getRounds).toHaveBeenCalledWith(
    expect.objectContaining({
      page: 1,
      limit: 20,
      period: 'today',
      status: undefined,
      siteId: undefined,
    }),
    expect.anything(),
  );
  expect(view.getByText('21 rondes')).toBeTruthy();
  expect(view.getByText('Tous les sites')).toBeTruthy();
  fireEvent.press(view.getByText('Ronde principale'));
  expect(mockNavigate).toHaveBeenCalledWith('RoundDetail', {id: 'r1'});
  expect(view.queryByText('Nouvelle ronde')).toBeNull();
}, 20000);
it('combines site, period and real STARTED status on the server including an inactive historical site', async () => {
  const view = screen();
  await view.findByText('Ronde principale');
  fireEvent.press(view.getByLabelText('Filtrer par site'));
  fireEvent.press(await view.findByLabelText('Site : Ancien site'));
  fireEvent.press(view.getByText('7 jours'));
  fireEvent.press(view.getByText('En cours'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        period: '7d',
        status: 'STARTED',
        siteId: 'site-b',
      }),
      expect.anything(),
    ),
  );
  expect(getSites).toHaveBeenCalledWith(
    {includeInactive: true},
    expect.anything(),
  );
});
it('validates custom dates before querying and preserves the combined filters', async () => {
  const view = screen();
  await view.findByText('Ronde principale');
  fireEvent.press(view.getByText('En retard'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'LATE'}),
      expect.anything(),
    ),
  );
  const before = jest.mocked(getRounds).mock.calls.length;
  fireEvent.press(view.getByLabelText('Choisir une période personnalisée'));
  fireEvent.changeText(view.getByLabelText('Date de début'), '31/02/2026');
  fireEvent.changeText(view.getByLabelText('Date de fin'), '22/03/2026');
  fireEvent.press(view.getByText('Appliquer la période'));
  expect(view.getByRole('alert')).toBeTruthy();
  expect(getRounds).toHaveBeenCalledTimes(before);
  fireEvent.changeText(view.getByLabelText('Date de début'), '22/03/2026');
  fireEvent.changeText(view.getByLabelText('Date de fin'), '23/03/2026');
  fireEvent.press(view.getByText('Appliquer la période'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'LATE',
        period: 'custom',
        from: '2026-03-22T00:00:00.000Z',
        to: '2026-03-24T00:00:00.000Z',
      }),
      expect.anything(),
    ),
  );
  expect(view.getByText('22/03/2026 – 23/03/2026')).toBeTruthy();
});
it('cancels an uncommitted date edit and can reset all filters', async () => {
  const view = screen();
  await view.findByText('Ronde principale');
  fireEvent.press(view.getByText('7 jours'));
  fireEvent.press(view.getByLabelText('Choisir une période personnalisée'));
  fireEvent.changeText(view.getByLabelText('Date de début'), '01/01/2020');
  fireEvent.press(view.getByText('Fermer'));
  expect(view.getByText('7 jours').parent?.props).toBeDefined();
  fireEvent.press(view.getByText('Réinitialiser les filtres'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({
        period: 'today',
        status: undefined,
        siteId: undefined,
        from: undefined,
        to: undefined,
      }),
      expect.anything(),
    ),
  );
  expect(view.queryByText('01/01/2020')).toBeNull();
});
it('shows incomplete server results without inventing an INCOMPLETE API filter', async () => {
  jest
    .mocked(getRounds)
    .mockResolvedValue(
      reply([{...round, status: 'FINISHED', finalStatus: 'INCOMPLETE'}]),
    );
  const view = screen();
  await view.findByText('Incomplète');
  fireEvent.press(view.getByText('Terminées'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'FINISHED'}),
      expect.anything(),
    ),
  );
  expect(
    view.getByText(
      'Les rondes incomplètes restent identifiées dans les résultats.',
    ),
  ).toBeTruthy();
  expect(
    jest
      .mocked(getRounds)
      .mock.calls.some(([params]) => String(params.status) === 'INCOMPLETE'),
  ).toBe(false);
});
it('paginates without duplicate rows or concurrent duplicate requests, and restarts page one on filter change', async () => {
  const next = deferred<RoundsResponse>();
  jest
    .mocked(getRounds)
    .mockImplementation(params =>
      params.page === 2 ? next.promise : Promise.resolve(reply([round], 1, 21)),
    );
  const view = screen();
  await view.findByText('Ronde principale');
  const list = () =>
    view.UNSAFE_getAllByType(FlatList).find(node => node.props.onEndReached)!;
  fireEvent(list(), 'onEndReached');
  fireEvent(list(), 'onEndReached');
  await waitFor(() =>
    expect(
      jest.mocked(getRounds).mock.calls.filter(([params]) => params.page === 2),
    ).toHaveLength(1),
  );
  await act(async () => {
    next.resolve(
      reply(
        [
          round,
          {...round, id: 'r2', round: {id: 't2', name: 'Deuxième ronde'}},
        ],
        2,
        21,
      ),
    );
  });
  await view.findByText('Deuxième ronde');
  expect(view.getAllByText('Ronde principale')).toHaveLength(1);
  fireEvent.press(view.getByText('Manquées'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({page: 1, status: 'MISSED'}),
      expect.anything(),
    ),
  );
  expect(view.queryByText('Deuxième ronde')).toBeNull();
});
it('keeps the first page on a pagination error and waits for a manual retry', async () => {
  jest
    .mocked(getRounds)
    .mockImplementation(params =>
      params.page === 2
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(reply([round], 1, 21)),
    );
  const view = screen();
  await view.findByText('Ronde principale');
  const list = () =>
    view.UNSAFE_getAllByType(FlatList).find(node => node.props.onEndReached)!;
  fireEvent(list(), 'onEndReached');
  await view.findByText("La suite des rondes n'a pas pu être chargée.");
  expect(view.getByText('Ronde principale')).toBeTruthy();
  const calls = jest.mocked(getRounds).mock.calls.length;
  fireEvent(list(), 'onEndReached');
  expect(getRounds).toHaveBeenCalledTimes(calls);
  jest
    .mocked(getRounds)
    .mockImplementation(params =>
      Promise.resolve(
        reply(
          [{...round, id: 'r2', round: {id: 't2', name: 'Ronde suivante'}}],
          params.page,
          21,
        ),
      ),
    );
  fireEvent.press(view.getByText('Réessayer'));
  await view.findByText('Ronde suivante');
});
it('never requests rounds for a supervisor without any accessible site', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  jest.mocked(getSites).mockResolvedValue([]);
  const view = screen();
  await view.findByText(
    'Aucun site ne vous est actuellement affecté. Contactez votre administrateur.',
  );
  expect(getRounds).not.toHaveBeenCalled();
});
it('keeps supervisor scope closed until its sites have been checked', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const pending = deferred<typeof sites>();
  jest.mocked(getSites).mockReturnValue(pending.promise);
  const view = screen();
  expect(view.getByText('Chargement des rondes')).toBeTruthy();
  expect(getRounds).not.toHaveBeenCalled();
  await act(async () => {
    pending.resolve(sites);
  });
  await view.findByText('Ronde principale');
});
it('blocks a supervisor on a sites error and can retry without bypassing scope', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  jest.mocked(getSites).mockRejectedValue(forbidden());
  const view = screen();
  await view.findByText('Impossible de vérifier les sites de votre périmètre.');
  expect(getRounds).not.toHaveBeenCalled();
  jest.mocked(getSites).mockResolvedValue(sites);
  fireEvent.press(view.getByText('Réessayer'));
  await view.findByText('Ronde principale');
});
it('keeps admin rounds available if site-list permission is absent', async () => {
  jest.mocked(getSites).mockRejectedValue(forbidden());
  const view = screen();
  await view.findByText('Ronde principale');
  fireEvent.press(view.getByLabelText('Filtrer par site'));
  await view.findByText('La liste des sites est indisponible.');
  fireEvent.press(view.getAllByText('Tous les sites').at(-1)!);
  expect(view.getByText('Ronde principale')).toBeTruthy();
});
it('hides cached rounds after a forbidden refresh', async () => {
  const view = screen();
  await view.findByText('Ronde principale');
  jest.mocked(getRounds).mockRejectedValue(forbidden());
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText(
    "Vous n'avez pas l'autorisation de consulter ces rondes.",
  );
  expect(view.queryByText('Ronde principale')).toBeNull();
  expect(view.queryByText('1 ronde')).toBeNull();
});
it('hides cached supervisor data when site assignments disappear', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen();
  await view.findByText('Ronde principale');
  jest.mocked(getSites).mockResolvedValue([]);
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText(
    'Aucun site ne vous est actuellement affecté. Contactez votre administrateur.',
  );
  expect(view.queryByText('Ronde principale')).toBeNull();
});
it('does not display an old all-sites snapshot while a reduced supervisor scope is loading', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen();
  await view.findByText('Ronde principale');
  const reduced = deferred<RoundsResponse>();
  jest.mocked(getSites).mockResolvedValue([sites[1]]);
  jest.mocked(getRounds).mockReturnValue(reduced.promise);
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText('Chargement des rondes');
  expect(view.queryByText('Ronde principale')).toBeNull();
  await act(async () => {
    reduced.resolve(
      reply([
        {
          ...round,
          id: 'r-b',
          round: {id: 't-b', name: 'Ronde du périmètre réduit'},
        },
      ]),
    );
  });
  await view.findByText('Ronde du périmètre réduit');
});
it('closes a selected site removed from scope while other sites remain accessible', async () => {
  mockUser = {...admin, roleType: 'SUPERVISOR'};
  const view = screen();
  await view.findByText('Ronde principale');
  fireEvent.press(view.getByLabelText('Filtrer par site'));
  fireEvent.press(await view.findByLabelText('Site : Site Central'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({siteId: 'site-a'}),
      expect.anything(),
    ),
  );
  jest.mocked(getSites).mockResolvedValue([sites[1]]);
  fireEvent(view.UNSAFE_getByType(RefreshControl), 'onRefresh');
  await view.findByText(
    "Ce site n'est plus disponible dans votre périmètre. Choisissez Tous les sites.",
  );
  expect(view.queryByText('Ronde principale')).toBeNull();
  jest.mocked(getRounds).mockResolvedValue(
    reply([
      {
        ...round,
        id: 'r-b',
        round: {id: 't-b', name: 'Ronde autorisée B'},
        site: {id: 'site-b', name: 'Ancien site'},
      },
    ]),
  );
  fireEvent.press(view.getByLabelText('Filtrer par site'));
  const options = view.getAllByText('Tous les sites');
  fireEvent.press(options[options.length - 1]);
  await view.findByText('Ronde autorisée B');
});
it('isolates accounts, resets filters and rejects display of a late response from the previous company', async () => {
  const old = deferred<RoundsResponse>();
  jest.mocked(getRounds).mockImplementation(params =>
    params.status === 'LATE'
      ? old.promise
      : Promise.resolve(
          reply([
            {
              ...round,
              round: {
                id: 't',
                name:
                  mockUser?.companyId === 'company-b'
                    ? 'Société B'
                    : 'Société A',
              },
            },
          ]),
        ),
  );
  const view = screen();
  await view.findByText('Société A');
  fireEvent.press(view.getByText('En retard'));
  await waitFor(() =>
    expect(getRounds).toHaveBeenLastCalledWith(
      expect.objectContaining({status: 'LATE'}),
      expect.anything(),
    ),
  );
  view.changeUser({...admin, id: 'admin-b', companyId: 'company-b'});
  await view.findByText('Société B');
  await act(async () => {
    old.resolve(
      reply([{...round, round: {id: 'old', name: 'Ancienne réponse privée'}}]),
    );
  });
  expect(view.queryByText('Ancienne réponse privée')).toBeNull();
  expect(view.queryByText('Réinitialiser les filtres')).toBeNull();
  const keys = view.client
    .getQueryCache()
    .findAll({queryKey: ['rounds']})
    .map(query => query.queryKey[1]);
  expect(keys).toContainEqual(
    expect.objectContaining({
      companyId: 'company-b',
      userId: 'admin-b',
      status: null,
    }),
  );
});
it.each([
  null,
  {...admin, roleType: 'AGENT' as const},
  {...admin, companyId: null},
])('does not request private data for an unauthorized identity', user => {
  mockUser = user;
  screen();
  expect(getSites).not.toHaveBeenCalled();
  expect(getRounds).not.toHaveBeenCalled();
});
