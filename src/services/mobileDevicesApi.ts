import { http } from './http';
import { getOrCreateDeviceId } from './secureTokenStorage';

export async function registerDevice(fcmToken: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await http.post('/mobile-devices/register', {
    deviceId,
    platform: 'ANDROID',
    fcmToken,
    appType: 'PATRON',
  });
}

export async function revokeCurrentDevice(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await http.delete('/mobile-devices/current', { data: { deviceId } });
}
