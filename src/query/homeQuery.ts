import type {User} from '../types/api';
import {agentReadScope, liveGpsQueryKey} from './agentsQuery';

/** Keep the existing invalidation prefixes; never share private snapshots. */
export function homeQueryKeys(
  user: User,
  siteId?: string,
  sites?: readonly string[],
) {
  const scope = {
    userId: user.id,
    companyId: user.companyId,
    readScope: agentReadScope(user, sites),
    permissions: [...user.permissions].sort(),
    siteId: siteId ?? null,
  };
  return {
    dashboard: ['dashboard', scope] as const,
    pending: ['rounds', 'home-pending', scope] as const,
    gps: [
      ...liveGpsQueryKey(`${user.companyId}:${user.id}`, scope.readScope),
      {siteId: scope.siteId},
    ] as const,
  };
}

export const accessDenied = (error: unknown) =>
  [401, 403, 404].includes(
    (error as {response?: {status?: number}} | null)?.response?.status ?? 0,
  );

/** A missing/invalid server count is unknown, never an invented zero. */
export function serverCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export async function authorizedHomeRead<T>(
  load: () => Promise<T>,
  clear: () => void,
) {
  try {
    return await load();
  } catch (error) {
    // A later network error must not revive a snapshot rejected by the server.
    if (accessDenied(error)) {
      clear();
    }
    throw error;
  }
}
