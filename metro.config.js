const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/**
 * The App Clip is a separate product, not a full-app screen with hidden UI.
 *
 * These replacements keep the guest event UI shared while removing host-only
 * implementations from the Clip's static import graph. The normal iOS,
 * Android and web bundles continue to resolve the canonical modules.
 */
if (process.env.APP_VARIANT === 'clip') {
  const clipModules = new Map([
    ['@/features/auth/context', 'auth-context.tsx'],
    ['@/features/celebrations/challenge-icons', 'challenge-icons.tsx'],
    ['@/features/celebrations/sample-event', 'sample-event.ts'],
    ['@/features/celebrations/creation/gallery-preview-assets', 'gallery-preview-assets.ts'],
    ['@/features/celebrations/gallery-preset-assets', 'gallery-preset-assets.ts'],
    ['@/features/entitlements/upgrade-sheet', 'upgrade-sheet.tsx'],
    ['@react-native-masked-view/masked-view', 'masked-view.tsx'],
  ]);

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const replacement = clipModules.get(moduleName);
    if (replacement) {
      return context.resolveRequest(
        context,
        path.join(projectRoot, 'src/app-clip-runtime', replacement),
        platform,
      );
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
