import {http} from './http';
import {gpsElapsedTime} from './gpsClock';
import type {
  AgentsResponse,
  DashboardResponse,
  PeriodFilter,
  RoundDetail,
  RoundsResponse,
  RoundStatus,
  SiteItem,
} from '../types/api';

export type ListRoundsParams = {
  page?: number;
  limit?: number;
  period?: PeriodFilter;
  from?: string;
  to?: string;
  status?: RoundStatus;
  siteId?: string;
  agentId?: string;
  search?: string;
};

export async function getDashboard() {
  const response = await http.get<DashboardResponse>('/patron/dashboard');
  return response.data;
}

export async function getRounds(
  params: ListRoundsParams,
  signal?: AbortSignal,
): Promise<RoundsResponse> {
  const response = await http.get<RoundsResponse>('/patron/rounds', {
    params,
    ...(signal ? {signal} : {}),
  });
  return response.data;
}

export async function getRoundDetail(id: string) {
  const response = await http.get<RoundDetail>(`/patron/rounds/${id}`);
  return response.data;
}

export async function getAgents(
  params: {
    page?: number;
    limit?: number;
    period?: PeriodFilter;
    siteId?: string;
    search?: string;
  },
  signal?: AbortSignal,
): Promise<AgentsResponse> {
  const response = await http.get<AgentsResponse>('/patron/agents', {
    params,
    ...(signal ? {signal} : {}),
  });
  return {...response.data, receivedAt: gpsElapsedTime()};
}

export async function getAgentRounds(
  agentId: string,
  params: ListRoundsParams,
  signal?: AbortSignal,
): Promise<RoundsResponse> {
  const response = await http.get<RoundsResponse>(
    `/patron/agents/${agentId}/rounds`,
    {params, ...(signal ? {signal} : {})},
  );
  return {...response.data, receivedAt: gpsElapsedTime()};
}

export async function getSites(
  options?: {includeInactive?: boolean},
  signal?: AbortSignal,
): Promise<SiteItem[]> {
  const response = await http.get<{sites: SiteItem[]}>('/sites', {
    params: options?.includeInactive ? {} : {status: 'ACTIVE'},
    ...(signal ? {signal} : {}),
  });
  return response.data.sites;
}
