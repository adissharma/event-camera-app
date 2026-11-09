import { EventGlass } from '@/components/ui/event-glass';

export interface CoverGlassProps {
  /** The cover behind the card, as handed to `Image`. */
  cover: unknown;
  /** Where the cover starts, measured from the card's top edge. */
  coverTop: number;
  coverHeight: number;
  /** How far the cover runs on underneath the card. */
  reach: number;
  /** How far the page scrolls while the cover moves, and at what fraction of that scroll. */
  motion: { distance: number; follow: number };
}

/**
 * The glass behind a card that sits on an event cover. Fills its parent, as
 * `EventGlass` does. On a device that is the real glass, which reads what is
 * behind it for itself; see `cover-glass.web.tsx` for the browser, where only
 * desktop gets the bent glass and mobile web stays on the tinted blur.
 */
export function CoverGlass(_props: CoverGlassProps) {
  return <EventGlass />;
}
