export type BatteryDevice = {
  id: string;
  mobileDeviceId: string | null;
  batteryLevel: number | null;
  batteryChargingStatus: 'CHARGING' | 'DISCHARGING' | 'FULL' | 'UNKNOWN';
  batteryQuality: 'AVAILABLE' | 'UNAVAILABLE';
  batteryCapturedAt: string | null;
  batteryReceivedAt: string | null;
  stale: boolean;
  levelClassification?: 'NORMAL' | 'LOW' | 'CRITICAL' | 'UNAVAILABLE';
  evaluatedAt?: string;
  freshUntil?: string | null;
  severity: 'NORMAL' | 'LOW' | 'CRITICAL' | 'UNKNOWN';
};
