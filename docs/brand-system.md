# Brand system

The working name is `Koto`. It is a placeholder. Nothing below depends on it —
see `docs/renaming.md`.

No logo was supplied at the time of writing, so `BrandLogo` renders a clearly
labelled placeholder lockup. A fabricated final logo has deliberately not been
invented. See `assets/brand/README.md`.

---

## Colour: the three directions considered

All three were evaluated against the same criteria: does it complement a logo we
have not seen yet, does it let colourful wedding photography dominate, is it
culturally broad, is it accessible, and does it avoid the clichés listed in the
brief.

### Direction A — "Ink & Ivory" (**chosen**)

Near-black canvas, warm off-white type, ivory primary action, champagne accent
held back for celebratory moments.

| Token | Value |
|---|---|
| background | `#0B0B0C` |
| surface | `#141416` |
| surfaceRaised | `#1C1C1F` |
| surfaceMuted | `#101012` |
| textPrimary | `#F5F2ED` |
| textSecondary | `#A29C94` |
| textOnBrand | `#0B0B0C` |
| brandPrimary | `#EFE9E0` |
| brandPressed | `#D8D2C8` |
| brandSoft | `#1E1E22` |
| accentWarm | `#D9C39A` |
| borderSubtle | `#232326` |
| borderStrong | `#66666E` |
| success | `#7FB08A` |
| warning | `#D9A76A` |
| error | `#E8776D` |
| scrim | `rgba(5,5,6,0.72)` |
| imageScrim | 3-stop ramp to `rgba(11,11,12,0.96)` |

**Emotional character.** Cinematic, quiet, evening. The canvas disappears and
the photography becomes the only lit thing on screen.

**Nothing is pure.** The canvas is `#0B0B0C`, not `#000000`; the type is
`#F5F2ED`, not `#FFFFFF`. Pure black against pure white glares, crushes
photographic shadows and smears on OLED during scroll. A trace of warmth in both
is most of what separates elegant from stark.

**The primary action is ivory, not a colour.** A saturated accent button on
black is the generic dark-SaaS move. Ink on ivory is quieter and reads as
considered.

**Logo compatibility.** A monochrome canvas is the most forgiving ground for an
unseen logo; a light or knocked-out mark will sit naturally.

**Photography.** Warm-flash, low-light event photography is exactly what this
canvas is built for — the image supplies every chroma on screen.

**Cultural neutrality.** Monochrome carries no tradition-specific reading, and
it avoids the black-and-gold luxury cliché because the accent is a restrained
champagne used only at celebratory moments, never as a gilt frame.

**Risks — this is the honest one.**

*A black canvas with an elegant light serif is the nearest competitor's
identity.* The reference audit named this the single largest derivative risk in
the project, and this direction walks straight into it. It was chosen anyway, as
an explicit product decision. The differentiation therefore has to be carried
entirely by execution, and these are binding:

1. **A different serif voice.** Instrument Serif is a transitional with moderate
   contrast, not the high-contrast Didone-adjacent face used by Once.
2. **Ranged left, not centred.** Once centres its serif over the cover. Every
   composition here ranges left off a single margin.
3. **Wide-tracked uppercase sans eyebrows** above statements — an editorial
   voice rather than a poster one. Once has no equivalent element.
4. **Sans tabular figures**, never Once's italic-serif statistics.
5. **Warm off-white, not pure white**, and an ivory action rather than pure
   monochrome.
6. **Different vocabulary** — `celebration` / `reveal`, never `film` /
   `develops`.

If those six erode, the product becomes a copy. They are review criteria, not
suggestions.

### Direction B — "Paper & Evergreen" (previous, now the light theme)

Warm paper canvas `#FAF7F2`, deep evergreen `#1F5148`, near-black type.

Built and verified first, then replaced on the founder's direction. It remains a
complete, contrast-verified palette and is the natural basis for a future light
theme; every component reads semantic tokens, so restoring it is a provider
change rather than a screen change. Full values are in git history.

**Why it lost.** It read warm and editorial but not *cinematic* — and the
product is about an evening, in a dim room, lit by a flash.

