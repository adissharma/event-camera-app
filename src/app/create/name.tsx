import { useRef, useState } from 'react';
import { Pressable, View, type TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  GENERIC_SUGGESTIONS,
  suggestionsFor,
  type NameSuggestion,
} from '@/features/celebrations/creation/name-suggestions';
import { fetchMyProfile, firstNameFrom, profileKeys } from '@/services/profile';
import { colours, radii, spacing } from '@/design';
import { copy } from '@/i18n';

export default function NameStep() {
  const { draft, update } = useCreationDraft();
  const inputRef = useRef<TextInput>(null);

  /**
   * Cursor position, applied for a single render after a suggestion is tapped.
   *
   * Held only transiently: leaving `selection` controlled permanently fights
   * the user, because every keystroke would snap the caret back to where the
   * suggestion put it.
   */
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
  });

  const firstName = firstNameFrom(profile);
  const suggestions = firstName ? suggestionsFor(firstName) : GENERIC_SUGGESTIONS;

  function applySuggestion(suggestion: NameSuggestion) {
    void Haptics.selectionAsync().catch(() => {});
    update({ title: suggestion.value });

    const caret = suggestion.cursorAt ?? suggestion.value.length;
    setSelection({ start: caret, end: caret });
    inputRef.current?.focus();
  }

  return (
    <CreationStepScreen
      step="name"
      heading={copy.create.nameHeading}
      headingAlign="center"
      scrollable={false}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <TextField
          ref={inputRef}
          placeholder={copy.create.namePlaceholder}
          value={draft.title}
          onChangeText={(title) => {
            update({ title });
            // Release control the moment the host types, so the caret behaves
            // normally from then on.
            setSelection(undefined);
          }}
          selection={selection}
          onSelectionChange={() => setSelection(undefined)}
          editorial
          hideBorderWhenUnfocused
          autoCapitalize="sentences"
          maxLength={200}
          returnKeyType="done"
        />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" tone="secondary" align="center">
            {firstName ? 'Suggestions' : 'Common occasions'}
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            {suggestions.map((suggestion) => (
              <SuggestionChip
                key={suggestion.value}
                suggestion={suggestion}
                onPress={() => applySuggestion(suggestion)}
              />
            ))}
          </View>
        </View>
      </View>
    </CreationStepScreen>
  );
}

function SuggestionChip({
  suggestion,
  onPress,
}: {
  suggestion: NameSuggestion;
  onPress: () => void;
}) {
  // The chip reads as one phrase to a screen reader, with the blank described
  // rather than rendered as punctuation a screen reader would spell out.
  const spokenLabel = suggestion.gapLabel
    ? `${suggestion.label} name ${suggestion.labelSuffix ?? ''}`.trim()
    : suggestion.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenLabel}
      accessibilityHint="Fills the event name"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 40,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        // Fill alone, no outline — the same treatment secondary buttons now
        // use, so a screen of quiet options reads as one family.
        backgroundColor: colours.surface,
      }}
    >
      <AppText variant="bodySmall">{suggestion.label}</AppText>

      {suggestion.gapLabel ? (
        <>
          {/* The blank. Muted and underlined so it reads as something to fill
              in, rather than as part of the name itself. */}
          <View
            style={{
              minWidth: 34,
              marginHorizontal: 2,
              borderBottomWidth: 1,
              borderBottomColor: colours.borderStrong,
              alignItems: 'center',
            }}
          >
            <AppText variant="bodySmall" tone="secondary">
              {suggestion.gapLabel}
            </AppText>
          </View>
          {suggestion.labelSuffix ? (
            <AppText variant="bodySmall">{suggestion.labelSuffix}</AppText>
          ) : null}
        </>
      ) : null}
    </Pressable>
  );
}
