# Colour accessibility

Every ratio below was **computed**, not estimated, using the WCAG 2.1 relative
luminance formula. Reproduce with `npm run check:contrast`.

## Measured ratios

| Foreground | Background | Ratio | Grade |
|---|---|---:|---|
| textPrimary `#1B1A17` | background `#FAF7F2` | 16.28:1 | AAA |
| textPrimary | surface `#FFFFFF` | 17.40:1 | AAA |
| textPrimary | surfaceMuted `#F1ECE3` | 14.79:1 | AAA |
| textPrimary | brandSoft `#E3EDE9` | 14.55:1 | AAA |
| textSecondary `#6A635A` | background | 5.54:1 | AA |
| textSecondary | surface | 5.92:1 | AA |
| textSecondary | surfaceMuted | 5.03:1 | AA |
| textOnBrand `#F7FBF8` | brandPrimary `#1F5148` | 8.63:1 | AAA |
| textOnBrand | brandPressed `#163A34` | 11.91:1 | AAA |
| brandPrimary | background | 8.44:1 | AAA |
| brandPrimary | surface | 9.02:1 | AAA |
| brandPrimary | brandSoft | 7.54:1 | AAA |
| error `#B3261E` | background | 6.12:1 | AA |
| success `#256B4E` | background | 5.97:1 | AA |
| warning `#8A5512` | background | 5.80:1 | AA |
| accentWarm `#B4712C` | background | 3.68:1 | **Large text / UI only** |
| borderStrong `#8F8474` | background | 3.44:1 | Passes 1.4.11 non-text |

## Findings and what changed

**`borderStrong` originally failed.** The first candidate, `#CABEAE`, measured
1.71:1 against the canvas. WCAG 1.4.11 requires 3:1 for the visual boundary of a
user-interface component, so every input outline and option-card border in the
app would have been non-conformant. It was darkened to `#8F8474` (3.44:1) before
any component consumed it.

**`accentWarm` is capped by contrast.** At 3.68:1 it is valid for large text
(≥24pt, or ≥18.66pt bold) and for non-text UI shapes, and invalid for body-size
text. This is enforced by convention and documented on the token itself — it is
reserved for celebratory moments (publication success, reveal unlock), which are
always large-format.

**Decorative vs. structural borders are separate tokens.** `borderSubtle`
(`#E6DFD4`, 1.28:1) is intentionally below 3:1 and is only used for decorative
hairlines and dividers, which 1.4.11 does not cover. Anything that bounds a
control uses `borderStrong`.

## Colour is never the only signal

Binding rule, enforced in review:

| State | Colour | Non-colour signal |
|---|---|---|
| Selected | `brandSoft` fill + `brandPrimary` border | Tick glyph, border weight 1→2, `accessibilityState.selected` |
| Error | `error` text | Alert icon, message text, focus moves to the field |
| Success | `success` text | Tick icon, explicit label |
| Locked / paid | reduced opacity | Lock glyph, "Included in Signature" label |
| Disabled | 45% opacity | `accessibilityState.disabled` + visible reason text |

The reason this matters here specifically: `brandPrimary` and `success` are both
greens. A user with a green colour-vision deficiency cannot distinguish "this is
the brand" from "this succeeded" by hue. The tick glyph and the label are what
carry the meaning; the colour is reinforcement only.

## Dark mode

Not required for the MVP. The token module is a flat semantic map with no raw
hex values in any component, so a second palette can be introduced behind a
provider without touching a screen. Direction B ("Deep Cinematic") in
`docs/brand-system.md` is the intended starting point.

## Still to verify

- Contrast of text drawn over host-uploaded cover photography. The overlay
  tokens (`overlayDark` at 0.55, `overlayLight` at 0.82) are the mechanism, but
  the guarantee needs a luminance check against the actual image at runtime —
  tracked for the cover editor in Phase 5.
- Real-device checks in bright daylight and a dim venue (Phase 8 QA).
