import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { StillsLockup } from '@/components/brand/stills-lockup';
import { useDocumentTitle } from '@/components/brand/use-document-title';
import { LOCALE_CONFIG } from '@/config/app-config';
import { useAuth } from '@/features/auth/context';
import { COVER_TEMPLATES } from '@/features/celebrations/cover-templates';
import { GuestCoverPreview, parseCoverTheme } from '@/features/celebrations/creation/guest-cover-preview';
import { GENERIC_SUGGESTIONS } from '@/features/celebrations/creation/name-suggestions';
import { TreatmentSwatches } from '@/features/celebrations/creation/treatment-swatches';
import type { CreationDraft } from '@/features/celebrations/draft/types';
import { validateStep } from '@/features/celebrations/draft/validation';
import { shotLimitForPlan } from '@/features/entitlements/guest-limit';
import { normalisePhotoTreatment } from '@/features/media/photo-treatment';
import {
  PAYWALL_PLANS,
  planForCatalogueKey,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';
import { copy } from '@/i18n';
import { formatPrice } from '@/services/plans';
import { listCoverTemplateThemes, themeKeys } from '@/services/themes';
import { PublicationError } from '@/services/publication';
import { findPublishedEvent, prepareWebEvent, publishFreeWebEvent, startCheckout } from '@/services/web-checkout';
import { AccountPanel } from './account-panel';
import { coverFileToDataUrl, CoverFileError } from './cover-file';
import { useFileDrop } from '@/features/host-portal/use-file-drop';
import { clearWebDraft, useWebDraft, WEB_CREATE_STEPS, type WebCreateStep } from './use-web-draft';
import { WEB_CREATE_CSS } from './styles';

const STEP_LABELS: Record<WebCreateStep, string> = {
  event: 'Event',
  look: 'Cover',
  guests: 'Guests',
  package: 'Package',
  review: 'Review',
};

const PHOTO_LIMITS: { value: number | null; label: string; line: string }[] = [
  { value: 5, label: '5', line: 'Five shots. Make them count.' },
  { value: 10, label: '10', line: 'A little room to play.' },
  { value: 16, label: '16', line: 'Plenty for the best bits.' },
  { value: 24, label: '24', line: 'More moments, fewer regrets.' },
  { value: 36, label: '36', line: 'Go on, get snap-happy.' },
  { value: null, label: '∞', line: 'Unlimited. Snap without counting.' },
];

function price(plan: PaywallPlan) {
  return plan.isFree ? 'Free' : formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale);
}

function allowanceLabel(value: number | 'unlimited', noun: string) {
  return value === 'unlimited' ? `Unlimited ${noun}s` : `${value} ${noun}${value === 1 ? '' : 's'}`;
}

/** `endsAt` split for the native date and time inputs, in the browser's zone. */
function splitEndsAt(endsAt: string | null): { date: string; time: string } {
  if (!endsAt) return { date: '', time: '' };
  const value = new Date(endsAt);
  if (!Number.isFinite(value.getTime())) return { date: '', time: '' };
  return { date: format(value, 'yyyy-MM-dd'), time: format(value, 'HH:mm') };
}

