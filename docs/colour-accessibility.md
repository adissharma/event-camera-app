# Colour accessibility

Palette: "Ink & Ivory" (near-black canvas). Every ratio below was **computed**,
not estimated, using the WCAG 2.1 relative luminance formula.

Reproduce with `npm run check:contrast` — it exits non-zero on any regression,
so a palette change cannot silently break accessibility.

## Measured ratios

| Foreground | Background | Ratio | Grade |
|---|---|---:|---|
| textPrimary `#F5F2ED` | background `#0B0B0C` | 17.62:1 | AAA |
| textPrimary | surface `#141416` | 16.48:1 | AAA |
| textPrimary | surfaceRaised `#1C1C1F` | 15.22:1 | AAA |
| textPrimary | surfaceMuted `#101012` | 17.02:1 | AAA |
| textPrimary | brandSoft `#1E1E22` | 14.88:1 | AAA |
| textSecondary `#A29C94` | background | 7.23:1 | AAA |
| textSecondary | surface | 6.76:1 | AA |
| textSecondary | surfaceRaised | 6.25:1 | AA |
| textOnBrand `#0B0B0C` | brandPrimary `#EFE9E0` | 16.30:1 | AAA |
| textOnBrand | brandPressed `#D8D2C8` | 13.09:1 | AAA |
| brandPrimary | background | 16.30:1 | AAA |
| brandPrimary | surface | 15.25:1 | AAA |
| brandPrimary | brandSoft | 13.77:1 | AAA |
| error `#E8776D` | background | 6.83:1 | AA |
| success `#7FB08A` | background | 7.94:1 | AAA |
| warning `#D9A76A` | background | 9.07:1 | AAA |
| accentWarm `#D9C39A` | background | 11.45:1 | AAA |
| borderStrong `#66666E` | background | 3.46:1 | Passes 1.4.11 non-text |

All 18 requirements pass.

## Findings and what changed

**`borderStrong` failed on first measurement — again.** The initial dark-theme
candidate `#4A4A50` measured 2.24:1, below the 3:1 that WCAG 1.4.11 requires for
the visual boundary of a user-interface component. It was lightened to `#66666E`
(3.46:1) before any component consumed it. This is the same failure mode the
light theme had, and it is why the check is a script rather than a habit.

**Dark themes make the secondary-text trap easy to fall into.** `textSecondary`
was set at `#A29C94` (7.23:1) rather than the more fashionable mid-grey around
`#6E6E77`, which would have measured roughly 3.5:1 and failed body text. Low
contrast reads as sophisticated in a mockup and as unreadable in a dim venue by
someone in their seventies — which is a real and common guest.

**`accentWarm` is no longer contrast-limited.** On the light theme the champagne
measured 3.68:1 and was restricted to large formats. On near-black it measures
11.45:1 and is technically safe at body size. The restriction to celebratory
moments is retained anyway, but it is now an editorial rule, not a technical one.

**Decorative vs. structural borders are separate tokens.** `borderSubtle`
(`#232326`) is intentionally far below 3:1 and is used only for decorative
hairlines on flat surfaces, which 1.4.11 does not cover. Anything bounding a
control uses `borderStrong`. A structural rule drawn over a scrimmed photograph
also uses `borderStrong` — `borderSubtle` disappears entirely against imagery,
which was caught on the welcome screen.

## Colour is never the only signal

| State | Colour | Non-colour signal |
|---|---|---|
| Selected | `brandSoft` fill + `brandPrimary` border | Tick glyph, border weight 1→2, `accessibilityState.selected` |
| Error | `error` text | Alert icon, message text, focus moves to the field |
| Success | `success` text | Tick icon, explicit label |
| Locked / paid | reduced opacity | Lock glyph, "Included in Signature" label |
| Disabled | 45% opacity | `accessibilityState.disabled` + visible reason text |

## Dark-canvas specifics

- **Nothing is pure.** `#0B0B0C` rather than `#000000`, `#F5F2ED` rather than
  `#FFFFFF`. Pure black beside pure white glares, crushes photographic shadows,
  and smears on OLED during scroll.
- **Halation.** White type on black optically gains weight. The display face is
  used at regular weight only; a bold serif reversed out reads blunt and closes
  up its counters.
- **Elevation is fill, not shadow.** A drop shadow is invisible against
  near-black, so raised surfaces step up in lightness instead.
- **Text over photography** uses the three-stop `imageScrim`. A two-stop linear
  fade leaves a visible band across the middle of an image; the ramp is weighted
  toward the bottom so the subject stays clear and the type stays legible.

## Still to verify

- Contrast of text over host-uploaded cover photography needs a runtime
  luminance check — the scrim is the mechanism, but the guarantee is not yet
  enforced. Tracked for the cover editor in Phase 5.
- Real-device checks in a dim venue and in bright daylight, where a dark theme is
  hardest to read (Phase 8 QA).
- OLED smear during fast scroll on a real device — cannot be assessed in a
  browser or simulator.

## Light theme

"Paper & Evergreen" was built and fully contrast-verified before the switch to
dark, and its values remain in git history. Components read only semantic
tokens, so reinstating it as a user-selectable light theme is a provider change
rather than a screen change.
