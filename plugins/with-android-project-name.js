/**
 * Gives the Android Gradle project a name Gradle accepts.
 *
 * Prebuild copies `expo.name` into `settings.gradle` as `rootProject.name`,
 * and Gradle 9 refuses a project name that starts or ends with a '.', so the
 * brand's own "Stills." fails every Android build before it begins. This only
 * renames the Gradle project; the launcher label still comes from `expo.name`.
 */
const { withSettingsGradle } = require('expo/config-plugins');

module.exports = function withAndroidProjectName(config) {
  return withSettingsGradle(config, (mod) => {
    const safeName = config.name.replace(/^\.+|\.+$/g, '') || 'app';
    mod.modResults.contents = mod.modResults.contents.replace(
      /rootProject\.name\s*=\s*['"][^'"]*['"]/,
      `rootProject.name = '${safeName}'`,
    );
    return mod;
  });
};
