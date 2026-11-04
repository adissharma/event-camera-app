import { ART_SIZES } from './art-manifest';

/**
 * Where everything stands on the terrace, in the panorama's own pixels (3840×1440).
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

/** Everyone at the party, who rise together when the page loads. */
export const CAST = ['girlDog', 'auntie', 'hug', 'singalong', 'dad', 'cake'];

/** Who arrives later, only for their own scene: never in the opening frame. */
export const LATE = ['ayla', 'easel', 'dareCrew', 'morning'];

export const FIGURES: FigureDef[] = [
  { id: 'girlDog', frames: ['girl-dog'], x: 500, y: 1340, h: 300 },
  { id: 'auntie', frames: ['shooter-auntie'], x: 850, y: 1410, h: 510, lens: [0.7, 0.28] },
  { id: 'hug', frames: ['hug'], x: 1260, y: 1290, h: 480 },
  { id: 'ayla', frames: ['ayla-scan', 'ayla-walk-a', 'ayla-walk-b', 'ayla-shoot'], x: 1900, y: 1215, h: 480, lens: [0.62, 0.1] },
  { id: 'singalong', frames: ['singalong'], x: 2620, y: 1130, h: 380 },
  { id: 'dad', frames: ['dad-a', 'dad-b'], x: 3010, y: 1190, h: 500, flip: true },
  { id: 'cake', frames: ['cake'], x: 3610, y: 1310, h: 530 },
  { id: 'easel', frames: ['easel'], x: 1540, y: 1345, h: 650 },
  { id: 'dareCrew', frames: ['dare-crew'], x: 1420, y: 1435, h: 680, lens: [0.5, 0.2] },
  { id: 'morning', frames: ['morning-after'], x: 1640, y: 1340, h: 520 },
];

export const figure = (id: string) => FIGURES.find((f) => f.id === id)!;

export function figureSize(def: FigureDef): { w: number; h: number } {
  const size = ART_SIZES[def.frames[0]] ?? { w: 2, h: 3 };
  return { w: (def.h * size.w) / size.h, h: def.h };
}

/** The sign that lights up on Table 7, laid over the tablecloth in the drawing. */
export const TABLE7 = { x: 1710, y: 950 };

export const PLACES = {
  entrance: { x: 300, y: 900 },
  welcomeTable: { x: 200, y: 900 },
  table7: TABLE7,
  aylaStart: { x: 1500, y: 1400 },
  aylaSeat: { x: 1900, y: 1215 },
};

/** The sun's box, behind the cypress trees, and how far it drops to set. */
export const SUN = { x: 2200, y: 70, d: 720 };
export const SUN_DOWN = 1000;
/** Where the sun's centre comes back up the next morning, on the other side. */
export const DAWN_X = { wide: 420, narrow: 2000 };

/** Festoon spans: each wire hangs between the terrace's stone piers. */
export const FESTOON: { x0: number; y0: number; x1: number; y1: number; sag: number }[] = [
  { x0: -40, y0: 470, x1: 816, y1: 470, sag: 100 },
  { x0: 816, y0: 470, x1: 1810, y1: 470, sag: 120 },
  { x0: 1810, y0: 470, x1: 2640, y1: 470, sag: 110 },
  { x0: 2640, y0: 470, x1: 3780, y1: 470, sag: 130 },
  { x0: 3780, y0: 470, x1: 3880, y1: 470, sag: 16 },
];
