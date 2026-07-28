import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { DeviceFrame } from '@/components/media/device-frame';
import { GuestCoverPreview } from '@/features/celebrations/creation/guest-cover-preview';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { resolveReveal, type CreationStep } from '@/features/celebrations/draft/types';
import { canPublish, validateStep } from '@/features/celebrations/draft/validation';
import { LOCALE_CONFIG } from '@/config/app-config';
import { publishDraft, PublicationError } from '@/services/publication';
import { setPublicationResult } from '@/features/celebrations/creation/publication-result';
import { colours, layout, radii, spacing } from '@/design';
import { copy } from '@/i18n';

/**
 * Review.
 *
 * Every consequential setting is listed with a direct edit path, and editing
 * returns here with everything else intact — the draft lives above the
 * navigation stack, so going back is a navigation, never a reset.
 */
export default function ReviewStep() {
  const router = useRouter();
  const { draft } = useCreationDraft();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await publishDraft(draft);
      setPublicationResult(result);
      router.replace('/create/success');
    } catch (error) {
      // Stage-aware, because "your card was declined" and "we could not reach
      // the server" need entirely different reactions from the host.
      const stage = error instanceof PublicationError ? error.stage : null;
      setPublishError(
        stage === 'purchase'
          ? 'That payment did not go through. Nothing has been charged.'
          : stage === 'publish'
            ? 'Your event was saved but could not be published. Try again.'
            : 'We could not create your event. Check your connection and try again.',
      );
    } finally {
      setIsPublishing(false);
    }
  }

  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZone: draft.timezone,
        }).format(new Date(iso))
      : 'Not set';

  const reveal = resolveReveal(draft.revealChoice, draft.endsAt, draft.customRevealAt);

  const rows: { step: CreationStep; label: string; value: string }[] = [
    { step: 'name', label: 'Event name', value: draft.title.trim() || 'Not set' },
    { step: 'closing', label: 'Closes', value: date(draft.endsAt) },
    { step: 'cover', label: 'Cover', value: draft.coverLocalUri ? 'Your photo' : 'Default image' },
    { step: 'cover', label: 'Theme', value: draft.themeSlug ?? 'Editorial' },
    {
      step: 'photo-limit',
      label: 'Photos per guest',
      value: draft.shotLimitPerGuest === null ? 'Unlimited' : String(draft.shotLimitPerGuest),
    },
    {
      step: 'camera-roll',
      label: 'Camera roll',
      value: draft.cameraRollUploadsEnabled
        ? `${draft.cameraRollUploadLimit} each`
        : 'Not allowed',
    },
    { step: 'formats', label: 'Formats', value: draft.allowedMediaTypes.join(', ') },
    {
      step: 'privacy',
      label: 'Who sees photos',
      value:
        draft.galleryVisibility === 'all_guests'
          ? 'Everyone'
          : draft.galleryVisibility === 'own_only'
            ? 'Own photos only'
            : 'Only you',
    },
    { step: 'privacy', label: 'PIN', value: draft.pinRequired ? 'Required' : 'Not required' },
    {
      step: 'reveal',
      label: 'Photos appear',
      value:
        reveal.mode === 'instant'
          ? 'During the event'
          : reveal.mode === 'manual'
            ? 'When you choose'
            : date(reveal.revealAt),
    },
    { step: 'treatment', label: 'Look', value: draft.photoTreatment.replace(/_/g, ' ') },
    { step: 'package', label: 'Package', value: draft.planKey ?? 'Not chosen' },
    { step: 'qr', label: 'QR design', value: draft.qrTemplateKey.replace(/_/g, ' ') },
  ];

  const blocking = validateStep('review', draft);
  const ready = canPublish(draft);

  return (
    <CreationStepScreen
      step="review"
      heading={copy.create.reviewHeading}
      supporting={copy.create.reviewSupporting}
      action={
        <View style={{ gap: spacing.sm }}>
          {blocking ? (
            <AppText variant="caption" tone="warning" accessibilityLiveRegion="polite">
              {blocking}
            </AppText>
          ) : null}
          {publishError ? (
            <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">
              {publishError}
            </AppText>
          ) : null}
          <Button
            label={copy.create.publish}
            disabled={!ready}
            loading={isPublishing}
            disabledReason={blocking ?? undefined}
            haptic
            onPress={() => void handlePublish()}
          />
        </View>
      }
    >
      <View style={{ gap: spacing.xl }}>
        <DeviceFrame>
          <GuestCoverPreview draft={draft} />
        </DeviceFrame>

        <View style={{ gap: spacing.xs }}>
          {rows.map((row, index) => (
            <Pressable
              key={`${row.step}-${row.label}`}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}: ${row.value}. Edit.`}
              onPress={() => router.push(`/create/${row.step}` as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.base,
                minHeight: layout.minTouchTarget,
                paddingVertical: spacing.md,
                borderTopWidth: index === 0 ? 0 : layout.hairline,
                borderTopColor: colours.borderSubtle,
              }}
            >
              <AppText variant="bodySmall" tone="secondary" style={{ width: 130 }}>
                {row.label}
              </AppText>
              <AppText variant="labelLarge" style={{ flex: 1 }} numberOfLines={2}>
                {row.value}
              </AppText>
              <AppText variant="caption" tone="brand">
                {copy.common.edit}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            padding: spacing.base,
            borderRadius: radii.lg,
            borderWidth: layout.hairline,
            borderColor: colours.borderSubtle,
            backgroundColor: colours.surface,
            gap: spacing.xxs,
          }}
        >
          <AppText variant="eyebrow" tone="secondary">
            Before you publish
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Real payments are not connected yet, so nothing is charged. Your event is
            created and shareable straight away.
          </AppText>
        </View>
      </View>
    </CreationStepScreen>
  );
}
