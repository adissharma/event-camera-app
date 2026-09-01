import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colours, spacing } from '@/design';
import { AppText } from '@/components/ui/text';

export interface LoadingStateProps {
  label: string;
  detail?: string;
  tone?: 'default' | 'onDark';
}

/** A real loading state, distinct from an empty result. */
export function LoadingState({ label, detail, tone = 'default' }: LoadingStateProps) {
  const isOnDark = tone === 'onDark';
  const textColor = isOnDark ? '#FFFFFF' : colours.textPrimary;
  const detailColor = isOnDark ? 'rgba(255, 255, 255, 0.72)' : colours.textSecondary;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={S.root}
    >
      <ActivityIndicator color={isOnDark ? '#FFFFFF' : colours.brandPrimary} />
      <View style={S.copy}>
        <AppText variant="labelLarge" style={{ color: textColor }}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="bodySmall" align="center" style={{ color: detailColor }}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.giant,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
});
