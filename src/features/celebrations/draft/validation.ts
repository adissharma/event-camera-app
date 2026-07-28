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

export const coverSchema = z.object({
  // The cover image is genuinely optional — a host who has not chosen one gets
  // the default editorial image rather than being blocked.
  supportingLine: z.string().max(140, 'Keep this short — it sits under the title').optional(),
});

export const photoLimitSchema = z.object({
  // null is unlimited, which is a valid choice when the plan grants it.
  shotLimitPerGuest: z
    .number()
    .int()
    .positive('A limit has to be at least one photo')
    .nullable(),
});

export const cameraRollSchema = z.object({
  cameraRollUploadLimit: z
    .number()
    .int()
    .min(0, 'This cannot be negative')
    .max(500, 'That is more than a guest will realistically upload'),
});

export const formatsSchema = z.object({
  allowedMediaTypes: z
    .array(z.enum(['photo', 'video', 'audio']))
    .min(1, 'Guests need at least one way to contribute'),
});

export const privacySchema = z
  .object({
    galleryVisibility: z.enum(['all_guests', 'own_only', 'hosts_only']),
    pinRequired: z.boolean(),
    pin: z.string().nullable(),
  })
  .refine(
    (value) => !value.pinRequired || (value.pin !== null && /^\d{4,8}$/.test(value.pin)),
    {
      message: 'Choose a PIN of 4 to 8 digits, or turn the PIN off',
      path: ['pin'],
    },
  );

export const revealSchema = z
  .object({
    revealChoice: z.enum(['during', 'at_close', 'after_12h', 'after_24h', 'custom', 'manual']),
    customRevealAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .refine((value) => value.revealChoice !== 'custom' || value.customRevealAt !== null, {
    message: 'Choose when the photos should appear',
    path: ['customRevealAt'],
  })
  .refine(
    (value) => {
      // A reveal before the event closes means guests see the gallery while
      // still shooting, which contradicts the delayed-reveal promise.
      if (value.revealChoice !== 'custom' || !value.customRevealAt || !value.endsAt) return true;
      return new Date(value.customRevealAt).getTime() >= new Date(value.endsAt).getTime();
    },
    {
      message: 'The reveal cannot be before your event closes',
      path: ['customRevealAt'],
    },
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
  cover: (d) => firstError(coverSchema.safeParse({ supportingLine: d.supportingLine })),
  'photo-limit': (d) =>
    firstError(photoLimitSchema.safeParse({ shotLimitPerGuest: d.shotLimitPerGuest })),
  'camera-roll': (d) =>
    firstError(cameraRollSchema.safeParse({ cameraRollUploadLimit: d.cameraRollUploadLimit })),
  formats: (d) => firstError(formatsSchema.safeParse({ allowedMediaTypes: d.allowedMediaTypes })),
  privacy: (d) =>
    firstError(
      privacySchema.safeParse({
        galleryVisibility: d.galleryVisibility,
        pinRequired: d.pinRequired,
        pin: d.pin,
      }),
    ),
  reveal: (d) =>
    firstError(
      revealSchema.safeParse({
        revealChoice: d.revealChoice,
        customRevealAt: d.customRevealAt,
        endsAt: d.endsAt,
      }),
    ),
  treatment: () => null,
  package: (d) => firstError(packageSchema.safeParse({ planKey: d.planKey ?? '' })),
  qr: () => null,
  review: (d) =>
    firstError(
      publishSchema.safeParse({
        title: d.title,
        endsAt: d.endsAt ?? '',
        planKey: d.planKey ?? '',
        allowedMediaTypes: d.allowedMediaTypes,
      }),
    ),
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

/** Every step that is not yet valid. Used by the review screen. */
export function incompleteSteps(draft: CreationDraft): CreationStep[] {
  return CREATION_STEPS.filter(
    (step) => step !== 'review' && validateStep(step, draft) !== null,
  );
}

export function canPublish(draft: CreationDraft): boolean {
  return validateStep('review', draft) === null;
}
