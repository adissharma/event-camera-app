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

### Direction A — "Paper & Evergreen" (**chosen**)

Warm paper canvas, deep evergreen brand, one warm accent reserved for
celebration moments.

| Token | Value |
|---|---|
| background | `#FAF7F2` |
| surface | `#FFFFFF` |
| surfaceRaised | `#FFFFFF` (separated by shadow, not fill) |
| surfaceMuted | `#F1ECE3` |
| textPrimary | `#1B1A17` |
| textSecondary | `#6A635A` |
| textOnBrand | `#F7FBF8` |
| brandPrimary | `#1F5148` |
| brandPressed | `#163A34` |
| brandSoft | `#E3EDE9` |
| accentWarm | `#B4712C` |
| borderSubtle | `#E6DFD4` |
| borderStrong | `#8F8474` |
| success | `#256B4E` |
| warning | `#8A5512` |
| error | `#B3261E` |
| scrim | `rgba(27,26,23,0.48)` |
| overlayLight | `rgba(250,247,242,0.82)` |
| overlayDark | `rgba(20,19,17,0.55)` |

**Emotional character.** Considered, warm, quietly premium. Reads like good
stationery rather than like software.

**Logo compatibility.** A warm neutral canvas with a low-chroma deep accent is
the most forgiving possible ground for an unseen logo. Near-black type means a
monochrome logo sits naturally; the evergreen is desaturated enough not to fight
a coloured mark.

**Photography.** The canvas is warm and low-chroma, so saturated wedding
imagery — reds, golds, greens, floral colour — advances against it rather than
competing. This is the single biggest reason for the choice.

**Cultural neutrality.** Green carries positive associations across several of
the target communities and negative ones in none of them. Critically, it is not
the black-and-gold "luxury wedding" cliché, and it is not tied to any one
tradition.

**Risks.** Two, both mitigated:

1. *Brand green and success green are adjacent.* Mitigated by the binding rule
   that state is never communicated by colour alone — success always carries a
   tick and a label. Verified in `docs/colour-accessibility.md`.
2. *Warm paper could drift toward beige-on-beige.* Mitigated by using
   near-black text (16.28:1) rather than a mid-brown, and by keeping
   `surfaceMuted` only 1.5 steps from the canvas so it reads as a well, not as a
   second beige.

### Direction B — "Deep Cinematic" (rejected)

Near-black canvas `#131211`, warm off-white type, single amber accent.

Photography would have looked spectacular, and low-light venue use is genuinely
better on a dark ground.

**Rejected because** it lands almost exactly on Once's identity — a near-black
canvas with light editorial type is the thing the reference audit flags as the
highest derivative risk in the project. A second-mover in the same category
should not adopt the market leader's polarity. Kept on file as a strong
candidate for a future dark mode, which the token structure already supports.

### Direction C — "Restrained Contemporary" (rejected)

Cool neutral canvas `#F4F5F3`, graphite text, deep indigo `#2C3E6B` accent.

Clean, accessible, and comfortably professional.

**Rejected because** it is emotionally flat for a product about a wedding day.
Cool neutrals plus indigo is the default palette of competent SaaS, and the
brief explicitly rules out a generic SaaS feel. It read as trustworthy but not
as something a couple would want touching their wedding.

---

## Typography: the two systems considered

Constraint: the brief excludes Inter, Poppins, Montserrat, Manrope, Playfair
Display and Cormorant Garamond, and rules out an automatic
elegant-serif-plus-geometric-sans pairing chosen without rationale.

### System 1 — Fraunces + Instrument Sans (**chosen**)

| | Display | Text / UI |
|---|---|---|
| Family | Fraunces | Instrument Sans |
| Classification | Soft, low-contrast old-style with `SOFT` and `WONK` axes | Neo-grotesque (**not** geometric) |
| Weights used | 400 / 500 / 600 / 700 | 400 / 500 / 600 / 700 |
| Licence | SIL OFL 1.1 — verified in `node_modules/@expo-google-fonts/fraunces/LICENSE_FONT` | SIL OFL 1.1 — verified in `.../instrument-sans/LICENSE_FONT` |
| Embedding | Permitted. OFL explicitly allows bundling in an application. | Permitted. |

**Role split.** Fraunces carries identity at display sizes and on event names —
the places the product should feel like it was designed rather than assembled.
Instrument Sans carries everything functional: labels, body, buttons, numbers.
The display face is never used for small labels or long body copy.

**Why this is not the cliché pairing.** The excluded pattern is a high-contrast
Didone-style serif plus a geometric sans. Fraunces is the opposite kind of
serif — low contrast, soft terminals, deliberately slightly wonky — and
Instrument Sans is a neo-grotesque with open apertures, not a geometric. The
pairing was chosen for a specific reason: it captures WildBran's typographic
confidence and warmth while landing nowhere near Once's high-contrast serif.

**Mobile readability.** Instrument Sans holds up at 13–17pt on both platforms;
its open apertures and tall x-height are what make 13pt captions legible in a
dim venue.

**Names, dates and prices.** Fraunces has a genuinely good ampersand, which
matters for "Priya & Arjun". Instrument Sans provides tabular figures, applied
via the `numeric` and `numericLarge` roles so `£49` / `£79` / `£149` align in a
column and a counter does not jitter as it counts down.

**International coverage.** Both cover Latin Extended, which serves the target
market and French. Neither covers Devanagari, Arabic, Gurmukhi, Bengali or
Gujarati — those scripts fall back to the platform system font today. This is a
documented gap, not an oversight; see `docs/typography.md` for the plan.

**Android rendering.** Both are well-hinted variable fonts; the static instances
are bundled to avoid variable-font rendering inconsistencies on older Android.

### System 2 — Bricolage Grotesque + Public Sans (rejected)

Bricolage Grotesque is expressive and confident, and would have been the more
literal read of WildBran's personality.

**Rejected because** its personality is loud in a way that fights the product's
job. This app sits inside someone's wedding, and the type should not be the
most characterful thing on the screen — the photographs should. Fraunces gets
warmth and distinctiveness without competing with the imagery.

---

## What premium comes from here

Not from gradients, glass, glows or gold. From: a warm ground that flatters
photography, one confident display face used sparingly, generous spacing, real
tabular numbers, honest states, and motion that explains rather than decorates.
