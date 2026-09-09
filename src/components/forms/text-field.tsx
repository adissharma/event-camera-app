import { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, layout, radii, spacing, typography } from '@/design';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /**
   * Visible above the field when present.
   *
   * Normally required, because placeholder-only labelling disappears exactly
   * when the user needs it — the moment they start typing. Optional only for
   * a field whose screen title already names it, where a label would be the
   * same word twice on a screen with one input. Accessibility still needs a
   * name, so the placeholder stands in when this is absent.
   */
  label?: string;
  /** Shown under the field until an error replaces it. */
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle;
  /** Renders the field at display scale — used for the event name. */
  editorial?: boolean;
  /** Extra styling for the input itself, e.g. tracking on a code field. */
  inputStyle?: TextStyle;
}

/**
 * The editorial input's own type.
 *
 * Not `typography.titleLarge`, which is the display face: a field set in the
 * same font as the heading above it competes with that heading instead of
 * reading as the thing you type into. Instrument Sans keeps the hierarchy —
 * the title speaks, the field answers.
 *
 * `lineHeight` is deliberately absent. On iOS a `TextInput` clips glyphs that
 * descend below its line box rather than letting them overhang, so a
 * lineHeight tight enough to look right in static text cut the tails off g, p
 * and y. Leaving it unset lets the platform use the font's own metrics, which
 * have room for descenders by construction.
 */
const EDITORIAL_INPUT = {
  fontFamily: fontFamilies.textRegular,
  fontSize: 24,
  letterSpacing: -0.2,
} as const;

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, containerStyle, editorial = false, inputStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);
  const autoCapitalize = rest.autoCapitalize ?? 'sentences';

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      {label ? (
        <AppText variant="label" tone="secondary">
          {label}
        </AppText>
      ) : null}

      <TextInput
        ref={ref}
        // Falls back to the placeholder when there is no visible label, so the
        // field is never announced as unnamed.
        accessibilityLabel={label ?? rest.placeholder}
        // Announced together with the label, so a screen-reader user hears the
        // problem rather than only that the field is invalid.
        accessibilityHint={error ?? hint}
        placeholderTextColor={colours.textSecondary}
        selectionColor={colours.brandPrimary}
        autoCapitalize={autoCapitalize}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        style={[
          editorial ? EDITORIAL_INPUT : typography.bodyLarge,
          {
            color: colours.textPrimary,
            backgroundColor: colours.surface,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.base,
            // Generous on the editorial field: a 24pt face needs the room, and
            // iOS measures a TextInput's content box tightly.
            paddingVertical: editorial ? spacing.md + spacing.xs : spacing.md,
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
