import type {PeriodFilter, User} from '../types/api';

export type AgentFilters = {
  search: string;
  period: PeriodFilter;
  siteId?: string;
};
export function agentReadScope(
  user: User,
  accessibleSiteIds?: readonly string[],
) {
  return JSON.stringify({
    role: user.roleType,
    sites: accessibleSiteIds ? [...accessibleSiteIds].sort() : null,
  });
}
export function agentsQueryKey(
  user: User,
  filter: AgentFilters,
  accessibleSiteIds?: readonly string[],
) {
  return [
    'agents',
    {
      userId: user.id,
      companyId: user.companyId,
      scope: agentReadScope(user, accessibleSiteIds),
      search: filter.search.trim(),
      period: filter.period,
      siteId: filter.siteId ?? null,
      limit: 20,
    },
  ] as const;
}
/** Optional scope retains the existing standalone map key for other callers. */
export function liveGpsQueryKey(owner: string, readScope?: string) {
  return readScope ? ['liveGps', owner, readScope] : ['liveGps', owner];
}
