import { CAST, DAWN_X, FIGURES, LATE, PLACES, SUN, SUN_DOWN, WORLD, figure, figureSize } from './world';
import { DEMO_EVENT, SWIRL } from './content';
import { Timeline, type Pose } from './timeline';

/**
 * The whole page's motion, in one timeline. See docs/story-site/03-motion-storyboard.md.
 *
 * Times are story units; the wrapper's height decides how much scroll each one
 * is. Transitions are short and carry no text; dwells are long and hold still.
 */

export interface Layout {
  w: number;
  h: number;
  /** Height that's always visible, with a phone's toolbars showing. */
  vis: number;
  /** On a phone, how far down the stage the longest scene's words reach. */
  copyEnd?: number;
  m: boolean;
}

/** Light that falls on one figure alone, in its exact shape: a world-space box and how bright, 0 to 1. */
export interface FigureLight {
  id: string;
  a: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Els = Record<string, HTMLElement>;

export interface Story {
  tl: Timeline;
  T: number;
  labels: Record<string, number>;
  cam: { cx: number; cy: number; vh: number };
  /** Who's lit, in their own shape, wherever the night is drawn. */
  figureLights: FigureLight[];
  /** How dark it is: 0 is the sunset, 1 is full night. */
  night: { v: number };
  /** When the use case tabs are on screen. */
  /** Where the camera starts: the last slide frames its terrace the same way. */
  heroCam: { cx: number; cy: number; vh: number };
  /** The moment each scene's still is captured at, for the linear page. */
  stills: Record<string, number>;
}

const PHONE = { w: 392, h: 850 };
/** How far the phone's body stands out around its screen. */
const BEZEL = 11;
/** Where the invitation's centre sits in the phone, before it's moved in the viewfinder. */
const VF_CARD = { x: 196, y: 370 };
/** The top of the villa's chimneys, in the panorama's pixels. */
const ROOF_TOP = 225;
/** Where a phone's narrow view of the venue centres: the villa's edge and the sun. */
const HOME_M = 2400;

/** A camera that shows world height `vh` centred on (cx, cy), kept inside the drawing. */
function shot(L: Layout, cx: number, cy: number, vh: number) {
  const halfW = (vh * L.w) / L.h / 2;
  return {
    cx: Math.max(halfW, Math.min(WORLD.w - halfW, cx)),
    cy: Math.min(WORLD.h - vh / 2, cy),
    vh,
  };
}

/** The whole room: full width on desktop, floor at the bottom of the stage. */
function wide(L: Layout, cx = WORLD.w / 2) {
  const vh = L.m ? 2400 : Math.max(WORLD.h, (WORLD.w * L.h) / L.w);
  // A landscape phone has no sky to spare, so it gives up the floor to keep the copy clear.
  const lift = !L.m && L.h < 520 ? 300 : 0;
  return shot(L, cx, WORLD.h - vh / 2 - lift, vh);
}

/**
 * Closer in, with the floor still at the bottom and enough sky left above the
 * skyline for the copy, so nothing has to be laid over the print to read it.
 */
function closer(L: Layout, cx: number) {
  // A short phone pulls back further, to keep the skyline under the words.
  const room = L.m ? (WORLD.h - ROOF_TOP) / (1 - (L.copyEnd ?? 0) / L.h) : 0;
  const vh = Math.min(Math.max(L.m ? 1650 : 1860, room), (WORLD.w * L.h) / L.w);
  return shot(L, cx, WORLD.h - vh / 2, vh);
}

/**
 * A push-in: world point (x, y) lands at a share of the screen, showing world height `vh`.
 * The floor stays at the bottom, and it won't enlarge the art much past its own size.
 */
function framed(L: Layout, x: number, y: number, vh: number, sx: number, sy = 0.5) {
  const fit = Math.max(L.h / 1.2, Math.min(vh, (WORLD.w * L.h) / L.w));
  const z = L.h / fit;
  return shot(L, x + ((0.5 - sx) * L.w) / z, y + ((0.5 - sy) * L.h) / z, fit);
}

function toScreen(L: Layout, cam: { cx: number; cy: number; vh: number }, x: number, y: number) {
  const z = L.h / cam.vh;
  return { x: L.w / 2 + (x - cam.cx) * z, y: L.h / 2 + (y - cam.cy) * z, z };
}

function phonePose(L: Layout, where: 'anchor' | 'center') {
  if (L.m) {
    const room = L.vis - 26 - (L.copyEnd ?? 0);
    const s = Math.min((L.w * 0.72) / PHONE.w, Math.min(L.vis * 0.66, room) / PHONE.h);
    // Close under the words rather than down at the fold, so there's no gap between the two.
    return { x: (L.w - PHONE.w * s) / 2, y: Math.min(L.vis - PHONE.h * s - 14, (L.copyEnd ?? 0) + 30), scale: s };
  }
  // Clear of the header's button above and the progress bar below, bezel included.
  const roomy = L.h >= 520;
  const top = roomy ? 72 : 42;
  const foot = roomy ? 62 : 12;
  const s = Math.min((L.h - top - foot) / (PHONE.h + BEZEL * 2), 1);
  const y = top + (L.h - top - foot - (PHONE.h + BEZEL * 2) * s) / 2 + BEZEL * s;
  if (where === 'center') return { x: (L.w - PHONE.w * s) / 2, y, scale: s };
  return { x: L.w * 0.76 - (PHONE.w * s) / 2, y, scale: s };
}

/** Where a descendant sits inside the phone screen, at the phone's own scale. */
function inPhone(el: HTMLElement, screen: HTMLElement) {
  let x = 0, y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== screen) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (p: number) => p * p * (3 - 2 * p);
const outCubic = (p: number) => 1 - (1 - p) ** 3;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export function buildStory(els: Els, group: (name: string) => HTMLElement[], layout: Layout): Story {
  const tl = new Timeline();
  const m = layout.m;
  const scenes = ['s2', 's3', 's4', 's5', 's6', 's7'].map((name) => els[`ch:${name}`]);
  const L: Layout = { ...layout, copyEnd: m ? Math.max(...scenes.map((c) => c.offsetTop + c.offsetHeight)) : 0 };
  /**
   * Desktop's room is wide and busy, so each scene pushes in on its subject and lets
   * everything else fall into shadow. Phones are close already, and a landscape phone
   * has no space for it around the copy.
   */
  const spot = !m && L.h >= 560;
  /** How far the room falls while one person has the stage. */
  const SHADOW = 0.88;
  const labels: Record<string, number> = {};
  // On a wide screen the hero's words need more sky, so the terrace starts a little lower.
  // On a phone, far enough along to keep the old man dancing in frame, with the sun still up.
  const dancer = figure('dad');
  const homeM = Math.max(HOME_M, dancer.x + figureSize(dancer).w / 2 + 40 - (wide(L).vh * L.w) / L.h / 2);
  const widest = wide(L, m ? homeM : undefined);
  const home = spot ? { ...widest, cy: widest.cy - (L.h * 0.07 * widest.vh) / L.h } : widest;
  const cam = { ...home };
  const night = { v: 0 };
  const figureLights: FigureLight[] = [];
  /** A light shaped exactly like one figure, so nobody beside them is caught by it. */
  const lightFigure = (id: string) => {
    const def = figure(id);
    const size = figureSize(def);
    const light = { id, a: 0, x: def.x - size.w / 2, y: def.y - size.h, w: size.w, h: size.h };
    figureLights.push(light);
    return light;
  };


  const ch = (name: string, at: number, dur = 0.5, y = 26) =>
    tl.fromTo(els[name], { alpha: 0, y }, { alpha: 1, y: 0 }, at, dur, 'out');
  const chOut = (name: string, at: number, dur = 0.35) => tl.to(els[name], { alpha: 0, y: -22 }, at, dur, 'in');
  const hidden = (...list: (HTMLElement | undefined)[]) => list.forEach((el) => tl.start(el, { opacity: 0 }));
  const screen = (name: string) => els[`screen:${name}`];
  const tap = (x: number, y: number, at: number) => {
    // It shows up early and pulses over the spot, so the eye gets there before the press.
    tl.set(els.tap, { x, y, scale: 1 }, at - 0.23);
    tl.to(els.tap, { opacity: 1 }, at - 0.22, 0.1, 'out');
    tl.to(els.tap, { scale: 0.74 }, at + 0.02, 0.1, 'out');
    tl.to(els.tap, { scale: 1 }, at + 0.12, 0.1, 'out');
    tl.to(els.tap, { opacity: 0 }, at + 0.3, 0.14, 'in');
  };
  const flashAt = (el: HTMLElement | undefined, x: number, y: number, at: number) => {
    tl.start(el, { x, y, scale: 0.2, opacity: 0 });
    tl.to(el, { opacity: 1, scale: 1 }, at, 0.08, 'out');
    tl.to(el, { opacity: 0, scale: 1.25 }, at + 0.1, 0.45, 'out');
  };
  const lens = (id: string) => {
    const def = figure(id);
    const size = figureSize(def);
    const [lx, ly] = def.lens ?? [0.5, 0.3];
    return { x: def.x - size.w / 2 + size.w * lx, y: def.y - size.h + size.h * ly };
  };

  /** Where a figure stands when it's in the scene. */
  const standing = (id: string) => {
    const def = figure(id);
    const size = figureSize(def);
    return { x: def.x - size.w / 2, y: def.y - size.h };
  };
  /** Out of sight below the frame until now, for whoever joins the scene late. */
  const OFFSTAGE = 1200;
  /** A two-layer screen change: on at `at`. */
  const showScreen = (name: string, at: number, dur = 0.25) => {
    tl.set(screen(name), { opacity: 0 }, at - 0.01);
    tl.to(screen(name), { opacity: 1 }, at, dur, 'out');
  };

  /**
   * The real counter's number, as the app sets it: it doesn't slide, it just changes.
   */
  const counts: [number, number][] = [];
  const setCount = (value: number, at: number) => counts.push([at, value]);
  let countShown = -1;
  tl.onRender((t) => {
    let value = DEMO_EVENT.shots;
    for (const [at, n] of counts) {
      if (t < at) break;
      value = n;
    }
    if (value !== countShown) {
      countShown = value;
      els.camCountN.textContent = String(value);
    }
  });

  // ---- everyone in place, in the last of the sun
  for (const def of FIGURES) {
    const size = figureSize(def);
    tl.start(els[`fig:${def.id}`], { x: def.x - size.w / 2, y: def.y - size.h });
  }
  for (const id of LATE) {
    tl.start(els[`fig:${id}`], { y: standing(id).y + OFFSTAGE, opacity: 0, rot: 0 });
  }
  for (const n of ['s2', 's3', 's4', 's5', 's6', 's7', 's8']) tl.start(els[`ch:${n}`], { alpha: 0, y: 26 });
  tl.start(els['ch:s1'], { alpha: 1 });
  // There from the start, open on the event: beside the words, or under them on a phone,
  // where it fits between the words and the prompt, so neither has to sit on the other.
  const heroAnchor = phonePose(L, 'anchor');
  const promptTop = els.hint.offsetTop + Math.min(...Array.from(els.hint.children as HTMLCollectionOf<HTMLElement>).filter((c) => c.offsetHeight > 0).map((c) => c.offsetTop));
  const heroY = m ? els['ch:s1'].offsetTop + els['ch:s1'].offsetHeight + 28 : heroAnchor.y;
  const heroScale = m ? Math.min(heroAnchor.scale, (promptTop - 14 - heroY) / (PHONE.h + BEZEL)) : heroAnchor.scale;
  tl.start(els.phone, { x: (m ? (L.w - PHONE.w * heroScale) / 2 : heroAnchor.x), y: heroY, scale: heroScale, opacity: 1 });
  tl.start(screen('home'), { opacity: 1 });
  tl.start(screen('party'), { x: 0, y: 0, scale: 1, opacity: 1 });
  tl.start(els.sun, { x: 0, y: 0 });
  tl.start(els.festoonGlow, { glow: 0 });
  tl.start(els.dim, { opacity: 0 });
  tl.start(els.dawn, { opacity: 0 });
  tl.start(els.copyShade, { opacity: 0 });

  // ---- S1. You'll miss most of your own party: the first scroll leaves at once
  labels.s1 = 0;
  // The nudge has the bottom of the screen to itself, until the chapters take over.
  tl.to(els.hint, { opacity: 0 }, 0.02, 0.2, 'none');
  tl.to(els.hintBand, { opacity: 0 }, 0.02, 0.2, 'none');
  tl.start(els.chapters, { alpha: 0 });
  tl.to(els.chapters, { alpha: 1 }, 0.25, 0.25, 'none');
  tl.to(els['ch:s1'], { alpha: 0 }, 0.03, 0.2, 'none');
  // Whichever party was showing, the story itself is the wedding: the terrace comes back,
  // and the event closes up into its icon on the home screen.
  tl.start(els.ucStage, { opacity: 1 });
  tl.to(els.ucStage, { opacity: 0 }, 0.03, 0.3, 'none');
  const stillsIcon = inPhone(els.homeStills, els.screen);
  tl.to(screen('party'), { x: stillsIcon.x, y: stillsIcon.y, scale: stillsIcon.w / PHONE.w }, 0.04, 0.26, 'inOut');
  tl.to(screen('party'), { opacity: 0 }, 0.26, 0.05, 'none');

  // ---- How one section hands over to the next. The scene stays: the phone goes, the camera
  // pulls back to the whole terrace and the room falls into shadow, and the new words arrive.
  // Then a light finds whoever the section's about, and the camera moves in on them. That
  // rhythm is the signal that something new has started.
  const LEAVE = 0.3;
  /** How dark the room goes while it changes over, and stays around a spotlight. */
  const DIM = SHADOW;
  type Beat = { title: number; light: number; zoom: number; phone: number; ready: number };
  const BEAT: Beat = { title: 0.35, light: 0.85, zoom: 1.15, phone: 1.55, ready: 2.15 };
  const ZOOM_FOR = 0.8;
  /** Out of the hero the whole scene's already showing, so only the words and the phone change. */
  const FROM_HERO: Beat = { title: 0.1, light: 0.4, zoom: 0.55, phone: 0.75, ready: 1.35 };
  const section = (name: string, at: number, leaving?: string, beat = BEAT, dim?: number) => {
    if (leaving) chOut(`ch:${leaving}`, at, 0.2);
    if (beat !== FROM_HERO) tl.to(cam, home, at, 0.7, 'inOut');
    if (dim !== undefined) tl.to(night, { v: dim }, at, 0.45, 'none');
    ch(`ch:${name}`, at + beat.title, 0.25, 14);
    labels[name] = at + beat.title;
    return { at, blank: at + LEAVE + 0.05, light: at + beat.light, zoom: at + beat.zoom, phone: at + beat.phone, ready: at + beat.ready };
  };
  const camTo = (s: { cx: number; cy: number; vh: number }, at: number) => tl.to(cam, s, at, ZOOM_FOR, 'inOut');
  const phoneOut = (at: number) => tl.to(els.phone, { opacity: 0 }, at, LEAVE - 0.05, 'none');
  /** Up into place once the scene's had its moment, set ready while nothing's showing. */
  const phoneIn = (pose: { x: number; y: number; scale: number }, s: { blank: number; phone: number }) => {
    tl.set(els.phone, { ...pose, y: pose.y + 36 }, s.blank);
    tl.to(els.phone, { opacity: 1 }, s.phone, 0.35, 'none');
    tl.to(els.phone, { y: pose.y }, s.phone, 0.5, 'out3');
  };
  // Pushed in, there's no empty sky behind the words, so they bring their own shade.
  const shadeIn = (s: { zoom: number }) => {
    if (spot) tl.to(els.copyShade, { opacity: 1 }, s.zoom, 0.6, 'none');
  };
  const shadeOut = (at: number) => {
    if (spot) tl.to(els.copyShade, { opacity: 0 }, at, LEAVE, 'none');
  };

  // ---- S2. Join: their everyday camera, your QR code, and they're in.
  const s2 = section('s2', 0.2, undefined, FROM_HERO);
  tl.to(els.phone, { opacity: 0 }, 0.32, 0.16, 'none');
  camTo(closer(L, m ? PLACES.entrance.x + 120 : PLACES.entrance.x), s2.zoom);
  // The room falls away, and the invitation and the phone have the stage.
  if (spot) tl.to(night, { v: 0.74 }, s2.zoom, ZOOM_FOR, 'inOut');
  const anchor = phonePose(L, 'anchor');
  // On a phone the invitation sits between the copy and the phone's top edge, tucked just
  // behind it. The phone stays low to make the room, cropping only its bottom.
  const invTop = (L.copyEnd ?? 0) + 14;
  // Not so low that the yellow pill, when it comes, is lost behind the progress bar.
  const pillBox = inPhone(els.pill, els.screen);
  const lowest = L.vis - 34 - (pillBox.y + pillBox.h) * anchor.scale;
  const invH = Math.max(60, Math.min(182, L.vis * 0.24, lowest + 24 - invTop));
  const scanPhoneY = m ? invTop + invH - 24 : anchor.y;
  phoneIn({ ...anchor, y: scanPhoneY }, s2);
  const invPose = m
    ? { x: L.w * 0.5 - 143, y: invTop + invH / 2 - 198, scale: invH / 396, rot: -4 }
    : { x: L.w * 0.42 - 143, y: L.h * 0.63 - 198, scale: Math.min(1.08, (L.h * 0.52) / 396), rot: -4 };
  tl.start(els.invRoom, { ...invPose, opacity: 0 });
  tl.to(els.invRoom, { opacity: 1 }, s2.phone, 0.35, 'none');

  // Camera opens out of its icon.
  const cameraIcon = inPhone(els.homeCamera.querySelector<HTMLElement>('.home-cam')!, els.screen);
  tap(cameraIcon.x + cameraIcon.w / 2, cameraIcon.y + cameraIcon.h / 2, s2.ready + 0.1);
  tl.start(screen('ios'), { x: cameraIcon.x, y: cameraIcon.y, scale: cameraIcon.w / PHONE.w, opacity: 0 });
  tl.set(screen('ios'), { opacity: 1 }, s2.ready + 0.25);
  tl.to(screen('ios'), { x: 0, y: 0, scale: 1 }, s2.ready + 0.25, 0.3, 'out3');
  // Held up beside the phone, then the card moves behind it, and the viewfinder picks it up
  // as it goes: the same card in the same place, at the same size, as if seen through the phone.
  const SLIDE = s2.ready + 0.5;
  const behind = { x: anchor.x + VF_CARD.x * anchor.scale - 143, y: scanPhoneY + VF_CARD.y * anchor.scale - 198, scale: anchor.scale, rot: -3 };
  const inFinder = (pose: { x: number; y: number; scale: number; rot: number }) => ({
    x: (pose.x + 143 - anchor.x) / anchor.scale - VF_CARD.x,
    y: (pose.y + 198 - scanPhoneY) / anchor.scale - VF_CARD.y,
    scale: pose.scale / anchor.scale,
    rot: pose.rot,
  });
  tl.start(els.invVf, inFinder(invPose));
  tl.to(els.invRoom, behind, SLIDE, 0.9, 'inOut');
  tl.to(els.invVf, inFinder(behind), SLIDE, 0.9, 'inOut');
  // Out of sight behind the phone now, and it stays there.
  tl.set(els.invRoom, { opacity: 0 }, SLIDE + 0.95);
  const FOUND = SLIDE + 0.65;
  tl.fromTo(els.reticle, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1 }, FOUND, 0.25, 'out3');
  tl.fromTo(els.pill, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, FOUND + 0.1, 0.2, 'back');
  // iOS raises the App Clip card over the camera: no store, no install.
  const CARD = FOUND + 0.7;
  tl.to(els.clipDim, { opacity: 1 }, CARD, 0.25, 'none');
  tl.start(els.clipCard, { y: 560, opacity: 0 });
  tl.set(els.clipCard, { opacity: 1 }, CARD);
  tl.to(els.clipCard, { y: 0 }, CARD, 0.4, 'out3');
  // On a phone it's been sitting low to make room for the invitation.
  if (m) tl.to(els.phone, { y: anchor.y }, CARD, 0.4, 'inOut');
  const clipOpen = inPhone(els.clipOpen, els.screen);
  tap(clipOpen.x + clipOpen.w / 2, clipOpen.y + clipOpen.h / 2, CARD + 0.75);
  tl.set(els.clipOpenText, { opacity: 0 }, CARD + 0.9);
  tl.set(els.clipSpin, { opacity: 1 }, CARD + 0.9);
  showScreen('join', CARD + 1.05, 0.25);

