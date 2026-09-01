import { LruCache } from './lru-cache';

describe('LruCache', () => {
  it('returns what it was given', () => {
    const cache = new LruCache<string, number>(100);
    cache.set('a', 1, 10);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('tracks total weight, not item count', () => {
    const cache = new LruCache<string, number>(100);
    cache.set('a', 1, 10);
    cache.set('b', 2, 30);
    expect(cache.weight).toBe(40);
    expect(cache.size).toBe(2);
  });

  it('evicts the least recently used entry once over budget', () => {
    const cache = new LruCache<string, number>(50);
    cache.set('a', 1, 20);
    cache.set('b', 2, 20);
    cache.set('c', 3, 20); // 60 > 50, so the oldest goes
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('counts a read as a use, so reading rescues an entry', () => {
    const cache = new LruCache<string, number>(50);
    cache.set('a', 1, 20);
    cache.set('b', 2, 20);
    cache.get('a'); // 'a' is now the most recent, so 'b' is next out
    cache.set('c', 3, 20);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('does not let peek rescue an entry', () => {
    // peek exists for "is this already here?" checks during render, which must
    // not reorder the cache — otherwise merely rendering a grid reorders it.
    const cache = new LruCache<string, number>(50);
    cache.set('a', 1, 20);
    cache.set('b', 2, 20);
    cache.peek('a');
    cache.set('c', 3, 20);
    expect(cache.has('a')).toBe(false);
  });

  it('replaces a key without double-counting its weight', () => {
    const cache = new LruCache<string, number>(100);
    cache.set('a', 1, 20);
    cache.set('a', 2, 35);
    expect(cache.get('a')).toBe(2);
    expect(cache.weight).toBe(35);
    expect(cache.size).toBe(1);
  });

  it('keeps a value larger than the whole budget', () => {
    // The full-screen render of the photo being looked at right now can
    // legitimately exceed the budget. Refusing to cache it would mean the one
    // image that matters most is the only one never reused.
    const cache = new LruCache<string, number>(50);
    cache.set('a', 1, 10);
    cache.set('huge', 2, 500);
    expect(cache.get('huge')).toBe(2);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(1);
  });

  it('never evicts down to empty', () => {
    const cache = new LruCache<string, number>(10);
    cache.set('a', 1, 100);
    expect(cache.size).toBe(1);
  });

  it('clears', () => {
    const cache = new LruCache<string, number>(100);
    cache.set('a', 1, 10);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.weight).toBe(0);
  });
});

describe('entriesInUseOrder', () => {
  it('yields every entry without counting as a use', () => {
    // The viewer scans the render cache on every frame it lacks an exact-size
    // image. If scanning reordered the cache, merely looking would evict.
    const cache = new LruCache<string, number>(50);
    cache.set('a', 1, 20);
    cache.set('b', 2, 20);
    expect([...cache.entriesInUseOrder()]).toEqual([['a', 1], ['b', 2]]);
    cache.set('c', 3, 20);
    expect(cache.has('a')).toBe(false);
  });
});
