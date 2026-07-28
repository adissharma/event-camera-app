# Marketing site — motion specification

**Not built in this phase.** This is the specification for a future marketing
site, kept here so the app and the site share one motion language.

Inspired by MindMarket's *structural* idea — one motif carrying continuity
across sections — not by its visuals. Its saturated green, its hand-drawn
vocabulary and its specific hill morph are **not** reproduced. See
`docs/reference-audit.md`.

## The connecting motif

A single continuous **thread** drawn as a thin evergreen line, entering at the
top of the hero and running the full length of the page.

It is the same motif as the creation flow's progress thread, which is the point:
the site and the product feel like one thing.

At each chapter the thread does something meaningful rather than decorative:

| Chapter | What the thread does |
|---|---|
| Hero | Descends from the top edge |
| How it works | Loops into the outline of a QR frame |
| The reveal | Straightens and becomes a timeline with the delay marked |
| Gallery | Fans into a loose grid holding the photographs |
| Pricing | Collapses back to a single line linking the tiers |
| Footer | Exits the bottom edge |

## Chapters

Full-width visual chapters, each one idea. Large candid photography carries the
emotion; type carries the promise.

1. **Hero** — one statement, one action, one photograph.
2. **How it works** — three steps, revealed as the thread passes each.
3. **The reveal** — the delayed-gallery idea, the strongest differentiator.
4. **Real events** — photography at scale. Real social proof only, or nothing.
5. **Use cases** — beyond weddings, without implying every celebration is alike.
6. **Pricing** — plain, no dark patterns.
7. **Close** — restate and act.

## Motion rules

- **Restrained parallax.** Foreground and background differ by no more than ~8%
  of scroll distance.
- **Pinning only where it earns it** — the reveal chapter, where the timeline
  genuinely needs to advance in place. Nowhere else.
- **Staggered text reveals** at 45ms between lines, capped at 6 items.
- **Device mock-ups progress with scroll** — the phone shows the cover, then the
  camera, then the developing state, then the gallery, matching the real product.
- **Nothing depends on animation for comprehension.** With every animation
  removed the page must still read top to bottom and every CTA must work.

## Reduced motion

`prefers-reduced-motion: reduce` must:

- disable pinning and parallax entirely;
- replace movement with a 120ms fade;
- draw the thread in its final state immediately rather than animating it;
- keep every scroll position reachable without a scroll-jacking handler.

## Performance budget

Scroll animation is where marketing sites become unusable on mid-range Android.

- Animate `transform` and `opacity` only. Never animate layout properties.
- Drive scroll effects with `IntersectionObserver` and CSS, or a single
  `requestAnimationFrame` loop — never a per-event listener doing layout reads.
- Largest Contentful Paint under 2.5s on a mid-range Android over 4G.
- Photography served as AVIF/WebP, responsive `srcset`, lazy below the fold.
- The thread is one inline SVG path animated with `stroke-dashoffset`, not a
  library.
- No animation library unless it earns its bytes.

## Explicitly not borrowed

- MindMarket's green palette and hand-drawn cloud/squiggle vocabulary.
- Its morphing hill.
- Once's black-and-serif identity, its copy, its IA and its phone screens.
- Any fabricated rating, customer count or usage statistic.