function joinEndsAt(date: string, time: string): string | null {
  if (!date) return null;
  const value = new Date(`${date}T${time || '23:00'}`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

/** The problem stopping a step, or null when it is ready to leave. */
function stepError(step: WebCreateStep, draft: CreationDraft): string | null {
  switch (step) {
    case 'event':
      return validateStep('name', draft) ?? validateStep('closing', draft) ?? validateStep('closing-time', draft);
    case 'package':
      return draft.planKey ? null : 'Choose a package';
    default:
      return null;
  }
}

export default function WebCreateScreen() {
  useDocumentTitle('Create your event — Stills.');
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { isSignedIn, isBackendConfigured } = useAuth();
  const { isReady, draft, step, update, commit, goTo, flush, restart } = useWebDraft();
  const [alreadyLive, setAlreadyLive] = useState<{ id: string; title: string } | null>(null);
  const serverCelebrationId = draft?.serverCelebrationId ?? null;

  // A draft paid for in a tab that closed before Stripe returned is published
  // by the webhook, but this browser still holds the form. Offered again it
  // would only fail at checkout, so it is cleared and the live event linked.
  useEffect(() => {
    if (!isSignedIn || !serverCelebrationId) return;
    let active = true;
    void findPublishedEvent(serverCelebrationId)
      .then((live) => {
        if (!active || !live) return;
        setAlreadyLive(live);
        restart();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSignedIn, serverCelebrationId, restart]);

  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState<'preparing' | 'redirecting' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { data: themes = [] } = useQuery({
    queryKey: themeKeys.curated(),
    queryFn: listCoverTemplateThemes,
    enabled: isBackendConfigured,
  });

  const theme = useMemo(() => {
    const slug = draft?.themeSlug ?? 'editorial';
    const row = themes.find((candidate) => candidate.slug === slug);
    if (row) return parseCoverTheme(row.design_tokens, row.slug);
    const fallback = COVER_TEMPLATES.find((template) => template.slug === slug) ?? COVER_TEMPLATES[0]!;
    return { ...parseCoverTheme(null, fallback.slug), accent: fallback.accent };
  }, [draft?.themeSlug, themes]);

  // Each step change moves focus to its heading, so a screen reader announces
  // where the host has arrived and keyboard focus is not left on a button that
  // no longer exists.
  useEffect(() => {
    if (!isReady) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, isReady]);

  if (!isReady || !draft) {
    return <style dangerouslySetInnerHTML={{ __html: WEB_CREATE_CSS }} />;
  }

  const stepIndex = WEB_CREATE_STEPS.indexOf(step);
  const error = stepError(step, draft);
  const plan = planForCatalogueKey(draft.planKey);

  function next() {
    setAttempted(true);
    if (error) return;
    setAttempted(false);
    const following = WEB_CREATE_STEPS[stepIndex + 1];
    if (following) goTo(following);
  }

  function back() {
    setAttempted(false);
    const previous = WEB_CREATE_STEPS[stepIndex - 1];
    if (previous) goTo(previous);
  }

  async function submit() {
    if (!draft || !plan) return;
    // Everything before this point is checked again, in case the host edited
    // an earlier step from the review links and left it incomplete.
    for (const candidate of WEB_CREATE_STEPS) {
      const problem = stepError(candidate, draft);
      if (problem) {
        goTo(candidate);
        setAttempted(true);
        return;
      }
    }

    setSubmitError(null);
    setSubmitting('preparing');
    try {
      const celebrationId = await prepareWebEvent(draft, draft.serverCelebrationId);
      // Written straight to storage: coming back from Stripe with "Back"
      // must find this id, so a retry reuses the draft instead of making
      // another.
      commit({ serverCelebrationId: celebrationId });

      if (plan.isFree) {
        await publishFreeWebEvent(celebrationId, plan.catalogueKey);
        clearWebDraft();
        router.replace(`/host/created?event=${celebrationId}` as never);
        return;
      }

      const url = await startCheckout(celebrationId, plan.catalogueKey);
      setSubmitting('redirecting');
      window.location.assign(url);
    } catch (caught) {
      setSubmitting(null);
      setSubmitError(
        caught instanceof PublicationError || caught instanceof Error
          ? caught.message
          : 'Something went wrong. Please try again.',
      );
    }
  }

  const showError = attempted && error;

  return (
    <div className="wc-root">
      <style dangerouslySetInnerHTML={{ __html: WEB_CREATE_CSS }} />

      <header className="wc-topbar">
        <a href="/" className="wc-logo" aria-label="Stills. home">
          <StillsLockup size={22} />
        </a>
        <nav aria-label="Account">
          {isSignedIn ? (
            <a className="wc-text-link" href="/host">
              Your events
            </a>
          ) : (
            <a className="wc-text-link" href="/host/sign-in">
              Sign in
            </a>
          )}
        </nav>
      </header>

      <ol className="wc-progress" aria-label="Steps">
        {WEB_CREATE_STEPS.map((candidate, index) => {
          const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming';
          return (
            <li key={candidate} className={`wc-progress-step wc-progress-${state}`}>
              {index < stepIndex ? (
                <button type="button" onClick={() => goTo(candidate)} className="wc-progress-button">
                  <span className="wc-progress-bar" />
                  <span className="wc-progress-label">{STEP_LABELS[candidate]}</span>
                </button>
              ) : (
                <span className="wc-progress-button" aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="wc-progress-bar" />
                  <span className="wc-progress-label">{STEP_LABELS[candidate]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <main className="wc-layout">
        <section className="wc-form" aria-labelledby="wc-step-heading">
          {alreadyLive && step === 'event' ? (
            <div className="wc-notice" role="status">
              &ldquo;{alreadyLive.title}&rdquo; is already live — your payment went through.{' '}
              <a className="wc-text-button" href={`/host/${alreadyLive.id}`}>
                Open it
              </a>
            </div>
          ) : null}
          {params.checkout === 'cancelled' && step === 'review' ? (
            <div className="wc-notice" role="status">
              Payment cancelled — nothing was charged. Your event is saved here whenever you are ready.
            </div>
          ) : null}

          {step === 'event' ? (
            <EventStep draft={draft} update={update} headingRef={headingRef} showError={showError ? error : null} />
          ) : null}
          {step === 'look' ? (
            <LookStep draft={draft} update={update} headingRef={headingRef} preview={<Preview draft={draft} theme={theme} />} />
          ) : null}
          {step === 'guests' ? <GuestsStep draft={draft} update={update} headingRef={headingRef} /> : null}
          {step === 'package' ? (
            <PackageStep draft={draft} update={update} headingRef={headingRef} showError={showError ? error : null} />
          ) : null}
          {step === 'review' ? (
            <ReviewStep draft={draft} plan={plan} goTo={goTo} headingRef={headingRef}>
              <AccountPanel onBeforeRedirect={flush} />
            </ReviewStep>
          ) : null}

          {submitError ? (
            <div className="wc-notice wc-notice-error" role="alert">
              {submitError}
            </div>
          ) : null}

          <div className="wc-actions">
            {stepIndex > 0 ? (
              <button type="button" className="wc-button wc-button-ghost" onClick={back} disabled={submitting !== null}>
                Back
              </button>
            ) : (
              <span />
            )}

            {step === 'review' ? (
              <div className="wc-submit">
                <button
                  type="button"
                  className="wc-button wc-button-primary wc-button-large"
                  disabled={!isSignedIn || submitting !== null || !plan}
                  aria-describedby={!isSignedIn ? 'wc-submit-reason' : undefined}
                  onClick={() => void submit()}
                >
                  {submitting === 'preparing'
                    ? 'Saving your event…'
                    : submitting === 'redirecting'
                      ? 'Opening secure checkout…'
                      : plan?.isFree
                        ? copy.create.publish
                        : `Continue to payment · ${plan ? price(plan) : ''}`}
                </button>
                {!isSignedIn ? (
                  <p id="wc-submit-reason" className="wc-help">
                    Sign in above to {plan?.isFree ? 'create your event' : 'continue to payment'}.
                  </p>
                ) : !plan?.isFree ? (
                  <p className="wc-help">
                    Secure payment by Stripe. Apple Pay, Google Pay and cards accepted. One payment, no subscription.
                  </p>
                ) : null}
              </div>
            ) : (
              <button type="button" className="wc-button wc-button-primary" onClick={next}>
                Continue
              </button>
            )}
          </div>
        </section>

        <aside className="wc-preview" aria-label="What your guests will see">
          <div className="wc-preview-sticky">
            <Preview draft={draft} theme={theme} />
            <p className="wc-preview-caption">What guests see when they scan your code</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Preview({ draft, theme }: { draft: CreationDraft; theme: ReturnType<typeof parseCoverTheme> }) {
  return (
    <div className="wc-phone">
      <View style={{ flex: 1 }}>
        <GuestCoverPreview draft={draft} theme={theme} />
      </View>
    </div>
  );
}

type StepProps = {
  draft: CreationDraft;
  update: (patch: Partial<CreationDraft>) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
};

function StepHeading({ headingRef, children, supporting }: { headingRef: StepProps['headingRef']; children: ReactNode; supporting?: string }) {
  return (
    <div className="wc-heading">
      <h1 id="wc-step-heading" ref={headingRef} tabIndex={-1} className="wc-title">
        {children}
      </h1>
      {supporting ? <p className="wc-supporting">{supporting}</p> : null}
    </div>
  );
}

function EventStep({ draft, update, headingRef, showError }: StepProps & { showError: string | null }) {
  const { date, time } = splitEndsAt(draft.endsAt);
  const today = format(new Date(), 'yyyy-MM-dd');
  const nameError = showError && validateStep('name', draft);
  const dateError = showError && !nameError ? showError : null;

  return (
    <>
      <StepHeading headingRef={headingRef} supporting="Set up in a couple of minutes. You can change any of it later.">
        Let&rsquo;s give your event a name
      </StepHeading>

      <div className="wc-field">
        <label className="wc-label" htmlFor="wc-title">
          Event name
        </label>
        <input
          id="wc-title"
          className="wc-input wc-input-editorial"
          placeholder={copy.create.namePlaceholder}
          value={draft.title}
          maxLength={200}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'wc-title-error' : undefined}
          onChange={(event) => update({ title: event.target.value })}
        />
        {nameError ? (
          <p id="wc-title-error" className="wc-error">
            {nameError}
          </p>
        ) : null}
        <div className="wc-chips" role="group" aria-label="Common occasions">
          {GENERIC_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              className="wc-chip"
              onClick={() => update({ title: suggestion.value })}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="wc-fieldset">
        <legend className="wc-label">When does your event end?</legend>
        <p className="wc-help">Guests can take photos until then.</p>
        <div className="wc-row">
          <div className="wc-field wc-grow">
            <label className="wc-sublabel" htmlFor="wc-date">
              {copy.create.closingDateLabel}
            </label>
            <input
              id="wc-date"
              className="wc-input"
              type="date"
              min={today}
              value={date}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? 'wc-date-error' : undefined}
              onChange={(event) => update({ endsAt: joinEndsAt(event.target.value, time) })}
            />
          </div>
          <div className="wc-field">
            <label className="wc-sublabel" htmlFor="wc-time">
              {copy.create.closingTimeLabel}
            </label>
            <input
              id="wc-time"
              className="wc-input"
              type="time"
              value={time || (date ? '23:00' : '')}
              onChange={(event) => update({ endsAt: joinEndsAt(date, event.target.value) })}
            />
          </div>
        </div>
        <p className="wc-help">Time zone: {draft.timezone.replace(/_/g, ' ')}</p>
        {dateError ? (
          <p id="wc-date-error" className="wc-error">
            {dateError}
          </p>
        ) : null}
      </fieldset>
    </>
  );
}

function LookStep({ draft, update, headingRef, preview }: StepProps & { preview: ReactNode }) {
  const [coverError, setCoverError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function takeFile(file: File | undefined) {
    if (!file) return;
    setCoverError(null);
    setReading(true);
    try {
      update({ coverLocalUri: await coverFileToDataUrl(file), coverStoragePath: null });
    } catch (caught) {
      setCoverError(caught instanceof CoverFileError ? caught.message : 'Could not use that photo. Please try another.');
    } finally {
      setReading(false);
    }
  }

  const { isDragging, dropProps } = useFileDrop((files) => void takeFile(files[0]));

  return (
    <>
      <StepHeading headingRef={headingRef} supporting="This is the first thing guests see when they scan your code.">
        Choose your cover
      </StepHeading>

      <div className="wc-inline-preview">{preview}</div>

      <fieldset className="wc-fieldset">
        <legend className="wc-label">Style</legend>
        <div className="wc-options wc-options-3">
          {COVER_TEMPLATES.map((template) => (
            <label key={template.slug} className="wc-option">
              <input
                type="radio"
                name="wc-theme"
                value={template.slug}
                checked={(draft.themeSlug ?? 'editorial') === template.slug}
                onChange={() => update({ themeSlug: template.slug })}
              />
              <span className="wc-option-body">
                <span className="wc-swatch" style={{ background: template.accent }} aria-hidden="true" />
                <span className="wc-option-title">{template.name}</span>
                <span className="wc-option-description">{template.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="wc-field">
        <span className="wc-label" id="wc-cover-label">
          Cover photo
        </span>
        {draft.coverLocalUri ? (
          <div className="wc-cover-chosen">
            <img src={draft.coverLocalUri} alt="Your cover photo" />
            <div className="wc-cover-actions">
              <button type="button" className="wc-button wc-button-secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </button>
              <button type="button" className="wc-text-button" onClick={() => update({ coverLocalUri: null })}>
                {copy.create.removePhoto}
              </button>
            </div>
          </div>
        ) : (
          <div className={`wc-drop${isDragging ? ' wc-drop-active' : ''}`} {...dropProps}>
            <p className="wc-drop-title">{reading ? 'Preparing your photo…' : 'Drag a photo here'}</p>
            <p className="wc-help">Portrait photos work best. Optional — you can add one later.</p>
            <button
              type="button"
              className="wc-button wc-button-secondary"
              aria-describedby="wc-cover-label"
              onClick={() => inputRef.current?.click()}
              disabled={reading}
            >
              {copy.create.choosePhoto}
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="wc-visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void takeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        {coverError ? (
          <p className="wc-error" role="alert">
            {coverError}
          </p>
        ) : null}
      </div>
    </>
  );
}

function GuestsStep({ draft, update, headingRef }: StepProps) {
  const limit = draft.shotLimitPerGuest === undefined ? 16 : draft.shotLimitPerGuest;
  const line = PHOTO_LIMITS.find((option) => option.value === limit)?.line;
  const revealDuring = draft.hostRevealChoice === 'during';
  const guestsSeeGallery = draft.guestRevealChoice !== 'never';

  function setReveal(choice: 'during' | 'at_close') {
    update({
      revealChoice: choice,
      hostRevealChoice: choice,
      hostCustomRevealAt: null,
      guestRevealDelayHours: 0,
      ...(guestsSeeGallery ? { guestRevealChoice: choice, guestCustomRevealAt: null } : {}),
    });
  }

  return (
    <>
      <StepHeading headingRef={headingRef} supporting="How the camera behaves for everyone who joins.">
        Set up the camera
      </StepHeading>

      <fieldset className="wc-fieldset">
        <legend className="wc-label">{copy.create.photoLimitHeading}</legend>
        <div className="wc-segmented" role="radiogroup" aria-label="Photos per guest">
          {PHOTO_LIMITS.map((option) => (
            <label key={option.label} className="wc-segment">
              <input
                type="radio"
                name="wc-limit"
                checked={limit === option.value}
                onChange={() => update({ shotLimitPerGuest: option.value })}
                aria-label={option.value === null ? 'Unlimited' : `${option.value} photos`}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {line ? <p className="wc-help">{line}</p> : null}
      </fieldset>

      <fieldset className="wc-fieldset">
        <legend className="wc-label">When should photos be revealed?</legend>
        <div className="wc-options">
          <label className="wc-option">
            <input type="radio" name="wc-reveal" checked={revealDuring} onChange={() => setReveal('during')} />
            <span className="wc-option-body">
              <span className="wc-option-title">{copy.create.revealDuring}</span>
              <span className="wc-option-description">{copy.create.revealDuringDescription}</span>
            </span>
          </label>
          <label className="wc-option">
            <input type="radio" name="wc-reveal" checked={!revealDuring} onChange={() => setReveal('at_close')} />
            <span className="wc-option-body">
              <span className="wc-option-title">{copy.create.revealAtClose}</span>
              <span className="wc-option-description">{copy.create.revealAtCloseDescription}</span>
            </span>
          </label>
        </div>
        <label className="wc-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={guestsSeeGallery}
            onChange={(event) =>
              update(
                event.target.checked
                  ? { guestRevealChoice: draft.hostRevealChoice, guestCustomRevealAt: null, guestRevealDelayHours: 0 }
                  : { guestRevealChoice: 'never', guestCustomRevealAt: null },
              )
            }
          />
          <span>
            <span className="wc-option-title">{copy.create.guestsCanViewGallery}</span>
            <span className="wc-option-description">{copy.create.guestsCanViewGalleryDescription}</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="wc-fieldset">
        <legend className="wc-label">Photo style</legend>
        <View style={{ alignItems: 'flex-start' }}>
          <TreatmentSwatches
            selected={normalisePhotoTreatment(draft.photoTreatment)}
            onSelect={(photoTreatment) =>
              update({ photoTreatment, dateStampEnabled: photoTreatment === 'disposable' })
            }
          />
        </View>
      </fieldset>
    </>
  );
}

function planFeatures(plan: PaywallPlan): string[] {
  return [
    allowanceLabel(plan.guestLimit, 'guest'),
    plan.photoAllowance === 'unlimited' ? 'Unlimited photos per guest' : `${plan.photoAllowance} photos per guest`,
    ...(plan.videos ? ['Guest videos'] : []),
    ...(plan.guestbook ? ['Audio guestbook'] : []),
    ...(plan.challenges ? ['Photo challenges'] : []),
  ];
}

function PackageStep({ draft, update, headingRef, showError }: StepProps & { showError: string | null }) {
  const plans = [...PAYWALL_PLANS].sort((a, b) => b.sortOrder - a.sortOrder);
  const chosen = planForCatalogueKey(draft.planKey);
  const requested = draft.shotLimitPerGuest ?? null;
  const capped = chosen ? shotLimitForPlan(chosen, requested) : requested;

  return (
    <>
      <StepHeading headingRef={headingRef} supporting="One payment per event. No subscription, nothing renews.">
        {copy.create.packageHeading}
      </StepHeading>

      <fieldset className="wc-fieldset">
        <legend className="wc-visually-hidden">Package</legend>
        <div className="wc-plans">
          {plans.map((plan) => (
            <label key={plan.id} className={`wc-plan${plan.isRecommended ? ' wc-plan-recommended' : ''}`}>
              <input
                type="radio"
                name="wc-plan"
                checked={draft.planKey === plan.catalogueKey}
                onChange={() => update({ planKey: plan.catalogueKey })}
              />
              <span className="wc-plan-body">
                {plan.isRecommended ? <span className="wc-plan-badge">Most popular</span> : null}
                <span className="wc-plan-name">{plan.displayName}</span>
                <span className="wc-plan-price">
                  {price(plan)}
                  {!plan.isFree ? <span className="wc-plan-per"> {copy.create.packagePerEvent}</span> : null}
                </span>
                <ul className="wc-plan-features">
                  {planFeatures(plan).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {chosen && capped !== requested ? (
        <div className="wc-notice" role="status">
          {chosen.displayName} includes {capped} photos per guest, so your camera will allow {capped} rather than{' '}
          {requested === null ? 'unlimited' : requested}.
        </div>
      ) : null}
      {showError ? <p className="wc-error">{showError}</p> : null}
    </>
  );
}

function ReviewStep({
  draft,
  plan,
  goTo,
  headingRef,
  children,
}: {
  draft: CreationDraft;
  plan: PaywallPlan | null;
  goTo: (step: WebCreateStep) => void;
  headingRef: StepProps['headingRef'];
  children: ReactNode;
}) {
  const ends = draft.endsAt ? format(new Date(draft.endsAt), "EEEE d MMMM yyyy 'at' HH:mm") : '—';
  const template = COVER_TEMPLATES.find((candidate) => candidate.slug === draft.themeSlug) ?? COVER_TEMPLATES[0]!;
  const shots = plan ? shotLimitForPlan(plan, draft.shotLimitPerGuest ?? null) : draft.shotLimitPerGuest;

  const rows: { label: string; value: string; step: WebCreateStep }[] = [
    { label: 'Event', value: draft.title.trim() || '—', step: 'event' },
    { label: 'Ends', value: ends, step: 'event' },
    { label: 'Cover', value: `${template.name}${draft.coverLocalUri ? ' · your photo' : ''}`, step: 'look' },
    { label: 'Photos per guest', value: shots === null || shots === undefined ? 'Unlimited' : String(shots), step: 'guests' },
    {
      label: 'Reveal',
      value: `${draft.hostRevealChoice === 'during' ? copy.create.revealDuring : copy.create.revealAtClose}${
        draft.guestRevealChoice === 'never' ? ' · only you see the gallery' : ''
      }`,
      step: 'guests',
    },
    { label: 'Package', value: plan ? `${plan.displayName} · ${price(plan)}` : '—', step: 'package' },
  ];

  return (
    <>
      <StepHeading headingRef={headingRef} supporting={copy.create.reviewSupporting}>
        {copy.create.reviewHeading}
      </StepHeading>

      <dl className="wc-summary">
        {rows.map((row) => (
          <div key={row.label} className="wc-summary-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <button
              type="button"
              className="wc-text-button"
              onClick={() => goTo(row.step)}
              aria-label={`Change ${row.label.toLowerCase()}`}
            >
              Change
            </button>
          </div>
        ))}
      </dl>

      {children}
    </>
  );
}
