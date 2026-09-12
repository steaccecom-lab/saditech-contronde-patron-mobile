import moment from 'moment-timezone';
import { BUSINESS_TIME_ZONE } from './business-time';
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return moment(value).tz(BUSINESS_TIME_ZONE).format('DD/MM HH:mm');
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) {
    return '-';
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

export function statusLabel(status: string): string {
  return roundStatusLabel(status);
}
import { roundStatusLabel } from '../presentation/labels';

/** API planned timestamps encode the civil clock in UTC fields. */
export function formatPlannedDateTime(value: string | null | undefined): string {
  return value ? moment.utc(value).format('DD/MM HH:mm') : '-';
}
