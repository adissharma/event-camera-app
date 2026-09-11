import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ColorMatrix, type Matrix as NativeMatrix } from 'react-native-color-matrix-image-filters';
import * as Haptics from 'expo-haptics';

import { DisposablePhoto } from '@/components/media/disposable-photo';
import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';
import {
  PHOTO_TREATMENT_OPTIONS,
  TREATMENT_VISUALS,
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
const SWATCH_SOURCE = require('../../../../assets/sample-event/01.jpg');

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
        The ring sits outside the image rather than on it, so selecting does
        not crop the photograph — and the gap is what makes the ring read as
        a ring rather than as a border the picture happens to have.
      */}
      <View style={[S.ring, selected ? S.ringSelected : S.ringIdle]}>
        <View style={S.clip}>
          <TreatedSwatchImage treatment={treatment} />
        </View>
      </View>

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
    return (
      <ColorMatrix
        matrix={TREATMENT_VISUALS.black_and_white.colorMatrix as unknown as NativeMatrix}
        style={S.image}
      >
        <Image source={SWATCH_SOURCE} style={S.image} resizeMode="cover" />
      </ColorMatrix>
    );
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
    padding: 3,
  },
  ringSelected: {
    borderWidth: 2,
    borderColor: colours.textPrimary,
  },
  /** A transparent border of the same width, so nothing shifts on selection. */
  ringIdle: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  clip: {
    flex: 1,
    borderRadius: SWATCH_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
