import type { DisposableRecipe } from './disposable-recipe';

/**
 * Web sibling of `disposable-paint.ts`.
 *
 * The default file imports `@shopify/react-native-skia`, which on native is
 * linked at build time but on web needs its own async WASM bootstrap
 * (`LoadSkiaWeb()` plus the CanvasKit binary) that this app does not set up.
 * Merely importing it on web throws before anything renders. Metro/Expo resolve
 * this file instead, keeping Skia out of the web bundle graph entirely — the
 * same split `treated-photo.web.tsx` and `disposable-photo.web.tsx` rely on.
 *
 * Nothing on web calls this: `disposable-photo.web.tsx` renders a plain image.
 * It exists so the module graph resolves, and throws rather than silently
 * returning something unusable if that ever stops being true.
 */

export interface DisposablePaintOptions {
  width: number;
  height: number;
  devicePixelRatio: number;
  fit?: 'cover' | 'contain';
  compact?: boolean;
  dateStamp?: { text: string; style?: unknown };
}

export function buildDisposablePaint(
  _image: unknown,
  _recipe: DisposableRecipe,
  _options: DisposablePaintOptions,
): never {
  throw new Error('Disposable filter: Skia rendering is not available on web.');
}

export function drawDisposable(): never {
  throw new Error('Disposable filter: Skia rendering is not available on web.');
}

export function recordDisposablePicture(): never {
  throw new Error('Disposable filter: Skia rendering is not available on web.');
}
