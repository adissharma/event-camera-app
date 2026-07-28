import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { REDUCED_MOTION_DURATION, duration, spring } from './motion';

/**
 * Resolves motion tokens against the OS reduce-motion setting.
 *
 * When reduce-motion is on we do not remove the animation — removing it loses
 * the meaning the motion was carrying (what changed, and why). Instead every
 * duration collapses to a single brief fade and springs become non-oscillating,
 * so cause and effect survive without movement.
 */
export function useMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        // Treat an unavailable accessibility API as "no preference expressed".
        if (!cancelled) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return useMemo(
    () => ({
      reduceMotion,

      /** Resolve a duration token to milliseconds, honouring reduce-motion. */
      duration(token: keyof typeof duration): number {
        return reduceMotion ? REDUCED_MOTION_DURATION : duration[token];
      },

      /** Resolve a spring config; becomes critically damped under reduce-motion. */
      spring(token: keyof typeof spring) {
        return reduceMotion
          ? { damping: 100, stiffness: 300, mass: 1 }
          : spring[token];
      },

      /** Translation distance in points; collapses to zero under reduce-motion. */
      translate(points: number): number {
        return reduceMotion ? 0 : points;
      },

      /** Stagger delay for item `index`; no stagger under reduce-motion. */
      staggerDelay(index: number, step = 45): number {
        return reduceMotion ? 0 : index * step;
      },
    }),
    [reduceMotion],
  );
}
