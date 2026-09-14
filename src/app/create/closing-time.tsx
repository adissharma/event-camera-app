import { View } from 'react-native';

import { WheelPicker } from '@/components/forms/wheel-picker';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { combineDateAndTime } from '@/components/forms/month-calendar';
import { spacing } from '@/design';
import { copy } from '@/i18n';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = [0, 15, 30, 45];
const PERIODS = ['AM', 'PM'];

function to12Hour(hour: number) {
  return hour % 12 || 12;
}

export default function ClosingTimeStep() {
  const { draft, update } = useCreationDraft();
  const selected = draft.endsAt ? new Date(draft.endsAt) : new Date();
  const hourIndex = HOURS.indexOf(to12Hour(selected.getHours()));
  const minuteIndex = Math.max(0, MINUTES.indexOf(Math.round(selected.getMinutes() / 15) * 15));
  const periodIndex = selected.getHours() >= 12 ? 1 : 0;
  function selectTime(hour: number, minute: number, period: number) {
    const hours24 = (hour % 12) + (period === 1 ? 12 : 0);
    update({ endsAt: combineDateAndTime(selected, hours24, minute).toISOString() });
  }

  return (
    <CreationStepScreen
      step="closing-time"
      heading={copy.create.closingTimeHeading}
      headingAlign="center"
      scrollable={false}
      editDismissTo={draft.editCelebrationId ? `/celebration/${draft.editCelebrationId}/edit` : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <WheelPicker values={HOURS} selectedIndex={hourIndex} onChange={(index) => selectTime(HOURS[index], MINUTES[minuteIndex], periodIndex)} accessibilityLabel="Event end hour" width={68} />
          <WheelPicker values={MINUTES} selectedIndex={minuteIndex} onChange={(index) => selectTime(HOURS[hourIndex], MINUTES[index], periodIndex)} formatValue={(value) => String(value).padStart(2, '0')} accessibilityLabel="Event end minute" width={68} />
          <WheelPicker values={PERIODS} selectedIndex={periodIndex} onChange={(index) => selectTime(HOURS[hourIndex], MINUTES[minuteIndex], index)} accessibilityLabel="Event end AM or PM" width={76} />
        </View>
      </View>
    </CreationStepScreen>
  );
}
