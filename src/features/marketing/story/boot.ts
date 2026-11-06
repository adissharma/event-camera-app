import { buildStory, type Els, type Layout, type Story } from './choreography';
import { WORLD } from './world';

/**
 * Runs the story: one scroll listener, one rAF loop, one timeline.
 *
 * State lives here and in the DOM rather than in React, so nothing re-renders
 * per frame (and see the React Compiler note in the memory on module state).
 */

const SMOOTHING = 7.5;
/** Where the scroll nudge lands: the phone, with the App Clip card up. */
const NUDGE_TO = 1.6;
/** Past a section's words on the sky, with the whole scene showing and nothing started yet. */
const SECTION_LANDS = 0.9;
/** How long a phone's mock stays on each party, in ms. */
const UC_DWELL = 4500;
/** Behind the FAQs, once the story's over. */
const PAGE = '#2f0f5d';
/** Multiplied over the whole scene: white paper falls to this, black stays black. */
const NIGHT = '#31206c';
const SKY_DAY = '#7a22b8';
const SKY_NIGHT = '#17054a';
const SKY_MORNING = '#5a3fc0';
/** Solid at the foot of the scroll prompt, and under everything else at the bottom. */
const GROUND = '#160a36';
/** The night layer is only soft gradients, so it can draw at a fraction of the size. */
const NIGHT_RES = 0.5;

