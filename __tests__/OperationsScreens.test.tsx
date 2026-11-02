import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {RoundsScreen} from '../src/screens/RoundsScreen';
import {getRounds} from '../src/services/patronApi';
const mockInfinite = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (options: unknown) => {
    mockInfinite(options);
    return {data: {pages: []}, isPending: false};
  },
  useQuery: (options: {queryKey: string[]}) =>
    options.queryKey[0] === 'sites'
      ? {data: [], isSuccess: true}
      : {
          data: {
            summary: {completedToday: 3, late: 2, missed: 1},
            generatedAt: '2026-09-19T10:00:00Z',
            liveActivity: [],
          },
        },
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
    ['En attente', 'PLANNED'],
    ['En cours', 'STARTED'],
    ['Terminées', 'FINISHED'],
    ['En retard', 'LATE'],
    ['Manquées', 'MISSED'],
  ]) {
    fireEvent.press(view.getByText(label));
    expect(lastQuery().queryKey[1]).toMatchObject({period: '7d', status});
    lastQuery().queryFn({pageParam: 1});
    expect(getRounds).toHaveBeenLastCalledWith(
      {
        page: 1,
        limit: 20,
        period: '7d',
        status,
        siteId: undefined,
        from: undefined,
        to: undefined,
      },
      undefined,
    );
  }
  fireEvent.press(view.getByText("Aujourd'hui"));
  expect(lastQuery().queryKey[1]).toMatchObject({
    period: 'today',
    status: 'MISSED',
  });
  fireEvent.press(view.getByText('Manquées'));
  expect(lastQuery().queryKey[1].status).toBeNull();
});
