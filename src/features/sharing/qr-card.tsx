import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '@/components/ui/text';
import { BrandLogo } from '@/components/brand/brand-logo';
import { colours, layout, radii, spacing } from '@/design';

export interface QrCardProps {
  /** The full guest link. Contains the access token. */
  value: string;
  eventName: string;
  supportingLine?: string;
  size?: number;
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
export function QrCard({ value, eventName, supportingLine, size = 200 }: QrCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`QR code for ${eventName}`}
      style={{
        alignItems: 'center',
        gap: spacing.base,
        padding: spacing.xl,
        borderRadius: radii.xl,
        backgroundColor: colours.brandPrimary,
        borderWidth: layout.hairline,
        borderColor: colours.borderStrong,
      }}
    >
      <BrandLogo height={22} />

      <View
        style={{
          padding: spacing.md,
          borderRadius: radii.md,
          backgroundColor: '#FFFFFF',
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

      <View style={{ alignItems: 'center', gap: spacing.xxs }}>
        <AppText
          variant="titleMedium"
          align="center"
          numberOfLines={2}
          style={{ color: colours.textOnBrand }}
        >
          {eventName}
        </AppText>
        <AppText
          variant="caption"
          align="center"
          style={{ color: colours.textOnBrand, opacity: 0.7 }}
        >
          {supportingLine ?? 'Scan to add your photos'}
        </AppText>
      </View>
    </View>
  );
}
