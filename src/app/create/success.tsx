import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/layout/screen';
import { Reveal } from '@/components/feedback/reveal';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { QrCard } from '@/features/sharing/qr-card';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import {
  clearPublicationResult,
  getPublicationResult,
} from '@/features/celebrations/creation/publication-result';
import { celebrationKeys } from '@/services/celebrations';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, layout, radii, spacing } from '@/design';
import { copy, t } from '@/i18n';

export default function SuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { reset } = useCreationDraft();
  const [copied, setCopied] = useState(false);

  const result = getPublicationResult();

  useEffect(() => {
    // The event now exists on the server, so the local draft is finished with.
    // Held until this screen so a failed publish never discards the host's work.
    void reset();
    void queryClient.invalidateQueries({ queryKey: celebrationKeys.all });
    return () => clearPublicationResult();
  }, [reset, queryClient]);

  if (!result) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <AppText variant="displayLarge">Nothing to show</AppText>
          <AppText variant="body" tone="secondary">
            This page is shown after publishing an event.
          </AppText>
          <Button label="Back to home" onPress={() => router.replace('/home')} />
        </View>
      </Screen>
    );
  }

  // Everything below reads from `result`, never from the draft — the effect
  // above has already cleared it.
  const closingLabel = result.endsAt
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZone: result.timezone,
      }).format(new Date(result.endsAt))
    : null;

  const shareMessage = t(copy.create.shareMessage, {
    eventName: result.eventName || 'our event',
    link: result.guestUrl,
  });

  return (
    <Screen
      stickyAction={
        <View style={{ gap: spacing.sm }}>
          <Button
            label={copy.create.shareLink}
            haptic
            onPress={() => {
              void Share.share({ message: shareMessage }).catch(() => {});
            }}
          />
          <Button
            label={copy.create.openDashboard}
            variant="quiet"
            onPress={() => router.replace(`/celebration/${result.celebrationId}` as never)}
          />
        </View>
      }
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0} step={70} style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" tone="secondary">
            {result.wasAlreadyPublished ? 'Already live' : 'Live'}
          </AppText>
          <AppText variant="displayHero">{copy.create.successHeading}</AppText>
          <AppText variant="bodyLarge" tone="secondary">
            {copy.create.successSupporting}
          </AppText>
        </Reveal>

        <Reveal index={1} step={70}>
          <QrCard
            value={result.guestUrl}
            eventName={result.eventName || 'Your event'}
            supportingLine={result.supportingLine ?? undefined}
          />
        </Reveal>

        <Reveal index={2} step={70} style={{ gap: spacing.base }}>
          <Button
            label={copied ? 'Link copied' : 'Copy guest link'}
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(result.guestUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />

          {closingLabel ? (
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
                Closes
              </AppText>
              <AppText variant="labelLarge">{closingLabel}</AppText>
            </View>
          ) : null}

          {/* The link is a bearer credential: anyone holding it can join. Said
              plainly, because a host who understands that will not post it
              publicly. */}
          <AppText variant="caption" tone="secondary">
            Anyone with this link can join your event, so share it with your guests
            rather than posting it publicly.
          </AppText>
        </Reveal>
      </View>
    </Screen>
  );
}
