import {
  createPatronEnvironment,
  deriveSocketUrl,
} from '../src/config/environment';
import fs from 'fs';
import path from 'path';

const productionApiUrl = `https://${['api-contronde', 'saditech', 'ma'].join('.')}/api`;

describe('Patron environment configuration', () => {
  it('accepts a valid HTTP(S) API URL', () => {
    const result = createPatronEnvironment({
      APP_ENV: 'development',
      API_URL: 'http://10.0.2.2:3001/api',
    });

    expect(result.API_URL).toBe('http://10.0.2.2:3001/api');
  });

  it('trims whitespace and removes trailing slashes', () => {
    const result = createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL: `  ${productionApiUrl}///  `,
    });

    expect(result.API_URL).toBe(productionApiUrl);
  });

  it.each(['staging', 'production'] as const)(
    'rejects an empty URL in %s',
    (APP_ENV) => {
      expect(() => createPatronEnvironment({ APP_ENV, API_URL: '  ' }))
        .toThrow('API_URL est obligatoire');
    }
  );

  it('rejects protocols other than HTTP and HTTPS', () => {
    expect(() => createPatronEnvironment({
      APP_ENV: 'development',
      API_URL: 'ftp://server.example.test/api',
    })).toThrow('doit utiliser HTTP ou HTTPS');
  });

  it('allows staging to target the explicitly approved public API', () => {
    expect(createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL: productionApiUrl,
    }).API_URL).toBe(productionApiUrl);
  });

  it.each([
    'http://api-contronde.saditech.ma/api',
    'http://localhost:3001/api',
    'https://localhost/api',
    'http://10.0.2.2:3001/api',
    'https://10.0.2.2/api',
    'https://staging.example.invalid/api',
    'https://api-contronde.saditech.ma/api/api',
    'https://api-contronde.saditech.ma',
  ])('prevents staging from targeting %s', (API_URL) => {
    expect(() => createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL,
    })).toThrow(
      'un build de recette doit utiliser l\u2019API publique autorisée en HTTPS',
    );
  });

  it.each([
    'http://localhost:3001/api',
    'http://127.0.0.1:3001/api',
    'http://10.0.2.2:3001/api',
    'https://staging.example.invalid/api',
  ])('prevents production from targeting %s', (API_URL) => {
    expect(() => createPatronEnvironment({
      APP_ENV: 'production',
      API_URL,
    })).toThrow('un build production doit utiliser le serveur de production');
  });

  it('derives Socket.IO without keeping or duplicating the final /api suffix', () => {
    expect(deriveSocketUrl('https://staging.example.invalid/api/'))
      .toBe('https://staging.example.invalid');
    expect(deriveSocketUrl('https://staging.example.invalid/gateway'))
      .toBe('https://staging.example.invalid/gateway');
  });

  it('accepts an URL with a port and derives its Socket.IO origin', () => {
    const result = createPatronEnvironment({
      APP_ENV: 'development',
      API_URL: 'https://staging.example.invalid:8443/api',
    });

    expect(result.API_URL).toBe(
      'https://staging.example.invalid:8443/api',
    );
    expect(result.SOCKET_URL).toBe(
      'https://staging.example.invalid:8443',
    );
  });

  it('keeps a path other than the final /api suffix for Socket.IO', () => {
    expect(
      deriveSocketUrl('https://staging.example.invalid/gateway/api-v2/'),
    ).toBe('https://staging.example.invalid/gateway/api-v2');
  });

  it.each([
    'https://',
    'https://bad host/api',
    'https://example.test:70000/api',
    'https://example.test/api?token=secret',
    'https://user@example.test/api',
  ])('rejects the invalid URL %s', API_URL => {
    expect(() =>
      createPatronEnvironment({
        APP_ENV: 'staging',
        API_URL,
      }),
    ).toThrow('Configuration Patron invalide');
  });

  it('does not use the global Web URL implementation', () => {
    const environmentSource = fs.readFileSync(
      path.join(__dirname, '../src/config/environment.ts'),
      'utf8',
    );

    expect(environmentSource).not.toMatch(/\bnew\s+URL\s*\(/);
    expect(environmentSource).not.toMatch(
      /\bURL\.(protocol|hostname|host|pathname)\b/,
    );
  });

  it('never falls back silently to production', () => {
    const development = createPatronEnvironment(
      { APP_ENV: 'development', API_URL: '' },
      { allowDevelopmentFallback: true }
    );
    expect(development.API_URL).toBe('http://10.0.2.2:3001/api');

    expect(() => createPatronEnvironment(
      { APP_ENV: 'production', API_URL: '' },
      { allowDevelopmentFallback: true }
    )).toThrow('API_URL est obligatoire');
  });

  it('keeps the approved public URL valid for production and staging', () => {
    expect(createPatronEnvironment({
      APP_ENV: 'production',
      API_URL: productionApiUrl,
    }).API_URL).toBe(productionApiUrl);

    expect(createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL: productionApiUrl,
    }).API_URL).toBe(productionApiUrl);
  });

  it('rejects an unknown profile', () => {
    expect(() => createPatronEnvironment({
      APP_ENV: 'qa',
      API_URL: productionApiUrl,
    })).toThrow('APP_ENV doit valoir development, staging ou production');
  });

  it('rejects a missing environment variable clearly', () => {
    expect(() => createPatronEnvironment({
      API_URL: productionApiUrl,
    })).toThrow('APP_ENV doit valoir development, staging ou production');

    expect(() => createPatronEnvironment({
      APP_ENV: 'staging',
    })).toThrow('API_URL est obligatoire');
  });

  it('does not log configuration values or errors', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => createPatronEnvironment({
      APP_ENV: 'production',
      API_URL: 'not-a-url',
    })).toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    error.mockRestore();
  });
});
