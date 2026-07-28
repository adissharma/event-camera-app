#!/usr/bin/env node
/**
 * Verifies every documented colour pair still meets its required contrast.
 *
 * Run with `npm run check:contrast`. Exits non-zero on any regression, so a
 * palette change cannot silently break accessibility.
 */

const PALETTE = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F1ECE3',
  textPrimary: '#1B1A17',
  textSecondary: '#6A635A',
  textOnBrand: '#F7FBF8',
  brandPrimary: '#1F5148',
  brandPressed: '#163A34',
  brandSoft: '#E3EDE9',
  accentWarm: '#B4712C',
  borderStrong: '#8F8474',
  success: '#256B4E',
  warning: '#8A5512',
  error: '#B3261E',
};

/** [foreground, background, minimum ratio, why]. */
const REQUIREMENTS = [
  ['textPrimary', 'background', 7, 'body text AAA'],
  ['textPrimary', 'surface', 7, 'body text AAA'],
  ['textPrimary', 'surfaceMuted', 7, 'body text AAA'],
  ['textPrimary', 'brandSoft', 7, 'text on selected option card'],
  ['textSecondary', 'background', 4.5, 'supporting copy AA'],
  ['textSecondary', 'surface', 4.5, 'supporting copy AA'],
  ['textSecondary', 'surfaceMuted', 4.5, 'supporting copy AA'],
  ['textOnBrand', 'brandPrimary', 4.5, 'primary button label'],
  ['textOnBrand', 'brandPressed', 4.5, 'pressed button label'],
  ['brandPrimary', 'background', 4.5, 'quiet button label'],
  ['brandPrimary', 'surface', 4.5, 'quiet button label on card'],
  ['brandPrimary', 'brandSoft', 4.5, 'selected state text'],
  ['error', 'background', 4.5, 'validation message'],
  ['success', 'background', 4.5, 'confirmation message'],
  ['warning', 'background', 4.5, 'warning message'],
  // 1.4.11: non-text contrast for the visual boundary of a control.
  ['borderStrong', 'background', 3, 'control boundary (WCAG 1.4.11)'],
  // Large text / UI shapes only — never body-size text.
  ['accentWarm', 'background', 3, 'celebratory accent, large formats only'],
];

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linearise = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failures = 0;

for (const [fg, bg, min, why] of REQUIREMENTS) {
  const ratio = contrast(PALETTE[fg], PALETTE[bg]);
  const ok = ratio >= min;
  if (!ok) failures += 1;
  const status = ok ? 'pass' : 'FAIL';
  console.log(
    `${status}  ${`${fg} on ${bg}`.padEnd(36)} ${ratio.toFixed(2).padStart(6)}:1  (min ${min}) — ${why}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} contrast requirement(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${REQUIREMENTS.length} contrast requirements pass.`);
