import { FIGURES, PLACES, SUN_DOWN, WORLD, figure, figureSize } from './world';
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
  ctaAt: number;
  /** The moment each scene's still is captured at, for the linear page. */
  stills: Record<string, number>;
}

const PHONE = { w: 392, h: 850 };
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
  return shot(L, cx, WORLD.h - vh / 2, vh);
}

/**
 * Closer in, with the floor still at the bottom and enough sky left above the
 * skyline for the copy, so nothing has to be laid over the print to read it.
 */
function closer(L: Layout, cx: number) {
  const vh = Math.min(L.m ? 1650 : 1860, (WORLD.w * L.h) / L.w);
  return shot(L, cx, WORLD.h - vh / 2, vh);
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
  const labels: Record<string, number> = {};
  const home = wide(L, m ? HOME_M : undefined);
  const cam = { ...home };
  const night = { v: 0 };
  const lights: Light[] = [];

  const addLight = (x: number, y: number) => {
    const light = { x, y, r: 0 };
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

  // ---- everyone in place, in the last of the sun
  for (const def of FIGURES) {
    const size = figureSize(def);
    tl.start(els[`fig:${def.id}`], { x: def.x - size.w / 2, y: def.y - size.h });
  }
  for (const n of ['s2', 's3', 's4', 's5', 's6', 's6b', 's7', 's8']) tl.start(els[`ch:${n}`], { alpha: 0, y: 26 });
  tl.start(els['ch:s1'], { alpha: 1, y: 0 });
  tl.start(els.phone, { ...phonePose(L, 'anchor'), y: L.h + 60, opacity: 0 });
  tl.start(els.sun, { y: 0 });
  tl.start(els.festoonGlow, { glow: 0 });

  // ---- S1. Every great event: the hero, which the first scroll leaves at once
  labels.s1 = 0;
  tl.to(els.hint, { opacity: 0 }, 0.02, 0.2, 'none');
  chOut('ch:s1', 0.03, 0.34);

  // ---- S2. One scan: the very first scroll is the product
  labels.s2 = 0.3;
  const entrance = closer(L, m ? PLACES.entrance.x + 120 : PLACES.entrance.x);
  camTo(entrance, 0.03, 1.1);
  // On a phone it sits between the copy and the phone's top edge, tucked just behind it.
  const copyBottom = 170;
  const invRoomM = Math.max(0, phonePose(L, 'anchor').y + 30 - copyBottom);
  const invPose = m
    ? { x: L.w * 0.5 - 143, y: copyBottom + invRoomM / 2 - 198, scale: Math.max(0.2, Math.min(0.44, invRoomM / 396)), rot: -4 }
    : { x: L.w * 0.42 - 143, y: L.h * 0.63 - 198, scale: Math.min(1.08, (L.h * 0.52) / 396), rot: -4 };
  const tableOnScreen = toScreen(L, entrance, PLACES.welcomeTable.x, PLACES.welcomeTable.y);
  tl.start(els.invRoom, { x: tableOnScreen.x - 143, y: tableOnScreen.y - 198, scale: 0.12, rot: -18, opacity: 0 });
  tl.to(els.invRoom, { opacity: 1 }, 0.08, 0.15, 'none');
  tl.to(els.invRoom, invPose, 0.08, 0.9, 'out3');
  ch('ch:s2', 0.32);

  // The phone comes up on its camera, and lands on the invitation.
  const anchor = phonePose(L, 'anchor');
  tl.set(screen('ios'), { opacity: 1 }, 0.05);
  tl.set(els.phone, { opacity: 1 }, 0.1);
  tl.to(els.phone, anchor, 0.1, 0.95, 'out3');
  tl.start(els.invVf, { x: 40, y: 24, scale: 0.58, rot: -7 });
  tl.to(els.invVf, { x: 0, y: 0, scale: 0.82, rot: -3 }, 0.7, 1.0, 'inOut');
  tl.fromTo(els.reticle, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1 }, 1.5, 0.3, 'out3');
  tl.fromTo(els.pill, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, 1.85, 0.25, 'back');
  const pillTap = inPhone(els.pill, els.screen);
  tap(pillTap.x + 66, pillTap.y + 14, 2.4);
  tl.set(screen('join'), { opacity: 0 }, 2.7);
  tl.to(screen('join'), { opacity: 1 }, 2.7, 0.3, 'out');
  tl.to(els.invRoom, { x: invPose.x - (m ? 40 : 420), y: L.h + 120, rot: -22, opacity: 0 }, 2.65, 0.9, 'in');

  // ---- S3. Find your place
  const S3 = 4.6;
  labels.s3 = S3;
  const fieldPos = inPhone(els.joinField, els.screen);
  tap(fieldPos.x + 150, fieldPos.y + 30, S3 + 0.3);
  chOut('ch:s2', S3 + 0.3);
  tl.start(screen('table'), { y: PHONE.h, opacity: 0 });
  tl.set(screen('table'), { opacity: 1 }, S3 + 0.5);
  tl.to(screen('table'), { y: 0 }, S3 + 0.5, 0.55, 'out3');
  ch('ch:s3', S3 + 0.9);
  hidden(els.type1, els.type2, els.type3, els.typeRows);
  tl.set(els.typePh, { opacity: 0 }, S3 + 1.5);
  tl.set(els.type1, { opacity: 1 }, S3 + 1.5);
  tl.set(els.type1, { opacity: 0 }, S3 + 1.85);
  tl.set(els.type2, { opacity: 1 }, S3 + 1.85);
  tl.set(els.type2, { opacity: 0 }, S3 + 2.2);
  tl.set(els.type3, { opacity: 1 }, S3 + 2.2);
  tl.set(els.typeHelp, { opacity: 0 }, S3 + 1.85);
  tl.fromTo(els.typeRows, { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, S3 + 2.4, 0.25, 'out');
  tap(150, 40 + 158 + 28, S3 + 3.1);
  tl.to(els.tableSearch, { opacity: 0 }, S3 + 3.35, 0.15, 'none');
  hidden(els.seatView);
  tl.fromTo(els.seatView, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, S3 + 3.4, 0.3, 'out');

  // A line leaves the words "Table 7", leaves the phone, and finds the table.
  const t7 = PLACES.table7;
  const tablesShot = closer(L, t7.x + (m ? 60 : 0));
  camTo(tablesShot, S3 + 3.9, 1.3);
  // On a phone there's no room beside it, so it slides down to reveal the table.
  const seatPhoneY = m ? L.vis * 0.8 : anchor.y;
  if (m) tl.to(els.phone, { y: seatPhoneY }, S3 + 3.9, 0.9, 'inOut');
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
  tl.start(els.goldPath, { dash: 1, opacity: 1 });
  tl.to(els.goldPath, { dash: 0 }, S3 + 5.2, 1.2, 'inOut');
  tl.start(els.goldDot, { opacity: 0 });
  tl.set(els.goldDot, { opacity: 1 }, S3 + 6.35);
  tl.start(els.tent7, { opacity: 0 });
  on(els.tent7, S3 + 6.35, 0.12);
  flashAt(els['flash:1'], t7.x, t7.y, S3 + 6.4);
  noteAt('note:table7', t7.x - (m ? 225 : 420), m ? 570 : 640, S3 + 7);

  // Ayla walks the line and takes her place.
  const ayla = figure('ayla');
  const aylaSize = figureSize(ayla);
  const place = (p: { x: number; y: number }) => ({ x: p.x - aylaSize.w / 2, y: p.y - aylaSize.h });
  tl.start(els['fig:ayla'], { ...place(PLACES.aylaStart), opacity: 0 });
  const frames = group('frame:ayla');
  hidden(frames[1], frames[2], frames[3]);
  tl.set(frames[0], { opacity: 0 }, S3 + 6.9);
  tl.set(els['fig:ayla'], { opacity: 1 }, S3 + 6.9);
  tl.to(els['fig:ayla'], place(PLACES.aylaSeat), S3 + 6.9, 1.9, 'none');
  const walkEnd = S3 + 8.8;
  for (let t = S3 + 6.9, flip = 0; t < walkEnd; t += 0.26, flip++) {
    tl.set(frames[1], { opacity: flip % 2 === 0 ? 1 : 0 }, t);
    tl.set(frames[2], { opacity: flip % 2 === 0 ? 0 : 1 }, t);
  }
  tl.set(frames[1], { opacity: 0 }, walkEnd);
  tl.set(frames[2], { opacity: 0 }, walkEnd);
  tl.set(frames[3], { opacity: 1 }, walkEnd);
  tl.to(els.goldPath, { opacity: 0 }, S3 + 8.4, 0.4, 'none');
  tl.to(els.goldDot, { opacity: 0 }, S3 + 8.4, 0.4, 'none');
  off(els['note:table7'], S3 + 8.9);
  off(els.tent7, S3 + 8.9);

  const joinTap = S3 + (m ? 9.6 : 9.1);
  if (m) tl.to(els.phone, { y: anchor.y }, S3 + 8.9, 0.55, 'inOut');
  const seatJoin = inPhone(els.seatJoin, els.screen);
  tap(seatJoin.x + seatJoin.w / 2, seatJoin.y + 40 + 28, joinTap);
  tl.set(screen('camera'), { opacity: 0 }, joinTap + 0.25);
  tl.to(screen('camera'), { opacity: 1 }, joinTap + 0.25, 0.25, 'out');
  chOut('ch:s3', joinTap + 0.3);

  // ---- S4. Everyone has a camera: the phone shrinks into Ayla's hands, and the sun goes down.
  labels.s4 = S3 + 10;
  const aylaLens = { x: PLACES.aylaSeat.x - aylaSize.w / 2 + aylaSize.w * 0.62, y: PLACES.aylaSeat.y - aylaSize.h * 0.9 };
  const inHands = toScreen(L, tablesShot, aylaLens.x, aylaLens.y);
  const tinyScale = (aylaSize.h * 0.09 * inHands.z) / PHONE.h;
  const shrink = joinTap + 0.7;
  tl.to(els.phone, { x: inHands.x - (PHONE.w * tinyScale) / 2, y: inHands.y - (PHONE.h * tinyScale) / 2, scale: tinyScale }, shrink, 0.95, 'inOut');
  tl.to(els.phone, { opacity: 0 }, shrink + 0.8, 0.15, 'none');

  const roomWide = m ? wide(L, PLACES.aylaSeat.x) : wide(L);
  camTo(roomWide, shrink + 1, 1.2);
  const dusk = shrink + 0.9;
  tl.to(night, { v: 1 }, dusk, 1.9, 'inOut');
  tl.to(els.sun, { y: SUN_DOWN }, dusk, 1.9, 'in');
  tl.to(els.festoonGlow, { glow: 1 }, dusk + 0.9, 0.9, 'none');
  ch('ch:s4', shrink + 2.2);

  // Each flash lights a patch of the party, and a photo appears above it.
  const SHOTS = [
    { who: 'ayla', moment: 'singalong', photo: 7, lensAt: aylaLens },
    { who: 'overhead', moment: 'dad', photo: 6 },
    { who: 'auntie', moment: 'hug', photo: 5 },
    { who: 'teen', moment: 'girlDog', photo: 1 },
    { who: 'overhead', moment: 'cake', photo: 8 },
  ];
  type FlashRecord = { t: number; x: number; y: number; to: { x: number; y: number }; s: number; rot: number };
  const records: FlashRecord[] = [];
  let at = shrink + 3.2;
  const gaps = m ? [1.1, 1.1, 1.1, 1.1, 1.1] : [0.95, 0.85, 0.75, 0.65, 0.6];
  SHOTS.forEach((s, i) => {
    const moment = figure(s.moment);
    const camHere = m ? shot(L, moment.x, 780, 1500) : roomWide;
    if (m) camTo(camHere, at - 0.6, 0.5);
    const l = s.lensAt ?? lens(s.who);
    flashAt(els[`flash:${i + 2}`], l.x, l.y, at);
    const pool = addLight(moment.x, moment.y - moment.h * 0.4);
    tl.to(pool, { r: m ? 400 : 430 }, at, 0.45, 'out3');
    const face = toScreen(L, camHere, moment.x, moment.y - moment.h);
    const source = toScreen(L, camHere, moment.x, moment.y - moment.h * 0.5);
    const printScale = (m ? 0.62 : Math.min(0.66, L.w / 2000)) * Math.min(1, L.h / 760);
    records.push({
      t: at,
      x: source.x,
      y: source.y,
      to: { x: Math.max(70, Math.min(L.w - 70, face.x + (i % 2 ? 30 : -30))), y: Math.max(m ? 270 : 170, face.y - (m ? 100 : 70) - (i % 3) * 30) },
      s: printScale,
      rot: [-8, 6, -4, 9, -6][i],
    });
    at += gaps[i];
  });

  // ---- S5. The camera
  const S5 = at + 1.2;
  labels.s5 = S5;
  chOut('ch:s4', S5);
  const inRoom = toScreen(L, roomWide, aylaLens.x, aylaLens.y);
  const tinyRoom = (aylaSize.h * 0.09 * inRoom.z) / PHONE.h;
  tl.set(els.phone, { x: inRoom.x, y: inRoom.y, scale: tinyRoom }, S5);
  tl.set(els.phone, { opacity: 1 }, S5 + 0.05);
  tl.to(els.phone, anchor, S5 + 0.05, 1.2, 'inOut');
  tl.start(els.dim, { opacity: 0 });
  tl.to(els.dim, { opacity: 0.55 }, S5, 1, 'none');
  if (m) camTo(wide(L, PLACES.aylaSeat.x), S5, 1);
  ch('ch:s5', S5 + 1);

  const roll = els.camRoll;
  const shutter = els.shutter;
  const shotTimes = [S5 + 2.2, S5 + 4, S5 + 5.8];
  hidden(els.thumb1, els.thumb2, els.thumb3, els.vf2, els.vf3);
  hidden(els.camFlash, els.white);
  const camVf = inPhone(els.camFlash, els.screen);
  const landing = m
    ? [{ x: 62, y: L.h * 0.5, rot: -10 }, { x: L.w - 62, y: L.h * 0.56, rot: 8 }, { x: 64, y: L.h * 0.74, rot: 6 }]
    : [{ x: L.w * 0.14, y: L.h * 0.74, rot: -8 }, { x: L.w * 0.31, y: L.h * 0.7, rot: 5 }, { x: L.w * 0.48, y: L.h * 0.76, rot: -3 }];
  const shutterPrints: { t: number; to: { x: number; y: number; rot: number } }[] = [];
  shotTimes.forEach((t, i) => {
    tl.to(shutter, { scale: 0.82 }, t - 0.1, 0.1, 'out');
    tl.to(shutter, { scale: 1 }, t + 0.1, 0.2, 'out');
    tl.to(els.camFlash, { opacity: 1 }, t, 0.05, 'none');
    tl.to(els.camFlash, { opacity: 0 }, t + 0.1, 0.5, 'out');
    tl.to(els.white, { opacity: 0.92 }, t, 0.05, 'none');
    tl.to(els.white, { opacity: 0 }, t + 0.06, 0.55, 'out');
    tl.to(roll, { y: -36 * (i + 1) }, t + 0.08, 0.3, 'out3');
    tl.set(els[`thumb${i + 1}`], { opacity: 1 }, t + 0.25);
    shutterPrints.push({ t: t + 0.05, to: landing[i] });
    if (i < 2) {
      tl.to(els[`vf${i + 2}`], { opacity: 1 }, t + 0.75, 0.25, 'none');
    }
  });

  // ---- S6. A thousand perspectives. One story.
  const S6 = shotTimes[2] + 1.8;
  labels.s6 = S6;
  chOut('ch:s5', S6);
  const center = phonePose(L, 'center');
  tl.to(els.phone, m ? anchor : center, S6 + 0.2, 1.2, 'inOut');
  tl.set(screen('event'), { opacity: 0 }, S6 + 0.6);
  tl.to(screen('event'), { opacity: 1 }, S6 + 0.6, 0.4, 'none');
  hidden(els.evGrid);

  const settleStart = S6 + 7.8;
  const settleEnd = S6 + 10.8;

  tl.to(els.dim, { opacity: 0 }, S6 + 3, 2, 'none');
  ch('ch:s6', S6 + 0.4);
  chOut('ch:s6', S6 + 2.3);
  // The patches of light merge, and the sunset comes back with them.
  lights.forEach((light, i) => tl.to(light, { r: 2800 }, S6 + 3.2 + i * 0.1, 2.4, 'in'));
  tl.to(night, { v: 0 }, S6 + 5.2, 0.5, 'none');
  tl.to(els.sun, { y: 0 }, S6 + 3.4, 2.6, 'out');
  tl.to(els.festoonGlow, { glow: 0 }, S6 + 3.6, 1, 'none');
  ch('ch:s6b', settleEnd - 0.5);

  // The grid's real cells, which the settling photos land on.
  const cells = group('cell');
  const phoneForGrid = m ? anchor : center;
  const cellRect = (i: number) => {
    const r = inPhone(cells[i], els.screen);
    return {
      x: phoneForGrid.x + (r.x + r.w / 2) * phoneForGrid.scale,
      y: phoneForGrid.y + (r.y + r.h / 2) * phoneForGrid.scale,
      s: (r.w * phoneForGrid.scale) / 220,
    };
  };

  const S8Start = { v: 0 };
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
    const enter = S6 + 1.8 + (i / total) * 2.6;
    const fromAngle = a0 + 0.9;
    const startPose = { x: cxS + Math.cos(fromAngle) * R0 * 1.5, y: cyS + Math.sin(fromAngle) * R0 * 1.5 };
    const rot0 = ((i * 47) % 50) - 25;
    const backIndex = i - frontCount;
    const record = backIndex >= 0 && backIndex < records.length ? records[backIndex] : null;
    const shutterIndex = backIndex - records.length;
    const shutterPrint = shutterIndex >= 0 && shutterIndex < shutterPrints.length ? shutterPrints[shutterIndex] : null;
    const grid = isFront ? cellRect(i) : null;

    const finalShot = home;
    const restFigure = FIGURES[((backIndex % FIGURES.length) + FIGURES.length) % FIGURES.length];
    const restPoint = toScreen(L, finalShot, restFigure.x, restFigure.y - restFigure.h - 90 - (backIndex % 3) * 50);
    const rest = backIndex >= 0 && backIndex < (m ? 4 : 7) && restPoint.x > -20 && restPoint.x < L.w + 20 ? restPoint : null;

    tl.drive(el, (t): Pose | null => {
      // S4: out of a guest's flash, up above the moment it caught.
      if (record && t >= record.t && t < S6 + 0.5) {
        const p = outCubic(seg(t, record.t, record.t + 0.55));
        const leave = smooth(seg(t, S5, S5 + 1.1));
        const away = { x: record.to.x, y: record.to.y + (m ? -60 : -40) };
        // On a phone the camera moves on, so each photo clears the way for the next.
        const clearing = m ? smooth(seg(t, record.t + 0.9, record.t + 1.2)) : 0;
        if (clearing >= 1) return null;
        return {
          x: lerp(record.x, away.x, p) - printW,
          y: lerp(record.y, away.y, p) - printH - clearing * 90,
          scale: lerp(0.12, record.s, p) * (1 - leave * 0.25),
          rot: record.rot * p,
          opacity: (1 - leave * 0.45) * (1 - clearing) * seg(t, record.t, record.t + 0.06),
        };
      }
      // S5: out of the phone, onto the table beside it.
      if (shutterPrint && t >= shutterPrint.t && t < S6 + 0.5) {
        const p = outCubic(seg(t, shutterPrint.t, shutterPrint.t + 0.9));
        const sx = anchor.x + (camVf.x + camVf.w / 2) * anchor.scale;
        const sy = anchor.y + (camVf.y + camVf.h / 2) * anchor.scale;
        return {
          x: lerp(sx, shutterPrint.to.x, p) - printW,
          y: lerp(sy, shutterPrint.to.y, p) - printH,
          scale: lerp(0.3, m ? 0.56 : 0.95 * printFit, p),
          rot: shutterPrint.to.rot * p,
          opacity: seg(t, shutterPrint.t, shutterPrint.t + 0.08),
        };
      }
      // S6: arrive, swirl, settle.
      const inS6 = t >= S6 + 0.5 && t < settleEnd + 0.6;
      if (inS6) {
        if (t < enter && (!record || m) && !shutterPrint) return null;
        const swirl = a0 + spin * (t - S6) * 0.62;
        const radius = lerp(R0 * (isFront ? 0.72 : 0.92), R0 * (m ? 0.62 : 0.66), smooth(seg(t, S6 + 2, settleStart)));
        const ring = {
          x: cxS + Math.cos(swirl) * radius * (m ? 0.72 : 1.18),
          y: cyS + Math.sin(swirl) * radius * (m ? 1.18 : 0.74),
        };
        const pIn = outCubic(seg(t, enter, enter + 1.6));
        const startFromPrev = record && !m
          ? { x: record.to.x, y: record.to.y }
          : shutterPrint
            ? { x: shutterPrint.to.x, y: shutterPrint.to.y }
            : startPose;
        const pSettle = smooth(seg(t, settleStart + (i / total) * 0.9, settleEnd - (1 - i / total) * 0.5));
        const target = grid
          ? { x: grid.x, y: grid.y, s: grid.s }
          : { x: cxS + (i % 2 ? 40 : -40) * (m ? 0.5 : 1), y: cyS + ((i % 4) - 2) * 26, s: 0.16 };
        const x = lerp(lerp(startFromPrev.x, ring.x, pIn), target.x, pSettle);
        const y = lerp(lerp(startFromPrev.y, ring.y, pIn), target.y, pSettle);
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
      // S8: a few prints come to rest in the finished room.
      if (rest && t >= S8Start.v) {
        const p = outCubic(seg(t, S8Start.v + 0.6 + backIndex * 0.09, S8Start.v + 1.6 + backIndex * 0.09));
        return { x: rest.x - printW, y: lerp(rest.y + 40, rest.y, p) - printH, scale: (m ? 0.34 : 0.42) * printFit, rot: rot0 * 0.5, opacity: p };
      }
      return null;
    });
  });
  tl.to(els.evGrid, { opacity: 1 }, settleEnd - 0.1, 0.3, 'none');

  // As the photos land, the phone's edge starts cropping them.
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

  // ---- S7. The moments you missed
  const S7 = settleEnd + 1.2;
  labels.s7 = S7;
  chOut('ch:s6b', S7 - 0.2);
  ch('ch:s7', S7 + 0.3);
  tl.to(els.phone, anchor, S7, 1.1, 'inOut');
  tl.to(els.evScroll, { y: -150 }, S7 + 1, 7.4, 'none');

  group('lift').forEach((el, i) => {
    const at7 = S7 + 1.3 + i * 2.4;
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

  // ---- S8. Every moment deserves a place
  const S8 = S7 + 9;
  S8Start.v = S8;
  labels.s8 = S8 + 1.8;
  chOut('ch:s7', S8 - 0.2);
  camTo(home, S8, 1.8);
  tl.to(els.phone, phonePose(L, 'rest'), S8, 1.8, 'inOut');
  ch('ch:s8', S8 + 1.5, 0.7);
  const T = S8 + 5.5;

  const stills = {
    s1: 0,
    s2: 3.4,
    s3: S3 + 7.9,
    s4: S5 - 0.5,
    s5: shotTimes[2] + 1.2,
    s6: S6 + 4.4,
    s6b: settleEnd + 0.8,
    s7: S7 + 3.9,
    s8: T - 0.2,
  };

  return { tl, T, labels, cam, lights, night, home: home.cx, ctaAt: S8 + 1.5, stills };
}
