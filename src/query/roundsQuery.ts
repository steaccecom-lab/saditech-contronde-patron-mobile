import moment from 'moment-timezone';
import type {PeriodFilter, RoundStatus, User} from '../types/api';

export type RoundFilter = {
  label?: string;
  period?: PeriodFilter;
  status?: RoundStatus;
  siteId?: string;
  from?: string;
  to?: string;
};

type PrivateQueryUser = Pick<User, 'id' | 'companyId' | 'roleType'>;

export function roundsQueryKey(
  user: PrivateQueryUser,
  filter: RoundFilter,
  accessibleSiteIds?: readonly string[],
) {
  return [
    'rounds',
    {
      userId: user.id,
      companyId: user.companyId,
      roleType: user.roleType,
      accessibleSiteIds: accessibleSiteIds
        ? [...accessibleSiteIds].sort()
        : null,
      period: filter.period ?? null,
      status: filter.status ?? null,
      siteId: filter.siteId ?? null,
      from: filter.from ?? null,
      to: filter.to ?? null,
      limit: 20,
    },
  ] as const;
}

export function supervisorSitesQueryKey(
  user: PrivateQueryUser,
  includeInactive = false,
) {
  return [
    'sites',
    {
      userId: user.id,
      companyId: user.companyId,
      roleType: user.roleType,
      status: includeInactive ? null : 'ACTIVE',
    },
  ] as const;
}

/** The rounds API encodes planned civil dates in UTC fields, not UTC instants.
 * The displayed end date is inclusive; the API upper bound is exclusive. */
export function customRoundPeriod(fromText: string, toText: string) {
  const from = moment.utc(fromText, 'DD/MM/YYYY', true);
  const to = moment.utc(toText, 'DD/MM/YYYY', true);
  if (!from.isValid() || !to.isValid() || from.isAfter(to)) {
    return null;
  }
  return {from: from.toISOString(), to: to.add(1, 'day').toISOString()};
}
