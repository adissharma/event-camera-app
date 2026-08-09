import { type ReactNode } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { radii, spacing } from '@/design';

export interface QrCardProps {
  /** The full guest link. Contains the access token. */
  value: string;
  eventName: string;
  size?: number;
  footer?: ReactNode;
}

/**
 * The printable / shareable QR card.
 *
 * Rendered light-on-dark inverted: the code itself sits on a pale panel because
 * scanners need a light quiet zone and high contrast. A dark-on-dark QR looks
 * beautiful in a mockup and fails at the venue door, which is the one place it
 * absolutely must work.
 *
 * Error correction is set to M rather than L so the code still scans when the
 * card is printed small, creased, or read across a dim room.
 */
export function QrCard({ value, eventName, size = 216, footer }: QrCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`QR code for ${eventName}`}
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        width: '100%',
      }}
    >
      <View
        style={{
          padding: spacing.md,
          borderRadius: radii.xl,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000000',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <QRCode
          value={value}
          size={size}
          // Explicit pure black on pure white. This is the one place in the app
          // that ignores the palette — a scanner is not an audience.
          color="#000000"
          backgroundColor="#FFFFFF"
          ecl="M"
        />
      </View>

      {footer ? <View style={{ width: '100%' }}>{footer}</View> : null}
    </View>
  );
}
