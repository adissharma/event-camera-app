/**
 * A least-recently-used cache with a weight budget rather than an item count.
 *
 * Weight rather than count because what it holds are decoded images, and those
 * differ in cost by two orders of magnitude — a 110pt grid thumbnail and a
 * 12-megapixel original are both "one item" but one is 0.2MB and the other is
 * 48MB. Budgeting by count would either hold far too much memory or evict far
 * too eagerly depending on which happened to be in it.
 *
 * **Eviction drops the reference; it never destroys the value.** That matters
 * for Skia images specifically: a component can still be mounted and drawing
 * one when it falls out of the cache, and calling `dispose()` on it would tear
 * the pixels out from under a live draw. Dropping the reference is enough —
 * the underlying resource is freed once nothing holds it, and until then the
 * only cost of an evicted-but-live image is that the next lookup misses.
 */
export class LruCache<K, V> {
  private readonly entries = new Map<K, { value: V; weight: number }>();
  private currentWeight = 0;

  /**
   * @param maxWeight Total budget. Units are the caller's to choose — this
   * module only ever adds and compares them.
   */
  constructor(private readonly maxWeight: number) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Re-inserting moves the key to the end of Map's insertion order, which is
    // what makes the first key the least recently *used* rather than merely
    // the least recently added.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Does not count as a use, so it cannot rescue an entry from eviction. */
  peek(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  set(key: K, value: V, weight: number): void {
    const existing = this.entries.get(key);
    if (existing) {
      this.currentWeight -= existing.weight;
      this.entries.delete(key);
    }

    // A single value heavier than the whole budget is still stored, and still
    // evicts everything else first. Refusing it instead would mean the one
    // photo the user is actually looking at is the one thing never cached.
    this.entries.set(key, { value, weight });
    this.currentWeight += weight;

    while (this.currentWeight > this.maxWeight && this.entries.size > 1) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const evicted = this.entries.get(oldest.value);
      this.entries.delete(oldest.value);
      if (evicted) this.currentWeight -= evicted.weight;
    }
  }

  /**
   * Every entry, most-recently-used last. Iterating does not count as a use,
   * so scanning the cache cannot reorder it.
   */
  *entriesInUseOrder(): IterableIterator<[K, V]> {
    for (const [key, entry] of this.entries) yield [key, entry.value];
  }

  get weight(): number {
    return this.currentWeight;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.currentWeight = 0;
  }
}
