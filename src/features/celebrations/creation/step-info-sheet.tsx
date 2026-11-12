import { View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { spacing } from '@/design';
import type { StepInfo } from './step-info';

/** A step explained in a line or two. */
export function StepInfoSheet({
  info,
  visible,
  onClose,
  showChangeLater,
}: {
  info: StepInfo;
  visible: boolean;
  onClose: () => void;
  /**
   * Every step with an info sheet can be edited from Manage Event after the
   * event is live, so a new host is told so. Off while editing a live event,
   * where "later" is now.
   */
  showChangeLater: boolean;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={info.title}>
      <View style={{ gap: spacing.sm }}>
        {info.lines.map((line) => (
          <AppText key={line} variant="body">
            {line}
          </AppText>
        ))}
        {showChangeLater ? (
          <AppText variant="body" tone="secondary">
            Not sure yet? You can change this later from Manage Event.
          </AppText>
        ) : null}
      </View>

      <Button label="Got it" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}
