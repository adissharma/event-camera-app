import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/icons';
import { useCameraAccess } from '@/features/media/camera-status';
import {
  joinRouteFor,
  parseJoinInput,
  parseJoinUrl,
} from '@/features/celebrations/join/join-link';
import { colours, layout, radii, spacing } from '@/design';

/**
 * Join an event: point the camera at its QR code, or paste its link.
 *
 * Both routes end in the same place. Nothing here knows how to join an event —
 * it recognises an invitation and hands off to `/j/[slug]`, which already owns
 * the cover, the name prompt and the join itself. A second implementation of
 * that flow is exactly what this screen exists to avoid.
 */

/** The camera takes the screen; the paste field is the smaller half of it. */
const VIEWFINDER_FLEX = 0.76;
const PASTE_FLEX = 0.24;

/** How much of the viewfinder the clear scanning window occupies. */
const WINDOW_RATIO = 0.72;
/** Longest a window side may get on a tablet, where 72% would be absurd. */
const WINDOW_MAX = 320;

/** How long an "unrecognised code" notice stays. */
const NOTICE_MS = 2600;

let CameraView: unknown = null;
let hasNativeCamera = false;
try {
  // Same guarded require the capture screen uses: a build without the native
  // module must still render, because the paste field does not need a camera
  // and refusing to show it would strand anyone whose camera is unavailable.
  CameraView = require('expo-camera').CameraView;
  hasNativeCamera = true;
} catch {
  hasNativeCamera = false;
}

