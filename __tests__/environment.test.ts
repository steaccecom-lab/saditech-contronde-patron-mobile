import {
  createPatronEnvironment,
  deriveSocketUrl,
} from '../src/config/environment';

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
      API_URL: '  https://staging.example.invalid/api///  ',
    });

    expect(result.API_URL).toBe('https://staging.example.invalid/api');
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

  it('prevents staging from targeting production', () => {
    expect(() => createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL: productionApiUrl,
    })).toThrow('un build de recette ne peut pas utiliser la production');
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

  it('keeps the approved production URL valid only for production', () => {
    expect(createPatronEnvironment({
      APP_ENV: 'production',
      API_URL: productionApiUrl,
    }).API_URL).toBe(productionApiUrl);

    expect(() => createPatronEnvironment({
      APP_ENV: 'staging',
      API_URL: productionApiUrl,
    })).toThrow();
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
