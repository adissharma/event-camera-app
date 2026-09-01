/**
 * The date imprint, as geometry.
 *
 * Film date backs did not print a font. They had a small seven-segment LED
 * array behind the gate that exposed the emulsion directly, which is why every
 * one of these stamps — across every make of camera — has the same segmented
 * numerals, the same warm orange, and the same soft luminous bleed. Reaching
 * for a monospace system font (which is what this used to do) gets the *idea*
 * of a stamp but none of the mechanism: Courier's numerals have stroke
 * contrast, curves and serifs that a seven-segment display physically cannot
 * produce, and it reads as a caption rather than an exposure.
 *
 * So the digits are built here as polygons instead. No font is involved, which
 * also means no platform variation: iOS, Android and the browser tuner draw
 * byte-identical shapes, and there is no fallback font to go wrong.
 *
 * Pure geometry, no Skia — the segment tables are exactly the kind of thing
 * that is easy to get subtly wrong and easy to test.
 */

/**
 * Seven-segment layout, in the conventional lettering:
 *
 *      --a--
 *     |     |
 *     f     b
 *     |     |
 *      --g--
 *     |     |
 *     e     c
 *     |     |
 *      --d--
 */
export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

export const SEGMENTS_BY_DIGIT: Record<string, Segment[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

export interface StampMetrics {
  /** Digit width, as a fraction of digit height. */
  aspect: number;
  /** Segment thickness, as a fraction of digit height. */
  thickness: number;
  /** Gap between the ends of adjacent segments, as a fraction of digit height. */
  gap: number;
  /** Space between digits, as a fraction of digit width. */
  tracking: number;
  /** Width of a space character, as a fraction of digit width. */
  spaceWidth: number;
}

export const STAMP_METRICS: StampMetrics = {
  aspect: 0.6,
  thickness: 0.14,
  gap: 0.022,
  tracking: 0.34,
  spaceWidth: 0.34,
};

/** A closed polygon, as flat `x, y` pairs. */
export type Polygon = number[];

export interface StampGlyph {
  /** Where the glyph starts, in digit-height units from the left of the text. */
  x: number;
  polygons: Polygon[];
}

export interface StampLayout {
  glyphs: StampGlyph[];
  /** Total advance, in digit-height units. Height is 1 by definition. */
  width: number;
}

/**
 * A segment as a mitred hexagon rather than a rectangle.
 *
 * The angled ends are not decoration: they are how a real segmented display
 * looks, because the segments have to meet at the corners without overlapping.
 * Square-ended bars read as a bar chart.
 */
function segmentPolygon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): Polygon {
  const half = thickness / 2;
  if (y0 === y1) {
    return [x0, y0, x0 + half, y0 - half, x1 - half, y0 - half, x1, y0, x1 - half, y0 + half, x0 + half, y0 + half];
  }
  return [x0, y0, x0 + half, y0 + half, x0 + half, y1 - half, x0, y1, x0 - half, y1 - half, x0 - half, y0 + half];
}

/** The seven segment shapes for one digit cell, in 0..width by 0..1. */
function digitPolygons(segments: Segment[], metrics: StampMetrics): Polygon[] {
  const width = metrics.aspect;
  const t = metrics.thickness;
  const g = metrics.gap;
  const half = t / 2;

  // Insets keep the segments from touching, which is what gives a segmented
  // display its characteristic broken-up look.
  const left = half + g;
  const right = width - half - g;
  const top = half + g;
  const middle = 0.5;
  const bottom = 1 - half - g;

  const build: Record<Segment, () => Polygon> = {
    a: () => segmentPolygon(left, half, right, half, t),
    g: () => segmentPolygon(left, middle, right, middle, t),
    d: () => segmentPolygon(left, 1 - half, right, 1 - half, t),
    f: () => segmentPolygon(half, top, half, middle - g, t),
    b: () => segmentPolygon(width - half, top, width - half, middle - g, t),
    e: () => segmentPolygon(half, middle + g, half, bottom, t),
    c: () => segmentPolygon(width - half, middle + g, width - half, bottom, t),
  };

  return segments.map((segment) => build[segment]());
}

/**
 * The year tick. A short slanted stroke at cap height, the way the imprint
 * abbreviates the century.
 */
function apostrophePolygons(metrics: StampMetrics): Polygon[] {
  const t = metrics.thickness;
  const x = t * 0.9;
  return [[x, 0, x + t * 0.85, 0, x + t * 0.2, t * 1.7, x - t * 0.45, t * 1.7]];
}

/**
 * Lays out a stamp string into polygons.
 *
 * Coordinates are in *digit-height units*: a digit is exactly 1 tall, and the
 * caller scales the whole thing to whatever the frame calls for. That keeps the
 * stamp's proportions identical at every output resolution, which is the same
 * reasoning the grain and dust follow.
 */
export function layoutDateStamp(text: string, metrics: StampMetrics = STAMP_METRICS): StampLayout {
  const digitWidth = metrics.aspect;
  const step = digitWidth * (1 + metrics.tracking);
  const glyphs: StampGlyph[] = [];
  let x = 0;

  for (const character of text) {
    if (character === ' ') {
      x += digitWidth * metrics.spaceWidth;
      continue;
    }
    if (character === "'") {
      glyphs.push({ x, polygons: apostrophePolygons(metrics) });
      x += digitWidth * 0.45;
      continue;
    }
    const segments = SEGMENTS_BY_DIGIT[character];
    if (!segments) continue;
    glyphs.push({ x, polygons: digitPolygons(segments, metrics) });
    x += step;
  }

  // The final glyph contributes its own width, not a full advance with
  // trailing tracking, or the stamp sits visibly off-centre from its box.
  const width = glyphs.length ? glyphs[glyphs.length - 1].x + digitWidth : 0;
  return { glyphs, width };
}

/**
 * "'99 12 29" — the format the reference imprint uses, and the one every film
 * date back shares: two-digit year behind an apostrophe, then month, then day,
 * space separated.
 */
export function formatDisposableDateStamp(date: Date): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `'${yy} ${mm} ${dd}`;
}
