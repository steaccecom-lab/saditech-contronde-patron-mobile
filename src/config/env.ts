import { createPatronEnvironment } from './environment';
import {readNativeConfig} from './nativeConfig';

const Config = readNativeConfig();

export const env = createPatronEnvironment(
  {
    APP_ENV: Config.APP_ENV,
    API_URL: Config.API_URL,
  },
);
