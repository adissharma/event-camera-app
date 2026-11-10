import { buildStory, type Els, type Layout, type Story } from './choreography';
import { KEEP_GOING } from './content';
import { WORLD } from './world';

/**
 * Runs the story: one scroll listener, one rAF loop, one timeline.
 *
 * State lives here and in the DOM rather than in React, so nothing re-renders
 * per frame (and see the React Compiler note in the memory on module state).
 *
 * One scroll, swipe or key press plays a whole slide at its own pace and stops, because
 * people scroll far too fast to take in a story that moves only as far as they do. The
 * page's real scroll position jumps to the end of the slide straight away, under the
 * pinned stage, so the scrollbar, the browser's own jumps and the FAQs all keep working.
 */

const SMOOTHING = 7.5;
/**
 * On phones, after the hero the slides become a carousel: swipe sideways through the story,
 * or straight down past it to the FAQs. An experiment: set to false to go back to one slide
 * per vertical swipe. Adding ?classic to the address shows the old way without changing it.
 */
const CAROUSEL_ON_PHONES = true;
/** Where Guests join starts in the carousel, once the hero has scrolled away: going back to it plays from here. */
const GUESTS_START = 0.7;
/** How far into the story the chevrons appear: once the hero has scrolled away. */
const CHEVRONS_FROM = 0.35;
/** How long a slide's words and phone take to drop away before the hero comes back. */
const STORY_LEAVES_MS = 240;
/** How far a finger travels sideways before it counts as a swipe across. */
const SWIPE_ACROSS = 24;
/** Another scroll while a slide is playing hurries it along. */
const HURRY = 3;
/** Going back is navigation, not a second viewing: any slide, in this many seconds. */
const BACK_SECONDS = 0.3;
/** The last slide has the most to get through. */
const LAST_SLIDE = 1.3;
/** How long the progress rail stays thick once the story stops moving. */
const RAIL_SETTLES = 500;
/** How long after the clouds and sun the hero's scroll prompt comes in, on page load. */
const HINT_AFTER_SKY = 700;
/** How long a finished slide sits before teasing the next one. */
const PROMPT_AFTER = 1000;
/** A pause this long between wheel events starts a new gesture; a trackpad's momentum never leaves one. */
const WHEEL_QUIET = 180;
/** Going back is quick navigation, so a mouse wheel's separate notches each count. */
const WHEEL_QUIET_BACK = 90;
/** While a trackpad's momentum dies away, a clear jump in speed is a new flick. Not straight after one, as a flick starts by ramping up. */
const WHEEL_RISE = 1.6;
const WHEEL_RISE_MARGIN = 8;
const WHEEL_RISE_AFTER = 300;
/** Just into the FAQs still counts as on the last slide, so going back doesn't take two tries. */
const NEAR_END_VH = 0.25;
/** How far a finger travels before it counts as a swipe. */
const SWIPE = 16;
/** Past a section's words on the sky, with the whole scene showing and nothing started yet. */
const SECTION_LANDS = 0.9;
/** How far down the party scenes' tallest parts start, as a share of the picture. */
const SETTING_SKYLINE = 0.15;
/** Clear sky between the hero's button and a party scene. */
const SETTING_GAP = 16;
/** Sinking a party scene stops here, so the people's faces stay in the picture. */
const SETTING_MIN_SHOWN = 0.62;
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
/** The ambient light behind a lit figure, relative to its box: its radii, and how far down its middle sits. */
const GLOW = { width: 0.68, height: 0.66, centre: 0.55 };

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
  const screens = venue.then(() => batch('phone'));
  const people = screens.then(() => batch('figure'));
  void people.then(() => batch('figure-late')).then(() => batch('print'));
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousel =
    CAROUSEL_ON_PHONES &&
    window.matchMedia('(pointer: coarse)').matches &&
    !reducedMotion.matches &&
    !new URLSearchParams(window.location.search).has('classic');
  root.classList.toggle('carousel', carousel);
  /** In the carousel the page doesn't scroll through the story, so the slide on show is kept here. */
  let carouselT = 0;
  /** Page scrolled per unit of story. None in the carousel: the story sits in one screen above the FAQs. */
  const unitPx = () => (carousel ? 0 : UNIT_VH * layout.h);
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
    root.classList.toggle('uc-plain', ucShown !== 0 && window.scrollY <= 4 && (!story || target() < 0.02));
    if (story) syncChrome();
  }
  const onUcClick = (e: Event) => {
    root.classList.remove('uc-auto');
    showUseCase(ucTabs.indexOf(e.currentTarget as HTMLButtonElement));
    restartUcClock();
  };
  const onUcFocus = () => scrollToTime(0);
  ucTabs.forEach((tab) => {
    tab.addEventListener('click', onUcClick);
    tab.addEventListener('focus', onUcFocus);
  });
  // The parties fade through by themselves while the hero's up. Phones and short laptops have no
  // buttons, so it's the only way they see them. With a mouse, resting on the phone holds the party.
  const noButtons = window.matchMedia('(max-width: 759px), (max-aspect-ratio: 9/10), (max-height: 759px)');
  let ucLanded = false;
  let overPhone = false;
  function ucTick() {
    if (!root.classList.contains('in-phone')) return;
    // The first event gets a full turn once the phone's landed.
    const allowed = noButtons.matches || !reducedMotion.matches;
    // Never on to a scene that hasn't arrived yet, or it would pop in half way through.
    const next = ucLayers[0][(ucShown + 1) % ucTabs.length];
    const ready = !(next instanceof HTMLImageElement) || (next.complete && next.naturalWidth > 0);
    if (ucLanded && allowed && ready && !overPhone && !document.hidden && target() < 0.1) {
      root.classList.add('uc-auto');
      showUseCase((ucShown + 1) % ucTabs.length);
    }
    ucLanded = true;
  }
  let ucClock = setInterval(ucTick, UC_DWELL);
  function restartUcClock() {
    clearInterval(ucClock);
    ucClock = setInterval(ucTick, UC_DWELL);
  }
  // Tracked by position, because the phone's layer lets the pointer through to the page.
  function setOverPhone(over: boolean) {
    if (over === overPhone) return;
    overPhone = over;
    // A full turn after they let go, rather than changing the moment they leave.
    if (!over) restartUcClock();
  }
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !story || target() >= 0.1) {
      setOverPhone(false);
      return;
    }
    const r = els.phone.getBoundingClientRect();
    setOverPhone(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  };
  const onPointerLeave = () => setOverPhone(false);

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
  /** A slide playing by itself: where it's heading, how fast and which way. */
  let play: { to: number; rate: number; dir: 1 | -1; then?: () => void } | null = null;
  let playhead = 0;
  /** Where the page should be while a slide plays. Anywhere else, and something else moved it. */
  let playingAt = 0;

  /** Like the terrace, the other parties' scenes sit low enough to leave the hero's words on clear sky. */
  function placeSettings() {
    const hero = els['ch:s1'];
    const heroEnds = hero.offsetTop + els.heroCta.offsetTop + els.heroCta.offsetHeight;
    let deepest = 0;
    for (const el of ucLayers[0]) {
      if (el.tagName !== 'IMG') continue;
      el.style.bottom = '';
      if (layout.m) continue;
      const wanted = heroEnds + SETTING_GAP - (el.offsetTop + el.offsetHeight * SETTING_SKYLINE);
      const most = layout.h - el.offsetHeight * SETTING_MIN_SHOWN - el.offsetTop;
      const drop = Math.max(0, Math.min(wanted, most));
      el.style.bottom = `${parseFloat(getComputedStyle(el).bottom) - drop}px`;
      deepest = Math.max(deepest, drop);
    }
    els.ucStage.style.setProperty('--uc-drop', `${deepest}px`);
  }

  function measure() {
    const rect = els.stage.getBoundingClientRect();
    // The stage fills the largest viewport, so a collapsing toolbar never reveals an
    // edge. What must stay in view (the phone) is laid out in the smallest one.
    const visible = els.visProbe.getBoundingClientRect().height || rect.height;
    // A small phone on its side still gets the side-by-side layout, or the phone would cover the words.
    const onItsSide = window.matchMedia('(max-height: 520px) and (min-aspect-ratio: 9/10)').matches;
    layout = { w: rect.width, h: rect.height, vis: Math.min(visible, rect.height), m: !onItsSide && (rect.width < 760 || rect.width / rect.height < 0.9), carousel };
    canvas.width = Math.round(layout.w * NIGHT_RES);
    canvas.height = Math.round(layout.h * NIGHT_RES);
    lastLightKey = '';
    story?.tl.dispose();
    story = buildStory(els, group, layout);
    track.style.setProperty('--track', `${story.T * unitPx() + layout.h}px`);
    root.dataset.labels = JSON.stringify(story.labels);
    root.dataset.unit = String(UNIT_VH * layout.h);
    root.dataset.stills = JSON.stringify(story.stills);
    placeSettings();
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
      fill.style.transform = carousel ? `scaleX(${done})` : `scaleY(${done})`;
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

  /**
   * The light behind a lit figure: a broad, soft ellipse over the area it takes up, with no
   * trace of its outline. Bright in the middle and fading smoothly to nothing at the edge.
   */
  function ambientLight(x: number, y: number, w: number, h: number, a: number) {
    const rx = w * GLOW.width + h * 0.08;
    const ry = h * GLOW.height;
    ctx.save();
    ctx.translate(x + w / 2, y + h * GLOW.centre);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,.82)');
    g.addColorStop(0.75, 'rgba(0,0,0,.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  /** Night, with a soft patch of light behind each lit figure, and the figure itself lit. */
  function drawNight() {
    const { cam, figureLights, night } = story;
    const z = layout.h / cam.vh;
    const tx = layout.w / 2 - cam.cx * z;
    const ty = layout.h / 2 - cam.cy * z;
    // A dancer swaps between two drawings, so only the one showing is lit, or there'd be a ghost of the other.
    const showing = (img: HTMLImageElement) => getComputedStyle(img.parentElement!).opacity !== '0';
    const lit = figureLights.filter((l) => l.a > 0.001);
    const poses = lit.map((l) => imagesOf(l.id).map((img) => (showing(img) ? 1 : 0)).join('')).join();
    const key = `${cam.cx.toFixed(1)},${cam.cy.toFixed(1)},${cam.vh.toFixed(1)},${night.v.toFixed(3)},${figureLights.map((l) => l.a.toFixed(3)).join()},${poses}`;
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
    for (const light of lit) {
      const x = tx + light.x * z, y = ty + light.y * z, w = light.w * z, h = light.h * z;
      ambientLight(x, y, w, h, light.a);
      for (const img of imagesOf(light.id)) {
        if (!img.complete || !img.naturalWidth || !showing(img)) continue;
        // The figure itself, fully lit, in front of its light.
        ctx.globalAlpha = light.a;
        ctx.drawImage(img, x, y, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  function apply(t: number) {
    if (carousel) {
      // The chevrons belong to the story, from the moment the hero has gone; there's no going back from its first slide.
      root.classList.toggle('in-carousel', t >= CHEVRONS_FROM);
      root.classList.toggle('carousel-first', t <= story.stops[1] + 0.05);
    }
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
    return window.scrollY > track.getBoundingClientRect().top + window.scrollY + story.T * unitPx() + layout.h * 0.92;
  }

  function target() {
    if (play) return playhead;
    if (carousel) return carouselT;
    const start = track.getBoundingClientRect().top + window.scrollY;
    return Math.max(0, Math.min(story.T, (window.scrollY - start) / (UNIT_VH * layout.h)));
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (play) {
      railMoving();
      playhead += dt * play.rate * play.dir;
      const arrived = play.dir > 0 ? playhead >= play.to : playhead <= play.to;
      if (arrived) playhead = play.to;
      current = playhead;
      apply(current);
      dirty = false;
      if (arrived) {
        const stop = story.stops.indexOf(play.to);
        const then = play.then;
        carouselT = play.to;
        play = null;
        if (stop > 0) schedulePrompt(stop);
        then?.();
        syncPlain();
        syncChrome();
      }
      kick();
      return;
    }
    const goal = target();
    const diff = goal - current;
    const settled = Math.abs(diff) < 0.001;
    current = settled ? goal : current + diff * (1 - Math.exp(-dt * SMOOTHING));
    if (!settled) railMoving();
    if (dirty || !settled) {
      apply(current);
      dirty = false;
    }
    if (!settled) kick();
  }

  /** The rail thickens while the story moves, and goes thin again a moment after it stops. */
  let railTimer: ReturnType<typeof setTimeout> | undefined;
  function railMoving() {
    els.chapters.classList.add('moving');
    clearTimeout(railTimer);
    railTimer = setTimeout(() => els.chapters.classList.remove('moving'), RAIL_SETTLES);
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const onScroll = () => {
    // The scrollbar, Home and End, an anchor, find in page: whoever moved it, they win.
    // In the carousel a slide plays on while they scroll down to the FAQs, and stops at its end as usual.
    if (!carousel && Math.abs(window.scrollY - playingAt) > 2) {
      play = null;
      hidePrompt();
    }
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
      const wasPlaying = play !== null;
      play = null;
      measure();
      if (carousel) carouselT = progress;
      else window.scrollTo(0, track.getBoundingClientRect().top + window.scrollY + progress * unitPx());
      current = progress;
      dirty = true;
      kick();
      if (wasPlaying) scrollGesture(1);
    }, 150);
  };

  /**
   * The opening, one layer at a time: sky and logo are there from the first paint,
   * then the venue rises, then the phone, then the words, then the people, clouds and sun, then the scroll prompt.
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
      for (const name of ['in-venue', 'in-people', 'in-sky', 'in-copy', 'in-phone', 'in-hint']) step(name);
      return;
    }
    // On a very slow connection the words don't wait for the venue either.
    void wait(1800).then(() => step('in-copy'));
    await venue;
    step('in-venue');
    await Promise.all([Promise.race([screens, wait(3500)]), wait(450)]);
    step('in-phone');
    await wait(500);
    step('in-copy');
    await Promise.all([Promise.race([people, wait(2500)]), wait(500)]);
    step('in-people');
    const clouds = els.clouds as unknown as HTMLImageElement;
    await Promise.all([Promise.race([clouds.decode().catch(() => {}), wait(1500)]), wait(800)]);
    step('in-sky');
    // Last of all, the invitation to carry on.
    await wait(HINT_AFTER_SKY);
    step('in-hint');
    // Everything's in place. If they still haven't scrolled, show them it moves.
    await wait(1200);
    if (!introStopped && window.scrollY <= 4) els.stage.classList.add('nudging');
  }

  const pageTop = (t: number) => track.getBoundingClientRect().top + window.scrollY + t * unitPx();
  const scrollToTime = (t: number) => {
    play = null;
    carouselT = t;
    hidePrompt();
    window.scrollTo({ top: pageTop(t), behavior: 'auto' });
  };
  /** Once a slide has finished, a glowing line teases the next one. It's also a button. */
  let promptTimer: ReturnType<typeof setTimeout> | undefined;
  const swipes = window.matchMedia('(pointer: coarse)').matches;
  function hidePrompt() {
    clearTimeout(promptTimer);
    els.keepGoing.classList.remove('on');
    els.carNext.classList.remove('nudge');
  }
  function schedulePrompt(stop: number) {
    hidePrompt();
    // In the carousel the chevron's pulse is the prompt, and it starts as soon as the slide has finished.
    promptTimer = setTimeout(() => {
      els.keepGoingText.textContent = KEEP_GOING[stop - 1].replace('{verb}', swipes ? 'swiping' : 'scrolling');
      els.keepGoing.classList.add('on');
      // In the carousel the next chevron pulses, to show the story carries on sideways.
      if (carousel) els.carNext.classList.add('nudge');
    }, carousel ? 0 : PROMPT_AFTER);
  }
  const onKeepGoing = () => {
    if (scrollGesture(1)) return;
    hidePrompt();
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  };

  const playTo = (to: number, rate: number, dir: 1 | -1, then?: () => void) => {
    hidePrompt();
    // A phone hides the terrace behind the other parties only while the hero's up.
    if (carousel) root.classList.remove('uc-plain');
    if (!play) playhead = current;
    playingAt = pageTop(to);
    play = { to, rate, dir, then };
    window.scrollTo({ top: playingAt, behavior: 'auto' });
    kick();
  };
  const paceTo = (to: number, dir: 1 | -1, from: number) => (dir < 0 ? (from - to) / BACK_SECONDS : to === story.T ? LAST_SLIDE : 1);
  /** One gesture's worth of story: on to the next stop or back to the last. False if there's none that way. */
  function scrollGesture(dir: 1 | -1) {
    if (play?.dir === 1 && dir === 1) {
      play.rate = Math.max(play.rate, HURRY);
      return true;
    }
    // Already going back: each further gesture goes back one more.
    const from = play?.dir === -1 && dir === -1 ? play.to : play ? playhead : current;
    const to = dir > 0 ? story.stops.find((t) => t > from + 0.05) : [...story.stops].reverse().find((t) => t < from - 0.05);
    if (to === undefined) return false;
    playTo(to, paceTo(to, dir, play ? playhead : current), dir);
    return true;
  }
  /** Whether the story should answer a scroll this way, rather than the page. */
  function storyTakes(dir: 1 | -1) {
    if (reducedMotion.matches) return false;
    if (carousel) {
      // Up and down only move between the hero and the carousel; anything else is the page's.
      if (window.scrollY > pageTop(0) + 2) return false;
      // Down while a carousel slide plays is for the page; down out of the hero is ours.
      if (play) return dir < 0 || play.to <= story.stops[1];
      const t = target();
      return dir > 0 ? t < story.stops[1] - 0.02 : t > 0.02;
    }
    if (play) return true;
    const pastEnd = window.scrollY - pageTop(story.T);
    if (pastEnd > (dir < 0 ? layout.h * NEAR_END_VH : 2)) return false;
    const t = target();
    return dir > 0 ? t < story.T - 0.02 : t > 0.02;
  }

  let lastWheel = 0;
  let wheelDir = 0;
  let wheelTrough = 0;
  let lastFired = 0;
  let lastWheelAcross = 0;
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return;
    // A trackpad's sideways scroll moves through the carousel like a swipe across.
    if (carousel && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (window.scrollY > pageTop(0) + 2) return;
      e.preventDefault();
      if (e.timeStamp - lastWheelAcross > WHEEL_QUIET) across(e.deltaX > 0 ? 1 : -1);
      lastWheelAcross = e.timeStamp;
      return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
    hidePrompt();
    const dir = e.deltaY > 0 ? 1 : -1;
    const speed = Math.abs(e.deltaY);
    const quiet = e.timeStamp - lastWheel > (dir < 0 ? WHEEL_QUIET_BACK : WHEEL_QUIET);
    // Only going back needs this: one flick after another, faster than the last one's momentum fades.
    const settled = e.timeStamp - lastFired > WHEEL_RISE_AFTER;
    const flickedAgain = dir < 0 && settled && speed > wheelTrough * WHEEL_RISE + WHEEL_RISE_MARGIN;
    const fresh = quiet || dir !== wheelDir || flickedAgain;
    // Measured from once the flick has got going, or its own momentum looks like a second flick.
    wheelTrough = fresh || !settled ? speed : Math.min(wheelTrough, speed);
    lastWheel = e.timeStamp;
    wheelDir = dir;
    if (!storyTakes(dir)) return;
    e.preventDefault();
    if (fresh) {
      lastFired = e.timeStamp;
      // In the carousel, scrolling up goes to the hero just as a swipe does.
      upDown(dir);
    }
  };

  let touch: { x: number; y: number; used: boolean; page: boolean } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    hidePrompt();
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, used: false, page: false } : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!touch || e.touches.length !== 1 || touch.page) return;
    const dx = e.touches[0].clientX - touch.x;
    const dy = e.touches[0].clientY - touch.y;
    if (touch.used) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    // Decided on the first movement: the browser won't hand a scroll back once it's begun.
    // A thumb's swipe up or down drifts sideways a little, so across has to be clearly across.
    if (carousel && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (window.scrollY > pageTop(0) + 2) {
        touch.page = true;
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (Math.abs(dx) >= SWIPE_ACROSS) {
        touch.used = true;
        across(dx < 0 ? 1 : -1);
      }
      return;
    }
    const dir = dy < 0 ? 1 : -1;
    if (!storyTakes(dir)) {
      touch.page = true;
      return;
    }
    if (e.cancelable) e.preventDefault();
    if (Math.abs(dy) >= SWIPE && Math.abs(dy) > Math.abs(dx)) {
      touch.used = true;
      upDown(dir);
    }
  };
  /**
   * Back to the hero from the story, straight away: the hero's words and phone come down into place
   * over the terrace. The stage itself never moves, so there's never an empty screen between the two.
   */
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  /** Where the story was paused for a visit to the hero, and the stop it was playing on to, if any. */
  let paused: { t: number; to: number | null } | null = null;
  function toHero() {
    paused = { t: play ? playhead : current, to: play && play.dir > 0 ? play.to : null };
    play = null;
    hidePrompt();
    clearTimeout(leaveTimer);
    // At once: the hero is drawn on the very next frame, its words and phone dropping into place.
    playhead = 0;
    current = 0;
    carouselT = 0;
    dirty = true;
    // The hero always opens on the wedding, whichever party it was showing before.
    showUseCase(0);
    restartUcClock();
    root.classList.remove('story-leave', 'hero-leave', 'story-return', 'hero-return');
    void root.offsetWidth;
    root.classList.add('hero-return');
    kick();
  }
  /** Back into the story exactly where it was paused: the hero goes up and away, the story rises back in and carries on. */
  function resumeStory(from: { t: number; to: number | null }) {
    hidePrompt();
    root.classList.remove('hero-return', 'story-return');
    root.classList.add('hero-leave');
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      playhead = from.t;
      current = from.t;
      carouselT = from.t;
      dirty = true;
      root.classList.remove('hero-leave');
      void root.offsetWidth;
      root.classList.add('story-return');
      if (from.to !== null) playTo(from.to, paceTo(from.to, 1, from.t), 1);
      else {
        const stop = story.stops.findIndex((t) => Math.abs(t - from.t) < 0.02);
        if (stop > 0) schedulePrompt(stop);
      }
      kick();
    }, STORY_LEAVES_MS);
  }
  /**
   * Up and down in the carousel move between the hero and the story as two places. Up from anywhere
   * in the story pauses it there and goes straight to the hero; down picks it up again at that very
   * point. The first time down, the hero scrolls away into Guests join.
   */
  function upDown(dir: 1 | -1) {
    if (!carousel) {
      scrollGesture(dir);
      return;
    }
    const from = play ? playhead : current;
    if (dir < 0) {
      if (from > 0.02) toHero();
      return;
    }
    enterCarousel();
  }
  function enterCarousel() {
    if ((play ? playhead : current) > 0.02) return;
    // The story is the wedding's: whichever party the hero was showing, its terrace comes back.
    showUseCase(0);
    const from = paused;
    paused = null;
    if (from && from.t > story.stops[1] * 0.2) resumeStory(from);
    else scrollGesture(1);
  }
  /**
   * Back a slide, as smoothly as forward: the previous slide plays again from its start, rather
   * than the story rewinding.
   */
  function backSlide(from: number) {
    const showing = play ? story.stops.indexOf(play.to) : story.stops.findIndex((t) => Math.abs(t - from) < 0.02);
    const previous = showing - 1;
    // Back from Guests join, the first slide, is back up to the hero.
    if (previous < 1) {
      if (showing === 1) toHero();
      return;
    }
    const start = previous === 1 ? GUESTS_START : story.stops[previous - 1];
    play = null;
    playhead = start;
    current = start;
    carouselT = start;
    dirty = true;
    const to = story.stops[previous];
    playTo(to, paceTo(to, 1, start), 1);
  }
  /** Across, in the carousel: on to the next slide or back to the last, and past the end to the FAQs. */
  function across(dir: 1 | -1) {
    hidePrompt();
    const from = play ? playhead : current;
    if (dir > 0 && !play && from <= 0.02) {
      enterCarousel();
      return;
    }
    if (dir < 0) {
      backSlide(from);
      return;
    }
    // On to the next slide mid-way through one: from that slide's last frame, straight into the next.
    if (dir > 0 && play?.dir === 1 && play.to > story.stops[1] - 0.02) {
      const end = play.to;
      play = null;
      playhead = end;
      current = end;
      carouselT = end;
      dirty = true;
      if (end >= story.T - 0.02) {
        kick();
        return;
      }
    }
    if (dir > 0 && !play && from >= story.T - 0.02) {
      document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    scrollGesture(dir);
  }

  const SCROLL_KEYS: Record<string, 1 | -1> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (carousel && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && window.scrollY <= pageTop(0) + 2) {
      e.preventDefault();
      if (!e.repeat) across(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    const onControl = (e.target as HTMLElement).closest?.('a, button, input, select, textarea, summary');
    const dir = e.key === ' ' && !onControl ? (e.shiftKey ? -1 : 1) : SCROLL_KEYS[e.key];
    if (!dir) return;
    hidePrompt();
    if (!storyTakes(dir)) return;
    e.preventDefault();
    if (!e.repeat) upDown(dir);
  };

  const onChapter = (e: Event) => {
    const name = (e.currentTarget as HTMLElement).dataset.chapter!;
    if (name === 's1') {
      scrollToTime(0);
      return;
    }
    const lands = story.labels[name] + SECTION_LANDS;
    if (reducedMotion.matches) {
      scrollToTime(lands);
      return;
    }
    // Straight to that slide, and it plays from there.
    play = null;
    current = lands;
    const to = story.stops.find((t) => t > lands)!;
    playTo(to, paceTo(to, 1, lands), 1);
  };
  nav.forEach((b) => b.addEventListener('click', onChapter));

  // A keyboard user tabbing back to the hero's button should see it.
  const heroCtas = els.heroCta.querySelectorAll('a, button');
  const onHeroFocus = () => scrollToTime(0);
  heroCtas.forEach((a) => a.addEventListener('focus', onHeroFocus));

  // The prompt is a real control: it takes you to the first thing worth seeing.
  const onHint = () => {
    if (!reducedMotion.matches && scrollGesture(1)) return;
    scrollToTime(1.6);
  };
  els.hint.addEventListener('click', onHint);
  els.keepGoing.addEventListener('click', onKeepGoing);
  const onPrev = () => across(-1);
  const onNext = () => across(1);
  els.carPrev.addEventListener('click', onPrev);
  els.carNext.addEventListener('click', onNext);

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
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('keydown', onKey);
  kick();

  return () => {
    introStopped = true;
    stopped = true;
    cancelAnimationFrame(raf);
    clearInterval(ucClock);
    clearTimeout(resizeTimer);
    clearTimeout(repaintTimer);
    clearTimeout(railTimer);
    clearTimeout(leaveTimer);
    hidePrompt();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
    nav.forEach((b) => b.removeEventListener('click', onChapter));
    heroCtas.forEach((a) => a.removeEventListener('focus', onHeroFocus));
    els.hint.removeEventListener('click', onHint);
    els.keepGoing.removeEventListener('click', onKeepGoing);
    els.carPrev.removeEventListener('click', onPrev);
    els.carNext.removeEventListener('click', onNext);
    ucTabs.forEach((tab) => {
      tab.removeEventListener('click', onUcClick);
      tab.removeEventListener('focus', onUcFocus);
    });
  };
}
