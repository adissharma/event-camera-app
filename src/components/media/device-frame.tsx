import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colours, radii } from '@/design';

export interface DeviceFrameProps {
  children: ReactNode;
  /** Frame width in points. Height follows a 19.5:9 phone ratio. */
  width?: number;
}

export const DEVICE_ASPECT_RATIO = 19.5 / 9;

/**
 * The creation flow needs the phone to keep the same physical dimensions even
 * though it is mounted above several different routes. Deriving that width
 * from the viewport (rather than from each screen's remaining layout space)
 * gives the carousel and the persistent stage one shared answer.
 */
export function canonicalDeviceWidth(viewportWidth: number, viewportHeight: number) {
  return Math.max(176, Math.min(viewportWidth * 0.62, viewportHeight * 0.29));
}

/**
 * A phone frame for the guest preview.
 *
 * The point of this device, borrowed as a principle from the Once audit, is
 * that it makes configuration tangible — the host is not reading a description
 * of what guests will see, they are looking at it. It is the single most
 * effective thing on the cover step.
 *
 * Deliberately understated: a thin bezel and a notch, no glossy chrome, no
 * drop shadow theatre. The content inside is the subject.
 */
export function DeviceFrame({ children, width = 240 }: DeviceFrameProps) {
  const height = width * DEVICE_ASPECT_RATIO;
  const bezel = 6;

  return (
    <View
      accessible={false}
      style={{
        width,
        height,
        borderRadius: radii.device,
        padding: bezel,
        backgroundColor: colours.surfaceRaised,
        borderWidth: 1,
        borderColor: colours.borderStrong,
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: radii.device - bezel,
          overflow: 'hidden',
          backgroundColor: colours.background,
        }}
      >
        {children}
      </View>
    </View>
  );
}
