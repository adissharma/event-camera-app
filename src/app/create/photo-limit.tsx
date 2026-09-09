import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { colours, spacing } from '@/design';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { CaptureLimitPreview } from '@/features/celebrations/creation/capture-limit-preview';
import { useCoverSource } from '@/features/celebrations/cover-source';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { copy } from '@/i18n';
import { useEventEntitlements } from '@/features/entitlements/use-event-entitlements';
import { upgradesForFeature } from '@/features/entitlements/event-entitlements';
import { UpgradeSheet } from '@/features/entitlements/upgrade-sheet';

const LIMITED_COUNT_OPTIONS = [5, 10, 16, 24, 36] as const;
const SLIDER_VALUES: (number | null)[] = [...LIMITED_COUNT_OPTIONS, null];
const DEFAULT_LIMITED_COUNT = 16;
const DYNAMIC_COPY = [
  copy.create.photoLimitCopy5,
  copy.create.photoLimitCopy10,
  copy.create.photoLimitCopy16,
  copy.create.photoLimitCopy24,
  copy.create.photoLimitCopy36,
  copy.create.photoLimitCopyUnlimited,
];

export default function PhotoLimitStep() {
  const { draft, update } = useCreationDraft();
  const coverSource = useCoverSource(draft.coverLocalUri ?? draft.coverStoragePath);

  /*
   * Present only when this step was opened from Manage Event, i.e. the event
   * is already published and already on a package. During creation there is
   * no id and no gate — the host chooses, and the paywall at the end prices
   * what they chose.
   */
  const { celebrationId } = useLocalSearchParams<{ celebrationId?: string }>();
  const entitlements = useEventEntitlements(celebrationId ?? null);
  const unlimitedGated = Boolean(celebrationId) && !entitlements.has('unlimitedPhotos');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const storedCount = draft.shotLimitPerGuest;
  const selectedIndex = storedCount === null ? 5 : Math.max(0, LIMITED_COUNT_OPTIONS.indexOf((storedCount ?? DEFAULT_LIMITED_COUNT) as never));

  useEffect(() => {
    if (storedCount === undefined) update({ shotLimitPerGuest: DEFAULT_LIMITED_COUNT });
  }, [storedCount, update]);

  function selectIndex(index: number) {
    if (index === 5 && unlimitedGated) {
      void Haptics.selectionAsync().catch(() => {});
      setUpgradeOpen(true);
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    update({ shotLimitPerGuest: SLIDER_VALUES[index] });
  }

  return (
    <CreationStepScreen
      step="photo-limit"
      heading={copy.create.photoLimitHeading}
      headingAlign="center"
      scrollable={false}
    >
      <View style={{ flex: 1, gap: spacing.base }}>
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
          <CaptureLimitPreview limit={storedCount} coverSource={coverSource} />
        </View>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <DynamicLimitCopy index={selectedIndex} />
          <DiscreteSlider index={selectedIndex} onChange={selectIndex} />
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
            {SLIDER_VALUES.map((value, index) => (
              <AppText key={String(value)} variant="caption" tone={index === selectedIndex ? undefined : 'secondary'}>
                {value === null ? '∞' : value}
              </AppText>
            ))}
          </View>
        </View>
      </View>

      {/* The same upgrade surface every other locked feature opens. On
          success the choice the host was making is applied for them. */}
      {upgradeOpen && celebrationId ? (
        <UpgradeSheet
          visible
          celebrationId={String(celebrationId)}
          currentPlan={entitlements.plan}
          options={upgradesForFeature(entitlements.plan, 'unlimitedPhotos')}
          title="Unlock unlimited photos"
          onClose={() => setUpgradeOpen(false)}
          onUpgraded={() => {
            setUpgradeOpen(false);
            update({ shotLimitPerGuest: null });
          }}
        />
      ) : null}
    </CreationStepScreen>
  );
}

function DynamicLimitCopy({ index }: { index: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [index, opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <AppText variant="bodyLarge" tone="secondary" align="center">
        {DYNAMIC_COPY[index]}
      </AppText>
    </Animated.View>
  );
}

function DiscreteSlider({ index, onChange }: { index: number; onChange: (index: number) => void }) {
  const trackWidth = useRef(0);
  const position = useRef(new Animated.Value(index / 5)).current;
  const current = useRef(index);
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      current.current = trackWidth.current
        ? Math.max(0, Math.min(5, Math.round((event.nativeEvent.locationX / trackWidth.current) * 5)))
        : index;
      position.setValue(current.current / 5);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!trackWidth.current) return;
      const next = Math.max(0, Math.min(1, current.current / 5 + gesture.dx / trackWidth.current));
      position.setValue(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      if (!trackWidth.current) return;
      const next = Math.max(0, Math.min(5, Math.round(current.current + (gesture.dx / trackWidth.current) * 5)));
      current.current = next;
      Animated.spring(position, { toValue: next / 5, useNativeDriver: false, bounciness: 4 }).start();
      onChange(next);
    },
  })).current;

  useEffect(() => {
    current.current = index;
    Animated.spring(position, { toValue: index / 5, useNativeDriver: false, bounciness: 4 }).start();
  }, [index, position]);

  return (
    <View
      onLayout={(event) => { trackWidth.current = event.nativeEvent.layout.width; }}
      style={{ width: '100%', height: 58, justifyContent: 'center' }}
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Photos per guest"
      accessibilityValue={{ min: 5, max: 36, now: index === 5 ? 36 : [5, 10, 16, 24, 36][index] }}
    >
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colours.surfaceMuted }}>
        <Animated.View style={{ width: position.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: 10, borderRadius: 5, backgroundColor: colours.brandPrimary }} />
      </View>
      {[0, 1, 2, 3, 4, 5].map((stop) => (
        <View key={stop} style={{ position: 'absolute', left: `${(stop / 5) * 100}%`, top: 24, width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: colours.borderStrong }} />
      ))}
      <Animated.View style={{ position: 'absolute', left: position.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), top: 9, width: 40, height: 40, marginLeft: -20, borderRadius: 20, backgroundColor: colours.brandPrimary, borderWidth: 3, borderColor: colours.background, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 }} />
    </View>
  );
}
