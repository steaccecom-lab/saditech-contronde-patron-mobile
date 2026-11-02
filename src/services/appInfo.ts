import {NativeModules} from 'react-native';
import {env} from '../config/env';

type BuildInfo = {versionName?: unknown; versionCode?: unknown};
const environments = {
  production: 'Production',
  staging: 'Recette',
  development: 'Développement',
};

/** Values are read from the installed Android variant, never package.json. */
export function readAppInfo(
  info: BuildInfo | undefined = NativeModules.PatronAppInfo,
) {
  return {
    versionName:
      typeof info?.versionName === 'string' && info.versionName.trim()
        ? info.versionName.trim()
        : 'Indisponible',
    versionCode:
      typeof info?.versionCode === 'number' &&
      Number.isSafeInteger(info.versionCode) &&
      info.versionCode > 0
        ? String(info.versionCode)
        : 'Indisponible',
    environment: environments[env.NAME],
    publisher: 'SADITECH PRO',
  };
}
