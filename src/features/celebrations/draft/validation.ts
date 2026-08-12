import { z } from 'zod';

import { CREATION_STEPS, type CreationDraft, type CreationStep } from './types';

/**
 * Per-step validation.
 *
 * Each step validates only its own fields, so a host can reach step 7 without
 * step 10 complaining. The review step is the only one that checks the whole
 * draft, which is where "you cannot publish yet" belongs.
 *
 * Messages are written to be read by a person under pressure, not by a
 * developer: they say what to do, not what is wrong.
 */

export const nameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your event a name so guests know where they have landed')
    .max(200, 'That name is too long for a guest cover — try something shorter'),
});

export const closingSchema = z
  .object({
    endsAt: z.string().min(1, 'Choose when your event closes'),
    timezone: z.string().min(1),
  })
  .refine(
    (value) => new Date(value.endsAt).getTime() > Date.now(),
    {
      message: 'Choose a closing time in the future',
      path: ['endsAt'],
    },
  );

export const coverSchema = z.object({});

export const photoLimitSchema = z.object({
  // Must select a limit (number) or unlimited (null). Cannot be undefined.
  shotLimitPerGuest: z
    .union([
      z.number().int().positive('A limit has to be at least one photo'),
      z.null(),
    ])
    .refine((val) => val !== undefined, 'Choose how many photos each guest can take'),
});

export const formatsSchema = z.object({
  allowedMediaTypes: z
    .array(z.enum(['photo', 'video', 'audio']))
    .min(1, 'Guests need at least one way to contribute'),
});

export const privacySchema = z.object({
  galleryVisibility: z.enum(['all_guests', 'own_only', 'hosts_only']),
});

