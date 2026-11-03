import {http, type SessionRequestConfig} from './http';
import {getOrCreateDeviceId} from './secureTokenStorage';
import {captureSession} from '../stores/authStore';

export async function registerDevice(fcmToken: string): Promise<void> {
  const owner = captureSession();
  const deviceId = await getOrCreateDeviceId();
  await http.post(
    '/mobile-devices/register',
    {
      deviceId,
      platform: 'ANDROID',
      fcmToken,
      appType: 'PATRON',
      supportsBatteryAlerts: true,
    },
    {_session: owner} as SessionRequestConfig,
  );
}

export async function revokeCurrentDevice(
  config?: SessionRequestConfig,
): Promise<void> {
  const owner = captureSession();
  const deviceId = await getOrCreateDeviceId();
  await http.delete('/mobile-devices/current', {
    _session: owner,
    ...config,
    data: {deviceId},
  } as SessionRequestConfig);
}
