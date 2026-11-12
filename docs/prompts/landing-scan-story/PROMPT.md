# Prompt: "scan the seating board" marketing page for Stills

**How to use:** unzip this folder somewhere, open Claude Code in an **empty project folder**, attach (or drag in) the whole `landing-scan-story` folder, and paste everything below the line. No other code or repo is needed.

---

Build a standalone marketing landing page for **Stills**, an event camera app, whose hero is a scroll-driven story. The story recreates the motion of the hero on **once.film**, a competitor. In their version a phone scans a QR table card on a plate. **In ours the phone scans a canvas seating board on an easel** with a "Find your seat" illustration and a QR code, then the guest finds their table and joins the event camera.

This is **marketing only**. Nothing connects to a real app, backend or account. Every app screen inside the phone is a static HTML/CSS mock-up. The finished folder will later be dropped into another (React) project by someone else, so it has to be self-contained and easy to port (see "Deliverable").

## Attached files (read all of them before writing code)

1. **`01-ONCE-FILM-ANALYSIS.md`**: a measured spec of once.film's story covering:
   - layout maths;
   - every scroll range and easing curve;
   - the timer-based beats;
   - the tap cues and the hand-off into the next section;
   - reduced-motion and no-JS behaviour.

   **This is your source of truth for motion.** Match its numbers unless the storyboard below changes a beat.
2. **`02-STILLS-BRAND-AND-SCREENS.md`**: our brand colours, fonts, type scale, the demo event's names and values, and a precise description of every screen you'll draw inside the phone.
3. **`reference/desktop/*` and `reference/mobile/*`**: screenshots of once.film at each beat. Filenames include the scroll progress (`p022` = 22%). Use them to judge composition and feel. They are reference only and must never be shipped.
4. **`assets/`**: our fonts (Isolde), logo and sample event photos. These are ours and can be shipped.

To watch the original live, open https://once.film, run `document.cookie = 'once_marketing_hero_v1=variant; path=/'; location.reload();` in the browser console, and scroll. Their root element exposes `data-story-progress` and `data-scene` if you want to line up progress values.

## Ground rules

- **Match the motion, write everything ourselves.** Recreate the choreography, timing, easing and layering from the spec. Don't copy once.film's JavaScript, CSS, images, fonts, wording or brand. All code, copy and artwork are ours.
- **No framework in the component.** Plain HTML, CSS and ES-module JavaScript, so it ports into anything. Vite is fine as the dev server and bundler.
- **Dependencies:** a QR generator (e.g. `qrcode`) used at build time, and Playwright for verification. Nothing else at runtime.

## Page contents

1. **Header:** Stills logo (`assets/brand/logo-lockup.png`) at the left; an "App Store" button at the right linking to the configurable App Store URL.
2. **Hero scroll story** (below).
3. **Next section:** the heading the hand-off lands on, "Every guest's view. One shared album.", in Isolde. Under it, a row of 4–6 of our sample photos in a soft grid with a short line of copy and a CTA. Keep it simple; it exists so the hand-off has somewhere to land.
4. **Minimal footer:** logo and © line.

**Hero copy:**
- Headline: "Every guest's camera," / *"one shared album."* (second line in Isolde italic).
- Sub-line: "Guests scan the seating board, find their table and start shooting. No app download, no sign-up. The album reveals after the party."
- CTA: "Create your event", ivory button, linked to the App Store URL.

## Storyboard

Our story has more beats than theirs (finding the table is new), so it's longer: **section height `750svh` on desktop, `680svh` at ≤800px**.
- Keep each of their beats' *duration and easing*; shift the ranges as below.
- All ranges are scroll progress `n` (0–1) of the section.
- `§` numbers refer to `01-ONCE-FILM-ANALYSIS.md`.
- Screen numbers refer to `02-STILLS-BRAND-AND-SCREENS.md`.

