import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {RoundsScreen} from '../src/screens/RoundsScreen';
import {HomeScreen} from '../src/screens/HomeScreen';
import {getRounds} from '../src/services/patronApi';
const mockInfinite = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (options: unknown) => {
    mockInfinite(options);
    return {data: {pages: []}, isPending: false};
  },
  useQuery: () => ({
    data: {
      summary: {completedToday: 3, late: 2, missed: 1},
      generatedAt: '2026-09-19T10:00:00Z',
      liveActivity: [],
    },
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: () => ({
    id: 'admin',
    companyId: 'company',
    roleType: 'COMPANY_ADMIN',
  }),
}));
jest.mock('../src/services/patronApi', () => ({
  getRounds: jest.fn(),
  getSites: jest.fn(),
  getDashboard: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());
function lastQuery() {
  return mockInfinite.mock.calls[mockInfinite.mock.calls.length - 1][0];
}
it('keeps today and 7 days with independent status filters and first-page query keys', () => {
  const view = render(<RoundsScreen />);
  expect(view.queryByText('30 jours')).toBeNull();
  expect(lastQuery().queryKey[1]).toMatchObject({
    period: 'today',
    status: null,
  });
  fireEvent.press(view.getByText('7 jours'));
  for (const [label, status] of [
    ['Planifiées', 'PLANNED'],
    ['Terminées', 'FINISHED'],
    ['Retard', 'LATE'],
    ['Manquées', 'MISSED'],
  ]) {
    fireEvent.press(view.getByText(label));
    expect(lastQuery().queryKey[1]).toMatchObject({period: '7d', status});
    lastQuery().queryFn({pageParam: 1});
    expect(getRounds).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      period: '7d',
      status,
    });
  }
  fireEvent.press(view.getByText("Aujourd'hui"));
  expect(lastQuery().queryKey[1]).toMatchObject({
    period: 'today',
    status: 'MISSED',
  });
  fireEvent.press(view.getByText('Manquées'));
  expect(lastQuery().queryKey[1].status).toBeNull();
});
it('displays server daily metrics, snapshot time and a realtime empty state', () => {
  const view = render(<HomeScreen />);
  for (const label of [
    "Terminées aujourd'hui",
    "En retard aujourd'hui",
    "Manquées aujourd'hui",
    'Activité en temps réel',
  ])
    expect(view.getByText(label)).toBeTruthy();
  for (const n of ['3', '2', '1']) expect(view.getByText(n)).toBeTruthy();
  expect(view.getByText(/Dernière synchronisation/)).toBeTruthy();
  expect(view.getByText(/Les prochains scans/)).toBeTruthy();
});
