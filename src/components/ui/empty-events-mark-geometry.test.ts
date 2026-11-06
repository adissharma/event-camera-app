import { FACET_OPACITIES, facetPaths, hangerOpacity } from './empty-events-mark-geometry';

describe('facetPaths', () => {
  it('survives a frame stamped just before the loop restarted', () => {
    // Reanimated does not clamp elapsed time, so the clock can dip below zero.
    expect(() => facetPaths(-0.0001)).not.toThrow();
    expect(facetPaths(-0.0001).join('').length).toBeGreaterThan(0);
  });

  it('draws at every point in the loop, through all of the objects', () => {
    for (let step = 0; step <= 1000; step += 1) {
      const drawn = facetPaths(step / 1000).join('');
      expect(drawn.length).toBeGreaterThan(0);
      expect(drawn).not.toContain('NaN');
    }
  });

  it('has no seam where the loop restarts', () => {
    expect(facetPaths(1)).toEqual(facetPaths(0));
  });

  it('twinkles different mirrors at different moments', () => {
    const twinkling = (clock: number) =>
      facetPaths(clock).slice(FACET_OPACITIES.length).join('');

    const moments = new Set(Array.from({ length: 40 }, (_, step) => twinkling(step / 40)));
    expect(moments.size).toBeGreaterThan(20);
  });
});

describe('hangerOpacity', () => {
  it('shows the string on the ball and on no other object', () => {
    expect(hangerOpacity(0)).toBe(1);
    expect(hangerOpacity(0.3)).toBe(0);
    expect(hangerOpacity(0.55)).toBe(0);
    expect(hangerOpacity(-0.0001)).toBeGreaterThan(0.99);
  });
});
