import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {AgentsScreen} from '../src/screens/AgentsScreen';
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => ({
    data: {pages: []},
    isLoading: false,
    isError: false,
  }),
  useQuery: () => ({data: [], isSuccess: true}),
  useQueryClient: () => ({}),
}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        id: 'u',
        companyId: 'c',
        roleType: 'COMPANY_ADMIN',
        permissions: ['dashboard.read'],
      },
    }),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({navigate: jest.fn()}),
}));
jest.mock('../src/services/patronApi', () => ({getAgents: jest.fn()}));
jest.mock('../src/components/LiveAgentsMap', () => ({
  LiveAgentsMap: () => null,
}));
it('preserves the agent search when switching between list and map', () => {
  const view = render(<AgentsScreen />);
  fireEvent.changeText(
    view.getByPlaceholderText('Recherche par nom'),
    'BOUCHTA',
  );
  fireEvent.press(view.getByText('Carte'));
  fireEvent.press(view.getByText('Liste'));
  expect(view.getByPlaceholderText('Recherche par nom').props.value).toBe(
    'BOUCHTA',
  );
});
