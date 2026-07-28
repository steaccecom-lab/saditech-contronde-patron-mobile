export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