  // ---- S3. Seating: the crowd round the paper chart, gone the moment it's a QR code.
  const s3 = section('s3', CARD + 1.95, 's2', BEAT, DIM);
  phoneOut(s3.at);
  const crowd = figure('easelCrowd');
  // The whole crowd in frame: on a phone that needs the wider view.
  const crowdShot = m ? wide(L, crowd.x) : spot ? framed(L, crowd.x, crowd.y - crowd.h / 2, 1300, 0.5) : closer(L, crowd.x);
  camTo(crowdShot, s3.zoom);
  const crowdLight = lightFigure('easelCrowd');
  tl.to(crowdLight, { a: 1 }, s3.light, 0.5, 'out3');
  shadeIn(s3);
  // What's underneath is done with. Left showing, Safari can paint it over the new screen.
  for (const name of ['home', 'ios', 'join']) tl.set(screen(name), { opacity: 0 }, s3.blank);
  // These set their own visibility, so hiding their screen doesn't stop them being drawn. The blur especially.
  for (const el of [els.clipDim, els.clipCard]) tl.set(el, { opacity: 0 }, s3.blank);
  tl.start(screen('table'), { opacity: 0 });
  tl.set(screen('table'), { opacity: 1 }, s3.blank);
  tl.start(els.seatView, { opacity: 1 });

