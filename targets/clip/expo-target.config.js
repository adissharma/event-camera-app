/**
 * App Clip target.
 *
 * `exportJs: true` embeds a React Native JS bundle in the Clip so it runs the
 * same Expo runtime as the app rather than a separate SwiftUI implementation.
 *
 * Note that `@bacons/apple-targets` implements `exportJs` by attaching the
 * *main app target's* "Bundle React Native code and images" build phase to this
 * target (see `with-xcode-changes.js`). That phase bundles with the default
 * router root, `./src/app`, which would put the full app — welcome screen,
 * sign-in, event creation and the 1.3 MB background video — inside the Clip.
 *
 * `plugins/with-clip-js-bundle.js` runs after this and gives the Clip its own
 * phase that exports `APP_VARIANT=clip`, so the Clip's bundle is built from the
 * guest-only `./src/app-clip` route tree.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'clip',
  // Leading dot: appended to the parent app's identifier, giving
  // com.potoevents.eventcamera.Clip. A Clip's id must be a child of its parent.
  bundleIdentifier: '.Clip',
  icon: './assets/images/icon.png',
  exportJs: true,
  entitlements: {
    // Clip invocation uses the `appclips:` prefix, distinct from the parent
    // app's `applinks:` Universal Links.
    'com.apple.developer.associated-domains': [
      'appclips:event-camera-app-navy.vercel.app',
    ],
  },
});
