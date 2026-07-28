/**
 * Babel configuration.
 *
 * `react-native-worklets/plugin` is required by React Native Reanimated 4 — it
 * compiles worklet functions so animations are driven on the UI thread. Without
 * it `useAnimatedStyle` still applies a style, but timing-based animations do
 * not advance, which presents as elements stranded at their initial opacity.
 *
 * It must remain the LAST plugin in the list.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reactCompiler: true }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
