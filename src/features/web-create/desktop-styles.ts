import { MOMENTS_SLIDER_GRADIENT, typography } from '@/design';

/**
 * The desktop layout.
 *
 * Shaped like a good web onboarding rather than a phone held up to a monitor:
 * a quiet top row with the logo and a segmented progress bar, one question per
 * page set large and centred with a single line of why beneath it, controls a
 * desk expects (a calendar, pills, the covers side by side), and one Continue
 * pinned at the foot of the window. The homepage's sky sits behind it, and
 * nothing else does.
 *
 * At and below the breakpoint none of this applies and the window is the
 * app's own screen.
 *
 * The sky is deeper than the homepage's, staying in the violets and only
 * warming at the foot, so the app's ivory and grey type
 * stays readable set straight on it with no card in between.
 */
export const DESKTOP_MIN_WIDTH = 961;

/**
 * The one column every step is laid out in on a desktop: question, control and
 * Continue all share its edges, as a good onboarding's do. Fixed, so the page
 * keeps its shape from step to step. Only the packages step is wider.
 */
export const DESKTOP_STEP_WIDTH = 560;

const SKY = 'linear-gradient(180deg, #1d0a40 0%, #2f0f5d 34%, #4a1688 66%, #7a22b8 88%, #b5249f 100%)';
const IVORY = '#F5F2ED';
const INK = '#0B0B0C';
const LINE = 'rgba(245, 242, 237, .22)';
const FILL = 'rgba(11, 6, 26, .42)';
const FILL_HOVER = 'rgba(11, 6, 26, .6)';
const TICK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b0b0c' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6.5 12.5l3.6 3.6 7.4-8'/%3E%3C/svg%3E") center / 14px no-repeat`;

const REGULAR = typography.body.fontFamily;
const MEDIUM = typography.label.fontFamily;
const SEMIBOLD = typography.heading.fontFamily;

