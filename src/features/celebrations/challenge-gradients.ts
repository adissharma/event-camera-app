/** The colours of the event page's Guestbook and Challenge tiles, in tile order. */
export const CHALLENGE_GRADIENTS = [
  ['#1A0A42', '#5A2FC7', '#FF6A55'],
  ['#082B74', '#2860C8', '#E53C96'],
  ['#230A4F', '#5A21A8', '#D03B85'],
  ['#8C184E', '#8C1EC1', '#351674'],
  ['#0B4D65', '#293F9D', '#7421B8'],
  ['#C53B5C', '#9621C7', '#F67B3D'],
] as const;

/** The Guestbook is always the first tile. */
export const GUESTBOOK_GRADIENT = CHALLENGE_GRADIENTS[0];
