require File.join(File.dirname(`node --print "require.resolve('react-native/package.json')"`), "scripts/react_native_pods")

# A Clip target is not a smaller icon for the full application: CocoaPods must
# see the same product boundary as Metro. Keep only native modules used by the
# event join, gallery, capture, treatment, sharing, Challenges and Guestbook
# paths. Package names (rather than pod names) are what Expo autolinking
# accepts here.
clip_excluded_packages = [
  "@bacons/apple-targets",
  "@expo/dom-webview",
  "@expo/log-box",
  "@expo/ui",
  "@react-native-community/datetimepicker",
  "@react-native-masked-view/masked-view",
  "expo-apple-authentication",
  "expo-application",
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
  "expo-device",
  "expo-eas-client",
  "expo-glass-effect",
  "expo-image",
  "expo-log-box",
  "expo-keep-awake",
  "expo-symbols",
  "expo-system-ui",
  "expo-updates",
  "expo-web-browser",
  "react-native-purchases",
]

use_expo_modules!(exclude: clip_excluded_packages)

if ENV['EXPO_USE_COMMUNITY_AUTOLINKING'] == '1'
  config_command = ['node', '-e', "process.argv=['', '', 'config'];require('@react-native-community/cli').run()"];
else
  config_command = [
    'node',
    '--no-warnings',
    '--eval',
    'require(require.resolve(\'expo-modules-autolinking\', { paths: [require.resolve(\'expo/package.json\')] }))(process.argv.slice(1))',
    'react-native-config',
    '--json',
    '--platform',
    'ios'
  ]
end

# `use_native_modules!` performs a second, unified Expo/React Native discovery
# pass. Passing the exclusions only to `use_expo_modules!` leaves every module
# linked through this pass (the previous Clip did exactly that).
config_command.concat(['--exclude', *clip_excluded_packages])

config = use_native_modules!(config_command)

use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']

use_react_native!(
  :path => config[:reactNativePath],
  :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
  # An absolute path to your application root.
  :app_path => "#{Pod::Config.instance.installation_root}/..",
  :privacy_file_aggregation_enabled => podfile_properties['apple.privacyManifestAggregationEnabled'] != 'false',
)
