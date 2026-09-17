import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {AgentsScreen} from '../src/screens/AgentsScreen';
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: () => ({
    data: {pages: []},
    isLoading: false,
    isError: false,
  }),
}));
jest.mock('@react-navigation/native', () => ({
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
  fireEvent.press(view.getByText('Liste des agents'));
  expect(view.getByPlaceholderText('Recherche par nom').props.value).toBe(
    'BOUCHTA',
  );
});