  // A moment to take in the scrum. Then it shakes, and bursts, and in its place is one easel
  // with a QR code, twinkling: the crowd has nowhere to be.
  const SWAP = s3.at + BEAT.ready + 0.5;
  const crowdBox = { ...standing('easelCrowd'), ...figureSize(crowd) };
  const crowdEl = els['fig:easelCrowd'];
  tl.start(crowdEl, { rot: 0, scale: 1 });
  [-1.5, 2, -2.5, 3, -3.5, 0].forEach((rot, i) => tl.to(crowdEl, { rot }, SWAP - 0.42 + i * 0.07, 0.07, 'inOut'));
  tl.to(crowdEl, { scale: 1.18, opacity: 0 }, SWAP, 0.14, 'out');
  const burst = { x: crowdBox.x + crowdBox.w / 2, y: crowdBox.y + crowdBox.h * 0.45 };
  flashAt(els['flash:9'], burst.x, burst.y, SWAP);
  flashAt(els['flash:10'], burst.x + 120, burst.y - 80, SWAP + 0.05);
  const qrBox = { ...standing('easelQr'), ...figureSize(figure('easelQr')) };
  const qrEl = els['fig:easelQr'];
  // Drawn, all but invisibly, from the start of the section: a browser won't decode a hidden
  // image, so left hidden it would arrive late.
  tl.start(qrEl, { scale: 0.7 });
  tl.set(qrEl, { y: qrBox.y, opacity: 0.01 }, s3.blank);
  tl.to(qrEl, { opacity: 1 }, SWAP + 0.08, 0.1, 'none');
  tl.to(qrEl, { scale: 1 }, SWAP + 0.08, 0.45, 'back');
  // Twinkles round its board, twice over.
  const SPARKS: [number, number, number][] = [[0.04, 0.04, 1], [1.02, 0.12, 0.75], [-0.06, 0.38, 0.7], [1.06, 0.44, 1], [0.5, -0.06, 0.85], [0.86, 0.62, 0.6]];
  group('sparkle').forEach((el, i) => {
    const [fx, fy, size] = SPARKS[i];
    tl.start(el, { x: qrBox.x + qrBox.w * fx, y: qrBox.y + qrBox.h * fy, scale: 0, rot: 0, opacity: 0 });
    [0, 0.55].forEach((again, k) => {
      const at = SWAP + 0.35 + again + i * 0.07;
      tl.set(el, { opacity: 1 }, at);
      tl.to(el, { scale: size * (k ? 0.8 : 1), rot: 45 * (k + 0.5) }, at, 0.12, 'out');
      tl.to(el, { scale: 0, rot: 45 * (k + 1) }, at + 0.14, 0.22, 'in');
      tl.set(el, { opacity: 0 }, at + 0.37);
    });
  });
  tl.to(crowdLight, { a: 0 }, SWAP, 0.14, 'out');
  const qrLight = lightFigure('easelQr');
  tl.to(qrLight, { a: 1 }, SWAP + 0.08, 0.3, 'out');
  // And the answer is on the phone: her table, then the floor plan.
  phoneIn(anchor, { blank: s3.blank, phone: SWAP + 0.55 });
  const PLAN = SWAP + 1.45;
  const planBox = inPhone(els.seatPlan, els.screen);
  const PLAN_ZOOM = 2.5;
  const PLAN_W = 300;
  const PLAN_H = 340;
  const planFit = Math.min(planBox.w / PLAN_W, planBox.h / PLAN_H);
  const planInsetX = (planBox.w - PLAN_W * planFit) / 2;
  const planInsetY = (planBox.h - PLAN_H * planFit) / 2;
  const planPanX = -planBox.w * 0.08;
  const planPanY = -planBox.h * 1.3;
  const seatedAt = PLAN + 2;

