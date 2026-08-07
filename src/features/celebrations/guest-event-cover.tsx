import type { ReactNode, RefObject } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/text';
import { CameraIcon, CameraSparkleIcon, ClockIcon, PersonIcon } from '@/components/ui/icons';
import { colours, layout, radii, spacing } from '@/design';

function scrimStop(alpha: number): string {
  const hex = colours.background.replace('#', '');
  return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
}

const SCRIM_COLORS = [
  scrimStop(0),
  scrimStop(0),
  scrimStop(0.35),
  scrimStop(0.75),
  scrimStop(0.95),
  scrimStop(1),
] as readonly [string, string, ...string[]];

const SCRIM_LOCATIONS = [0, 0.42, 0.6, 0.75, 0.88, 1] as readonly [number, number, ...number[]];

export interface GuestEventCoverProps {
  coverSource: ImageSourcePropType;
  title: string;
  countdownLabel: string;
  shotsLeftLabel: string;
  accent?: string | null;
  height?: ViewStyle['height'];
  coverHeight?: ViewStyle['height'];
  preview?: boolean;
  welcomeName?: string | null;
  welcomePrefix?: 'Welcome' | 'Welcome back';
  onChangeNamePress?: () => void;
  nameInputRef?: RefObject<TextInput | null>;
  nameValue?: string;
  onNameChange?: (value: string) => void;
  showNameInput?: boolean;
  showValidation?: boolean;
  error?: string | null;
  isNameValid?: boolean;
  isJoining?: boolean;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function GuestEventCover({
  coverSource,
  title,
  countdownLabel,
  shotsLeftLabel,
  accent: providedAccent,
  height,
  coverHeight,
  preview = false,
  welcomeName,
  welcomePrefix = 'Welcome',
  onChangeNamePress,
  nameInputRef,
  nameValue = '',
  onNameChange,
  showNameInput = true,
  showValidation = false,
  error,
  isNameValid = true,
  isJoining = false,
  ctaLabel = 'Join the event',
  onCtaPress,
}: GuestEventCoverProps) {
  const accent = providedAccent ?? colours.accentWarm;
  const disabled = !isNameValid || isJoining;

  return (
    <View style={[S.root, height == null ? null : { height }]}>
      <View style={[S.cover, coverHeight == null ? null : { height: coverHeight, flex: undefined }, preview && S.coverPreview]}>
        <Image
          source={coverSource}
          style={S.coverImage}
          resizeMode="cover"
          accessibilityLabel={`Cover photograph for ${title}`}
        />

        <LinearGradient
          colors={SCRIM_COLORS}
          locations={SCRIM_LOCATIONS}
          style={S.scrim}
          pointerEvents="none"
        />

        <View style={[S.identity, preview && S.identityPreview]}>
          <AppText variant="eyebrow" style={[S.eyebrow, { color: accent }]}>
            You&rsquo;re invited
          </AppText>

          <AppText
            variant="displayLarge"
            align="center"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[S.title, preview && S.titlePreview]}
          >
            {title}
          </AppText>

          <View style={[S.detailRow, preview && S.detailRowPreview]}>
            <Detail icon={<ClockIcon size={preview ? 14 : 18} color={accent} />} value={countdownLabel} label="Time left" />
            <View style={S.detailDivider} />
            <Detail icon={<CameraIcon size={preview ? 14 : 18} color={accent} />} value={shotsLeftLabel} label="Shots left" />
          </View>
        </View>
      </View>

      <View style={[S.form, preview && S.formPreview]}>
        {welcomeName ? (
          <View style={S.welcomeContainer}>
            <AppText variant="bodyLarge" style={[S.welcomeText, preview && S.welcomeTextPreview]}>
              {welcomePrefix}, <AppText style={S.boldText}>{welcomeName}</AppText>.
            </AppText>
            {onChangeNamePress ? (
              <Pressable onPress={onChangeNamePress} accessibilityRole="button">
                <AppText style={[S.changeNameLink, { color: accent }]}>Not you?</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : showNameInput ? (
          <View style={[S.field, showValidation && S.fieldInvalid, preview && S.fieldPreview]}>
            <PersonIcon size={preview ? 16 : 20} color={colours.textSecondary} />
            <TextInput
              ref={nameInputRef}
              value={nameValue}
              onChangeText={onNameChange}
              placeholder="Enter your name"
              placeholderTextColor={colours.textSecondary}
              selectionColor={accent}
              style={[S.fieldInput, preview && S.fieldInputPreview]}
              maxLength={50}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              onSubmitEditing={onCtaPress}
              accessibilityLabel="Your name"
              editable={!isJoining && !preview}
            />
          </View>
        ) : null}

        {showValidation && !welcomeName ? (
          <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
            Enter your name to join.
          </AppText>
        ) : null}

        {error ? (
          <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}

        <Pressable
          onPress={onCtaPress}
          disabled={disabled || preview}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            S.cta,
            { backgroundColor: accent },
            preview && S.ctaPreview,
            disabled && S.ctaDisabled,
            pressed && S.ctaPressed,
          ]}
        >
          {isJoining ? (
            <ActivityIndicator color={colours.textOnBrand} />
          ) : (
            <>
              <CameraSparkleIcon size={preview ? 18 : 22} color={colours.textOnBrand} />
              <AppText variant="labelLarge" style={[S.ctaLabel, preview && S.ctaLabelPreview]}>
                {ctaLabel}
              </AppText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Detail({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={S.detail}>
      {icon}
      <View>
        <AppText variant="labelLarge" style={S.detailValue}>
          {value}
        </AppText>
        <AppText variant="caption" style={S.detailLabel}>
          {label.toUpperCase()}
        </AppText>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { width: '100%', backgroundColor: colours.background },
  cover: { flex: 1, width: '100%', backgroundColor: colours.background },
  coverPreview: { minHeight: 0 },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  identity: {
    position: 'absolute',
    bottom: spacing.lg,
    left: layout.gutter,
    right: layout.gutter,
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityPreview: {
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: { color: colours.accentWarm },
  title: { color: colours.textPrimary },
  titlePreview: { fontSize: 30, lineHeight: 34 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  detailRowPreview: { gap: spacing.md },
  detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailValue: { color: colours.textPrimary },
  detailLabel: { color: colours.textSecondary, letterSpacing: 1.2, fontSize: 10 },
  detailDivider: {
    width: layout.hairline,
    alignSelf: 'stretch',
    marginVertical: spacing.xxs,
    backgroundColor: colours.borderSubtle,
  },
  form: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  formPreview: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 60,
    borderRadius: radii.xl,
    backgroundColor: colours.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  fieldPreview: {
    minHeight: 48,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
  },
  fieldInvalid: { borderWidth: 1.5, borderColor: colours.error },
  fieldInput: {
    flex: 1,
    color: colours.textPrimary,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 16,
    height: '100%',
  },
  fieldInputPreview: { fontSize: 13 },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  welcomeText: {
    color: colours.textPrimary,
    fontSize: 18,
  },
  welcomeTextPreview: { fontSize: 15, textAlign: 'center' },
  boldText: {
    fontWeight: 'bold',
  },
  changeNameLink: {
    color: colours.accentWarm,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 62,
    borderRadius: radii.pill,
    backgroundColor: colours.accentWarm,
    marginTop: spacing.xs,
  },
  ctaPreview: {
    minHeight: 52,
    marginTop: 0,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colours.textOnBrand, fontSize: 17 },
  ctaLabelPreview: { fontSize: 14 },
});
