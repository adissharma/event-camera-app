import { normalisePhotoTreatment } from './photo-treatment';

describe('normalisePhotoTreatment', () => {
  it('passes through the supported treatments', () => {
    expect(normalisePhotoTreatment('disposable')).toBe('disposable');
    expect(normalisePhotoTreatment('black_and_white')).toBe('black_and_white');
    expect(normalisePhotoTreatment('original')).toBe('original');
  });

  it('falls back to original for the retired warm_film value', () => {
    expect(normalisePhotoTreatment('warm_film')).toBe('original');
  });

  it('falls back to original for null and undefined', () => {
    expect(normalisePhotoTreatment(null)).toBe('original');
    expect(normalisePhotoTreatment(undefined)).toBe('original');
  });
});
