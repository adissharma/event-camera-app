# Stills: brand, story and the screens to draw

Everything here is for a **standalone marketing page**. Nothing connects to the real app. Every app screen inside the phone is a static HTML mock-up drawn to look like the real one.

## Product in one paragraph

Stills is a private event camera. At a wedding or party, guests scan a QR code, join without signing up, and take a limited number of shots each. The photos stay hidden ("developing") until the host's reveal time, then everyone gets the shared album. Hosts can upload a seating plan, so when guests scan the QR on the seating board at the entrance, they find their table and join the event camera in one go. That moment is what the hero story shows.

Domain: `stills.events`.

## Brand tokens (dark theme)

| Token | Value | Use |
|---|---|---|
| background | `#0B0B0C` | Page and app canvas (warm near-black, never pure black) |
| surface | `#141416` | Cards |
| surfaceRaised | `#1C1C1F` | Sheets |
| surfaceMuted | `#101012` | Inset wells, pressed rows |
| textPrimary | `#F5F2ED` | Warm white |
| textSecondary | `#A29C94` | Supporting text |
| brandPrimary | `#EFE9E0` | Ivory primary buttons; text on them is `#0B0B0C` |
| accentWarm | `#D9C39A` | Warm gold accent (e.g. the table number) |
| borderSubtle | `#232326` | Hairlines and card borders |
| borderStrong | `#66666E` | Input borders |
| scrim | `rgba(5,5,6,.72)` | Behind sheets |

**Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40, 56, 72. Screen side gutter is 20.

**Radii:** 6, 10, 14, 20, 28, pill. Cards use 20; buttons and inputs use 14.

**Buttons:** height 56 (large) or 48, radius 14. The primary button is ivory `#EFE9E0` with `#0B0B0C` Instrument Sans 500 15px text.

## Fonts

| Role | Font | Specs | Where to get it |
|---|---|---|---|
| Display | **Isolde** regular + italic | Headlines, event names, table number | `assets/fonts/` in this bundle. Load with `@font-face`, `font-display: swap` |
| UI text | **Instrument Sans** 400/500/600 | Everything else | Google Fonts |
| Big numerals | **Cormorant Garamond** 500 italic | Only for set figures like the shot counter | Google Fonts |
| Eyebrow labels | Instrument Sans 500 | 11px, line-height 14, letter-spacing 1.6px, UPPERCASE | |

**Type scale for the phone screens** (sizes as drawn at the 392px phone-screen width):

| Style | Font and size | Use |
|---|---|---|
| displayHero | Isolde 46/50, −0.4 | |
| displayLarge | Isolde 36/41, −0.3 | |
| titleLarge | Isolde 28/33, −0.2 | |
| titleMedium | Isolde 22/27 | |
| heading | Instrument Sans 600 17/23 | |
| body | Instrument Sans 400 15/22 | |
| bodySmall | Instrument Sans 400 13/19 | |
| labelLarge | Instrument Sans 500 15/20 | |

## Bundle assets you can use

| Path | What |
|---|---|
| `assets/brand/logo-lockup.png` | The Stills wordmark lockup (1974×797, transparent) |
| `assets/brand/logo.png` | Smaller logo (1024×409) |
| `assets/fonts/Isolde-Regular.ttf`, `Isolde-Italic.ttf` | Display font |
| `assets/photos/01.jpg` … `07.jpg`, `cover.jpg` | Our sample event photos (788×1400, portrait). Use them for the camera viewfinder, the venue background behind the phone, the shot thumbnails and the join screen's cover photo. Pick a lively candid for the viewfinder |

Convert the photos to AVIF/WebP for the page. Keep the originals out of the final output.

## The demo event (use these values everywhere)

All of these live in one config object so they can be changed later.

| Field | Value |
|---|---|
| Event | **Olivia & Daniel's Wedding** |
| Date | Saturday 12 June |
| Guest | **Ayla** (the developing line reads "Ayla's 3 photos are developing…") |
| Seat | **Table 7** |
| Other guests in the search results | "Ayla Brooks", "Aylin Park" (so typing "Ayl" shows two rows) |
| Shots | 20 per guest, counting down to 17 after three shots |
| QR target | `https://stills.events`, kept in the config. A demo event link may replace it later |
| App Store CTA link | `#` (placeholder), in the config |

## Screens to draw inside the phone

