import { http } from './http';
import type { ScanNotificationMode } from '../types/api';

export async function getNotificationPreferences() {
  const response = await http.get<{ scanNotificationMode: ScanNotificationMode }>('/notification-preferences');
  return response.data;
}

export async function updateNotificationPreferences(scanNotificationMode: ScanNotificationMode) {
  const response = await http.put<{ scanNotificationMode: ScanNotificationMode }>('/notification-preferences', {
    scanNotificationMode,
  });
  return response.data;
}
