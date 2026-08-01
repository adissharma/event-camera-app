import { useEffect, useState } from 'react';
import { Share, View, Image, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { copy } from '@/i18n';

const COVER_MAP: Record<string, ReturnType<typeof require>> = {
  modern:      require('../../../../assets/images/placeholders/christian_wedding.png'),
  classic:     require('../../../../assets/images/placeholders/christian_wedding.png'),
  retro:       require('../../../../assets/images/placeholders/treatment_preview_1.png'),
  film:        require('../../../../assets/images/placeholders/treatment_preview_1.png'),
  editorial:   require('../../../../assets/images/placeholders/treatment_preview_2.png'),
  documentary: require('../../../../assets/images/placeholders/gallery_blurred_half.png'),
  vibrant:     require('../../../../assets/images/placeholders/hindu_wedding.png'),
};

const GALLERY_PRESETS = [
  { id: 'preset_1', source: require('../../../../assets/images/placeholders/christian_wedding.png') },
  { id: 'preset_2', source: require('../../../../assets/images/placeholders/hindu_wedding.png') },
  { id: 'preset_3', source: require('../../../../assets/images/placeholders/treatment_preview_1.png') },
  { id: 'preset_4', source: require('../../../../assets/images/placeholders/treatment_preview_2.png') },
];

export default function SuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
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

  function getCoverSource() {
    const sum = result.celebrationId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return GALLERY_PRESETS[sum % GALLERY_PRESETS.length].source;
  }

  const shareMessage = `You've been invited to ${result.eventName || 'our event'}!\n\nEvent Code: ${result.eventCode}\n\n${result.guestUrl}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colours.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 200 }}
    >
      {/* Hero Section with Cover Image */}
      <View style={{ height: 400, position: 'relative', overflow: 'hidden' }}>
        <Image
          source={getCoverSource()}
          style={{
            width: '100%',
            height: '100%',
          }}
          resizeMode="cover"
        />
        {/* Dark scrim overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        />

        {/* Content overlay */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            IT'S HAPPENING
          </AppText>
          <AppText variant="displayHero" numberOfLines={3}>
            {result.eventName}
          </AppText>
        </View>
      </View>

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
