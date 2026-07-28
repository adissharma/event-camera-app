# Reference audit

Audited live in a real browser on 28 July 2026, before any design decisions were fixed.
Non-essential cookies were declined on every site.

The purpose of this document is to state **explicitly** what is being borrowed as a
principle and what is deliberately *not* being borrowed, so the product does not drift
into becoming derivative of any reference.

Nothing in this project copies source code, assets, layouts, proprietary typefaces,
wording, illustrations or identity from any reference.

---

## 1. WildBran — <https://www.wildbran.pt/>

A Portuguese snack brand. Landing experience is a near-empty warm canvas with a
photographic giraffe and a bold lowercase wordmark whose `d` ascender is replaced by the
animal's neck.

### Observed characteristics

| Aspect | Observation |
|---|---|
| Typography | Bespoke bold lowercase display with soft, slightly wonky terminals. Reads confident and friendly, never childish. Sentence case throughout. |
| Colour | Single warm paper canvas (approx. `#F8F5F0`) with near-black ink. Colour comes almost entirely from photography. |
| Photography | Cut-out subjects on the flat canvas, no containing card, no drop shadow, generous scale. |
| Spacing | Extreme negative space. The hero is ~80% empty. Composition is centred and calm. |
| Motion | Restrained. Subject holds still; content reveals on scroll. |
| Shape language | Almost none — no cards, no pills, no borders in the hero. Structure comes from alignment. |
| Tone | Warm, self-assured, playful in small doses ("Live the Wild Way"). Copy is short and conversational. |

### Borrowed as principle

- **Typography as the primary brand asset**, not decoration.
- Confident negative space — let one element own the screen.
- Short, direct, conversational sentence-case copy.
- Warm paper canvas rather than clinical white or fashionable off-black.
- Playful detail used *sparingly*, anchored by strict structure.

### Deliberately not borrowed

- The bespoke wordmark and any imitation of it. The typeface appears proprietary; it is
  **not** downloaded, scraped, traced or approximated. See `docs/typography.md` for the
  licensed alternative and its rationale.
- The animal motif and cut-out mascot device.
- The near-empty hero. A hero that is 80% empty is affordable for a brand splash page and
  hostile in a mobile form flow where the user needs to make a decision per screen.

### Risk of becoming derivative

**Low.** The borrowed items are generic craft principles. The specific memorable device
(animal-in-wordmark) is untouched.

---

## 2. MindMarket — <https://mindmarket.com/>

A market-research firm. Bold colour-blocked scroll narrative.

### Observed characteristics

| Aspect | Observation |
|---|---|
| Typography | Very large neo-grotesque display, tight leading, near-black on saturated colour. Statements, not paragraphs. |
| Colour | Full-bleed saturated green hero (approx. `#93CE72`) against a warm off-white (approx. `#F2EFE6`). Colour blocking defines chapters. |
| Motion | **The key finding.** The green hero block does not simply scroll away — it *morphs* into a green hill shape on the cream canvas below. One continuous motif carries the eye between sections. |
| Human accents | Hand-drawn clouds, dots and squiggles in white/yellow/red/blue. Deliberately imperfect, used as punctuation, never as background texture. |
| Composition | Floating rounded-rect nav and CTA cards over full-bleed colour. Overlapping layers. |
| Tone | Alive, human, optimistic. |

### Borrowed as principle

- **A single connecting motif that transforms across steps** rather than isolated screens.
  In the app this becomes a continuous progress thread through event creation — the same
  element persists and changes state, it never disappears and reappear.
- Staggered, brief reveals for related items (e.g. package entitlements unlocking).
- Human warmth from restrained hand-made accents rather than generic AI decoration.
- Bold typographic statements as section openers.
- Transition *continuity* between cover editing and guest preview — the cover morphs into
  the phone frame rather than cross-fading.

### Deliberately not borrowed

- Scroll-driven pinning and shape-morphing at web scale. Reproducing a complex scroll
  website inside a mobile form is a usability failure. Mobile usability takes precedence.
- The saturated green palette and the specific doodle vocabulary.
- Floating overlapping nav cards — they cost tap-target clarity on a phone.

A separate, original scroll narrative for the future marketing site is specified in
`docs/marketing-motion-spec.md`. It is not built in this phase.

