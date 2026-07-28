import { fr } from '../i18n';

type LabelMap = Readonly<Record<string, string>>;

function labelFrom(map: LabelMap, value: string, fallback: string): string {
  return map[value] ?? fallback;
}

export function technicalValueFallback(_value?: string | null): string {
  return fr.fallback.value;
}

export function roundStatusLabel(value: string): string {
  return labelFrom(fr.roundStatuses, value, fr.fallback.status);
}

export function checkpointStatusLabel(value: string): string {
  return labelFrom(fr.checkpointStatuses, value, fr.fallback.status);
}

export function notificationModeLabel(value: string): string {
  return labelFrom(fr.notificationModes, value, fr.fallback.notificationMode);
}
