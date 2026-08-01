import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { CameraIcon, CameraSparkleIcon, ClockIcon, PersonIcon } from '@/components/ui/icons';
import { colours, layout, radii, spacing } from '@/design';
import {
  fetchGuestEventPreview,
  guestSessionKeys,
  joinEventSession,
  loadStoredGuestSession,
  clearStoredGuestSession,
  type GuestSession,
} from '@/services/guest-session';
import { useAuth } from '@/features/auth/context';
import { fetchMyProfile, profileKeys } from '@/services/profile';
import { isBackendConfigured } from '@/lib/supabase/client';

/** Cover art for the development fallback, keyed the same way as the dashboard. */
const COVER_MAP: Record<string, ReturnType<typeof require>> = {
  modern: require('../../../assets/images/placeholders/christian_wedding.png'),
  classic: require('../../../assets/images/placeholders/christian_wedding.png'),
  vibrant: require('../../../assets/images/placeholders/hindu_wedding.png'),
  retro: require('../../../assets/images/placeholders/treatment_preview_1.png'),
  editorial: require('../../../assets/images/placeholders/treatment_preview_2.png'),
};
const FALLBACK_COVER = require('../../../assets/images/placeholders/create_event_cover.png');

const NAME_MAX_LENGTH = 50;

/**
 * The cover runs to roughly two thirds of the viewport, so the photograph is
 * the screen and the form sits under it rather than beside it.
 */
const COVER_HEIGHT_RATIO = 0.66;

/**
 * The scrim.
 *
 * Nothing at all across the top half of the photograph, then an accelerating
 * fall to the page background. Holding off that long is what keeps the cover
 * reading as a photograph rather than a darkened panel, and the last stop
 * matches `colours.background` exactly so the image has no visible bottom edge.
 */
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

/**
 * The first screen a guest sees, from a QR code or an invitation link.
 *
 * The invitation token travels in the URL fragment (`#t=…`), never the query
 * string, so it stays out of server logs and out of the `Referer` header. On
 * web `expo-router` does not surface the fragment, so it is read from
 * `window.location.hash` directly.
 */
