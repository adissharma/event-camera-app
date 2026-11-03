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
  m: boolean;
}

export interface Light {
  x: number;
  y: number;
  r: number;
}

export type Els = Record<string, HTMLElement>;

export interface Story {
  tl: Timeline;
  T: number;
  labels: Record<string, number>;
  cam: { cx: number; cy: number; vh: number };
  lights: Light[];
  /** How dark it is: 0 is the sunset, 1 is full night. */
  night: { v: number };
  /** The camera's opening position, which the clouds drift relative to. */
  home: number;
  /** When the use case tabs are on screen. */
  ucFrom: number;
  ucTo: number;
  /** The moment each scene's still is captured at, for the linear page. */
  stills: Record<string, number>;
}

const PHONE = { w: 392, h: 850 };
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
  const vh = Math.min(L.m ? 1650 : 1860, (WORLD.w * L.h) / L.w);
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

function phonePose(L: Layout, where: 'anchor' | 'center' | 'rest') {
  if (L.m) {
    const s = Math.min((L.w * 0.72) / PHONE.w, (L.vis * 0.62) / PHONE.h);
    if (where === 'rest') {
      const r = s * 0.8;
      return { x: (L.w - PHONE.w * r) / 2, y: L.vis - PHONE.h * r * 0.62, scale: r };
    }
    return { x: (L.w - PHONE.w * s) / 2, y: L.vis - PHONE.h * s - 14, scale: s };
  }
  const s = Math.min((L.h * 0.86) / PHONE.h, 1);
  if (where === 'center') return { x: (L.w - PHONE.w * s) / 2, y: (L.h - PHONE.h * s) / 2, scale: s };
  if (where === 'rest') {
    const r = s * 0.74;
    return { x: L.w * 0.76 - (PHONE.w * r) / 2, y: L.h - PHONE.h * r * 0.72, scale: r };
  }
  return { x: L.w * 0.76 - (PHONE.w * s) / 2, y: (L.h - PHONE.h * s) / 2 + 6, scale: s };
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

export function buildStory(els: Els, group: (name: string) => HTMLElement[], L: Layout): Story {
  const tl = new Timeline();
  const m = L.m;
  /**
   * Desktop's room is wide and busy, so each scene pushes in on its subject and lets
   * everything else fall into shadow. Phones are close already, and a landscape phone
   * has no space for it around the copy.
   */
  const spot = !m && L.h >= 560;
  /** How far the room falls while one person has the stage. */
  const SHADOW = 0.88;
  const labels: Record<string, number> = {};
  const home = wide(L, m ? HOME_M : undefined);
  const cam = { ...home };
  const night = { v: 0 };
  const lights: Light[] = [];

  const addLight = (x: number, y: number) => {
    const light: Light = { x, y, r: 0 };
    lights.push(light);
    return light;
  };

  const camTo = (s: { cx: number; cy: number; vh: number }, at: number, dur: number) => tl.to(cam, s, at, dur, 'inOut');
  const ch = (name: string, at: number, dur = 0.5, y = 26) =>
    tl.fromTo(els[name], { alpha: 0, y }, { alpha: 1, y: 0 }, at, dur, 'out');
  const chOut = (name: string, at: number, dur = 0.35) => tl.to(els[name], { alpha: 0, y: -22 }, at, dur, 'in');
  const on = (el: HTMLElement | undefined, at: number, dur = 0.3) => tl.to(el, { opacity: 1 }, at, dur, 'out');
  const off = (el: HTMLElement | undefined, at: number, dur = 0.3) => tl.to(el, { opacity: 0 }, at, dur, 'in');
  /** A small note in the room. */
  const noteAt = (name: string, x: number, y: number, at: number) => {
    tl.start(els[name], { x, y: y + 18, opacity: 0 });
    tl.to(els[name], { opacity: 1, y }, at, 0.45, 'out');
  };
  const hidden = (...list: (HTMLElement | undefined)[]) => list.forEach((el) => tl.start(el, { opacity: 0 }));
  const screen = (name: string) => els[`screen:${name}`];
  const tap = (x: number, y: number, at: number) => {
    tl.set(els.tap, { x, y }, at - 0.01);
    tl.to(els.tap, { opacity: 1, scale: 1 }, at, 0.1, 'out');
    tl.to(els.tap, { scale: 0.74 }, at + 0.1, 0.12, 'out');
    tl.to(els.tap, { opacity: 0 }, at + 0.28, 0.14, 'in');
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
  /** Up from below the frame, and back down: how anyone arrives and leaves. */
  const OFFSTAGE = 1200;
  const rise = (id: string, at: number, dur = 0.8) => {
    tl.set(els[`fig:${id}`], { opacity: 1 }, at);
    tl.to(els[`fig:${id}`], { y: standing(id).y }, at, dur, 'out3');
  };
  const drop = (id: string, at: number, dur = 0.55) => {
    tl.to(els[`fig:${id}`], { y: standing(id).y + OFFSTAGE }, at, dur, 'in');
  };
  /** A two-layer screen change: on at `at`. */
  const showScreen = (name: string, at: number, dur = 0.25) => {
    tl.set(screen(name), { opacity: 0 }, at - 0.01);
    tl.to(screen(name), { opacity: 1 }, at, dur, 'out');
  };

  /**
   * The real counter's number, as the app sets it: it doesn't slide, it just changes.
   * On opening, the camera rolls it up from zero, one number at a time.
   */
  const counts: [number, number][] = [];
  const setCount = (value: number, at: number) => counts.push([at, value]);
  const rollCount = (to: number, at: number, dur: number) => {
    for (let n = 0; n <= to; n++) setCount(n, at + (n / to) * dur);
  };
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
  for (const id of LATE.filter((name) => name !== 'ayla')) {
    tl.start(els[`fig:${id}`], { y: standing(id).y + OFFSTAGE, opacity: 0, rot: 0 });
  }
  for (const n of ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']) tl.start(els[`ch:${n}`], { alpha: 0, y: 26 });
  tl.start(els['ch:s1'], { alpha: 1 });
  tl.start(els.phone, { ...phonePose(L, 'anchor'), y: L.h + 60, opacity: 0 });
  tl.start(els.sun, { x: 0, y: 0 });
  tl.start(els.festoonGlow, { glow: 0 });
  tl.start(els.dim, { opacity: 0 });
  tl.start(els.dawn, { opacity: 0 });
  tl.start(els.copyShade, { opacity: 0 });

  // ---- S1. You'll miss most of your own party: the first scroll leaves at once
  labels.s1 = 0;
  // The nudge has the bottom of the screen to itself, until the chapters take over.
  tl.to(els.hint, { opacity: 0 }, 0.02, 0.2, 'none');
  tl.start(els.chapters, { alpha: 0 });
  tl.to(els.chapters, { alpha: 1 }, 0.25, 0.25, 'none');
  tl.to(els['ch:s1'], { alpha: 0 }, 0.03, 0.2, 'none');

  // ---- S2. Scan: the very first scroll is the product
  labels.s2 = 0.3;
  const entrance = closer(L, m ? PLACES.entrance.x + 120 : PLACES.entrance.x);
  camTo(entrance, 0.03, 1.1);
  const anchor = phonePose(L, 'anchor');
  // On a phone it sits between the copy and the phone's top edge, tucked just behind it.
  // The phone stays a little low to make the room, cropping only its bottom.
  const scanPhoneY = m ? anchor.y + L.vis * 0.08 : anchor.y;
  const copyBottom = 240;
  const invRoomM = Math.max(0, scanPhoneY + 30 - copyBottom);
  const invPose = m
    ? { x: L.w * 0.5 - 143, y: copyBottom + invRoomM / 2 - 198, scale: Math.max(0.2, Math.min(0.44, invRoomM / 396)), rot: -4 }
    : { x: L.w * 0.42 - 143, y: L.h * 0.63 - 198, scale: Math.min(1.08, (L.h * 0.52) / 396), rot: -4 };
  const tableOnScreen = toScreen(L, entrance, PLACES.welcomeTable.x, PLACES.welcomeTable.y);
  tl.start(els.invRoom, { x: tableOnScreen.x - 143, y: tableOnScreen.y - 198, scale: 0.12, rot: -18, opacity: 0 });
  tl.to(els.invRoom, { opacity: 1 }, 0.08, 0.15, 'none');
  tl.to(els.invRoom, invPose, 0.08, 0.9, 'out3');
  ch('ch:s2', 0.32);

  // The phone comes up on its camera, and lands on the invitation.
  tl.set(screen('ios'), { opacity: 1 }, 0.05);
  tl.set(els.phone, { opacity: 1 }, 0.1);
  tl.to(els.phone, { ...anchor, y: scanPhoneY }, 0.1, 0.95, 'out3');
  // Held up beside the phone, then the card moves behind it, and the viewfinder picks it up
  // as it goes: the same card in the same place, at the same size, as if seen through the phone.
  const SLIDE = 1.25;
  const behind = { x: anchor.x + VF_CARD.x * anchor.scale - 143, y: scanPhoneY + VF_CARD.y * anchor.scale - 198, scale: anchor.scale, rot: -3 };
  const inFinder = (pose: { x: number; y: number; scale: number; rot: number }) => ({
    x: (pose.x + 143 - anchor.x) / anchor.scale - VF_CARD.x,
    y: (pose.y + 198 - scanPhoneY) / anchor.scale - VF_CARD.y,
    scale: pose.scale / anchor.scale,
    rot: pose.rot,
  });
  tl.start(els.invVf, inFinder(invPose));
  tl.to(els.invRoom, behind, SLIDE, 1, 'inOut');
  tl.to(els.invVf, inFinder(behind), SLIDE, 1, 'inOut');
  // Out of sight behind the phone now, and it stays there.
  tl.set(els.invRoom, { opacity: 0 }, SLIDE + 1.05);
  tl.fromTo(els.reticle, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1 }, 2.2, 0.3, 'out3');
  tl.fromTo(els.pill, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, 2.5, 0.25, 'back');
  const pillTap = inPhone(els.pill, els.screen);
  tap(pillTap.x + 66, pillTap.y + 14, 3);
  // The room falls away, and the invitation and the phone have the stage.
  if (spot) tl.to(night, { v: 0.74 }, 0.2, 0.8, 'inOut');

  // iOS raises the App Clip card over the camera: no store, no install.
  tl.to(els.clipDim, { opacity: 1 }, 3.2, 0.3, 'none');
  tl.start(els.clipCard, { y: 560, opacity: 0 });
  tl.set(els.clipCard, { opacity: 1 }, 3.2);
  tl.to(els.clipCard, { y: 0 }, 3.2, 0.5, 'out3');
  // On a phone it's been sitting low to make room for the invitation.
  if (m) tl.to(els.phone, { y: anchor.y }, 3.2, 0.5, 'inOut');
  const clipOpen = inPhone(els.clipOpen, els.screen);
  tap(clipOpen.x + clipOpen.w / 2, clipOpen.y + clipOpen.h / 2, 4.25);
  tl.set(els.clipOpenText, { opacity: 0 }, 4.4);
  tl.set(els.clipSpin, { opacity: 1 }, 4.4);
  showScreen('join', 4.75, 0.3);

  // ---- S3. Retire the easel
  const S3 = 6.5;
  labels.s3 = S3;
  const t7 = PLACES.table7;
  const tablesShot = spot ? framed(L, t7.x, t7.y, 1150, 0.37) : closer(L, t7.x + (m ? 60 : 0));
  // The easel first, in the only light in the room. A phone gets out of the way to show it.
  rise('easel', S3 - 0.2, 0.9);
  const easelDef = figure('easel');
  const seatPool = addLight(easelDef.x + 40, easelDef.y - easelDef.h * 0.36);
  if (m || spot) camTo(tablesShot, S3 - 0.4, 1.1);
  if (m) tl.to(els.phone, { y: L.vis * 0.8 }, S3 - 0.4, 0.7, 'inOut');
  if (spot) {
    tl.to(night, { v: SHADOW }, S3 - 0.2, 0.7, 'none');
    tl.to(seatPool, { r: 430 }, S3 + 0.1, 0.6, 'out3');
    // Pushed in, there's no empty sky behind the words, so they bring their own shade.
    tl.to(els.copyShade, { opacity: 1 }, S3 - 0.1, 0.6, 'none');
  }
  chOut('ch:s2', S3 + 0.1);
  ch('ch:s3', S3 + 0.4);

  // As soon as the headline's up, it's thrown away: up, over and out of the frame.
  const THROW = S3 + 1;
  const easelAt = standing('easel');
  tl.to(els['fig:easel'], { x: easelAt.x - 1500 }, THROW, 1.05, 'in');
  tl.to(els['fig:easel'], { rot: -135 }, THROW, 1.05, 'in');
  tl.to(els['fig:easel'], { y: easelAt.y - 150 }, THROW, 0.45, 'out');
  tl.to(els['fig:easel'], { y: easelAt.y + OFFSTAGE }, THROW + 0.45, 0.6, 'in');
  // Which leaves the light free for the table she's about to find.
  if (spot) tl.to(seatPool, { x: t7.x - 40, y: 1120, r: 520 }, THROW + 0.5, 1, 'inOut');

  // Only now does the phone get on with finding her seat.
  const SEEK = S3 + 1.4;
  if (m) tl.to(els.phone, { y: anchor.y }, SEEK - 0.2, 0.5, 'inOut');
  const fieldPos = inPhone(els.joinField, els.screen);
  tap(fieldPos.x + 150, fieldPos.y + 30, SEEK + 0.3);
  tl.start(screen('table'), { y: PHONE.h, opacity: 0 });
  tl.set(screen('table'), { opacity: 1 }, SEEK + 0.5);
  tl.to(screen('table'), { y: 0 }, SEEK + 0.5, 0.55, 'out3');
  hidden(els.type1, els.type2, els.type3, els.typeRows);
  tl.set(els.typePh, { opacity: 0 }, SEEK + 1.5);
  tl.set(els.type1, { opacity: 1 }, SEEK + 1.5);
  tl.set(els.type1, { opacity: 0 }, SEEK + 1.85);
  tl.set(els.type2, { opacity: 1 }, SEEK + 1.85);
  tl.set(els.type2, { opacity: 0 }, SEEK + 2.2);
  tl.set(els.type3, { opacity: 1 }, SEEK + 2.2);
  tl.set(els.typeHelp, { opacity: 0 }, SEEK + 1.85);
  tl.fromTo(els.typeRows, { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, SEEK + 2.4, 0.25, 'out');
  tap(150, 40 + 158 + 28, SEEK + 3.1);
  tl.to(els.tableSearch, { opacity: 0 }, SEEK + 3.35, 0.15, 'none');
  hidden(els.seatView);
  tl.fromTo(els.seatView, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, SEEK + 3.4, 0.3, 'out');

  // As soon as her seat's up, a line leaves the words "Table 7", leaves the phone, and finds
  // the table. On a phone there's no room beside it, so it slides down to reveal the table.
  const SEEN = SEEK + 3.4;
  const seatPhoneY = m ? L.vis * 0.8 : anchor.y;
  if (m) tl.to(els.phone, { y: seatPhoneY }, SEEN + 0.05, 0.9, 'inOut');
  const LINE = m ? SEEN + 1 : SEEN + 0.3;
  const seatWord = inPhone(els.seatWord, els.screen);
  const from = { x: anchor.x + (seatWord.x + seatWord.w / 2 - (m ? 0 : 74)) * anchor.scale, y: seatPhoneY + (seatWord.y + seatWord.h / 2) * anchor.scale };
  // The line stops at the edge of the sign, so it never covers the number.
  const sign = toScreen(L, tablesShot, t7.x, t7.y);
  const dest = m ? { x: sign.x, y: sign.y + 40 * sign.z } : { x: sign.x + 52 * sign.z, y: sign.y };
  const mid = m
    ? `C ${from.x + 90} ${from.y - 90}, ${dest.x + 90} ${dest.y + 110}, ${dest.x} ${dest.y}`
    : `C ${from.x - 200} ${from.y + 20}, ${dest.x + 260} ${dest.y - 230}, ${dest.x} ${dest.y}`;
  els.goldPath.setAttribute('d', `M ${from.x} ${from.y} ${mid}`);
  els.goldDot.setAttribute('cx', String(dest.x));
  els.goldDot.setAttribute('cy', String(dest.y));
  // Hidden until it sets off: even with no length, its rounded end would draw as a dot.
  tl.start(els.goldPath, { dash: 1, opacity: 0 });
  tl.set(els.goldPath, { opacity: 1 }, LINE);
  tl.to(els.goldPath, { dash: 0 }, LINE, 1, 'inOut');
  // Then it lets go of the phone, which is free to move on while she walks.
  tl.to(els.goldPath, { dash: -1 }, LINE + 1.15, 0.6, 'inOut');
  tl.set(els.goldPath, { opacity: 0 }, LINE + 1.8);
  tl.start(els.goldDot, { opacity: 0 });
  tl.set(els.goldDot, { opacity: 1 }, LINE + 0.95);
  tl.start(els.tent7, { opacity: 0 });
  on(els.tent7, LINE + 0.95, 0.12);
  flashAt(els['flash:1'], t7.x, t7.y, LINE + 1);
  if (spot) noteAt('note:table7', t7.x - 500, 825, LINE + 1.5);
  else noteAt('note:table7', t7.x - (m ? 225 : 420), m ? 570 : 640, LINE + 1.5);

  // Ayla walks the line and takes her place.
  const ayla = figure('ayla');
  const aylaSize = figureSize(ayla);
  const place = (p: { x: number; y: number }) => ({ x: p.x - aylaSize.w / 2, y: p.y - aylaSize.h });
  const WALK = LINE + 1.4;
  tl.start(els['fig:ayla'], { ...place(PLACES.aylaStart), opacity: 0 });
  const frames = group('frame:ayla');
  hidden(frames[1], frames[2], frames[3]);
  tl.set(frames[0], { opacity: 0 }, WALK);
  tl.set(els['fig:ayla'], { opacity: 1 }, WALK);
  tl.to(els['fig:ayla'], place(PLACES.aylaSeat), WALK, 1.9, 'none');
  const walkEnd = WALK + 1.9;
  if (spot) tl.to(seatPool, { x: PLACES.aylaSeat.x - 70, y: 1110, r: 500 }, WALK, 1.9, 'inOut');
  for (let t = WALK, flip = 0; t < walkEnd; t += 0.26, flip++) {
    tl.set(frames[1], { opacity: flip % 2 === 0 ? 1 : 0 }, t);
    tl.set(frames[2], { opacity: flip % 2 === 0 ? 0 : 1 }, t);
  }
  tl.set(frames[1], { opacity: 0 }, walkEnd);
  tl.set(frames[2], { opacity: 0 }, walkEnd);
  tl.set(frames[3], { opacity: 1 }, walkEnd);
  tl.to(els.goldDot, { opacity: 0 }, walkEnd - 0.4, 0.4, 'none');
  off(els['note:table7'], walkEnd + 0.1);
  off(els.tent7, walkEnd + 0.1);

  // The floor plan: a swipe left brings it in, two fingers pinch in, and a swipe right goes
  // back. All while she walks, except on a phone, which is out of the way until she's there.
  if (m) tl.to(els.phone, { y: anchor.y }, walkEnd + 0.1, 0.5, 'inOut');
  const PLAN = m ? walkEnd + 0.7 : LINE + 1.8;
  const toggle = inPhone(els.seatToggle, els.screen);
  const planBox = inPhone(els.seatPlan, els.screen);
  const PAGE = planBox.w + 16;
  const swipeY = planBox.y + planBox.h * 0.42;
  const swipe = (at: number, fromX: number, toX: number) => {
    tl.set(els.tap, { x: planBox.x + planBox.w * fromX, y: swipeY }, at - 0.01);
    tl.to(els.tap, { opacity: 1, scale: 0.8 }, at, 0.08, 'out');
    tl.to(els.tap, { x: planBox.x + planBox.w * toX }, at + 0.08, 0.55, 'inOut');
    tl.to(els.tap, { opacity: 0 }, at + 0.63, 0.12, 'in');
  };
  // The two pages move with the finger, and the toggle above follows them.
  tl.start(els.seatPlan, { x: PAGE, opacity: 0 });
  tl.set(els.seatPlan, { opacity: 1 }, PLAN);
  swipe(PLAN, 0.84, 0.16);
  tl.to(els.seatCard, { x: -PAGE }, PLAN + 0.08, 0.55, 'inOut');
  tl.to(els.seatPlan, { x: 0 }, PLAN + 0.08, 0.55, 'inOut');
  tl.to(els.seatToggleOn, { x: toggle.w / 2 - 4 }, PLAN + 0.08, 0.55, 'inOut');
  // Two fingers spreading, and the plan following them in towards the bottom left.
  const pinch = { x: planBox.x + planBox.w * 0.42, y: planBox.y + planBox.h * 0.6 };
  [els.tap, els.tap2].forEach((dot, i) => {
    const way = i ? 1 : -1;
    tl.set(dot, { x: pinch.x + way * 20, y: pinch.y + way * 20 }, PLAN + 0.85);
    tl.to(dot, { opacity: 1, scale: 0.8 }, PLAN + 0.87, 0.08, 'out');
    tl.to(dot, { x: pinch.x + way * 92, y: pinch.y + way * 92 }, PLAN + 0.95, 0.8, 'inOut');
    tl.to(dot, { opacity: 0 }, PLAN + 1.75, 0.12, 'in');
  });
  tl.start(els.planZoom, { x: 0, y: 0, scale: 1 });
  // Scale 2.5, with table 7 (bottom left of the plan) landing in the middle.
  tl.to(els.planZoom, { x: -planBox.w * 0.08, y: -planBox.h * 1.3, scale: 2.5 }, PLAN + 0.95, 0.8, 'inOut');
  const BACK = PLAN + 2.1;
  swipe(BACK, 0.16, 0.84);
  tl.to(els.seatCard, { x: 0 }, BACK + 0.08, 0.55, 'inOut');
  tl.to(els.seatPlan, { x: PAGE }, BACK + 0.08, 0.55, 'inOut');
  tl.to(els.seatToggleOn, { x: 0 }, BACK + 0.08, 0.55, 'inOut');

  // ---- S4. 120 photographers: she's at her table, that's the job done. The phone slides
  // off, the camera slides across to the whole party, and the sun goes down on the way.
  const NEXT = Math.max(walkEnd + 0.7, BACK + 1);
  labels.s4 = NEXT + 1;
  chOut('ch:s3', NEXT);
  tl.to(els.phone, { x: L.w + 80 }, NEXT, 0.7, 'in');
  tl.set(els.phone, { opacity: 0 }, NEXT + 0.75);
  const aylaLens = { x: PLACES.aylaSeat.x - aylaSize.w / 2 + aylaSize.w * 0.62, y: PLACES.aylaSeat.y - aylaSize.h * 0.9 };
  const roomWide = m ? wide(L, PLACES.aylaSeat.x) : wide(L);
  camTo(roomWide, NEXT + 0.1, 1.2);
  const dusk = NEXT + 0.2;
  tl.to(night, { v: 1 }, dusk, 1.9, 'inOut');
  if (spot) tl.to(seatPool, { r: 0 }, dusk, 1.1, 'in');
  tl.to(els.sun, { y: SUN_DOWN }, dusk, 1.9, 'in');
  tl.to(els.festoonGlow, { glow: 1 }, dusk + 0.9, 0.9, 'none');
  ch('ch:s4', NEXT + 1.3);

  // Each flash lights a patch of the party, and a photo appears above it.
  const SHOTS = [
    { who: 'uncle', moment: 'girlDog' },
    { who: 'auntie', moment: 'hug' },
    { who: 'ayla', moment: 'singalong', lensAt: aylaLens },
    { who: 'overhead', moment: 'dad' },
    { who: 'overhead', moment: 'cake' },
  ];
  type FlashRecord = { t: number; x: number; y: number; to: { x: number; y: number }; s: number; rot: number };
  const records: FlashRecord[] = [];
  let at = NEXT + 2.6;
  // Along the terrace, one moment at a time.
  const panning = m || spot;
  const gaps = panning ? [1.15, 1.15, 1.15, 1.15, 1.15] : [0.95, 0.85, 0.75, 0.65, 0.6];
  let lastPool: Light | undefined;
  SHOTS.forEach((s, i) => {
    const moment = figure(s.moment);
    const camHere = m ? shot(L, moment.x, 780, 1500) : spot ? framed(L, moment.x, moment.y - moment.h / 2, 1240, 0.62) : roomWide;
    if (panning) camTo(camHere, at - 0.6, 0.5);
    const l = s.lensAt ?? lens(s.who);
    flashAt(els[`flash:${i + 2}`], l.x, l.y, at);
    const pool = addLight(moment.x, moment.y - moment.h * 0.4);
    tl.to(pool, { r: m ? 400 : 430 }, at, 0.45, 'out3');
    // The last moment settles back into the dark as the next one's lit.
    if (spot && lastPool) tl.to(lastPool, { r: 300 }, at, 0.4, 'none');
    lastPool = pool;
    const face = toScreen(L, camHere, moment.x, moment.y - moment.h);
    const source = toScreen(L, camHere, moment.x, moment.y - moment.h * 0.5);
    const printScale = (m ? 0.62 : Math.min(0.66, L.w / 2000)) * Math.min(1, L.h / 760);
    records.push({
      t: at,
      x: source.x,
      y: source.y,
      to: { x: Math.max(70, Math.min(L.w - 70, face.x + (i % 2 ? 30 : -30))), y: Math.max(m ? 340 : 170, face.y - (m ? 100 : 70) - (i % 3) * 30) },
      s: printScale,
      rot: [-8, 6, -4, 9, -6][i],
    });
    at += gaps[i];
  });
  // Back out to see the whole party lit up, which is also where the phone comes back from.
  if (spot) camTo(roomWide, at - 0.35, 0.9);

  // ---- S5. Set a dare: the phone comes back up, onto the event page.
  const S5 = at + 1;
  labels.s5 = S5 + 0.5;
  chOut('ch:s4', S5);
  // Low on a phone at first, so the guests get seen before the screen covers them.
  const lowY = m ? L.vis * 0.84 : anchor.y;
  // The fresh camera waits underneath the event page, until the disposable scene needs it.
  tl.set(screen('camera'), { opacity: 1 }, S5);
  showScreen('dare', S5, 0.02);
  tl.set(els.phone, { ...anchor, y: L.h + 80 }, S5);
  tl.set(els.phone, { opacity: 1 }, S5 + 0.05);
  tl.to(els.phone, { y: lowY }, S5 + 0.05, 1, 'out3');
  ch('ch:s5', S5 + 1);
  const crew = figure('dareCrew');
  if (m) camTo(closer(L, crew.x), S5 + 0.2, 0.9);
  if (spot) camTo(framed(L, crew.x, crew.y - 300, 1140, 0.27), S5 + 0.6, 1.1);
  rise('dareCrew', S5 + 0.7, 0.9);
  const crewPool = addLight(crew.x, crew.y - crew.h * 0.45);
  tl.to(crewPool, { r: m ? 560 : 600 }, S5 + 1, 0.5, 'out3');
  if (m) tl.to(els.phone, { y: anchor.y }, S5 + 2.1, 0.6, 'inOut');

  const tiles = group('dareTile');
  const slides = group('dareSlide');
  const camTitles = group('dareCamTitle');
  const shots = group('dareShot');
  const bars = group('dareBar');
  const darePrints = group('darePrint');
  const dareCta = group('dareCta')[0];
  hidden(els.dareViewer, els.dareCam, els.dareFlash, ...slides, ...camTitles, ...shots, ...bars);
  const tile = inPhone(tiles[0], els.screen);
  tap(tile.x + tile.w / 2, tile.y + 30, S5 + 2.7);
  tl.to(els.dareViewer, { opacity: 1 }, S5 + 2.95, 0.2, 'none');
  const cta = inPhone(dareCta, els.screen);
  const printSize = m ? Math.min(L.w * 0.5, L.h * 0.26) : Math.min(L.w * 0.15, L.h * 0.3);
  [0, 1, 2].forEach((i) => {
    const t = S5 + 2.95 + i * 2;
    tl.set(slides[i], { opacity: 1 }, t);
    tl.set(bars[i], { opacity: 1 }, t);
    tap(cta.x + cta.w / 2, cta.y + cta.h / 2, t + 0.7);
    tl.set(els.dareCam, { opacity: 1 }, t + 0.95);
    tl.set(camTitles[i], { opacity: 1 }, t + 0.95);
    tl.set(shots[i], { opacity: 1 }, t + 0.95);
    const fire = t + 1.4;
    tl.to(els.dareShutter, { scale: 0.82 }, fire - 0.1, 0.1, 'out');
    tl.to(els.dareShutter, { scale: 1 }, fire + 0.1, 0.2, 'out');
    tl.to(els.dareFlash, { opacity: 1 }, fire, 0.05, 'none');
    tl.to(els.dareFlash, { opacity: 0 }, fire + 0.1, 0.4, 'out');
    flashAt(els[`flash:${i + 7}`], crew.x - 140 + i * 140, crew.y - crew.h * 0.75, fire);
    // Out of the phone, and pinned up beside it with the dare it answered.
    const pose = m
      ? { x: (L.w - printSize) / 2 + (i - 1) * 12, y: L.h * 0.3, rot: [-3, 2, -2][i] }
      : spot
        // Stacked beside the phone, clear of the crew and of the copy.
        ? { x: L.w * 0.47 + i * 12, y: L.h * 0.09 + i * 16, rot: [-5, 3, -2][i] }
        : { x: L.w * (0.09 + i * 0.135), y: L.h * (0.42 + (i % 2) * 0.05), rot: [-5, 3, -2][i] };
    tl.start(darePrints[i], { x: anchor.x + 60, y: anchor.y + 300, scale: 0.3, rot: 0, opacity: 0 });
    tl.to(darePrints[i], { opacity: 1 }, fire + 0.02, 0.1, 'none');
    tl.to(darePrints[i], { ...pose, scale: printSize / 300 }, fire + 0.02, 0.55, 'out3');
    if (i < 2) {
      tl.set(els.dareCam, { opacity: 0 }, fire + 0.55);
      tl.set(camTitles[i], { opacity: 0 }, fire + 0.55);
      tl.set(shots[i], { opacity: 0 }, fire + 0.55);
      tl.set(slides[i], { opacity: 0 }, fire + 0.55);
      if (m) tl.to(darePrints[i], { opacity: 0 }, fire + 0.4, 0.15, 'none');
    }
  });

  // ---- S6. A photo can't keep your grandad's voice: straight from the dare to the guestbook.
  const S6 = S5 + 8.9;
  labels.s6 = S6 + 0.3;
  chOut('ch:s5', S6);
  darePrints.forEach((el) => tl.to(el, { opacity: 0 }, S6, 0.3, 'none'));
  drop('dareCrew', S6 + 0.1);
  tl.to(crewPool, { r: 0 }, S6 + 0.3, 0.3, 'in');
  ch('ch:s6', S6 + 0.7);
  const grandad = figure('grandad');
  if (m) {
    camTo(closer(L, grandad.x), S6 + 0.2, 0.7);
    tl.to(els.phone, { y: lowY }, S6 + 0.1, 0.5, 'inOut');
    tl.to(els.phone, { y: anchor.y }, S6 + 1.9, 0.6, 'inOut');
  }
  if (spot) camTo(framed(L, grandad.x, grandad.y - 340, 1280, 0.28), S6 + 0.2, 0.9);
  rise('grandad', S6 + 0.5, 0.9);
  const grandadPool = addLight(grandad.x, grandad.y - grandad.h * 0.5);
  tl.to(grandadPool, { r: m ? 600 : 640 }, S6 + 0.7, 0.5, 'out3');
  showScreen('guestbook', S6 + 0.3, 0.3);
  tl.to(els.gbStrip, { x: -560 }, S6 + 0.5, 4, 'none');
  // The recording's own timer: down a second at a time, as the app's does.
  let gbShown = -1;
  tl.onRender((t) => {
    const left = 60 - Math.floor(seg(t, S6 + 0.5, S6 + 4.5) * 8);
    if (left === gbShown) return;
    gbShown = left;
    els.gbTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  });

  const shutter = els.shutter;
  hidden(els.thumb1, els.thumb2, els.thumb3, els.vfMono, els.camFade, els.camFlash, els.white, els.vf3);

  if (spot) tl.to(els.copyShade, { opacity: 0 }, S6 + 4.9, 0.6, 'none');

  // ---- S7. Watch it live: back in the room, the phone's gallery fills up as it happens.
  const S7 = S6 + 4.9;
  labels.s7 = S7 + 0.5;
  chOut('ch:s6', S7);
  drop('grandad', S7 + 0.1);
  tl.to(grandadPool, { r: 0 }, S7 + 0.3, 0.3, 'in');
  if (m) tl.to(els.phone, { y: anchor.y }, S7, 0.5, 'inOut');
  tl.to(els.dim, { opacity: 0.55 }, S7, 0.8, 'none');
  if (m || spot) camTo(roomWide, S7 + 0.3, 0.8);
  ch('ch:s7', S7 + 0.9);
  tl.start(els['after:s7'], { alpha: 0 });
  tl.start(els['opt:1'], { alpha: 0 });
  tl.to(screen('guestbook'), { opacity: 0 }, S7 + 0.3, 0.25, 'none');
  tl.to(screen('dare'), { opacity: 0 }, S7 + 0.5, 0.05, 'none');
  showScreen('event', S7 + 0.3, 0.25);

  const cells = group('cell');
  const locks = group('cellLock');
  const lockIns = group('cellLockIn');
  cells.forEach((cell, i) => {
    tl.start(cell, { opacity: 0, scale: 0.7 });
    tl.to(cell, { opacity: 1, scale: 1 }, S7 + 1 + i * 0.2, 0.22, 'back');
  });
  // Scrolled along so the photos have the screen, with the tabs just above them.
  const GRID_SCROLL = -330;
  tl.start(els.evScroll, { y: 0 });
  tl.to(els.evScroll, { y: GRID_SCROLL }, S7 + 1.2, 1.5, 'inOut');

  // ---- Or make them wait: the same roll, one fresh camera, and only the counter to look at.
  const DIS = S7 + 4.4;
  tl.to(els['opt:0'], { alpha: 0 }, DIS, 0.2, 'none');
  tl.to(els['after:s7'], { alpha: 1 }, DIS, 0.25, 'none');
  tl.to(els['opt:1'], { alpha: 1 }, DIS + 0.15, 0.25, 'none');
  tl.to(els.dim, { opacity: 0.86 }, DIS, 0.7, 'none');
  tl.to(screen('event'), { opacity: 0 }, DIS, 0.25, 'none');
  tl.to(els.vf3, { opacity: 1 }, DIS, 0.1, 'none');
  tl.to(els.vfMono, { opacity: 1 }, DIS + 0.5, 0.8, 'none');
  tl.to(els.camFade, { opacity: 1 }, DIS + 0.5, 0.8, 'none');
  rollCount(DEMO_EVENT.shots, DIS + 0.5, 0.8);

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
  const zoomed = DIS + 0.4 + 1.5;
  tl.to(els.phone, countPose, DIS + 0.4, 1.5, 'inOut');
  tl.to(els.camCount, { scale: pillZ }, DIS + 0.4, 1.5, 'inOut');
  for (const el of [els.camHead, els.camZoom, els.camRail, els.camBar]) {
    tl.start(el, { opacity: 1 });
    tl.to(el, { opacity: 0.14 }, DIS + 0.5, 0.8, 'none');
  }

  // Down to the last shot: slowly, then faster and faster, with the flashes dying away
  // early so it never strobes.
  const roll = DEMO_EVENT.shots;
  const shotsFrom = DIS + 2.1;
  const shotsFor = 3.8;
  for (let k = 0; k < roll; k++) {
    const t = shotsFrom + shotsFor * (k / roll) ** 0.6;
    if (k < 8) {
      tl.to(shutter, { scale: 0.82 }, t - 0.08, 0.08, 'out');
      tl.to(shutter, { scale: 1 }, t + 0.03, 0.06, 'out');
    }
    if (k < 6) {
      tl.to(els.camFlash, { opacity: 0.8 - k * 0.1 }, t, 0.03, 'none');
      tl.to(els.camFlash, { opacity: 0 }, t + 0.04, 0.2, 'out');
    }
    if (k < 3) {
      tl.to(els.white, { opacity: 0.3 - k * 0.09 }, t, 0.03, 'none');
      tl.to(els.white, { opacity: 0 }, t + 0.04, 0.26, 'out');
    }
    setCount(roll - 1 - k, t + 0.02);
    if (k === 0) tl.set(els.thumb1, { opacity: 1 }, t + 0.1);
    if (k === 3) tl.set(els.thumb2, { opacity: 1 }, t + 0.1);
    if (k === 6) tl.set(els.thumb3, { opacity: 1 }, t + 0.1);
  }

  // The phone's layer is drawn once and then only moved, which is what keeps scrolling
  // smooth, but enlarged that far it's soft. So it's redrawn at this size for the hold.
  const WAIT = shotsFrom + shotsFor + 0.5;
  let sharp = false;
  tl.onRender((t) => {
    const next = t >= zoomed && t < WAIT;
    if (next !== sharp) {
      sharp = next;
      els.phone.style.willChange = next ? 'auto' : '';
    }
  });

  // ---- The roll's finished: back out, to the gallery the app shows while it waits.
  tl.to(els.phone, anchor, WAIT, 0.9, 'inOut');
  tl.to(els.camCount, { scale: 1 }, WAIT, 0.6, 'inOut');
  tl.to(els.dim, { opacity: 0.5 }, WAIT, 0.7, 'none');
  hidden(...locks, els.evEnded, els.fabSave);
  locks.forEach((el) => tl.set(el, { opacity: 1 }, WAIT + 0.3));
  tl.set(els.evLeft, { opacity: 0 }, WAIT + 0.3);
  tl.set(els.evEnded, { opacity: 1 }, WAIT + 0.3);
  tl.set(els.fabCamera, { opacity: 0 }, WAIT + 0.3);
  tl.set(els.fabSave, { opacity: 1 }, WAIT + 0.3);
  tl.set(screen('event'), { opacity: 0 }, WAIT + 0.3);
  tl.to(screen('event'), { opacity: 1 }, WAIT + 0.32, 0.3, 'out');

  // The real words on each locked photo, counting down to the morning.
  const lockTexts = group('cellLockText');
  const SUNRISE = WAIT + 2;
  const REVEAL = SUNRISE + 3.4;
  const left = (t: number) => {
    const mins = Math.round(492 * (1 - seg(t, WAIT + 1, REVEAL)));
    if (mins <= 0) return 'Unlocking…';
    const h = Math.floor(mins / 60);
    return `Revealed in ${h ? `${h}h ` : ''}${mins % 60}m`;
  };
  let lockShown = '';
  tl.onRender((t) => {
    const text = left(t);
    if (text === lockShown) return;
    lockShown = text;
    for (const el of lockTexts) el.textContent = text;
  });

  // ---- S8. The night ends. Sunrise, on the far side of the villa from where it set.
  const center = phonePose(L, 'center');
  const phoneForGrid = m ? anchor : center;
  const S8 = SUNRISE - 1;
  tl.to(els.dim, { opacity: 0.16 }, S8 + 1.2, 1.4, 'none');
  tl.to(els.dawn, { opacity: 1 }, S8 + 1, 1.6, 'none');
  const dawnDx = (m ? DAWN_X.narrow : DAWN_X.wide) - (SUN.x + SUN.d / 2);
  tl.set(els.sun, { x: dawnDx }, S8 + 1);
  lights.forEach((light, i) => tl.to(light, { r: 2800 }, S8 + 2 + i * 0.1, 2.2, 'in'));
  tl.to(night, { v: 0 }, S8 + 4, 0.5, 'none');
  // Not so high on desktop that it comes up behind the album's words.
  tl.to(els.sun, { y: spot ? 240 : 90 }, S8 + 2.4, 2.8, 'out');
  tl.to(els.festoonGlow, { glow: 0 }, S8 + 2.8, 1, 'none');
  // The party's over: everyone heads home, leaving the two of them.
  const homeTime = S8 + 3.8;
  [...CAST, 'ayla'].forEach((id, i) => {
    const y = id === 'ayla' ? place(PLACES.aylaSeat).y : standing(id).y;
    tl.to(els[`fig:${id}`], { y: y + OFFSTAGE }, homeTime + i * 0.09, 0.55, 'in');
  });
  // A phone's screen would cover them, leaving only their feet showing beneath it.
  if (!m) rise('morning', homeTime + 1, 1);
  if (m) camTo(wide(L, figure('morning').x), S8 + 0.4, 1.4);

  // Morning: every locked slot gives up its photo, one at a time.
  chOut('ch:s7', REVEAL - 0.5);
  tl.to(els.phone, phoneForGrid, REVEAL - 0.4, 0.9, 'inOut');
  const REVEALED = 8;
  const revealAt = (i: number) => REVEAL + 0.5 + Math.min(i, REVEALED - 1) * 0.38;
  locks.forEach((el, i) => {
    tl.to(lockIns[i], { opacity: 0, scale: 0.8 }, revealAt(i), 0.14, 'in');
    tl.to(el, { opacity: 0 }, revealAt(i) + 0.08, 0.4, 'none');
  });
  tl.to(els.evScroll, { y: GRID_SCROLL - 250 }, revealAt(3), 1.5, 'inOut');
  const ALBUM = revealAt(REVEALED) + 0.5;
  labels.s8 = ALBUM + 0.3;

  // ---- Here's everything you missed: the camera eases in, with the two of them on the left.
  ch('ch:s8', ALBUM + 0.3);
  const couple = figure('morning');
  if (spot) {
    // As close as it can get with the villa's chimneys still below the words, whatever
    // size the screen and however many lines the copy wraps to.
    const copyEnds = (els['ch:s8'].offsetTop + els['ch:s8'].offsetHeight + 14) / L.h;
    const albumVh = Math.max(1500, Math.min(home.vh, (WORLD.h - ROOF_TOP) / (1 - copyEnds)));
    camTo(framed(L, couple.x, couple.y - couple.h / 2, albumVh, 0.24), ALBUM, 1.3);
  }
  tl.to(els.dim, { opacity: 0 }, ALBUM, 0.8, 'none');
  tl.to(els.phone, anchor, ALBUM, 1.1, 'inOut');
  tl.to(els.evScroll, { y: GRID_SCROLL - 400 }, ALBUM + 1, 7.4, 'none');
  group('lift').forEach((el, i) => {
    const at7 = ALBUM + 1.3 + i * 2.4;
    const size = m ? Math.min(L.w * 0.52, L.h * 0.25) : Math.min(L.w * 0.2, L.h * 0.42);
    const pose = m
      ? { x: (L.w - size) / 2 + (i - 1) * 8, y: L.h * 0.3, rot: [-3, 2, -2][i] }
      : { x: L.w * 0.44, y: L.h * 0.2 + i * 12, rot: [-3, 2, -2][i] };
    const s = size / 300;
    tl.start(el, { x: anchor.x + 60, y: anchor.y + 420, scale: 0.4, rot: 0, opacity: 0 });
    tl.to(el, { opacity: 1 }, at7, 0.15, 'none');
    tl.to(el, { x: pose.x, y: pose.y, scale: s, rot: pose.rot }, at7, 0.6, 'out3');
    tl.to(el, { opacity: 0, y: pose.y - 16 }, at7 + 2, 0.35, 'in');
  });

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
      // S4: out of a guest's flash, up above the moment it caught, gone by the next scene.
      if (record && t >= record.t && t < S5 + 0.5) {
        const p = outCubic(seg(t, record.t, record.t + 0.55));
        const leave = seg(t, S5 - 0.1, S5 + 0.5);
        const away = { x: record.to.x, y: record.to.y + (m ? -60 : -40) };
        // As the camera moves on, each photo clears the way for the next.
        const clearing = panning ? smooth(seg(t, record.t + 0.9, record.t + 1.2)) : 0;
        if (clearing >= 1) return null;
        return {
          x: lerp(record.x, away.x, p) - printW,
          y: lerp(record.y, away.y, p) - printH - clearing * 90,
          scale: lerp(0.12, record.s, p),
          rot: record.rot * p,
          opacity: (1 - leave) * (1 - clearing) * seg(t, record.t, record.t + 0.06),
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

  // ---- S9. Any party with more than one phone: look up, away from this one.
  const S9 = ALBUM + 9;
  labels.s9 = S9 + 0.8;
  chOut('ch:s8', S9);
  tl.to(els.phone, { y: L.h + 80 }, S9 + 0.05, 0.7, 'in');
  tl.set(els.phone, { opacity: 0 }, S9 + 0.8);
  camTo({ cx: m ? figure('morning').x : home.cx, cy: -1150, vh: home.vh }, S9 + 0.2, 1.3);
  ch('ch:s9', S9 + 1);
  // Each tab's setting comes up from below, with its own event on the phone in front.
  tl.start(els.ucStage, { y: L.h, opacity: 0 });
  // Only once the terrace and its sun have gone, so there are never two suns up.
  tl.set(els.ucStage, { opacity: 1 }, S9 + 1.2);
  tl.to(els.ucStage, { y: 0 }, S9 + 1.2, 0.9, 'out3');
  const restPose = phonePose(L, 'rest');
  const partyPose = m ? restPose : anchor;
  showScreen('party', S9 + 1.15, 0.05);
  tl.set(els.phone, { ...partyPose, y: L.h + 80 }, S9 + 1.16);
  tl.set(els.phone, { opacity: 1 }, S9 + 1.2);
  tl.to(els.phone, { y: partyPose.y }, S9 + 1.2, 0.9, 'out3');
  const ucFrom = S9 + 1.4;
  const ucTo = ucFrom + 7.5;
  // The story ends on the parties, and the page lets go of the scroll here.
  const T = ucTo + 0.2;

  const stills = {
    s1: 0,
    s2: 4,
    s3: WALK + 1,
    s4: S5 - 0.4,
    s5: S5 + 7.6,
    s6: S6 + 3.4,
    s7: shotsFrom + 1.4,
    s8: ALBUM + 3.9,
    s9: ucFrom + 1,
  };

  return { tl, T, labels, cam, lights, night, home: home.cx, ucFrom, ucTo, stills };
}
