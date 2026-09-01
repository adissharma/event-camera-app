import type { DisposableRenderRequest } from './disposable-cache';

/**
 * Web sibling of `disposable-cache.ts` — keeps `@shopify/react-native-skia`
 * out of the web bundle graph, as `disposable-paint.web.ts` does. Nothing on
 * web draws a treated photo, so every entry point here is an honest miss
 * rather than a throw: the caller's own fallback path then applies.
 */
export function peekSourceImage(_uri: string): null {
  return null;
}

export function loadSourceImage(_source: string | number): Promise<null> {
  return Promise.resolve(null);
}

export function getDisposableRender(_request: DisposableRenderRequest): null {
  return null;
}

export function clearDisposableCaches(): void {
  // Nothing is cached on web.
}
