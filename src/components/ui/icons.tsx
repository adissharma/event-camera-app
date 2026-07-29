import Svg, { Path } from 'react-native-svg';

import { colours } from '@/design';

export interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Pencil.
 *
 * Drawn rather than pulled from an icon font or emoji: `✏️` renders as a
 * full-colour emoji that ignores the palette and looks like a sticker on a
 * near-black card, and its size varies by platform. A path scales cleanly and
 * takes the theme colour.
 */
export function PencilIcon({ size = 14, color = colours.textPrimary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20h4L19.5 8.5a2.121 2.121 0 0 0-3-3L5 17v3z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.5 6.5l3 3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 16, color = colours.textSecondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
