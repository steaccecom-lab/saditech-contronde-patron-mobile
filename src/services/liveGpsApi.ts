import {http} from './http';
import {gpsElapsedTime} from './gpsClock';
export type LiveAgent = {
  agentId: string;
  sessionId: string;
  scheduledRoundId?: string | null;
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
  if (
    !Number.isFinite(age) ||
    !Number.isFinite(Date.parse(agent.seenAt)) ||
    age < -5000
  )
    {return 'OFFLINE';}
  return age < 45000 ? 'LIVE' : age < 120000 ? 'STALE' : 'OFFLINE';
}
export const liveLabel = {
  LIVE: 'Live',
  STALE: 'Stale · Position ancienne',
  OFFLINE: 'Offline',
};
export function visibleLiveAgents(agents: LiveAgent[], now: number) {
  return agents.filter(
    agent =>
      agent.mode === 'ROUND' ||
      (agent.endsAt && Date.parse(agent.endsAt) > now),
  );
}
export function positionAge(capturedAt: string, now: number) {
  const seconds = Math.max(
    0,
    Math.floor((now - Date.parse(capturedAt)) / 1000),
  );
  if (!Number.isFinite(seconds)) {return 'heure inconnue';}
  return seconds < 60
    ? `il y a ${seconds} s`
    : seconds < 3600
    ? `il y a ${Math.floor(seconds / 60)} min`
    : `il y a ${Math.floor(seconds / 3600)} h`;
}
