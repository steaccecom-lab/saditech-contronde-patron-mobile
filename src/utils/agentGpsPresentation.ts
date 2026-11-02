import {
  liveStatus,
  visibleLiveAgents,
  type LiveAgent,
} from '../services/liveGpsApi';
import {gpsServerNow} from '../services/gpsClock';

export type GpsSnapshot = {
  items: LiveAgent[];
  serverTime: string;
  receivedAt: number;
};
export type GpsIndicator = 'RECENT' | 'OLD' | 'UNAVAILABLE';

/** A position indicator, never a phone presence/connection status. */
export function agentGpsPresentation(
  agentId: string,
  companyId: string,
  snapshot: GpsSnapshot | undefined,
  elapsed: number,
  failed: boolean,
  siteId?: string,
  allowedSiteIds?: readonly string[],
): GpsIndicator {
  if (failed || !snapshot || !Number.isFinite(snapshot.receivedAt)) {
    return 'UNAVAILABLE';
  }
  const now = gpsServerNow(snapshot.serverTime, snapshot.receivedAt, elapsed);
  if (!Number.isFinite(now)) {
    return 'UNAVAILABLE';
  }
  const candidates = visibleLiveAgents(snapshot.items, now).filter(
    row =>
      row.companyId === companyId &&
      row.agentId === agentId &&
      (!siteId || row.siteId === siteId) &&
      (!allowedSiteIds || allowedSiteIds.includes(row.siteId)) &&
      row.position &&
      Number.isFinite(row.position.latitude) &&
      Number.isFinite(row.position.longitude) &&
      Number.isFinite(Date.parse(row.position.capturedAt)),
  );
  if (
    candidates.some(
      row => row.status === 'LIVE' && liveStatus(row, now) === 'LIVE',
    )
  ) {
    return 'RECENT';
  }
  return candidates.some(
    row =>
      (row.status === 'LIVE' || row.status === 'STALE') &&
      liveStatus(row, now) !== 'OFFLINE',
  )
    ? 'OLD'
    : 'UNAVAILABLE';
}
