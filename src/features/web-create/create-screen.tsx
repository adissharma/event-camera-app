import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ClosingStep from '@/app/create/closing';
import ClosingTimeStep from '@/app/create/closing-time';
import CoverStep from '@/app/create/cover';
import GuestRevealStep from '@/app/create/guest-reveal';
import NameStep from '@/app/create/name';
import PhotoLimitStep from '@/app/create/photo-limit';
import RevealStep from '@/app/create/reveal';
import TreatmentStep from '@/app/create/treatment';
import { StillsLockup } from '@/components/brand/stills-lockup';
import { useDocumentTitle } from '@/components/brand/use-document-title';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { LOCALE_CONFIG } from '@/config/app-config';
import { spacing } from '@/design';
import { useAuth } from '@/features/auth/context';
import { CreationFlowHostContext, type CreationFlowHost } from '@/features/celebrations/creation/flow-host';
import { CreatingOverlay, REVEAL_TIMINGS } from '@/features/celebrations/creation/pricing-reveal';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { HostedCreationDraftProvider, type DraftContextValue } from '@/features/celebrations/draft/store';
import { validateStep } from '@/features/celebrations/draft/validation';
import { shotLimitForPlan } from '@/features/entitlements/guest-limit';
import {
  PAYWALL_PLANS,
  planForCatalogueKey,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';
import { copy } from '@/i18n';
import { formatPrice } from '@/services/plans';
import { PublicationError } from '@/services/publication';
import { findPublishedEvent, prepareWebEvent, publishFreeWebEvent, startCheckout } from '@/services/web-checkout';
import { AccountPanel } from './account-panel';
import { coverFileToDataUrl } from './cover-file';
import { DESKTOP_MIN_WIDTH, DESKTOP_STEP_WIDTH } from './desktop-styles';
import {
  DesktopCoverStep,
  DesktopNameStep,
  DesktopPackageStep,
  DesktopPhotoLimitStep,
  DesktopWhenStep,
} from './desktop-steps';
import { clearWebDraft, useWebDraft, WEB_CREATE_STEPS, type WebCreateStep } from './use-web-draft';
import { WEB_CREATE_CSS } from './styles';

/**
 * Creating an event in a browser.
 *
 * This is the app's creation flow, not a web form that resembles it: every
 * step up to the package is the app's own step screen, rendered as it is on a
 * phone. One question at a time, the same wheels, slider and toggles. On a
 * phone-sized window that is all there is. On a desktop the same steps sit in
 * a column over the homepage's sky.
 *
 * Only the end differs, because it has to. The app sells through the App
 * Store; the web shows its own package cards, then one last step to sign in
 * and go to checkout.
 */

/** The app's step screens, by step. `package` and `review` are the web's own. */
const APP_STEPS: Partial<Record<WebCreateStep, ComponentType>> = {
  name: NameStep,
  closing: ClosingStep,
  'closing-time': ClosingTimeStep,
  cover: CoverStep,
  'photo-limit': PhotoLimitStep,
  reveal: RevealStep,
  'guest-reveal': GuestRevealStep,
  treatment: TreatmentStep,
};

/**
 * On a desktop, the steps whose app control is a phone gesture, or is drawn
 * for the app's black canvas, are swapped for the control a desk expects. See `desktop-steps.tsx`.
 */
const DESKTOP_STEPS: Partial<Record<WebCreateStep, ComponentType>> = {
  name: DesktopNameStep,
  closing: DesktopWhenStep,
  cover: DesktopCoverStep,
  'photo-limit': DesktopPhotoLimitStep,
  package: DesktopPackageStep,
};

/**
 * The one line under each question on a desktop: why it is being asked.
 * Short on purpose. The phone shows none, as the app does.
 */
const DESKTOP_SUPPORTING: Partial<Record<WebCreateStep, string>> = {
  name: 'It’s the first thing guests see when they scan your code.',
  closing: 'Guests can take photos until then.',
  cover: 'The welcome screen guests see when they join.',
  'photo-limit': 'Like a disposable camera. Pick unlimited and they can shoot freely.',
  reveal: 'Waiting builds anticipation, like getting film developed.',
  'guest-reveal': 'This can be different from when you see them.',
  treatment: 'Every photo gets this look, so the album feels like one roll of film.',
  package: 'Everything your guests capture, in one album.',
};

function price(plan: PaywallPlan) {
  return plan.isFree ? 'Free' : formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale);
}

function allowanceLabel(value: number | 'unlimited', noun: string) {
  return value === 'unlimited' ? `Unlimited ${noun}s` : `${value} ${noun}${value === 1 ? '' : 's'}`;
}

