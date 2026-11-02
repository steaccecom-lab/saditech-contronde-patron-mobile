import {NativeModules} from 'react-native';
import {readAppInfo} from '../src/services/appInfo';
import {env} from '../src/config/env';
const previousEnvironment = env.NAME;
afterEach(() => {
  env.NAME = previousEnvironment;
  delete NativeModules.PatronAppInfo;
});
it('reads only the actual installed build metadata and keeps variant suffixes', () => {
  NativeModules.PatronAppInfo = {
    versionName: '1.4.0-staging',
    versionCode: 10,
    otherSecret: 'not-to-display',
  };
  expect(readAppInfo()).toEqual({
    versionName: '1.4.0-staging',
    versionCode: '10',
    environment: 'Développement',
    publisher: 'SADITECH PRO',
  });
  NativeModules.PatronAppInfo = {versionName: '2.0.0', versionCode: 99};
  expect(readAppInfo()).toMatchObject({
    versionName: '2.0.0',
    versionCode: '99',
  });
});
it.each(['production', 'staging', 'development'] as const)(
  'labels the configured %s environment without exposing URLs',
  name => {
    env.NAME = name;
    expect(
      readAppInfo({versionName: '1.2.3', versionCode: 7}).environment,
    ).toBe(
      {
        production: 'Production',
        staging: 'Recette',
        development: 'Développement',
      }[name],
    );
  },
);
it.each([
  {},
  {versionName: '', versionCode: 0},
  {versionName: 42, versionCode: '10'},
  {versionName: null, versionCode: NaN},
])('never invents a version when the native metadata is unavailable', info => {
  expect(readAppInfo(info)).toMatchObject({
    versionName: 'Indisponible',
    versionCode: 'Indisponible',
  });
});
