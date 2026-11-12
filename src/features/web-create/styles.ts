import { colours, layout, radii, spacing, typography } from '@/design';

const display = typography.displayLarge.fontFamily;
const text = typography.body.fontFamily;
const medium = typography.label.fontFamily;
const semibold = typography.heading.fontFamily;

/**
 * The web form's styles, written from the app's own tokens.
 *
 * Plain CSS rather than React Native styles because the controls here are the
 * browser's own — real `<input type="date">`, radios inside labels, a file
 * input — which is most of what makes a form feel right on the web: autofill,
 * keyboard, screen readers and the platform date picker all come for free.
 */
export const WEB_CREATE_CSS = `
.wc-root { flex: 1 1 auto; height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; background: ${colours.background}; color: ${colours.textPrimary}; font-family: ${text}; }
.wc-root *, .wc-root *::before, .wc-root *::after { box-sizing: border-box; }
.wc-visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.wc-topbar { display: flex; align-items: center; justify-content: space-between; padding: ${spacing.lg}px ${spacing.xl}px; max-width: 1180px; margin: 0 auto; }
.wc-logo { display: inline-flex; text-decoration: none; }
.wc-text-link { color: ${colours.textSecondary}; font: ${typography.label.fontSize}px ${medium}; text-decoration: none; }
.wc-text-link:hover { color: ${colours.textPrimary}; }

.wc-progress { list-style: none; display: flex; gap: ${spacing.sm}px; max-width: 1180px; margin: 0 auto; padding: 0 ${spacing.xl}px; }
.wc-progress-step { flex: 1; min-width: 0; }
.wc-progress-button { display: flex; flex-direction: column; gap: ${spacing.sm}px; width: 100%; padding: ${spacing.xs}px 0; background: none; border: 0; color: inherit; text-align: left; font: inherit; }
button.wc-progress-button { cursor: pointer; }
.wc-progress-bar { display: block; height: 2px; border-radius: 2px; background: ${colours.borderSubtle}; transition: background 200ms; }
.wc-progress-done .wc-progress-bar, .wc-progress-current .wc-progress-bar { background: ${colours.brandPrimary}; }
.wc-progress-label { font: ${typography.eyebrow.fontSize}px ${medium}; letter-spacing: ${typography.eyebrow.letterSpacing}px; text-transform: uppercase; color: ${colours.textSecondary}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wc-progress-current .wc-progress-label { color: ${colours.textPrimary}; }
button.wc-progress-button:hover .wc-progress-label { color: ${colours.textPrimary}; }

.wc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: ${spacing.huge}px; max-width: 1180px; margin: 0 auto; padding: ${spacing.xxxl}px ${spacing.xl}px ${spacing.giant}px; align-items: start; }
.wc-form { display: flex; flex-direction: column; gap: ${spacing.xxl}px; max-width: 640px; min-width: 0; }
.wc-preview-sticky { position: sticky; top: ${spacing.xl}px; display: flex; flex-direction: column; align-items: center; gap: ${spacing.md}px; }
.wc-preview-caption { margin: 0; color: ${colours.textSecondary}; font: ${typography.caption.fontSize}px ${text}; text-align: center; }
.wc-phone { position: relative; width: 300px; aspect-ratio: 393 / 852; border-radius: ${radii.device}px; overflow: hidden; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; box-shadow: 0 30px 80px rgba(0,0,0,0.45); display: flex; }
.wc-inline-preview { display: none; }

@media (max-width: 960px) {
  .wc-layout { grid-template-columns: minmax(0, 1fr); padding: ${spacing.xl}px ${spacing.base}px ${spacing.giant}px; gap: ${spacing.xl}px; }
  .wc-preview { display: none; }
  .wc-inline-preview { display: flex; justify-content: center; }
  .wc-inline-preview .wc-phone { width: min(240px, 70vw); }
  .wc-form { max-width: none; }
  .wc-topbar { padding: ${spacing.base}px; }
  .wc-progress { padding: 0 ${spacing.base}px; gap: ${spacing.xs}px; }
}

.wc-heading { display: flex; flex-direction: column; gap: ${spacing.sm}px; }
.wc-title { margin: 0; font: ${typography.displayLarge.fontSize}px/${typography.displayLarge.lineHeight}px ${display}; letter-spacing: ${typography.displayLarge.letterSpacing}px; font-weight: normal; outline: none; }
@media (min-width: 961px) { .wc-title { font-size: 44px; line-height: 48px; } }
.wc-supporting { margin: 0; color: ${colours.textSecondary}; font: ${typography.bodyLarge.fontSize}px/${typography.bodyLarge.lineHeight}px ${text}; }

.wc-field { display: flex; flex-direction: column; gap: ${spacing.sm}px; min-width: 0; }
.wc-fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: ${spacing.md}px; min-width: 0; }
.wc-label { font: ${typography.heading.fontSize}px/${typography.heading.lineHeight}px ${semibold}; color: ${colours.textPrimary}; padding: 0; }
.wc-sublabel { font: ${typography.label.fontSize}px ${medium}; color: ${colours.textSecondary}; }
.wc-help { margin: 0; color: ${colours.textSecondary}; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; }
.wc-error { margin: 0; color: ${colours.error}; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${medium}; }
.wc-row { display: flex; gap: ${spacing.md}px; flex-wrap: wrap; }
.wc-grow { flex: 1; min-width: 180px; }

.wc-input { height: 52px; width: 100%; padding: 0 ${spacing.base}px; color: ${colours.textPrimary}; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderStrong}; border-radius: ${radii.lg}px; font: ${typography.bodyLarge.fontSize}px ${text}; color-scheme: dark; transition: border-color 120ms; }
.wc-input::placeholder { color: ${colours.textSecondary}; opacity: 0.8; }
.wc-input:hover { border-color: ${colours.textSecondary}; }
.wc-input:focus { outline: none; border-color: ${colours.focusRing}; box-shadow: 0 0 0 1px ${colours.focusRing}; }
.wc-input[aria-invalid="true"] { border-color: ${colours.error}; }
.wc-input-editorial { height: 64px; font: 24px ${text}; letter-spacing: -0.2px; }
.wc-input-code { font: 28px ${medium}; letter-spacing: 10px; text-align: center; max-width: 260px; }

.wc-chips { display: flex; flex-wrap: wrap; gap: ${spacing.sm}px; }
.wc-chip { min-height: 40px; padding: ${spacing.sm}px ${spacing.base}px; border-radius: ${radii.pill}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderStrong}; color: ${colours.textPrimary}; font: ${typography.bodySmall.fontSize}px ${text}; cursor: pointer; }
.wc-chip:hover { background: ${colours.surfaceRaised}; }

.wc-options { display: grid; gap: ${spacing.md}px; }
.wc-options-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 640px) { .wc-options-3 { grid-template-columns: 1fr; } }
.wc-option, .wc-plan, .wc-segment, .wc-toggle { position: relative; cursor: pointer; }
.wc-option input, .wc-plan input, .wc-segment input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.wc-option-body { display: flex; flex-direction: column; gap: ${spacing.xs}px; height: 100%; padding: ${spacing.base}px; border-radius: ${radii.lg}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; transition: border-color 120ms, background 120ms; }
.wc-option:hover .wc-option-body { border-color: ${colours.borderStrong}; }
.wc-option input:checked + .wc-option-body { border-color: ${colours.brandPrimary}; background: ${colours.brandSoft}; box-shadow: inset 0 0 0 1px ${colours.brandPrimary}; }
.wc-option input:focus-visible + .wc-option-body, .wc-plan input:focus-visible + .wc-plan-body, .wc-segment input:focus-visible + span { outline: 2px solid ${colours.focusRing}; outline-offset: 2px; }
.wc-option-title { display: block; font: ${typography.labelLarge.fontSize}px/${typography.labelLarge.lineHeight}px ${medium}; color: ${colours.textPrimary}; }
.wc-option-description { display: block; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; color: ${colours.textSecondary}; }
.wc-option-description:empty { display: none; }
.wc-swatch { width: 22px; height: 22px; border-radius: 50%; border: ${layout.hairline}px solid ${colours.borderStrong}; margin-bottom: ${spacing.xs}px; }

.wc-segmented { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: ${spacing.xs}px; padding: ${spacing.xs}px; border-radius: ${radii.lg}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-segment span { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: ${radii.md}px; font: 22px ${display}; color: ${colours.textSecondary}; transition: background 120ms, color 120ms; }
.wc-segment:hover span { color: ${colours.textPrimary}; }
.wc-segment input:checked + span { background: ${colours.brandPrimary}; color: ${colours.textOnBrand}; }

.wc-toggle { display: flex; align-items: flex-start; gap: ${spacing.md}px; padding: ${spacing.base}px; border-radius: ${radii.lg}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-toggle input { appearance: none; flex: none; width: 44px; height: 26px; margin: 0; border-radius: 13px; background: ${colours.borderStrong}; position: relative; cursor: pointer; transition: background 150ms; }
.wc-toggle input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: ${colours.textPrimary}; transition: transform 150ms; }
.wc-toggle input:checked { background: ${colours.success}; }
.wc-toggle input:checked::after { transform: translateX(18px); }
.wc-toggle input:focus-visible { outline: 2px solid ${colours.focusRing}; outline-offset: 2px; }
.wc-toggle > span { display: flex; flex-direction: column; gap: ${spacing.xxs}px; }

.wc-drop { display: flex; flex-direction: column; align-items: center; gap: ${spacing.sm}px; padding: ${spacing.xxl}px ${spacing.lg}px; border-radius: ${radii.lg}px; border: 1.5px dashed ${colours.borderStrong}; background: ${colours.surfaceMuted}; text-align: center; transition: border-color 120ms, background 120ms; }
.wc-drop-active { border-color: ${colours.brandPrimary}; background: ${colours.brandSoft}; }
.wc-drop-title { margin: 0; font: ${typography.labelLarge.fontSize}px ${medium}; }
.wc-drop .wc-button { margin-top: ${spacing.sm}px; }
.wc-cover-chosen { display: flex; align-items: center; gap: ${spacing.base}px; padding: ${spacing.md}px; border-radius: ${radii.lg}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-cover-chosen img { width: 64px; height: 96px; object-fit: cover; border-radius: ${radii.md}px; }
.wc-cover-actions { display: flex; align-items: center; gap: ${spacing.md}px; flex-wrap: wrap; }

.wc-plans { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${spacing.md}px; }
@media (max-width: 640px) { .wc-plans { grid-template-columns: 1fr; } }
.wc-plan-body { display: flex; flex-direction: column; gap: ${spacing.sm}px; height: 100%; padding: ${spacing.lg}px; border-radius: ${radii.xl}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; transition: border-color 120ms, background 120ms; }
.wc-plan:hover .wc-plan-body { border-color: ${colours.borderStrong}; }
.wc-plan input:checked + .wc-plan-body { border-color: ${colours.brandPrimary}; background: ${colours.brandSoft}; box-shadow: inset 0 0 0 1px ${colours.brandPrimary}; }
.wc-plan-badge { align-self: flex-start; padding: ${spacing.xxs}px ${spacing.sm}px; border-radius: ${radii.pill}px; background: ${colours.accentWarm}; color: ${colours.textOnBrand}; font: ${typography.eyebrow.fontSize}px ${medium}; letter-spacing: ${typography.eyebrow.letterSpacing}px; text-transform: uppercase; }
.wc-plan-name { font: ${typography.titleMedium.fontSize}px ${display}; }
.wc-plan-price { font: ${typography.numericLarge.fontSize}px/${typography.numericLarge.lineHeight}px ${display}; }
.wc-plan-per { font: ${typography.bodySmall.fontSize}px ${text}; color: ${colours.textSecondary}; }
.wc-plan-features { list-style: none; margin: ${spacing.xs}px 0 0; padding: 0; display: flex; flex-direction: column; gap: ${spacing.xs}px; }
.wc-plan-features li { position: relative; padding-left: ${spacing.lg}px; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; color: ${colours.textSecondary}; }
.wc-plan-features li::before { content: ''; position: absolute; left: 2px; top: 6px; width: 8px; height: 4px; border-left: 1.5px solid ${colours.brandPrimary}; border-bottom: 1.5px solid ${colours.brandPrimary}; transform: rotate(-45deg); }

.wc-summary { margin: 0; border-top: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-summary-row { display: grid; grid-template-columns: 160px minmax(0, 1fr) auto; gap: ${spacing.base}px; align-items: baseline; padding: ${spacing.md}px 0; border-bottom: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-summary-row dt { color: ${colours.textSecondary}; font: ${typography.bodySmall.fontSize}px ${text}; }
.wc-summary-row dd { margin: 0; font: ${typography.body.fontSize}px/${typography.body.lineHeight}px ${text}; overflow-wrap: anywhere; }
@media (max-width: 640px) { .wc-summary-row { grid-template-columns: minmax(0, 1fr) auto; } .wc-summary-row dt { grid-column: 1 / -1; } }

.wc-account { display: flex; flex-direction: column; gap: ${spacing.base}px; padding: ${spacing.lg}px; border-radius: ${radii.xl}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; }
.wc-account-signed-in { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: ${spacing.base}px; }
.wc-account-email { font: ${typography.labelLarge.fontSize}px ${medium}; margin: ${spacing.xs}px 0; overflow-wrap: anywhere; }
.wc-auth-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${spacing.sm}px; }
@media (max-width: 520px) { .wc-auth-buttons { grid-template-columns: 1fr; } }
.wc-divider { display: flex; align-items: center; gap: ${spacing.md}px; color: ${colours.textSecondary}; font: ${typography.caption.fontSize}px ${text}; }
.wc-divider::before, .wc-divider::after { content: ''; flex: 1; height: 1px; background: ${colours.borderSubtle}; }
.wc-email-row { display: flex; gap: ${spacing.sm}px; flex-wrap: wrap; }
.wc-email-row .wc-input { flex: 1; min-width: 200px; }
.wc-code { display: flex; flex-direction: column; gap: ${spacing.md}px; }
.wc-code-actions { display: flex; gap: ${spacing.base}px; flex-wrap: wrap; }

.wc-actions { display: flex; align-items: flex-start; justify-content: space-between; gap: ${spacing.base}px; padding-top: ${spacing.sm}px; }
.wc-submit { display: flex; flex-direction: column; align-items: flex-end; gap: ${spacing.sm}px; text-align: right; max-width: 380px; }
@media (max-width: 640px) {
  .wc-actions { position: sticky; bottom: 0; z-index: 2; align-items: center; margin: 0 -${spacing.base}px; padding: ${spacing.md}px ${spacing.base}px calc(${spacing.md}px + env(safe-area-inset-bottom)); background: ${colours.background}; border-top: ${layout.hairline}px solid ${colours.borderSubtle}; }
  .wc-submit { flex: 1; align-items: stretch; text-align: center; }
  .wc-submit .wc-help { font-size: ${typography.caption.fontSize}px; line-height: ${typography.caption.lineHeight}px; }
  .wc-button-large { height: 52px; padding: 0 ${spacing.base}px; }
  .wc-actions > .wc-button-primary { flex: 1; }
}

.wc-button { display: inline-flex; align-items: center; justify-content: center; gap: ${spacing.sm}px; height: 48px; padding: 0 ${spacing.xl}px; border-radius: ${radii.lg}px; border: 0; font: ${typography.button.fontSize}px ${medium}; letter-spacing: ${typography.button.letterSpacing}px; cursor: pointer; text-decoration: none; transition: background 120ms, opacity 120ms; white-space: nowrap; }
.wc-button:disabled { cursor: not-allowed; opacity: 0.45; }
.wc-button:focus-visible, .wc-text-button:focus-visible, .wc-chip:focus-visible { outline: 2px solid ${colours.focusRing}; outline-offset: 2px; }
.wc-button-primary { background: ${colours.brandPrimary}; color: ${colours.textOnBrand}; }
.wc-button-primary:hover:not(:disabled) { background: ${colours.brandPressed}; }
.wc-button-large { height: 56px; padding: 0 ${spacing.xxl}px; }
.wc-button-secondary { background: ${colours.surfaceRaised}; color: ${colours.textPrimary}; }
.wc-button-secondary:hover:not(:disabled) { background: ${colours.borderSubtle}; }
.wc-button-ghost { background: transparent; color: ${colours.textSecondary}; padding: 0 ${spacing.base}px; }
.wc-button-ghost:hover:not(:disabled) { color: ${colours.textPrimary}; }
.wc-text-button { padding: ${spacing.xs}px 0; background: none; border: 0; color: ${colours.accentWarm}; font: ${typography.label.fontSize}px ${medium}; cursor: pointer; }
.wc-text-button:hover:not(:disabled) { text-decoration: underline; }
.wc-text-button:disabled { opacity: 0.5; cursor: default; }

.wc-notice { padding: ${spacing.md}px ${spacing.base}px; border-radius: ${radii.md}px; background: ${colours.surfaceRaised}; border: ${layout.hairline}px solid ${colours.borderSubtle}; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${text}; color: ${colours.textPrimary}; }
.wc-notice-error { border-color: ${colours.error}; }

@media (prefers-reduced-motion: reduce) { .wc-root * { transition: none !important; } }
`;
