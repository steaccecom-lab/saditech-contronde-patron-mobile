import {NativeModules} from 'react-native';
export function gpsElapsedTime() {
  try {
    const value: unknown = NativeModules.GpsClock?.now();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  } catch {
    /* Development/test environments may not expose the Android clock. */
  }
  return performance.now();
}
export function gpsServerNow(
  serverTime: string,
  receivedAt: number,
  elapsed: number,
) {
  return Date.parse(serverTime) + Math.max(0, elapsed - receivedAt);
}
