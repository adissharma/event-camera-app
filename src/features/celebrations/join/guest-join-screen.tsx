import { useCallback, useState, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { CameraIcon, CameraSparkleIcon, ClockIcon, PersonIcon } from '@/components/ui/icons';
import { CoverScrim } from '@/components/media/cover-scrim';
import { colours, layout, radii, spacing } from '@/design';
import type { CoverTemplateKey } from '../cover-templates';
import { LightArchInvitationCover } from '../covers/light-arch-invitation-cover';
import { MidnightInvitationCover } from '../covers/midnight-invitation-cover';

/**
 * The guest join screen — the page a guest lands on from a QR code or link.
 *
 * This is the single implementation of that screen. `src/app/j/[slug].tsx`
 * renders it with live data and real handlers; the creation flow's cover
 * preview renders the very same component, inert and uniformly scaled down
 * inside a phone silhouette. That is deliberate: the preview's whole job is to
 * tell a host what their guests will see, and it can only keep that promise if
 * it is not a second, separately-maintained copy of the design. Changing this
 * file changes both.
 *
 * The reference size below is the frame the design is authored against. The
 * preview renders at exactly these dimensions and then applies one transform
 * to the whole tree, rather than shrinking individual elements — which is what
 * keeps the miniature proportionally identical to the real thing.
 */

export const GUEST_JOIN_REFERENCE_WIDTH = 375;
export const GUEST_JOIN_REFERENCE_HEIGHT = 812;

/** The cover runs to roughly two thirds of the viewport. */
const COVER_HEIGHT_RATIO = 0.66;

const NAME_MAX_LENGTH = 50;

export interface GuestJoinScreenProps {
  /** Which invite layout to render. Defaults to the classic cover. */
  template?: CoverTemplateKey;
  coverSource: ImageSourcePropType;
  title: string;
  countdownLabel: string;
  shotsLeftLabel: string;
  shotsLeftDetailLabel?: string;
  accent?: string | null;

  /**
   * Height the layout is composed against. Defaults to the live viewport;
   * the preview passes the reference height so its proportions match a phone
   * rather than the host's own device.
   */
  viewportHeight?: number;

  name?: string;
  onNameChange?: (next: string) => void;
  showNameInput?: boolean;
  welcomeName?: string | null;
  welcomePrefix?: 'Welcome' | 'Welcome back';
  onChangeNamePress?: () => void;
  nameInputRef?: RefObject<TextInput | null>;
  error?: string | null;
  showValidation?: boolean;
  isNameValid?: boolean;
  isJoining?: boolean;
  ctaLabel?: string;
  onJoin?: () => void;

  /**
   * Replaces the join form, keeping the template's own cover, identity,
   * typography and spacing exactly as a guest sees them.
   *
   * This is what lets the post-publication confirmation reuse the real
   * template instead of approximating it: the host gets their actual cover,
   * with "here is your link" where the guest gets "enter your name".
   */
  footer?: ReactNode;

  /**
   * False renders the screen as a picture of itself: everything is visible but
   * nothing takes focus or submits. Used by the creation preview.
   */
  interactive?: boolean;

  /**
   * Wraps the content in a ScrollView + KeyboardAvoidingView. Off in the
   * preview, where the frame is fixed and there is no keyboard to avoid.
   */
  scrollable?: boolean;
}

export function GuestJoinScreen(props: GuestJoinScreenProps) {
  if (props.template === 'midnight') {
    return <MidnightInvitationCover {...props} />;
  }
  if (props.template === 'lightArch') {
    return <LightArchInvitationCover {...props} />;
  }
  return <ClassicJoinScreen {...props} />;
}

function ClassicJoinScreen({
  coverSource,
  title,
  countdownLabel,
  shotsLeftLabel,
  shotsLeftDetailLabel = 'Shots left',
  accent: providedAccent,
  viewportHeight,
  name = '',
  onNameChange,
  showNameInput = true,
  welcomeName,
  welcomePrefix = 'Welcome',
  onChangeNamePress,
  nameInputRef,
  error,
  showValidation = false,
  isNameValid = true,
  isJoining = false,
  onJoin,
  ctaLabel = 'Join the event',
  interactive = true,
  scrollable = true,
  footer,
}: GuestJoinScreenProps) {
  const { height: liveHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accent = providedAccent ?? colours.accentWarm;

  /**
   * Height the composition is laid out against.
   *
   * Measured from this component's own box rather than taken from
   * `useWindowDimensions`. The window and the box are not the same thing:
   * on web the window height moves as the browser's URL bar collapses, and
   * anywhere this renders inside a frame (the editor preview) the window is
   * not the container at all. Sizing the cover and the min-height from the
   * window while the form is bottom-anchored inside the box is what let the
   * live page and the preview disagree — the cover came out taller on `/j`
   * and pushed the Join button below the fold.
   *
   * `viewportHeight` still wins when given, so the preview can compose
   * against a fixed reference frame. `liveHeight` is only the value used for
   * the first paint, before layout has reported.
   */
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const pageHeight = viewportHeight ?? (measuredHeight || liveHeight);

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0) setMeasuredHeight((current) => (current === next ? current : next));
  }, []);
  const coverHeight = Math.round(pageHeight * COVER_HEIGHT_RATIO);
  const bottomInset = viewportHeight == null ? Math.max(insets.bottom, spacing.lg) : spacing.lg;

  const body = (
    <View style={[S.page, { minHeight: pageHeight, paddingBottom: bottomInset }]}>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <View style={[S.cover, { height: coverHeight }]}>
        <Image
          source={coverSource}
          style={S.coverImage}
          resizeMode="cover"
          accessibilityLabel={`Cover photograph for ${title}`}
        />

        <CoverScrim />

      </View>

      {/* Overlaps the lower edge of the photograph but remains in normal
          layout, so the bottom form can never collide with it. */}
      <View style={S.identity}>
        <AppText variant="eyebrow" style={[S.eyebrow, { color: accent }]}>
          You&rsquo;re invited
        </AppText>

        <AppText
          variant="displayLarge"
          align="center"
          numberOfLines={2}
          // Shrinks a long event name rather than cutting it off.
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={S.title}
        >
          {title}
        </AppText>

        <View style={S.detailRow}>
          <Detail
            icon={<ClockIcon size={18} color={accent} />}
            value={countdownLabel}
            label="Time left"
          />
          <View style={S.detailDivider} />
          <Detail
            icon={<CameraIcon size={18} color={accent} />}
            value={shotsLeftLabel}
            label={shotsLeftDetailLabel}
          />
        </View>
      </View>

      {/* ── Form ──────────────────────────────────────────────── */}
      <View style={S.form}>
        {footer ?? <>
        {welcomeName ? (
          <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md }}>
            <AppText variant="bodyLarge" style={{ color: colours.textPrimary }}>
              {welcomePrefix}, <AppText style={{ fontWeight: 'bold' }}>{welcomeName}</AppText>.
            </AppText>
            {onChangeNamePress ? (
              <Pressable onPress={onChangeNamePress} accessibilityRole="button">
                <AppText style={{ color: accent, textDecorationLine: 'underline' }}>Not you?</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : showNameInput ? (
          <View style={[S.field, showValidation && !isNameValid && S.fieldInvalid]}>
          <PersonIcon size={20} color={colours.textSecondary} />
          <TextInput
            ref={nameInputRef}
            value={name}
            onChangeText={onNameChange}
            placeholder="Enter your name"
            placeholderTextColor={colours.textSecondary}
            selectionColor={accent}
            style={S.fieldInput}
            maxLength={NAME_MAX_LENGTH}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="go"
            onSubmitEditing={onJoin}
            accessibilityLabel="Your name"
            editable={!isJoining && interactive}
          />
          </View>
        ) : null}

        {showValidation && !isNameValid && !welcomeName ? (
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
          onPress={onJoin}
          disabled={!isNameValid || isJoining || !interactive}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !isNameValid || isJoining }}
          style={({ pressed }) => [
            S.cta,
            { backgroundColor: accent },
            (!isNameValid || isJoining) && S.ctaDisabled,
            pressed && S.ctaPressed,
          ]}
        >
          {isJoining ? (
            <ActivityIndicator color={colours.textOnBrand} />
          ) : (
            <>
              <CameraSparkleIcon size={22} color={colours.textOnBrand} />
              <AppText variant="labelLarge" style={S.ctaLabel}>
                Join the event
              </AppText>
            </>
          )}
        </Pressable>
        </>}
      </View>
    </View>
  );

  if (!scrollable) {
    return (
      <View style={S.root} onLayout={handleRootLayout}>
        {body}
      </View>
    );
  }

  return (
    <View style={S.root} onLayout={handleRootLayout}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.scrollContent}
          keyboardShouldPersistTaps="handled"
          // Scrolls only as far as the focused field needs, so the CTA below
          // it stays on screen rather than being pushed out of reach.
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** One of the two compact facts under the title. */
function Detail({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
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
  root: { flex: 1, backgroundColor: colours.background },
  page: { width: '100%', backgroundColor: colours.background },
  scrollContent: { flexGrow: 1 },

  // ── Cover ──
  cover: { width: '100%', backgroundColor: colours.background },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },

  identity: {
    marginTop: -spacing.xxxl,
    marginHorizontal: layout.gutter,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  eyebrow: { color: colours.accentWarm },
  title: { color: colours.textPrimary },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailValue: { color: colours.textPrimary },
  detailLabel: { color: colours.textSecondary, letterSpacing: 1.2, fontSize: 10 },
  detailDivider: {
    width: layout.hairline,
    alignSelf: 'stretch',
    marginVertical: spacing.xxs,
    backgroundColor: colours.borderSubtle,
  },

  // ── Form ──
  form: {
    marginTop: 'auto',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.md,
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
  fieldInvalid: { borderWidth: 1.5, borderColor: colours.error },
  fieldInput: {
    flex: 1,
    color: colours.textPrimary,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 16,
    // Height, not padding: a bare TextInput sizes to its font on Android and
    // would sit off-centre against the icon.
    height: '100%',
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
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colours.textOnBrand, fontSize: 17 },
});
