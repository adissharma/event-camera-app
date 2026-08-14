import { buildEditPatch } from './edit-patch';
import { createEmptyDraft, type CreationDraft } from '../draft/types';

/**
 * Editing a *published* event goes through `buildEditPatch`. The failure this
 * file exists to catch is silent: a step renders a control, the host changes
 * it, Save succeeds — and nothing was written, because the field never made it
 * into the patch. That is exactly how the camera-roll toggle appeared to do
 * nothing for months of use; it lives on the photo-limit step, and only
 * `shotLimitPerGuest` was being sent.
 */

const TZ = 'Europe/London';

function draftWith(overrides: Partial<CreationDraft>): CreationDraft {
  return { ...createEmptyDraft('user-1', TZ), ...overrides };
}

describe('buildEditPatch', () => {
  describe('photo-limit', () => {
    it('saves the camera-roll toggle, not just the shot limit', () => {
      const off = buildEditPatch('photo-limit', draftWith({ captureMode: 'camera_only' }));
      expect(off.captureMode).toBe('camera_only');

      const on = buildEditPatch(
        'photo-limit',
        draftWith({ captureMode: 'camera_and_library' }),
      );
      expect(on.captureMode).toBe('camera_and_library');
    });

    it('saves every control the step renders', () => {
      // Guards against a control being added to the screen without being
      // added here — the shape of the original bug.
      const patch = buildEditPatch(
        'photo-limit',
        draftWith({
          shotLimitPerGuest: 15,
          captureMode: 'camera_only',
          galleryVisibility: 'own_only',
        }),
      );
      expect(patch).toEqual({
        shotLimitPerGuest: 15,
        captureMode: 'camera_only',
      });
    });

    it('carries unlimited through as null rather than dropping it', () => {
      expect(buildEditPatch('photo-limit', draftWith({ shotLimitPerGuest: null })))
        .toMatchObject({ shotLimitPerGuest: null });
    });

    it('never sends undefined, which would read as "no change"', () => {
      // A draft that never reached the step has `undefined` here; sending it
      // would leave the column untouched while reporting a successful save.
      const patch = buildEditPatch('photo-limit', draftWith({ shotLimitPerGuest: undefined }));
      expect(patch.shotLimitPerGuest).toBeNull();
      expect(Object.values(patch)).not.toContain(undefined);
    });
  });

  describe('other steps', () => {
    it('saves the title', () => {
      expect(buildEditPatch('name', draftWith({ title: 'Priya & Arjun' }))).toEqual({
        title: 'Priya & Arjun',
      });
    });

    it('saves the closing time', () => {
      const endsAt = '2026-09-01T18:00:00.000Z';
      expect(buildEditPatch('closing', draftWith({ endsAt }))).toEqual({ endsAt });
    });

    it('resolves the reveal into a mode and a timestamp', () => {
      const endsAt = new Date(Date.now() + 86_400_000).toISOString();
      expect(
        buildEditPatch('reveal', draftWith({ guestRevealChoice: 'at_close', endsAt })),
      ).toEqual({ revealMode: 'scheduled', revealAt: endsAt, galleryVisibility: 'all_guests' });
    });

    it('saves host-only reveal visibility when guests should never see photos', () => {
      expect(
        buildEditPatch(
          'reveal',
          draftWith({ guestRevealChoice: 'never', galleryVisibility: 'hosts_only' }),
        ),
      ).toEqual({ revealMode: 'manual', revealAt: null, galleryVisibility: 'hosts_only' });
    });

    it('saves the date stamp alongside the treatment', () => {
      // Both are chosen on the treatment step, so both must be written.
      expect(
        buildEditPatch(
          'treatment',
          draftWith({ photoTreatment: 'disposable', dateStampEnabled: true }),
        ),
      ).toEqual({ photoTreatment: 'disposable', dateStampEnabled: true });
    });

    it('writes nothing for steps that are not editable after publish', () => {
      expect(buildEditPatch('package', draftWith({}))).toEqual({});
      // The cover step saves itself through its own onSave.
      expect(buildEditPatch('cover', draftWith({}))).toEqual({});
    });
  });
});
