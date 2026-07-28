import { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing, typography } from '@/design';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Always visible. Placeholder-only labelling disappears exactly when needed. */
  label: string;
  /** Shown under the field until an error replaces it. */
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle;
  /** Renders the field at display scale — used for the event name. */
  editorial?: boolean;
  /** Extra styling for the input itself, e.g. tracking on a code field. */
  inputStyle?: TextStyle;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, containerStyle, editorial = false, inputStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>

      <TextInput
        ref={ref}
        accessibilityLabel={label}
        // Announced together with the label, so a screen-reader user hears the
        // problem rather than only that the field is invalid.
        accessibilityHint={error ?? hint}
        placeholderTextColor={colours.textSecondary}
        selectionColor={colours.brandPrimary}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        style={[
          editorial ? typography.titleLarge : typography.bodyLarge,
          {
            color: colours.textPrimary,
            backgroundColor: colours.surface,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.base,
            paddingVertical: editorial ? spacing.base : spacing.md,
            minHeight: layout.minTouchTarget,
            // Width, not just colour: the focus and error states must survive
            // being seen by someone who cannot distinguish the hues.
            borderWidth: isFocused || hasError ? 2 : layout.hairline,
            borderColor: hasError
              ? colours.error
              : isFocused
                ? colours.focusRing
                : colours.borderStrong,
          },
          inputStyle,
        ]}
        {...rest}
      />

      {hasError ? (
        <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