### Direction C — "Restrained Contemporary" (rejected)

Cool neutral canvas `#F4F5F3`, graphite text, deep indigo `#2C3E6B` accent.

Clean, accessible, comfortably professional.

**Rejected because** it is emotionally flat for a product about a wedding day.
Cool neutrals plus indigo is the default palette of competent SaaS, and the brief
explicitly rules out a generic SaaS feel.

---

## Typography: the two systems considered

Constraint: the brief excludes Inter, Poppins, Montserrat, Manrope, Playfair
Display and Cormorant Garamond, and rules out an automatic
elegant-serif-plus-geometric-sans pairing chosen without rationale.

### System 1 — Instrument Serif + Instrument Sans (**chosen**)

| | Display | Text / UI |
|---|---|---|
| Family | Instrument Serif | Instrument Sans |
| Classification | Transitional serif, moderate contrast, narrow proportions | Neo-grotesque (**not** geometric) |
| Weights used | 400 regular + italic (all it ships) | 400 / 500 / 600 / 700 |
| Licence | SIL OFL 1.1 — verified in `node_modules/@expo-google-fonts/instrument-serif/LICENSE_FONT` | SIL OFL 1.1 — verified in `.../instrument-sans/LICENSE_FONT` |
| Embedding | Permitted. OFL explicitly allows bundling in an application. | Permitted. |

**Role split.** Instrument Serif carries identity at display sizes and on event
names — the places the product should feel designed rather than assembled.
Instrument Sans carries everything functional: labels, body, buttons, numbers.
The display face is never used for small labels or long body copy.

**Why a single weight is correct here.** Instrument Serif ships only in regular.
On a near-black canvas that is an advantage rather than a limitation: white type
optically gains weight against black (halation), so a bold serif reads blunt
where a regular reads sharp. The scale gets its hierarchy from size and from the
uppercase `eyebrow` role, not from weight.

**Why this is not the cliché pairing.** The excluded pattern is a high-contrast
Didone-style serif plus a geometric sans. Instrument Serif is a transitional
with moderate contrast, and Instrument Sans is a neo-grotesque with open
apertures, not a geometric. More to the point, they are siblings from one
superfamily — shared skeleton and rhythm is the rationale for pairing them,
rather than the reflexive elegant-serif-plus-any-sans habit.

**Mobile readability.** Instrument Sans holds up at 13–17pt on both platforms;
its open apertures and tall x-height are what make 13pt captions legible in a
dim venue. The serif is never used below 22pt.

**Names, dates and prices.** Instrument Serif has a fine ampersand, which matters
for "Priya & Arjun". Instrument Sans provides tabular figures, applied via the
`numeric` role so `£49` / `£79` / `£149` align in a column and a counter does not
jitter as it counts down.

**International coverage.** Both cover Latin Extended, which serves the target
market and French. Neither covers Devanagari, Arabic, Gurmukhi, Bengali or
Gujarati — those scripts fall back to the platform system font today. This is a
documented gap, not an oversight; see `docs/typography.md` for the plan.

**Android rendering.** Static instances are bundled rather than variable fonts,
avoiding variable-font rendering inconsistencies on older Android.

### System 2 — Fraunces + Instrument Sans (previous, rejected on this canvas)

Fraunces is a soft, low-contrast old-style with `SOFT` and `WONK` axes. It was
the chosen display face for the light "Paper & Evergreen" theme, where its
warmth was the whole point.

**Rejected on a black canvas** because the qualities that made it right on warm
paper — soft terminals, low stroke contrast, a slight deliberate wonkiness —
read as *soft* rather than *elegant* when reversed out to white on near-black.
Reversed type needs crisper stroke modulation to hold its shape. Instrument
Serif's sharper terminals and higher contrast survive the reversal; Fraunces
blurred.

Retained in git history alongside the light theme.

---

## What premium comes from here

Not from gradients, glass, glows or gold. From: a warm ground that flatters
photography, one confident display face used sparingly, generous spacing, real
tabular numbers, honest states, and motion that explains rather than decorates.
