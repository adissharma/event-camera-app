import { useEffect, useState } from 'react';
import { Share, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  clearPublicationResult,
  getPublicationResult,
} from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { colours, layout, radii, spacing } from '@/design';

export default function SuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reset } = useCreationDraft();
  const [copied, setCopied] = useState(false);

  const result = getPublicationResult();

  useEffect(() => {
    void reset();
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    return () => clearPublicationResult();
  }, [reset, queryClient]);

  if (!result) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <AppText variant="displayLarge">Nothing to show</AppText>
      </View>
    );
  }

  const shareMessage = `You've been invited to ${result.eventName || 'our event'}!\n\nEvent Code: ${result.eventCode}\n\n${result.guestUrl}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colours.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 200 }}
    >
      {/* Hero Section with Gradient */}
      <LinearGradient
        colors={['rgba(139, 90, 43, 0.4)', 'rgba(101, 67, 33, 0.6)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 360, justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
      >
        <AppText variant="eyebrow" tone="secondary">
          IT'S HAPPENING
        </AppText>
        <AppText variant="displayHero" numberOfLines={3}>
          {result.eventName}
        </AppText>
      </LinearGradient>

      {/* Content Section */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          gap: spacing.xl,
        }}
      >
        {/* Event Code Card */}
        <Reveal index={0} step={70} style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">Event Code</AppText>
          <Pressable
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colours.surface,
              borderWidth: layout.hairline,
              borderColor: colours.borderSubtle,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
            onPress={async () => {
              await Clipboard.setStringAsync(result.eventCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <AppText
              variant="displayLarge"
              style={{ fontFamily: 'InstrumentSans_700Bold', letterSpacing: 3 }}
            >
              {result.eventCode}
            </AppText>
            <AppText variant="labelSmall" tone="secondary">
              {copied ? '✓' : 'copy'}
            </AppText>
          </Pressable>
        </Reveal>

        {/* Guest Link Card */}
        <Reveal index={1} step={70} style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">Guest Link</AppText>
          <Pressable
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colours.surface,
              borderWidth: layout.hairline,
              borderColor: colours.borderSubtle,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onPress={async () => {
              await Clipboard.setStringAsync(result.guestUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <AppText
              variant="labelSmall"
              tone="secondary"
              style={{ flex: 1, marginRight: spacing.sm }}
              numberOfLines={1}
            >
              {result.guestUrl.replace('http://', '').replace('https://', '')}
            </AppText>
            <AppText variant="labelSmall" tone="secondary">
              {copied ? '✓' : 'copy'}
            </AppText>
          </Pressable>
        </Reveal>

        {/* Action Buttons */}
        <Reveal index={2} step={70} style={{ gap: spacing.sm }}>
          <Button
            label="Share Event"
            onPress={() => {
              void Share.share({ message: shareMessage }).catch(() => {});
            }}
          />
          <Button
            label="Go to Event"
            variant="secondary"
            onPress={() => router.replace(`/celebration/${result.celebrationId}` as never)}
          />
        </Reveal>
      </View>
    </ScrollView>
  );
}
