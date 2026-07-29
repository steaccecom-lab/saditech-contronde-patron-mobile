type AndroidDependency = {
  sourceDir: string;
  packageImportPath: string;
  packageInstance: string;
};

type ReactNativeConfig = {
  dependencies: {
    'react-native-config': {
      platforms: {
        android: AndroidDependency;
      };
    };
  };
};

const reactNativeConfig = require('../react-native.config.js') as ReactNativeConfig;
const androidConfig =
  reactNativeConfig.dependencies['react-native-config'].platforms.android;

describe('autolinking Android de react-native-config', () => {
  it('déclare la bibliothèque et RNCConfigPackage pour toutes les variantes', () => {
    expect(androidConfig.sourceDir.replace(/\\/g, '/')).toMatch(
      /node_modules\/react-native-config\/android$/,
    );
    expect(androidConfig.packageImportPath).toBe(
      'import com.lugg.RNCConfig.RNCConfigPackage;',
    );
    expect(androidConfig.packageInstance).toBe('new RNCConfigPackage()');
  });
});
