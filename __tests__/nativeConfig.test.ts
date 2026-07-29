import {readNativeConfig} from '../src/config/nativeConfig';
import {createPatronEnvironment} from '../src/config/environment';

const PRODUCTION_API_URL = 'https://api-contronde.saditech.ma/api';

describe('module natif react-native-config', () => {
  it('lit APP_ENV et API_URL lorsque le module natif est disponible', () => {
    const config = readNativeConfig({
      RNCConfigModule: {
        getConfig: () => ({
          config: {
            APP_ENV: 'production',
            API_URL: PRODUCTION_API_URL,
          },
        }),
      },
    });

    expect(createPatronEnvironment(config)).toEqual({
      NAME: 'production',
      API_URL: PRODUCTION_API_URL,
      SOCKET_URL: 'https://api-contronde.saditech.ma',
    });
  });

  it.each([
    {},
    {RNCConfigModule: null},
    {RNCConfigModule: {}},
  ])(
    'produit une erreur contrôlée lorsque le module natif est indisponible',
    nativeModules => {
      expect(() => readNativeConfig(nativeModules)).toThrow(
        'le module natif react-native-config n’est pas lié',
      );
    },
  );

  it('ne journalise aucune valeur lorsque le module natif est indisponible', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => readNativeConfig({})).toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    error.mockRestore();
  });
});
