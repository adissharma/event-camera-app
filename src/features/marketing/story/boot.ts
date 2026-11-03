import { WORLD } from './world';
import { buildStory, type Els, type Layout, type Story } from './choreography';

/**
 * Runs the story: one scroll listener, one rAF loop, one timeline.
 *
 * State lives here and in the DOM rather than in React, so nothing re-renders
 * per frame (and see the React Compiler note in the memory on module state).
 */

/** Scroll per story unit, as a share of the viewport height. */
const UNIT_VH = 0.24;
const SMOOTHING = 7.5;
const LIT = '#efe9e0';
const INK = '#0b0b0c';

function collect(root: HTMLElement) {
  const els: Els = {};
  root.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => {
    els[el.dataset.el!] = el;
  });
  const group = (name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-group~="${name}"]`));
  return { els, group };
}

/**
 * Loads art in the order it's needed, each batch after the one before, so the
 * opening frame never waits behind photos from the end of the page. The first
 * step waits for the room itself, which is the page's largest paint.
 */
async function loadImages(root: HTMLElement, plateNeg: HTMLImageElement, loadPlatePos: () => Promise<unknown>) {
  const all = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-src]'));
  const batch = (kind: string) => {
    const images = all.filter((img) => (img.dataset.kind ?? 'phone') === kind);
    for (const img of images) {
      img.src = img.dataset.src!;
      img.removeAttribute('data-src');
    }
    return Promise.allSettled(images.map((img) => img.decode()));
  };
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([plateNeg.decode().catch(() => {}), timeout]);
  await batch('figure');
  await loadPlatePos();
  await batch('figure-lit');
  await batch('phone');
  await batch('print');
}

export function bootStory(root: HTMLElement): () => void {
  const { els, group } = collect(root);
  const canvas = els.light as unknown as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const track = els.track;
  const nav = group('chapter') as HTMLButtonElement[];

  const plate = new Image();
  plate.decoding = 'async';
  let plateReady = false;
  const loadPlatePos = () => {
    plate.src = `/story/art/room.pos${layout.m && window.innerWidth < 760 ? '.m' : ''}.webp`;
    return plate.decode().then(() => {
      plateReady = true;
      lastLightKey = '';
      dirty = true;
      kick();
    }).catch(() => {});
  };

  let story!: Story;
  let layout: Layout;
  let current = 0;
  let dirty = true;
  let raf = 0;
  let last = 0;
  let tone = '';
  let chromeColour = '';
  let chapter = '';
  let lastLightKey = '';

  function measure() {
    const rect = els.stage.getBoundingClientRect();
    // The stage fills the largest viewport, so a collapsing toolbar never reveals an
    // edge. What must stay in view (the phone) is laid out in the smallest one.
    const visible = els.visProbe.getBoundingClientRect().height || rect.height;
    layout = { w: rect.width, h: rect.height, vis: Math.min(visible, rect.height), m: rect.width < 760 || rect.width / rect.height < 0.9 };
    const ratio = Math.min(window.devicePixelRatio || 1, layout.m ? 2 : 1.5);
    canvas.width = Math.round(layout.w * ratio);
    canvas.height = Math.round(layout.h * ratio);
    lastLightKey = '';
    story?.tl.dispose();
    story = buildStory(els, group, layout);
    track.style.setProperty('--track', `${story.T * UNIT_VH * layout.h + layout.h}px`);
    root.dataset.labels = JSON.stringify(story.labels);
    root.dataset.unit = String(UNIT_VH * layout.h);
    root.dataset.stills = JSON.stringify(story.stills);
  }

  function drawLight() {
    const { cam, lights, exposure } = story;
    const z = layout.h / cam.vh;
    const tx = layout.w / 2 - cam.cx * z;
    const ty = layout.h / 2 - cam.cy * z;
    const key = `${cam.cx.toFixed(1)},${cam.cy.toFixed(1)},${cam.vh.toFixed(1)},${exposure.v.toFixed(3)},${lights.map((l) => l.r.toFixed(1)).join()}`;
    if (key === lastLightKey) return;
    lastLightKey = key;

    const s = canvas.width / layout.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // The pools of light, as a soft mask.
    if (exposure.v >= 1) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, layout.w, layout.h);
    } else {
      for (const l of lights) {
        if (l.r <= 0) continue;
        const px = tx + l.x * z;
        const py = ty + l.y * z;
        const r = l.r * z;
        // Flash falloff: flat in the middle, a quick drop at the edge.
        const g = ctx.createRadialGradient(px, py, r * 0.62, px, py, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.5, 'rgba(0,0,0,.62)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }

    // Inside the mask, the room develops.
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = LIT;
    ctx.fillRect(0, 0, layout.w, layout.h);
    if (plateReady) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(plate, tx, ty, WORLD.w * z, WORLD.h * z);
    }

    // A warm edge where the light gives out, so the falloff isn't grey.
    if (exposure.v < 1) {
      ctx.globalCompositeOperation = 'source-atop';
      for (const l of lights) {
        if (l.r <= 0) continue;
        const px = tx + l.x * z;
        const py = ty + l.y * z;
        const r = l.r * z;
        const g = ctx.createRadialGradient(px, py, r * 0.55, px, py, r);
        g.addColorStop(0, 'rgba(217,170,90,0)');
        g.addColorStop(0.72, 'rgba(217,170,90,.42)');
        g.addColorStop(1, 'rgba(217,170,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
  }

  function apply(t: number) {
    story.tl.render(t);
    root.dataset.t = t.toFixed(2);
    const { cam } = story;
    const z = layout.h / cam.vh;
    const transform = `translate3d(${layout.w / 2 - cam.cx * z}px,${layout.h / 2 - cam.cy * z}px,0) scale(${z})`;
    els.worldBack.style.transform = transform;
    els.worldFront.style.transform = transform;
    drawLight();

    const nextTone = t >= story.paperAt ? 'paper' : 'ink';
    if (nextTone !== tone) {
      tone = nextTone;
      root.dataset.tone = tone;
    }
    // The browser's own chrome follows the room, until the dark footer arrives.
    const chrome = tone === 'paper' && !goalPast() ? LIT : INK;
    if (chrome !== chromeColour) {
      chromeColour = chrome;
      document.documentElement.style.background = chrome;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome);
    }
    els['ch:s8'].style.pointerEvents = t >= story.ctaAt ? 'auto' : 'none';
    // Past the stage, the fixed header would sit over the closing copy as it leaves.
    els.nav.style.visibility = t >= story.T - 0.05 && goalPast() ? 'hidden' : '';

    let active = 's1';
    for (const [name, at] of Object.entries(story.labels)) if (t >= at - 0.2) active = name;
    if (active !== chapter) {
      chapter = active;
      nav.forEach((b) => b.setAttribute('aria-current', String(b.dataset.chapter === active)));
    }
  }

  function goalPast() {
    return window.scrollY > track.getBoundingClientRect().top + window.scrollY + (story.T + 0.4) * UNIT_VH * layout.h;
  }

  function target() {
    const start = track.getBoundingClientRect().top + window.scrollY;
    return Math.max(0, Math.min(story.T, (window.scrollY - start) / (UNIT_VH * layout.h)));
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const goal = target();
    const diff = goal - current;
    const settled = Math.abs(diff) < 0.001;
    current = settled ? goal : current + diff * (1 - Math.exp(-dt * SMOOTHING));
    if (dirty || !settled) {
      apply(current);
      dirty = false;
    }
    if (!settled) kick();
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const onScroll = () => kick();

  let lastW = 0;
  let lastH = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // A phone's address bar sliding only changes the height a little.
      if (w === lastW && coarse && Math.abs(h - lastH) < 160) return;
      lastW = w;
      lastH = h;
      const progress = current;
      measure();
      window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY + progress * UNIT_VH * layout.h);
      current = progress;
      dirty = true;
      kick();
    }, 150);
  };

  const scrollToTime = (t: number) => {
    const start = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: start + t * UNIT_VH * layout.h, behavior: 'auto' });
  };
  const onChapter = (e: Event) => {
    const name = (e.currentTarget as HTMLElement).dataset.chapter!;
    scrollToTime(story.labels[name] + 0.8);
  };
  nav.forEach((b) => b.addEventListener('click', onChapter));

  // A keyboard user tabbing to the closing links should see them.
  const onFocus = () => scrollToTime(story.T - 0.5);
  const ctas = els['ch:s8'].querySelectorAll('a');
  ctas.forEach((a) => a.addEventListener('focus', onFocus));

  lastW = window.innerWidth;
  lastH = window.innerHeight;
  measure();
  current = target();
  apply(current);
  dirty = false;
  root.dataset.booted = '1';
  void loadImages(root, els.plateNeg as unknown as HTMLImageElement, loadPlatePos);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  kick();

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    nav.forEach((b) => b.removeEventListener('click', onChapter));
    ctas.forEach((a) => a.removeEventListener('focus', onFocus));
  };
}