  // Ayla, who'll be shooting from her seat in the next scene.
  const aylaSize = figureSize(figure('ayla'));

  // The floor plan: a swipe left brings it in, and two fingers pinch in on her table.
  const toggle = inPhone(els.seatToggle, els.screen);
  const PAGE = planBox.w + 16;
  const swipeY = planBox.y + planBox.h * 0.42;
  const swipe = (at: number, fromX: number, toX: number) => {
    tl.set(els.tap, { x: planBox.x + planBox.w * fromX, y: swipeY }, at - 0.01);
    tl.to(els.tap, { opacity: 1, scale: 0.8 }, at, 0.08, 'out');
    tl.to(els.tap, { x: planBox.x + planBox.w * toX }, at + 0.08, 0.5, 'inOut');
    tl.to(els.tap, { opacity: 0 }, at + 0.58, 0.1, 'in');
  };
  // The two pages move with the finger, and the toggle above follows them.
  tl.start(els.seatPlan, { x: PAGE, opacity: 0 });
  tl.set(els.seatPlan, { opacity: 1 }, PLAN);
  swipe(PLAN, 0.84, 0.16);
  tl.to(els.seatCard, { x: -PAGE }, PLAN + 0.08, 0.5, 'inOut');
  tl.to(els.seatPlan, { x: 0 }, PLAN + 0.08, 0.5, 'inOut');
  tl.to(els.seatToggleOn, { x: toggle.w / 2 - 4 }, PLAN + 0.08, 0.5, 'inOut');
  // Two fingers spreading, and the plan following them in towards the bottom left.
  const pinch = { x: planBox.x + planBox.w * 0.42, y: planBox.y + planBox.h * 0.6 };
  [els.tap, els.tap2].forEach((dot, i) => {
    const way = i ? 1 : -1;
    tl.set(dot, { x: pinch.x + way * 20, y: pinch.y + way * 20 }, PLAN + 0.72);
    tl.to(dot, { opacity: 1, scale: 0.8 }, PLAN + 0.74, 0.06, 'out');
    tl.to(dot, { x: pinch.x + way * 92, y: pinch.y + way * 92 }, PLAN + 0.8, 0.6, 'inOut');
    tl.to(dot, { opacity: 0 }, PLAN + 1.4, 0.1, 'in');
  });
  // Zoomed by redrawing the plan closer in, not by enlarging a picture of it, so it stays sharp.
  const planSvg = els.planZoom.querySelector('svg')!;
  const planCam = { x: 0, y: 0, scale: 1 };
  let planDrawn = '';
  tl.onRender(() => {
    const { x, y, scale } = planCam;
    const view = `${(planInsetX * (1 - scale) - x) / (planFit * scale)} ${(planInsetY * (1 - scale) - y) / (planFit * scale)} ${PLAN_W / scale} ${PLAN_H / scale}`;
    if (view === planDrawn) return;
    planDrawn = view;
    planSvg.setAttribute('viewBox', view);
  });
  // Scale 2.5, with table 7 (bottom left of the plan) landing in the middle.
  tl.to(planCam, { x: planPanX, y: planPanY, scale: PLAN_ZOOM }, PLAN + 0.8, 0.6, 'inOut');

