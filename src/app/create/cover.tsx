import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { ThemeCarousel } from '@/features/celebrations/creation/theme-carousel';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { listCoverTemplateThemes, themeKeys } from '@/services/themes';
import { colours, spacing } from '@/design';
import { copy } from '@/i18n';
import { uploadCover } from '@/services/publication';
import { isLocalImageUri } from '@/features/media/storage-paths';
import { updateEventSettings } from '@/services/celebration-detail';
import { isBackendConfigured } from '@/lib/supabase/client';

/**
 * The cover step.
 *
 * Deliberately almost nothing but the preview: a swipeable carousel of the
 * three cover templates, each rendered as a live, to-scale miniature of the
 * guest join screen. Choosing a cover photo is a separate flow reached via
 * "+ Add cover photo" below the carousel; the event name is not editable from
 * here at all — that belongs to the name step, not the cover step.
 */
export default function CoverStep() {
  const { draft, update } = useCreationDraft();
  const router = useRouter();
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function handleSave() {
    if (!draft.editCelebrationId || !draft.editSessionId) return;

    // Only ever writes what the draft actually holds. It used to null the
    // path whenever `coverLocalUri` was empty, which inferred "the host
    // removed their photo" from "there is no local file in the draft" — two
    // very different things. Saving this step before the draft had finished
    // seeding from the server, or after any change that cleared the local
    // URI, therefore wiped a perfectly good cover and dropped the event back
    // to the default image. Removal is now explicit: the Remove button below
    // clears `coverStoragePath` itself, and that null is what gets saved.
    let path = draft.coverStoragePath;
    if (draft.coverLocalUri && isLocalImageUri(draft.coverLocalUri)) {
      path = isBackendConfigured
        ? await uploadCover(draft.coverLocalUri, draft.editCelebrationId)
        : draft.coverLocalUri;
    }

    await updateEventSettings(draft.editCelebrationId, draft.editSessionId, {
      title: draft.title,
      coverStoragePath: path,
      themeSlug: draft.themeSlug,
    });
    update({ coverStoragePath: path, coverLocalUri: path });
  }

  const { data: themes = [], isLoading, isError, refetch } = useQuery({
    queryKey: themeKeys.curated(),
    queryFn: listCoverTemplateThemes,
  });

  async function pickImage() {
    setPermissionError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // Says what to do, not merely that it was refused.
      setPermissionError('Allow photo access in Settings to choose a cover.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // A local URI only. The upload happens at publication, so a host who
      // abandons the draft has consumed no storage.
      update({ coverLocalUri: result.assets[0].uri });
    }
  }

  return (
    <CreationStepScreen
      step="cover"
      heading={copy.create.coverHeading}
      headingAlign="center"
      // The carousel scrolls horizontally and fills the remaining height.
      scrollable={false}
      onSave={handleSave}
      action={
        draft.editCelebrationId ? undefined : (
          // Skipping is the primary action because it is what most hosts do
          // at this point — a cover can be added any time afterwards, and
          // burying the way forward under the optional step made the screen
          // feel like a demand. Adding a photo keeps equal weight beside it
          // rather than being a link a thumb has to hunt for.
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={draft.coverLocalUri ? 'Change photo' : copy.create.coverAddPhoto}
                  variant="secondary"
                  onPress={() => void pickImage()}
                  haptic
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={draft.coverLocalUri ? copy.common.next : copy.create.coverAddLater}
                  onPress={() => router.push('/create/photo-limit')}
                  haptic
                />
              </View>
            </View>
            {permissionError ? (
              <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
                {permissionError}
              </AppText>
            ) : null}
          </View>
        )
      }
    >
      {/* Pulled up slightly now that there's no supporting line beneath the
          heading, so the carousel gets more of the screen rather than the gap
          growing to fill the space on its own. */}
      <View style={{ flex: 1, marginTop: -spacing.lg, gap: spacing.base }}>
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colours.textSecondary} />
            </View>
          ) : isError || themes.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.base,
                padding: spacing.lg,
              }}
            >
              <AppText variant="body" tone="error" style={{ textAlign: 'center' }}>
                Failed to load themes. Please check your network connection and try again.
              </AppText>
              <Button label="Retry" onPress={() => void refetch()} />
            </View>
          ) : (
            <ThemeCarousel
              draft={draft}
              themes={themes}
              selectedSlug={
                themes.find((theme) => theme.slug === draft.themeSlug || theme.id === draft.themeSlug)?.slug ??
                themes[0]?.slug ??
                null
              }
              onSelect={(themeSlug) => update({ themeSlug })}
            />
          )}
        </View>

      </View>
    </CreationStepScreen>
  );
}
