import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/components/layout/screen';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import { celebrationDetailKeys } from '@/services/celebration-detail';
import {
  fetchHostGuestbook,
  upsertGuestbookInstructions,
} from '@/services/guestbook';
import { shouldBlockHostRouteOnWeb } from '@/lib/platform-guards';

function BackChevron({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const MAX_INSTRUCTIONS = 180;
const GUESTBOOK_ICONS = ['💌', '🎁', '💛', '🌟', '💫', '🌸'] as const;

export default function GuestbookSettingsScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState('');
  const [icon, setIcon] = useState('💌');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (shouldBlockHostRouteOnWeb(Platform.OS)) {
      router.replace(`/celebration/${celebrationId}`);
    }
  }, [router, celebrationId]);

  const { data, isLoading } = useQuery({
    queryKey: ['guestbook', 'host', String(celebrationId)],
    queryFn: () => fetchHostGuestbook(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  useEffect(() => {
    if (data?.guestbook.instructions) {
      setInstructions(data.guestbook.instructions);
    }
    if (data?.guestbook.icon) setIcon(data.guestbook.icon);
  }, [data?.guestbook.instructions, data?.guestbook.icon]);

  const trimmed = instructions.trim();
  const hasChanges = useMemo(
    () => trimmed !== (data?.guestbook.instructions ?? '').trim() || icon !== (data?.guestbook.icon ?? '💌'),
    [data?.guestbook.instructions, data?.guestbook.icon, trimmed, icon],
  );

  async function handleSave() {
    if (!celebrationId) return;
    setIsSaving(true);
    try {
      await upsertGuestbookInstructions(String(celebrationId), trimmed, icon);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'host', String(celebrationId)] }),
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'guest', String(celebrationId)] }),
        queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.detail(String(celebrationId)) }),
      ]);
      router.back();
    } catch (error) {
      console.error('[guestbook-settings] failed to save instructions', error);
      Alert.alert('Error', 'Could not save your Guestbook message.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !data) {
    return (
      <Screen scrollable={false}>
        <View style={styles.loading}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      stickyAction={
        <Button
          label={isSaving ? 'Saving…' : 'Save'}
          loading={isSaving}
          onPress={() => void handleSave()}
          disabled={!hasChanges}
          disabledReason="Make a change before saving."
          haptic
        />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <BackChevron />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <AppText variant="displaySmall" style={styles.title}>
          Guestbook
        </AppText>
        <AppText variant="bodyMedium" tone="secondary" style={styles.subtitle}>
          Edit the short note guests see before they leave a private audio or video message for you.
        </AppText>
      </View>

      <View style={styles.card}>
        <AppText variant="labelLarge" style={styles.fieldLabel}>Guestbook icon</AppText>
        <View style={styles.iconRow}>
          {GUESTBOOK_ICONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setIcon(option)}
              style={[styles.iconOption, icon === option && styles.iconOptionSelected]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${option} as the Guestbook icon`}
            >
              <AppText style={styles.iconText}>{option}</AppText>
            </Pressable>
          ))}
        </View>
        <TextField
          label="Guest message"
          value={instructions}
          onChangeText={(value) => setInstructions(value)}
          placeholder="Leave a message for the host."
          multiline
          maxLength={MAX_INSTRUCTIONS}
          hint={`${instructions.length} of ${MAX_INSTRUCTIONS} characters`}
          inputStyle={styles.input}
          containerStyle={{ gap: spacing.sm }}
        />
      </View>

      <View style={styles.note}>
        <AppText variant="caption" tone="secondary">
          Guests will always see the title “Guestbook” and the CTA “Leave a message”.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    color: colours.textPrimary,
  },
  subtitle: {
    maxWidth: 520,
  },
  card: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    padding: spacing.base,
  },
  fieldLabel: {
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.background,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
  },
  iconOptionSelected: {
    borderColor: colours.textPrimary,
    backgroundColor: colours.surfaceRaised,
  },
  iconText: {
    fontSize: 22,
  },
  input: {
    minHeight: 132,
    paddingTop: spacing.base,
    textAlignVertical: 'top',
  },
  note: {
    marginTop: spacing.lg,
  },
});