export default function GuestEntryScreen() {
  const { eventCode, t } = useLocalSearchParams<{ eventCode: string; t?: string }>();
  const slug = eventCode;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The live viewport, not a fixed device height: mobile browser chrome grows
  // and shrinks as the page scrolls, and a static height leaves the CTA under
  // the toolbar on exactly the phones that can least afford it.
  const { height: viewportHeight } = useWindowDimensions();

  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const [storedSession, setStoredSession] = useState<GuestSession | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const { session } = useAuth();
  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured && !!session,
  });

  const accessToken = useMemo(() => readAccessToken(t), [t]);

  const { data: preview, isLoading, error: previewError } = useQuery({
    queryKey: guestSessionKeys.preview(String(slug)),
    queryFn: () => fetchGuestEventPreview(String(slug)),
    enabled: Boolean(slug),
    retry: false,
  });

  // Load stored guest session if it exists on mount
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    void loadStoredGuestSession(String(slug)).then((stored) => {
      if (!cancelled) {
        if (stored?.displayName) {
          setStoredSession(stored);
          setName(stored.displayName);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Pre-fill profile name for signed-in native app user if they don't have a guest session yet
  useEffect(() => {
    if (profile?.display_name && !name && !storedSession) {
      setName(profile.display_name);
    }
  }, [profile, storedSession]);

  const countdown = useCountdown(preview?.endsAt ?? null);

  const showReturningWelcome = storedSession !== null && !isEditingName;
  const showSignedInWelcome = !!profile?.display_name && !storedSession && !isEditingName;

  const trimmedName = name.trim();
  const isNameValid = showReturningWelcome || trimmedName.length > 0;

  const handleEnterGallery = useCallback(() => {
    router.replace(`/e/${eventCode}/gallery` as never);
  }, [eventCode, router]);

  const handleJoin = useCallback(async () => {
    if (isJoining) return; // Guards against a double tap submitting twice.

    if (showReturningWelcome) {
      handleEnterGallery();
      return;
    }

    if (!isNameValid) {
      setShowValidation(true);
      inputRef.current?.focus();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setIsJoining(true);
    setError(null);
    try {
      const joinedSession = await joinEventSession({
        slug: String(slug),
        accessToken,
        displayName: trimmedName,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/e/${eventCode}/gallery` as never);
    } catch (e) {
      // The typed name survives the failure — retyping it is the last thing a
      // guest should have to do after a network blip.
      setError(e instanceof Error ? e.message : 'Could not join. Please try again.');
      setIsJoining(false);
    }
  }, [isJoining, isNameValid, slug, accessToken, trimmedName, router]);

  if (isLoading) {
    return (
      <View style={[S.root, S.centred]}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (previewError || !preview) {
    return (
      <View style={[S.root, S.centred, { padding: layout.gutter }]}>
        <AppText variant="bodyLarge" tone="secondary" align="center">
          This invitation is no longer available.
        </AppText>
      </View>
    );
  }

  const coverHeight = Math.round(viewportHeight * COVER_HEIGHT_RATIO);
  const shotsLeft =
    preview.shotLimit === null ? null : Math.max(0, preview.shotLimit - preview.shotsUsed);

  return (
    <View style={S.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}
          keyboardShouldPersistTaps="handled"
          // Scrolls only as far as the focused field needs, so the CTA below
          // it stays on screen rather than being pushed out of reach.
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Cover ─────────────────────────────────────────────── */}
          <View style={[S.cover, { height: coverHeight }]}>
            <Image
              source={resolveCover(preview.coverStoragePath)}
              style={S.coverImage}
              resizeMode="cover"
              accessibilityLabel={`Cover photograph for ${preview.title}`}
            />

            <LinearGradient
              colors={SCRIM_COLORS}
              locations={SCRIM_LOCATIONS}
              style={S.scrim}
              pointerEvents="none"
            />

            {/* Event identity sits in the dark end of the ramp, so it reads as
                emerging from the photograph rather than floating on it. */}
            <View style={S.identity}>
              <AppText variant="eyebrow" style={S.eyebrow}>
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
                {preview.title}
              </AppText>

              <View style={S.detailRow}>
                <Detail
                  icon={<ClockIcon size={18} color={colours.accentWarm} />}
                  value={countdown}
                  label="Time left"
                />
                <View style={S.detailDivider} />
                <Detail
                  icon={<CameraIcon size={18} color={colours.accentWarm} />}
                  value={shotsLeft === null ? '∞' : String(shotsLeft)}
                  label="Shots left"
                />
              </View>
            </View>
          </View>

          {/* ── Form ──────────────────────────────────────────────── */}
          <View style={S.form}>
            {showReturningWelcome ? (
              <View style={S.welcomeContainer}>
                <AppText variant="bodyLarge" style={S.welcomeText}>
                  Welcome back, <AppText style={S.boldText}>{name}</AppText>.
                </AppText>
                <Pressable onPress={async () => {
                  await clearStoredGuestSession(String(slug));
                  setStoredSession(null);
                  setName('');
                  setIsEditingName(true);
                }} accessibilityRole="button">
                  <AppText style={S.changeNameLink}>Not you?</AppText>
                </Pressable>
              </View>
            ) : showSignedInWelcome ? (
              <View style={S.welcomeContainer}>
                <AppText variant="bodyLarge" style={S.welcomeText}>
                  Welcome, <AppText style={S.boldText}>{profile?.display_name}</AppText>.
                </AppText>
                <Pressable onPress={() => {
                  setName('');
                  setIsEditingName(true);
                }} accessibilityRole="button">
                  <AppText style={S.changeNameLink}>Not you?</AppText>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  S.field,
                  showValidation && !isNameValid && S.fieldInvalid,
                ]}
              >
                <PersonIcon size={20} color={colours.textSecondary} />
                <TextInput
                  ref={inputRef}
                  value={name}
                  onChangeText={(next) => {
                    setName(next);
                    if (next.trim()) setShowValidation(false);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor={colours.textSecondary}
                  selectionColor={colours.brandPrimary}
                  style={S.fieldInput}
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="go"
                  onSubmitEditing={() => void handleJoin()}
                  accessibilityLabel="Your name"
                  editable={!isJoining}
                />
              </View>
            )}

            {showValidation && !isNameValid && !showReturningWelcome ? (
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
              onPress={() => void handleJoin()}
              disabled={!isNameValid || isJoining}
              accessibilityRole="button"
              accessibilityLabel={showReturningWelcome ? "Enter the gallery" : "Join the event"}
              accessibilityState={{ disabled: !isNameValid || isJoining }}
              style={({ pressed }) => [
                S.cta,
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
                    {showReturningWelcome ? "Enter the gallery" : "Join the event"}
                  </AppText>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** One of the two compact facts under the title. */
function Detail({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
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

/**
 * Live `2d 14h 32m` countdown.
 *
 * Ticks every second so the minute rolls over while the guest is still
 * reading, rather than only on mount.
 */
function useCountdown(endsAt: string | null): string {
  const [label, setLabel] = useState(() => formatRemaining(endsAt));

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setLabel(formatRemaining(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

function formatRemaining(endsAt: string | null): string {
  if (!endsAt) return '—';

  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Ended';

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The invitation token.
 *
 * Carried in the fragment, which `expo-router` does not expose as a param on
 * web, so the raw hash is the source there. Native deep links surface it as a
 * normal param.
 */
function readAccessToken(param?: string): string | null {
  if (param) return param;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hash = window.location.hash.replace(/^#/, '');
    const match = new URLSearchParams(hash).get('t');
    if (match) return match;
  }

  return null;
}

function resolveCover(path: string | null) {
  if (!path) return FALLBACK_COVER;
  if (COVER_MAP[path]) return COVER_MAP[path];
  // A real storage path or a local file URI from the host's own picker.
  if (path.startsWith('http') || path.startsWith('file:')) return { uri: path };
  return FALLBACK_COVER;
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  centred: { alignItems: 'center', justifyContent: 'center' },

  // ── Cover ──
  cover: { width: '100%', backgroundColor: colours.background },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  identity: {
    position: 'absolute',
    bottom: spacing.lg,
    left: layout.gutter,
    right: layout.gutter,
    alignItems: 'center',
    gap: spacing.sm,
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
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9 },
  ctaLabel: { color: colours.textOnBrand, fontSize: 17 },
});
