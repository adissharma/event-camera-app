import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';

import { StillsLockup } from '@/components/brand/stills-lockup';
import { useDocumentTitle } from '@/components/brand/use-document-title';
import { BRAND_CONFIG } from '@/config/brand';
import { colours } from '@/design';
import { useAuth } from '@/features/auth/context';
import { COVER_TEMPLATES } from '@/features/celebrations/cover-templates';
import { GuestCoverPreview, parseCoverTheme } from '@/features/celebrations/creation/guest-cover-preview';
import { createEmptyDraft } from '@/features/celebrations/draft/types';
import { LINKS } from '@/features/marketing/story/content';
import { planForCatalogueKey } from '@/features/payments/plan-catalogue';
import { copy } from '@/i18n';
import { fetchHostEvent, hostPortalKeys } from '@/services/host-portal';
import { checkCheckout, guestUrlFromHandoff, readHandoff, type CheckoutStatus } from '@/services/web-checkout';
import { clearWebDraft } from './use-web-draft';
import { WEB_CREATE_CSS } from './styles';
import { CREATED_CSS } from './created-styles';

const POLL_MS = 2000;
/** Long enough for any card payment; a slower method is the webhook's to finish. */
const POLL_LIMIT = 20;

type Phase =
  | { kind: 'checking' }
  | { kind: 'complete'; celebrationId: string; eventCode: string | null; planKey: string | null }
  | { kind: 'processing' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

/**
 * Where Stripe sends the host back to, and where a free event lands.
 *
 * Asks our server rather than trusting the redirect: arriving at this URL proves
 * nothing, and the session id in it is only used to look the payment up.
 */
function useCheckoutPhase(sessionId: string | undefined, freeEventId: string | undefined): Phase {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  useEffect(() => {
    if (freeEventId) {
      setPhase({ kind: 'complete', celebrationId: freeEventId, eventCode: null, planKey: null });
      return;
    }
    if (!sessionId) {
      setPhase({ kind: 'error', message: 'This link is missing its payment details.' });
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      attempts += 1;
      let result: CheckoutStatus;
      try {
        result = await checkCheckout(sessionId);
      } catch (error) {
        if (cancelled) return;
        if (attempts < 3) {
          timer = setTimeout(() => void tick(), POLL_MS);
          return;
        }
        setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'Could not check your payment.' });
        return;
      }
      if (cancelled) return;

      if (result.status === 'complete') {
        setPhase({
          kind: 'complete',
          celebrationId: result.celebrationId,
          eventCode: result.eventCode,
          planKey: result.planKey,
        });
      } else if (result.status === 'expired') {
        setPhase({ kind: 'expired' });
      } else if (result.status === 'not_ours') {
        setPhase({ kind: 'error', message: 'This payment is not for an event on this account.' });
      } else if (attempts >= POLL_LIMIT) {
        setPhase({ kind: 'processing' });
      } else {
        timer = setTimeout(() => void tick(), POLL_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, freeEventId]);

  return phase;
}

export default function WebCreatedScreen() {
  const params = useLocalSearchParams<{ session_id?: string; event?: string }>();
  const phase = useCheckoutPhase(params.session_id, params.event);
  useDocumentTitle(phase.kind === 'complete' ? 'Your event is live — Stills.' : 'Finishing up — Stills.');

  useEffect(() => {
    if (phase.kind === 'complete') clearWebDraft();
  }, [phase.kind]);

  return (
    <div className="wc-root">
      <style dangerouslySetInnerHTML={{ __html: WEB_CREATE_CSS + CREATED_CSS }} />
      <header className="wc-topbar">
        <a href="/" className="wc-logo" aria-label="Stills. home">
          <StillsLockup size={22} />
        </a>
        <a className="wc-text-link" href="/host">
          Your events
        </a>
      </header>

      <main className="cr-main">
        {phase.kind === 'checking' ? (
          <Status title="Confirming your payment…" body="This usually takes a few seconds. Please keep this page open." busy />
        ) : null}
        {phase.kind === 'processing' ? (
          <Status
            title="Your payment is being processed"
            body="Your bank is still confirming it. We will finish setting up your event as soon as it clears — it will appear in Your events, and in the app, with nothing more to do."
            action={{ href: '/host', label: 'Go to your events' }}
          />
        ) : null}
        {phase.kind === 'expired' ? (
          <Status
            title="That checkout expired"
            body="Nothing was charged. Your event is still saved — pick up where you left off."
            action={{ href: '/host/new', label: 'Back to your event' }}
          />
        ) : null}
        {phase.kind === 'error' ? (
          <Status
            title="We could not confirm this yet"
            body={`${phase.message} If you were charged, your event will be set up automatically — check Your events in a few minutes.`}
            action={{ href: '/host', label: 'Go to your events' }}
          />
        ) : null}
        {phase.kind === 'complete' ? (
          <Created celebrationId={phase.celebrationId} eventCode={phase.eventCode} planKey={phase.planKey} />
        ) : null}
      </main>
    </div>
  );
}

function Status({
  title,
  body,
  busy,
  action,
}: {
  title: string;
  body: string;
  busy?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <section className="cr-status" role="status" aria-live="polite">
      {busy ? <span className="cr-spinner" aria-hidden="true" /> : null}
      <h1 className="wc-title">{title}</h1>
      <p className="wc-supporting">{body}</p>
      {action ? (
        <a className="wc-button wc-button-primary" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}

function Created({
  celebrationId,
  eventCode: knownCode,
  planKey,
}: {
  celebrationId: string;
  eventCode: string | null;
  planKey: string | null;
}) {
  const { user } = useAuth();
  const handoff = useMemo(() => readHandoff(celebrationId), [celebrationId]);
  const { data: event } = useQuery({
    queryKey: hostPortalKeys.event(celebrationId),
    queryFn: () => fetchHostEvent(celebrationId),
  });

  const eventCode = knownCode ?? event?.celebration.event_code ?? null;
  const guestUrl = guestUrlFromHandoff(handoff, eventCode);
  const plan = planForCatalogueKey(planKey ?? handoff?.planKey);
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => {
    const base = createEmptyDraft(null, handoff?.timezone ?? 'Europe/London');
    return {
      ...base,
      title: handoff?.title ?? event?.celebration.title ?? '',
      endsAt: handoff?.endsAt ?? event?.session?.ends_at ?? null,
      themeSlug: handoff?.themeSlug ?? 'editorial',
      coverStoragePath: handoff?.coverStoragePath ?? event?.celebration.cover_storage_path ?? null,
      shotLimitPerGuest: event?.session?.shot_limit_per_guest ?? null,
    };
  }, [handoff, event]);

  const template = COVER_TEMPLATES.find((candidate) => candidate.slug === draft.themeSlug) ?? COVER_TEMPLATES[0]!;
  const theme = { ...parseCoverTheme(null, template.slug), accent: template.accent };

  const provider = user?.providers?.find((name) => name !== 'email');
  const signInHint =
    provider === 'apple'
      ? 'Continue with Apple'
      : provider === 'google'
        ? 'Continue with Google'
        : `your email, ${user?.email ?? ''}`;

  async function copyLink() {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: the link is selectable on the page anyway.
    }
  }

  return (
    <div className="cr-grid">
      <section className="cr-intro">
        <p className="cr-eyebrow">{plan && !plan.isFree ? `${plan.displayName} · paid` : 'Event created'}</p>
        <h1 className="wc-title cr-title">{copy.create.successHeading}</h1>
        <p className="wc-supporting">{copy.create.successSupporting}</p>

        <div className="cr-card">
          <div className="cr-card-head">
            <div>
              <div className="wc-sublabel">Guest link</div>
              {eventCode ? <div className="cr-code">{eventCode}</div> : null}
            </div>
          </div>
          {guestUrl ? (
            <>
              <div className="cr-link-row">
                <input className="wc-input cr-link" readOnly value={guestUrl} aria-label="Guest link" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="wc-button wc-button-secondary" onClick={() => void copyLink()}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div className="cr-qr-row">
                <div className="cr-qr">
                  <QRCode value={guestUrl} size={132} color={colours.textOnBrand} backgroundColor={colours.brandPrimary} />
                </div>
                <p className="wc-help">
                  Guests scan this to join. Print it on a table card, or put it on a screen. The app has ready-made
                  QR designs to print.
                </p>
              </div>
            </>
          ) : (
            <p className="wc-help">
              Your guest link and printable QR code are in the app, under this event&rsquo;s Share button.
            </p>
          )}
        </div>

        <div className="cr-card cr-app">
          <div className="cr-app-copy">
            <h2 className="cr-h2">Get the app for full control</h2>
            <p className="wc-help">
              Watch photos arrive live, print QR designs, run photo challenges, build your seating plan and download
              everything at the end.
            </p>
            <ol className="cr-steps">
              <li>Download Stills. from the App Store.</li>
              <li>
                Sign in with <strong>{signInHint}</strong> — the same account you used here.
              </li>
              <li>Your event is already there{plan && !plan.isFree ? `, with ${plan.displayName}` : ''}.</li>
            </ol>
            <div className="cr-app-actions">
              <a className="wc-button wc-button-primary" href={LINKS.appStore} target="_blank" rel="noreferrer">
                Download on the App Store
              </a>
              <a className="wc-text-button" href={`/host/${celebrationId}`}>
                Or manage it on the web
              </a>
            </div>
          </div>
          <div className="cr-app-qr" aria-hidden="true">
            <QRCode value={LINKS.appStore} size={112} color={colours.textOnBrand} backgroundColor={colours.brandPrimary} />
            <span className="wc-help">Scan with your phone</span>
          </div>
        </div>
      </section>

      <aside className="cr-preview" aria-label="Your guest cover">
        <div className="wc-phone">
          <View style={{ flex: 1 }}>
            <GuestCoverPreview draft={draft} theme={theme} />
          </View>
        </div>
        <p className="wc-preview-caption">{BRAND_CONFIG.guestDomain.replace('https://', '')}/j/{eventCode ?? '…'}</p>
      </aside>
    </div>
  );
}
