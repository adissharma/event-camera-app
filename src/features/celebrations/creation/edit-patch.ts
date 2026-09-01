import { resolveReveal, type CreationDraft, type CreationStep } from '../draft/types';
import type { EventSettingsPatch } from '@/services/celebration-detail';

/**
 * What each step writes back when a *published* event is edited.
 *
 * Deliberately free of React, expo-router and Supabase imports, so it can be
 * tested directly — the same reason `disposable-recipe.ts` is kept separate
 * from the component that renders it.
 *
 * It is worth that separation because the failure mode here is silent: a step
 * that renders a control but omits its field from this patch saves nothing,
 * reports no error, and looks exactly like a working screen — the host toggles
 * a setting, watches Save succeed, and finds the setting unchanged. That is
 * precisely how `captureMode` (the camera-roll toggle, which lives on the
 * photo-limit step) went unsaved: only `shotLimitPerGuest` was being sent.
 *
 * A step absent from this map intentionally writes nothing: `cover` saves
 * itself via its own `onSave`, and `package` is not editable after publish.
 */
export function buildEditPatch(step: CreationStep, draft: CreationDraft): EventSettingsPatch {
  switch (step) {
    case 'name':
      return { title: draft.title };

    case 'closing':
      return { endsAt: draft.endsAt };

    case 'photo-limit':
      return {
        // `undefined` means "not yet chosen". Sending it would leave the
        // column untouched while still reporting a successful save.
        shotLimitPerGuest: draft.shotLimitPerGuest ?? null,
        captureMode: draft.captureMode,
      };

    case 'reveal': {
      const { mode, revealAt } = resolveReveal(
        draft.guestRevealChoice,
        draft.endsAt,
        draft.guestCustomRevealAt,
      );
      return {
        revealMode: mode,
        revealAt,
        galleryVisibility: draft.galleryVisibility,
      };
    }

    case 'treatment':
      return { photoTreatment: draft.photoTreatment, dateStampEnabled: draft.dateStampEnabled };

    case 'cover':
      return draft.themeSlug ? { themeSlug: draft.themeSlug } : {};

    default:
      return {};
  }
}