### Risk of becoming derivative

**Low for the app, medium for the future marketing site.** The mitigation is that the
motif borrowed is structural ("one element carries continuity"), not visual — our motif is
a thread/line tied to progress, not a morphing hill.

---

## 3. Once — <https://once.film/>

The closest direct category competitor: private QR-joined event photo sharing with a
delayed reveal.

### Observed characteristics

| Aspect | Observation |
|---|---|
| Typography | High-contrast transitional/Didone-adjacent serif in white, at very large display sizes. Italic serif for statistics. |
| Colour | Near-black canvas (`#0A0A0A`-ish) with white text. Photography supplies all colour. |
| Photography | Large, candid, warm-flash, low-light party imagery. Faces and motion, not styled stock. |
| Product framing | Emotional promise first ("Capture your day through everyone's eyes"), mechanics second. |
| Device previews | Two angled iPhone frames showing the actual guest cover and gallery, with live-looking stats (Moments / Left / People). |
| Social proof | Real App Store review text with usernames and dates, plus 4.9 / 1,000+ ratings / 1M+ memories / 50K+ events. |
| Copy | Short, emotionally confident. Nostalgic film vocabulary ("film", "develops", "film roll"). |
| Structure | Hero → social proof → use cases → 3-step how-it-works → FAQ → CTA. |

### Borrowed as transferable product principle

- Photography is the central visual asset; chrome recedes.
- **Show the host what the guest will experience.** Device previews make configuration
  tangible — this becomes the live cover editor and the full guest preview.
- Explain value in short copy, not dense feature lists.
- Nostalgic camera cues (a shutter, a frame counter, a "developing" state) are legitimate
  *product* concepts and are used without making the interface retro or kitsch.
- Delayed reveal, shot limits and no-download guest join are category expectations, not
  Once's inventions — the product implements them on its own terms.

### Deliberately not borrowed

- **The black-and-serif identity.** This is the single largest derivative risk in the
  project. Our system uses a warm paper canvas with a garnet accent and a soft old-style
  display face — the opposite end of the serif spectrum from a high-contrast Didone on
  black.
- Their wording, including "film", "film roll", "develops as a film", "Life happens Once".
  Our vocabulary is `celebration` / `event session` / `reveal`.
- Their information architecture, layout, phone screens and photography.
- Their italic-serif statistic treatment.
- **Their social proof.** No rating, count or testimonial is reproduced or imitated. The
  app displays *only* real social proof; until real proof exists, that surface is absent
  rather than fabricated.

### Risk of becoming derivative

**High if unmanaged** — same category, same core mechanics, and their design is genuinely
good. Mitigations, all binding on this build:

1. Different canvas polarity (warm light, not black).
2. Different type voice (soft low-contrast old-style + neo-grotesque, not high-contrast
   Didone alone).
3. Different vocabulary (`celebration`/`reveal`, never `film`/`develops` as brand terms).
4. No fabricated social proof.
5. Guest cover composition must not reproduce their centred-serif-over-cake layout.

---

## Summary: what transfers into the design system

| From | Principle | Where it lands |
|---|---|---|
| WildBran | Typography as primary brand asset | `docs/typography.md` — display face carries identity |
| WildBran | Warm paper canvas, colour from photography | `docs/brand-system.md` — canvas `#FAF7F2` |
| WildBran | Confident negative space, short sentence-case copy | `docs/form-patterns.md` — one decision per screen |
| MindMarket | One connecting motif across steps | Progress thread in the creation flow |
| MindMarket | Staggered brief reveals | `docs/motion-system.md` — entitlement unlock |
| MindMarket | Restrained human accents | Sparse hand-drawn marks, never background texture |
| Once | Photography-led, chrome recedes | `docs/visual-assets.md` |
| Once | Show the host the guest experience | Live cover editor + full guest preview |
| Once | Short emotionally confident copy | `src/i18n` copy deck |

## What is explicitly rejected

- Any proprietary typeface from any reference.
- Once's black-and-serif identity, vocabulary, IA and phone screens.
- MindMarket's saturated green and doodle vocabulary; web-scale scroll pinning in app forms.
- WildBran's mascot device and 80%-empty hero.
- Fabricated ratings, customer numbers or usage statistics of any kind.
