import type { DateStampOptions } from './disposable-stamp';

/**
 * Web sibling of `disposable-stamp.ts` — keeps `@shopify/react-native-skia`
 * out of the web bundle graph, as `disposable-paint.web.ts` does. Nothing on
 * web draws a treated photo, so this is a no-op rather than a throw: a missing
 * date stamp is not worth failing a render over.
 */
export function drawDisposableDateStamp(_canvas: unknown, _options: DateStampOptions): void {
  // Intentionally empty.
}
