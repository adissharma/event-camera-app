/**
 * A small scrubbed timeline: every value on the page as a pure function of one
 * clock, so scrolling backwards or jumping can never leave anything stranded.
 *
 * Owned rather than a library because the needs are small and
 * `docs/marketing-motion-spec.md` asks that no animation library be added unless
 * it earns its bytes. It only writes when a value changes, so a settled page
 * costs nothing.
 */

export type EaseName = 'none' | 'in' | 'out' | 'inOut' | 'out3' | 'in3' | 'back' | 'sine';

const EASES: Record<EaseName, (p: number) => number> = {
  none: (p) => p,
  in: (p) => p * p,
  out: (p) => 1 - (1 - p) * (1 - p),
  inOut: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  out3: (p) => 1 - (1 - p) ** 3,
  in3: (p) => p ** 3,
  back: (p) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2,
  sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
};

interface Segment {
  t0: number;
  t1: number;
  v0: number;
  v1: number;
  ease: (p: number) => number;
}

type Props = Record<string, number>;
type Target = object;

const TRANSFORM_DEFAULTS: Props = { x: 0, y: 0, scale: 1, rot: 0 };

function sample(segments: Segment[], t: number): number {
  let value = segments[0].v0;
  for (const s of segments) {
    if (t < s.t0) break;
    if (t >= s.t1) {
      value = s.v1;
      continue;
    }
    return s.v0 + (s.v1 - s.v0) * s.ease((t - s.t0) / (s.t1 - s.t0));
  }
  return value;
}

export type Pose = { x: number; y: number; scale?: number; rot?: number; opacity?: number };

export class Timeline {
  private readonly tracks = new Map<Target, Map<string, Segment[]>>();
  private readonly drivers: { el: HTMLElement; fn: (t: number) => Pose | null; last: string }[] = [];
  private readonly written = new Map<Element, string>();
  private readonly listeners: ((t: number) => void)[] = [];

  /** Tweens from wherever the property last was. Add tweens in time order per property. */
  to(target: Target | null | undefined, props: Props, at: number, dur: number, ease: EaseName = 'inOut'): this {
    if (!target) return this;
    for (const key of Object.keys(props)) {
      const list = this.track(target, key);
      const last = list[list.length - 1];
      const v0 = last ? last.v1 : this.initial(target, key);
      list.push({ t0: at, t1: at + Math.max(dur, 0.0001), v0, v1: props[key], ease: EASES[ease] });
    }
    return this;
  }

  fromTo(target: Target | null | undefined, from: Props, props: Props, at: number, dur: number, ease: EaseName = 'inOut'): this {
    if (!target) return this;
    for (const key of Object.keys(props)) {
      const list = this.track(target, key);
      if (!list.length) {
        list.push({ t0: -1, t1: -1, v0: from[key] ?? this.initial(target, key), v1: from[key] ?? this.initial(target, key), ease: EASES.none });
      }
      list.push({ t0: at, t1: at + Math.max(dur, 0.0001), v0: from[key] ?? list[list.length - 1].v1, v1: props[key], ease: EASES[ease] });
    }
    return this;
  }

  /** An instant change at `at`. */
  set(target: Target | null | undefined, props: Props, at: number): this {
    return this.to(target, props, at, 0.0001, 'none');
  }

  /** The starting value of a property, without any motion. */
  start(target: Target | null | undefined, props: Props): this {
    if (!target) return this;
    for (const key of Object.keys(props)) {
      this.track(target, key).push({ t0: -1, t1: -1, v0: props[key], v1: props[key], ease: EASES.none });
    }
    return this;
  }

  /** A pose computed directly from the clock, for curves keyframes can't describe. */
  drive(el: HTMLElement | null | undefined, fn: (t: number) => Pose | null): this {
    if (el) this.drivers.push({ el, fn, last: '' });
    return this;
  }

  onRender(fn: (t: number) => void): this {
    this.listeners.push(fn);
    return this;
  }

  /** Clears everything this timeline wrote, so a rebuild reads clean starting values. */
  dispose(): void {
    const clear = (style: CSSStyleDeclaration) => {
      for (const key of ['transform', 'opacity', 'visibility', 'strokeDashoffset'] as const) style[key] = '';
    };
    for (const el of this.written.keys()) clear((el as HTMLElement).style);
    for (const driver of this.drivers) clear(driver.el.style);
  }

  render(t: number): void {
    for (const [target, props] of this.tracks) {
      if (target instanceof Element) this.writeElement(target, props, t);
      else for (const [key, segments] of props) (target as Props)[key] = sample(segments, t);
    }
    for (const driver of this.drivers) {
      const pose = driver.fn(t);
      const css = pose ? poseCss(pose) : 'hide';
      if (css === driver.last) continue;
      driver.last = css;
      if (!pose) {
        driver.el.style.visibility = 'hidden';
        continue;
      }
      driver.el.style.visibility = 'visible';
      driver.el.style.transform = css;
      driver.el.style.opacity = String(pose.opacity ?? 1);
    }
    for (const fn of this.listeners) fn(t);
  }

  private track(target: Target, key: string): Segment[] {
    let props = this.tracks.get(target);
    if (!props) this.tracks.set(target, (props = new Map()));
    let list = props.get(key);
    if (!list) props.set(key, (list = []));
    return list;
  }

  private initial(target: Target, key: string): number {
    if (target instanceof Element) {
      // Elements hidden by the stylesheet start hidden.
      if (key === 'opacity' || key === 'alpha') return Number(getComputedStyle(target).opacity);
      return TRANSFORM_DEFAULTS[key] ?? 0;
    }
    return (target as Props)[key] ?? 0;
  }

  private writeElement(el: Element, props: Map<string, Segment[]>, t: number): void {
    const style = (el as HTMLElement).style;
    let x = 0, y = 0, scale = 1, rot = 0, hasTransform = false, css = '';
    for (const [key, segments] of props) {
      const value = sample(segments, t);
      if (key === 'x') { x = value; hasTransform = true; }
      else if (key === 'y') { y = value; hasTransform = true; }
      else if (key === 'scale') { scale = value; hasTransform = true; }
      else if (key === 'rot') { rot = value; hasTransform = true; }
      else css += `${key}:${round(value)};`;
    }
    const transform = hasTransform ? poseCss({ x, y, scale, rot }) : '';
    const signature = css + transform;
    if (this.written.get(el) === signature) return;
    this.written.set(el, signature);
    if (hasTransform) style.transform = transform;
    for (const [key, segments] of props) {
      if (key === 'x' || key === 'y' || key === 'scale' || key === 'rot') continue;
      const value = sample(segments, t);
      if (key === 'opacity') {
        style.opacity = String(round(value));
        style.visibility = value <= 0.001 ? 'hidden' : 'visible';
      } else if (key === 'alpha') {
        // Opacity alone: hidden from sight but still read by assistive tech.
        style.opacity = String(round(value));
      } else if (key === 'dash') {
        style.strokeDashoffset = String(round(value));
      } else {
        style.setProperty(`--${key}`, String(round(value)));
      }
    }
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function poseCss({ x, y, scale = 1, rot = 0 }: Pose): string {
  return `translate3d(${round(x)}px,${round(y)}px,0) rotate(${round(rot)}deg) scale(${round(scale)})`;
}
