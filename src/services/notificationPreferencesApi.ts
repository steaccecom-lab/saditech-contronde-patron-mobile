import {http} from './http';
import type {ScanNotificationMode} from '../types/api';

export async function getNotificationPreferences() {
  const response = await http.get<{
    scanNotificationMode: ScanNotificationMode;
    batteryAlertsEnabled?: boolean;
  }>('/notification-preferences');
  return response.data;
}

export async function updateNotificationPreferences(
  scanNotificationMode: ScanNotificationMode,
) {
  const response = await http.put<{
    scanNotificationMode: ScanNotificationMode;
    batteryAlertsEnabled?: boolean;
  }>('/notification-preferences', {
    scanNotificationMode,
  });
  return response.data;
}

export async function updateBatteryPreference(batteryAlertsEnabled: boolean) {
  return (
    await http.put<{
      scanNotificationMode: ScanNotificationMode;
      batteryAlertsEnabled: boolean;
    }>('/notification-preferences', {batteryAlertsEnabled})
  ).data;
}
