import type {PeriodFilter, User} from '../types/api';

export type RoundFilter = {
  label: string;
  period?: PeriodFilter;
  status?: string;
};

type PrivateQueryUser = Pick<User, 'id' | 'companyId' | 'roleType'>;

export function roundsQueryKey(user: PrivateQueryUser, filter: RoundFilter) {
  return [
    'rounds',
    {
      userId: user.id,
      companyId: user.companyId,
      roleType: user.roleType,
      period: filter.period ?? null,
      status: filter.status ?? null,
      limit: 20,
    },
  ] as const;
}

export function supervisorSitesQueryKey(user: PrivateQueryUser) {
  return [
    'sites',
    {
      userId: user.id,
      companyId: user.companyId,
      roleType: user.roleType,
      status: 'ACTIVE',
    },
  ] as const;
}
