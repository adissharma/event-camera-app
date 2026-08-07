/**
 * Dynamic app config.
 *
 * Static values live in `app.json`; this file layers the App Clip variant on
 * top of them when `APP_VARIANT=clip` (set by the `clip` profile in
 * `eas.json`).
 *
 * The important part is `root`. `expo-router` discovers routes with
 * `require.context(process.env.EXPO_ROUTER_APP_ROOT, …)`, which recursively
 * bundles *every* module under that directory. Pointing the Clip build at
 * `./src/app-clip` is therefore what physically keeps the full app's welcome
 * screen, its 1.3 MB background video, sign-in, verification, event creation
 * and host dashboard out of the Clip binary. Declaring fewer `<Stack.Screen>`s
 * would not have done this — screen declarations only set navigation options.
 */

const IS_CLIP = process.env.APP_VARIANT === 'clip';

/** Routes directory for each variant. */
const ROUTER_ROOT = IS_CLIP ? './src/app-clip' : './src/app';

/**
 * Rewrite the `expo-router` plugin entry so it carries the variant's routes
 * directory. The plugin merges its props into `extra.router`, which is what
 * Expo CLI feeds to Metro as `transform.routerRoot`.
 */
function withRouterRoot(plugins) {
  return plugins.map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== 'expo-router') return plugin;

    const props = Array.isArray(plugin) ? (plugin[1] ?? {}) : {};
    return ['expo-router', { ...props, root: ROUTER_ROOT }];
  });
}

module.exports = ({ config }) => {
  const plugins = withRouterRoot(config.plugins ?? []);

  if (!IS_CLIP) {
    return { ...config, plugins };
  }

  return {
    ...config,
    name: 'Join Event',
    // A Clip's identifier must be a child of the parent app's identifier.
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios.bundleIdentifier}.Clip`,
    },
    plugins,
  };
};
