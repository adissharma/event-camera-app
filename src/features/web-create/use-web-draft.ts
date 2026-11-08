import { useCallback, useEffect, useState } from 'react';

import { LOCALE_CONFIG } from '@/config/app-config';
import { RECOMMENDED_PLAN_ID, getPaywallPlan } from '@/features/payments/plan-catalogue';
import {
  DRAFT_VERSION,
  createEmptyDraft,
  type CreationDraft,
} from '@/features/celebrations/draft/types';

/**
 * The web form's draft, kept in this browser.
 *
 * Not the app's `CreationDraftProvider`: that one is namespaced by user, which
 * is right on a phone that is always signed in but wrong here, where the host
 * fills everything in first and signs in at the end. Its per-user key would
 * swap the half-finished form for an empty one the moment they signed in.
 *
 * Survives a reload on purpose. Signing in with Apple or Google leaves the page
 * for the provider and comes back, and the form has to be exactly where the
 * host left it.
 */

const STORAGE_KEY = 'stills:web-create-draft';
const SAVE_DELAY_MS = 300;

export const WEB_CREATE_STEPS = ['event', 'look', 'guests', 'package', 'review'] as const;
export type WebCreateStep = (typeof WEB_CREATE_STEPS)[number];

interface Stored {
  draft: CreationDraft;
  step: WebCreateStep;
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || LOCALE_CONFIG.fallbackTimezone;
  } catch {
    return LOCALE_CONFIG.fallbackTimezone;
  }
}

function freshDraft(): CreationDraft {
  return {
    ...createEmptyDraft(null, deviceTimezone()),
    themeSlug: 'editorial',
    shotLimitPerGuest: 16,
    planKey: getPaywallPlan(RECOMMENDED_PLAN_ID)?.catalogueKey ?? null,
  };
}

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      if (parsed.draft?.version === DRAFT_VERSION && parsed.step) {
        return {
          draft: { ...freshDraft(), ...parsed.draft },
          step: WEB_CREATE_STEPS.includes(parsed.step) ? parsed.step : 'event',
        };
      }
    }
  } catch {
    // Unreadable or blocked storage starts a clean form.
  }
  return { draft: freshDraft(), step: 'event' };
}

function save(value: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A full or blocked store only costs resuming after a reload.
  }
}

export function clearWebDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function useWebDraft() {
  // Read on mount rather than in the initialiser: the static export renders
  // this page on the server, where there is no `window`.
  const [state, setState] = useState<Stored | null>(null);

  useEffect(() => {
    setState(load());
  }, []);

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => save(state), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const update = useCallback((patch: Partial<CreationDraft>) => {
    setState((current) =>
      current
        ? { ...current, draft: { ...current.draft, ...patch, updatedAt: new Date().toISOString() } }
        : current,
    );
  }, []);

  const goTo = useCallback((step: WebCreateStep) => {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, step };
      // Saved at once, not on the debounce: the next thing may be a redirect.
      save(next);
      return next;
    });
  }, []);

  /** `update`, written to storage at once rather than on the debounce. */
  const commit = useCallback((patch: Partial<CreationDraft>) => {
    setState((current) => {
      if (!current) return current;
      const next = { ...current, draft: { ...current.draft, ...patch, updatedAt: new Date().toISOString() } };
      save(next);
      return next;
    });
  }, []);

  /** Starts a clean form, for when the saved one has already become an event. */
  const restart = useCallback(() => {
    clearWebDraft();
    setState({ draft: freshDraft(), step: 'event' });
  }, []);

  const flush = useCallback(() => {
    if (state) save(state);
  }, [state]);

  return {
    isReady: state !== null,
    draft: state?.draft ?? null,
    step: state?.step ?? 'event',
    update,
    commit,
    goTo,
    flush,
    restart,
  };
}
