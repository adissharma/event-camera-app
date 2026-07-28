# Design system

The single source of truth is `src/design/`. There is exactly one visual system
in production code.

## Documents

| Document | Covers |
|---|---|
| `reference-audit.md` | What was borrowed from the three references, and what was not |
| `brand-system.md` | The three colour directions and two type systems considered, and why one of each was chosen |
| `typography.md` | Licences, the semantic scale, Dynamic Type, the international gap |
| `colour-accessibility.md` | Measured contrast ratios and the colour-independence rules |
| `motion-system.md` | Motion tiers, reduce-motion, and the Reanimated pitfalls found |
| `form-patterns.md` | Rules binding on every creation step |
| `visual-assets.md` | Photography direction and the asset manifest |
| `renaming.md` | Everything that must change before launch |
| `marketing-motion-spec.md` | Original scroll narrative for the future marketing site |

## Module map

```
src/design/
  colours.ts      semantic colour tokens + elevation
  typography.ts   semantic type roles + Dynamic Type caps
  spacing.ts      4pt grid, radii, layout constants
  motion.ts       duration / easing / spring / stagger tokens
  use-motion.ts   resolves tokens against the reduce-motion setting
  index.ts        the only import surface
```

## Binding rules

1. **No raw values in components.** No hex colour, no `fontSize`, no
   `fontFamily`, no magic spacing number. Import a semantic token.
2. **Text goes through `AppText`.** It picks a `variant` and a `tone`; it never
   sets a family, size or colour directly. This is what applies the Dynamic Type
   cap automatically.
3. **State is never colour alone.** Every selected / error / success / locked /
   disabled state carries a glyph, a label or a shape change as well.
4. **Photography dominates; chrome recedes.** Images are not all placed in small
   rounded cards, and gradients are not laid over every photograph.
5. **Elevation is shadow, not fill.** Raised surfaces keep the same contrast
   relationship with their text.
6. **Motion explains.** If an animation is not communicating selection,
   progress, continuity, cause and effect, or a new entitlement, it is removed.
7. **Content is never gated on an animation completing.**

## Primitives

| Component | Location | Purpose |
|---|---|---|
| `AppText` | `components/ui/text.tsx` | The only text primitive |
| `Button` | `components/ui/button.tsx` | 4 variants, 3 sizes, loading, haptics, `disabledReason` |
| `Screen` | `components/layout/screen.tsx` | Safe areas, keyboard avoidance, sticky action outside the scroll view |
| `Reveal` | `components/feedback/reveal.tsx` | In-flow staggered mount reveal with a guaranteed settle |
| `VisualPlaceholder` | `components/media/visual-placeholder.tsx` | Reserves the exact box for unsourced photography |
| `PremiumImage` | `components/media/premium-image.tsx` | Focal-point cropping, crossfade, labelled fallback |
| `BrandLogo` | `components/brand/brand-logo.tsx` | The only place the mark is rendered |

## Verification

```bash
npm run typecheck        # strict TypeScript, no errors
npm run check:contrast   # every documented ratio, fails the build on regression
npm run lint
```
