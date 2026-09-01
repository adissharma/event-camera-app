import { useState, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { CameraIcon, CameraSparkleIcon, ClockIcon, PersonIcon } from '@/components/ui/icons';
import { fontFamilies, spacing } from '@/design';

const IVORY = '#FAF8F4';
const CHARCOAL = '#302E2C';
const TAUPE = '#94887B';
const TAUPE_MUTED = '#A99E92';
const BORDER = '#D9D2C9';
const FOCUS = '#8E8173';
const CTA = '#8C8175';
const WHITE = '#FFFFFF';
const ERROR = '#A7453F';
const ARCH_RATIO = 1.32;
const MIN_ARCH_WIDTH = 180;
const MIN_ARCH_TO_COPY_GAP = spacing.md;
const ESTIMATED_BOTTOM_CONTENT_HEIGHT = 300;

export interface LightArchInvitationCoverProps {
  /** Replaces the join form. See `GuestJoinScreenProps.footer`. */
  footer?: ReactNode;
  coverSource: ImageSourcePropType;
  title: string;
  countdownLabel: string;
  shotsLeftLabel: string;
  shotsLeftDetailLabel?: string;
  viewportHeight?: number;
  nameInputRef?: RefObject<TextInput | null>;
  name?: string;
  onNameChange?: (value: string) => void;
  showNameInput?: boolean;
  welcomeName?: string | null;
  welcomePrefix?: 'Welcome' | 'Welcome back';
  onChangeNamePress?: () => void;
  showValidation?: boolean;
  error?: string | null;
  isNameValid?: boolean;
  isJoining?: boolean;
  ctaLabel?: string;
  onJoin?: () => void;
  interactive?: boolean;
  scrollable?: boolean;
}

/**
 * Light Arch Invitation — an ivory, editorial join template.
 *
 * It owns presentation only. The live route supplies the same name state and
 * join callback used by every other template, while the creation carousel
 * renders this exact tree inert at the 375 x 812 reference size.
 */
export function LightArchInvitationCover({
  coverSource,
  title,
  countdownLabel,
  shotsLeftLabel,
  shotsLeftDetailLabel = 'Shots left',
  viewportHeight,
  nameInputRef,
  name = '',
  onNameChange,
  showNameInput = true,
  welcomeName,
  welcomePrefix = 'Welcome',
  onChangeNamePress,
  showValidation = false,
  error,
  isNameValid = true,
  isJoining = false,
  ctaLabel = 'Join the event',
  onJoin,
  footer,
  interactive = true,
}: LightArchInvitationCoverProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(375);
  // Measured, not taken from the window — see `guest-join-screen.tsx`. The
  // window and this component's box differ inside the editor preview and
  // whenever browser chrome resizes on web, and sizing the page against the
  // wrong one is what let the live page drift from the preview.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [bottomContentHeight, setBottomContentHeight] = useState(ESTIMATED_BOTTOM_CONTENT_HEIGHT);
  const [isFocused, setIsFocused] = useState(false);

  const pageHeight = viewportHeight ?? (measuredHeight || windowHeight);
  const contentWidth = Math.min(width - spacing.xl * 2, 335);
  const topInset =
    viewportHeight == null
      ? Math.max(insets.top + spacing.sm, spacing.lg)
      : spacing.lg;
  const bottomInset = viewportHeight == null ? Math.max(insets.bottom, spacing.lg) : spacing.lg;

  // This screen is a single viewport composition, not a document. The arch
  // scales with the available height before it can push the invitation copy or
  // join controls below the browser chrome on smaller Android devices.
  const maxArchWidthForViewport = Math.max(
    MIN_ARCH_WIDTH,
    Math.round(
      (pageHeight -
        topInset -
        bottomInset -
        bottomContentHeight -
        MIN_ARCH_TO_COPY_GAP) /
        ARCH_RATIO,
    ),
  );
  const archWidth = Math.min(
    contentWidth,
    maxArchWidthForViewport,
  );
  const archHeight = Math.round(archWidth * ARCH_RATIO);
  const disabled = !isNameValid || isJoining;
  const invalid = showValidation && !isNameValid;

  function handleLayout(event: LayoutChangeEvent) {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
    const rounded = Math.round(nextHeight);
    if (rounded > 0 && rounded !== measuredHeight) setMeasuredHeight(rounded);
  }

  function handleBottomContentLayout(event: LayoutChangeEvent) {
    const rounded = Math.round(event.nativeEvent.layout.height);
    if (rounded > 0 && rounded !== bottomContentHeight) setBottomContentHeight(rounded);
  }

  const body = (
    <View
      style={[
        S.content,
        {
          height: pageHeight,
          paddingTop: topInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <View style={[S.heroArea, { height: archHeight, width: '100%' }]}>
        <BotanicalAccent style={S.botanicalLeft} />
        <BotanicalAccent mirrored style={S.botanicalRight} />

        <View style={[S.archFrame, { width: archWidth, height: archHeight }]}>
          <Image
            source={coverSource}
            style={S.archImage}
            resizeMode="cover"
            accessibilityLabel={`Cover photograph for ${title}`}
          />
        </View>
      </View>

      <View
        onLayout={handleBottomContentLayout}
        style={[S.bottomContent, { width: contentWidth }]}
      >
        <View style={S.invitationCopy}>
          <AppText variant="eyebrow" align="center" style={S.eyebrow}>
            You&rsquo;re invited
          </AppText>

          <AppText
            align="center"
            style={[S.title, { maxWidth: contentWidth }]}
          >
            {title}
          </AppText>

          <View style={S.statsRow}>
            <Stat
              icon={<ClockIcon size={23} color={TAUPE_MUTED} />}
              value={countdownLabel}
              label="Time left"
            />
            <View style={S.statsDivider} />
            <Stat
              icon={<CameraIcon size={23} color={TAUPE_MUTED} />}
              value={shotsLeftLabel}
              label={shotsLeftDetailLabel}
            />
          </View>
        </View>

        <View style={S.form}>
          {footer ?? <>
          {welcomeName ? (
          <View style={S.welcome}>
            <AppText variant="bodyLarge" align="center" style={S.welcomeText}>
              {welcomePrefix}, <AppText style={S.welcomeName}>{welcomeName}</AppText>.
            </AppText>
            {onChangeNamePress ? (
              <Pressable
                onPress={onChangeNamePress}
                accessibilityRole="button"
                disabled={!interactive}
                hitSlop={8}
              >
                <AppText variant="label" style={S.changeName}>Not you?</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : showNameInput ? (
          <View style={[S.field, isFocused && S.fieldFocused, invalid && S.fieldInvalid]}>
            <PersonIcon size={22} color={TAUPE} />
            <TextInput
              ref={nameInputRef}
              value={name}
              onChangeText={onNameChange}
              placeholder="Enter your name"
              placeholderTextColor="#AAA39C"
              selectionColor={FOCUS}
              style={S.input}
              maxLength={50}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              onSubmitEditing={onJoin}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              accessibilityLabel="Your name"
              editable={interactive && !isJoining}
            />
          </View>
        ) : null}

        {invalid || error ? (
          <AppText variant="caption" align="center" style={S.error} accessibilityLiveRegion="polite">
            {error ?? 'Enter your name to join.'}
          </AppText>
        ) : null}

        <Pressable
          onPress={onJoin}
          disabled={disabled || !interactive}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: disabled || !interactive, busy: isJoining }}
          style={({ pressed }) => [
            S.cta,
            disabled && S.ctaDisabled,
            pressed && !disabled && S.ctaPressed,
          ]}
        >
          {isJoining ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <>
              <CameraSparkleIcon size={24} color={WHITE} />
              <AppText variant="labelLarge" style={S.ctaLabel}>
                {ctaLabel}
              </AppText>
            </>
          )}
        </Pressable>
          </>}
        </View>
      </View>
    </View>
  );

  return (
    <View onLayout={handleLayout} style={S.root}>
      <KeyboardAvoidingView
        style={S.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={S.stat}>
      {icon}
      <View>
        <AppText style={S.statValue}>{value}</AppText>
        <AppText style={S.statLabel}>{label.toUpperCase()}</AppText>
      </View>
    </View>
  );
}

function BotanicalAccent({
  mirrored = false,
  style,
}: {
  mirrored?: boolean;
  style?: object;
}) {
  return (
    <Svg width={104} height={210} viewBox="0 0 104 210" style={style} pointerEvents="none">
      <G
        transform={mirrored ? 'translate(104 0) scale(-1 1)' : undefined}
        fill="none"
        stroke="#D8CFC4"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M90 206C79 175 66 149 44 124C27 104 18 79 17 49" />
        <Path d="M66 151C46 143 35 130 28 111" />
        <Path d="M48 128C29 124 17 115 8 100" />
        <Path d="M34 110C41 91 41 76 35 62" />
        <Path d="M20 80C32 64 35 48 31 31" />
        <Path d="M17 60C8 49 5 37 7 24" />
        <Path d="M28 111C15 106 8 98 4 87C17 89 25 96 28 111Z" />
        <Path d="M35 62C45 49 49 37 47 23C36 31 32 44 35 62Z" />
        <Path d="M17 49C10 38 10 27 15 16C23 26 24 37 17 49Z" />
        <Path d="M7 24C3 15 4 8 9 2C14 10 13 18 7 24Z" />
      </G>
    </Svg>
  );
}

const S = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, width: '100%', backgroundColor: IVORY },
  content: {
    alignItems: 'center',
    backgroundColor: IVORY,
    paddingHorizontal: spacing.lg,
  },
  heroArea: { alignItems: 'center', justifyContent: 'flex-start' },
  archFrame: {
    overflow: 'hidden',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: '#EEEAE4',
    padding: 4,
    zIndex: 1,
  },
  archImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  botanicalLeft: { position: 'absolute', left: -22, bottom: -6 },
  botanicalRight: { position: 'absolute', right: -22, bottom: -6 },
  bottomContent: { marginTop: 'auto', alignItems: 'center' },
  invitationCopy: { alignItems: 'center' },
  eyebrow: {
    color: TAUPE,
    letterSpacing: 2.2,
  },
  title: {
    fontFamily: fontFamilies.display,
    color: CHARCOAL,
    fontSize: 39,
    lineHeight: 43,
    letterSpacing: 0,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  stat: {
    width: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statValue: {
    fontFamily: fontFamilies.textRegular,
    color: CHARCOAL,
    fontSize: 15,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fontFamilies.textRegular,
    color: TAUPE,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginVertical: spacing.xs,
  },
  form: { width: '100%', gap: spacing.md, marginTop: spacing.lg },
  field: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'transparent',
  },
  fieldFocused: { borderWidth: 2, borderColor: FOCUS },
  fieldInvalid: { borderWidth: 1.5, borderColor: ERROR },
  input: {
    flex: 1,
    height: '100%',
    color: CHARCOAL,
    fontFamily: fontFamilies.textRegular,
    fontSize: 17,
    outlineStyle: 'none',
  } as any,
  welcome: { minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  welcomeText: { color: CHARCOAL },
  welcomeName: { fontFamily: fontFamilies.textSemiBold, color: CHARCOAL },
  changeName: { color: TAUPE, textDecorationLine: 'underline' },
  error: { color: ERROR },
  cta: {
    minHeight: 62,
    borderRadius: 31,
    backgroundColor: CTA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  ctaDisabled: { opacity: 0.48 },
  ctaPressed: { opacity: 0.84 },
  ctaLabel: { color: WHITE, fontSize: 17, lineHeight: 22 },
});
