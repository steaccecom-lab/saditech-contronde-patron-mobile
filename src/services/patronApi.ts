import { http } from './http';
import type {
  AgentsResponse,
  DashboardResponse,
  PeriodFilter,
  RoundDetail,
  RoundsResponse,
  RoundStatus,
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

export async function getRounds(params: ListRoundsParams) {
  const response = await http.get<RoundsResponse>('/patron/rounds', { params });
  return response.data;
}

export async function getRoundDetail(id: string) {
  const response = await http.get<RoundDetail>(`/patron/rounds/${id}`);
  return response.data;
}

export async function getAgents(params: { page?: number; limit?: number; period?: PeriodFilter; siteId?: string; search?: string }) {
  const response = await http.get<AgentsResponse>('/patron/agents', { params });
  return response.data;
}

export async function getAgentRounds(agentId: string, params: ListRoundsParams) {
  const response = await http.get<RoundsResponse>(`/patron/agents/${agentId}/rounds`, { params });
  return response.data;
}
