import { useId } from 'react';
import { Animated, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** The top corners of a sheet made of this glass. */
export const EVENT_GLASS_RADIUS = 32;

/**
 * A real backdrop blur, so the card shows whatever is genuinely behind it: the
 * cover near its top edge, black further down. A moderate blur, so the
 * photograph keeps a little of its shape, under a heavy wash that pulls the
 * material well towards the page's black so the type holds on a bright
 * cover. The plain `dark` style rather than a system material: the materials
 * lay a grey film over the backdrop, which read as a grey cast on the card.
 * A short ramp at the foot lands on exactly `colours.background`, which is
 * what the tabs and gallery below are drawn on, so the glass fades into them
 * rather than stopping on a hard edge. It is kept to the bottom of the card so
 * the title area stays clear glass.
 */
const BLUR_INTENSITY = 10;
const WASH = 'rgba(11, 11, 12, 0.7)';
const FOOT = ['rgba(11, 11, 12, 0)', 'rgba(11, 11, 12, 1)'] as const;
/** Where, down the card, the foot ramp starts. */
const FOOT_START = 0.7;
/**
 * Neutral specular reflections, strongest at the shoulders and softer across
 * the face. The wider low-opacity stroke gives the hairline a refracted inner
 * edge. Both sit under the foot ramp so the pane dissolves into the gallery.
 */
const EDGE = '#F0F2F5';
const RIM_STOPS = [
  ['0', EDGE, 0.12],
  ['0.07', '#D6E8FF', 0.65],
  ['0.13', '#FFFFFF', 0.95],
  ['0.24', EDGE, 0.18],
  ['0.44', EDGE, 0.04],
  ['0.64', '#D6E8FF', 0.25],
  ['0.74', '#FFFFFF', 0.85],
  ['0.83', EDGE, 0.14],
  ['0.95', '#E1EDFF', 0.62],
  ['1', EDGE, 0.12],
] as const;
/**
 * Whether this binary can draw the glass at all.
 *
 * `expo-blur` is native, and the runtime version follows the app version, so
 * an update carrying this screen can land on a build that predates it — as
 * can a dev client that has not been rebuilt. Rendering `BlurView` there is a
 * red screen, not a missing effect. Without it the card falls back to
 * `FALLBACK_FILL`: no blur, but the same dark sheet. Web draws the blur in CSS
 * and needs no native module.
 */
const CAN_BLUR = Platform.OS === 'web' || requireOptionalNativeModule('ExpoBlur') != null;
const FALLBACK_FILL = 'rgba(28, 28, 30, 0.72)';
/**
 * iOS 26's own material, which warps the cover at its rim. Lighter than `WASH`, so
 * that warping shows, but still enough to hold the type on a bright cover.
 */
const HAS_LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
const LIQUID_GLASS_WASH = 'rgba(11, 11, 12, 0.35)';
/**
 * Solid sooner than the plain glass's ramp. The system draws a rim round every
 * corner of the pane and refracts the edge of the cover into a visible line, both
 * in the lower part of the card, so this has to land before either of them.
 */
const LIQUID_GLASS_FOOT = [0.3, 0.64] as const;

export interface EventGlassProps {
  /** Dissolves the pane, for a screen taking the sheet away. */
  isLeaving?: boolean;
  leaveDurationMs?: number;
  /** What the rest of the sheet is fading on, which the tint over the glass follows. */
  leaveOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
}

/**
 * The glass behind the event page's content card, and anything else that should
 * read as the same sheet. Fills its parent, which sets the top corners to
 * `EVENT_GLASS_RADIUS`.
 *
 * Liquid Glass stops rendering under a parent whose opacity is animating, dropping
 * its warp at once, and does not render at all once that has reached zero. So never
 * fade a parent of this. To bring it in, draw a mask over it, as the creation reveal
 * does. To take it away, use the props above, which dissolve it natively.
 */
export function EventGlass({ isLeaving = false, leaveDurationMs, leaveOpacity }: EventGlassProps) {
  const { width } = useWindowDimensions();
  const id = useId().replace(/:/g, '');
  const radius = EVENT_GLASS_RADIUS;

  if (HAS_LIQUID_GLASS) {
    return (
      <View pointerEvents="none" style={S.glass}>
        <GlassView
          glassEffectStyle={
            isLeaving
              ? {
                  style: 'none',
                  animate: true,
                  animationDuration: leaveDurationMs ? leaveDurationMs / 1000 : undefined,
                }
              : 'clear'
          }
          colorScheme="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        <Animated.View style={[StyleSheet.absoluteFill, leaveOpacity ? { opacity: leaveOpacity } : null]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: LIQUID_GLASS_WASH }]} />
          <LinearGradient
            colors={FOOT}
            locations={LIQUID_GLASS_FOOT}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[S.glass, leaveOpacity ? { opacity: leaveOpacity } : null]}
    >
      {CAN_BLUR ? (
        <BlurView intensity={BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: FALLBACK_FILL }]} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WASH }]} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width} y2={0}>
            {RIM_STOPS.map(([offset, color, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
            ))}
          </SvgLinearGradient>
          {/* SVG on web needs r + a transform; rx/ry are native-only.
              An implicit browser radius spills tint to the rectangle's edge. */}
          <SvgRadialGradient id={`${id}-left`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${width * 0.13} 2) scale(65 24)`}>
            <Stop offset="0" stopColor="#E1EDFF" stopOpacity={0.22} />
            <Stop offset="0.35" stopColor="#D6E8FF" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#D6E8FF" stopOpacity={0} />
          </SvgRadialGradient>
          <SvgRadialGradient id={`${id}-right`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${width * 0.74} 0) scale(48 18)`}>
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="0.4" stopColor="#E1EDFF" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#E1EDFF" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect width="100%" height={60} fill={`url(#${id}-left)`} />
        <Rect width="100%" height={60} fill={`url(#${id}-right)`} />
        <Path
          d={`M1.5 1000 V${radius} A${radius - 1.5} ${radius - 1.5} 0 0 1 ${radius} 1.5 H${width - radius} A${radius - 1.5} ${radius - 1.5} 0 0 1 ${width - 1.5} ${radius} V1000`}
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth={2}
          opacity={0.24}
        />
        <Path
          d={`M0.5 1000 V${radius} A${radius - 0.5} ${radius - 0.5} 0 0 1 ${radius} 0.5 H${width - radius} A${radius - 0.5} ${radius - 0.5} 0 0 1 ${width - 0.5} ${radius} V1000`}
          fill="none"
          stroke={`url(#${id}-rim)`}
          strokeWidth={1}
        />
      </Svg>
      <LinearGradient colors={FOOT} locations={[FOOT_START, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const S = StyleSheet.create({
  /** Clipped here: `BlurView` ignores `borderRadius` on its own. */
  glass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: EVENT_GLASS_RADIUS,
    borderTopRightRadius: EVENT_GLASS_RADIUS,
    overflow: 'hidden',
  },
});
