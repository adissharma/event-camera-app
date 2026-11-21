import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  buildMonth,
  combineDateAndTime,
  DEFAULT_CLOSING_HOURS,
  DEFAULT_CLOSING_MINUTES,
  getClosingDateBounds,
  isSameDay,
  startOfDay,
  WEEKDAY_LABELS,
} from '@/components/forms/month-calendar';
import {
  MOMENT_LIMIT_VALUES,
  momentLimitDotProgress,
  momentLimitIndex,
  type MomentLimit,
} from '@/components/forms/stepped-slider-values';
import { DeviceFrame } from '@/components/media/device-frame';
import { CaptureLimitPreview } from '@/features/celebrations/creation/capture-limit-preview';
import { colours } from '@/design';
import { useCreationFlowHost } from '@/features/celebrations/creation/flow-host';
import { GuestCoverPreview, parseCoverTheme } from '@/features/celebrations/creation/guest-cover-preview';
import { GENERIC_SUGGESTIONS, type NameSuggestion } from '@/features/celebrations/creation/name-suggestions';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { validateStep } from '@/features/celebrations/draft/validation';
import { LOCALE_CONFIG } from '@/config/app-config';
import { shotLimitForPlan } from '@/features/entitlements/guest-limit';
import {
  PAYWALL_PLANS,
  planFeatureRows,
  planForCatalogueKey,
  planGuestSubtitle,
  type PaywallPlan,
} from '@/features/payments/plan-catalogue';
import { copy } from '@/i18n';
import { formatPrice } from '@/services/plans';
import { listCoverTemplateThemes, themeKeys } from '@/services/themes';

/**
 * The steps whose app control is a phone gesture (the date and time wheels, a
 * carousel to swipe) or is drawn for the app's black canvas (the name field and
 * its suggestions). On a desk each has a better shape, so these ask the
 * same question with the control a desktop expects. They read and write the
 * same draft, and every other step is the app's own.
 */

/** The name, in a field drawn for the sky rather than the app's black. */
export function DesktopNameStep() {
  const { draft, update } = useCreationDraft();
  const host = useCreationFlowHost();
  const inputRef = useRef<HTMLInputElement>(null);

  function apply(suggestion: NameSuggestion) {
    update({ title: suggestion.value });
    const caret = suggestion.cursorAt ?? suggestion.value.length;
    // After the value lands, so the caret is placed in the new text.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <CreationStepScreen step="name" heading={copy.create.nameHeading}>
      <input
        ref={inputRef}
        className="dk-name"
        aria-label="Event name"
        placeholder={copy.create.namePlaceholder}
        value={draft.title}
        maxLength={200}
        autoComplete="off"
        autoFocus
        onChange={(event) => update({ title: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !validateStep('name', draft)) host?.goNext();
        }}
      />
      <p className="dk-suggestions-title" id="dk-suggestions-title">
        Common occasions
      </p>
      <div className="dk-suggestions" role="group" aria-labelledby="dk-suggestions-title">
        {GENERIC_SUGGESTIONS.map((suggestion) => (
          <button key={suggestion.value} type="button" className="dk-chip" onClick={() => apply(suggestion)}>
            {suggestion.label}
          </button>
        ))}
      </div>
    </CreationStepScreen>
  );
}

