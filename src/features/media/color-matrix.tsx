/**
 * The colour-matrix filter, on the platforms that have one.
 *
 * `react-native-color-matrix-image-filters` reaches into React Native's
 * internals (`Libraries/Utilities/codegenNativeComponent`), which Metro
 * refuses to bundle for web — so importing it from shared code breaks the
 * web export for every screen that transitively touches it, viewfinder
 * chrome included. This module is the seam: native gets the real filter,
 * `color-matrix.web.tsx` gets a CSS equivalent, and callers import neither
 * package directly.
 */
export { ColorMatrix, type Matrix } from 'react-native-color-matrix-image-filters';