The phone screen is 392×850 at the design size. Draw each screen as plain HTML/CSS at that size, using the tokens above. They're mock-ups: nothing is interactive.

### 1. iOS home screen (story opening)
- A soft, blurred green-to-olive gradient wallpaper.
- A status bar showing 7:47.
- One row of four app icons with labels: Photos, Camera, **Stills** (black tile with the white Stills mark), Notes. Draw them as simple original shapes; don't use Apple's icon artwork.

### 2. iOS camera (scanning the board)
- **Top bar:** black, with three small round icons at the top right.
- **Viewfinder:** the rest of the screen, transparent so the seating-board scene behind the phone shows through, lined up exactly (see the prompt).
- **Bottom bar:** black, with a 64px white shutter ring, a "VIDEO · **PHOTO**" toggle, a small round thumbnail at the left and a flip-camera icon at the right.

### 3. QR pill (overlay on the camera)
- Small yellow rounded pill under the QR showing a 13px Stills icon, `stills.events` and a ×.
- Sizes as in the once.film spec §1 (item 4, URL pill). The yellow is iOS's QR-detected style, so keep it.

### 4. App Clip card (iOS sheet)
- A sheet 8px in from the screen edges, radius 40, rising from the bottom.
- **Top half:** a header photo (use a warm candid from `assets/photos/`).
- **Below it:**
  - title "Olivia & Daniel's Wedding" (system font, 17px semibold);
  - subtitle "Find your seat and grab the camera" (13px, grey);
  - a rounded **Open** button at the right in ivory `#EFE9E0` with dark text, which shows a spinner while loading.
- **Footer:** a small "App Clip · Stills" row with the logo.
- Behind the sheet: `backdrop-filter: blur(10px)` and a dark gradient over the camera.

### 5. Join screen
- **Cover photo** across the top 44% of the screen, with a scrim fading to `#0B0B0C` at the bottom.
- **Overlapping the photo's lower edge:**
  - eyebrow "YOU'RE INVITED";
  - title "Olivia & Daniel's Wedding" in displayLarge, centred, 2 lines max;
  - a row of two details, each a small gold (`#D9C39A`) icon over a value and label: clock, "2d 4h" / "Time left"; camera, "20" / "Shots left".
- **Form at the bottom:**
  - a name field: height 56, radius 14, 1px `#66666E` border, person icon at the left, placeholder "Enter your name";
  - under it, a full-width **Join the event** button: ivory, 56px, radius 14.

### 6. Find your table sheet (slides up over the join screen)
- **Background:** `#0B0B0C`.
- **Header row** (20px side padding): "Find your table" in titleLarge at the left; at the right, a 32px round close button (fill `#141416`, 1px `#232326` border, 14px ×).
- **Search field:** same style as the name field, placeholder "Start typing your name". While typing, show a blinking caret.
- **Helper text** "Type your name to see where you're sitting." in bodySmall, secondary colour. Show it until 2 characters are typed.
- **Results card:**
  - fill `#141416`, radius 20, 1px `#232326` border;
  - rows 56px tall with 16px padding: the name in labelLarge at the left, the seat ("Table 7") in bodySmall secondary at the right;
  - hairline separators inset 16px.
- **Seat card** (replaces the results after a row is tapped):
  - fill `#141416`, radius 20, 1px border, 24px top margin, padding 24/20, centred, 8px gap;
  - eyebrow "YOU'RE SEATED AT";
  - **Table 7** in Isolde 36/41, gold `#D9C39A`;
  - "Ayla Brooks" in body, secondary colour.
- **Pinned to the bottom:** an ivory **Join the event** button, then a quiet text button "Not you?".

### 7. Stills camera (after joining)
- **Background:** `#0B0B0C`.
- **Header:** event name in Isolde 16px centred with "2d 4h left" under it in 13px grey; 44px glass icon buttons at left and right (fill `rgba(255,255,255,.06)`, radius 14).
- **Viewfinder:** large, radius 40, 1px `rgba(255,255,255,.24)` border, showing a photo from `assets/photos/`.
- **Under it:** a row with a flash icon, a small zoom pill and a flip icon.
- **Controls row:**
  - a black **shots-left counter** pill holding a horizontal wheel of numbers (20, 19, 18, 17) set in Cormorant Garamond italic;
  - a 100px white shutter;
  - a 64px rounded thumbnail of the last photo.

Draw your own icons as simple 1.5px-stroke SVGs (clock, camera, person, flash, flip, close).