function selectedEnd(endsAt: string | null): Date | null {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  return Number.isFinite(date.getTime()) ? date : null;
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const QUARTERS = [0, 15, 30, 45];

/**
 * When the event ends: the day and the time, on one page.
 *
 * The app asks these as two questions because a phone has room for one wheel
 * set at a time. A desk has room for both, and they are one answer: a month
 * to pick the day from, and beneath it the time as three dropdowns (hour,
 * minutes in quarter hours, AM or PM) in the order a time is read aloud.
 * Nothing else is on the page.
 */
export function DesktopWhenStep() {
  const { draft, update } = useCreationDraft();
  const bounds = useMemo(() => getClosingDateBounds(), []);
  const selected =
    selectedEnd(draft.endsAt) ?? combineDateAndTime(bounds.minimum, DEFAULT_CLOSING_HOURS, DEFAULT_CLOSING_MINUTES);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const month = buildMonth(cursor.getFullYear(), cursor.getMonth());
  const canGoBack = cursor > new Date(bounds.minimum.getFullYear(), bounds.minimum.getMonth(), 1);
  const canGoForward = cursor < new Date(bounds.maximum.getFullYear(), bounds.maximum.getMonth(), 1);

  const hours24 = selected.getHours();
  const hour12 = hours24 % 12 || 12;
  const minute = selected.getMinutes();
  const isPm = hours24 >= 12;
  // The app's default close is 11:59 PM, which is not a quarter hour. It is
  // listed as it is rather than quietly moved to another time.
  const minutes = QUARTERS.includes(minute) ? QUARTERS : [...QUARTERS, minute].sort((a, b) => a - b);

  // A draft with no end yet gets the app's default, so Continue is ready.
  useEffect(() => {
    if (!draft.endsAt) update({ endsAt: selected.toISOString() });
  }, [draft.endsAt, selected, update]);

  function setDay(day: Date) {
    update({ endsAt: combineDateAndTime(day, hours24, minute).toISOString() });
  }

  function setTime(nextHour12: number, nextMinute: number, nextPm: boolean) {
    const nextHours = (nextHour12 % 12) + (nextPm ? 12 : 0);
    update({ endsAt: combineDateAndTime(selected, nextHours, nextMinute).toISOString() });
  }

  return (
    <CreationStepScreen step="closing" heading="When does your event end?">
      <div className="dk-when">
        <div className="dk-month-head">
          <button
            type="button"
            className="dk-cal-nav"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            <Chevron />
          </button>
          <div className="dk-month-label" aria-live="polite">
            {month.label}
          </div>
          <button
            type="button"
            className="dk-cal-nav"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            disabled={!canGoForward}
            aria-label="Next month"
          >
            <Chevron flip />
          </button>
        </div>
        <div className="dk-grid" role="grid" aria-label={month.label}>
          {WEEKDAY_LABELS.map((label, index) => (
            <div key={`${label}-${index}`} className="dk-weekday" aria-hidden="true">
              {label}
            </div>
          ))}
          {month.weeks.flat().map((cell) => {
            if (!cell.date) return <span key={cell.key} />;
            const day = cell.date;
            const allowed = day >= bounds.minimum && day <= bounds.maximum;
            const isSelected = isSameDay(day, startOfDay(selected));
            return (
              <button
                key={cell.key}
                type="button"
                className={`dk-day${isSelected ? ' dk-day-on' : ''}`}
                disabled={!allowed}
                aria-pressed={isSelected}
                aria-label={day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                onClick={() => setDay(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="dk-when-time">
          <span className="dk-when-label" id="dk-when-time">
            Ends at
          </span>
          <div className="dk-time-selects" role="group" aria-labelledby="dk-when-time">
            <select aria-label="Hour" value={hour12} onChange={(event) => setTime(Number(event.target.value), minute, isPm)}>
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <span className="dk-time-colon" aria-hidden="true">
              :
            </span>
            <select aria-label="Minutes" value={minute} onChange={(event) => setTime(hour12, Number(event.target.value), isPm)}>
              {minutes.map((value) => (
                <option key={value} value={value}>
                  {String(value).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select aria-label="AM or PM" value={isPm ? 'PM' : 'AM'} onChange={(event) => setTime(hour12, minute, event.target.value === 'PM')}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>
    </CreationStepScreen>
  );
}

/** The line under the number, as the app's own step says it. */
const LIMIT_LINES: Record<string, string> = {
  5: 'Five shots. Make them count.',
  10: 'A little room to play.',
  16: 'Plenty for the best bits.',
  24: 'More moments, fewer regrets.',
  36: 'Go on, get snap-happy.',
  unlimited: 'Unlimited. Snap without counting.',
};

/**
 * Photos per guest: the app's gradient slider, made for a mouse.
 *
 * The slider is a real range input, so the thumb drags, and the arrow keys,
 * Home and End all work. A track alone asks a mouse to hit a small target
 * precisely, so every stop also has its value written beneath it as a button:
 * click "24" and that is the answer. The phone in the app's preview above
 * shows the choice as the guest's camera will.
 */
export function DesktopPhotoLimitStep() {
  const { draft, update } = useCreationDraft();
  const stored = draft.shotLimitPerGuest;
  const index = momentLimitIndex(
    stored === undefined ? 16 : MOMENT_LIMIT_VALUES.includes(stored as Exclude<MomentLimit, null>) ? (stored as MomentLimit) : 16,
  );
  const value = MOMENT_LIMIT_VALUES[index] ?? null;
  const last = MOMENT_LIMIT_VALUES.length - 1;
  const fill = index === last ? 1 : momentLimitDotProgress(index);

  // The app's step settles an unset draft on a value; this one does the same.
  useEffect(() => {
    if (stored === undefined || stored !== value) update({ shotLimitPerGuest: value });
  }, [stored, update, value]);

  function choose(next: number) {
    const limit = MOMENT_LIMIT_VALUES[Math.max(0, Math.min(last, next))];
    if (limit !== undefined) update({ shotLimitPerGuest: limit });
  }

  return (
    <CreationStepScreen step="photo-limit" heading={copy.create.photoLimitHeading}>
      <div className="dk-limit">
        <View style={{ alignItems: 'center' }}>
          <CaptureLimitPreview limit={value} />
        </View>
        <div className="dk-limit-number" aria-hidden="true">
          {value === null ? '∞' : value}
        </div>
        <p className="dk-limit-line">{LIMIT_LINES[value === null ? 'unlimited' : String(value)]}</p>

        <div className="dk-slider">
          <span className="dk-slider-fill" style={{ width: `${fill * 100}%` }} />
          {MOMENT_LIMIT_VALUES.map((stop, stopIndex) => (
            <span
              key={String(stop)}
              className={`dk-slider-dot${stopIndex <= index ? ' dk-slider-dot-on' : ''}`}
              style={{ left: `${momentLimitDotProgress(stopIndex) * 100}%` }}
            />
          ))}
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={index}
            aria-label="Photos per guest"
            aria-valuetext={value === null ? 'Unlimited' : `${value} photos`}
            onChange={(event) => choose(Number(event.target.value))}
          />
        </div>

        <div className="dk-stops" role="radiogroup" aria-label="Photos per guest, by value">
          {MOMENT_LIMIT_VALUES.map((stop, stopIndex) => (
            <button
              key={String(stop)}
              type="button"
              role="radio"
              aria-checked={stopIndex === index}
              aria-label={stop === null ? 'Unlimited' : `${stop} photos`}
              tabIndex={-1}
              className={`dk-stop${stopIndex === index ? ' dk-stop-on' : ''}`}
              style={{ left: `${momentLimitDotProgress(stopIndex) * 100}%` }}
              onClick={() => choose(stopIndex)}
            >
              {stop === null ? '∞' : stop}
            </button>
          ))}
        </div>
      </div>
    </CreationStepScreen>
  );
}

const COVER_FRAME_WIDTH = 150;

/** All three covers at once, which a desk has the width for. */
export function DesktopCoverStep() {
  const { draft, update } = useCreationDraft();
  const host = useCreationFlowHost();
  const { data: themes = [], isLoading } = useQuery({
    queryKey: themeKeys.curated(),
    queryFn: listCoverTemplateThemes,
  });
  const selectedSlug =
    themes.find((theme) => theme.slug === draft.themeSlug || theme.id === draft.themeSlug)?.slug ?? themes[0]?.slug ?? null;

  return (
    <CreationStepScreen step="cover" heading={copy.create.coverHeading}>
      {isLoading ? (
        <View style={{ height: 380, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colours.textSecondary} />
        </View>
      ) : (
        <div className="dk-covers" role="radiogroup" aria-label="Cover style">
          {themes.map((theme) => {
            const on = theme.slug === selectedSlug;
            return (
              // Not a <button>: the preview inside draws the guest's own
              // Join button, and buttons cannot be nested.
              <div
                key={theme.id}
                role="radio"
                aria-checked={on}
                aria-label={theme.name}
                tabIndex={on ? 0 : -1}
                className={`dk-cover${on ? ' dk-cover-on' : ''}`}
                onClick={() => update({ themeSlug: theme.slug })}
                onKeyDown={(event) => {
                  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    update({ themeSlug: theme.slug });
                  } else if (step) {
                    event.preventDefault();
                    const next = themes[(themes.indexOf(theme) + step + themes.length) % themes.length];
                    if (next) update({ themeSlug: next.slug });
                    const cards = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role=radio]');
                    cards?.[themes.indexOf(next ?? theme)]?.focus();
                  }
                }}
              >
                <span className="dk-cover-frame" aria-hidden="true" inert>
                  <DeviceFrame width={COVER_FRAME_WIDTH}>
                    <GuestCoverPreview
                      draft={draft}
                      theme={parseCoverTheme(theme.design_tokens, theme.slug)}
                      compact
                      hideCountdownMinutes
                    />
                  </DeviceFrame>
                </span>
                <span className="dk-cover-name">{theme.name}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="dk-cover-actions">
        <button type="button" className="dk-pill dk-pill-wide" onClick={() => host?.pickCover?.()}>
          {draft.coverLocalUri ? 'Change your photo' : '+ Add your own photo'}
        </button>
        {draft.coverLocalUri ? (
          <button type="button" className="dk-text-button" onClick={() => update({ coverLocalUri: null, coverStoragePath: null })}>
            {copy.create.removePhoto}
          </button>
        ) : null}
      </div>
    </CreationStepScreen>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Prints from the homepage's own wedding, fanned behind the phone. A bigger
 * package lays out more of them: the stack is the album growing.
 */
const PRINTS = [
  { src: '/story/photo/print-p07-s.webp', x: -232, y: 26, r: -9 },
  { src: '/story/photo/print-p05-s.webp', x: 232, y: 40, r: 8 },
  { src: '/story/photo/print-p03-s.webp', x: -190, y: 214, r: 6 },
  { src: '/story/photo/print-p01-s.webp', x: 196, y: 224, r: -6 },
  { src: '/story/photo/print-p10-s.webp', x: -132, y: -34, r: -16 },
  { src: '/story/photo/print-p12-s.webp', x: 140, y: -24, r: 14 },
];

function printsFor(plan: PaywallPlan | null): number {
  if (!plan || plan.isFree) return 2;
  if (plan.guestLimit === 'unlimited') return PRINTS.length;
  return plan.guestLimit >= 100 ? 4 : 3;
}

function planPrice(plan: PaywallPlan): string {
  return plan.isFree ? 'Free' : formatPrice(plan.priceMinorUnits, plan.currency, LOCALE_CONFIG.locale);
}

/**
 * Choosing a package, the way good pricing pages work.
 *
 * On the left, what they are buying, made concrete: their own event's cover in
 * the phone, real photographs from a party fanned out behind it, and the
 * selected package's features ticked or crossed beneath, always the same rows
 * in the same order so moving between packages reads as one list answering
 * differently. The stack of prints grows with the package.
 *
 * On the right, the packages as cards to compare at a glance: name, who it is
 * for, price, the recommended one marked. Choosing is one click. This is the
 * app's own paywall arrangement (the features answer the selected plan), laid
 * out side by side because a desk has the width for it.
 */
export function DesktopPackageStep() {
  const { draft, update } = useCreationDraft();
  const { data: themes = [] } = useQuery({
    queryKey: themeKeys.curated(),
    queryFn: listCoverTemplateThemes,
  });
  const theme = themes.find((candidate) => candidate.slug === draft.themeSlug) ?? themes[0];
  const plans = [...PAYWALL_PLANS].sort((a, b) => b.sortOrder - a.sortOrder);
  const chosen = planForCatalogueKey(draft.planKey);
  const shown = printsFor(chosen);
  const requested = draft.shotLimitPerGuest ?? null;
  const capped = chosen ? shotLimitForPlan(chosen, requested) : requested;

  return (
    <CreationStepScreen step="package" heading={copy.create.packageHeading}>
      <div className="dk-package">
        <div className="dk-showcase" aria-hidden="true">
          <div className="dk-prints">
            {PRINTS.map((print, index) => (
              <img
                key={print.src}
                src={print.src}
                alt=""
                className={`dk-print${index < shown ? ' dk-print-on' : ''}`}
                style={{ '--x': `${print.x}px`, '--y': `${print.y}px`, '--r': `${print.r}deg` } as CSSProperties}
              />
            ))}
            <div className="dk-showcase-phone">
              <DeviceFrame width={196}>
                <GuestCoverPreview
                  draft={draft}
                  theme={theme ? parseCoverTheme(theme.design_tokens, theme.slug) : undefined}
                  compact
                />
              </DeviceFrame>
            </div>
          </div>
        </div>

        <div className="dk-plans-side">
          <div className="dk-plan-list" role="radiogroup" aria-label="Package">
            {plans.map((plan) => {
              const on = plan.catalogueKey === draft.planKey;
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`dk-plan${on ? ' dk-plan-on' : ''}${plan.isRecommended ? ' dk-plan-best' : ''}`}
                  onClick={() => update({ planKey: plan.catalogueKey })}
                >
                  <span className="dk-plan-radio" aria-hidden="true" />
                  <span className="dk-plan-text">
                    <span className="dk-plan-name">
                      {plan.displayName}
                      {plan.isRecommended ? <span className="dk-plan-badge">Most popular</span> : null}
                    </span>
                    <span className="dk-plan-sub">{planGuestSubtitle(plan)}</span>
                  </span>
                  <span className="dk-plan-price">{planPrice(plan)}</span>
                </button>
              );
            })}
          </div>

          {chosen ? (
            <ul key={chosen.id} className="dk-features" aria-label={`Included in ${chosen.displayName}`}>
              {planFeatureRows(chosen).map((row) => (
                <li key={row.key} className={row.included ? 'dk-feature-on' : 'dk-feature-off'}>
                  <span className="dk-feature-mark" aria-hidden="true" />
                  {row.label}
                  {row.included ? null : <span className="wc-visually-hidden"> (not included)</span>}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="dk-plan-note">
            {chosen && capped !== requested
              ? `${chosen.displayName} includes ${capped} photos per guest, so your camera will allow ${capped}.`
              : 'One payment per event. No subscription.'}
          </p>
        </div>
      </div>
    </CreationStepScreen>
  );
}
