import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';

import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { DeviceFrame } from '@/components/media/device-frame';
import { GuestCoverPreview } from '@/features/celebrations/creation/guest-cover-preview';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { listThemes, themeKeys } from '@/services/themes';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

export default function CoverStep() {
  const { draft, update } = useCreationDraft();
  const [pickerError, setPickerError] = useState<string | undefined>();

  const { data: themes = [] } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
  });

  async function pickImage(source: 'library' | 'camera') {
    setPickerError(undefined);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      // Explains what to do rather than only reporting refusal.
      setPickerError(
        source === 'camera'
          ? 'Allow camera access in Settings to take a cover photo.'
          : 'Allow photo access in Settings to choose a cover.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.9,
          });

    if (!result.canceled && result.assets[0]) {
      // Stored as a local URI only. The upload happens at publication, so a
      // host who abandons the draft has not consumed storage.
      update({ coverLocalUri: result.assets[0].uri });
    }
  }

  return (
    <CreationStepScreen
      step="cover"
      heading={copy.create.coverHeading}
      supporting={copy.create.coverSupporting}
    >
      <View style={{ gap: spacing.xl }}>
        {/* Deliberately smaller than the review screen's frame. Measured on a
            375pt device: at the default width the frame pushed every control
            below the fold, so the host had to scroll away from the preview to
            change the thing they were previewing. */}
        <DeviceFrame width={168}>
          <GuestCoverPreview draft={draft} />
        </DeviceFrame>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label={copy.create.choosePhoto}
            variant="secondary"
            size="medium"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => void pickImage('library')}
          />
          <Button
            label={copy.create.takePhoto}
            variant="secondary"
            size="medium"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => void pickImage('camera')}
          />
        </View>

        {draft.coverLocalUri ? (
          <Button
            label={copy.create.removePhoto}
            variant="quiet"
            size="small"
            fullWidth={false}
            onPress={() => update({ coverLocalUri: null })}
          />
        ) : null}

        {pickerError ? (
          <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
            {pickerError}
          </AppText>
        ) : null}

        {themes.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="secondary">
              Theme
            </AppText>
            {/* Horizontal, so choosing a theme never pushes the preview off
                screen — the whole point is watching the preview change. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              {themes.map((theme) => {
                const selected = draft.themeSlug === theme.slug;
                return (
                  <Button
                    key={theme.slug}
                    label={theme.name}
                    variant={selected ? 'primary' : 'secondary'}
                    size="small"
                    fullWidth={false}
                    onPress={() => update({ themeSlug: theme.slug })}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: spacing.base }}>
          <TextField
            label="Supporting line"
            placeholder="Add your photos to our day"
            value={draft.supportingLine}
            onChangeText={(supportingLine) => update({ supportingLine })}
            maxLength={140}
            hint="Sits under the title on the guest cover."
          />
        </View>

        <View
          style={{
            padding: spacing.base,
            borderRadius: radii.lg,
            borderWidth: layout.hairline,
            borderColor: colours.borderSubtle,
            backgroundColor: colours.surface,
            gap: spacing.xxs,
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            Camera and gallery previews
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            You will see the full guest experience — camera, counter and gallery — on
            the review step.
          </AppText>
        </View>
      </View>
    </CreationStepScreen>
  );
}