export const revealSchema = z
  .object({
    hostRevealChoice: z.enum(['during', 'at_close', 'custom']),
    hostCustomRevealAt: z.string().nullable(),
    guestRevealChoice: z.enum(['during', 'at_close', 'custom', 'never']),
    guestCustomRevealAt: z.string().nullable(),
  })
  .refine(
    (val) => val.hostRevealChoice !== 'custom' || val.hostCustomRevealAt !== null,
    { message: 'Choose a day and time for your custom reveal', path: ['hostCustomRevealAt'] }
  )
  .refine(
    (val) => val.guestRevealChoice !== 'custom' || val.guestCustomRevealAt !== null,
    { message: 'Choose a day and time for the guest custom reveal', path: ['guestCustomRevealAt'] }
  )
  .refine(
    (val) =>
      val.hostRevealChoice !== 'custom' ||
      !val.hostCustomRevealAt ||
      new Date(val.hostCustomRevealAt).getTime() > Date.now(),
    { message: 'Choose a reveal time in the future for yourself', path: ['hostCustomRevealAt'] }
  )
  .refine(
    (val) =>
      val.guestRevealChoice !== 'custom' ||
      !val.guestCustomRevealAt ||
      new Date(val.guestCustomRevealAt).getTime() > Date.now(),
    { message: 'Choose a reveal time in the future for guests', path: ['guestCustomRevealAt'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (val.hostRevealChoice === 'at_close' && val.guestRevealChoice === 'during') {
        return false;
      }
      return true;
    },
    { message: 'Guests cannot view photos before you can view them', path: ['guestRevealChoice'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (val.hostRevealChoice === 'custom' && val.guestRevealChoice !== 'custom') {
        return false;
      }
      return true;
    },
    { message: 'Guests must have a custom reveal if yours is custom', path: ['guestRevealChoice'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (
        val.hostRevealChoice === 'custom' &&
        val.guestRevealChoice === 'custom' &&
        val.hostCustomRevealAt &&
        val.guestCustomRevealAt
      ) {
        return new Date(val.guestCustomRevealAt).getTime() >= new Date(val.hostCustomRevealAt).getTime();
      }
      return true;
    },
    { message: 'Guests cannot view photos before you do', path: ['guestCustomRevealAt'] }
  );

export const hostRevealSchema = z
  .object({
    hostRevealChoice: z.enum(['during', 'at_close', 'custom']),
    hostCustomRevealAt: z.string().nullable(),
  })
  .refine(
    (val) => val.hostRevealChoice !== 'custom' || val.hostCustomRevealAt !== null,
    { message: 'Choose a day and time for your custom reveal', path: ['hostCustomRevealAt'] }
  )
  .refine(
    (val) =>
      val.hostRevealChoice !== 'custom' ||
      !val.hostCustomRevealAt ||
      new Date(val.hostCustomRevealAt).getTime() > Date.now(),
    { message: 'Choose a reveal time in the future for yourself', path: ['hostCustomRevealAt'] }
  );

export const guestRevealSchema = z
  .object({
    hostRevealChoice: z.enum(['during', 'at_close', 'custom']),
    hostCustomRevealAt: z.string().nullable(),
    guestRevealChoice: z.enum(['during', 'at_close', 'custom', 'never']),
    guestCustomRevealAt: z.string().nullable(),
    galleryVisibility: z.enum(['all_guests', 'own_only', 'hosts_only']),
  })
  .refine(
    (val) => val.guestRevealChoice !== 'custom' || val.guestCustomRevealAt !== null,
    { message: 'Choose a day and time for the guest custom reveal', path: ['guestCustomRevealAt'] }
  )
  .refine(
    (val) =>
      val.guestRevealChoice !== 'custom' ||
      !val.guestCustomRevealAt ||
      new Date(val.guestCustomRevealAt).getTime() > Date.now(),
    { message: 'Choose a reveal time in the future for guests', path: ['guestCustomRevealAt'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (val.hostRevealChoice === 'at_close' && val.guestRevealChoice === 'during') {
        return false;
      }
      return true;
    },
    { message: 'Guests cannot view photos before you can view them', path: ['guestRevealChoice'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (val.hostRevealChoice === 'custom' && val.guestRevealChoice !== 'custom') {
        return false;
      }
      return true;
    },
    { message: 'Guests must have a custom reveal if yours is custom', path: ['guestRevealChoice'] }
  )
  .refine(
    (val) => {
      if (val.guestRevealChoice === 'never') {
        return true;
      }

      if (
        val.hostRevealChoice === 'custom' &&
        val.guestRevealChoice === 'custom' &&
        val.hostCustomRevealAt &&
        val.guestCustomRevealAt
      ) {
        return new Date(val.guestCustomRevealAt).getTime() >= new Date(val.hostCustomRevealAt).getTime();
      }
      return true;
    },
    { message: 'Guests cannot view photos before you do', path: ['guestCustomRevealAt'] }
  )
  .refine(
    (val) => (val.guestRevealChoice === 'never' ? val.galleryVisibility === 'hosts_only' : true),
    { message: 'Only you can view the gallery if guests never see the photos', path: ['galleryVisibility'] }
  );

export const packageSchema = z.object({
  planKey: z.string().min(1, 'Choose a package to continue'),
});

/** Everything that must be true before an event can be published. */
export const publishSchema = z.object({
  title: nameSchema.shape.title,
  endsAt: z.string().min(1, 'Your event needs a closing time'),
  planKey: z.string().min(1, 'Choose a package'),
  allowedMediaTypes: formatsSchema.shape.allowedMediaTypes,
});

/** Fields each step is responsible for. Drives the review screen's edit links. */
const STEP_VALIDATORS: Record<CreationStep, (draft: CreationDraft) => string | null> = {
  name: (d) => firstError(nameSchema.safeParse({ title: d.title })),
  closing: (d) =>
    firstError(closingSchema.safeParse({ endsAt: d.endsAt ?? '', timezone: d.timezone })),
  cover: () => firstError(coverSchema.safeParse({})),
  'photo-limit': (d) =>
    firstError(photoLimitSchema.safeParse({ shotLimitPerGuest: d.shotLimitPerGuest })),
  reveal: (d) =>
    firstError(
      hostRevealSchema.safeParse({
        hostRevealChoice: d.hostRevealChoice,
        hostCustomRevealAt: d.hostCustomRevealAt,
      }),
    ),
  'guest-reveal': (d) =>
    firstError(
      guestRevealSchema.safeParse({
        hostRevealChoice: d.hostRevealChoice,
        hostCustomRevealAt: d.hostCustomRevealAt,
        guestRevealChoice: d.guestRevealChoice,
        guestCustomRevealAt: d.guestCustomRevealAt,
        galleryVisibility: d.galleryVisibility,
      }),
    ),
  treatment: () => null,
  package: (d) => firstError(packageSchema.safeParse({ planKey: d.planKey ?? '' })),
};

/**
 * The first message from a failed parse.
 *
 * Typed structurally rather than with a Zod helper type: Zod 4 removed
 * `SafeParseReturnType`, and depending on the library's internal type names
 * makes a routine version bump a compile error across every schema.
 */
function firstError(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? 'Check this step';
}

/** The blocking problem with a step, or null when it is complete. */
export function validateStep(step: CreationStep, draft: CreationDraft): string | null {
  return STEP_VALIDATORS[step](draft);
}

/** Every step that is not yet valid. */
export function incompleteSteps(draft: CreationDraft): CreationStep[] {
  return CREATION_STEPS.filter(
    (step) => validateStep(step, draft) !== null,
  );
}

export function canPublish(draft: CreationDraft): boolean {
  return firstError(
    publishSchema.safeParse({
      title: draft.title,
      endsAt: draft.endsAt ?? '',
      planKey: draft.planKey ?? '',
      allowedMediaTypes: draft.allowedMediaTypes,
    }),
  ) === null;
}