  // ---- S4. Photos: night falls under the words, the phone's put away, and the whole party is shooting.
  const s4 = section('s4', seatedAt + 0.6, 's3');
  phoneOut(s4.at);
  shadeOut(s4.at);
  tl.to(night, { v: 1 }, s4.at, 0.7, 'none');
  tl.to(qrLight, { a: 0 }, s4.at, LEAVE, 'none');
  tl.to(els.sun, { y: SUN_DOWN }, s4.at, 0.6, 'in');
  tl.to(els.festoonGlow, { glow: 1 }, s4.at + 0.3, 0.6, 'none');
  const aylaLens = { x: PLACES.aylaSeat.x - aylaSize.w / 2 + aylaSize.w * 0.62, y: PLACES.aylaSeat.y - aylaSize.h * 0.9 };
  // The party is the subject, so desktop stays on the whole terrace. A phone moves along to the far end of it.
  const partyShot = m ? shot(L, figure('dad').x + 60, WORLD.h - 1050, 2100) : home;
  if (m) camTo(partyShot, s4.zoom);

  // Each flash lights a patch of the party, and a photo appears above it and stays.
  const SHOTS = m
    ? [
        { who: 'ayla', moment: 'singalong', lensAt: aylaLens },
        { who: 'ayla', moment: 'dad', lensAt: aylaLens },
        { who: 'ayla', moment: 'cake', lensAt: aylaLens },
      ]
    : [
        { who: 'auntie', moment: 'girlDog' },
        { who: 'auntie', moment: 'hug' },
        { who: 'ayla', moment: 'singalong', lensAt: aylaLens },
        { who: 'ayla', moment: 'dad', lensAt: aylaLens },
        { who: 'ayla', moment: 'cake', lensAt: aylaLens },
      ];
  type FlashRecord = { t: number; x: number; y: number; to: { x: number; y: number }; s: number; rot: number };
  const records: FlashRecord[] = [];
  let at = s4.ready - 0.2;
  const momentLights: FigureLight[] = [];
  SHOTS.forEach((s, i) => {
    const moment = figure(s.moment);
    // Whoever's holding the camera on a phone is out of frame, so the flash goes off over the moment itself.
    const l = m ? { x: moment.x, y: moment.y - moment.h * 0.7 } : (s.lensAt ?? lens(s.who));
    flashAt(els[`flash:${i + 2}`], l.x, l.y, at);
    const glow = lightFigure(s.moment);
    tl.to(glow, { a: 1 }, at, 0.4, 'out3');
    momentLights.push(glow);
    const face = toScreen(L, partyShot, moment.x, moment.y - moment.h);
    const source = toScreen(L, partyShot, moment.x, moment.y - moment.h * 0.5);
    const printScale = (m ? 0.46 : Math.min(0.66, L.w / 2000)) * Math.min(1, L.h / 760);
    records.push({
      t: at,
      x: source.x,
      y: source.y,
      to: { x: Math.max(70, Math.min(L.w - 70, face.x + (i % 2 ? 30 : -30))), y: Math.max(m ? 360 : 170, face.y - (m ? 90 : 70) - (i % 3) * 30) },
      s: printScale,
      rot: [-8, 6, -4, 9, -6][i],
    });
    at += m ? 0.55 : 0.42;
  });

  // ---- S5. Challenges: the row of them lit on the event page, one tapped, one photo taken.
  const s5 = section('s5', at + 0.8, 's4', BEAT, 1);
  // The fresh camera waits underneath the event page, until the disposable scene needs it.
  tl.set(screen('camera'), { opacity: 1 }, s5.blank);
  tl.set(screen('dare'), { opacity: 1 }, s5.blank);
  tl.set(screen('table'), { opacity: 0 }, s5.blank);
  tl.set(els.seatView, { opacity: 0 }, s5.blank);
  phoneIn(anchor, s5);
  momentLights.forEach((glow) => tl.to(glow, { a: 0 }, s5.at, LEAVE, 'none'));
  const crew = figure('dareCrew');
  if (m) camTo(closer(L, crew.x), s5.zoom);
  if (spot) camTo(framed(L, crew.x, crew.y - 300, 1140, 0.27), s5.zoom);
  shadeIn(s5);
  const crewLight = lightFigure('dareCrew');
  tl.to(crewLight, { a: 1 }, s5.light, 0.5, 'out3');