| # | Progress | Stills beat | Mirrors once.film |
|---|---|---|---|
| 1 | 0 → 0.17 | Copy + CTA above the phone showing the **iOS home screen** (screen 1). The CTA fades out fast; the copy drifts up and fades. **Tap** on Camera at 0.022. Home zooms into the camera over 0.06–0.08. The board panel rises behind the phone, then expands to the full stage over 0.08–0.15 | §3 rows 0.002–0.17 |
| 2 | 0.17 → 0.24 | **iOS camera** (screen 2) framing the **seating board on the easel**. The viewfinder is a see-through window: the board continues past the phone's edges. The **QR reticle** locks on over 0.175–0.195 | §3 0.205–0.23 |
| 3 | 0.20 → 0.26 | **Yellow pill** (screen 3) slides up under the QR over 0.215–0.235. **Tap** at 0.255 | §3 0.255–0.305 |
| 4 | ≥ 0.29 | **App Clip card** (screen 4) rises on a timer: 400ms ease-out cubic, 80ms delay; closes in 280ms; snaps when below 0.235 or at/after 0.37. The board dims to 50% with the blur scrim behind. **Tap** Open at 0.37 | §5 App Clip, §3 tap #3 |
| 5 | ≥ 0.40 | **Open sequence** on a timer (about 1.2s; snaps to done at/after 0.47). Spinner on Open, the card recedes, and the **join screen** (screen 5) fades in and slides down 56px | §5 Open sequence, first 950ms |
| 6 | 0.47 → 0.52 | **Tap** the name field at 0.475. The **Find your table** sheet (screen 6) slides up over 0.48–0.51 (`translateY(100%) → 0`, smoothstep) | new; reuse the App Clip sheet feel |
| 7 | 0.52 → 0.59 | "Ayla" **types itself, scrubbed by scroll**: characters shown = `round(lerp(0, len, ss(0.52, 0.58)))`, with a blinking caret. From 2 characters on, the helper text cross-fades into the matching rows | new |
| 8 | 0.59 → 0.65 | **Tap** "Ayla Brooks" at 0.595. The rows fade out and the **seat card** fades and scales in (0.96 → 1) over 0.60–0.63: "YOU'RE SEATED AT", **Table 7** in gold, the name below. Hold to 0.65 so it can be read | new; ease like §8's heading reveal |
| 9 | 0.65 → 0.71 | **Tap** "Join the event" at 0.655. A timer starts at ≥ 0.66: button spinner, then the **Stills camera** (screen 7) comes in the way theirs does. The venue photo fades in behind the phone (blur 8 → 0, brightness 0.68 → 1, 56px drift, ease-out quart) and the board fades out | §5 Open sequence 500–1970ms; §6 |
| 10 | 0.72 → 0.79 | Phone zooms to final scale and position; the background dims | §3 0.67–0.75 |
| 11 | 0.82, 0.87, 0.92 | **Three shots:** shutter press, viewfinder blink, the shots counter wheel ticks 20 → 17, the thumbnail swaps to the newest photo | §7 |
| 12 | 0.95 → 0.985 | "Ayla's 3 photos are developing…" in Isolde, under the phone | §3 0.935–0.975 |
| 13 | after 1.0 | **Hand-off:** the developing line grows, blurs out, and resolves into the next section's heading | §8 |

## Artwork to create

**Seating board scene photo** (the counterpart of their table photo):
- **Subject:** a wooden easel holding a blank canvas board at a reception entrance; soft evening light, a few florals, venue softly out of focus.
- **Framing:** match their framing and aspect (about **16:9** landscape), board centred, about 40% of the frame wide.
- **Source:** generate it with an image model or use a licensed stock photo, and record which (with the licence) in the README.
- **Format:** AVIF/WebP, 1600–2400px wide.

**Board artwork, as HTML/SVG layered on the photo (not baked in):**
- **Contents:**
  - "Find your seat" in Isolde;
  - a small original line illustration (a table-plan sketch or botanical sprig);
  - "Olivia & Daniel · 12 June";
  - the **QR code**, generated at build time from the config's QR URL into an SVG, so it's sharp and scans for real.
- **Placement:** fit the overlay to the canvas in the photo with a CSS `perspective` / `matrix3d` transform.
- **Reticle maths:** compute the QR's centre and size from the overlay's geometry and position the reticle from those numbers, the same way the spec derives it from photo coordinates (§3, 0.205 row).

**Phone frame:**
- Draw it in CSS/SVG at the spec's 420×867 design size (screen 392×850, radius 60).
- Add a dark titanium edge, side buttons and a dynamic-island pill.
- No borrowed device mock-ups.

**Screens 1–7:** HTML/CSS mock-ups exactly as described in `02-STILLS-BRAND-AND-SCREENS.md`, with simple original SVG icons.

**Photos:** use `assets/photos/` for the viewfinder, venue background, thumbnails, App Clip header and join cover.

## Engineering requirements

