import {http} from './http';
import {gpsElapsedTime} from './gpsClock';
export type LiveAgent = {
  agentId: string;
  sessionId: string;
  companyId: string;
  siteId: string;
  agentName: string;
  siteName: string;
  roundName: string;
  startedAt: string;
  finishedAt: string | null;
  mode: 'ROUND' | 'POST_ROUND';
  endsAt: string | null;
  progress: {validated: number; total: number};
  lastCheckpoint: {name: string; scannedAt: string} | null;
  nextCheckpoint: string | null;
  seenAt: string | null;
  position: {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  } | null;
  status: 'LIVE' | 'STALE' | 'OFFLINE';
};
export async function getLiveAgents(siteId?: string, signal?: AbortSignal) {
  const response = (
    await http.get<{items: LiveAgent[]; serverTime: string}>('/gps/live', {
      params: {siteId},
      signal,
    })
  ).data;
  return {...response, receivedAt: gpsElapsedTime()};
}
export function liveStatus(
  agent: LiveAgent,
  now: number,
  disconnected = false,
) {
  if (
    disconnected ||
    !agent.position ||
    !agent.seenAt ||
    now - Date.parse(agent.seenAt) >= 120000
  ) {
    return 'OFFLINE';
  }
  const age = now - Date.parse(agent.position.capturedAt);
  return age < 45000 ? 'LIVE' : age < 120000 ? 'STALE' : 'OFFLINE';
}
export const liveLabel = {
  LIVE: 'Live',
  STALE: 'Position ancienne',
  OFFLINE: 'Offline',
};
export function visibleLiveAgents(agents: LiveAgent[], now: number) {
  return agents.filter(
    agent =>
      agent.mode === 'ROUND' ||
      (agent.endsAt && Date.parse(agent.endsAt) > now),
  );
}
