import { copy } from '@/i18n';
import type { PhotoTreatment } from '@/types/database';

/**
 * Treatments the product actually offers today. `PhotoTreatment` — the
 * database enum — is wider: it still carries `warm_film`, retired from the
 * picker but left in the schema rather than migrated away, since existing
 * rows may still reference it and dropping a Postgres enum value is not a
 * clean operation. Anything read from the database is normalised through
 * `normalisePhotoTreatment` before it reaches an option list or a render.
 */
export type SupportedPhotoTreatment = 'original' | 'disposable' | 'black_and_white';

export interface PhotoTreatmentOption {
  value: SupportedPhotoTreatment;
  label: string;
  description: string;
}

export const PHOTO_TREATMENT_OPTIONS: PhotoTreatmentOption[] = [
  {
    value: 'original',
    label: copy.create.treatmentOriginal,
    description: 'Exactly as the camera saw it.',
  },
  {
    value: 'disposable',
    label: copy.create.treatmentDisposable,
    description: 'Direct flash, a little grain, a printed date stamp.',
  },
  {
    value: 'black_and_white',
    label: copy.create.treatmentBlackAndWhite,
    description: 'Quiet and timeless.',
  },
];

/** Falls back to `'original'` for `warm_film`, `null`, or anything unset. */
export function normalisePhotoTreatment(
  value: PhotoTreatment | null | undefined,
): SupportedPhotoTreatment {
  return value === 'disposable' || value === 'black_and_white' ? value : 'original';
}

/** A 4x5 row-major colour matrix, the same convention `disposable-recipe.ts` uses. */
export type Matrix = number[];

export interface TreatmentVisual {
  /**
   * A static per-pixel colour transform, applied on native via
   * `react-native-color-matrix-image-filters`' `ColorMatrix` component
   * (`treated-photo.tsx`) and on web via a CSS `filter` built from the same
   * numbers (`treated-photo.web.tsx`). That native package is native-only —
   * it imports `codegenNativeComponent`, which throws Metro's web bundler —
   * so this module (imported far too widely to risk that) computes the
   * matrix itself rather than importing the package just for its maths.
   *
   * `null` for `original` (renders the bare image) and for `disposable`,
   * which is not a single static matrix at all: it composites a whole stack
   * of effects on a Skia canvas, with a colour matrix randomised per photo.
   * See `disposable-recipe.ts` and `DisposablePhoto`.
   */
  colorMatrix: Matrix | null;
}

/**
 * Full-strength Rec.709 luminance grayscale — the `grayscale(1)` case of
 * `react-native-color-matrix-image-filters`' filter (verified against its
 * source), which at full strength reduces to exactly this matrix. Desaturates
 * via luminance weighting rather than a `mixBlendMode: 'color'` overlay
 * approximating it, so contrast and detail read the way an actual monochrome
 * photo does.
 */
const GRAYSCALE: Matrix = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * What each treatment looks like, for the treatments expressible as one
 * static matrix.
 *
 * Kept as plain data — no React, no dependency on how a photo is displayed —
 * so a future bulk-export step can read the same numbers instead of
 * re-deriving the look. `disposable`'s equivalent lives in
 * `disposable-recipe.ts` for the same reason.
 */
export const TREATMENT_VISUALS: Record<SupportedPhotoTreatment, TreatmentVisual> = {
  original: {
    colorMatrix: null,
  },
  black_and_white: {
    colorMatrix: GRAYSCALE,
  },
  disposable: {
    colorMatrix: null,
  },
};

/**
 * "'26  08  09" — a classic disposable-camera / instant-print date stamp:
 * two-digit year, then month and day, space-separated, apostrophe-prefixed
 * year. Pure so both the live gallery and the onboarding preview format the
 * same way from one definition.
 */
export function formatDisposableDateStamp(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `'${yy}  ${mm}  ${dd}`;
}
