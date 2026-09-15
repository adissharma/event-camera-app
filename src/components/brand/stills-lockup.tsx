import { Image, StyleSheet, View } from 'react-native';

const LOCKUP = require('../../../assets/brand/logo-lockup.png');

/**
 * The supplied logo: the wordmark with the gradient mark as its full stop.
 *
 * A single artwork file rather than type plus an image. It was previously
 * composed from Newsreader and the mark, which kept it in step with the brand
 * automatically — but the drawn logo is not simply the typeface, and the
 * supplied file is the authority on what the logo is.
 *
 * The artwork is white on transparency, so it needs a dark ground. Every
 * surface it is used on is the app's near-black canvas.
 */
const ASPECT = 1974 / 797;

/**
 * The artwork carries transparent padding, and its drawn width is 91.3% of the
 * file's. The `size` prop stays the wordmark's type size — the same unit the
 * composed version used — so existing call sites keep their proportions, and
 * this converts it into the width the file has to be drawn at to match.
 */
const WIDTH_PER_TYPE_SIZE = 2.54;

export function StillsLockup({ size = 72 }: { size?: number }) {
  const width = size * WIDTH_PER_TYPE_SIZE;

  return (
    <View accessibilityRole="image" accessibilityLabel="Stills.">
      <Image
        source={LOCKUP}
        style={[S.logo, { width, height: width / ASPECT }]}
        resizeMode="contain"
      />
    </View>
  );
}

const S = StyleSheet.create({
  logo: {
    // The file is a fixed raster, so nothing here may stretch it.
    alignSelf: 'center',
  },
});