/** Whether the window is wide enough for the desktop layout. False until mounted. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return isDesktop;
}

export default function WebCreateScreen() {
  useDocumentTitle('Create your event — Stills.');
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { isSignedIn } = useAuth();
  const { isReady, draft, step, update, commit, goTo, flush, restart } = useWebDraft();
  const isDesktop = useIsDesktop();
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

  const [submitting, setSubmitting] = useState<'preparing' | 'redirecting' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  /**
   * The app's "Creating your event" moment, played on the way to the packages
   * as the app plays it before its paywall. `visible` drives its fade; the
   * layer stays mounted a little longer so the fade can finish.
   */
  const [creating, setCreating] = useState<{ visible: boolean; run: number } | null>(null);
  useEffect(() => {
    if (!creating?.visible) return;
    const hide = setTimeout(
      () => setCreating((current) => (current ? { ...current, visible: false } : current)),
      REVEAL_TIMINGS.TARGET_CREATING_DURATION,
    );
    return () => clearTimeout(hide);
  }, [creating?.visible, creating?.run]);
  useEffect(() => {
    if (!creating || creating.visible) return;
    const unmount = setTimeout(() => setCreating(null), 500);
    return () => clearTimeout(unmount);
  }, [creating]);

  // On a desktop the end day and time are one page, so the time step is not a
  // stop of its own. A draft left on it opens on the combined page.
  const steps: readonly WebCreateStep[] = isDesktop
    ? WEB_CREATE_STEPS.filter((candidate) => candidate !== 'closing-time')
    : WEB_CREATE_STEPS;
  const shownStep: WebCreateStep = isDesktop && step === 'closing-time' ? 'closing' : step;
  const stepIndex = steps.indexOf(shownStep);

  // What the app's step screens are given in place of the router and the app's
  // own draft store.
  const host = useMemo<CreationFlowHost>(
    () => ({
      goNext: () => {
        const following = steps[stepIndex + 1];
        if (!following) return;
        if (following === 'package') setCreating((current) => ({ visible: true, run: (current?.run ?? 0) + 1 }));
        goTo(following);
      },
      goBack: () => {
        const previous = steps[stepIndex - 1];
        if (previous) goTo(previous);
        else router.push(isSignedIn ? '/host' : '/');
      },
      backgroundColor: isDesktop ? 'transparent' : undefined,
      width: isDesktop ? DESKTOP_STEP_WIDTH : undefined,
      chrome: isDesktop ? 'page' : undefined,
      supporting: isDesktop ? DESKTOP_SUPPORTING[shownStep] : undefined,
      pickCover: () => coverInputRef.current?.click(),
    }),
    [goTo, isDesktop, isSignedIn, router, shownStep, stepIndex, steps],
  );

  const draftValue = useMemo<DraftContextValue | null>(
    () =>
      draft
        ? {
            draft,
            isRestoring: false,
            wasRestored: false,
            update,
            reset: async () => restart(),
          }
        : null,
    [draft, restart, update],
  );

  if (!isReady || !draft || !draftValue) {
    return <style dangerouslySetInnerHTML={{ __html: WEB_CREATE_CSS }} />;
  }

  const plan = planForCatalogueKey(draft.planKey);

  async function submit() {
    if (!draft || !plan) return;
    // Everything before this point is checked again, in case the host edited
    // an earlier step from the review links and left it incomplete.
    for (const candidate of WEB_CREATE_STEPS) {
      if (candidate !== 'review' && validateStep(candidate, draft)) {
        goTo(candidate);
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

  const AppStep = (isDesktop ? DESKTOP_STEPS[shownStep] : undefined) ?? APP_STEPS[shownStep];

  // On a desktop the page carries Continue, so it decides when it is ready.
  const blocked =
    step === 'review'
      ? !isSignedIn || submitting !== null || !plan
      : step === 'package'
        ? !plan
        : shownStep === 'closing' && isDesktop
          ? (validateStep('closing', draft) ?? validateStep('closing-time', draft)) !== null
          : validateStep(step, draft) !== null;
  const continueLabel =
    step !== 'review'
      ? 'Continue'
      : submitting === 'preparing'
        ? 'Saving your event…'
        : submitting === 'redirecting'
          ? 'Opening secure checkout…'
          : plan?.isFree
            ? copy.create.publish
            : `Continue to payment · ${plan ? price(plan) : ''}`;
  const notice =
    alreadyLive && step === 'name' ? (
      <>
        &ldquo;{alreadyLive.title}&rdquo; is already live — your payment went through.{' '}
        <a className="wc-text-button" href={`/host/${alreadyLive.id}`}>
          Open it
        </a>
      </>
    ) : params.checkout === 'cancelled' && step === 'review' ? (
      'Payment cancelled — nothing was charged. Your event is saved here whenever you are ready.'
    ) : null;

  return (
    <div className="wc-root wc-flow">
      <style dangerouslySetInnerHTML={{ __html: WEB_CREATE_CSS }} />
      <div className="wc-sky" aria-hidden="true" />

      <header className="wc-topbar">
        <a href="/" className="wc-logo" aria-label="Stills. home">
          <StillsLockup size={22} />
        </a>
        <div
          className="wc-segments"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
        >
          {steps.map((candidate, index) => (
            <span key={candidate} className={index <= stepIndex ? 'wc-segment-on' : undefined} />
          ))}
        </div>
        <a className="wc-text-link" href={isSignedIn ? '/host' : '/host/sign-in'}>
          {isSignedIn ? 'Your events' : 'Sign in'}
        </a>
      </header>

      {notice ? (
        <div className="wc-notice wc-flow-notice" role="status">
          {notice}
        </div>
      ) : null}

      <main className="wc-stage" data-step={shownStep}>
        <HostedCreationDraftProvider value={draftValue}>
          <CreationFlowHostContext.Provider value={host}>
            {/* Keyed by step, so each one mounts fresh and makes the same
                entrance it does in the app. */}
            <View key={shownStep} style={{ flex: 1 }}>
              {AppStep ? <AppStep /> : null}

              {step === 'package' && !isDesktop ? (
                <CreationStepScreen step="package" heading={copy.create.packageHeading} headingAlign="center">
                  <PackageChoices draft={draft} update={update} />
                </CreationStepScreen>
              ) : null}

              {step === 'review' ? (
                <CreationStepScreen
                  step="package"
                  heading={isSignedIn ? copy.create.reviewHeading : 'Sign in to save your event'}
                  headingAlign="center"
                  scrollable={false}
                  action={
                    <View style={{ gap: spacing.sm }}>
                      {submitError ? (
                        <AppText variant="caption" tone="error" align="center" accessibilityLiveRegion="polite">
                          {submitError}
                        </AppText>
                      ) : null}
                      <Button
                        label={
                          submitting === 'preparing'
                            ? 'Saving your event…'
                            : submitting === 'redirecting'
                              ? 'Opening secure checkout…'
                              : plan?.isFree
                                ? copy.create.publish
                                : `Continue to payment · ${plan ? price(plan) : ''}`
                        }
                        disabled={!isSignedIn || submitting !== null || !plan}
                        disabledReason={!isSignedIn ? 'Sign in first' : undefined}
                        onPress={() => void submit()}
                      />
                      {isSignedIn && plan && !plan.isFree ? (
                        <AppText variant="caption" tone="secondary" align="center">
                          Secure payment by Stripe. One payment, no subscription.
                        </AppText>
                      ) : null}
                    </View>
                  }
                >
                  {/* Nothing to re-read. Every answer is one Back away, so the
                      last step is only who the event belongs to. */}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <AccountPanel onBeforeRedirect={flush} />
                  </View>
                </CreationStepScreen>
              ) : null}
            </View>
          </CreationFlowHostContext.Provider>
        </HostedCreationDraftProvider>
      </main>

      {isDesktop ? (
        <footer className="wc-footbar">
          {submitError && step === 'review' ? (
            <p className="wc-foot-error" role="alert">
              {submitError}
            </p>
          ) : null}
          <div className="wc-foot-row">
            {stepIndex > 0 ? (
              <button type="button" className="wc-foot-back" onClick={host.goBack} disabled={submitting !== null}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="wc-continue"
              disabled={blocked}
              onClick={() => (step === 'review' ? void submit() : host.goNext())}
            >
              {continueLabel}
            </button>
          </div>
          {step === 'review' && isSignedIn && plan && !plan.isFree ? (
            <p className="wc-foot-note">Secure payment by Stripe. One payment, no subscription.</p>
          ) : null}
        </footer>
      ) : null}

      {creating ? (
        <div className="wc-creating" key={creating.run}>
          <CreatingOverlay visible={creating.visible} />
        </div>
      ) : null}

      {/* The cover step's "Add photo", which in the app opens the photo library. */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="wc-visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          void coverFileToDataUrl(file)
            .then((coverLocalUri) => update({ coverLocalUri, coverStoragePath: null }))
            .catch(() => {});
        }}
      />
    </div>
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

/** The package cards. The app sells through the App Store; these are the web's. */
function PackageChoices({ draft, update }: Pick<DraftContextValue, 'draft' | 'update'>) {
  const plans = [...PAYWALL_PLANS].sort((a, b) => b.sortOrder - a.sortOrder);
  const chosen = planForCatalogueKey(draft.planKey);
  const requested = draft.shotLimitPerGuest ?? null;
  const capped = chosen ? shotLimitForPlan(chosen, requested) : requested;

  return (
    <div className="wc-step-body">
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
                <span className="wc-plan-head">
                  <span className="wc-plan-name">{plan.displayName}</span>
                  <span className="wc-plan-price">
                    {price(plan)}
                    {!plan.isFree ? <span className="wc-plan-per"> {copy.create.packagePerEvent}</span> : null}
                  </span>
                </span>
                <p className="wc-plan-line">{planFeatures(plan).join(' · ')}</p>
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
    </div>
  );
}
