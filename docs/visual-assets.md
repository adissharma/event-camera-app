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

## Motion assets

Manifest: `MOTION_ASSETS` in `src/config/visual-assets.ts`. Component:
`BackgroundVideo`.

Keep this list very short — every entry ships inside the binary and is paid for
in download size by every user.

| Key | File | Size | Screen |
|---|---|---:|---|
| `welcome_ambient` | `assets/video/welcome-hero.mp4` (720×1280, 30fps) | 1.26 MB | Welcome |

### Licence — `welcome_ambient`

| | |
|---|---|
| Source | Pexels — [video 19492425](https://www.pexels.com/video/a-person-holding-a-sparkler-in-the-dark-19492425/) |
| Author | Beyza Koeken |
| Licence | Pexels License — free to use |
| Commercial use | Permitted |
| Attribution | Not required (credited here regardless) |

The Pexels License permits commercial use and modification without attribution.
It does **not** permit reselling the footage itself, or using identifiable
people in a way that implies endorsement. Neither applies to background use.

**This is placeholder footage** (`isPlaceholder: true`). It is correctly
licensed and atmospheric, but it is stock — not this product's own material, and
some competitor could legitimately use the same clip. Replace it with real event
footage before launch. The manifest entry is the only thing that changes.

Deliberately avoided: Pexels' `aigc-bundle` AI-generated clips. Generic
AI-generated celebration content is exactly what makes a premium product read as
cheap.

### Behaviour

- Muted, looping, not interactive, hidden from assistive technology — it is
  wallpaper, and it must never interrupt the user's own music
  (`audioMixingMode: 'mixWithOthers'`).
- Fades up over 900ms once the player reports `readyToPlay`, so it never
  cross-fades into an undecoded black rectangle. The canvas beneath is
  near-black and so is the footage, so there is no flash.
- Falls back to the manifest's `fallbackAssetKey` placeholder on error.

### Reduce motion

A looping background video is precisely the content **WCAG 2.2.2 (Pause, Stop,
Hide)** addresses — it moves indefinitely and the user cannot stop it. It is
also a common migraine and vestibular trigger.

When reduce-motion is enabled the video is **paused on its first frame**, not
removed. The composition, scrim and crop are preserved, so a reduce-motion user
gets the same image everyone else gets — it simply does not move. Removing it
would hand them a visibly poorer screen, which is not the point of the setting.

The listener is live, so toggling the system setting takes effect immediately
rather than only at next launch.

> Not yet verified by toggling the real OS setting — the code path is
> implemented and typechecked, but confirming it needs a device or simulator.
> On the Phase 8 QA list.

### Implementation note

`VideoView` renders at the video's own intrinsic dimensions rather than its
container's. `StyleSheet.absoluteFill` alone does not constrain it, and the
footage spills outside the app bounds on any viewport smaller than the source —
observed directly as raw video appearing beyond the scrim. The fix is explicit
`width: '100%', height: '100%'` on the view plus `overflow: 'hidden'` on its
wrapper.

## Overlays

Text over photography uses `overlayDark` (0.55) or `overlayLight` (0.82), never
a full-bleed gradient over every image. Guaranteeing contrast against a
host-uploaded cover needs a runtime luminance check — tracked for the cover
editor in Phase 5 and noted in `docs/colour-accessibility.md`.
