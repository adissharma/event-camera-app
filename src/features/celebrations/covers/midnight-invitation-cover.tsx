import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { AppText } from '@/components/ui/text';
import { CameraIcon, ClockIcon, PersonIcon } from '@/components/ui/icons';
import { fontFamilies, layout, spacing } from '@/design';
import type { GuestJoinScreenProps } from '../join/guest-join-screen';

/**
 * "Midnight Invitation" — the dark luxury invite template.
 *
 * The event's own cover photograph does double duty: sharp inside a framed
 * hero, and again behind everything as a heavily blurred, darkened wash. That
 * is the whole idea — the page is built out of the event's image rather than
 * dropped onto a generic black backdrop, so every event's invite is tinted by
 * its own photograph without anyone choosing a colour.
 *
 * The blur is React Native's built-in `Image` `blurRadius`, which maps to a
 * native blur on iOS/Android and to a CSS `filter: blur()` under
 * react-native-web. No blur dependency is added for it.
 *
 * Props are `GuestJoinScreenProps` verbatim so this is a drop-in alternative
 * to the classic join layout — same data, same callbacks, same join
 * behaviour. It renders at true device size in every context; the creation
 * preview shrinks the whole tree with one transform rather than asking this
 * component to lay itself out small.
 */

/** Cream for type, champagne for accents. Local to this template's palette. */
const CREAM = '#F4ECE0';
const CREAM_DIM = 'rgba(244, 236, 224, 0.72)';
const GOLD = '#D9C39A';
const INK = '#0A0E1A';

/**
 * Blur strength. High enough that the background reads as an abstract wash of
 * colour rather than a recognisable second copy of the photograph.
 */
const BACKGROUND_BLUR = 48;

