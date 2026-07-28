import { View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

export default function NameStep() {
  const { draft, update } = useCreationDraft();

  return (
    <CreationStepScreen
      step="name"
      heading={copy.create.nameHeading}
      supporting={copy.create.nameSupporting}
    >
      <View style={{ gap: spacing.xl }}>
        <TextField
          label={copy.create.nameLabel}
          placeholder={copy.create.namePlaceholder}
          value={draft.title}
          onChangeText={(title) => update({ title })}
          editorial
          autoFocus
          autoCapitalize="words"
          maxLength={200}
          returnKeyType="done"
        />

        {/* Immediate miniature preview. The point of showing it here is that
            the host sees their name in the guest's typeface at the moment they
            type it, rather than discovering it three steps later. */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary">
            What guests will see
          </AppText>
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              backgroundColor: colours.surface,
              borderWidth: layout.hairline,
              borderColor: colours.borderSubtle,
              gap: spacing.xs,
            }}
          >
            <AppText variant="titleLarge" numberOfLines={2}>
              {draft.title.trim() || copy.create.namePlaceholder}
            </AppText>
            <AppText variant="caption" tone="secondary">
              You are invited to add your photos
            </AppText>
          </View>
        </View>
      </View>
    </CreationStepScreen>
  );
}
