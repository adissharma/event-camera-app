import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { OptionCard } from '@/components/forms/option-card';
import { Reveal } from '@/components/feedback/reveal';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { fetchCatalogue, formatPrice, planKeys } from '@/services/plans';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, spacing } from '@/design';
import { copy } from '@/i18n';

/** Turns an entitlement value into a line a person would actually say. */
function describeEntitlement(key: string, value: unknown): string | null {
  switch (key) {
    case 'participant_limit':
      return value === null ? 'Unlimited guests' : `Up to ${value} guests`;
    case 'unlimited_photos':
      return value === true ? 'Unlimited photos per guest' : null;
    case 'camera_roll_upload_limit':
      return typeof value === 'number' ? `${value} camera-roll uploads each` : null;
    case 'cohost_count':
      return typeof value === 'number' && value > 0
        ? `${value} co-host${value === 1 ? '' : 's'}`
        : null;
    case 'qr_templates':
      return Array.isArray(value) ? `${value.length} QR designs` : null;
    case 'gallery_retention_days':
      return typeof value === 'number'
        ? value >= 3650
          ? 'Gallery kept for ten years'
          : `Gallery kept for ${Math.round(value / 30)} months`
        : null;
    case 'moderation':
      return value === true ? 'Approve photos before they appear' : null;
    default:
      return null;
  }
}

export default function PackageStep() {
  const { draft, update } = useCreationDraft();

  const { data, isLoading, isError } = useQuery({
    queryKey: planKeys.catalogue(),
    queryFn: fetchCatalogue,
  });

  if (isLoading) {
    return (
      <CreationStepScreen step="package" heading={copy.create.packageHeading}>
        <View style={{ paddingVertical: spacing.giant, alignItems: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      </CreationStepScreen>
    );
  }

  if (isError || !data) {
    return (
      <CreationStepScreen step="package" heading={copy.create.packageHeading}>
        <AppText variant="body" tone="error">
          {copy.common.somethingWentWrong}
        </AppText>
      </CreationStepScreen>
    );
  }

  return (
    <CreationStepScreen step="package" heading={copy.create.packageHeading}>
      <View style={{ gap: spacing.base }}>
        {data.plans.map((plan, planIndex) => {
          const selected = draft.planKey === plan.key;
          const features = Object.entries(plan.entitlements)
            .map(([key, value]) => describeEntitlement(key, value))
            .filter((line): line is string => line !== null);

          return (
            <View key={plan.key} style={{ gap: spacing.sm }}>
              <OptionCard
                label={plan.name}
                description={plan.description ?? undefined}
                trailing={formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale)}
                selected={selected}
                onPress={() => update({ planKey: plan.key })}
              />

              {/* Entitlements reveal in a brief stagger when a plan is chosen,
                  so what was just unlocked is visible rather than merely
                  present. Capped at six — beyond that the wait reads as lag. */}
              {selected ? (
                <View style={{ paddingLeft: spacing.base, gap: spacing.xs }}>
                  {features.slice(0, 6).map((line, index) => (
                    <Reveal key={line} index={index} step={45}>
                      <AppText variant="bodySmall" tone="secondary">
                        ✓ {line}
                      </AppText>
                    </Reveal>
                  ))}
                </View>
              ) : null}

              {planIndex < data.plans.length - 1 ? <View style={{ height: spacing.xs }} /> : null}
            </View>
          );
        })}

        <AppText variant="caption" tone="secondary" style={{ paddingTop: spacing.base }}>
          One payment per event. Nothing recurring, nothing to cancel.
        </AppText>
      </View>
    </CreationStepScreen>
  );
}