  const tiles = group('dareTile');
  const slides = group('dareSlide');
  const camTitles = group('dareCamTitle');
  const shots = group('dareShot');
  const bars = group('dareBar');
  const darePrints = group('darePrint').slice(0, 2);
  const dareCta = group('dareCta')[0];
  hidden(els.dareViewer, els.dareCam, els.dareFlash, ...slides, ...camTitles, ...shots, ...bars);
  const tile = inPhone(tiles[0], els.screen);
  // The rest of the screen is dimmed already, so there's no missing what the challenges are. Then the tap.
  els.dareFocus.style.top = `${tile.y - 10}px`;
  els.dareFocus.style.height = `${tile.h + 20}px`;
  tl.start(els.dareFocus, { opacity: 0 });
  tl.set(els.dareFocus, { opacity: 1 }, s5.blank);
  const TILE = s5.ready + 0.35;
  tap(tile.x + tile.w / 2, tile.y + 30, TILE);
  const VIEWER = TILE + 0.2;
  tl.to(els.dareViewer, { opacity: 1 }, VIEWER, 0.2, 'none');
  tl.set(els.dareFocus, { opacity: 0 }, VIEWER + 0.2);
  const cta = inPhone(dareCta, els.screen);
  const printSize = m ? Math.min(L.w * 0.5, L.h * 0.26) : Math.min(L.w * 0.15, L.h * 0.3);
  // Two dares, one after the other: the prompt, Add Yours, the camera, one shutter and one flash.
  const DARE_EVERY = 1.7;
  const FIRE = VIEWER + DARE_EVERY + 1.15;
  darePrints.forEach((el, i) => {
    const t = VIEWER + i * DARE_EVERY;
    tl.set(slides[i], { opacity: 1 }, t);
    tl.set(bars[i], { opacity: 1 }, t);
    tap(cta.x + cta.w / 2, cta.y + cta.h / 2, t + 0.55);
    tl.set(els.dareCam, { opacity: 1 }, t + 0.8);
    tl.set(camTitles[i], { opacity: 1 }, t + 0.8);
    tl.set(shots[i], { opacity: 1 }, t + 0.8);
    const fire = t + 1.15;
    tl.to(els.dareShutter, { scale: 0.82 }, fire - 0.1, 0.1, 'out');
    tl.to(els.dareShutter, { scale: 1 }, fire + 0.1, 0.2, 'out');
    tl.to(els.dareFlash, { opacity: 1 }, fire, 0.05, 'none');
    tl.to(els.dareFlash, { opacity: 0 }, fire + 0.1, 0.4, 'out');
    flashAt(els[`flash:${i + 7}`], crew.x - 70 + i * 140, crew.y - crew.h * 0.75, fire);
    // Out of the phone, and pinned up beside it with the dare it answered.
    const pose = m
      ? { x: (L.w - printSize) / 2 + (i - 1) * 12, y: L.h * 0.3, rot: [-3, 2][i] }
      : spot
        // Stacked beside the phone, clear of the crew and of the copy.
        ? { x: L.w * 0.47 + i * 12, y: L.h * 0.09 + i * 16, rot: [-5, 3][i] }
        : { x: L.w * (0.09 + i * 0.135), y: L.h * (0.42 + i * 0.05), rot: [-5, 3][i] };
    tl.start(el, { x: anchor.x + 60, y: anchor.y + 300, scale: 0.3, rot: 0, opacity: 0 });
    tl.to(el, { opacity: 1 }, fire + 0.02, 0.1, 'none');
    tl.to(el, { ...pose, scale: printSize / 300 }, fire + 0.02, 0.5, 'out3');
    if (i === 0) {
      tl.set(els.dareCam, { opacity: 0 }, fire + 0.5);
      tl.set(camTitles[i], { opacity: 0 }, fire + 0.5);
      tl.set(shots[i], { opacity: 0 }, fire + 0.5);
      tl.set(slides[i], { opacity: 0 }, fire + 0.5);
      // No room to stack them on a phone, so the first makes way.
      if (m) tl.to(el, { opacity: 0 }, fire + 0.4, 0.15, 'none');
    }
  });

  // ---- S6. Guestbook: one guest, one message, and the only thing moving is her voice.
  const s6 = section('s6', FIRE + 1.15, 's5');
  phoneOut(s6.at);
  shadeOut(s6.at);
  darePrints.forEach((el) => tl.to(el, { opacity: 0 }, s6.at, LEAVE - 0.05, 'none'));
  tl.to(crewLight, { a: 0 }, s6.at, LEAVE, 'none');
  // She's been on the terrace all night: now she's the one in the light.
  const speaker = figure('guestVoice');
  if (m) camTo(closer(L, speaker.x), s6.zoom);
  if (spot) camTo(framed(L, speaker.x, speaker.y - 300, 1280, 0.28), s6.zoom);
  shadeIn(s6);
  const speakerLight = lightFigure('guestVoice');
  tl.to(speakerLight, { a: 1 }, s6.light, 0.5, 'out3');
  tl.set(screen('guestbook'), { opacity: 1 }, s6.blank);
  for (const el of [screen('dare'), els.dareViewer, els.dareCam]) tl.set(el, { opacity: 0 }, s6.blank);
  phoneIn(anchor, s6);
  const SPEAK = s6.ready;
  tl.to(els.gbStrip, { x: -560 }, SPEAK, 2.2, 'none');
  // The recording's own timer: down a second at a time, as the app's does.
  let gbShown = -1;
  tl.onRender((t) => {
    const left = 60 - Math.floor(seg(t, SPEAK, SPEAK + 2.2) * 5);
    if (left === gbShown) return;
    gbShown = left;
    els.gbTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  });

  const shutter = els.shutter;
  hidden(els.thumb1, els.thumb2, els.thumb3, els.vfMono, els.camFade, els.camFlash, els.vf3);

  // ---- S7. Disposable: a fresh roll, and the room falls away to leave only the counter, going down to nothing.
  const s7 = section('s7', SPEAK + 2.5, 's6');
  phoneOut(s7.at);
  shadeOut(s7.at);
  tl.to(speakerLight, { a: 0 }, s7.at, LEAVE, 'none');
  tl.set(screen('guestbook'), { opacity: 0 }, s7.blank);
  tl.to(els.dim, { opacity: 0.86 }, s7.zoom, ZOOM_FOR, 'none');

  const cells = group('cell');
  const locks = group('cellLock');
  const lockIns = group('cellLockIn');
  // Scrolled along so the photos have the screen, but never so far that the event's card
  // reaches the clock: the cover stays behind the status bar, as it does at the top of the page.
  tl.start(els.evScroll, { y: -200 });
  const GRID_MAX = -320;

