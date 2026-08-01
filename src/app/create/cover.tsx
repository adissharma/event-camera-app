import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
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
import { listThemes, themeKeys } from '@/services/themes';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, spacing } from '@/design';
import { copy } from '@/i18n';
import { uploadCover } from '@/services/publication';
import { updateEventSettings } from '@/services/celebration-detail';
import { isBackendConfigured } from '@/lib/supabase/client';

/**
 * The cover step.
 *
 * Deliberately almost nothing but the preview. Every control that used to sit
 * below it — choose a photo, take a photo, a theme chip row — has moved into a
 * single cover editor opened from the preview itself. The host is looking at
 * what a guest will see, and editing it in place, rather than filling in a
 * form that describes it.
 */
export default function CoverStep() {
  const { draft, update } = useCreationDraft();
  const [editing, setEditing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function handleSave() {
    if (!draft.editCelebrationId || !draft.editSessionId) return;

    let path = draft.coverStoragePath;
    if (draft.coverLocalUri && (draft.coverLocalUri.startsWith('file://') || draft.coverLocalUri.startsWith('/'))) {
      if (isBackendConfigured) {
        path = await uploadCover(draft.coverLocalUri, draft.editCelebrationId);
      } else {
        path = draft.coverLocalUri;
      }
    } else if (!draft.coverLocalUri) {
      path = null;
    }

    await updateEventSettings(draft.editCelebrationId, draft.editSessionId, {
      title: draft.title,
      coverStoragePath: path,
    });
  }

  const { data: themes = [], isLoading, isError, refetch } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
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
      supporting={copy.create.coverSupporting}
      // The carousel scrolls horizontally and fills the remaining height.
      scrollable={false}
      onSave={handleSave}
    >
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
            selectedSlug={draft.themeSlug ?? themes[0]?.slug ?? null}
            onSelect={(themeSlug) => update({ themeSlug })}
            onEditCover={() => setEditing(true)}
          />
        )}
      </View>

      <BottomSheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Edit cover"
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
                      update({ coverLocalUri: null });
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
            returnKeyType="next"
          />

          <TextField
            label={copy.create.nameLabel}
            value={draft.title}
            onChangeText={(title) => update({ title })}
            placeholder={copy.create.namePlaceholder}
            maxLength={200}
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
