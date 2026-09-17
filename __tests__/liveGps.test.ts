import {
  liveStatus,
  visibleLiveAgents,
  type LiveAgent,
} from '../src/services/liveGpsApi';
jest.mock('../src/services/http', () => ({http: {get: jest.fn()}}));
const now = Date.parse('2026-09-16T12:00:00Z');
const agent: LiveAgent = {
  agentId: 'a',
  sessionId: 's',
  companyId: 'c',
  siteId: 'site',
  agentName: 'Agent',
  siteName: 'Site',
  roundName: 'Ronde',
  startedAt: new Date(now - 60000).toISOString(),
  finishedAt: null,
  mode: 'ROUND',
  endsAt: null,
  progress: {validated: 3, total: 5},
  lastCheckpoint: {name: 'SILO', scannedAt: new Date(now).toISOString()},
  nextCheckpoint: 'PORTAIL',
  seenAt: new Date(now).toISOString(),
  position: {
    latitude: 33,
    longitude: -7,
    accuracy: 14,
    capturedAt: new Date(now).toISOString(),
  },
  status: 'LIVE',
};
it.each([
  [0, 'LIVE'],
  [44999, 'LIVE'],
  [45000, 'STALE'],
  [119999, 'STALE'],
  [120000, 'OFFLINE'],
])('ages marker after %s ms', (age, status) => {
  expect(liveStatus(agent, now + Number(age))).toBe(status);
});
it('disconnected device retains position but is offline', () => {
  expect(liveStatus(agent, now, true)).toBe('OFFLINE');
  expect(agent.position?.latitude).toBe(33);
});
it('missing permission/location does not invent a marker', () => {
  expect(liveStatus({...agent, position: null}, now)).toBe('OFFLINE');
});
it('excludes expired post rounds, retains ongoing rounds and other sites', () => {
  expect(
    visibleLiveAgents(
      [
        agent,
        {...agent, agentId: 'b', siteId: 'other'},
        {...agent, mode: 'POST_ROUND', endsAt: new Date(now).toISOString()},
      ],
      now,
    ),
  ).toHaveLength(2);
});
it('preserves post-round label independently of round completion', () => {
  const post = {
    ...agent,
    mode: 'POST_ROUND' as const,
    finishedAt: new Date(now).toISOString(),
    endsAt: new Date(now + 900000).toISOString(),
  };
  expect(visibleLiveAgents([post], now)[0]).toMatchObject({
    mode: 'POST_ROUND',
    progress: {validated: 3, total: 5},
    lastCheckpoint: {name: 'SILO'},
  });
});
