import { useCallback } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { LockIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, easing, fontFamilies, layout, radii, spacing, useMotion } from '@/design';
import { LinearGradient } from 'expo-linear-gradient';

const PREVIEW_IMAGES = [
  require('../../../../assets/sample-event/05.jpg'),
  require('../../../../assets/sample-event/06.jpg'),
  require('../../../../assets/sample-event/01.jpg'),
  require('../../../../assets/sample-event/02.jpg'),
] as const;

/**
 * The same four frames, desaturated ahead of time.
 *
 * Not a runtime filter: React Native gates `filter: [{ grayscale }]` on iOS
 * behind `enableSwiftUIBasedFilters`, which is off by default, so the style
 * is accepted and silently does nothing. These are bundled assets and there
 * are four of them, so converting them once at build time is both certain to
 * work and free at render.
 */
const PREVIEW_IMAGES_MONO = [
  require('../../../../assets/sample-event/mono/05.jpg'),
  require('../../../../assets/sample-event/mono/06.jpg'),
  require('../../../../assets/sample-event/mono/01.jpg'),
  require('../../../../assets/sample-event/mono/02.jpg'),
] as const;

const PREVIEW_MAX_WIDTH = 340;
const PREVIEW_GAP = 6;
/**
 * How much of the second row sits below the fold.
 *
 * Enough that it reads as a gallery continuing past the frame rather than as
 * two rows that happen to be clipped — a sliver looks like a rendering
 * mistake, a third of a tile looks like scroll.
 */
const SECOND_ROW_PEEK = 64;
/**
 * How far the collage drifts, and back.
 *
 * It used to travel 32pt upward and stay there, which parked the first row
 * under the top fade — the thing the fade was for while it moved became a
 * permanent crop once it stopped. Now it only breathes: a few points down and
 * back, forever, with the frame tall enough that the top of the first row is
 * never cut at either extreme.
 */
const JIGGLE_TRAVEL = 6;
/** One full down-and-back. */
const JIGGLE_CYCLE_MS = 2500;
const PREVIEW_AUTHORS = ['James', 'Sophia', 'Liam', 'Olivia'] as const;

export function RevealPreview({
  locked,
}: {
  locked: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const previewWidth = Math.min(PREVIEW_MAX_WIDTH, screenWidth - layout.gutter * 2);
  const cellWidth = (previewWidth - PREVIEW_GAP) / 2;
  const cellHeight = cellWidth * 1.25;
  const motion = useMotion();
  const galleryScroll = useSharedValue(0);
  const scrollDelay = motion.reduceMotion ? 0 : 320;

  useFocusEffect(
    useCallback(() => {
      galleryScroll.set(0);

      // Nothing moves under reduce-motion: this is decoration, and it is the
      // kind of continuous drift that reads as motion sickness to someone who
      // asked for less of it.
      if (motion.reduceMotion) return;

      galleryScroll.set(
        withDelay(
          scrollDelay,
          withRepeat(
            withTiming(-JIGGLE_TRAVEL, {
              duration: JIGGLE_CYCLE_MS / 2,
              easing: easing.inOut,
            }),
            -1,
            true,
          ),
        ),
      );

      return () => {
        cancelAnimation(galleryScroll);
        galleryScroll.set(0);
      };
    }, [galleryScroll, motion.reduceMotion, scrollDelay]),
  );

  const galleryScrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: galleryScroll.get() }],
  }));

  return (
    <View style={styles.previewContainer}>
      <View
        style={[
          styles.galleryPreview,
          {
            width: previewWidth,
            height: cellHeight + PREVIEW_GAP + SECOND_ROW_PEEK + JIGGLE_TRAVEL,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.photoGrid,
            { width: previewWidth, paddingTop: JIGGLE_TRAVEL },
            galleryScrollStyle,
          ]}
        >
          {(locked ? PREVIEW_IMAGES_MONO : PREVIEW_IMAGES).map((imgSrc, index) => (
            <View
              key={index}
              style={[
                styles.photoTile,
                { width: cellWidth, height: cellHeight },
              ]}
            >
              <Image
                source={imgSrc}
                style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
                resizeMode="cover"
                blurRadius={locked ? 20 : 0}
              />

              {locked ? (
                <View style={styles.lockOverlay}>
                  <View style={styles.lockCircle}>
                    <LockIcon size={18} color="#FFFFFF" />
                  </View>
                </View>
              ) : null}

              {!locked ? (
                <View style={[styles.photoNameTag, { maxWidth: Math.max(0, cellWidth - 24) }]}>
                  <AppText style={styles.photoNameText} numberOfLines={1} ellipsizeMode="tail">
                    {PREVIEW_AUTHORS[index]}
                  </AppText>
                </View>
              ) : null}
            </View>
          ))}
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(11,11,12,0)', colours.background, colours.background]}
          locations={[0, 0.55, 1]}
          style={styles.bottomFade}
        />
      </View>
    </View>
  );
}

export function ChoiceTile({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceTile,
        selected ? styles.choiceTileSelected : null,
        pressed ? { opacity: 0.92 } : null,
      ]}
    >
      <AppText variant="label" tone={selected ? 'onBrand' : 'secondary'} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

export function PickerModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalScrim} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.modalDoneBtn}>
              <AppText variant="labelLarge" style={styles.modalDoneText}>
                Done
              </AppText>
            </Pressable>
          </View>
          <View style={styles.modalBody}>{children}</View>
        </View>
      </Pressable>
    </Modal>
  );
}

export const revealSharedStyles = StyleSheet.create({
  selectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 48,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectorText: {
    color: colours.textPrimary,
  },
});

const styles = StyleSheet.create({
  previewContainer: {
    alignItems: 'center',
    gap: spacing.md,
    // No margin: the step centres the collage and toggle as one block, so
    // spacing between them is the group's gap, not this component's.
    marginVertical: 0,
  },
  galleryPreview: {
    position: 'relative',
    overflow: 'hidden',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PREVIEW_GAP,
    alignContent: 'flex-start',
  },
  photoTile: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colours.surface,
  },
  photoNameTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(11, 11, 12, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoNameText: {
    fontFamily: fontFamilies.display,
    fontSize: 13,
    color: '#EFE9E0',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  lockCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SECOND_ROW_PEEK + spacing.xl,
  },
  choiceTile: {
    flex: 1,
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  choiceTileSelected: {
    backgroundColor: colours.brandPrimary,
    borderWidth: 0,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.base,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colours.borderSubtle,
  },
  modalDoneBtn: {
    paddingHorizontal: spacing.sm,
  },
  modalDoneText: {
    color: colours.brandPrimary,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.base,
    alignItems: 'center',
  },
});
