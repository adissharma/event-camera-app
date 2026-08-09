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
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const invitationUrl = useMemo(
    () => (eventCode ? buildInvitationUrl(eventCode) : null),
    [eventCode],
  );

  async function copyInvitationLink() {
    if (!invitationUrl) return;

    try {
      if (Platform.OS === 'web') {
        const webNavigator = globalThis.navigator as Navigator & {
          clipboard?: { writeText?: (text: string) => Promise<void> };
        };

        if (typeof webNavigator.clipboard?.writeText === 'function') {
          await webNavigator.clipboard.writeText(invitationUrl);
        } else {
          await Clipboard.setStringAsync(invitationUrl);
        }
      } else {
        await Clipboard.setStringAsync(invitationUrl);
      }

      setCopyNotice('Invitation link copied');
      setTimeout(() => setCopyNotice(null), 1800);
    } catch {
      Alert.alert('Copy unavailable', 'We could not copy the invitation link. Please try again.');
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
                  {copyNotice ? (
                    <AppText variant="caption" style={S.copyNotice}>
                      {copyNotice}
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
  },
  modalSheet: {
    backgroundColor: '#09090A',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: 24,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    maxHeight: '92%',
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
    color: colours.success,
    textAlign: 'center',
  },
  shareClose: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});
