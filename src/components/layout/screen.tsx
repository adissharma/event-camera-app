import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colours, layout, spacing } from '@/design';

export interface ScreenProps {
  children: ReactNode;
  /** Pinned to the bottom above the safe area. Use for the primary action. */
  stickyAction?: ReactNode;
  /** When false, the sticky action stays fixed while the keyboard overlays it. */
  stickyActionFollowsKeyboard?: boolean;
  scrollable?: boolean;
  /** Removes the horizontal gutter so imagery can run edge to edge. */
  edgeToEdge?: boolean;
  contentStyle?: ViewStyle;
  /** Extra bottom padding so content clears the sticky action while scrolling. */
  bottomInsetExtra?: number;
}

/**
 * Standard screen chrome: safe areas, keyboard avoidance and the sticky action.
 *
 * The sticky action sits OUTSIDE the scroll view, so the primary action never
 * scrolls away and never lands under the keyboard — both of which are the usual
 * causes of a mobile form feeling unfinished.
 */
export function Screen({
  children,
  stickyAction,
  stickyActionFollowsKeyboard = true,
  scrollable = true,
  edgeToEdge = false,
  contentStyle,
  bottomInsetExtra = 0,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: edgeToEdge ? 0 : layout.gutter,
    paddingTop: insets.top + spacing.sm,
    paddingBottom:
      (stickyAction ? spacing.xl : insets.bottom + spacing.xl) + bottomInsetExtra,
  };

  const body = scrollable ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
  );

  const stickyActionBlock = stickyAction ? (
    <View
      style={{
        paddingHorizontal: layout.gutter,
        paddingTop: spacing.base,
        paddingBottom: insets.bottom + spacing.base,
        backgroundColor: colours.background,
        borderTopWidth: layout.hairline,
        borderTopColor: colours.borderSubtle,
      }}
    >
      {stickyAction}
    </View>
  ) : null;

  if (!stickyActionFollowsKeyboard) {
    return (
      <View style={{ flex: 1, backgroundColor: colours.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
        {stickyActionBlock}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colours.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
      {stickyActionBlock}
    </KeyboardAvoidingView>
  );
}
