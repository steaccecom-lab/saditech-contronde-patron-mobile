import moment from 'moment-timezone';
import type {BatteryDevice} from '../types/battery';

/** Classification/deadline come from the API. elapsedMs is monotonic since receipt. */
export function batteryPresentation(device: BatteryDevice, elapsedMs?: number) {
  const captured = device.batteryCapturedAt
    ? Date.parse(device.batteryCapturedAt)
    : NaN;
  const evaluated = device.evaluatedAt ? Date.parse(device.evaluatedAt) : NaN;
  const until = device.freshUntil ? Date.parse(device.freshUntil) : NaN;
  const usableTime =
    Number.isFinite(captured) &&
    Number.isFinite(evaluated) &&
    Number.isFinite(until) &&
    elapsedMs !== undefined &&
    Number.isFinite(elapsedMs) &&
    elapsedMs >= 0 &&
    typeof device.stale === 'boolean';
  const freshness = !Number.isFinite(captured)
    ? 'UNAVAILABLE'
    : device.stale
    ? 'OLD'
    : usableTime
    ? evaluated + elapsedMs! >= until
      ? 'OLD'
      : 'RECENT'
    : 'UNAVAILABLE';
  const valid =
    device.batteryQuality === 'AVAILABLE' &&
    Number.isInteger(device.batteryLevel) &&
    device.batteryLevel !== null &&
    device.batteryLevel >= 0 &&
    device.batteryLevel <= 100;
  const classification =
    valid &&
    ['NORMAL', 'LOW', 'CRITICAL'].includes(device.levelClassification ?? '')
      ? device.levelClassification!
      : 'UNAVAILABLE';
  const age = {
    RECENT: 'Mesure récente',
    OLD: 'Mesure ancienne',
    UNAVAILABLE: 'Fraîcheur indisponible',
  }[freshness];
  return {
    text: valid
      ? `${freshness === 'RECENT' ? '' : 'Dernier niveau : '}${
          device.batteryLevel
        } %`
      : 'Batterie indisponible',
    age,
    freshness,
    stale: freshness !== 'RECENT',
    classification,
    capturedLabel: Number.isFinite(captured)
      ? moment(captured).tz('Africa/Casablanca').format('DD/MM/YYYY HH:mm')
      : '—',
  };
}
