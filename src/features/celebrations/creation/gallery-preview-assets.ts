/**
 * The fixed photo pair used wherever creation previews a finished gallery.
 *
 * Keeping these sources in one place prevents the treatment step and the
 * pre-paywall event preview from quietly drifting to different photographs.
 * The latter deliberately uses the same first-row pair only; its surrounding
 * event chrome can still render a fuller gallery by repeating them.
 */
export const CREATION_GALLERY_PREVIEW_IMAGES = [
  require('../../../../assets/sample-event/05.jpg'),
  require('../../../../assets/sample-event/07.jpg'),
] as const;

/** Pre-desaturated versions of the same pair for the monochrome treatment. */
export const CREATION_GALLERY_PREVIEW_MONO_IMAGES = [
  require('../../../../assets/sample-event/mono/05.jpg'),
  require('../../../../assets/sample-event/mono/07.jpg'),
] as const;
