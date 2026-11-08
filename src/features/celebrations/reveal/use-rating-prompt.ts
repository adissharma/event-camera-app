import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import type { RevealMode } from '@/types/database';
import { serverNow } from '@/services/server-time';
import { askForRatingOnce, isRatingMoment } from './rating-prompt';

export interface UseRatingPromptOptions {
  /** A real host on a real event, in the full app. */
  enabled: boolean;
  /** Something else has the screen. The wait starts over once it's gone. */
  paused: boolean;
  endsAt: string | null | undefined;
  revealAt: string | null | undefined;
  revealMode: RevealMode | null | undefined;
  photoCount: number;
}

/** Long enough to take in the gallery first. Apple asks that the sheet never interrupts. */
const SETTLE_MS = 3000;

/**
 * Asks a host for a rating once they've settled on their revealed gallery.
 *
 * Not tied to the reveal modal, because a host who opened a photo during the
 * party never gets that modal: seeing the photos counts as having had the news.
 */
export function useRatingPrompt({ enabled, paused, endsAt, revealAt, revealMode, photoCount }: UseRatingPromptOptions): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled || paused) return;

      // Checked on a timer so a reveal that lands while the screen is open still counts.
      const timer = setInterval(() => {
        if (AppState.currentState !== 'active') return;
        if (!isRatingMoment({ now: serverNow(), endsAt, revealAt, revealMode, photoCount })) return;
        clearInterval(timer);
        void askForRatingOnce(serverNow());
      }, SETTLE_MS);

      return () => clearInterval(timer);
    }, [enabled, paused, endsAt, revealAt, revealMode, photoCount]),
  );
}
