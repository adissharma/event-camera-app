import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import { AppText } from '@/components/ui/text';
import {
  colours,
  spacing,
  REVEAL_TRACK_GRADIENT,
  REVEAL_TRACK_GRADIENT_START,
  REVEAL_TRACK_GRADIENT_END,
} from '@/design';
import {
  PHOTO_TREATMENT_OPTIONS,
  type SupportedPhotoTreatment,
} from '@/features/media/photo-treatment';

/**
 * One frame, shown three ways.
 *
 * The same photograph in every circle, because the choice is the treatment
 * and nothing else — three different pictures would make it a comparison of
 * subjects instead. It is one of the collage's own frames, so the swatches
 * and the preview above them are visibly the same event.
 */
const SWATCH_SOURCE = require('../../../../assets/sample-event/07.jpg');
/** Pre-desaturated, for the reason the collage's mono set documents. */
const SWATCH_SOURCE_MONO = require('../../../../assets/sample-event/mono/07.jpg');

const SWATCH_SIZE = 92;

export function TreatmentSwatches({
  selected,
  onSelect,
}: {
  selected: SupportedPhotoTreatment;
  onSelect: (treatment: SupportedPhotoTreatment) => void;
}) {
  return (
    <View style={S.row}>
      {PHOTO_TREATMENT_OPTIONS.map((option) => (
        <Swatch
          key={option.value}
          treatment={option.value}
          label={option.label}
          selected={selected === option.value}
          onPress={() => {
            void Haptics.selectionAsync().catch(() => {});
            onSelect(option.value);
          }}
        />
      ))}
    </View>
  );
}

function Swatch({
  treatment,
  label,
  selected,
  onPress,
}: {
  treatment: SupportedPhotoTreatment;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [S.swatch, pressed && { opacity: 0.85 }]}
    >
      {/*
        The selection ring carries the accent gradient — the same stops, angle
        and 3pt width as the reveal toggle's track, so the one coloured thing
        on a dark screen always means "this is the choice you have made".

        It sits outside the image rather than on it, so selecting does not
        crop the photograph, and the gap is what makes it read as a ring
        rather than as a border the picture happens to have. The unselected
        state keeps the same footprint in a transparent ring, so nothing
        shifts when the selection moves.
      */}
      {selected ? (
        <LinearGradient
          colors={REVEAL_TRACK_GRADIENT}
          start={REVEAL_TRACK_GRADIENT_START}
          end={REVEAL_TRACK_GRADIENT_END}
          style={S.ring}
        >
          <View style={S.gap}>
            <View style={S.clip}>
              <TreatedSwatchImage treatment={treatment} />
            </View>
          </View>
        </LinearGradient>
      ) : (
        <View style={S.ring}>
          <View style={S.gap}>
            <View style={S.clip}>
              <TreatedSwatchImage treatment={treatment} />
            </View>
          </View>
        </View>
      )}

      <AppText
        variant="bodySmall"
        tone={selected ? undefined : 'secondary'}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * The same three renderers the large preview uses, at swatch size.
 *
 * Mounted one at a time here, unlike the preview: these never cross-fade, so
 * there is no decode flash to hide, and keeping three decoders alive per
 * circle for a row of three would be nine images for one choice.
 */
function TreatedSwatchImage({ treatment }: { treatment: SupportedPhotoTreatment }) {
  if (treatment === 'disposable') {
    return (
      <DisposablePhoto
        source={SWATCH_SOURCE}
        seedKey="treatment-swatch"
        dateStampEnabled
        style={S.image}
        resizeMode="cover"
      />
    );
  }

  if (treatment === 'black_and_white') {
    return <Image source={SWATCH_SOURCE_MONO} style={S.image} resizeMode="cover" />;
  }

  return <Image source={SWATCH_SOURCE} style={S.image} resizeMode="cover" />;
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  swatch: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ring: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    // The ring's width. Unselected this is empty space, which is what keeps
    // the image the same size in both states.
    padding: 3,
  },
  /**
   * The dark gap between the gradient and the photograph.
   *
   * Without it the ring bleeds into whatever the image happens to be doing at
   * its edge and stops reading as a ring — the same reason the Create button
   * puts black between its gradient and its face. Present unselected too, so
   * the photograph is the same size in both states.
   */
  gap: {
    flex: 1,
    borderRadius: SWATCH_SIZE / 2,
    backgroundColor: colours.background,
    padding: 3,
  },
  clip: {
    flex: 1,
    borderRadius: SWATCH_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colours.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
