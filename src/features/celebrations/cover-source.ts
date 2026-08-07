/**
 * Cover art resolution, shared by every screen that renders an event cover.
 *
 * Kept in one place so the guest invitation, the success screen and the
 * dashboard cannot drift onto different fallbacks for the same event.
 */

/** Theme-slug covers for the development fallback, keyed as on the dashboard. */
const COVER_MAP: Record<string, ReturnType<typeof require>> = {
  modern: require('../../../assets/images/placeholders/create_event_cover.png'),
  classic: require('../../../assets/images/placeholders/create_event_cover.png'),
  vibrant: require('../../../assets/images/placeholders/create_event_cover.png'),
  retro: require('../../../assets/images/placeholders/create_event_cover.png'),
  editorial: require('../../../assets/images/placeholders/create_event_cover.png'),
};

export const FALLBACK_COVER = require('../../../assets/images/placeholders/create_event_cover.png');

export function resolveCover(path: string | null | undefined) {
  if (!path) return FALLBACK_COVER;
  if (COVER_MAP[path]) return COVER_MAP[path];
  // A real storage path or a local file URI from the host's own picker.
  if (path.startsWith('http') || path.startsWith('file:')) return { uri: path };
  return FALLBACK_COVER;
}
