import {
  SEGMENTS_BY_DIGIT,
  STAMP_METRICS,
  formatDisposableDateStamp,
  layoutDateStamp,
} from './disposable-date-stamp';

describe('formatDisposableDateStamp', () => {
  it("formats as 'yy mm dd", () => {
    expect(formatDisposableDateStamp(new Date(2026, 7, 9))).toBe("'26 08 09");
  });

  it('pads single-digit month and day', () => {
    expect(formatDisposableDateStamp(new Date(2031, 0, 5))).toBe("'31 01 05");
  });

  it('matches the reference imprint', () => {
    expect(formatDisposableDateStamp(new Date(1999, 11, 29))).toBe("'99 12 29");
  });
});

describe('seven-segment table', () => {
  /*
   * A wrong segment renders a legible-but-wrong digit — a 6 that reads as an
   * 8, say — which is the kind of thing that survives every visual check and
   * then prints the wrong date onto somebody's wedding photos. Hence a table
   * rather than an eyeball.
   */
  const EXPECTED: Record<string, number> = {
    '0': 6, '1': 2, '2': 5, '3': 5, '4': 4, '5': 5, '6': 6, '7': 3, '8': 7, '9': 6,
  };

  it('lights the right number of segments for every digit', () => {
    for (const [digit, count] of Object.entries(EXPECTED)) {
      expect(`${digit}:${SEGMENTS_BY_DIGIT[digit].length}`).toBe(`${digit}:${count}`);
    }
  });

  it('covers all ten digits with no repeats within a digit', () => {
    expect(Object.keys(SEGMENTS_BY_DIGIT).sort()).toEqual(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    );
    for (const segments of Object.values(SEGMENTS_BY_DIGIT)) {
      expect(new Set(segments).size).toBe(segments.length);
    }
  });

  it('gives every digit a distinct pattern', () => {
    // Two digits sharing a pattern would be indistinguishable once drawn.
    const patterns = Object.values(SEGMENTS_BY_DIGIT).map((s) => [...s].sort().join(''));
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});

describe('layoutDateStamp', () => {
  it('emits one glyph per digit plus the apostrophe, ignoring spaces', () => {
    expect(layoutDateStamp("'99 12 29").glyphs).toHaveLength(7);
  });

  it('advances left to right without overlapping', () => {
    const { glyphs } = layoutDateStamp("'99 12 29");
    for (let i = 1; i < glyphs.length; i += 1) {
      expect(glyphs[i].x).toBeGreaterThan(glyphs[i - 1].x);
    }
  });

  it('keeps every polygon inside the glyph cell', () => {
    // Coordinates are in digit-height units, so a digit occupies 0..1
    // vertically. Anything outside means the stamp would clip or overlap.
    for (const digit of Object.keys(SEGMENTS_BY_DIGIT)) {
      const { glyphs } = layoutDateStamp(digit);
      for (const polygon of glyphs[0].polygons) {
        for (let i = 0; i < polygon.length; i += 2) {
          expect(polygon[i]).toBeGreaterThanOrEqual(-1e-9);
          expect(polygon[i]).toBeLessThanOrEqual(STAMP_METRICS.aspect + 1e-9);
          expect(polygon[i + 1]).toBeGreaterThanOrEqual(-1e-9);
          expect(polygon[i + 1]).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('reports a width that ends at the last glyph, not a trailing gap', () => {
    const layout = layoutDateStamp("'99 12 29");
    const last = layout.glyphs[layout.glyphs.length - 1];
    expect(layout.width).toBeCloseTo(last.x + STAMP_METRICS.aspect, 10);
  });

  it('produces closed polygons of six points for each segment', () => {
    const { glyphs } = layoutDateStamp('8');
    expect(glyphs[0].polygons).toHaveLength(7);
    for (const polygon of glyphs[0].polygons) {
      expect(polygon).toHaveLength(12);
    }
  });

  it('returns nothing for text with no drawable characters', () => {
    expect(layoutDateStamp('   ').glyphs).toEqual([]);
    expect(layoutDateStamp('   ').width).toBe(0);
  });
});
