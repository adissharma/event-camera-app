import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colours, radii } from '@/design';

export interface DeviceFrameProps {
  children: ReactNode;
  /** Frame width in points. Height follows a 19.5:9 phone ratio. */
  width?: number;
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
  const height = width * (19.5 / 9);
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

      {/* Notch. Enough to read as a phone, not enough to imitate a specific one. */}
      <View
        style={{
          position: 'absolute',
          top: bezel + 6,
          alignSelf: 'center',
          width: width * 0.3,
          height: 18,
          borderRadius: radii.pill,
          backgroundColor: colours.surfaceRaised,
        }}
      />
    </View>
  );
}
