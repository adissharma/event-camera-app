import { useEffect } from 'react';
import { router, useNavigationContainerRef } from 'expo-router';

import { loadStoredGuestSession } from '@/services/guest-session';
import {
  EVENT_ROUTE,
  decideEntry,
  eventPath,
  parseEntryURL,
  stackFromState,
  type EntryIntent,
  type StackRoute,
} from './entry-intent';

/**
 * The single place a system URL becomes navigation in the App Clip.
 *
 * `+native-intent` hands every URL here — the one the Clip launched with and
 * each one delivered while it runs. See `entry-intent.ts` for why one owner is
 * needed and for the policy itself; this module supplies what the policy
 * reads (the live stack, whether this device has joined an invitation) and
 * carries out what it decides.
 */

type NavigationRef = ReturnType<typeof useNavigationContainerRef>;

let navigation: NavigationRef | null = null;

/**
 * The stack a launch URL will produce, for URLs that arrive before the
 * navigator has mounted and can be read.
 */
let launchStack: StackRoute[] = [];

/** A cold camera entry, waiting for its event page to be on screen. */
let pendingCamera: string | null = null;

function currentStack(): StackRoute[] {
  if (navigation?.isReady()) {
    const stack = stackFromState(navigation.getRootState());
    if (stack.length > 0) return stack;
  }
  return launchStack;
}

function isExplicit(intent: EntryIntent): boolean {
  return intent.kind === 'camera' || (intent.kind === 'event' && intent.source === 'live-activity');
}

function note(message: string, detail: object): void {
  if (__DEV__) console.info(`[AppClip] entry ${message}`, detail);
}

export async function routeSystemEntry(url: string, initial: boolean): Promise<string | null> {
  let intent = parseEntryURL(url);

  if (intent.kind === 'invitation') {
    // The same test the invitation screen uses to skip its form: a device that
    // has joined is sent into the event, not back through the join screen.
    const stored = await loadStoredGuestSession(intent.code);
    if (stored?.displayName) {
      intent = { kind: 'event', celebrationId: stored.celebrationId, source: 'invitation' };
    }
  }

  // Only another explicit request replaces a camera entry that is still
  // waiting. A generic invitation must never cancel it.
  if (!initial && isExplicit(intent)) pendingCamera = null;

  const decision = decideEntry(intent, { url, initial, stack: currentStack() });

  switch (decision.type) {
    case 'navigate':
      if (initial) {
        launchStack =
          intent.kind === 'event' ? [{ name: EVENT_ROUTE, celebrationId: intent.celebrationId }] : [];
      }
      return decision.path;

    case 'ignore':
      note('ignored', { intent: intent.kind, reason: decision.reason });
      return null;

    case 'return-to-event':
      router.dismissTo({
        pathname: '/celebration/[celebrationId]',
        params: { celebrationId: decision.celebrationId },
      });
      return null;

    case 'open-event-then-camera':
      // The event page is the root, so closing the viewfinder is a plain
      // dismissal back to it. The camera follows once that page is mounted.
      pendingCamera = decision.celebrationId;
      launchStack = [{ name: EVENT_ROUTE, celebrationId: decision.celebrationId }];
      return eventPath(decision.celebrationId);
  }
}

/**
 * Presents a cold-launch camera entry once its event page is the screen — the
 * first moment there is something for the viewfinder to sit on. Consumed
 * whether or not it applies, so it can never fire later on its own.
 *
 * Kept outside the hook on purpose, as is every read and write of this
 * module's state. React Compiler treats module variables as constants inside
 * the hooks it compiles; within one, `const id = pendingCamera` followed by
 * `pendingCamera = null` was rewritten to read `pendingCamera` after it had
 * been cleared, so the camera was never presented.
 */
function presentPendingCamera(navigationRef: NavigationRef): void {
  if (!pendingCamera || !navigationRef.isReady()) return;
  const stack = stackFromState(navigationRef.getRootState());
  // The root navigator has not mounted its screens yet.
  if (stack.length === 0) return;

  const celebrationId = pendingCamera;
  pendingCamera = null;
  const top = stack[stack.length - 1];
  if (top.name !== EVENT_ROUTE || top.celebrationId !== celebrationId) return;

  router.push({
    pathname: '/celebration/[celebrationId]/camera',
    params: { celebrationId },
  });
}

function attachNavigation(navigationRef: NavigationRef): () => void {
  navigation = navigationRef;
  presentPendingCamera(navigationRef);
  const unsubscribe = navigationRef.addListener('state', () => presentPendingCamera(navigationRef));
  return () => {
    unsubscribe();
    if (navigation === navigationRef) navigation = null;
  };
}

/**
 * Mounted once, in the Clip's root layout: gives the entry policy the live
 * stack and presents a waiting camera entry. See `presentPendingCamera`.
 */
export function useSystemEntryCoordinator(): void {
  const navigationRef = useNavigationContainerRef();
  useEffect(() => attachNavigation(navigationRef), [navigationRef]);
}