export function MidnightInvitationCover({
  coverSource,
  interactive = true,
  title,
  countdownLabel,
  shotsLeftLabel,
  accent: providedAccent,
  nameInputRef,
  name = '',
  onNameChange,
  showValidation = false,
  error,
  isNameValid = true,
  isJoining = false,
  onJoin,
  footer,
}: GuestJoinScreenProps) {
  const accent = providedAccent ?? GOLD;
  const disabled = !isNameValid || isJoining || !interactive;

  /**
   * Everything is sized from the box this actually renders into, measured on
   * layout — not from the viewport.
   *
   * The carousel mounts this inside a ~260pt device frame while the window is
   * far wider, so sizing from `useWindowDimensions` produced a hero wider than
   * its own card: the image bled past the edges and the name field was cut
   * off. Measuring the container instead makes the small card and the
   * full-screen takeover the same composition at two sizes, which is the whole
   * point of a preview.
   */
  const [boxWidth, setBoxWidth] = useState(0);
  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== boxWidth) setBoxWidth(next);
  };

  // 375 is the reference width the type scale was drawn against.
  const measured = boxWidth || 375;
  const scale = Math.min(1, measured / 375);
  const heroWidth = measured * 0.78;

  // The title is the loudest element, so it fills the measure and is allowed
  // to wrap rather than shrink — two balanced serif lines read as an
  // invitation, one shrunken line reads as a form label. Long titles step down
  // a size before they are permitted a third line.
  const titleSize = Math.round((title.length > 22 ? 40 : 52) * scale);

  return (
    <View onLayout={handleLayout} style={S.root}>
      {/* ── Background: the same photograph, blurred and darkened ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={coverSource}
          style={S.backgroundImage}
          resizeMode="cover"
          blurRadius={BACKGROUND_BLUR}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        {/* Flat darkening, so foreground type clears the photograph whatever
            it happens to contain. */}
        <View style={S.backgroundInk} />
        {/* Vignette — edges pulled down so the composition holds to the middle. */}
        <LinearGradient
          colors={['rgba(6,10,20,0.86)', 'rgba(6,10,20,0.10)', 'rgba(6,10,20,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[S.content, { paddingVertical: Math.round(spacing.xl * scale) }]}>
        {/* ── Hero ── */}
        {/* Square corners: the photograph is presented as a print, not as a
            rounded app tile. */}
        <View style={[S.heroFrame, { width: heroWidth }]}>
          <Image
            source={coverSource}
            style={S.heroImage}
            resizeMode="cover"
            accessibilityLabel={`Cover photograph for ${title}`}
          />
        </View>

        {/* ── Title ── */}
        <AppText
          align="center"
          numberOfLines={3}
          style={[
            S.title,
            {
              fontSize: titleSize,
              lineHeight: Math.round(titleSize * 1.1),
              marginTop: Math.round(spacing.xxl * scale),
              maxWidth: heroWidth,
            },
          ]}
        >
          {title}
        </AppText>

        {/* ── Metadata ── */}
        <View style={[S.metaRow, { marginTop: Math.round(spacing.base * scale) }]}>
          <MetaItem
            icon={<ClockIcon size={Math.max(9, Math.round(15 * scale))} color={accent} />}
            value={countdownLabel}
            label="Left"
            scale={scale}
          />
          <View style={[S.metaDivider, { backgroundColor: `${accent}55` }]} />
          <MetaItem
            icon={<CameraIcon size={Math.max(9, Math.round(15 * scale))} color={accent} />}
            value={shotsLeftLabel}
            label="Shots left"
            scale={scale}
          />
        </View>

        {/* Gold gleam — the quiet separator between invite and form. */}
        <LinearGradient
          colors={['transparent', `${accent}66`, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[S.gleam, { width: heroWidth * 0.6, marginTop: Math.round(spacing.lg * scale) }]}
        />

        {/* ── Form ── */}
        <View style={[S.form, { width: heroWidth, marginTop: Math.round(spacing.xl * scale) }]}>
          {footer ?? <>
          <View
              style={[
                S.inputWrap,
                {
                  height: Math.round(58 * scale),
                  borderRadius: Math.round(16 * scale),
                  borderColor: showValidation ? '#E8776D' : 'rgba(217,195,154,0.28)',
                },
              ]}
            >
              <PersonIcon size={Math.max(10, Math.round(18 * scale))} color={accent} />
              <TextInput
                ref={nameInputRef}
                value={name}
                onChangeText={onNameChange}
                placeholder="Your Name"
                placeholderTextColor="rgba(244,236,224,0.42)"
                maxLength={50}
                editable={interactive && !isJoining}
                style={[S.input, { fontSize: Math.round(17 * scale) }]}
                accessibilityLabel="Your name"
              />
            </View>

          {error || (showValidation && !isNameValid) ? (
            <AppText align="center" style={S.error} accessibilityLiveRegion="polite">
              {error ?? 'Add your name to join.'}
            </AppText>
          ) : null}

          <Pressable
              onPress={onJoin}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Join the event"
              accessibilityState={{ disabled, busy: isJoining }}
              style={({ pressed }) => [
                S.cta,
                {
                  height: Math.round(58 * scale),
                  borderRadius: Math.round(29 * scale),
                  backgroundColor: accent,
                  opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
                },
              ]}
            >
              {isJoining ? (
                <ActivityIndicator color={INK} />
              ) : (
                <AppText style={[S.ctaLabel, { fontSize: Math.round(15 * scale) }]}>
                  JOIN
                </AppText>
              )}
            </Pressable>
          </>}
        </View>
      </View>
    </View>
  );
}

function MetaItem({
  icon,
  value,
  label,
  scale,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  scale: number;
}) {
  return (
    <View style={S.metaItem}>
      {icon}
      <AppText style={[S.metaValue, { fontSize: Math.round(14 * scale) }]}>{value}</AppText>
      <AppText style={[S.metaLabel, { fontSize: Math.round(11 * scale) }]}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INK,
    overflow: 'hidden',
  },
  backgroundImage: {
    // Overscanned: a blur samples past its own edges, which otherwise leaves a
    // pale feathered border down each side of the screen.
    position: 'absolute',
    top: '-8%',
    left: '-8%',
    width: '116%',
    height: '116%',
  },
  backgroundInk: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 12, 24, 0.62)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  contentPreview: {
    paddingVertical: spacing.base,
  },
  heroFrame: {
    aspectRatio: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,236,224,0.16)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: fontFamilies.display,
    color: CREAM,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaValue: {
    fontFamily: fontFamilies.textMedium,
    color: CREAM,
  },
  metaLabel: {
    fontFamily: fontFamilies.textMedium,
    color: CREAM_DIM,
    letterSpacing: 1.1,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
  },
  gleam: {
    height: 1,
    alignSelf: 'center',
  },
  form: {
    gap: spacing.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: 'rgba(10, 14, 26, 0.55)',
    borderWidth: layout.hairline,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.textRegular,
    color: CREAM,
    // Removes the focus ring react-native-web adds, which reads as a default
    // browser control against everything else here.
    outlineStyle: 'none',
  } as any,
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: fontFamilies.textSemiBold,
    color: INK,
    letterSpacing: 1.6,
  },
  welcome: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  welcomeText: {
    fontFamily: fontFamilies.textRegular,
    color: CREAM,
  },
  welcomeName: {
    fontFamily: fontFamilies.textSemiBold,
    color: CREAM,
  },
  changeName: {
    fontFamily: fontFamilies.textMedium,
    fontSize: 14,
  },
  error: {
    fontFamily: fontFamilies.textRegular,
    color: '#E8776D',
    fontSize: 13,
  },
});
