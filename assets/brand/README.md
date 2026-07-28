# Brand assets

No logo has been supplied yet. `BrandLogo` currently renders a clearly labelled
placeholder lockup with an accessible text fallback. A final logo has **not**
been fabricated.

## Required files

| File | Purpose | Format | Notes |
|---|---|---|---|
| `logo-primary.png` | Default, on light surfaces | PNG, transparent | @1x/@2x/@3x, or a single @3x |
| `logo-light.png` | On photography and dark surfaces | PNG, transparent | Only if a real light variant exists |
| `logo-mark.png` | Square mark for tight spaces | PNG, transparent | Only if a real mark exists |

Prefer SVG via `react-native-svg` if vector source is available — it stays crisp
at every size and is smaller.

## Dimensions

- Supply at **3× the largest rendered size**. The logo renders at 26–32pt in the
  app, so a ~120pt-tall asset is ample.
- **Transparent background, always.** No baked-in white box.
- Trim tight to the artwork. Padding belongs in layout, not in the file.

## Installing a logo

1. Drop the file into this directory.
2. Populate the matching entry in `src/config/brand.ts`:

   ```ts
   export const BRAND_ASSETS = {
     logoPrimary: require('../../assets/brand/logo-primary.png'),
     logoLight: undefined,   // only if a real light variant was supplied
     logoMark: undefined,    // only if a real mark was supplied
   };
   ```

3. That is the whole change. **No screen edit is required** — every surface
   renders through `BrandLogo`.

Leave a variant as `undefined` if it does not exist. `BrandLogo` falls back to
the primary asset rather than inventing one.

## Rules

The logo is never:

- stretched or skewed (aspect ratio is preserved by the component),
- recoloured without an approved variant,
- given a shadow or an outline,
- recreated in text when an official asset exists,
- used as decoration on every screen — it is an anchor, used sparingly.

## App icon and splash

Separate from the in-app logo, and **not** handled by `BrandLogo`:

- `assets/images/icon.png` — 1024×1024, no transparency, no rounded corners
  (the platforms apply their own mask).
- `assets/images/android-icon-foreground.png` — keep artwork inside the safe
  zone; Android crops to several shapes.
- `assets/images/splash-icon.png` — referenced from `app.json`.

These still hold Expo's default artwork and must be replaced before release.