**Structure:**
- A tall section with a `position: sticky; top: 0; height: 100svh` stage.
- One passive scroll listener, throttled with `requestAnimationFrame`, computes `n` and writes inline transforms and opacities (or CSS custom properties).
- Re-measure on resize, on a `ResizeObserver` on the copy block, on `document.fonts.ready` and on `pageshow`.
- Implement the layout maths from §2 so composition holds at every size.

**Motion:**
- Animate only `transform`, `opacity`, `filter` and `clip-path`.
- Set `visibility: hidden` on anything at ≤ 0.001 opacity.
- Every scroll-scrubbed value is a pure function of `n`.

**Timer beats** (App Clip, Open, Join):
- Follow the snap rules in §5, so fast scrolling either way never leaves a half-played state.
- Run the rAF loop only while a timer is in flight.

**Touch cues:** a dot and a ring, exactly per §4, at the storyboard's tap values.

**Debug attributes on the story root:**
- `data-story-progress`;
- `data-scene`, with the values `intro`, `scan`, `scan-url`, `app-clip`, `join`, `find-seat`, `seated`, `camera`, `capture`, `complete` and `static`.

**Skip link:** "SKIP ↓" at the bottom right, visible 0.16–0.97. It jumps instantly to the next section and focuses it.

**Header:** hides on scroll-down inside the story; shows on scroll-up or keyboard focus.

**Reduced motion** (`prefers-reduced-motion: reduce`):
- No tall section.
- One static composition: copy and CTA, plus the phone showing the seat card ("YOU'RE SEATED AT Table 7") over the seating board.

**No-JS:** the same static composition. A tiny inline script in `<head>` adds a `motion` class to `<html>` before first paint, so the tall layout doesn't jump in later.

**Performance:**
- The first viewport loads only the hero's own images.
- Preload each later scene's images shortly before it's needed.
- LCP stays the headline text.
- Fonts use `font-display: swap`.
- Report the total page weight.

**Accessibility:**
- The headline and CTA are real text, first in DOM order.
- The stage is `aria-hidden`; the section carries one label: "Animated demo: a guest scans the seating board, finds their table and joins the event camera".
- Keyboard focus never lands inside the animation.

## Deliverable (built to be ported later)

A folder like this:

```
stills-landing/
  README.md                  how to run, build, change the config, and port it
  package.json               scripts: dev, build, qr, capture
  index.html                 the page; the story markup lives here, static
  src/
    page.css                 header, next section, footer, fonts
    scan-story/
      scan-story.css         every selector scoped under .scan-story, no global resets
      scan-story.js          export function mountScanStory(rootEl, config) → returns destroy()
      scan-story.partial.html  the story markup on its own, identical to what's in index.html
      config.js              event names, guest, table, QR URL, App Store URL, photo paths
  public/assets/             fonts, logo, photos, board scene, generated qr.svg
  scripts/
    make-qr.js               config QR URL → public/assets/qr.svg
    capture.js               Playwright screenshots at set progress values and sizes
  comparison/                our screenshots beside once.film's, per beat
```

**Portability rules** (someone will paste this into a React app):
- Importing a module has no side effects.
- `mountScanStory` only touches its own root and `window` scroll/resize.
- `destroy()` removes every listener, observer and rAF.
- Assume the page scrolls on `window`.
- No global CSS except the `@font-face` rules and `html.motion` in `page.css`.

**README:** include a short "Porting" section listing exactly which files to copy and how to mount it.

## Verify before handing back

1. Run `scripts/capture.js` at **375×812, 768×1024 and 1440×900**, at the progress values of every file in `reference/`, plus our new beats (0.50, 0.56, 0.62, 0.68). Use the timer beats' settled state (wait 2.5s at those points).
2. Put each of ours beside the matching once.film screenshot in `comparison/`. Fix anything where timing, easing or composition feels off, and list every deliberate difference in the README.
3. Run it in **Chromium and WebKit** (Playwright), and on a real iPhone in Safari if you can, since `svh` units and sticky positioning differ there.
4. Scroll fast both ways, resize mid-story, reload halfway down, and emulate reduced motion. Nothing may get stuck between scenes.
5. Scan the on-screen QR code with a real phone; it should open the config URL.
6. Run Lighthouse on the production build (`vite build && vite preview`) and report LCP, CLS and total weight.

**Checkpoint:** after making the seating-board photo and the board overlay with its QR, **stop and show a still of that scene** for approval before animating the rest.

**Done means:**
- The page plays the seating-board story beat for beat with once.film's polish.
- All code and artwork are original.
- The fallbacks work and mobile performance is good.
- The comparison folder shows the match.
- The README explains how to port it.
