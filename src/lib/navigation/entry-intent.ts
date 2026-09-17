/**
 * Where a system URL should leave the App Clip.
 *
 * The Clip can be entered by more than one URL for a single tap. A Live
 * Activity's camera button delivers `…/celebration/<id>/camera`, and iOS can
 * also hand the Clip its App Clip invocation link (`…/j/<code>`) on the same
 * launch or resume. Expo Router turns every one of those into navigation on
 * its own, so without a single owner the generic invitation arrives second,
 * lands on top of the viewfinder, and the invitation screen's "already joined"
 * redirect replaces itself with the event page. Because that event route sits
 * above a modal, the native stack presents it as a page sheet — the event page
 * the guest could drag but not dismiss.
 *
 * This module is that owner's policy, kept free of React Native so it can be
 * tested directly. Decisions are made from the navigation stack as it is, not
 * from timing: an entry that the current stack already satisfies does nothing.
 */

export const EVENT_ROUTE = 'celebration/[celebrationId]/index';
export const CAMERA_ROUTE = 'celebration/[celebrationId]/camera';

export type EntryIntent =
  /** The Live Activity's camera button. */
  | { kind: 'camera'; celebrationId: string }
  /**
   * The event page. `source` separates the Live Activity card, which asks for
   * the event page itself, from an invitation this device has already joined,
   * which only asks to be inside the event.
   */
  | { kind: 'event'; celebrationId: string; source: 'live-activity' | 'invitation' }
  /** An invitation this device has not joined: the join screen is the destination. */
  | { kind: 'invitation'; code: string }
  | { kind: 'other' };

/** A route in the Clip's root stack, bottom to top. */
export type StackRoute = { name: string; celebrationId?: string };

export type EntryDecision =
  /** Let Expo Router navigate to `path` as it normally would. */
  | { type: 'navigate'; path: string }
  /** The stack already satisfies this entry. */
  | { type: 'ignore'; reason: string }
  /** Close whatever is above the event page (the viewfinder, a photo). */
  | { type: 'return-to-event'; celebrationId: string }
  /** Cold launch into the camera: start on the event page, then present it. */
  | { type: 'open-event-then-camera'; celebrationId: string };

/**
 * Reads a system URL. Only the path decides the destination; the query and
 * fragment (an invitation token, for one) are carried by the original URL
 * whenever it is passed through.
 */
export function parseEntryURL(url: string): EntryIntent {
  const segments = entryPath(url)
    .split('/')
    .filter(Boolean)
    .map(safeDecode);

  if (segments[0] === 'celebration' && segments[1]) {
    if (segments.length === 2) {
      return { kind: 'event', celebrationId: segments[1], source: 'live-activity' };
    }
    if (segments.length === 3 && segments[2] === 'camera') {
      return { kind: 'camera', celebrationId: segments[1] };
    }
    return { kind: 'other' };
  }

  if ((segments[0] === 'j' || segments[0] === 'e') && segments.length === 2 && segments[1]) {
    return { kind: 'invitation', code: segments[1] };
  }

  return { kind: 'other' };
}

export function eventPath(celebrationId: string): string {
  return `/celebration/${encodeURIComponent(celebrationId)}`;
}

export function decideEntry(
  intent: EntryIntent,
  { url, initial, stack }: { url: string; initial: boolean; stack: StackRoute[] },
): EntryDecision {
  switch (intent.kind) {
    case 'other':
    case 'invitation':
      return { type: 'navigate', path: url };

    case 'camera': {
      if (initial) {
        return { type: 'open-event-then-camera', celebrationId: intent.celebrationId };
      }
      const top = stack[stack.length - 1];
      if (top?.name === CAMERA_ROUTE && top.celebrationId === intent.celebrationId) {
        return { type: 'ignore', reason: 'viewfinder already open' };
      }
      return { type: 'navigate', path: url };
    }

    case 'event': {
      const path = eventPath(intent.celebrationId);
      if (initial) return { type: 'navigate', path };

      const top = stack[stack.length - 1];
      if (top?.name === EVENT_ROUTE && top.celebrationId === intent.celebrationId) {
        return { type: 'ignore', reason: 'event page already showing' };
      }

      const insideEvent = stack.some((route) => route.celebrationId === intent.celebrationId);
      if (!insideEvent) return { type: 'navigate', path };

      // A generic invitation carries nothing the guest's current place in the
      // event lacks, so it never moves them — above all not off a viewfinder
      // they asked for.
      if (intent.source === 'invitation') {
        return { type: 'ignore', reason: 'already inside this event' };
      }
      return { type: 'return-to-event', celebrationId: intent.celebrationId };
    }
  }
}

/**
 * Reads the root stack out of Expo Router's navigation state. Empty until the
 * app's own navigator has mounted: Expo Router nests it under a single
 * internal route, which exists first on its own.
 */
export function stackFromState(state: unknown): StackRoute[] {
  type Node = { index?: number; routes?: { name: string; params?: object; state?: Node }[] };
  const root = state as Node | undefined;
  const slot = root?.routes?.[root.index ?? 0];
  const routes = slot?.state?.routes ?? [];
  return routes.map((route) => {
    const id = (route.params as { celebrationId?: unknown } | undefined)?.celebrationId;
    return { name: route.name, ...(typeof id === 'string' ? { celebrationId: id } : {}) };
  });
}

function entryPath(url: string): string {
  const bare = url.split(/[?#]/)[0];
  const web = bare.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  if (web) return web[1] ?? '/';
  // A custom scheme's first segment parses as a host (`scheme://celebration/…`),
  // so everything after `://` is the path.
  const custom = bare.match(/^[a-z][a-z0-9+.-]*:\/\/(.*)$/i);
  if (custom) return `/${custom[1]}`;
  return bare;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