function collect(root: HTMLElement) {
  const els: Els = {};
  root.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => {
    els[el.dataset.el!] = el;
  });
  const group = (name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-group~="${name}"]`));
  return { els, group };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Loads art in the order it's needed, each batch after the one before, so the
 * opening never waits behind photos from the end of the page. Ayla isn't in the
 * opening frame, so her drawings can come after the phone's screens.
 */
function loadImages(root: HTMLElement, plate: HTMLImageElement) {
  const all = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-src]'));
  const batch = (kind: string) => {
    const images = all.filter((img) => (img.dataset.kind ?? 'phone') === kind);
    for (const img of images) {
      img.src = img.dataset.src!;
      img.removeAttribute('data-src');
    }
    return Promise.allSettled(images.map((img) => img.decode()));
  };
  const venue = Promise.race([plate.decode().catch(() => {}), wait(3000)]);
  const people = venue.then(() => batch('figure'));
  const screens = people.then(() => batch('phone'));
  void screens.then(() => batch('figure-late')).then(() => batch('print'));
  return { venue, people, screens };
}

export function bootStory(root: HTMLElement): () => void {
  // Scroll per story unit, as a share of the viewport height. A wheel moves in big fixed steps,
  // so it covers more story per notch than a swipe does.
  const UNIT_VH = window.matchMedia('(pointer: coarse)').matches ? 0.24 : 0.16;
  const { els, group } = collect(root);
  const canvas = els.night as unknown as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const track = els.track;
  const nav = group('chapter') as HTMLButtonElement[];
  const chapterFills = group('chapterFill');

  // The kinds of party: each button brings its setting and its event on the phone.
  const ucTabs = group('ucTab') as HTMLButtonElement[];
  const ucLayers = [group('ucSetting'), group('ucPhone')];
  let ucShown = -1;
  function showUseCase(i: number) {
    if (i === ucShown) return;
    ucShown = i;
    ucTabs.forEach((tab, n) => tab.setAttribute('aria-pressed', String(n === i)));
    for (const layer of ucLayers) layer.forEach((el, n) => el.classList.toggle('on', n === i));
    root.classList.toggle('uc-away', i !== 0);
    syncPlain();
  }
  /** Phones show just a gradient behind every party but the wedding, while the hero's up. */
  function syncPlain() {
    root.classList.toggle('uc-plain', ucShown !== 0 && window.scrollY <= 4);
    if (story) syncChrome();
  }
  const onUcClick = (e: Event) => showUseCase(ucTabs.indexOf(e.currentTarget as HTMLButtonElement));
  const onUcFocus = () => scrollToTime(0);
  ucTabs.forEach((tab) => {
    tab.addEventListener('click', onUcClick);
    tab.addEventListener('focus', onUcFocus);
  });
  // Phones have no buttons, so the mock fades through the parties by itself while the hero's up.
  const noButtons = window.matchMedia('(max-width: 759px), (max-aspect-ratio: 9/10), (max-height: 520px)');
  let ucLanded = false;
  const ucClock = setInterval(() => {
    if (!root.classList.contains('in-phone')) return;
    // The first event gets a full turn once the phone's landed.
    if (ucLanded && noButtons.matches && !document.hidden && target() < 0.1) {
      showUseCase((ucShown + 1) % ucTabs.length);
    }
    ucLanded = true;
  }, UC_DWELL);

  let story!: Story;
  let layout: Layout;
  let current = 0;
  let dirty = true;
  let raf = 0;
  let last = 0;
  let chromeColour = '';
  let chapter = '';
  let lastLightKey = '';
  let repaintTimer: ReturnType<typeof setTimeout> | undefined;

  function measure() {
    const rect = els.stage.getBoundingClientRect();
    // The stage fills the largest viewport, so a collapsing toolbar never reveals an
    // edge. What must stay in view (the phone) is laid out in the smallest one.
    const visible = els.visProbe.getBoundingClientRect().height || rect.height;
    // A small phone on its side still gets the side-by-side layout, or the phone would cover the words.
    const onItsSide = window.matchMedia('(max-height: 520px) and (min-aspect-ratio: 9/10)').matches;
    layout = { w: rect.width, h: rect.height, vis: Math.min(visible, rect.height), m: !onItsSide && (rect.width < 760 || rect.width / rect.height < 0.9) };
    canvas.width = Math.round(layout.w * NIGHT_RES);
    canvas.height = Math.round(layout.h * NIGHT_RES);
    lastLightKey = '';
    story?.tl.dispose();
    story = buildStory(els, group, layout);
    track.style.setProperty('--track', `${story.T * UNIT_VH * layout.h + layout.h}px`);
    root.dataset.labels = JSON.stringify(story.labels);
    root.dataset.unit = String(UNIT_VH * layout.h);
    root.dataset.stills = JSON.stringify(story.stills);
    placeClose();
    // Safari can go on showing the phone's old screen after a rebuild, until something repaints it.
    clearTimeout(repaintTimer);
    repaintTimer = setTimeout(() => {
      els.phone.style.display = 'none';
      void els.phone.offsetHeight;
      els.phone.style.display = '';
    }, 400);
  }

  /** Fills each section's bar by how far through it the story is. */
  function syncChapterBars(t: number) {
    chapterFills.forEach((fill, i) => {
      const from = story.labels[nav[i].dataset.chapter!];
      const to = i + 1 < nav.length ? story.labels[nav[i + 1].dataset.chapter!] : story.T;
      const done = (Math.max(0, Math.min(1, (t - from) / (to - from)))).toFixed(3);
      if (fill.dataset.done === done) return;
      fill.dataset.done = done;
      fill.style.transform = `scaleX(${done})`;
    });
  }

  /** The last slide's terrace, framed like the hero's, with its floor along the bottom. */
  function placeClose() {
    const box = els.close.getBoundingClientRect();
    const z = Math.max(box.height / story.heroCam.vh, box.width / WORLD.w);
    const x = Math.min(0, Math.max(box.width - WORLD.w * z, box.width / 2 - story.heroCam.cx * z));
    // A few pixels past the bottom, so no sky can show between the floor and the footer.
    els.closeTerrace.style.transform = `translate(${x}px,${box.height + 4 - WORLD.h * z}px) scale(${z})`;
  }

  /** Each figure's drawings, which are also the shape of the light that falls on it. */
  const figureImages = new Map<string, HTMLImageElement[]>();
  const imagesOf = (id: string) => {
    let list = figureImages.get(id);
    if (!list) figureImages.set(id, (list = Array.from(root.querySelectorAll<HTMLImageElement>(`[data-el="fig:${id}"] img`))));
    return list;
  };

  /** Night, with the lit figures cut out of it in their own shapes. */
  function drawNight() {
    const { cam, figureLights, night } = story;
    const z = layout.h / cam.vh;
    const tx = layout.w / 2 - cam.cx * z;
    const ty = layout.h / 2 - cam.cy * z;
    const key = `${cam.cx.toFixed(1)},${cam.cy.toFixed(1)},${cam.vh.toFixed(1)},${night.v.toFixed(3)},${figureLights.map((l) => l.a.toFixed(3)).join()}`;
    if (key === lastLightKey) return;
    lastLightKey = key;

    ctx.setTransform(NIGHT_RES, 0, 0, NIGHT_RES, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, layout.w, layout.h);
    canvas.style.visibility = night.v > 0.001 ? 'visible' : 'hidden';
    if (night.v <= 0.001) return;

    ctx.globalAlpha = night.v;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, layout.w, layout.h);

    ctx.globalCompositeOperation = 'destination-out';
    for (const light of figureLights) {
      if (light.a <= 0.001) continue;
      const x = tx + light.x * z, y = ty + light.y * z, w = light.w * z, h = light.h * z;
      for (const img of imagesOf(light.id)) {
        if (!img.complete || !img.naturalWidth) continue;
        // A faint edge of light just past the outline, then the figure itself, fully lit.
        ctx.globalAlpha = light.a * 0.18;
        ctx.drawImage(img, x - w * 0.02, y - h * 0.015, w * 1.04, h * 1.03);
        ctx.globalAlpha = light.a;
        ctx.drawImage(img, x, y, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  function apply(t: number) {
    story.tl.render(t);
    root.dataset.t = t.toFixed(2);
    const { cam } = story;
    const z = layout.h / cam.vh;
    const transform = `translate3d(${layout.w / 2 - cam.cx * z}px,${layout.h / 2 - cam.cy * z}px,0) scale(${z})`;
    els.worldBack.style.transform = transform;
    els.worldFront.style.transform = transform;
    els.worldTop.style.transform = transform;
    // Far away, so they ignore the camera: they're all that's showing when a new section's words arrive.
    els.clouds.style.transform = `translate3d(0,${(-t * 0.3).toFixed(1)}px,0)`;
    drawNight();

    syncChrome();
    syncChapterBars(t);
    els['ch:s1'].style.pointerEvents = t < 0.25 ? 'auto' : 'none';
    // The hero has its own button, so the header's waits until that one's gone.
    els.navGet.style.display = t >= 0.25 ? 'flex' : 'none';
    els.nav.classList.toggle('started', t >= 0.25);
    // Hidden on the hero, where it would otherwise catch clicks meant for the nudge.
    els.chapters.style.pointerEvents = t < 0.25 ? 'none' : '';

    let active = 's1';
    for (const [name, at] of Object.entries(story.labels)) if (t >= at - 0.2) active = name;
    if (active !== chapter) {
      chapter = active;
      nav.forEach((b) => b.setAttribute('aria-current', String(b.dataset.chapter === active)));
    }
  }

  /** Runs on every scroll as well, because the clock stops once the story has finished. */
  function syncChrome() {
    const past = goalPast();
    // Past the stage, the header needs a ground of its own to sit on over the FAQs.
    // The last slide has the sky back, and its own much bigger button.
    const atClose = els.close.getBoundingClientRect().top < 60;
    els.nav.classList.toggle('past', past && !atClose);
    els.nav.classList.toggle('at-close', atClose);
    // The browser's own chrome follows the sky, until the story's over.
    const morning = target() > story.labels.s7 || root.classList.contains('uc-plain');
    const chrome = atClose ? SKY_DAY : past ? PAGE : story.night.v > 0.5 ? SKY_NIGHT : morning ? SKY_MORNING : SKY_DAY;
    if (chrome !== chromeColour) {
      chromeColour = chrome;
      document.documentElement.style.background = chrome;
      els.stage.style.background = chrome;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome);
      // Safari 26 ignores theme-color and colours its bars from fixed elements at the edges.
      els.edgeTop = renewEdge(els.edgeTop, chrome);
      els.edgeFoot = renewEdge(els.edgeFoot, past && !atClose ? PAGE : GROUND);
    }
  }

  /** A new element each time, because Safari only looks again at one it hasn't seen. */
  function renewEdge(edge: HTMLElement, colour: string) {
    const next = edge.cloneNode() as HTMLElement;
    next.style.background = colour;
    edge.replaceWith(next);
    return next;
  }

  function goalPast() {
    return window.scrollY > track.getBoundingClientRect().top + window.scrollY + story.T * UNIT_VH * layout.h + layout.h * 0.92;
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

  const onScroll = () => {
    if (window.scrollY > 4) {
      els.stage.classList.remove('nudging');
      root.classList.add('in-phone');
    }
    syncPlain();
    syncChrome();
    kick();
  };

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

  /**
   * The opening, one layer at a time: sky and logo are there from the first paint,
   * then the venue rises, then the words, then the people, then the clouds and sun.
   * Each step waits for its art, so a slow connection never slides up nothing, but
   * the words come early: they're what a visitor is waiting for.
   */
  let introStopped = false;
  async function playIntro({ venue, people, screens }: ReturnType<typeof loadImages>) {
    const step = (name: string) => {
      if (!introStopped) root.classList.add(name);
    };
    if (current > 0.05) {
      // Reloaded partway down the page: nothing to introduce.
      root.classList.add('intro-skip');
      for (const name of ['in-venue', 'in-people', 'in-sky', 'in-copy', 'in-phone']) step(name);
      return;
    }
    // On a very slow connection the words don't wait for the venue either.
    void wait(1800).then(() => step('in-copy'));
    await venue;
    step('in-venue');
    await wait(450);
    step('in-copy');
    await Promise.all([Promise.race([people, wait(2500)]), wait(500)]);
    step('in-people');
    const clouds = els.clouds as unknown as HTMLImageElement;
    await Promise.all([Promise.race([clouds.decode().catch(() => {}), wait(1500)]), wait(800)]);
    step('in-sky');
    // Last of all, once the rest has settled and its screen has loaded: the phone.
    await Promise.all([Promise.race([screens, wait(3500)]), wait(900)]);
    step('in-phone');
    // Everything's in place. If they still haven't scrolled, show them it moves.
    await wait(1200);
    if (!introStopped && window.scrollY <= 4) els.stage.classList.add('nudging');
  }

  const scrollToTime = (t: number) => {
    const start = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: start + t * UNIT_VH * layout.h, behavior: 'auto' });
  };
  const onChapter = (e: Event) => {
    const name = (e.currentTarget as HTMLElement).dataset.chapter!;
    scrollToTime(name === 's1' ? 0 : story.labels[name] + SECTION_LANDS);
  };
  nav.forEach((b) => b.addEventListener('click', onChapter));

  // A keyboard user tabbing back to the hero's button should see it.
  const heroCtas = els.heroCta.querySelectorAll('a, button');
  const onHeroFocus = () => scrollToTime(0);
  heroCtas.forEach((a) => a.addEventListener('focus', onHeroFocus));

  // The prompt is a real control: it takes you to the first thing worth seeing.
  const onHint = () => {
    const start = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: start + NUDGE_TO * UNIT_VH * layout.h, behavior: 'smooth' });
  };
  els.hint.addEventListener('click', onHint);

  lastW = window.innerWidth;
  lastH = window.innerHeight;
  showUseCase(0);
  measure();
  current = target();
  apply(current);
  dirty = false;
  root.dataset.booted = '1';
  const loading = loadImages(root, els.plate as unknown as HTMLImageElement);
  void playIntro(loading);

  // Some of the layout depends on how the copy wraps, which the real fonts can change.
  let stopped = false;
  void document.fonts?.ready.then(() => {
    if (stopped) return;
    const progress = current;
    measure();
    current = progress;
    dirty = true;
    kick();
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  kick();

  return () => {
    introStopped = true;
    stopped = true;
    cancelAnimationFrame(raf);
    clearInterval(ucClock);
    clearTimeout(resizeTimer);
    clearTimeout(repaintTimer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    nav.forEach((b) => b.removeEventListener('click', onChapter));
    heroCtas.forEach((a) => a.removeEventListener('focus', onHeroFocus));
    els.hint.removeEventListener('click', onHint);
    ucTabs.forEach((tab) => {
      tab.removeEventListener('click', onUcClick);
      tab.removeEventListener('focus', onUcFocus);
    });
  };
}
