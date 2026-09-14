import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies } from '@/design';

const MARK = require('../../../assets/brand/mark.png');

/**
 * The wordmark: "Stills" in the display serif, with the gradient mark standing
 * in for the full stop.
 *
 * Composed rather than shipped as one flat image. The name is already set in
 * Newsreader everywhere else in the product, so drawing it as text keeps the
 * lockup in step with the rest of the brand automatically, stays crisp at any
 * size and on any display, and reads as "Stills." to a screen reader rather
 * than as an unlabelled picture.
 *
 * The mark's size and position are expressed as fractions of the type size, so
 * the lockup holds together wherever it is used.
 */
export function StillsLockup({
  size = 72,
  color = colours.textPrimary,
}: {
  /** Type size of the wordmark, in points. The mark scales from it. */
  size?: number;
  color?: string;
}) {
  // Proportions taken from the supplied logo: the mark is about 9.4% of the
  // wordmark's width, which at Newsreader's metrics is 0.197 of the type size.
  const markSize = size * 0.197;

  return (
    <View
      style={S.row}
      accessibilityRole="image"
      accessibilityLabel="Stills."
    >
      <AppText
        style={[
          S.word,
          {
            color,
            fontSize: size,
            lineHeight: size * 1.16,
            letterSpacing: size * -0.014,
          },
        ]}
      >
        Stills
      </AppText>
      <Image
        source={MARK}
        style={{
          width: markSize,
          height: markSize,
          // Sits on the baseline like the full stop it replaces. Newsreader's
          // ascent is 0.715 of the type size and its descent 0.010, so within a
          // 1.16 line box the baseline falls 0.227 above the box's bottom edge
          // — which is where the mark's own bottom has to land.
          marginLeft: size * 0.02,
          marginBottom: size * 0.227,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Baseline alignment would use the text's baseline, which React Native does
    // not expose for an image sibling; the mark is offset from the bottom edge
    // instead, which is stable across platforms.
    alignItems: 'flex-end',
  },
  word: {
    fontFamily: fontFamilies.display,
  },
});
