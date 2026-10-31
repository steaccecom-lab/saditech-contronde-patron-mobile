export type BatteryDevice = {
  id: string;
  mobileDeviceId: string | null;
  batteryLevel: number | null;
  batteryChargingStatus: 'CHARGING' | 'DISCHARGING' | 'FULL' | 'UNKNOWN';
  batteryQuality: 'AVAILABLE' | 'UNAVAILABLE';
  batteryCapturedAt: string | null;
  batteryReceivedAt: string | null;
  stale: boolean;
  severity: 'NORMAL' | 'LOW' | 'CRITICAL' | 'UNKNOWN';
};
