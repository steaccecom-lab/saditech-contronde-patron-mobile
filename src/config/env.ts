import Config from 'react-native-config';
import { createPatronEnvironment } from './environment';

export const env = createPatronEnvironment(
  {
    APP_ENV: Config.APP_ENV,
    API_URL: Config.API_URL,
  },
  {
    allowDevelopmentFallback: Config.APP_ENV?.trim().toLowerCase() === 'development',
  },
);
