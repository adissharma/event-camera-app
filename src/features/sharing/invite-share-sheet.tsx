import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { BRAND_CONFIG } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { CopyIcon, ShareIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { colours, radii, spacing } from '@/design';
import { QrCard } from './qr-card';

interface InviteShareSheetProps {
  visible: boolean;
  eventName: string;
  eventCode?: string | null;
  bottomInset?: number;
  onClose: () => void;
}

export function buildInvitationUrl(eventCode: string): string {
  return `${BRAND_CONFIG.guestDomain}/j/${eventCode}`;
}

export function InviteShareSheet({
  visible,
  eventName,
  eventCode,
  bottomInset = 0,
  onClose,
}: InviteShareSheetProps) {
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const invitationUrl = useMemo(
    () => (eventCode ? buildInvitationUrl(eventCode) : null),
    [eventCode],
  );

  function showNotice(text: string, tone: 'success' | 'error' = 'success') {
    setNotice({ text, tone });
    // An error is worth reading; a confirmation is not.
    setTimeout(() => setNotice(null), tone === 'error' ? 4000 : 1800);
  }

  /**
   * Reports a failure wherever the viewer can actually see it.
   *
   * `Alert.alert` is a no-op on react-native-web — literally `static alert() {}`
   * — so every failure path that relied on it told web users nothing at all:
   * the button appeared to do nothing. Native keeps the system alert it has
   * always shown; web falls back to the sheet's own inline notice.
   */
  function reportFailure(title: string, message: string) {
    if (Platform.OS === 'web') {
      showNotice(message, 'error');
      return;
    }
    Alert.alert(title, message);
  }

  /** Resolves true when the link actually reached the clipboard. */
  async function copyInvitationLink(): Promise<boolean> {
    if (!invitationUrl) return false;

    const webNavigator = globalThis.navigator as Navigator & {
      clipboard?: { writeText?: (text: string) => Promise<void> };
    };

    // Web has two independent clipboard paths, and the modern one is not the
    // reliable one. `navigator.clipboard.writeText` rejects in plenty of
    // ordinary situations — a denied permission, a non-secure origin,
    // Safari's stricter gesture rules — whereas `expo-clipboard` falls back
    // internally to `document.execCommand('copy')`, which still works in
    // several of them. Treating the first rejection as fatal, as this did,
    // gave up while a working path sat unused. That mattered twice over:
    // `navigator.share` is absent on most desktop browsers, so Share
    // Invitation lands here too, and a single rejection took out both
    // actions at once.
    if (Platform.OS === 'web' && typeof webNavigator.clipboard?.writeText === 'function') {
      try {
        await webNavigator.clipboard.writeText(invitationUrl);
        showNotice('Invitation link copied');
        return true;
      } catch {
        // Fall through to the more forgiving path below.
      }
    }

    try {
      await Clipboard.setStringAsync(invitationUrl);
      showNotice('Invitation link copied');
      return true;
    } catch {
      reportFailure(
        'Copy unavailable',
        'We could not copy the invitation link. You can select the link above and copy it manually.',
      );
      return false;
    }
  }

  async function shareInvitationLink() {
    if (!invitationUrl) return;
    const message = `Join "${eventName}" on ${BRAND_CONFIG.appName} → ${invitationUrl}`;

    try {
      if (Platform.OS === 'web') {
        const webNavigator = globalThis.navigator as Navigator & {
          share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
        };

        if (typeof webNavigator.share === 'function') {
          await webNavigator.share({
            title: eventName,
            text: message,
            url: invitationUrl,
          });
          return;
        }

        // No Web Share API — most desktop browsers. Copying the link is the
        // closest equivalent, and `copyInvitationLink` reports its own
        // outcome either way.
        await copyInvitationLink();
        return;
      }

      await Share.share({ message });
    } catch {
      if (Platform.OS === 'web') {
        await copyInvitationLink();
      } else {
        Alert.alert('Share unavailable', 'We could not open the share sheet. Please copy the invitation link instead.');
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={S.modalOverlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[S.modalSheet, { paddingBottom: bottomInset + spacing.xl }]}
        >
          <View style={S.sheetHandle} />

          <View style={S.inviteHeader}>
            <AppText variant="titleLarge" style={S.inviteTitle}>
              Invite Guests
            </AppText>
            <AppText variant="bodySmall" tone="secondary" style={S.inviteSubtitle}>
              Scan the QR code or share the invitation to join.
            </AppText>
          </View>

          {invitationUrl ? (
            <QrCard
              value={invitationUrl}
              eventName={eventName}
              footer={
                <View style={S.inviteCodeRow}>
                  <View style={S.inviteCodeTitleWrap}>
                    <AppText variant="eyebrow" style={S.inviteCodeLabel}>
                      INVITE LINK
                    </AppText>
                  </View>
                  <View style={S.inviteCodeDividerRow}>
                    <View style={S.inviteCodeDivider} />
                  </View>
                  <View style={S.inviteCodeActionRow}>
                    <AppText variant="bodyLarge" style={S.inviteLinkValue} numberOfLines={1} ellipsizeMode="middle">
                      {invitationUrl}
                    </AppText>
                    <Pressable
                      onPress={() => void copyInvitationLink()}
                      accessibilityRole="button"
                      accessibilityLabel="Copy invitation link"
                      hitSlop={8}
                      style={({ pressed }) => [S.inviteCopyButton, pressed && { opacity: 0.88 }]}
                    >
                      <CopyIcon size={16} color="#FFFFFF" />
                      <AppText variant="labelSmall" style={S.inviteCopyLabel}>
                        Copy Link
                      </AppText>
                    </Pressable>
                  </View>
                  {notice ? (
                    <AppText
                      variant="caption"
                      style={[
                        S.copyNotice,
                        { color: notice.tone === 'error' ? colours.error : colours.success },
                      ]}
                    >
                      {notice.text}
                    </AppText>
                  ) : null}
                </View>
              }
            />
          ) : null}

          <Button
            label="Share Invitation"
            variant="primary"
            size="medium"
            leading={<ShareIcon size={18} color={colours.textOnBrand} />}
            onPress={shareInvitationLink}
          />
          <Pressable
            style={S.shareClose}
            onPress={onClose}
            accessibilityRole="button"
          >
            <AppText variant="bodySmall" tone="secondary">Close</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,5,6,0.88)',
    justifyContent: 'flex-end',
    // Keeps the sheet centred once it stops filling the viewport — see the
    // `maxWidth` below, which is the only case where that happens.
    alignItems: 'center',
  },
  modalSheet: {
    backgroundColor: '#09090A',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: 24,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    maxHeight: '92%',
    width: '100%',
    /**
     * A bottom sheet is proportioned for a phone. Left unbounded it spans
     * whatever it is given, and in a desktop browser that is the entire
     * window — which strands the invite link against the far left edge, sends
     * its own Copy button a thousand pixels away to the right, and turns
     * `Share Invitation` into a full-width bar. The result reads as a page
     * footer rather than as the same sheet iOS shows.
     *
     * Deliberately a plain `maxWidth` rather than a `Platform.OS === 'web'`
     * branch: the app is phone-only on iOS (`supportsTablet: false`) and the
     * widest phone it runs on is 440pt, so this is a no-op on every native
     * device and on mobile web. It only ever engages on a wide browser
     * window, which is precisely where the layout needed adapting.
     */
    maxWidth: 480,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  inviteHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  inviteTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 34,
    marginBottom: 2,
  },
  inviteSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  inviteCodeRow: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  inviteCodeTitleWrap: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inviteCodeDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteCodeDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  inviteCodeActionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 0,
  },
  inviteCodeLabel: {
    color: 'rgba(255,255,255,0.56)',
    textAlign: 'center',
    letterSpacing: 3,
  },
  inviteLinkValue: {
    flex: 1,
    color: '#F1E7DA',
    textAlign: 'left',
    fontSize: 14,
    lineHeight: 20,
  },
  inviteCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  inviteCopyLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  copyNotice: {
    textAlign: 'center',
  },
  shareClose: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
