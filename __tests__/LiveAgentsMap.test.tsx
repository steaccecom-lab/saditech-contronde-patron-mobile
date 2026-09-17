import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {LiveAgentsMap} from '../src/components/LiveAgentsMap';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {http} from '../src/services/http';
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({setQueryData: jest.fn()})),
}));
jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));
jest.mock('../src/services/http', () => ({http: {get: jest.fn()}}));
jest.mock('../src/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({user: {id: 'u', companyId: 'c'}}),
}));
jest.mock('react-native-webview', () => {
  const R = require('react');
  const {View} = require('react-native');
  return {
    WebView: R.forwardRef((props: object, ref: unknown) => {
      R.useImperativeHandle(ref, () => ({injectJavaScript: jest.fn()}));
      return <View testID="map" {...props} />;
    }),
  };
});
const now = new Date().toISOString();
it('erases cached positions on authorization denial before a later network error', async () => {
  const setQueryData = jest.fn();
  jest.mocked(useQueryClient).mockReturnValue({setQueryData} as never);
  render(<LiveAgentsMap />);
  const options = jest.mocked(useQuery).mock.calls.at(-1)![0];
  const fetch = options.queryFn as (context: {
    signal: AbortSignal;
  }) => Promise<unknown>;
  const forbidden = {response: {status: 403}};
  jest
    .mocked(http.get)
    .mockRejectedValueOnce(forbidden)
    .mockRejectedValueOnce(new Error('offline'));
  await expect(fetch({signal: new AbortController().signal})).rejects.toBe(
    forbidden,
  );
  expect(setQueryData).toHaveBeenCalledWith(
    ['liveGps', 'c:u'],
    expect.objectContaining({items: []}),
  );
  await expect(fetch({signal: new AbortController().signal})).rejects.toThrow(
    'offline',
  );
  expect(setQueryData).toHaveBeenCalledTimes(1);
});
const first = {
  agentId: 'a',
  sessionId: 's',
  companyId: 'c',
  siteId: 'site',
  agentName: 'BOUCHTA',
  siteName: 'AIT AMMAR',
  roundName: 'Ronde 18h',
  startedAt: now,
  finishedAt: null,
  mode: 'ROUND',
  endsAt: null,
  progress: {validated: 3, total: 5},
  lastCheckpoint: {name: 'SILO1', scannedAt: now},
  nextCheckpoint: 'CHATEAUX',
  seenAt: now,
  position: {latitude: 33, longitude: -7, accuracy: 14, capturedAt: now},
  status: 'LIVE',
};
beforeEach(() => {
  jest.mocked(useQuery).mockReturnValue({
    data: {
      items: [
        first,
        {
          ...first,
          agentId: 'b',
          agentName: 'ALI',
          siteId: 'other',
          siteName: 'AUTRE',
        },
      ],
      serverTime: now,
    },
    dataUpdatedAt: Date.now(),
    isError: false,
    isPending: false,
  } as never);
});
it('renders map and multiple agents, checkpoint and progress', () => {
  const view = render(<LiveAgentsMap />);
  expect(view.getByTestId('map')).toBeTruthy();
  expect(view.getByText('BOUCHTA · AIT AMMAR')).toBeTruthy();
  expect(view.getByText('ALI · AUTRE')).toBeTruthy();
  expect(view.getAllByText('Ronde 18h · 3/5 checkpoints')).toHaveLength(2);
  expect(view.getAllByText(/Dernier point : SILO1/)).toHaveLength(2);
});
it('filters sites and marker click opens details', () => {
  const view = render(<LiveAgentsMap />);
  fireEvent.press(view.getByText('AIT AMMAR'));
  expect(view.queryByText('ALI · AUTRE')).toBeNull();
  fireEvent(view.getByTestId('map'), 'message', {
    nativeEvent: {data: '{"id":"a"}'},
  });
  expect(view.getByText('Prochain point : CHATEAUX')).toBeTruthy();
});
it('labels post-round without claiming a running round', () => {
  jest.mocked(useQuery).mockReturnValue({
    data: {
      items: [
        {
          ...first,
          mode: 'POST_ROUND',
          finishedAt: now,
          endsAt: new Date(Date.now() + 900000).toISOString(),
        },
      ],
      serverTime: now,
    },
    dataUpdatedAt: Date.now(),
  } as never);
  const view = render(<LiveAgentsMap />);
  expect(view.getByText('Suivi post-ronde')).toBeTruthy();
});
it('removes a marker after server confirms round end', () => {
  jest.mocked(useQuery).mockReturnValue({
    data: {items: [], serverTime: now},
    dataUpdatedAt: Date.now(),
  } as never);
  const view = render(<LiveAgentsMap />);
  expect(
    view.getByText('Aucun agent en ronde ou en suivi post-ronde.'),
  ).toBeTruthy();
});
