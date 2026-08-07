const { PBXNativeTarget, PBXShellScriptBuildPhase } = require('@bacons/xcode');
const {
  withXcodeProjectBeta,
} = require('@bacons/apple-targets/build/with-bacons-xcode');

const CLIP_PRODUCT_TYPE = 'com.apple.product-type.application.on-demand-install-capable';
const PHASE_NAME = 'Bundle React Native code and images';
const MARKER = 'APP_VARIANT=clip';

/**
 * Give the App Clip target its own React Native bundling phase.
 *
 * `@bacons/apple-targets` implements `exportJs` by attaching the *main app
 * target's* bundling phase object to the Clip target (see
 * `with-xcode-changes.js`, `configureJsExport`). Both targets then reference one
 * phase, so the Clip embeds the main app's bundle — built with the default
 * router root `./src/app`, which is the entire full app including the welcome
 * screen and its 1.3 MB video. That would undo the route isolation described in
 * `docs/app-clip.md` at the native layer.
 *
 * This gives the Clip its own copy of the phase, prefixed with
 * `export APP_VARIANT=clip`. `app.config.js` reads that variable and resolves
 * the expo-router root to `./src/app-clip`, so the Clip's bundle is built from
 * the guest-only route tree.
 *
 * ── Why it hooks apple-targets' mod rather than `withXcodeProject` ──
 * apple-targets does not use the standard `ios.xcodeproj` mod. It registers a
 * custom base mod, `xcodeProjectBeta2`, backed by its own `@bacons/xcode`
 * parser, and that mod runs *after* the standard one. A `withXcodeProject` mod
 * therefore sees the project before the Clip target exists. Hooking the same
 * mod, with this plugin listed after "@bacons/apple-targets" in `plugins`,
 * appends this action after theirs so the target is present.
 */
module.exports = function withClipJsBundle(config) {
  return withXcodeProjectBeta(config, (cfg) => {
    const project = cfg.modResults;

    const clipTargets = project.rootObject.props.targets.filter(
      (target) =>
        PBXNativeTarget.is(target) && target.props.productType === CLIP_PRODUCT_TYPE
    );

    if (clipTargets.length === 0) {
      throw new Error(
        '[with-clip-js-bundle] No App Clip target found. Is "@bacons/apple-targets" ' +
          'listed before this plugin, and does targets/clip/expo-target.config.js exist?'
      );
    }

    for (const target of clipTargets) {
      const index = target.props.buildPhases.findIndex(
        (phase) =>
          PBXShellScriptBuildPhase.is(phase) && phase.props.name === PHASE_NAME
      );

      if (index === -1) {
        throw new Error(
          `[with-clip-js-bundle] The App Clip target has no "${PHASE_NAME}" phase. ` +
            'Set `exportJs: true` in targets/clip/expo-target.config.js.'
        );
      }

      const shared = target.props.buildPhases[index];

      // Already rewritten — prebuild must stay idempotent.
      if (String(shared.props.shellScript).includes(MARKER)) continue;

      // Detach the shared phase before creating our own, so the main app target
      // keeps bundling from ./src/app untouched.
      target.props.buildPhases.splice(index, 1);

      target.createBuildPhase(PBXShellScriptBuildPhase, {
        ...shared.props,
        shellScript: `export ${MARKER}\n${shared.props.shellScript}`,
      });
    }

    return cfg;
  });
};
