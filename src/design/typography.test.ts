import { DISPLAY_OPTICAL_SCALE, fitDisplayFace, fontFamilies, typography } from './typography';

describe('fitDisplayFace', () => {
  it('leaves text faces alone', () => {
    const body = typography.body;
    expect(fitDisplayFace(body)).toBe(body);
  });

  it('scales display sizes to the display face', () => {
    const fitted = fitDisplayFace({ fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 60 });
    expect(fitted.fontSize).toBeCloseTo(40 * DISPLAY_OPTICAL_SCALE, 0);
  });

  it('never sets a display line tighter than the font needs to avoid clipping', () => {
    for (const token of ['displayHero', 'displayLarge', 'titleLarge', 'titleMedium'] as const) {
      const fitted = fitDisplayFace(typography[token]);
      expect(fitted.lineHeight).toBeGreaterThanOrEqual((fitted.fontSize as number) * 1.15);
    }
    // The event page's title: 40 on 44 was tuned for Cormorant and clipped.
    const title = fitDisplayFace({ fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 44 });
    expect(title.lineHeight).toBeGreaterThanOrEqual((title.fontSize as number) * 1.15);
  });
});
