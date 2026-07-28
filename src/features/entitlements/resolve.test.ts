import {
  entitlementBoolean,
  entitlementNumber,
  isWithinAllowance,
  photoLimitOptions,
  resolveEntitlements,
  type EntitlementDefinition,
} from './resolve';

const definitions: EntitlementDefinition[] = [
  { key: 'participant_limit', combineStrategy: 'sum', defaultValue: 30 },
  { key: 'gallery_retention_days', combineStrategy: 'sum', defaultValue: 90 },
  { key: 'cohost_count', combineStrategy: 'max', defaultValue: 0 },
  { key: 'camera_roll_upload_limit', combineStrategy: 'max', defaultValue: 5 },
  { key: 'unlimited_photos', combineStrategy: 'any_true', defaultValue: false },
  { key: 'memory_book', combineStrategy: 'any_true', defaultValue: false },
  { key: 'photo_limit_options', combineStrategy: 'union', defaultValue: [5, 10, 15] },
  { key: 'qr_templates', combineStrategy: 'union', defaultValue: ['digital_card'] },
  { key: 'support_level', combineStrategy: 'override', defaultValue: 'standard' },
];

describe('entitlement resolution', () => {
  it('falls back to the default for a key nobody granted', () => {
    const resolved = resolveEntitlements(definitions, []);
    expect(resolved.participant_limit).toBe(30);
    expect(resolved.unlimited_photos).toBe(false);
    expect(resolved.support_level).toBe('standard');
  });

  it('includes every defined key, so the UI never sees an absent entitlement', () => {
    const resolved = resolveEntitlements(definitions, [{ key: 'cohost_count', value: 3 }]);
    for (const definition of definitions) {
      expect(resolved).toHaveProperty(definition.key);
    }
  });

  describe('sum — an allowance an add-on extends', () => {
    it('adds an add-on to the plan allowance', () => {
      // The bug this strategy exists to prevent: buying "extra guests" on a
      // 150-guest plan must not be a no-op just because the add-on grants 100.
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: 150, rank: 10 },
        { key: 'participant_limit', value: 100, rank: 1 },
      ]);
      expect(resolved.participant_limit).toBe(250);
    });

    it('adds multiple add-ons of the same kind', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: 50 },
        { key: 'participant_limit', value: 100 },
        { key: 'participant_limit', value: 100 },
      ]);
      expect(resolved.participant_limit).toBe(250);
    });

    it('extends gallery retention', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'gallery_retention_days', value: 365 },
        { key: 'gallery_retention_days', value: 730 },
      ]);
      expect(resolved.gallery_retention_days).toBe(1095);
    });
  });

  describe('max — a cap an add-on raises', () => {
    it('takes the highest value rather than adding', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'cohost_count', value: 3 },
        { key: 'cohost_count', value: 10 },
      ]);
      expect(resolved.cohost_count).toBe(10);
    });
  });

  describe('unlimited', () => {
    it('beats every finite value under max', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'cohost_count', value: 3 },
        { key: 'cohost_count', value: null },
      ]);
      expect(resolved.cohost_count).toBeNull();
    });

    it('absorbs a sum rather than being treated as zero', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: null },
        { key: 'participant_limit', value: 100 },
      ]);
      expect(resolved.participant_limit).toBeNull();
    });
  });

  describe('any_true — a capability', () => {
    it('is granted if any source grants it', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'unlimited_photos', value: false },
        { key: 'unlimited_photos', value: true },
      ]);
      expect(resolved.unlimited_photos).toBe(true);
    });

    it('stays false when no source grants it', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'unlimited_photos', value: false },
        { key: 'unlimited_photos', value: false },
      ]);
      expect(resolved.unlimited_photos).toBe(false);
    });
  });

  describe('union — a list of permitted choices', () => {
    it('merges and de-duplicates', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'qr_templates', value: ['digital_card', 'a4_poster'] },
        { key: 'qr_templates', value: ['a4_poster', 'table_card'] },
      ]);
      expect(resolved.qr_templates).toEqual(['digital_card', 'a4_poster', 'table_card']);
    });

    it('keeps numeric options ordered for display', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'photo_limit_options', value: [25, 5] },
        { key: 'photo_limit_options', value: [15, 10] },
      ]);
      expect(resolved.photo_limit_options).toEqual([5, 10, 15, 25]);
    });
  });

  describe('override — highest-ranked source wins', () => {
    it('prefers the higher rank regardless of order', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'support_level', value: 'standard', rank: 1 },
        { key: 'support_level', value: 'priority', rank: 10 },
      ]);
      expect(resolved.support_level).toBe('priority');
    });
  });

  describe('photoLimitOptions', () => {
    it('offers unlimited only when the plan grants it', () => {
      // The brief is explicit: unlimited is a configured upsell, never a
      // hard-coded amount, and the UI must not render a control that fails.
      const withoutUnlimited = resolveEntitlements(definitions, [
        { key: 'photo_limit_options', value: [5, 10, 15, 25] },
        { key: 'unlimited_photos', value: false },
      ]);
      expect(photoLimitOptions(withoutUnlimited)).toEqual([5, 10, 15, 25]);

      const withUnlimited = resolveEntitlements(definitions, [
        { key: 'photo_limit_options', value: [5, 10, 15, 25] },
        { key: 'unlimited_photos', value: true },
      ]);
      expect(photoLimitOptions(withUnlimited)).toEqual([5, 10, 15, 25, null]);
    });
  });

  describe('accessors', () => {
    it('reads booleans with a fallback', () => {
      const resolved = resolveEntitlements(definitions, []);
      expect(entitlementBoolean(resolved, 'memory_book')).toBe(false);
      expect(entitlementBoolean(resolved, 'nonexistent', true)).toBe(true);
    });

    it('maps unlimited to null rather than a number', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: null },
      ]);
      expect(entitlementNumber(resolved, 'participant_limit')).toBeNull();
    });
  });

  describe('isWithinAllowance', () => {
    it('enforces a finite allowance at the boundary', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: 50 },
      ]);
      expect(isWithinAllowance(resolved, 'participant_limit', 50)).toBe(true);
      expect(isWithinAllowance(resolved, 'participant_limit', 51)).toBe(false);
    });

    it('always permits under an unlimited allowance', () => {
      const resolved = resolveEntitlements(definitions, [
        { key: 'participant_limit', value: null },
      ]);
      expect(isWithinAllowance(resolved, 'participant_limit', 10_000)).toBe(true);
    });
  });
});
