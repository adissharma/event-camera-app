import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LOCALE_CONFIG } from '@/config/app-config';
import { useAuth } from '@/features/auth/context';
import {
  CREATION_STEPS,
  DRAFT_VERSION,
  createEmptyDraft,
  type CreationDraft,
  type CreationStep,
} from './types';

/**
 * Durable creation draft.
 *
 * Persisted to AsyncStorage rather than SecureStore: none of it is sensitive,
 * and SecureStore's 2048-byte per-value cap would require chunking a payload
 * that only grows.
 *
 * Writes are debounced. A live cover editor fires an update on every keystroke,
 * and writing to disk on each one makes typing stutter on an older phone.
 */

const DEBOUNCE_MS = 400;

function storageKey(userId: string | null): string {
  // Namespaced by user so signing into a second account on a shared phone
  // never restores someone else's half-finished event.
  return `creation-draft:${userId ?? 'anonymous'}`;
}

type DraftAction =
  | { type: 'patch'; patch: Partial<CreationDraft> }
  | { type: 'replace'; draft: CreationDraft }
  | { type: 'reset'; userId: string | null; timezone: string }
  | { type: 'reachedStep'; step: CreationStep };

function reducer(state: CreationDraft, action: DraftAction): CreationDraft {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch, updatedAt: new Date().toISOString() };

    case 'replace':
      return action.draft;

    case 'reset':
      return createEmptyDraft(action.userId, action.timezone);

    case 'reachedStep': {
      // Only ever moves forward. Navigating back to an earlier step must not
      // discard the fact that later steps were already answered.
      const current = CREATION_STEPS.indexOf(state.furthestStep);
      const next = CREATION_STEPS.indexOf(action.step);
      if (next <= current) return state;
      return { ...state, furthestStep: action.step, updatedAt: new Date().toISOString() };
    }
  }
}

interface DraftContextValue {
  draft: CreationDraft;
  /** False until any persisted draft has been read from disk. */
  isRestoring: boolean;
  /** True when a previously saved draft was found and restored. */
  wasRestored: boolean;
  update: (patch: Partial<CreationDraft>) => void;
  markStepReached: (step: CreationStep) => void;
  reset: () => Promise<void>;
}

const DraftContext = createContext<DraftContextValue | null>(null);

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || LOCALE_CONFIG.fallbackTimezone;
  } catch {
    return LOCALE_CONFIG.fallbackTimezone;
  }
}

export function CreationDraftProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [draft, dispatch] = useReducer(
    reducer,
    undefined,
    () => createEmptyDraft(userId, deviceTimezone()),
  );
  const [isRestoring, setIsRestoring] = useState(true);
  const [wasRestored, setWasRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestored = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (cancelled) return;

        if (raw) {
          const parsed = JSON.parse(raw) as CreationDraft;
          // A draft written by an older build may not match the current shape.
          // Discarding is safer than rendering a form from a half-known object.
          if (parsed.version === DRAFT_VERSION) {
            dispatch({ type: 'replace', draft: { ...parsed, userId } });
            setWasRestored(true);
          }
        }
      } catch {
        // Corrupt JSON is treated as no draft. Starting fresh is recoverable;
        // crashing on the create screen is not.
      } finally {
        if (!cancelled) {
          hasRestored.current = true;
          setIsRestoring(false);
        }
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced autosave. Skipped until the restore has finished, so an empty
  // initial draft never overwrites a saved one during the first render.
  useEffect(() => {
    if (!hasRestored.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void AsyncStorage.setItem(storageKey(userId), JSON.stringify(draft)).catch(() => {
        // A failed write must not interrupt the host. The draft still lives in
        // memory; only the crash-recovery guarantee is lost.
      });
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, userId]);

  const update = useCallback((patch: Partial<CreationDraft>) => {
    dispatch({ type: 'patch', patch });
  }, []);

  const markStepReached = useCallback((step: CreationStep) => {
    dispatch({ type: 'reachedStep', step });
  }, []);

  const reset = useCallback(async () => {
    dispatch({ type: 'reset', userId, timezone: deviceTimezone() });
    await AsyncStorage.removeItem(storageKey(userId)).catch(() => {});
  }, [userId]);

  const value = useMemo<DraftContextValue>(
    () => ({ draft, isRestoring, wasRestored, update, markStepReached, reset }),
    [draft, isRestoring, wasRestored, update, markStepReached, reset],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useCreationDraft(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useCreationDraft must be used inside CreationDraftProvider');
  }
  return context;
}