  tl.set(els.vf3, { opacity: 1 }, s7.blank);
  tl.set(els.vfMono, { opacity: 1 }, s7.blank);
  tl.set(els.camFade, { opacity: 1 }, s7.blank);
  phoneIn(anchor, s7);

  // The push towards the counter, the same move the app's capture-limit step makes. The
  // pill grows as well, in the phone's own pixels, so it's sharp. Everything else fades.
  const count = inPhone(els.camCount, els.screen);
  const countZ = m ? Math.min(2.1, L.w / 270) : Math.min(1.6, L.h / 520);
  const pillZ = m ? 1.7 : 1.9;
  const countAt = m ? { x: L.w * 0.24, y: L.vis * 0.62 } : { x: L.w * 0.62, y: L.h * 0.62 };
  const countMid = { x: count.x + (count.w * pillZ) / 2, y: count.y + count.h - (count.h * pillZ) / 2 };
  const countPose = {
    x: countAt.x - countMid.x * countZ,
    y: countAt.y - countMid.y * countZ,
    scale: countZ,
  };
  const zoomed = s7.ready + 0.7;
  tl.to(els.phone, countPose, s7.ready, 0.7, 'inOut');
  tl.to(els.camCount, { scale: pillZ }, s7.ready, 0.7, 'inOut');
  for (const el of [els.camHead, els.camZoom, els.camRail, els.camBar]) {
    tl.start(el, { opacity: 1 });
    tl.to(el, { opacity: 0.14 }, s7.ready, 0.5, 'none');
  }

  // Down to the last shot: slowly, then faster and faster, with the flashes dying away
  // early so it never strobes.
  const roll = DEMO_EVENT.shots;
  const shotsFrom = zoomed + 0.15;
  const shotsFor = 1.7;
  for (let k = 0; k < roll; k++) {
    const t = shotsFrom + shotsFor * (k / roll) ** 0.6;
    if (k < 5) {
      tl.to(shutter, { scale: 0.82 }, t - 0.08, 0.08, 'out');
      tl.to(shutter, { scale: 1 }, t + 0.03, 0.06, 'out');
    }
    if (k < 3) {
      tl.to(els.camFlash, { opacity: 0.8 - k * 0.2 }, t, 0.03, 'none');
      tl.to(els.camFlash, { opacity: 0 }, t + 0.04, 0.2, 'out');
    }
    setCount(roll - 1 - k, t + 0.02);
    if (k === 0) tl.set(els.thumb1, { opacity: 1 }, t + 0.1);
    if (k === 3) tl.set(els.thumb2, { opacity: 1 }, t + 0.1);
    if (k === 6) tl.set(els.thumb3, { opacity: 1 }, t + 0.1);
  }

  // The phone's layer is drawn once and then only moved, which is what keeps scrolling
  // smooth, but enlarged that far it's soft. So it's redrawn at this size for the hold.
  const WAIT = shotsFrom + shotsFor + 0.35;
  let sharp = false;
  tl.onRender((t) => {
    // Not on a phone, where the redraw at this size takes more memory than Safari may allow.
    const next = !m && t >= zoomed && t < WAIT;
    if (next !== sharp) {
      sharp = next;
      els.phone.style.willChange = next ? 'auto' : '';
    }
  });

  // ---- The roll's finished: back out, to the gallery, where every photo is locked.
  tl.to(els.phone, anchor, WAIT, 0.7, 'inOut');
  tl.to(els.camCount, { scale: 1 }, WAIT, 0.5, 'inOut');
  tl.to(els.dim, { opacity: 0.5 }, WAIT, 0.6, 'none');
  hidden(...locks, els.evEnded, els.fabSave);
  locks.forEach((el) => tl.set(el, { opacity: 1 }, WAIT + 0.2));
  tl.set(els.evLeft, { opacity: 0 }, WAIT + 0.2);
  tl.set(els.evEnded, { opacity: 1 }, WAIT + 0.2);
  tl.set(els.fabCamera, { opacity: 0 }, WAIT + 0.2);
  tl.set(els.fabSave, { opacity: 1 }, WAIT + 0.2);
  // On a phone it passes behind the words on its way back, so its own words wait until it's landed.
  const eventBack = WAIT + (m ? 0.55 : 0.25);
  tl.set(screen('event'), { opacity: 0 }, eventBack - 0.02);
  tl.to(screen('event'), { opacity: 1 }, eventBack, 0.25, 'out');
  // Hidden once the event covers it: nothing shows the camera again.
  tl.set(screen('camera'), { opacity: 0 }, eventBack + 0.27);

  // ---- Still the disposable: the roll develops overnight. The sun comes up, the guests have
  // all gone home, and it's just the two of them as each photo comes out of its lock.
  const OVERNIGHT = eventBack + 0.7;
  const dawnDx = (m ? DAWN_X.narrow : DAWN_X.wide) - (SUN.x + SUN.d / 2);
  // Moved across while it's still down behind the villa.
  tl.set(els.sun, { x: dawnDx }, WAIT);
  tl.to(night, { v: 0 }, OVERNIGHT, 1.1, 'inOut');
  tl.to(els.dawn, { opacity: 1 }, OVERNIGHT, 1.1, 'inOut');
  tl.to(els.festoonGlow, { glow: 0 }, OVERNIGHT, 0.6, 'none');
  // Not so high on desktop that it comes up behind the words.
  tl.to(els.sun, { y: spot ? 240 : 90 }, OVERNIGHT + 0.3, 1.1, 'out');
  tl.to(els.dim, { opacity: 0.12 }, OVERNIGHT, 1.1, 'none');
  [...CAST, 'easelQr'].forEach((id) => tl.to(els[`fig:${id}`], { opacity: 0 }, OVERNIGHT + 0.1, 0.5, 'none'));
  // A phone's screen would cover them, so only where there's room beside it.
  if (!m) {
    tl.set(els['fig:morning'], { y: standing('morning').y }, s7.blank);
    tl.to(els['fig:morning'], { opacity: 1 }, OVERNIGHT + 0.6, 0.5, 'none');
  }
  if (spot) {
    // In on the two of them, as close as it can get with the villa's chimneys still below the words.
    const couple = figure('morning');
    const copyEnds = (els['ch:s7'].offsetTop + els['ch:s7'].offsetHeight + 14) / L.h;
    const coupleVh = Math.max(1500, Math.min(home.vh, (WORLD.h - ROOF_TOP) / (1 - copyEnds)));
    tl.to(cam, framed(L, couple.x, couple.y - couple.h / 2, coupleVh, 0.3), OVERNIGHT + 0.5, 1.3, 'inOut');
  }
  tl.to(els.evScroll, { y: GRID_MAX }, OVERNIGHT + 0.6, 0.8, 'inOut');
  const REVEALED = 6;
  const revealAt = (i: number) => OVERNIGHT + 1.4 + Math.min(i, REVEALED - 1) * 0.2;
  locks.forEach((el, i) => {
    tl.to(lockIns[i], { opacity: 0, scale: 0.8 }, revealAt(i), 0.14, 'in');
    tl.to(el, { opacity: 0 }, revealAt(i) + 0.08, 0.35, 'none');
  });
  const S8 = revealAt(REVEALED - 1);
  const phoneForGrid = anchor;

