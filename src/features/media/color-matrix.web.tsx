import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type Matrix = readonly number[];

/**
 * The web stand-in for the native colour-matrix filter.
 *
 * Every matrix the app actually uses is full-strength Rec.709 grayscale (see
 * `TREATMENT_VISUALS`), and the browser has that natively as a CSS filter —
 * so rather than reimplement matrix multiplication in JS for one value, this
 * maps to `grayscale(1)`. React Native Web forwards unrecognised style keys
 * straight to CSS, which is what makes `filter` reach the element at all.
 *
 * A matrix of `null` means "no treatment", and passes through untouched.
 */
export function ColorMatrix({
  matrix,
  style,
  children,
}: {
  matrix?: Matrix | null;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[style, matrix ? ({ filter: 'grayscale(1)' } as ViewStyle) : null]}>
      {children}
    </View>
  );
}