export const WEB_CREATE_DESKTOP_CSS = `
@media (min-width: ${DESKTOP_MIN_WIDTH}px) {
  .wc-flow { background: #2f0f5d; }
  .wc-sky { display: block; position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: ${SKY}; }

  /* Logo, progress, account: one quiet row. */
  .wc-flow .wc-topbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; position: relative; z-index: 1; width: 100%; max-width: none; margin: 0; padding: 24px 40px 0; }
  .wc-flow .wc-text-link { justify-self: end; color: ${IVORY}; font-size: 15px; padding: 8px 2px; }
  .wc-flow .wc-text-link:hover { text-decoration: underline; text-underline-offset: 3px; }
  .wc-segments { display: flex; gap: 6px; width: min(440px, 40vw); }
  .wc-segments span { flex: 1; height: 6px; border-radius: 3px; background: rgba(245, 242, 237, .18); transition: background .3s; }
  .wc-segments .wc-segment-on { background: ${IVORY}; }

  /* The step: question, why, control, in a column that scrolls if it must. */
  .wc-stage { display: block; width: 100%; padding: 56px 24px 32px; overflow-y: auto; animation: wc-rise .4s cubic-bezier(.2, .7, .2, 1) both; }
  .wc-stage > * { width: ${DESKTOP_STEP_WIDTH}px; max-width: 100%; margin: 0 auto; }
  @keyframes wc-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .wc-flow-notice { width: min(${DESKTOP_STEP_WIDTH}px, calc(100% - 48px)); margin: 16px auto 0; }

  /* Continue, pinned at the foot of the window. */
  .wc-footbar { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 24px 32px; }
  /* Back and Continue share the column's edges, Continue taking the rest. */
  .wc-foot-row { display: flex; gap: 12px; width: ${DESKTOP_STEP_WIDTH}px; max-width: 100%; }
  .wc-continue { flex: 1; height: 56px; border: 0; border-radius: 999px; background: ${IVORY}; color: ${INK}; font: 17px ${SEMIBOLD}; cursor: pointer; transition: background .15s, opacity .15s; }
  .wc-continue:hover:not(:disabled) { background: #fff; }
  .wc-continue:disabled { opacity: .38; cursor: not-allowed; }
  .wc-foot-back { flex: none; width: 120px; height: 56px; border: 1.5px solid ${LINE}; border-radius: 999px; background: transparent; color: ${IVORY}; font: 16px ${MEDIUM}; cursor: pointer; transition: background .15s, border-color .15s; }
  .wc-foot-back:hover:not(:disabled) { background: rgba(245, 242, 237, .1); border-color: rgba(245, 242, 237, .5); }
  .wc-continue:focus-visible, .wc-foot-back:focus-visible { outline: 2px solid ${IVORY}; outline-offset: 3px; }
  .wc-foot-error, .wc-foot-note { margin: 0; font: 14px ${REGULAR}; text-align: center; }
  .wc-foot-error { color: #ffc4d2; }
  .wc-foot-note { color: rgba(245, 242, 237, .7); }

  /* The photo collage fades its second row into the app's black. Over the sky
     that reads as a band, so here it is a mask instead. */
  .wc-stage #reveal-preview-fade { display: none; }
  .wc-stage [id^='capture-preview-fade'] { display: none; }
  .wc-stage #capture-preview { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 54px); mask-image: linear-gradient(to bottom, transparent 0, #000 54px); }
  .wc-stage #reveal-preview { -webkit-mask-image: linear-gradient(to bottom, #000 62%, transparent 92%); mask-image: linear-gradient(to bottom, #000 62%, transparent 92%); }

  /* ---- Controls the desktop steps share ---- */
  .dk-pill { display: inline-flex; align-items: center; justify-content: center; height: 52px; padding: 0 20px; border-radius: 999px; border: 1.5px solid ${LINE}; background: ${FILL}; color: ${IVORY}; font: 16px ${MEDIUM}; cursor: pointer; transition: background .15s, border-color .15s; }
  .dk-pill:hover { background: ${FILL_HOVER}; border-color: rgba(245, 242, 237, .5); }
  .dk-pill-on, .dk-pill-on:hover { background: ${IVORY}; border-color: ${IVORY}; color: ${INK}; }
  .dk-pill:focus-visible, .dk-day:focus-visible, .dk-cover:focus-visible, .dk-cal-nav:focus-visible, .dk-text-button:focus-visible { outline: 2px solid ${IVORY}; outline-offset: 3px; }
  .dk-text-button { border: 0; background: none; padding: 8px 4px; color: ${IVORY}; font: 15px ${MEDIUM}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

  /* Name: one large field, the suggestions as light pills beneath. */
  .dk-name { display: block; width: 100%; height: 72px; padding: 0 28px; border-radius: 999px; border: 1.5px solid rgba(245, 242, 237, .4); background: rgba(245, 242, 237, .1); color: ${IVORY}; font: 24px ${REGULAR}; text-align: center; transition: border-color .15s, background .15s; }
  .dk-name::placeholder { color: rgba(245, 242, 237, .6); }
  .dk-name:hover { border-color: rgba(245, 242, 237, .65); }
  .dk-name:focus { outline: none; border-color: ${IVORY}; background: rgba(245, 242, 237, .14); }
  .dk-suggestions-title { margin: 28px 0 12px; text-align: center; color: rgba(245, 242, 237, .6); font: 12px ${MEDIUM}; letter-spacing: 1.4px; text-transform: uppercase; }
  .dk-suggestions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .dk-chip { height: 40px; padding: 0 18px; border-radius: 999px; border: 0; background: rgba(245, 242, 237, .14); color: ${IVORY}; font: 15px ${MEDIUM}; cursor: pointer; transition: background .15s; }
  .dk-chip:hover { background: rgba(245, 242, 237, .24); }
  .dk-chip:focus-visible { outline: 2px solid ${IVORY}; outline-offset: 3px; }

  /* When it ends: one month to pick the day, the time beneath, in one panel. */
  .dk-when { padding: 20px 28px 0; border-radius: 28px; background: ${FILL}; border: 1px solid ${LINE}; }
  .dk-month-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .dk-month-label { color: ${IVORY}; font: 16px ${MEDIUM}; }
  .dk-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px 6px; }
  .dk-weekday { text-align: center; padding-bottom: 6px; color: rgba(245, 242, 237, .55); font: 12px ${MEDIUM}; }
  .dk-day { height: 40px; border: 0; border-radius: 999px; background: transparent; color: ${IVORY}; font: 15px ${REGULAR}; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .12s; }
  .dk-day:hover:not(:disabled) { background: rgba(245, 242, 237, .14); }
  .dk-day:disabled { color: rgba(245, 242, 237, .24); cursor: default; }
  .dk-day-on, .dk-day-on:hover:not(:disabled) { background: ${IVORY}; color: ${INK}; font-family: ${SEMIBOLD}; }
  .dk-cal-nav { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: transparent; color: ${IVORY}; cursor: pointer; }
  .dk-cal-nav:hover:not(:disabled) { background: rgba(245, 242, 237, .12); }
  .dk-cal-nav:disabled { opacity: .25; cursor: default; }
  .dk-cal-nav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

  .dk-when-time { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding: 18px 0 20px; border-top: 1px solid ${LINE}; }
  .dk-when-label { color: ${IVORY}; font: 16px ${MEDIUM}; }
  .dk-time-selects { display: flex; align-items: center; gap: 8px; }
  .dk-time-selects select { height: 44px; padding: 0 36px 0 16px; border-radius: 999px; border: 1.5px solid ${LINE}; background: rgba(245, 242, 237, .06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f5f2ed' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right 12px center / 16px no-repeat; color: ${IVORY}; color-scheme: dark; font: 17px ${REGULAR}; font-variant-numeric: tabular-nums; -webkit-appearance: none; appearance: none; cursor: pointer; transition: border-color .15s, background-color .15s; }
  .dk-time-selects select:hover { border-color: rgba(245, 242, 237, .55); background-color: rgba(245, 242, 237, .12); }
  .dk-time-selects select:focus { outline: none; }
  .dk-time-selects select:focus-visible { border-color: ${IVORY}; box-shadow: 0 0 0 2px ${IVORY}; }
  .dk-time-selects option { background: #1d0a40; color: ${IVORY}; }
  .dk-time-colon { color: rgba(245, 242, 237, .6); font: 18px ${REGULAR}; }
  .dk-pill:focus-visible, .dk-day:focus-visible, .dk-cover:focus-visible, .dk-cal-nav:focus-visible { outline: 2px solid ${IVORY}; outline-offset: 3px; }

  /* Photos per guest: the gradient slider, with every stop labelled and
     clickable beneath it. The input is inset so its thumb travels dot to dot. */
  .dk-limit { display: flex; flex-direction: column; align-items: center; -webkit-user-select: none; user-select: none; }
  .dk-limit-number { margin-top: 20px; color: ${IVORY}; font: 56px/1 ${typography.displayLarge.fontFamily}; font-variant-numeric: tabular-nums; }
  .dk-limit-line { margin: 8px 0 0; color: rgba(245, 242, 237, .75); font: 17px ${REGULAR}; }
  .dk-slider { position: relative; width: 100%; height: 56px; margin-top: 28px; border-radius: 28px; background: rgba(245, 242, 237, .1); box-shadow: inset 0 0 0 1px ${LINE}; overflow: hidden; }
  .dk-slider-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, ${MOMENTS_SLIDER_GRADIENT.join(', ')}); transition: width .25s cubic-bezier(.3, .9, .3, 1); }
  .dk-slider-dot { position: absolute; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: rgba(245, 242, 237, .45); pointer-events: none; }
  .dk-slider-dot-on { background: ${IVORY}; }
  .dk-slider input { position: absolute; top: 0; left: calc(7% - 17px); width: calc(86% + 34px); height: 100%; margin: 0; -webkit-appearance: none; appearance: none; background: transparent; cursor: grab; }
  .dk-slider input:active { cursor: grabbing; }
  .dk-slider input:focus { outline: none; }
  .dk-slider:has(input:focus-visible) { outline: 2px solid ${IVORY}; outline-offset: 4px; }
  .dk-slider input::-webkit-slider-runnable-track { height: 100%; background: transparent; }
  .dk-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: 34px; height: 34px; margin-top: 11px; border-radius: 50%; background: ${IVORY}; box-shadow: 0 2px 12px rgba(0, 0, 0, .35); transition: transform .12s; }
  .dk-slider input:hover::-webkit-slider-thumb { transform: scale(1.08); }
  .dk-slider input::-moz-range-track { height: 100%; background: transparent; }
  .dk-slider input::-moz-range-thumb { width: 34px; height: 34px; border: 0; border-radius: 50%; background: ${IVORY}; box-shadow: 0 2px 12px rgba(0, 0, 0, .35); }
  .dk-stops { position: relative; width: 100%; height: 44px; margin-top: 10px; }
  .dk-stop { position: absolute; top: 0; min-width: 44px; height: 36px; padding: 0 10px; transform: translateX(-50%); border: 0; border-radius: 999px; background: transparent; color: rgba(245, 242, 237, .6); font: 16px ${MEDIUM}; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .12s, color .12s; }
  .dk-stop:hover { background: rgba(245, 242, 237, .12); color: ${IVORY}; }
  .dk-stop-on, .dk-stop-on:hover { background: ${IVORY}; color: ${INK}; }

  /* Cover: every style at once, each a live preview. */
  .dk-covers { display: flex; justify-content: space-between; }
  .dk-cover { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 12px 12px 14px; border: 1.5px solid transparent; border-radius: 32px; background: transparent; color: ${IVORY}; cursor: pointer; transition: background .15s, border-color .15s; }
  .dk-cover:hover { background: rgba(245, 242, 237, .06); }
  .dk-cover-on, .dk-cover-on:hover { border-color: ${IVORY}; background: rgba(245, 242, 237, .08); }
  .dk-cover-on::after { content: ''; position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border-radius: 50%; background: ${IVORY} ${TICK}; }
  .dk-cover-frame { pointer-events: none; }
  .dk-cover-name { font: 15px ${MEDIUM}; }
  .dk-cover-actions { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 28px; }

  /* Package. Wider than the other steps: what they get on the left, the
     packages to compare on the right. */
  .wc-stage[data-step='package'] > * { width: min(1040px, 100%); }
  .dk-package { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 56px; align-items: center; margin-top: -8px; }
  .dk-showcase { display: flex; justify-content: center; }
  .dk-prints { position: relative; width: 460px; height: 440px; }
  .dk-print { position: absolute; left: 50%; top: 50%; width: 132px; margin: -88px 0 0 -66px; padding: 6px 6px 22px; border-radius: 4px; background: #f7f3ec; box-shadow: 0 18px 40px rgba(10, 2, 30, .5); opacity: 0; transform: translate(0, 0) rotate(0deg) scale(.7); transition: opacity .45s ease, transform .55s cubic-bezier(.2, .8, .2, 1); }
  .dk-print-on { opacity: 1; transform: translate(var(--x), calc(var(--y) - 110px)) rotate(var(--r)) scale(1); }
  .dk-showcase-phone { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); filter: drop-shadow(0 30px 60px rgba(10, 2, 30, .6)); }

  .dk-plans-side { display: flex; flex-direction: column; gap: 22px; }
  .dk-plan-list { display: flex; flex-direction: column; gap: 10px; }
  .dk-plan { position: relative; display: flex; align-items: center; gap: 16px; width: 100%; padding: 16px 22px 16px 18px; border-radius: 22px; border: 1.5px solid ${LINE}; background: ${FILL}; color: ${IVORY}; text-align: left; cursor: pointer; transition: background .15s, border-color .15s, transform .15s; }
  .dk-plan:hover { background: ${FILL_HOVER}; border-color: rgba(245, 242, 237, .5); }
  .dk-plan:focus-visible { outline: 2px solid ${IVORY}; outline-offset: 3px; }
  .dk-plan-best { border-color: transparent; background: linear-gradient(#2a0d55, #2a0d55) padding-box, linear-gradient(120deg, ${MOMENTS_SLIDER_GRADIENT.join(', ')}) border-box; }
  .dk-plan-best:hover { background: linear-gradient(#33106a, #33106a) padding-box, linear-gradient(120deg, ${MOMENTS_SLIDER_GRADIENT.join(', ')}) border-box; }
  .dk-plan-on, .dk-plan-on:hover { border-color: ${IVORY}; background: rgba(245, 242, 237, .14); }
  .dk-plan-best.dk-plan-on { border-color: transparent; background: linear-gradient(#3d1478, #3d1478) padding-box, linear-gradient(120deg, ${MOMENTS_SLIDER_GRADIENT.join(', ')}) border-box; box-shadow: 0 16px 44px rgba(229, 72, 205, .25); }
  .dk-plan-radio { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(245, 242, 237, .6); }
  .dk-plan-on .dk-plan-radio { border-color: ${IVORY}; background: ${IVORY} ${TICK}; }
  .dk-plan-text { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .dk-plan-name { display: flex; align-items: center; gap: 10px; font: 22px ${typography.displayLarge.fontFamily}; }
  .dk-plan-badge { padding: 3px 9px; border-radius: 999px; background: ${IVORY}; color: ${INK}; font: 11px ${SEMIBOLD}; letter-spacing: .8px; text-transform: uppercase; }
  .dk-plan-sub { color: rgba(245, 242, 237, .7); font: 14px ${REGULAR}; }
  .dk-plan-price { flex: none; font: 24px ${typography.displayLarge.fontFamily}; font-variant-numeric: tabular-nums; }

  .dk-features { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin: 0; padding: 0 4px; list-style: none; animation: wc-rise .3s ease both; }
  .dk-features li { display: flex; align-items: center; gap: 10px; font: 15px ${MEDIUM}; color: ${IVORY}; }
  .dk-feature-off { color: rgba(245, 242, 237, .42) !important; }
  .dk-feature-mark { flex: none; width: 20px; height: 20px; border-radius: 50%; }
  .dk-feature-on .dk-feature-mark { background: linear-gradient(135deg, ${MOMENTS_SLIDER_GRADIENT.join(', ')}) ; -webkit-mask: ${TICK.replace('%230b0b0c', '%23000').replace(' center / 14px no-repeat', '')} center / 16px no-repeat, linear-gradient(#000, #000); -webkit-mask-composite: xor; mask-composite: exclude; }
  .dk-feature-off .dk-feature-mark { position: relative; }
  .dk-feature-off .dk-feature-mark::before, .dk-feature-off .dk-feature-mark::after { content: ''; position: absolute; left: 4px; right: 4px; top: 9px; height: 1.5px; border-radius: 1px; background: rgba(245, 242, 237, .4); transform: rotate(45deg); }
  .dk-feature-off .dk-feature-mark::after { transform: rotate(-45deg); }
  .dk-plan-note { margin: 0; padding: 0 4px; color: rgba(245, 242, 237, .65); font: 14px ${REGULAR}; }

  /* Package, on the app's own list: one row per plan. */
  .wc-plans { gap: 12px; }
  .wc-plan-body { padding: 20px 24px 20px 60px; border-radius: 24px; border: 1.5px solid ${LINE}; background: ${FILL}; }
  .wc-plan-body::before { content: ''; position: absolute; left: 22px; top: 24px; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(245, 242, 237, .6); box-sizing: border-box; }
  .wc-plan:hover .wc-plan-body { background: ${FILL_HOVER}; border-color: rgba(245, 242, 237, .5); }
  .wc-plan input:checked + .wc-plan-body { background: rgba(245, 242, 237, .12); border-color: ${IVORY}; box-shadow: none; }
  .wc-plan input:checked + .wc-plan-body::before { border-color: ${IVORY}; background: ${IVORY} ${TICK}; }
  .wc-plan input:checked + .wc-plan-body::after { display: none; }
  .wc-plan-head { padding-right: 0; }
  .wc-plan-line { color: rgba(245, 242, 237, .72); }

  .wc-account { padding: 28px; border-radius: 24px; background: ${FILL}; border-color: ${LINE}; }
  .wc-account .wc-button-secondary { border-radius: 999px; background: rgba(245, 242, 237, .1); }
  .wc-account .wc-button-secondary:hover:not(:disabled) { background: rgba(245, 242, 237, .18); }
  .wc-account .wc-input { border-radius: 999px; background: rgba(11, 6, 26, .5); padding: 0 20px; }
}
`;
