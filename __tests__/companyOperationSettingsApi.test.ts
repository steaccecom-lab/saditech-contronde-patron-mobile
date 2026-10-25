import {
  getCompanyOperationSettings,
  saveCompanyOperationSettings,
  type CompanyOperationSettings,
} from '../src/services/companyOperationSettingsApi';
import {http} from '../src/services/http';
jest.mock('../src/services/http', () => ({http: {get: jest.fn(), put: jest.fn()}}));
it('uses existing scoped endpoints and excludes aliases and response metadata', async () => {
  const settings = {
    roundStartToleranceMinutes: 12,
    lateStartToleranceMinutes: 10,
    checkpointLateToleranceMinutes: 5,
    checkpointToleranceMinutes: 3,
    missedIfNotStartedAfterMinutes: null,
    maxSessionDurationMinutes: 480,
    allowOutOfOrderScan: true,
    automaticMissedRoundDetection: true,
    criticalAnomalyDetection: true,
    notifyLateRound: true,
    notifyMissedRound: true,
    notifyCriticalAnomaly: true,
    notifyRoundFinished: false,
    companyId: 'server-metadata',
    updatedAt: 'server-metadata',
    rulesConfigured: true,
  } as CompanyOperationSettings;
  jest.mocked(http.get).mockResolvedValue({data: {settings, configured: true}});
  jest.mocked(http.put).mockResolvedValue({data: {settings, configured: true}});
  await getCompanyOperationSettings('company-a');
  await saveCompanyOperationSettings('company-a', 'rules', settings);
  expect(http.get).toHaveBeenCalledWith('/company-operation-settings/company-a');
  const body = jest.mocked(http.put).mock.calls[0][1];
  expect(body).toMatchObject({
    section: 'rules',
    roundStartToleranceMinutes: 12,
    missedIfNotStartedAfterMinutes: null,
  });
  for (const key of [
    'lateStartToleranceMinutes',
    'checkpointToleranceMinutes',
    'companyId',
    'updatedAt',
    'rulesConfigured',
  ]) {
    expect(body).not.toHaveProperty(key);
  }
});
