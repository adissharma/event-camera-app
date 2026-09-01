import type { RenderDisposableParams } from './disposable-render';

/**
 * Web sibling of `disposable-render.ts`.
 *
 * Keeps `@shopify/react-native-skia` and `expo-file-system`'s native `File`
 * bridge out of the web bundle graph — see the note in
 * `disposable-paint.web.ts`. Saving filtered photos is a native-only flow, so
 * nothing on web reaches this; it throws rather than quietly handing back an
 * unfiltered file, which would be the worse failure.
 */
export async function renderDisposablePhotoToFile(
  _params: RenderDisposableParams,
): Promise<string> {
  throw new Error('Disposable filter: full-resolution rendering is not available on web.');
}
