import axios from 'axios';

export type ApiErrorInfo = { title: string; messages: string[]; status?: number; field?: string };
const technicalPattern = /(?:prisma|sql|stack\s*trace|query engine|\bat\s+\w+.*:\d+)/i;

function flatten(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}

export function parseApiError(error: unknown): ApiErrorInfo {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const raw = axios.isAxiosError(error) ? error.response?.data : undefined;
  const payload = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const envelope = payload.error && typeof payload.error === 'object' ? payload.error as Record<string, unknown> : payload;
  const details = envelope.details && typeof envelope.details === 'object' ? envelope.details as Record<string, unknown> : {};
  const fields = details.fieldErrors && typeof details.fieldErrors === 'object' ? details.fieldErrors as Record<string, unknown> : {};
  const field = Object.keys(fields).find((key) => flatten(fields[key]).length > 0);
  const messages = [...flatten(details.formErrors), ...Object.keys(fields).flatMap((key) => flatten(fields[key]))]
    .filter((message, index, all) => !technicalPattern.test(message) && all.indexOf(message) === index);
  const backend = typeof envelope.message === 'string' && !technicalPattern.test(envelope.message) && envelope.message !== 'Validation failed' ? envelope.message : '';
  const local = error instanceof Error && !axios.isAxiosError(error) && !technicalPattern.test(error.message) ? error.message.trim() : '';
  let fallback = 'Une erreur est survenue. Veuillez r\u00e9essayer.';
  let preferFallback = false;
  if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
    fallback = 'Le serveur met trop de temps \u00e0 r\u00e9pondre. Veuillez r\u00e9essayer.';
    preferFallback = true;
  } else if (axios.isAxiosError(error) && !error.response) {
    fallback = 'Impossible de joindre le serveur. V\u00e9rifiez votre connexion Internet.';
    preferFallback = true;
  } else if (status === 401) {
    fallback = 'Votre session a expir\u00e9. Veuillez vous reconnecter.';
    preferFallback = true;
  } else if (status === 403) {
    fallback = 'Vous n\u2019avez pas l\u2019autorisation d\u2019effectuer cette action.';
    preferFallback = true;
  } else if (status === 404) {
    fallback = 'La ressource demand\u00e9e est introuvable.';
    preferFallback = true;
  } else if (status === 429) {
    fallback = 'Trop de tentatives. Veuillez patienter avant de r\u00e9essayer.';
    preferFallback = true;
  } else if (status && status >= 500) {
    fallback = 'Une erreur interne est survenue. Veuillez r\u00e9essayer.';
    preferFallback = true;
  }
  return { title: field ? 'Donn\u00e9es invalides' : 'Action impossible', messages: messages.length ? messages : [preferFallback ? fallback : backend || local || fallback], status, field };
}