  // The photos out of the guests' flashes, and, when it's on, the swirl.
  const settleStart = S8 + 6;
  const settleEnd = S8 + 8.6;
  const cellRect = (i: number) => {
    const r = inPhone(cells[i], els.screen);
    return {
      x: phoneForGrid.x + (r.x + r.w / 2) * phoneForGrid.scale,
      y: phoneForGrid.y + (r.y + r.h / 2) * phoneForGrid.scale,
      s: (r.w * phoneForGrid.scale) / 220,
    };
  };
  // Short screens get smaller photos, so they don't bury the copy.
  const printFit = Math.min(1, L.h / 760);
  const prints = [...group('print-front'), ...group('print-back')];
  const frontCount = group('print-front').length;
  const total = prints.length;
  const R0 = Math.hypot(L.w, L.h) * 0.42;
  const cxS = L.w / 2;
  const cyS = L.h / 2;

  prints.forEach((el, i) => {
    const isFront = i < frontCount;
    const printW = 110;
    const printH = 146;
    const a0 = (i / total) * Math.PI * 2 * 3.2 + 0.4;
    const spin = (i % 2 ? 1 : -1) * (0.5 + (i % 5) * 0.08);
    const depth = isFront ? 1.25 - (i % 3) * 0.12 : 0.62 + (i % 5) * 0.09;
    const enter = S8 + 0.5 + (i / total) * 2.4;
    const fromAngle = a0 + 0.9;
    const startPose = { x: cxS + Math.cos(fromAngle) * R0 * 1.5, y: cyS + Math.sin(fromAngle) * R0 * 1.5 };
    const rot0 = ((i * 47) % 50) - 25;
    const backIndex = i - frontCount;
    const record = backIndex >= 0 && backIndex < records.length ? records[backIndex] : null;
    const grid = isFront ? cellRect(i) : null;

    tl.drive(el, (t): Pose | null => {
      // S4: out of a guest's flash, up above the moment it caught, and there until the scene goes.
      if (record && t >= record.t && t < s5.blank) {
        const p = outCubic(seg(t, record.t, record.t + 0.45));
        return {
          x: lerp(record.x, record.to.x, p) - printW,
          y: lerp(record.y, record.to.y, p) - printH,
          scale: lerp(0.12, record.s, p),
          rot: record.rot * p,
          opacity: seg(t, record.t, record.t + 0.06) * (1 - seg(t, s5.at, s5.blank)),
        };
      }
      // Parked: arrive, swirl, settle into the grid.
      if (SWIRL && t >= enter && t < settleEnd + 0.6) {
        const swirl = a0 + spin * (t - S8) * 0.62;
        const radius = lerp(R0 * (isFront ? 0.72 : 0.92), R0 * (m ? 0.62 : 0.66), smooth(seg(t, S8 + 1.5, settleStart)));
        const ring = {
          x: cxS + Math.cos(swirl) * radius * (m ? 0.72 : 1.18),
          y: cyS + Math.sin(swirl) * radius * (m ? 1.18 : 0.74),
        };
        const pIn = outCubic(seg(t, enter, enter + 1.6));
        const pSettle = smooth(seg(t, settleStart + (i / total) * 0.8, settleEnd - (1 - i / total) * 0.45));
        const target = grid
          ? { x: grid.x, y: grid.y, s: grid.s }
          : { x: cxS + (i % 2 ? 40 : -40) * (m ? 0.5 : 1), y: cyS + ((i % 4) - 2) * 26, s: 0.16 };
        const x = lerp(lerp(startPose.x, ring.x, pIn), target.x, pSettle);
        const y = lerp(lerp(startPose.y, ring.y, pIn), target.y, pSettle);
        const s0 = (m ? 0.62 : printFit) * depth;
        const opacityEnd = grid ? 1 - seg(t, settleEnd - 0.05, settleEnd + 0.25) : 1 - seg(t, settleEnd - 0.7, settleEnd - 0.35);
        return {
          x: x - printW,
          y: y - printH,
          scale: lerp(s0, target.s, pSettle),
          rot: (rot0 + Math.sin(swirl * 1.3) * 14) * (1 - pSettle),
          opacity: opacityEnd,
        };
      }
      return null;
    });
  });

  // As the swirl's photos land, the phone's edge starts cropping them.
  if (SWIRL) {
    const px = phoneForGrid;
    const clip = `inset(${px.y}px ${L.w - px.x - PHONE.w * px.scale}px ${L.h - px.y - PHONE.h * px.scale}px ${px.x}px round ${55 * px.scale}px)`;
    let clipped = false;
    tl.onRender((t) => {
      const next = t >= settleEnd - 0.55 && t < settleEnd + 1;
      if (next !== clipped) {
        clipped = next;
        els.printsFront.style.clipPath = next ? clip : '';
      }
    });
  }

  // While the camera's in on someone, the venue behind them goes soft, like a lens with them in
  // focus. Wide screens only: on a phone the mock covers most of it, and the blur costs too much.
  if (spot) {
    const inFocus: [number, number][] = [[s2.zoom, s3.at], [s3.light, s4.at], [s5.light, s6.at], [s6.light, s7.at], [OVERNIGHT + 0.5, Infinity]];
    let focused = false;
    tl.onRender((t) => {
      const next = inFocus.some(([a, b]) => t >= a && t < b);
      if (next === focused) return;
      focused = next;
      els.stage.classList.toggle('in-focus', next);
    });
  }

  // The album's the last thing in the story: from here the page just scrolls on to the FAQs.
  const T = revealAt(REVEALED - 1) + 1.6;

  const stills = {
    s1: 0,
    s2: CARD + 0.65,
    s3: seatedAt - 0.2,
    s4: s5.at - 0.3,
    s5: FIRE + 0.8,
    s6: SPEAK + 1.8,
    s7: shotsFrom + 1,
    s8: T - 0.3,
  };

  return { tl, T, labels, cam, figureLights, night, heroCam: home, stills };
}
