# Visual assets

Manifest: `src/config/visual-assets.ts`. Components: `VisualPlaceholder`,
`PremiumImage`.

**Replacing imagery requires changing the manifest only — never a screen.**

## Current status

No production photography has been supplied. Every key resolves to `undefined`
and renders as a labelled placeholder that reserves the exact final box, so
dropping in real images will not shift any layout.

This is deliberate. Generic AI-generated wedding photography must not ship in
production — it is the fastest way for a premium product to read as cheap, and
it will not survive comparison with a competitor using real event photography.

## Manifest entries

Each carries an aspect ratio, a focal point, an art-direction brief, an
accessibility label and its intended screen.

| Key | Ratio | Screen |
|---|---|---|
| `welcome_hero` | 3:4 | Welcome |
| `onboarding_candid` | 4:5 | Onboarding — the candid promise |
| `onboarding_multi_event` | 4:5 | Onboarding — multiple functions |
| `onboarding_guest` | 4:5 | Onboarding — how guests join |
| `create_event_cover` | 3:4 | Cover editor default |
| `success_hero` | 1:1 | Publication success |
| `dashboard_fallback` | 16:9 | Event dashboard |
| `theme_editorial` | 3:4 | Theme carousel |
| `theme_film` | 3:4 | Theme carousel |
| `theme_emerald` | 3:4 | Theme carousel |
| `theme_floral` | 3:4 | Theme carousel |

## Art direction

**Do:** candid over posed; available light over studio flash; slight motion blur
and imperfection; faces in genuine moments; large scale; intentional crops;
edge-to-edge where the composition earns it.

**Do not:** put every image in a small rounded card; lay a heavy gradient over
every photograph; place text on a busy area without an overlay token; crop
carelessly through faces; use repetitive stock imagery; ship AI-generated
wedding photography.

**Cultural breadth.** The default and onboarding imagery must not make any one
tradition look like the norm. Ceremony-specific imagery belongs in inspiration
packs, where a host has opted into it — never in the universal path.

## Focal points

`PremiumImage` biases the crop toward the manifest focal point rather than the
geometric centre. Most entries sit at `y: 0.38–0.45` because faces sit above
centre in a portrait crop; centre-cropping is what produces careless face crops.

## Adding a real photograph

1. Place the file in `assets/images/placeholders/` (or a CDN-backed URL).
2. Add `source: require(...)` to the manifest entry.
3. Check the focal point still frames the subject.
4. Confirm the accessibility label describes *this* photograph.

No screen changes.

## Overlays

Text over photography uses `overlayDark` (0.55) or `overlayLight` (0.82), never
a full-bleed gradient over every image. Guaranteeing contrast against a
host-uploaded cover needs a runtime luminance check — tracked for the cover
editor in Phase 5 and noted in `docs/colour-accessibility.md`.
