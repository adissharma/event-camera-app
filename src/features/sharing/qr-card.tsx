import { useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { radii, spacing } from '@/design';

export interface QrCardProps {
  /** The full guest link. Contains the access token. */
  value: string;
  eventName: string;
  size?: number;
  footer?: ReactNode;
}

function WebQrImage({ value, size }: { value: string; size: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const qrcode = require('qrcode');
        const nextDataUrl = await qrcode.toDataURL(value, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: size,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });

        if (!cancelled) {
          setDataUrl(nextDataUrl);
        }
      } catch (error) {
        console.error('[qr-card] failed to generate web QR code', error);
        if (!cancelled) {
          setDataUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!dataUrl) {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
        }}
      />
    );
  }

  return (
    <Image
      source={{ uri: dataUrl }}
      style={{ width: size, height: size, borderRadius: 12 }}
      resizeMode="cover"
    />
  );
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
  const isWeb = Platform.OS === 'web';

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
        {isWeb ? (
          <WebQrImage value={value} size={size} />
        ) : (
          <QRCode
            value={value}
            size={size}
            // Explicit pure black on pure white. This is the one place in the app
            // that ignores the palette — a scanner is not an audience.
            color="#000000"
            backgroundColor="#FFFFFF"
            ecl="M"
          />
        )}
      </View>

      {footer ? <View style={{ width: '100%' }}>{footer}</View> : null}
    </View>
  );
}
