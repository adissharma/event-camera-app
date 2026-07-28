# Typography

Chosen system and its rationale are in `docs/brand-system.md`. This document
covers licensing, the semantic scale, and the international gap.

## Licence status — verified

| Family | Licence | Verified at | App embedding |
|---|---|---|---|
| Instrument Serif | SIL Open Font License 1.1 | `node_modules/@expo-google-fonts/instrument-serif/LICENSE_FONT` | **Permitted** |
| Instrument Sans | SIL Open Font License 1.1 | `node_modules/@expo-google-fonts/instrument-sans/LICENSE_FONT` | **Permitted** |

OFL 1.1 permits bundling in an application, including a commercial one. The
obligations are: retain the copyright and licence notice, do not sell the fonts
on their own, and do not use the Reserved Font Name for a modified version. All
three are satisfied — the fonts ship inside the app bundle and are never
exposed or redistributed as files.

### On the reference site's typeface

WildBran's identity appears to use bespoke type. It was **not** downloaded,
scraped, traced or approximated. If the founder later supplies licensed font
files, the procedure is:

1. Inspect file names and embedded metadata.
2. Confirm a licence or written permission covering **application embedding**
   specifically — a web-only or desktop-only licence does not cover an app.
3. Record the licence status in this file.
4. Only then place the files in `assets/fonts/` and register them in
   `src/app/_layout.tsx`.
5. Keep the system fallbacks below.

Until that happens the OFL fonts above are the shipping choice.

## Semantic scale

Defined in `src/design/typography.ts`. Components select a role; they never set
a family or size.

| Role | Family | Size / leading | Used for |
|---|---|---|---|
| `displayHero` | Instrument Serif | 46 / 50 | Welcome and success moments. One per screen. |
| `displayLarge` | Instrument Serif | 36 / 41 | Creation-step headings |
| `titleLarge` | Instrument Serif | 28 / 33 | Event names, guest cover title |
| `titleMedium` | Instrument Serif | 22 / 27 | Card titles |
| `eyebrow` | Instrument Sans Medium, uppercase, +1.6 tracking | 11 / 14 | Section markers, step counters, category labels |
| `heading` | Instrument Sans SemiBold | 17 / 23 | Section headings within a screen |
| `bodyLarge` | Instrument Sans Regular | 16 / 25 | Supporting copy under a heading |
| `body` | Instrument Sans Regular | 15 / 22 | Default |
| `bodySmall` | Instrument Sans Regular | 13 / 19 | Dense secondary copy |
| `labelLarge` | Instrument Sans Medium | 15 / 20 | Option-card labels |
| `label` | Instrument Sans Medium | 13 / 18 | Visible field labels |
| `caption` | Instrument Sans Regular | 12 / 16 | Helper and meta text |
| `button` | Instrument Sans Medium | 15 / 20 | Button labels |
| `numeric` | Instrument Sans Medium, tabular | 15 / 20 | Prices, counts, dates |
| `numericLarge` | Instrument Serif, tabular | 34 / 38 | Plan price, remaining-shot counter |

Display leading is deliberately tighter than the size would normally take. A
display serif set loose reads as a document; set tight it reads as a masthead.

The `eyebrow` role is the counterweight to the serif and the main reason the
system reads editorial rather than like the nearest competitor's centred serif
on black. Keep eyebrow strings to about four words — uppercase at this tracking
becomes hard to read beyond that.

`displayHero` sits at 46/50. On the previous light theme the same role was
capped at 40/44 because a heavier, wider face crowded the primary action at that
size; Instrument Serif is narrower and lighter, so it carries the larger size on
a 375pt screen without doing so.

## Dynamic Type

Every role carries a `maxFontSizeMultiplier`. Display roles cap lower (1.4–1.7)
because a 46pt line at 2× becomes an unreadable wall on a phone; body, label and
caption roles are capped at 2.0 so the app stays genuinely usable at the largest
accessibility sizes. `AppText` applies the cap automatically — no screen sets it.

## Numerals

`numeric` and `numericLarge` use `fontVariant: ['tabular-nums']`. Figures are
set in the sans, never in a display italic — italic-serif statistics are a
signature of the nearest competitor and are avoided deliberately. This matters
in two specific places: plan prices in a comparison column must align on the
decimal, and the remaining-shot counter must not shift horizontally as it counts
down from 20 to 9.

## Strings the system must survive

These are the test cases for every typographic surface:

- Long South Asian names — `Priya Ramachandran & Arjun Venkataraman`
- Hyphenated — `Aisha Rahman-Choudhury`
- Same-sex couples — `Sam & Alex`
- Single host — `Maria's 50th`
- Long venue names — `The Honourable Society of the Inner Temple`
- Prices — `£49` `£79` `£149`
- British dates — `Saturday 14 March 2026`
- Largest accessibility text size
- Reduced motion enabled

Component tests covering these live alongside the creation-flow components.

## International coverage — a documented gap

Both families cover Latin and Latin Extended. That serves English and French.

**Neither covers** Devanagari (Hindi), Nastaliq/Arabic (Urdu, Arabic), Gurmukhi
(Punjabi), Bengali or Gujarati. Today those scripts render in the platform
system font via the documented fallback, which is legible but visually
inconsistent with the brand.

The plan, when a language is actually added:

1. Add a script-specific OFL companion (the Noto families cover all five and are
   OFL-licensed).
2. Map it per-locale in `fontFamilies` rather than per-component.
3. Right-to-left support for Urdu and Arabic needs `I18nManager` work and a
   layout audit — this is a phase of its own, not a font swap.

This is a known limitation, listed in the handover.
