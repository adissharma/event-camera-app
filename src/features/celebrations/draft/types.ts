import type {
  CaptureMode,
  CelebrationType,
  GalleryVisibility,
  InspirationPack,
  MediaType,
  PhotoTreatment,
  RevealMode,
} from '@/types/database';

/**
 * The event-creation draft.
 *
 * Held in one typed object rather than scattered across screen state, because
 * it has to survive being backgrounded, killed by the OS, and reopened hours
 * later. A host configuring a wedding will not do it in one sitting, and losing
 * their work is the fastest way to lose the customer.
 *
 * Every field is optional-with-a-default rather than required: a draft is a
 * partially-answered form by definition, and modelling it as "eventually
 * complete" avoids a pile of non-null assertions at every step.
 */

/** Steps in order. The review step reads all of them. */
export const CREATION_STEPS = [
  'name',
  'closing',
  'cover',
  'photo-limit',
  'reveal',
  'treatment',
  'package',
] as const;

export type CreationStep = (typeof CREATION_STEPS)[number];

/** Reveal choices as presented to the host, mapped to the database model. */
export type RevealChoice = 'during' | 'at_close' | 'custom';

export interface CreationDraft {
  /** Bumped when the shape changes so a stale persisted draft is discarded. */
  version: number;
  /** Scopes the draft to a user, so one account never restores another's work. */
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  editCelebrationId: string | null;

  // Step 1
  title: string;
  celebrationType: CelebrationType;
  inspirationPack: InspirationPack;

  // Step 2
  /** ISO. The moment guests can no longer capture. */
  endsAt: string | null;
  timezone: string;

  // Step 3
  themeSlug: string | null;
  /** Local file URI until uploaded. */
  coverLocalUri: string | null;
  coverStoragePath: string | null;
  /** Editable line under the title on the guest cover. */
  supportingLine: string;
  /** What the guest cover displays. May differ from the closing date. */
  displayDate: string | null;
  /**
   * Free text shown where the date sits on the cover.
   *
   * Deliberately a string rather than a date: hosts write things a formatter
   * cannot produce — "Saturday, at last", "The big day", a venue name. When
   * null the cover falls back to the formatted closing date.
   */
  coverDateLabel: string | null;

  // Step 4. `null` means unlimited.
  shotLimitPerGuest: number | null;

  // Step 5
  cameraRollUploadsEnabled: boolean;
  cameraRollUploadLimit: number;
  /** Only meaningful when `cameraRollUploadsEnabled`. */
  cameraRollAnytime: boolean;
  allowMediaFromAnyDate: boolean;

  // Step 6
  allowedMediaTypes: MediaType[];
  captureMode: CaptureMode;

  // Step 7
  galleryVisibility: GalleryVisibility;
  guestDownloadsEnabled: boolean;

  // Step 8
  revealChoice: RevealChoice;
  /** Only when revealChoice is 'custom'. */
  customRevealAt: string | null;

  hostRevealChoice: RevealChoice;
  hostCustomRevealAt: string | null;
  guestRevealChoice: RevealChoice;
  guestCustomRevealAt: string | null;

  // Step 9
  photoTreatment: PhotoTreatment;
  dateStampEnabled: boolean;

  // Step 10
  planKey: string | null;
  addOnKeys: string[];

  // Step 11
  qrTemplateKey: string;

  /** Furthest step reached, so resuming lands where the host left off. */
  furthestStep: CreationStep;
  editCelebrationId?: string | null;
  editSessionId?: string | null;
}

// 6: added hostRevealChoice, hostCustomRevealAt, guestRevealChoice, guestCustomRevealAt
export const DRAFT_VERSION = 6;

export function createEmptyDraft(userId: string | null, timezone: string): CreationDraft {
  const now = new Date().toISOString();
  return {
    version: DRAFT_VERSION,
    userId,
    createdAt: now,
    updatedAt: now,

    title: '',
    celebrationType: 'wedding',
    inspirationPack: 'universal',

    endsAt: null,
    timezone,

    themeSlug: null,
    coverLocalUri: null,
    coverStoragePath: null,
    supportingLine: '',
    displayDate: null,
    coverDateLabel: null,

    shotLimitPerGuest: 20,

    cameraRollUploadsEnabled: true,
    cameraRollUploadLimit: 5,
    cameraRollAnytime: true,
    allowMediaFromAnyDate: false,

    allowedMediaTypes: ['photo'],
    captureMode: 'camera_and_library',

    galleryVisibility: 'all_guests',
    guestDownloadsEnabled: true,

    revealChoice: 'at_close',
    customRevealAt: null,

    hostRevealChoice: 'at_close',
    hostCustomRevealAt: null,
    guestRevealChoice: 'at_close',
    guestCustomRevealAt: null,

    photoTreatment: 'original',
    dateStampEnabled: false,

    planKey: null,
    addOnKeys: [],

    qrTemplateKey: 'digital_card',

    furthestStep: 'name',
    editCelebrationId: null,
    editSessionId: null,
  };
}

/**
 * Resolves the host's reveal choice into the database's reveal model.
 *
 * Kept as a pure function so the mapping is testable without a backend — the
 * relationship between "12 hours after" and an absolute timestamp is exactly
 * the kind of thing that silently drifts across a daylight-saving boundary.
 */
export function resolveReveal(
  choice: RevealChoice,
  endsAt: string | null,
  customRevealAt: string | null,
): { mode: RevealMode; revealAt: string | null } {
  switch (choice) {
    case 'during':
      return { mode: 'instant', revealAt: null };
    case 'at_close':
      return endsAt
        ? { mode: 'scheduled', revealAt: endsAt }
        : // Falling back to manual rather than inventing a time: nothing to
          // schedule against yet if the closing time isn't set.
          { mode: 'manual', revealAt: null };
    case 'custom':
      return customRevealAt
        ? { mode: 'scheduled', revealAt: customRevealAt }
        : // A wrong reveal time is worse than asking the host to press a
          // button, so a custom choice with nothing picked yet falls back
          // to manual rather than inventing a time.
          { mode: 'manual', revealAt: null };
  }
}
