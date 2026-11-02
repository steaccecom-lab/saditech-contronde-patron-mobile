import {
  agentGpsPresentation,
  type GpsSnapshot,
} from '../src/utils/agentGpsPresentation';
import {
  agentReadScope,
  agentsQueryKey,
  liveGpsQueryKey,
} from '../src/query/agentsQuery';
import type {User} from '../src/types/api';
const at = '2026-11-02T08:00:00.000Z';
const snapshot: GpsSnapshot = {
  serverTime: at,
  receivedAt: 1000,
  items: [
    {
      agentId: 'a',
      companyId: 'c',
      siteId: 'site',
      sessionId: 'session',
      scheduledRoundId: 'r',
      agentName: 'Agent',
      siteName: 'Site',
      roundName: 'Ronde',
      startedAt: at,
      finishedAt: null,
      mode: 'ROUND',
      endsAt: null,
      progress: {validated: 1, total: 3},
      lastCheckpoint: null,
      nextCheckpoint: null,
      seenAt: at,
      position: {latitude: 33, longitude: -7, accuracy: 10, capturedAt: at},
      status: 'LIVE',
    },
  ],
};
it('ages real positions from the existing server/monotonic clock rules', () => {
  const date = jest.spyOn(Date, 'now').mockReturnValue(0);
  expect(agentGpsPresentation('a', 'c', snapshot, 1000, false)).toBe('RECENT');
  expect(agentGpsPresentation('a', 'c', snapshot, 46000, false)).toBe('OLD');
  expect(agentGpsPresentation('a', 'c', snapshot, 121000, false)).toBe(
    'UNAVAILABLE',
  );
  date.mockRestore();
});
it.each([
  undefined,
  {...snapshot, items: []},
  {...snapshot, items: [{...snapshot.items[0], position: null}]},
  {
    ...snapshot,
    items: [
      {
        ...snapshot.items[0],
        position: {
          ...snapshot.items[0].position!,
          capturedAt: '2050-01-01T00:00:00Z',
        },
      },
    ],
  },
])('does not invent a position for missing or invalid data', data => {
  expect(agentGpsPresentation('a', 'c', data, 1000, false)).toBe('UNAVAILABLE');
});
it('honors server staleness and does not call stale GPS a disconnected phone', () => {
  expect(
    agentGpsPresentation(
      'a',
      'c',
      {...snapshot, items: [{...snapshot.items[0], status: 'STALE'}]},
      1000,
      false,
    ),
  ).toBe('OLD');
});
it('hides GPS on failures or for another company, agent or site', () => {
  expect(agentGpsPresentation('a', 'c', snapshot, 1000, true)).toBe(
    'UNAVAILABLE',
  );
  expect(agentGpsPresentation('b', 'c', snapshot, 1000, false)).toBe(
    'UNAVAILABLE',
  );
  expect(agentGpsPresentation('a', 'other', snapshot, 1000, false)).toBe(
    'UNAVAILABLE',
  );
  expect(agentGpsPresentation('a', 'c', snapshot, 1000, false, 'other')).toBe(
    'UNAVAILABLE',
  );
  expect(
    agentGpsPresentation('a', 'c', snapshot, 1000, false, undefined, ['other']),
  ).toBe('UNAVAILABLE');
});
it('excludes an expired post-round window and combines multiple sessions without inventing a best position', () => {
  const expired = {
    ...snapshot.items[0],
    mode: 'POST_ROUND' as const,
    endsAt: at,
  };
  expect(
    agentGpsPresentation(
      'a',
      'c',
      {...snapshot, items: [expired]},
      1000,
      false,
    ),
  ).toBe('UNAVAILABLE');
  expect(
    agentGpsPresentation(
      'a',
      'c',
      {...snapshot, items: [expired, snapshot.items[0]]},
      1000,
      false,
    ),
  ).toBe('RECENT');
});
it('keys agent snapshots by identity, filters and known scope, and lets list and map share GPS', () => {
  const user = {id: 'u', companyId: 'c', roleType: 'SUPERVISOR'} as User;
  const filter = {search: 'Ali', period: '7d' as const};
  const key = agentsQueryKey(user, filter, ['a', 'b']);
  expect(key).toEqual(agentsQueryKey(user, filter, ['b', 'a']));
  expect(key).not.toEqual(agentsQueryKey(user, filter, ['a']));
  expect(key).not.toEqual(
    agentsQueryKey({...user, companyId: 'other'}, filter, ['a', 'b']),
  );
  expect(key).not.toEqual(
    agentsQueryKey(user, {...filter, search: 'Omar'}, ['a', 'b']),
  );
  const scope = agentReadScope(user, ['a', 'b']);
  expect(liveGpsQueryKey('c:u', scope)).toEqual(['liveGps', 'c:u', scope]);
  expect(liveGpsQueryKey('c:u')).toEqual(['liveGps', 'c:u']);
});
