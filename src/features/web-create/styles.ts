import { colours, layout, radii, spacing, typography } from '@/design';
import { WEB_CREATE_DESKTOP_CSS } from './desktop-styles';

const display = typography.displayLarge.fontFamily;
const text = typography.body.fontFamily;
const medium = typography.label.fontFamily;
const semibold = typography.heading.fontFamily;

/**
 * Styles for the parts of web creation that are the browser's own.
 *
 * The steps themselves are the app's screens and bring their own styles. What
 * is styled here is the page around them, and the two things the web adds at
 * the end: the package cards and the sign-in-and-pay step, plus the page shown
 * once an event is created. Those are plain HTML so that sign-in fields,
 * autofill and the one-time-code keyboard behave as a browser's should.
 *
 * Written from the app's tokens, as variables, so `desktop-styles.ts` can
 * restate them above the breakpoint.
 */
const TOKENS = (
  [
    'background', 'surface', 'surfaceRaised', 'surfaceMuted', 'textPrimary', 'textSecondary', 'textOnBrand',
    'brandPrimary', 'brandPressed', 'brandSoft', 'accentWarm', 'borderSubtle', 'borderStrong', 'focusRing', 'error',
  ] as const
)
  .map((name) => `--wc-${name}: ${colours[name]};`)
  .join(' ');

