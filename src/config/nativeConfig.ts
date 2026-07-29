import {NativeModules} from 'react-native';

export type NativePatronConfig = {
  APP_ENV?: string;
  API_URL?: string;
};

type RNCConfigModule = {
  getConfig?: () => {config?: NativePatronConfig};
};

type NativeModuleRegistry = {
  RNCConfigModule?: RNCConfigModule | null;
  RNCConfig?: RNCConfigModule | null;
};

const CONFIGURATION_ERROR =
  'Configuration Patron indisponible : le module natif react-native-config n’est pas lié à cette application.';

export function readNativeConfig(
  nativeModules: NativeModuleRegistry = NativeModules,
): NativePatronConfig {
  const nativeConfigModule =
    nativeModules.RNCConfigModule ?? nativeModules.RNCConfig;

  if (typeof nativeConfigModule?.getConfig !== 'function') {
    throw new Error(CONFIGURATION_ERROR);
  }

  const result = nativeConfigModule.getConfig();
  if (!result?.config || typeof result.config !== 'object') {
    throw new Error(CONFIGURATION_ERROR);
  }

  return result.config;
}
