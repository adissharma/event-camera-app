import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { fontFamilies, useMotion } from '@/design';

export const VIEWFINDER_PILL_HEIGHT = 36;
export const VIEWFINDER_PILL_RADIUS = VIEWFINDER_PILL_HEIGHT / 2;
export const VIEWFINDER_PILL_PADDING = 3;
export const VIEWFINDER_PILL_INSET = 20;

const COUNT_FONT_SIZE = 22;

/**
 * Optical centring correction for the digits, as a fraction of font size.
 *
 * Flex centring centres a text node's LINE BOX, not the ink inside it, and
 * for this face those are not the same thing. Measured from the font itself
 * at 22px (Newsreader, via canvas TextMetrics):
 *
 *   font box    ascent 16.00   descent 6.00   (asymmetric: descender space)
 *   digit ink   ascent 15.09   descent  0.22   (lining figures — no descender)
 *
 * The line box reserves six pixels of depth for descenders that digits never
 * use, so the ink sits high by
 *
 *   (fontAscent - fontDescent) / 2 - (inkAscent - inkDescent) / 2
 *     = 5.00 - 7.435 = -2.435px
 *
 * which is 2.435 / 22 of the font size. Two properties of that derivation
 * matter: it does not involve `lineHeight` (which cancels out — no line
 * height can fix this), and it does not involve the value. '1', '8', '16'
 * and '100' all measure the same ascent and descent, so one digit centres
 * exactly like three.
 *
 * Expressed as a ratio rather than a pixel constant so it tracks the font
 * size, and applied as a transform rather than padding so the pill's own
 * geometry is untouched.
 */
const DIGIT_OPTICAL_CENTRING_RATIO = 2.435 / 22;

export interface ViewfinderShotCounterProps {
  value: number | '∞';
  /** The camera rolls only on first mount; the creation demo rolls per choice. */
  animateChanges?: boolean;
  haptics?: boolean;
  rollFrom?: number;
  rollDelayMs?: number;
  style?: StyleProp<ViewStyle>;
}

/** The real viewfinder's remaining-shots pill and drum-roll behaviour. */
export function ViewfinderShotCounter({
  value,
  animateChanges = false,
  haptics = true,
  rollFrom = 0,
  rollDelayMs = 300,
  style,
}: ViewfinderShotCounterProps) {
  const motion = useMotion();
  const hasAnimated = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [displayedValue, setDisplayedValue] = useState<number | '∞'>(
    typeof value === 'number' ? Math.min(value, Math.max(0, Math.floor(rollFrom))) : value,
  );

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (typeof value !== 'number') {
      setDisplayedValue(value);
      return;
    }

    const shouldRoll = animateChanges || !hasAnimated.current;
    hasAnimated.current = true;

    if (!shouldRoll || motion.reduceMotion || value <= 0) {
      setDisplayedValue(value);
      if (haptics && shouldRoll) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      return;
    }

    const startingValue = Math.min(value, Math.max(0, Math.floor(rollFrom)));
    setDisplayedValue(startingValue);

    if (startingValue === value) {
      if (haptics) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      return;
    }

    if (haptics && startingValue > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    let current = startingValue;
    const interval = Math.max(20, Math.min(60, Math.floor(700 / value)));

    const tick = () => {
      current += 1;
      setDisplayedValue(current);

      if (current === value) {
        if (haptics) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
        return;
      }

      if (haptics) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      timers.current.push(setTimeout(tick, interval));
    };

    timers.current.push(setTimeout(tick, rollDelayMs > 0 ? rollDelayMs : interval));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [animateChanges, haptics, motion.reduceMotion, rollDelayMs, rollFrom, value]);

  return (
    <View
      style={[S.tag, style]}
      accessibilityLabel={value === '∞' ? 'No capture limit' : `${value} captures remaining`}
    >
      <AppText style={S.count} accessibilityLiveRegion="polite">
        {displayedValue}
      </AppText>
    </View>
  );
}

const S = StyleSheet.create({
  tag: {
    position: 'absolute',
    bottom: VIEWFINDER_PILL_INSET,
    left: VIEWFINDER_PILL_INSET,
    height: VIEWFINDER_PILL_HEIGHT,
    minWidth: VIEWFINDER_PILL_HEIGHT,
    borderRadius: VIEWFINDER_PILL_RADIUS,
    paddingHorizontal: VIEWFINDER_PILL_PADDING + 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.65)',
    zIndex: 20,
  },
  count: {
    fontFamily: fontFamilies.display,
    fontSize: COUNT_FONT_SIZE,
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    // Android adds its own font padding on top of the line box, which
    // compounds the asymmetry above; turning it off makes native Android
    // measure the way web and iOS already do. No-op elsewhere.
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: COUNT_FONT_SIZE * DIGIT_OPTICAL_CENTRING_RATIO }],
  },
});
