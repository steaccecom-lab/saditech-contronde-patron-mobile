import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');
const buildGradle = fs.readFileSync(
  path.join(projectRoot, 'android/app/build.gradle'),
  'utf8',
);
const gitignore = fs.readFileSync(
  path.join(projectRoot, '.gitignore'),
  'utf8',
);
const signingExample = fs.readFileSync(
  path.join(projectRoot, 'android/keystore.properties.example'),
  'utf8',
);

describe('signature Android officielle Patron', () => {
  it('ne permet aucun fallback de release vers la signature debug', () => {
    expect(buildGradle).not.toMatch(
      /signingConfig\s+.*\?\s*signingConfigs\.release\s*:\s*signingConfigs\.debug/,
    );
    expect(buildGradle).toContain('signingConfig signingConfigs.release');
  });

  it('fait échouer explicitement productionRelease sans signature complète', () => {
    expect(buildGradle).toContain('productionReleaseRequested');
    expect(buildGradle).toContain('requiredSigningProperties');
    expect(buildGradle).toContain('!releaseSigningComplete');
    expect(buildGradle).toContain('throw new GradleException');
  });

  it('exige l’alias officiel Patron', () => {
    expect(buildGradle).toContain(
      'keystoreProperties["keyAlias"] != "contronde-patron"',
    );
  });

  it('déclare la version officielle 1.0.1 avec versionCode 2', () => {
    expect(buildGradle).toMatch(/\bversionCode\s+2\b/);
    expect(buildGradle).toMatch(/\bversionName\s+"1\.0\.1"/);
  });

  it('ignore les fichiers sensibles mais conserve un exemple sans secret', () => {
    expect(gitignore).toMatch(/^android\/keystore\.properties$/m);
    expect(gitignore).toMatch(/^\*\.jks$/m);
    expect(gitignore).toMatch(/^\*\.keystore$/m);
    expect(signingExample.trim().split(/\r?\n/)).toEqual([
      'storeFile=D:/saditech-secrets/contronde/patron/contronde-patron-release.jks',
      'storePassword=REPLACE_LOCALLY',
      'keyAlias=contronde-patron',
      'keyPassword=REPLACE_LOCALLY',
    ]);
  });

  it('conserve les variantes Debug sur signingConfigs.debug', () => {
    expect(buildGradle).toMatch(
      /buildTypes\s*\{[\s\S]*?debug\s*\{[\s\S]*?signingConfig signingConfigs\.debug/,
    );
    expect(buildGradle).toContain(
      'debuggableVariants = ["developmentDebug", "stagingDebug"]',
    );
  });
});
