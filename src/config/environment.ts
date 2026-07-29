export type PatronEnvironmentName = 'development' | 'staging' | 'production';

type EnvironmentInput = {
  APP_ENV?: string;
  API_URL?: string;
};

export type PatronEnvironment = {
  NAME: PatronEnvironmentName;
  API_URL: string;
  SOCKET_URL: string;
};

const DEVELOPMENT_API_URL = 'http://10.0.2.2:3001/api';
const PRODUCTION_HOST = ['api-contronde', 'saditech', 'ma'].join('.');

export function createPatronEnvironment(
  input: EnvironmentInput,
  options: {allowDevelopmentFallback?: boolean} = {},
): PatronEnvironment {
  const name = parseEnvironmentName(input.APP_ENV);
  const configuredApiUrl = input.API_URL?.trim();
  const apiUrl =
    configuredApiUrl ||
    (name === 'development' && options.allowDevelopmentFallback
      ? DEVELOPMENT_API_URL
      : '');

  if (!apiUrl) {
    throw new Error(
      `Configuration Patron invalide : API_URL est obligatoire pour l’environnement ${name}.`,
    );
  }

  const normalizedApiUrl = normalizeHttpUrl(apiUrl, 'API_URL');
  validateEnvironmentTarget(name, normalizedApiUrl);

  return {
    NAME: name,
    API_URL: normalizedApiUrl,
    SOCKET_URL: deriveSocketUrl(normalizedApiUrl),
  };
}

export function deriveSocketUrl(apiUrl: string) {
  const normalized = normalizeHttpUrl(apiUrl, 'API_URL');
  return normalized.endsWith('/api')
    ? normalized.slice(0, -4)
    : normalized;
}

function parseEnvironmentName(
  value: string | undefined,
): PatronEnvironmentName {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'development' ||
    normalized === 'staging' ||
    normalized === 'production'
  ) {
    return normalized;
  }

  throw new Error(
    'Configuration Patron invalide : APP_ENV doit valoir development, staging ou production.',
  );
}

function normalizeHttpUrl(value: string, variableName: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error(
      `Configuration Patron invalide : ${variableName} doit utiliser HTTP ou HTTPS.`,
    );
  }

  parseHttpUrl(normalized, variableName);
  return normalized;
}

function validateEnvironmentTarget(
  name: PatronEnvironmentName,
  apiUrl: string,
) {
  const {hostname} = parseHttpUrl(apiUrl, 'API_URL');
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '10.0.2.2';
  const isProduction = hostname === PRODUCTION_HOST;
  const looksLikeStaging =
    hostname.endsWith('.invalid') ||
    hostname.includes('staging') ||
    hostname.includes('recette');

  if (name === 'production' && (!isProduction || isLocal || looksLikeStaging)) {
    throw new Error(
      'Configuration Patron invalide : un build production doit utiliser le serveur de production.',
    );
  }

  if (name === 'staging' && isProduction) {
    throw new Error(
      'Configuration Patron invalide : un build de recette ne peut pas utiliser la production.',
    );
  }
}

function parseHttpUrl(value: string, variableName: string) {
  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(value);
  if (!match) {
    throwInvalidUrl(variableName);
  }

  const authority = match[2];
  const authorityMatch = /^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(authority);
  if (!authorityMatch || !isValidHostname(authorityMatch[1])) {
    throwInvalidUrl(variableName);
  }

  const port = authorityMatch[2]
    ? Number.parseInt(authorityMatch[2], 10)
    : undefined;
  if (port !== undefined && (port < 1 || port > 65535)) {
    throw new Error(
      `Configuration Patron invalide : ${variableName} contient un port invalide.`,
    );
  }

  return {
    protocol: match[1].toLowerCase(),
    hostname: authorityMatch[1].toLowerCase(),
  };
}

function isValidHostname(hostname: string) {
  if (hostname.toLowerCase() === 'localhost') {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname
      .split('.')
      .every(part => Number.parseInt(part, 10) <= 255);
  }

  return (
    hostname.length <= 253 &&
    hostname.includes('.') &&
    hostname
      .split('.')
      .every(
        label =>
          label.length > 0 &&
          label.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
      )
  );
}

function throwInvalidUrl(variableName: string): never {
  throw new Error(
    `Configuration Patron invalide : ${variableName} doit être une URL HTTP(S) valide.`,
  );
}
