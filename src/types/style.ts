import type { ImageStyle } from 'react-native';

/**
 * A box style valid for both a `View` and an image.
 *
 * `ViewStyle` and `ImageStyle` diverge on several properties — `overflow`
 * accepts `'scroll'` only on a view, `boxSizing` is a loose `string` on a view
 * and a union on an image — so a `ViewStyle` cannot be forwarded to an image.
 *
 * `ImageStyle` is the narrower of the two on every shared property, and assigns
 * cleanly into a view's style. Basing the shared type on it lets a component
 * expose ONE `style` prop while rendering either a placeholder `View` or a real
 * image, with no casts anywhere.
 */
export type MediaBoxStyle = ImageStyle;
