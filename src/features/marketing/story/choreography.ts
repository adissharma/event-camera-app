import { FIGURES, PLACES, WORLD, figure, figureSize } from './world';
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
  exposure: { v: number };
  paperAt: number;
  ctaAt: number;
  /** The moment each scene's still is captured at, for the linear page. */
  stills: Record<string, number>;
}

const PHONE = { w: 392, h: 850 };

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
  const cam = { ...wide(L, m ? 2500 : undefined) };
  const exposure = { v: 0 };
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
  /** A small note in the room: beside its subject on desktop, above it on a phone. */
  const noteAt = (name: string, x: number, y: number, at: number) => {
    tl.start(els[name], { x, y: y + 18, opacity: 0 });
    tl.to(els[name], { opacity: 1, y }, at, 0.45, 'out');
  };
  const note = (id: string, at: number) => {
    const def = figure(id);
    const size = figureSize(def);
    if (m) noteAt(`note:${id}`, def.x - 225, def.y - def.h - 165, at);
    else noteAt(`note:${id}`, def.x + size.w / 2 + 30, def.y - def.h + 20, at);
  };
  const hidden = (...list: (HTMLElement | undefined)[]) => list.forEach((el) => tl.start(el, { opacity: 0 }));
  const screen = (name: string) => els[`screen:${name}`];
  const tap = (x: number, y: number, at: number) => {
    tl.set(els.tap, { x, y }, at - 0.01);
    tl.to(els.tap, { opacity: 1, scale: 1 }, at, 0.1, 'out');
    tl.to(els.tap, { scale: 0.74 }, at + 0.1, 0.12, 'out');
    tl.to(els.tap, { opacity: 0 }, at + 0.28, 0.14, 'in');
  };
  const figLit = (id: string, at: number, dur = 0.12) => {
    group(`pos:${id}`).forEach((img) => tl.to(img, { opacity: 1 }, at, dur, 'none'));
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

  // ---- everyone starts in the dark, in place
  for (const def of FIGURES) {
    const size = figureSize(def);
    tl.start(els[`fig:${def.id}`], { x: def.x - size.w / 2, y: def.y - size.h });
  }
  for (const n of ['s1b', 's2', 's3', 's4', 's5', 's6', 's6b', 's7', 's8']) tl.start(els[`ch:${n}`], { alpha: 0, y: 26 });
  tl.start(els['ch:s1'], { alpha: 1, y: 0 });
  tl.start(els.phone, { ...phonePose(L, 'anchor'), y: L.h + 60, opacity: 0 });

  tl.start(els.scrim, { opacity: 0 });

  // ---- S1. Every great event has a thousand stories
  labels.s1 = 0;
  tl.to(els.hint, { opacity: 0 }, 0.15, 0.3, 'none');
  const noteShot = (id: string, cy: number, vh: number) => {
    const def = figure(id);
    return shot(L, def.x + (m ? 0 : 260), def.y - cy, vh);
  };
  chOut('ch:s1', 1.1, 0.6);
  const vhClose = m ? 1040 : 980;

  camTo(noteShot('waiter', 240, vhClose), 1.3, 1.4);
  note('waiter', 2.5);
  off(els['note:waiter'], 3.7);
  camTo(noteShot('dad', 280, vhClose), 3.9, 1.3);
  note('dad', 5);
  off(els['note:dad'], 6.2);
  camTo(noteShot('hug', 260, vhClose), 6.3, 1.3);
  note('hug', 7.4);
  off(els['note:hug'], 8.6);

  const headShot = m ? shot(L, 3560, 800, 1400) : wide(L);
  camTo(headShot, 8.7, 1.5);
  ch('ch:s1b', 9.9, 0.6);
  const headLight = addLight(figure('cake').x - 130, figure('cake').y - 200);
  flashAt(els['flash:0'], lens('photographer').x, lens('photographer').y, 10.5);
  tl.to(headLight, { r: 520 }, 10.5, 0.5, 'out3');
  figLit('photographer', 10.5);
  figLit('cake', 10.52);

  // ---- S2. One little QR code
  tl.to(els.scrim, { opacity: 1 }, 12.4, 1, 'none');
  labels.s2 = 12.5;
  chOut('ch:s1b', 12.3);
  const entrance = m ? shot(L, 300, 800, 1100) : shot(L, PLACES.entrance.x + 500, 800, 1150);
  camTo(entrance, 12.4, 1.3);
  const invPose = m
    ? { x: L.w * 0.5 - 143, y: L.h * 0.27 - 198, scale: Math.min(0.62, (L.h * 0.34) / 396), rot: -4 }
    : { x: L.w * 0.42 - 143, y: L.h * 0.63 - 198, scale: Math.min(1.08, (L.h * 0.52) / 396), rot: -4 };
  const tableOnScreen = toScreen(L, entrance, PLACES.welcomeTable.x, PLACES.welcomeTable.y);
  tl.start(els.invRoom, { x: tableOnScreen.x - 143, y: tableOnScreen.y - 198, scale: 0.12, rot: -18, opacity: 0 });
  tl.to(els.invRoom, { opacity: 1 }, 13.4, 0.2, 'none');
  tl.to(els.invRoom, invPose, 13.4, 1.0, 'out3');
  if (!m) ch('ch:s2', 14);

  // The phone comes up on its camera, and lands on the invitation.
  const anchor = phonePose(L, 'anchor');
  tl.set(screen('ios'), { opacity: 1 }, 14);
  tl.set(els.phone, { opacity: 1 }, 14.3);
  tl.to(els.phone, anchor, 14.3, 1.0, 'out3');
  tl.start(els.invVf, { x: 40, y: 24, scale: 0.58, rot: -7 });
  tl.to(els.invVf, { x: 0, y: 0, scale: 0.82, rot: -3 }, 15, 1.1, 'inOut');
  tl.fromTo(els.reticle, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1 }, 15.9, 0.3, 'out3');
  tl.fromTo(els.pill, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, 16.25, 0.25, 'back');
  const pillTap = inPhone(els.pill, els.screen);
  tap(pillTap.x + 66, pillTap.y + 14, 16.85);
  tl.set(screen('join'), { opacity: 0 }, 17.15);
  tl.to(screen('join'), { opacity: 1 }, 17.15, 0.3, 'out');
  tl.to(els.invRoom, { x: invPose.x - (m ? 40 : 420), y: L.h + 120, rot: -22, opacity: 0 }, 17.1, 0.9, 'in');
  if (m) ch('ch:s2', 17.7);

  // ---- S3. Find your place
  labels.s3 = 19;
  const fieldPos = inPhone(els.joinField, els.screen);
  tap(fieldPos.x + 150, fieldPos.y + 30, 19.3);
  chOut('ch:s2', 19.3);
  tl.start(screen('table'), { y: PHONE.h, opacity: 0 });
  tl.set(screen('table'), { opacity: 1 }, 19.5);
  tl.to(screen('table'), { y: 0 }, 19.5, 0.55, 'out3');
  ch('ch:s3', 19.9);
  hidden(els.type1, els.type2, els.type3, els.typeRows);
  tl.set(els.typePh, { opacity: 0 }, 20.5);
  tl.set(els.type1, { opacity: 1 }, 20.5);
  tl.set(els.type1, { opacity: 0 }, 20.85);
  tl.set(els.type2, { opacity: 1 }, 20.85);
  tl.set(els.type2, { opacity: 0 }, 21.2);
  tl.set(els.type3, { opacity: 1 }, 21.2);
  tl.set(els.typeHelp, { opacity: 0 }, 20.85);
  tl.fromTo(els.typeRows, { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, 21.4, 0.25, 'out');
  tap(150, 40 + 158 + 28, 22.1);
  tl.to(els.tableSearch, { opacity: 0 }, 22.35, 0.15, 'none');
  hidden(els.seatView);
  tl.fromTo(els.seatView, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 22.4, 0.3, 'out');

  // A line leaves the words "Table 7", leaves the phone, and finds the table.
  const t7 = PLACES.table7;
  const tablesShot = m ? shot(L, t7.x, 800, 1020) : shot(L, t7.x + 260, 800, 1240);
  camTo(tablesShot, 22.9, 1.3);
  // On a phone there's no room beside it, so it slides down to reveal the table.
  const seatPhoneY = m ? L.vis * 0.8 : anchor.y;
  if (m) tl.to(els.phone, { y: seatPhoneY }, 22.9, 0.9, 'inOut');
  const seatWord = inPhone(els.seatWord, els.screen);
  const from = { x: anchor.x + (seatWord.x + seatWord.w / 2 - (m ? 0 : 74)) * anchor.scale, y: seatPhoneY + (seatWord.y + seatWord.h / 2) * anchor.scale };
  const dest = toScreen(L, tablesShot, t7.x, t7.y);
  const mid = m
    ? `C ${from.x + 90} ${from.y - 90}, ${dest.x + 90} ${dest.y + 110}, ${dest.x} ${dest.y + 16}`
    : `C ${from.x - 200} ${from.y + 20}, ${dest.x + 260} ${dest.y - 230}, ${dest.x + 22} ${dest.y - 4}`;
  els.goldPath.setAttribute('d', `M ${from.x} ${from.y} ${mid}`);
  els.goldDot.setAttribute('cx', String(dest.x));
  els.goldDot.setAttribute('cy', String(dest.y));
  tl.start(els.goldPath, { dash: 1, opacity: 1 });
  tl.to(els.goldPath, { dash: 0 }, 24.2, 1.2, 'inOut');
  tl.start(els.goldDot, { opacity: 0 });
  tl.set(els.goldDot, { opacity: 1 }, 25.35);
  on(els['tentOn:7'], 25.35, 0.12);
  const seatLight = addLight(t7.x + 10, t7.y + 40);
  tl.to(seatLight, { r: 570 }, 25.4, 0.6, 'out3');
  figLit('aunt', 25.42);
  flashAt(els['flash:1'], t7.x, t7.y, 25.4);
  if (m) noteAt('note:table7', t7.x - 225, 790, 26);
  else noteAt('note:table7', t7.x - 420, 640, 26);

  // Ayla walks the line and takes her place.
  const ayla = figure('ayla');
  const aylaSize = figureSize(ayla);
  const place = (p: { x: number; y: number }) => ({ x: p.x - aylaSize.w / 2, y: p.y - aylaSize.h });
  const aylaStart = m ? { x: 1500, y: 1360 } : PLACES.aylaStart;
  tl.start(els['fig:ayla'], { ...place(aylaStart), opacity: 0 });
  const frames = group('frame:ayla');
  hidden(frames[1], frames[2], frames[3]);
  tl.set(frames[0], { opacity: 0 }, 25.9);
  tl.set(els['fig:ayla'], { opacity: 1 }, 25.9);
  tl.to(els['fig:ayla'], place(PLACES.aylaSeat), 25.9, 1.9, 'none');
  figLit('ayla', 25.8);
  const walkEnd = 27.8;
  for (let t = 25.9, flip = 0; t < walkEnd; t += 0.26, flip++) {
    tl.set(frames[1], { opacity: flip % 2 === 0 ? 1 : 0 }, t);
    tl.set(frames[2], { opacity: flip % 2 === 0 ? 0 : 1 }, t);
  }
  tl.set(frames[1], { opacity: 0 }, walkEnd);
  tl.set(frames[2], { opacity: 0 }, walkEnd);
  tl.set(frames[3], { opacity: 1 }, walkEnd);
  tl.to(els.goldPath, { opacity: 0 }, 27.4, 0.4, 'none');
  tl.to(els.goldDot, { opacity: 0 }, 27.4, 0.4, 'none');
  off(els['note:table7'], 27.9);

  const joinTap = m ? 28.6 : 28.1;
  if (m) tl.to(els.phone, { y: anchor.y }, 27.9, 0.55, 'inOut');
  const seatJoin = inPhone(els.seatJoin, els.screen);
  tap(seatJoin.x + seatJoin.w / 2, seatJoin.y + 40 + 28, joinTap);
  tl.set(screen('camera'), { opacity: 0 }, joinTap + 0.25);
  tl.to(screen('camera'), { opacity: 1 }, joinTap + 0.25, 0.25, 'out');
  chOut('ch:s3', joinTap + 0.3);

  // ---- S4. Everyone has a camera: the phone shrinks into Ayla's hands.
  labels.s4 = 29;
  const aylaLens = { x: PLACES.aylaSeat.x - aylaSize.w / 2 + aylaSize.w * 0.62, y: PLACES.aylaSeat.y - aylaSize.h * 0.9 };
  const inHands = toScreen(L, tablesShot, aylaLens.x, aylaLens.y);
  const tinyScale = (aylaSize.h * 0.09 * inHands.z) / PHONE.h;
  const shrink = joinTap + 0.7;
  tl.to(els.phone, { x: inHands.x - (PHONE.w * tinyScale) / 2, y: inHands.y - (PHONE.h * tinyScale) / 2, scale: tinyScale }, shrink, 0.95, 'inOut');
  tl.to(els.phone, { opacity: 0 }, shrink + 0.8, 0.15, 'none');

  tl.to(els.scrim, { opacity: m ? 1 : 0 }, shrink + 1, 1, 'none');
  const roomWide = m ? wide(L, 1200) : wide(L);
  camTo(roomWide, shrink + 1, 1.2);
  ch('ch:s4', shrink + 1.8);

  // Each flash: a guest flips positive, their subject lights up, a photo appears.
  const SHOTS = [
    { who: 'ayla', moment: 'singalong', photo: 7, lensAt: aylaLens },
    { who: 'overhead', moment: 'dad', photo: 6 },
    { who: 'auntie', moment: 'hug', photo: 5 },
    { who: 'teen', moment: 'flowerGirls', photo: 2 },
    { who: 'grandad', moment: 'girlDog', photo: 1 },
    { who: 'auntie', moment: 'aunt', photo: 4 },
  ];
  type FlashRecord = { t: number; x: number; y: number; to: { x: number; y: number }; s: number; rot: number };
  const records: FlashRecord[] = [];
  let at = shrink + 2.6;
  const gaps = m ? [1.1, 1.1, 1.1, 1.1, 1.1, 1.1] : [0.95, 0.85, 0.75, 0.65, 0.55, 0.5];
  SHOTS.forEach((s, i) => {
    const moment = figure(s.moment);
    const camHere = m ? shot(L, moment.x, 780, 1500) : roomWide;
    if (m) camTo(camHere, at - 0.6, 0.5);
    const l = s.lensAt ?? lens(s.who);
    flashAt(els[`flash:${i + 2}`], l.x, l.y, at);
    figLit(s.who, at);
    figLit(s.moment, at + 0.02);
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
      rot: [-8, 6, -4, 9, -6, 5][i],
    });
    at += gaps[i];
  });

  // ---- S5. The camera
  const S5 = Math.max(at + 1.2, 37.6);
  const S6Hold = S5 + 8;
  labels.s5 = S5;
  chOut('ch:s4', S5);
  const inRoom = toScreen(L, roomWide, aylaLens.x, aylaLens.y);
  const tinyRoom = (aylaSize.h * 0.09 * inRoom.z) / PHONE.h;
  tl.set(els.phone, { x: inRoom.x, y: inRoom.y, scale: tinyRoom }, S5);
  tl.set(els.phone, { opacity: 1 }, S5 + 0.05);
  tl.to(els.phone, anchor, S5 + 0.05, 1.2, 'inOut');
  tl.start(els.dim, { opacity: 0 });
  tl.to(els.dim, { opacity: 0.55 }, S5, 1, 'none');
  if (m) camTo(wide(L, 1200), S5, 1);
  ch('ch:s5', S5 + 1);
  if (m) tl.to(els.scrim, { opacity: 0 }, S6Hold, 0.5, 'none');

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
  const paperAt = S6 + 5;

  tl.to(els.dim, { opacity: 0 }, S6 + 3, 2, 'none');
  ch('ch:s6', S6 + 0.4);
  chOut('ch:s6', S6 + 2.3);
  lights.forEach((light, i) => tl.to(light, { r: 2600 }, S6 + 3.2 + i * 0.08, 2.4, 'in'));
  tl.to(exposure, { v: 1 }, paperAt, 0.5, 'none');
  FIGURES.forEach((def, i) => {
    const lit = ['photographer', 'cake', 'ayla', 'overhead', 'auntie', 'teen', 'grandad', 'singalong', 'dad', 'hug', 'flowerGirls', 'girlDog', 'aunt'];
    if (!lit.includes(def.id)) figLit(def.id, S6 + 3 + i * 0.1);
  });
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

    const finalShot = wide(L, m ? 2400 : undefined);
    const restFigure = FIGURES[((backIndex % FIGURES.length) + FIGURES.length) % FIGURES.length];
    const restPoint = toScreen(L, finalShot, restFigure.x, restFigure.y - restFigure.h - 90 - (backIndex % 3) * 50);
    const rest = backIndex >= 0 && backIndex < (m ? 6 : 12) && restPoint.x > -20 && restPoint.x < L.w + 20 ? restPoint : null;

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
  camTo(wide(L, m ? 2400 : undefined), S8, 1.8);
  tl.to(els.phone, phonePose(L, 'rest'), S8, 1.8, 'inOut');
  ch('ch:s8', S8 + 1.5, 0.7);
  const T = S8 + 5.5;

  const stills = {
    s1: 0,
    s1b: 11.6,
    s2: 16.6,
    s3: 26.9,
    s4: S5 - 0.5,
    s5: shotTimes[2] + 1.2,
    s6: S6 + 5.6,
    s6b: settleEnd + 0.8,
    s7: S7 + 3.9,
    s8: T - 0.2,
  };

  return { tl, T, labels, cam, lights, exposure, paperAt, ctaAt: S8 + 1.5, stills };
}
