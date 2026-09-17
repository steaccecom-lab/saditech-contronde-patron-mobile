import {connectSocket, disconnectSocket} from '../src/services/socketService';
import {useAuthStore} from '../src/stores/authStore';
import type {QueryClient} from '@tanstack/react-query';
const handlers: Record<string, (...args: unknown[]) => void> = {};
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: (name: string, fn: (...args: unknown[]) => void) => {
      handlers[name] = fn;
    },
    removeAllListeners: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
  })),
}));
jest.mock('../src/config/env', () => ({
  env: {SOCKET_URL: 'https://test.invalid'},
}));
beforeEach(() => {
  jest.useFakeTimers();
  useAuthStore.setState({
    accessToken: 'token',
    user: {
      id: 'u',
      companyId: 'c',
      fullName: 'User',
      email: 'test@example.test',
      roleType: 'COMPANY_ADMIN',
      permissions: ['dashboard.read'],
    },
  });
});
afterEach(() => {
  disconnectSocket();
  jest.useRealTimers();
});
it('also refreshes on the existing Patron completion notification', () => {
  const invalidateQueries = jest.fn().mockResolvedValue(undefined);
  connectSocket({invalidateQueries} as unknown as QueryClient);
  handlers['patron.round.finished']({
    eventId: 'finish-gps',
    eventType: 'ROUND_FINISHED',
  });
  jest.advanceTimersByTime(1000);
  expect(invalidateQueries).toHaveBeenCalledWith(
    {queryKey: ['liveGps']},
    {cancelRefetch: false},
  );
});
it('coalesces location bursts and does not cancel the current snapshot', () => {
  const invalidateQueries = jest.fn().mockResolvedValue(undefined);
  connectSocket({invalidateQueries} as unknown as QueryClient);
  for (let i = 0; i < 20; i++) {
    handlers['agent.location.updated']();
  }
  jest.advanceTimersByTime(1000);
  expect(invalidateQueries).toHaveBeenCalledTimes(1);
  expect(invalidateQueries).toHaveBeenCalledWith(
    {queryKey: ['liveGps']},
    {cancelRefetch: false},
  );
});
it('refreshes on reconnect and round progress/end', () => {
  const invalidateQueries = jest.fn().mockResolvedValue(undefined);
  connectSocket({invalidateQueries} as unknown as QueryClient);
  for (const event of ['connect', 'round.scan.created', 'round.finished']) {
    handlers[event]();
    jest.advanceTimersByTime(1000);
  }
  expect(invalidateQueries).toHaveBeenCalledTimes(3);
});
it('clears pending GPS refreshes and private cache on identity change', () => {
  const client = {
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    cancelQueries: jest.fn().mockResolvedValue(undefined),
    removeQueries: jest.fn(),
  };
  connectSocket(client as unknown as QueryClient);
  handlers['agent.location.updated']();
  useAuthStore.setState({user: null});
  jest.advanceTimersByTime(1000);
  expect(client.removeQueries).toHaveBeenCalledWith({queryKey: ['liveGps']});
  expect(client.invalidateQueries).not.toHaveBeenCalled();
});
it('refreshes again when a GPS event arrives during an older snapshot', async () => {
  let finish!: () => void;
  const invalidateQueries = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  connectSocket({
    invalidateQueries,
    isFetching: () => 1,
  } as unknown as QueryClient);
  handlers['agent.location.updated']();
  jest.advanceTimersByTime(1000);
  finish();
  await Promise.resolve();
  expect(invalidateQueries).toHaveBeenCalledTimes(2);
});
