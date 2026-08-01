export type RoleType = 'COMPANY_ADMIN' | 'SUPERVISOR' | 'AGENT' | 'SUPER_ADMIN';
export type RoundStatus = 'PLANNED' | 'LATE' | 'STARTED' | 'FINISHED' | 'MISSED' | 'CANCELLED';
export type ScanNotificationMode = 'ALL_SCANS' | 'OUT_OF_ORDER_ONLY' | 'DISABLED';
export type PeriodFilter = 'today' | '7d' | '30d' | 'custom';

export type User = {
  id: string;
  companyId: string | null;
  roleType: RoleType;
  fullName: string;
  email: string;
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type PatronSummary = {
  completedToday: number;
  late: number;
  missed: number;
};

export type PatronScanActivity = {
  eventId?: string;
  eventType?: string;
  scanId: string;
  sessionId: string;
  scheduledRoundId: string | null;
  scannedAt: string;
  isOutOfOrder: boolean;
  expectedOrder: number;
  scanOrder: number;
  agent: { id: string; name: string };
  site: { id: string; name: string };
  round: { id: string; name: string };
  checkpoint: { id: string; name: string };
  scan?: {
    scannedAt: string;
    scanOrder: number;
    expectedOrder: number;
    isOutOfOrder: boolean;
    status: string;
  };
};

export type DashboardResponse = {
  generatedAt: string;
  timezone: string;
  summary: PatronSummary;
  liveActivity: PatronScanActivity[];
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RoundItem = {
  id: string;
  status: RoundStatus;
  plannedStartAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: { validated: number; total: number };
  outOfOrderCount: number;
  missedCheckpointCount: number;
  agent: { id: string; name: string } | null;
  site: { id: string; name: string };
  round: { id: string; name: string };
};

export type SiteItem = {
  id: string;
  name: string;
  address?: string | null;
  status: string;
};

export type RoundsResponse = {
  items: RoundItem[];
  pagination: Pagination;
};

export type RoundDetail = RoundItem & {
  durationSeconds: number | null;
  agent: { id: string; name: string; email?: string } | null;
  checkpoints: Array<{
    checkpointId: string;
    name: string;
    expectedOrder: number;
    status: 'VALIDATED' | 'MISSED' | 'PENDING';
    scannedAt: string | null;
    scanOrder: number | null;
    isOutOfOrder: boolean;
  }>;
  anomalies: Array<{
    id: string;
    type: string;
    createdAt: string;
    checkpointId: string | null;
    checkpointName: string | null;
  }>;
};

export type AgentItem = {
  id: string;
  name: string;
  email: string;
  lastRound: {
    scheduledRoundId: string;
    roundName: string;
    siteName: string;
    status: RoundStatus;
    plannedStartAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    progress: { validated: number; total: number };
    outOfOrderCount: number;
  } | null;
};

export type AgentsResponse = {
  items: AgentItem[];
  pagination: Pagination;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  scheduledRoundId: string | null;
  siteId: string | null;
};

export type NotificationsResponse = { items: NotificationItem[]; pagination: Pagination };