export const WEB_CREATE_CSS = `
.wc-root { ${TOKENS} }
.wc-root { flex: 1 1 auto; height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; background: var(--wc-background); color: var(--wc-textPrimary); font-family: ${text}; }
.wc-root *, .wc-root *::before, .wc-root *::after { box-sizing: border-box; }
.wc-visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* The creation flow: one app screen filling the window, exactly as on a phone.
   The sky and the logo bar belong to the desktop layout only. */
.wc-flow { position: relative; display: flex; flex-direction: column; overflow: hidden; }
.wc-flow .wc-topbar, .wc-sky { display: none; }
.wc-stage { position: relative; z-index: 1; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.wc-flow-notice { position: relative; z-index: 1; margin: ${spacing.sm}px ${spacing.base}px 0; }
/* The creating moment keeps the app's black at every width: its animation is
   filmed on black, and the package page then opens out of the dark. */
.wc-creating { position: absolute; inset: 0; z-index: 10; display: flex; }
.wc-step-body { display: flex; flex-direction: column; gap: ${spacing.xl}px; }

.wc-topbar { display: flex; align-items: center; justify-content: space-between; padding: ${spacing.lg}px ${spacing.xl}px; max-width: 1180px; margin: 0 auto; }
.wc-logo { display: inline-flex; text-decoration: none; }
.wc-text-link { color: var(--wc-textSecondary); font: ${typography.label.fontSize}px ${medium}; text-decoration: none; }
.wc-text-link:hover { color: var(--wc-textPrimary); }
.wc-preview-caption { margin: 0; color: var(--wc-textSecondary); font: ${typography.caption.fontSize}px ${text}; text-align: center; }
.wc-phone { position: relative; width: 300px; aspect-ratio: 393 / 852; border-radius: ${radii.device}px; overflow: hidden; background: var(--wc-surface); border: ${layout.hairline}px solid var(--wc-borderSubtle); box-shadow: 0 30px 80px rgba(0,0,0,0.45); display: flex; }
@media (max-width: 960px) { .wc-topbar { padding: ${spacing.base}px; } }

.wc-title { margin: 0; font: ${typography.displayLarge.fontSize}px/${typography.displayLarge.lineHeight}px ${display}; letter-spacing: ${typography.displayLarge.letterSpacing}px; font-weight: normal; outline: none; }
.wc-supporting { margin: 0; color: var(--wc-textSecondary); font: ${typography.bodyLarge.fontSize}px/${typography.bodyLarge.lineHeight}px ${text}; }

.wc-fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: ${spacing.md}px; min-width: 0; }
.wc-label { font: ${typography.heading.fontSize}px/${typography.heading.lineHeight}px ${semibold}; color: var(--wc-textPrimary); padding: 0; }
.wc-sublabel { font: ${typography.label.fontSize}px ${medium}; color: var(--wc-textSecondary); }
.wc-help { margin: 0; color: var(--wc-textSecondary); font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; }
.wc-error { margin: 0; color: var(--wc-error); font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${medium}; }

.wc-input { height: 52px; width: 100%; padding: 0 ${spacing.base}px; color: var(--wc-textPrimary); background: var(--wc-surface); border: ${layout.hairline}px solid var(--wc-borderStrong); border-radius: ${radii.lg}px; font: ${typography.bodyLarge.fontSize}px ${text}; color-scheme: dark; transition: border-color 120ms; }
.wc-input::placeholder { color: var(--wc-textSecondary); opacity: 0.8; }
.wc-input:hover { border-color: var(--wc-textSecondary); }
.wc-input:focus { outline: none; border-color: var(--wc-focusRing); box-shadow: 0 0 0 1px var(--wc-focusRing); }
.wc-input[aria-invalid="true"] { border-color: var(--wc-error); }
.wc-input-code { font: 28px ${medium}; letter-spacing: 10px; text-align: center; max-width: 260px; }

/* Package cards. A chosen one is ticked as well as outlined, so the choice
   never rests on colour alone. */
.wc-plans { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${spacing.md}px; }
.wc-plan { position: relative; cursor: pointer; }
.wc-plan input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.wc-plan-body { position: relative; display: flex; flex-direction: column; gap: ${spacing.xs}px; height: 100%; padding: ${spacing.lg}px; border-radius: ${radii.xl}px; background: var(--wc-surface); border: ${layout.hairline}px solid var(--wc-borderSubtle); transition: border-color 120ms, background 120ms; }
.wc-plan:hover .wc-plan-body { border-color: var(--wc-borderStrong); }
.wc-plan input:checked + .wc-plan-body { border-color: var(--wc-brandPrimary); background: var(--wc-brandSoft); box-shadow: inset 0 0 0 1px var(--wc-brandPrimary); }
.wc-plan input:checked + .wc-plan-body::after { content: ''; position: absolute; top: ${spacing.base}px; right: ${spacing.base}px; width: 24px; height: 24px; border-radius: 50%; background: var(--wc-brandPrimary) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b0b0c' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6.5 12.5l3.6 3.6 7.4-8'/%3E%3C/svg%3E") center / 16px no-repeat; }
.wc-plan input:focus-visible + .wc-plan-body { outline: 2px solid var(--wc-focusRing); outline-offset: 2px; }
.wc-plan-head { display: flex; align-items: baseline; justify-content: space-between; gap: ${spacing.md}px; padding-right: 36px; }
.wc-plan-badge { align-self: flex-start; padding: ${spacing.xxs}px ${spacing.sm}px; border-radius: ${radii.pill}px; background: var(--wc-accentWarm); color: var(--wc-textOnBrand); font: ${typography.eyebrow.fontSize}px ${medium}; letter-spacing: ${typography.eyebrow.letterSpacing}px; text-transform: uppercase; }
.wc-plan-name { font: ${typography.titleMedium.fontSize}px ${display}; }
.wc-plan-price { font: ${typography.titleMedium.fontSize}px ${display}; white-space: nowrap; }
.wc-plan-per { font: ${typography.bodySmall.fontSize}px ${text}; color: var(--wc-textSecondary); }
.wc-plan-line { margin: 0; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; color: var(--wc-textSecondary); }

.wc-account { display: flex; flex-direction: column; gap: ${spacing.base}px; padding: ${spacing.lg}px; border-radius: ${radii.xl}px; background: var(--wc-surface); border: ${layout.hairline}px solid var(--wc-borderSubtle); }
.wc-account-signed-in { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: ${spacing.base}px; }
.wc-account-email { font: ${typography.labelLarge.fontSize}px ${medium}; margin: ${spacing.xs}px 0; overflow-wrap: anywhere; }
.wc-auth-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${spacing.sm}px; }
@media (max-width: 520px) { .wc-auth-buttons { grid-template-columns: 1fr; } }
.wc-divider { display: flex; align-items: center; gap: ${spacing.md}px; color: var(--wc-textSecondary); font: ${typography.caption.fontSize}px ${text}; }
.wc-divider::before, .wc-divider::after { content: ''; flex: 1; height: 1px; background: var(--wc-borderSubtle); }
.wc-email-row { display: flex; gap: ${spacing.sm}px; flex-wrap: wrap; }
.wc-email-row .wc-input { flex: 1; min-width: 200px; }
.wc-code { display: flex; flex-direction: column; gap: ${spacing.md}px; }
.wc-code-actions { display: flex; gap: ${spacing.base}px; flex-wrap: wrap; }

.wc-button { display: inline-flex; align-items: center; justify-content: center; gap: ${spacing.sm}px; height: 48px; padding: 0 ${spacing.xl}px; border-radius: ${radii.lg}px; border: 0; font: ${typography.button.fontSize}px ${medium}; letter-spacing: ${typography.button.letterSpacing}px; cursor: pointer; text-decoration: none; transition: background 120ms, opacity 120ms; white-space: nowrap; }
.wc-button:disabled { cursor: not-allowed; opacity: 0.45; }
.wc-button:focus-visible, .wc-text-button:focus-visible { outline: 2px solid var(--wc-focusRing); outline-offset: 2px; }
.wc-button-primary { background: var(--wc-brandPrimary); color: var(--wc-textOnBrand); }
.wc-button-primary:hover:not(:disabled) { background: var(--wc-brandPressed); }
.wc-button-secondary { background: var(--wc-surfaceRaised); color: var(--wc-textPrimary); }
.wc-button-secondary:hover:not(:disabled) { background: var(--wc-borderSubtle); }
.wc-text-button { padding: ${spacing.xs}px 0; background: none; border: 0; color: var(--wc-accentWarm); font: ${typography.label.fontSize}px ${medium}; cursor: pointer; }
.wc-text-button:hover:not(:disabled) { text-decoration: underline; }
.wc-text-button:disabled { opacity: 0.5; cursor: default; }

.wc-notice { padding: ${spacing.md}px ${spacing.base}px; border-radius: ${radii.md}px; background: var(--wc-surfaceRaised); border: ${layout.hairline}px solid var(--wc-borderSubtle); font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; color: var(--wc-textPrimary); }
.wc-notice-error { border-color: var(--wc-error); }

${WEB_CREATE_DESKTOP_CSS}
@media (prefers-reduced-motion: reduce) { .wc-root *, .wc-root *::before, .wc-root *::after { transition: none !important; animation: none !important; } }
`;
