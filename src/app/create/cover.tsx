import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { ThemeCarousel } from '@/features/celebrations/creation/theme-carousel';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { listThemes, themeKeys } from '@/services/themes';
import { colours, spacing } from '@/design';
import { copy } from '@/i18n';

type Editing = 'image' | 'title' | 'date' | null;

/**
 * The cover step.
 *
 * Deliberately almost nothing but the preview. Every control that used to sit
 * below it — choose a photo, take a photo, a theme chip row, a supporting-line
 * field — has moved into the cover itself, reachable through a pencil anchored
 * to the thing it changes. The host is looking at what a guest will see, and
 * editing it in place, rather than filling in a form that describes it.
 */
export default function CoverStep() {
  const { draft, update } = useCreationDraft();
  const [editing, setEditing] = useState<Editing>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const { data: themes = [], isLoading } = useQuery({
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
      setEditing(null);
    }
  }

  return (
    <CreationStepScreen
      step="cover"
      heading={copy.create.coverHeading}
      supporting={copy.create.coverSupporting}
      // The carousel scrolls horizontally and fills the remaining height.
      scrollable={false}
    >
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colours.textSecondary} />
          </View>
        ) : (
          <ThemeCarousel
            draft={draft}
            themes={themes}
            selectedSlug={draft.themeSlug ?? themes[0]?.slug ?? null}
            onSelect={(themeSlug) => update({ themeSlug })}
            onEditImage={() => setEditing('image')}
            onEditTitle={() => setEditing('title')}
            onEditDate={() => setEditing('date')}
          />
        )}
      </View>

      <BottomSheet
        visible={editing === 'image'}
        onClose={() => setEditing(null)}
        title="Cover photo"
      >
        <View style={{ gap: spacing.sm }}>
          <Button
            label={copy.create.choosePhoto}
            variant="secondary"
            onPress={() => void pickImage('library')}
          />
          <Button
            label={copy.create.takePhoto}
            variant="secondary"
            onPress={() => void pickImage('camera')}
          />
          {draft.coverLocalUri ? (
            <Button
              label={copy.create.removePhoto}
              variant="quiet"
              onPress={() => {
                update({ coverLocalUri: null });
                setEditing(null);
              }}
            />
          ) : null}

          {permissionError ? (
            <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
              {permissionError}
            </AppText>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={editing === 'title'}
        onClose={() => setEditing(null)}
        title="Event name"
      >
        <View style={{ gap: spacing.base }}>
          <TextField
            label={copy.create.nameLabel}
            placeholder={copy.create.namePlaceholder}
            value={draft.title}
            onChangeText={(title) => update({ title })}
            autoFocus
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={() => setEditing(null)}
          />
          <TextField
            label="Supporting line"
            placeholder="Add your photos to our day"
            value={draft.supportingLine}
            onChangeText={(supportingLine) => update({ supportingLine })}
            maxLength={140}
            hint="Optional. Sits under the name."
          />
          <Button label={copy.common.done} onPress={() => setEditing(null)} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={editing === 'date'}
        onClose={() => setEditing(null)}
        title="Date line"
      >
        <View style={{ gap: spacing.base }}>
          <TextField
            label="What it should say"
            placeholder="15 August 2026"
            value={draft.coverDateLabel ?? ''}
            onChangeText={(text) => update({ coverDateLabel: text.length > 0 ? text : null })}
            autoFocus
            maxLength={60}
            hint="Anything you like. Leave it empty to show your closing date."
            returnKeyType="done"
            onSubmitEditing={() => setEditing(null)}
          />
          <Button label={copy.common.done} onPress={() => setEditing(null)} />
        </View>
      </BottomSheet>
    </CreationStepScreen>
  );
}
