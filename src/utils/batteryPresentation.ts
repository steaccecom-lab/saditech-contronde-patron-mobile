import type {BatteryDevice} from '../types/battery';
export function batteryPresentation(device: BatteryDevice, now = Date.now()) {
  const captured = device.batteryCapturedAt
    ? Date.parse(device.batteryCapturedAt)
    : NaN;
  const received = device.batteryReceivedAt
    ? Date.parse(device.batteryReceivedAt)
    : NaN;
  const stale =
    device.stale ||
    !Number.isFinite(captured) ||
    !Number.isFinite(received) ||
    now - captured >= 1_800_000 ||
    now - received >= 1_800_000 ||
    captured > now + 5000;
  const valid =
    device.batteryQuality === 'AVAILABLE' &&
    Number.isInteger(device.batteryLevel) &&
    device.batteryLevel !== null &&
    device.batteryLevel >= 0 &&
    device.batteryLevel <= 100;
  const status =
    {
      CHARGING: '⚡ En charge',
      DISCHARGING: 'En décharge',
      FULL: 'Charge complète',
      UNKNOWN: 'Charge inconnue',
    }[device.batteryChargingStatus] ?? 'Charge inconnue';
  const minutes = Number.isFinite(captured)
    ? Math.max(0, Math.floor((now - captured) / 60000))
    : null;
  const age =
    minutes === null
      ? 'Date de mesure indisponible'
      : minutes < 1
      ? 'Mesuré à l’instant'
      : 'Mesuré il y a ' + minutes + ' min';
  return {
    text: valid
      ? device.batteryLevel + ' % · ' + status
      : 'Batterie indisponible',
    age: age + (stale && minutes !== null ? ' — Mesure ancienne' : ''),
    severity:
      !valid || stale
        ? 'UNKNOWN'
        : ['CHARGING', 'FULL'].includes(device.batteryChargingStatus)
        ? 'NORMAL'
        : device.severity,
    stale,
  };
}
