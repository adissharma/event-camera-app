import { useCallback, useEffect, useRef, useState } from 'react';
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
  const initialValue = typeof value === 'number'
    ? Math.min(value, Math.max(0, Math.floor(rollFrom)))
    : value;
  const displayedValueRef = useRef<number | '∞'>(initialValue);
  const [displayedValue, setDisplayedValue] = useState<number | '∞'>(initialValue);
  const setCounterValue = useCallback((next: number | '∞') => {
    displayedValueRef.current = next;
    setDisplayedValue(next);
  }, []);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (typeof value !== 'number') {
      setCounterValue(value);
      return;
    }

    const shouldRoll = animateChanges || !hasAnimated.current;
    hasAnimated.current = true;

    if (!shouldRoll || motion.reduceMotion || value <= 0) {
      setCounterValue(value);
      if (haptics && shouldRoll) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      return;
    }

    const previousValue = displayedValueRef.current;
    // Keep the demo continuous as its limit changes. The unlimited state has
    // no finite number to roll from, so a newly selected finite limit begins
    // at the supplied baseline instead.
    const startingValue = typeof previousValue === 'number'
      ? previousValue
      : Math.max(0, Math.floor(rollFrom));
    setCounterValue(startingValue);

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
    const direction = startingValue < value ? 1 : -1;
    const interval = Math.max(20, Math.min(60, Math.floor(700 / Math.abs(value - startingValue))));

    const tick = () => {
      current += direction;
      setCounterValue(current);

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
  }, [animateChanges, haptics, motion.reduceMotion, rollDelayMs, rollFrom, setCounterValue, value]);

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
  },
});
