import { ART_SIZES } from './art-manifest';

/**
 * Where everything stands in the room, in the panorama's own pixels (3840×1440).
 *
 * `x` is a figure's centre, `y` the line its feet stand on, and `h` its height.
 * Everyone stays put; the camera moves over them.
 */

export const WORLD = { w: 3840, h: 1440 };

export interface FigureDef {
  id: string;
  frames: string[];
  x: number;
  y: number;
  h: number;
  flip?: boolean;
  /** Spot the guest's phone sits at, relative to the figure's box (0 to 1). */
  lens?: [number, number];
}

export const FIGURES: FigureDef[] = [
  { id: 'grandad', frames: ['shooter-grandad'], x: 150, y: 1290, h: 340, lens: [0.62, 0.22] },
  { id: 'girlDog', frames: ['girl-dog'], x: 420, y: 1340, h: 240 },
  { id: 'teen', frames: ['shooter-teen'], x: 650, y: 1410, h: 400, lens: [0.65, 0.2] },
  { id: 'flowerGirls', frames: ['flower-girls'], x: 960, y: 1360, h: 180 },
  { id: 'waiter', frames: ['waiter'], x: 1240, y: 1330, h: 390 },
  { id: 'aunt', frames: ['aunt'], x: 1530, y: 1300, h: 290 },
  { id: 'hug', frames: ['hug'], x: 2280, y: 1190, h: 400 },
  { id: 'ayla', frames: ['ayla-scan', 'ayla-walk-a', 'ayla-walk-b', 'ayla-shoot'], x: 1890, y: 1230, h: 400, lens: [0.62, 0.1] },
  { id: 'auntie', frames: ['shooter-auntie'], x: 2040, y: 1410, h: 410, lens: [0.7, 0.28] },
  { id: 'dad', frames: ['dad-a', 'dad-b'], x: 2830, y: 1220, h: 440, flip: true },
  { id: 'overhead', frames: ['shooter-overhead'], x: 2520, y: 1400, h: 470, lens: [0.5, 0.05] },
  { id: 'singalong', frames: ['singalong'], x: 3180, y: 1320, h: 390 },
  { id: 'photographer', frames: ['photographer'], x: 3430, y: 1200, h: 280, lens: [0.8, 0.28] },
  { id: 'cake', frames: ['cake'], x: 3690, y: 1290, h: 470 },
];

export const figure = (id: string) => FIGURES.find((f) => f.id === id)!;

export function figureSize(def: FigureDef): { w: number; h: number } {
  const size = ART_SIZES[def.frames[0]] ?? { w: 2, h: 3 };
  return { w: (def.h * size.w) / size.h, h: def.h };
}

/** Numbered tent cards, laid over the blank cards in the drawing. */
export const TENTS: { n: number; x: number; y: number }[] = [
  { n: 3, x: 770, y: 1000 },
  { n: 4, x: 1130, y: 1045 },
  { n: 5, x: 1390, y: 920 },
  { n: 7, x: 1720, y: 1000 },
];

export const PLACES = {
  entrance: { x: 480, y: 900 },
  welcomeTable: { x: 180, y: 950 },
  table7: { x: 1720, y: 1000 },
  aylaStart: { x: 1320, y: 1370 },
  aylaSeat: { x: 1890, y: 1230 },
  headTable: { x: 3400, y: 880 },
};

/** Festoon spans: each wire hangs between two fixed points above the wall. */
export const FESTOON: { x0: number; y0: number; x1: number; y1: number; sag: number }[] = [
  { x0: -40, y0: 330, x1: 860, y1: 280, sag: 170 },
  { x0: 860, y0: 280, x1: 1760, y1: 300, sag: 190 },
  { x0: 1760, y0: 300, x1: 2640, y1: 270, sag: 190 },
  { x0: 2640, y0: 270, x1: 3880, y1: 320, sag: 230 },
];
