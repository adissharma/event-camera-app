import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { ImageIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/forms/text-field';
import { ThemeCarousel } from '@/features/celebrations/creation/theme-carousel';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { listCoverTemplateThemes, themeKeys } from '@/services/themes';
import { LOCALE_CONFIG } from '@/config/app-config';
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
  const [editing, setEditing] = useState(false);
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

  async function pickImage(source: 'library' | 'camera') {
    setPermissionError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // Says what to do, not merely that it was refused.
      setPermissionError(
        source === 'camera'
          ? 'Allow camera access in Settings to take a cover photo.'
          : 'Allow photo access in Settings to choose a cover.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [9, 16], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({
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

  const formattedClosingDate = draft.endsAt
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: draft.timezone,
      }).format(new Date(draft.endsAt))
    : 'Add a date';

  return (
    <CreationStepScreen
      step="cover"
      heading={copy.create.coverHeading}
      // The carousel scrolls horizontally and fills the remaining height.
      scrollable={false}
      onSave={handleSave}
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

        {/* Secondary — sits well below the primary Next action in the sticky
            footer, so it never competes with it. */}
        <Button
          label="+ Add cover photo"
          variant="secondary"
          size="medium"
          onPress={() => setEditing(true)}
        />
      </View>

      <BottomSheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Cover photo"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ gap: spacing.base }}
        >
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="secondary">
              Photo
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={draft.coverLocalUri ? 'Change photo' : 'Add photo'}
                  variant="secondary"
                  size="medium"
                  leading={<ImageIcon size={16} color={colours.brandPrimary} />}
                  onPress={() => void pickImage('library')}
                />
              </View>
              {draft.coverLocalUri ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={copy.create.removePhoto}
                    variant="quiet"
                    size="medium"
                    onPress={() => {
                      // Clears both halves: this is the one place a cover is
                      // deliberately removed, so it is the one place allowed
                      // to produce a null path for `handleSave` to persist.
                      update({ coverLocalUri: null, coverStoragePath: null });
                    }}
                  />
                </View>
              ) : null}
            </View>
          </View>

          <TextField
            label="Date subtitle"
            value={draft.coverDateLabel ?? ''}
            onChangeText={(text) => update({ coverDateLabel: text.length > 0 ? text : null })}
            placeholder={formattedClosingDate}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => setEditing(false)}
          />

          {permissionError ? (
            <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
              {permissionError}
            </AppText>
          ) : null}
          <Button label={copy.common.done} onPress={() => setEditing(false)} />
        </KeyboardAvoidingView>
      </BottomSheet>
    </CreationStepScreen>
  );
}
