import { colours, layout, radii, spacing, typography } from '@/design';

const display = typography.displayLarge.fontFamily;
const medium = typography.label.fontFamily;

export const CREATED_CSS = `
.cr-main { max-width: 1180px; margin: 0 auto; padding: ${spacing.xxxl}px ${spacing.xl}px ${spacing.giant}px; }
.cr-status { display: flex; flex-direction: column; align-items: flex-start; gap: ${spacing.base}px; max-width: 560px; margin: ${spacing.huge}px auto; }
.cr-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${colours.borderSubtle}; border-top-color: ${colours.brandPrimary}; animation: cr-spin 900ms linear infinite; }
@keyframes cr-spin { to { transform: rotate(360deg); } }
.cr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: ${spacing.huge}px; align-items: start; }
.cr-intro { display: flex; flex-direction: column; gap: ${spacing.lg}px; max-width: 640px; min-width: 0; }
.cr-eyebrow { margin: 0; color: ${colours.accentWarm}; font: ${typography.eyebrow.fontSize}px ${medium}; letter-spacing: ${typography.eyebrow.letterSpacing}px; text-transform: uppercase; }
.cr-title { color: ${colours.accentWarm}; }
.cr-h2 { margin: 0; font: ${typography.titleMedium.fontSize}px ${display}; font-weight: normal; }
.cr-card { display: flex; flex-direction: column; gap: ${spacing.base}px; padding: ${spacing.lg}px; border-radius: ${radii.xl}px; background: ${colours.surface}; border: ${layout.hairline}px solid ${colours.borderSubtle}; }
.cr-card-head { display: flex; justify-content: space-between; align-items: flex-start; }
.cr-code { font: 30px ${display}; letter-spacing: 4px; margin-top: ${spacing.xs}px; }
.cr-link-row { display: flex; gap: ${spacing.sm}px; flex-wrap: wrap; }
.cr-link { flex: 1; min-width: 220px; height: 48px; font-size: ${typography.bodySmall.fontSize}px; }
.cr-qr-row { display: flex; gap: ${spacing.base}px; align-items: center; }
.cr-qr, .cr-app-qr > div:first-child { padding: ${spacing.sm}px; border-radius: ${radii.md}px; background: ${colours.brandPrimary}; line-height: 0; }
.cr-app { flex-direction: row; gap: ${spacing.xl}px; align-items: center; }
.cr-app-copy { display: flex; flex-direction: column; gap: ${spacing.md}px; flex: 1; min-width: 0; }
.cr-app-qr { display: flex; flex-direction: column; align-items: center; gap: ${spacing.sm}px; flex: none; }
.cr-steps { margin: 0; padding-left: ${spacing.lg}px; display: flex; flex-direction: column; gap: ${spacing.xs}px; color: ${colours.textPrimary}; font: ${typography.bodySmall.fontSize}px/${typography.bodySmall.lineHeight}px ${typography.body.fontFamily}; }
.cr-steps strong { font-family: ${medium}; font-weight: normal; }
.cr-app-actions { display: flex; align-items: center; gap: ${spacing.lg}px; flex-wrap: wrap; margin-top: ${spacing.xs}px; }
.cr-preview { position: sticky; top: ${spacing.xl}px; display: flex; flex-direction: column; align-items: center; gap: ${spacing.md}px; }
@media (max-width: 960px) {
  .cr-main { padding: ${spacing.xl}px ${spacing.base}px ${spacing.giant}px; }
  .cr-grid { grid-template-columns: minmax(0, 1fr); gap: ${spacing.xl}px; }
  .cr-preview { position: static; order: -1; }
  .cr-preview .wc-phone { width: min(220px, 60vw); }
  .cr-app-qr { display: none; }
}
`;
