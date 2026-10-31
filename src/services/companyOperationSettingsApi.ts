import {http} from './http';

export type CompanyOperationSettings = Partial<BatterySettings> & {
  missedIfNotStartedAfterMinutes: number | null;
  roundStartToleranceMinutes: number;
  checkpointLateToleranceMinutes: number;
  maxSessionDurationMinutes: number;
  allowOutOfOrderScan: boolean;
  automaticMissedRoundDetection: boolean;
  criticalAnomalyDetection: boolean;
  notifyLateRound: boolean;
  notifyMissedRound: boolean;
  notifyCriticalAnomaly: boolean;
  notifyRoundFinished: boolean;
};
export type CompanyOperationSettingsResponse = {
  settings: CompanyOperationSettings;
  configured: boolean;
};

export async function getCompanyOperationSettings(companyId: string) {
  return (
    await http.get<CompanyOperationSettingsResponse>(
      `/company-operation-settings/${companyId}`,
    )
  ).data;
}

export async function saveCompanyOperationSettings(
  companyId: string,
  section: 'rules' | 'notifications',
  settings: CompanyOperationSettings,
) {
  // Explicit fields: never resend response metadata or legacy aliases that can
  // override the canonical values in the existing PUT handler.
  const body = {
    section,
    missedIfNotStartedAfterMinutes: settings.missedIfNotStartedAfterMinutes,
    roundStartToleranceMinutes: settings.roundStartToleranceMinutes,
    checkpointLateToleranceMinutes: settings.checkpointLateToleranceMinutes,
    maxSessionDurationMinutes: settings.maxSessionDurationMinutes,
    allowOutOfOrderScan: settings.allowOutOfOrderScan,
    automaticMissedRoundDetection: settings.automaticMissedRoundDetection,
    criticalAnomalyDetection: settings.criticalAnomalyDetection,
    notifyLateRound: settings.notifyLateRound,
    notifyMissedRound: settings.notifyMissedRound,
    notifyCriticalAnomaly: settings.notifyCriticalAnomaly,
    notifyRoundFinished: settings.notifyRoundFinished,
  };
  return (
    await http.put<CompanyOperationSettingsResponse>(
      `/company-operation-settings/${companyId}`,
      body,
    )
  ).data;
}

export type BatterySettings = {
  batteryAlertsEnabled: boolean;
  batteryLowThreshold: number;
  batteryCriticalThreshold: number;
  batteryRearmThreshold: number;
};
export async function saveBatterySettings(
  companyId: string,
  settings: BatterySettings,
) {
  return (
    await http.put<CompanyOperationSettingsResponse>(
      '/company-operation-settings/' + companyId,
      {section: 'battery', ...settings},
    )
  ).data;
}