export default function JoinEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useCameraAccess();

  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestAttempted, setRequestAttempted] = useState(false);
  const [viewfinder, setViewfinder] = useState({ width: 0, height: 0 });

  /**
   * Set the moment a valid code is recognised.
   *
   * A ref, not state: the scanner fires many times a second and every frame
   * after the first would push the same route again. This has to be true
   * before the next callback runs, which a state update cannot promise.
   */
  const handedOff = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRejectedQr = useRef<string | null>(null);

  // Scanning resumes when the guest comes back — otherwise a return from a
  // link that turned out to be expired would leave a dead viewfinder.
  useFocusEffect(
    useCallback(() => {
      handedOff.current = false;
      lastRejectedQr.current = null;
      return () => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
      };
    }, []),
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  /** The one way off this screen, used by both the camera and the paste field. */
  const handOff = useCallback(
    (raw: string, parse: typeof parseJoinUrl) => {
      const target = parse(raw);
      if (!target) return false;
      handedOff.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Keyboard.dismiss();
      router.push(joinRouteFor(target) as never);
      return true;
    },
    [router],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (handedOff.current || !data) return;

      // Strict: only a link to this product's own join route. A QR code is
      // untrusted input nobody chose to follow, so an unrecognised one is
      // reported and discarded — never opened.
      if (handOff(data, parseJoinUrl)) return;

      // The camera re-reports the same code every frame it can see it. Treat a
      // rejected payload as handled until a different QR is seen, so an iPhone
      // held over the wrong code does not keep vibrating.
      const rejectedQr = data.trim() || data;
      if (lastRejectedQr.current === rejectedQr) return;
      lastRejectedQr.current = rejectedQr;

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showNotice('Please scan a valid Stills QR code.');
    },
    [handOff, showNotice],
  );

  const submitLink = useCallback(() => {
    setLinkError(null);
    if (!link.trim()) {
      setLinkError('Paste the event link or code first.');
      return;
    }
    // Looser than the scanner by one case — a typed code is a decision, where
    // a code the camera happened to see is not.
    if (!handOff(link, parseJoinInput)) {
      setLinkError('That link isn’t an event invitation.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [link, handOff]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) {
        setLink(text.trim());
        setLinkError(null);
      }
    } catch {
      // Clipboard unavailable or empty — the field is still typeable.
    }
  }, []);

  // A square, centred, sized to the viewfinder it sits in.
  const windowSide = Math.min(
    viewfinder.width * WINDOW_RATIO,
    viewfinder.height * WINDOW_RATIO,
    WINDOW_MAX,
  );
  const windowLeft = (viewfinder.width - windowSide) / 2;
  const windowTop = (viewfinder.height - windowSide) / 2;
  const windowReady = windowSide > 0;

  const cameraLive = camera.status === 'granted' && hasNativeCamera && CameraView !== null;
  const Camera = CameraView as React.ComponentType<Record<string, unknown>>;

  return (
    <View style={S.screen}>
      <View
        style={{ flex: VIEWFINDER_FLEX }}
        onLayout={(event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          setViewfinder((current) =>
            Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
              ? current
              : { width, height },
          );
        }}
      >
        {cameraLive ? (
          <Camera
            style={StyleSheet.absoluteFill}
            facing="back"
            // Only QR. Narrowing the set keeps the decoder off barcode
            // families no invitation ever uses.
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
        ) : (
          <View style={S.cameraFallback}>
            {camera.status === 'checking' ? (
              <ActivityIndicator color={colours.textSecondary} />
            ) : (
              <CameraUnavailable
                detail={
                  // The request's own explanation once it has actually failed.
                  // An insecure origin says so immediately, because tapping
                  // Enable there can never succeed however many times it is
                  // pressed.
                  requestAttempted || camera.status === 'insecure' ? camera.detail : null
                }
                canRequest={hasNativeCamera || Platform.OS === 'web'}
                onRequest={() => {
                  setRequestAttempted(true);
                  camera.requestAccess();
                }}
                onOpenSettings={
                  Platform.OS === 'web' ? null : () => void Linking.openSettings()
                }
              />
            )}
          </View>
        )}

        {/*
          The shade, as four rectangles around the window rather than one box
          with a hole in it. React Native has no cut-out, and the alternatives
          — a masked view, an SVG overlay — are a dependency and a repaint per
          frame for something four plain Views already do exactly.
        */}
        {windowReady ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[S.shade, { top: 0, left: 0, right: 0, height: windowTop }]} />
            <View
              style={[S.shade, { top: windowTop + windowSide, left: 0, right: 0, bottom: 0 }]}
            />
            <View
              style={[S.shade, { top: windowTop, left: 0, width: windowLeft, height: windowSide }]}
            />
            <View
              style={[
                S.shade,
                { top: windowTop, left: windowLeft + windowSide, right: 0, height: windowSide },
              ]}
            />

            <View style={[S.window, { top: windowTop, left: windowLeft, width: windowSide, height: windowSide }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <View key={corner} style={[S.corner, S[corner]]} />
              ))}
            </View>

            {/* Only while there is something to aim at — under a window
                that cannot scan it contradicts the notice inside it. */}
            {cameraLive ? (
              <AppText
                variant="bodyMedium"
                align="center"
                style={[S.hint, { top: windowTop + windowSide + spacing.lg }]}
              >
                Scan an event QR code
              </AppText>
            ) : null}
          </View>
        ) : null}

        {/* Non-blocking: scanning continues underneath it. */}
        {notice ? (
          <View style={[S.notice, { top: insets.top + 64 }]} pointerEvents="none">
            <AppText variant="bodySmall" align="center" style={S.noticeText}>
              {notice}
            </AppText>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          style={[S.close, { top: insets.top + spacing.sm }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CloseIcon size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: PASTE_FLEX }}
      >
        <View style={[S.paste, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppText variant="bodySmall" tone="secondary">
            Or paste an event link
          </AppText>

          <View style={[S.field, linkError ? S.fieldInvalid : null]}>
            <TextInput
              value={link}
              onChangeText={(next) => {
                setLink(next);
                if (linkError) setLinkError(null);
              }}
              placeholder="Event link"
              placeholderTextColor={colours.textSecondary}
              style={S.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submitLink}
              accessibilityLabel="Event link"
            />
            <Pressable
              onPress={() => void pasteFromClipboard()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Paste from clipboard"
            >
              <AppText variant="bodySmall" style={S.pasteAction}>
                Paste
              </AppText>
            </Pressable>
          </View>

          {linkError ? (
            <AppText variant="caption" style={S.error}>
              {linkError}
            </AppText>
          ) : null}

          <Button label="Join event" fullWidth haptic onPress={submitLink} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Shown in place of the viewfinder, never in place of the screen.
 *
 * Pasting a link needs no camera, so a refused permission has to cost the
 * guest the scanner and nothing else — replacing the whole screen with a
 * permission wall would take away the one route that was still open to them.
 */
function CameraUnavailable({
  detail,
  canRequest,
  onRequest,
  onOpenSettings,
}: {
  detail: string | null;
  canRequest: boolean;
  onRequest: () => void;
  onOpenSettings: (() => void) | null;
}) {
  return (
    <View style={S.permission}>
      <AppText variant="titleMedium" align="center" style={{ color: '#FFFFFF' }}>
        Camera access needed to scan
      </AppText>
      <AppText variant="bodySmall" tone="secondary" align="center">
        You can still paste an event link below.
      </AppText>

      {canRequest ? (
        <Pressable onPress={onRequest} style={S.permissionBtn} accessibilityRole="button">
          <AppText variant="button" style={{ color: colours.textOnBrand }}>
            Enable Camera
          </AppText>
        </Pressable>
      ) : null}

      {detail ? (
        <AppText variant="bodySmall" tone="secondary" align="center" style={{ maxWidth: 300 }}>
          {detail}
        </AppText>
      ) : null}

      {detail && onOpenSettings ? (
        <Pressable onPress={onOpenSettings} hitSlop={8} accessibilityRole="button">
          <AppText variant="bodySmall" style={S.pasteAction}>
            Open Settings
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const SHADE = 'rgba(0, 0, 0, 0.62)';
const CORNER = 28;
const CORNER_W = 2.5;

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },

  cameraFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0C',
    paddingHorizontal: layout.gutter,
  },

  shade: { position: 'absolute', backgroundColor: SHADE },

  /** The clear window. Only a border — anything filled would shade it. */
  window: {
    position: 'absolute',
    borderRadius: radii.lg,
    borderWidth: layout.hairline,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  tl: { top: -1, left: -1, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopLeftRadius: radii.lg },
  tr: { top: -1, right: -1, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopRightRadius: radii.lg },
  bl: { bottom: -1, left: -1, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomLeftRadius: radii.lg },
  br: { bottom: -1, right: -1, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: radii.lg },

  hint: { position: 'absolute', left: 0, right: 0, color: 'rgba(255, 255, 255, 0.86)' },

  notice: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderWidth: layout.hairline,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  noticeText: { color: '#FFFFFF' },

  close: {
    position: 'absolute',
    left: layout.gutter,
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },

  permission: { alignItems: 'center', gap: spacing.sm, maxWidth: 340 },
  permissionBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.accentWarm,
  },

  paste: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    backgroundColor: colours.background,
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    minHeight: 54,
    borderRadius: radii.lg,
    backgroundColor: colours.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  fieldInvalid: { borderColor: colours.error },
  input: {
    flex: 1,
    height: '100%',
    color: colours.textPrimary,
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 16,
  },
  pasteAction: { color: colours.accentWarm },
  error: { color: colours.error },
});
