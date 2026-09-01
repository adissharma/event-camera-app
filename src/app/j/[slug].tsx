import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { resolveCoverTemplate } from '@/features/celebrations/cover-templates';
import { GuestJoinScreen } from '@/features/celebrations/join/guest-join-screen';
import { colours, layout, radii, spacing } from '@/design';
import {
  fetchGuestEventPreview,
  guestSessionKeys,
  joinEventSession,
  loadStoredGuestSession,
} from '@/services/guest-session';



/**
 * The first screen a guest sees, from a QR code or an invitation link.
 *
 * The invitation token travels in the URL fragment (`#t=…`), never the query
 * string, so it stays out of server logs and out of the `Referer` header. On
 * web `expo-router` does not surface the fragment, so it is read from
 * `window.location.hash` directly.
 */
export default function GuestEntryScreen() {
  const { slug, t } = useLocalSearchParams<{ slug: string; t?: string }>();
  const router = useRouter();

  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const accessToken = useMemo(() => readAccessToken(t), [t]);

  const { data: preview, isLoading, error: previewError } = useQuery({
    queryKey: guestSessionKeys.preview(String(slug)),
    queryFn: () => fetchGuestEventPreview(String(slug)),
    enabled: Boolean(slug),
    retry: false,
  });

  // One resolver for every cover surface — see `cover-source`.
  const coverSource = useCoverSource(preview?.coverStoragePath);

  // A device that has already joined goes straight through. The guest is asked
  // for a name once per event, not once per visit.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    void loadStoredGuestSession(String(slug)).then((stored) => {
      if (!cancelled && stored?.displayName) {
        router.replace(`/celebration/${stored.celebrationId}` as never);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  const countdown = useCountdown(preview?.endsAt ?? null);

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;

  const handleJoin = useCallback(async () => {
    if (isJoining) return; // Guards against a double tap submitting twice.

    if (!isNameValid) {
      setShowValidation(true);
      inputRef.current?.focus();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setIsJoining(true);
    setError(null);
    try {
      const session = await joinEventSession({
        slug: String(slug),
        accessToken,
        displayName: trimmedName,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/celebration/${session.celebrationId}` as never);
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

  const shotsLeft =
    preview.shotLimit === null ? null : Math.max(0, preview.shotLimit - preview.shotsUsed);
  const accent = preview.themeAccent ?? colours.accentWarm;

  return (
    <GuestJoinScreen
      template={resolveCoverTemplate(preview.themeSlug)}
      coverSource={coverSource}
      title={preview.title}
      countdownLabel={countdown}
      shotsLeftLabel={shotsLeft === null ? '∞' : String(shotsLeft)}
      accent={accent}
      name={name}
      onNameChange={(next) => {
        setName(next);
        if (next.trim()) setShowValidation(false);
        if (error) setError(null);
      }}
      nameInputRef={inputRef}
      error={error}
      showValidation={showValidation}
      isNameValid={isNameValid}
      isJoining={isJoining}
      onJoin={() => void handleJoin()}
    />
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

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colours.background },
  centred: { alignItems: 'center', justifyContent: 'center' },

  // ── Cover ──
  cover: { width: '100%', backgroundColor: colours.background },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },

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
