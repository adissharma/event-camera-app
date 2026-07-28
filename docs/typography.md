# Typography

Chosen system and its rationale are in `docs/brand-system.md`. This document
covers licensing, the semantic scale, and the international gap.

## Licence status — verified

| Family | Licence | Verified at | App embedding |
|---|---|---|---|
| Fraunces | SIL Open Font License 1.1 | `node_modules/@expo-google-fonts/fraunces/LICENSE_FONT` | **Permitted** |
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
| `displayHero` | Fraunces SemiBold | 40 / 44 | Welcome and success moments. One per screen. |
| `displayLarge` | Fraunces SemiBold | 32 / 38 | Creation-step headings |
| `titleLarge` | Fraunces Medium | 26 / 32 | Event names, guest cover title |
| `titleMedium` | Fraunces Medium | 21 / 27 | Card titles |
| `heading` | Instrument SemiBold | 17 / 23 | Section headings within a screen |
| `bodyLarge` | Instrument Regular | 17 / 25 | Supporting copy under a heading |
| `body` | Instrument Regular | 15 / 22 | Default |
| `bodySmall` | Instrument Regular | 13 / 19 | Dense secondary copy |
| `labelLarge` | Instrument Medium | 15 / 20 | Option-card labels |
| `label` | Instrument Medium | 13 / 18 | Visible field labels |
| `caption` | Instrument Regular | 12 / 16 | Helper and meta text |
| `button` | Instrument SemiBold | 16 / 20 | Button labels |
| `numeric` | Instrument Medium, tabular | 15 / 20 | Prices, counts, dates |
| `numericLarge` | Fraunces Medium, tabular | 30 / 36 | Plan price, remaining-shot counter |

`displayHero` was reduced from 44/48 to 40/44 after measuring a five-word
statement on a 375pt screen — at 44pt it crowded the primary action.

## Dynamic Type

Every role carries a `maxFontSizeMultiplier`. Display roles cap lower (1.4–1.7)
because a 40pt line at 2× becomes an unreadable wall on a phone; body, label and
caption roles are capped at 2.0 so the app stays genuinely usable at the largest
accessibility sizes. `AppText` applies the cap automatically — no screen sets it.

## Numerals

`numeric` and `numericLarge` use `fontVariant: ['tabular-nums']`. This matters
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
