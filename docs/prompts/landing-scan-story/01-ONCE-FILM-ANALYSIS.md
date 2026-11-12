# once.film hero scroll story: measured spec

Measured on 29 Oct 2026 by stepping through the live page in a browser and reading the runtime behaviour. This file describes **what it does**: timings, ranges, easing, sizes and layering. Use it to rebuild the motion with our own code and assets. It is not their code.

Screenshots of each beat are in `reference/desktop/` and `reference/mobile/`. Filenames include the scroll progress they were taken at (e.g. `p022` = 22%).

## How to see it yourself

The story is an A/B variant; most visitors get a static hero. Open https://once.film, then run this in the console and reload:

```js
document.cookie = 'once_marketing_hero_v1=variant; path=/'; location.reload();
```

## 1. Structure

- **Section:** a tall section, `650svh` on desktop and `590svh` at ≤800px wide.
- **Stage:** a `position: sticky; top: 0; height: 100svh` child, `max-width: 1800px`, centred, `overflow: hidden`, background `#0d0d0d`.
- **Progress:** `n = clamp((scrollY − sectionTop) / (sectionHeight − stageHeight), 0, 1)`. Everything below is keyed off `n`.
- **Driver:** one passive `scroll` listener throttled to `requestAnimationFrame`. It computes every value from `n` and writes inline `transform` / `opacity` / `filter` / `top` / `left` / `width` / `height`. It only keeps the rAF loop running while a **time-based** beat (see §5) is in flight. It re-measures on `resize`, on a `ResizeObserver` on the copy block, after `document.fonts.ready`, and on `pageshow`.
- **Debug attributes:** the root carries `data-story-progress` (4 dp) and `data-scene`, plus a shot count.
- **Visibility:** each element is toggled with `visibility: hidden` whenever its opacity is ≤ 0.001, so hidden layers cost nothing to paint.

### Layers (back to front)

| z | Layer | Notes |
|---|---|---|
| 0 | **Table panel**: rounded rect, radius 22px, fallback colour `#4a2a0f`, 1px inner hairline `rgba(255,255,255,.12)` | Holds a 1672×941 top-down photo: linen cloth, silver plate, ivory table card with headline, QR and couple's names |
| 1 | **Event panel**: inset stage card, radius 18px | Holds the venue/party photo (see §6) |
| 3 | **Phone**: 420×867 design size, `transform-origin: top` | Screen 392×850 at (14, 9), radius 60. The device frame image sits above all screen content with `drop-shadow(0 5px 7px #0005)` |
| 4 | **Copy**: headline, sub-line, CTA | Centred, top padding 100px (112px ≤800, 80–108px ≤480) |
| 5 | "…photos are developing" line | |
| 6 | "SKIP ↓" link | |

### Inside the phone screen (back to front)

1. **System camera.** The iOS Camera app UI: black top bar with small icons, black bottom bar with shutter, VIDEO/PHOTO toggle, thumbnail and flip button. The viewfinder region shows **the same table photo, aligned exactly with the table panel behind the phone**. The phone reads as a window onto the scene, and the card visibly continues outside the phone edges.
2. **Home screen** (z 2): iOS home screen with Photos / Camera / app / Notes icons and a blurred green wallpaper. Its `transform-origin` is set to the Camera icon's centre.
3. **Scan reticle:** four 21px corner brackets with `drop-shadow(0 0 5px rgba(0,0,0,.3))`.
4. **URL pill:** yellow `#f8d74a`, height 25px, radius 13px, min-width 197px, padding 0 9px, 12px/500 text in `#15130a`, 13px app icon on the left, 14px × on the right, shadow `0 9.4px 19.3px rgba(0,0,0,.25)`. Sits at y=606 in phone coordinates (just under the card's QR), horizontally centred.
5. **Clip dim** (z 3): `backdrop-filter: blur(10px)` plus a vertical gradient from `rgba(5,3,1,.31)` to `rgba(5,3,1,.87)`.
6. **App Clip card** (z 4): 376×426, radius 40, 8px from the screen sides, ~20px from the bottom. Contains illustration, title, subtitle, a blue pill **Open** button and an "App Clip" footer. A loading overlay sits on the Open button: brand blue `#87c7f2` pill with a 14px spinner ring (1.8px white, two quarters at 30% white).
7. **Brand camera** (z 5): background `#101010`. Header with two 44px glass icon boxes (`rgba(255,255,255,.06)` fill, 1px `rgba(255,255,255,.04)` border, radius 14) and the event title in serif 16px with a grey 13px "time left" line. Viewfinder 364×518 at (14, 122), radius 40, 1.3px `rgba(255,255,255,.24)` border, holding a crop of the venue photo. Options row at y=655 (flash, a 100px black zoom pill "0.5 / **1.2×**", flip). Controls row at y=705: an 86×63 black shot counter (radius 23), a 100px shutter, and a 64px thumbnail (radius 20).
8. **Shutter shade:** a black layer over the viewfinder, used as the shutter blink.
9. **Touch cues:** a dot and ring per tap (see §4).

## 2. Layout maths (recomputed on every resize)

Let `E` = stage width, `D` = stage height. "Mobile" means `E ≤ 800`.

| Value | Desktop | Mobile |
|---|---|---|
| Gutter `G` | `max(20, E·37/1728)` | `14` |
| Content width `K` | `E − 2G` | same |
| Panel height `q` | `min(D − 128, K·1006/1654)` | `D − 86 − G` |
| Panel top `J` | `(D − q)/2` | `86` |
| Phone scale `Y` | `min(K/1654, q/1006, 1)` | `min(E/610, (D−140)/867, 1)` |
| Final phone scale | `Y × 1.46` | `Y × 1.16` |

Phone `top`, interpolated through three positions:

- **Start:** `max(copyHeight + 55, (J+q) − 750Y + 30)`. Use `+36` instead of `+55` on mobile. The phone sits under the copy with its lower half cut off by the viewport.
- **Centred:** `J + (q − 867Y)/2 − 30Y`. On mobile, `90 + max(0, (D − 120 − 867Y)/2)`.
- **Final:** `J + 0.64q − 755·finalScale`. On mobile, `(D − 96)·0.67 − 755·finalScale`. The phone is enlarged, its top runs off-screen and its camera controls sit about two thirds of the way down.

## 3. Scroll-scrubbed timeline

`ss(a,b)` = smoothstep (`3t² − 2t³`) of `n` across `[a, b]`. Unless stated, every interpolation uses `ss`.

| Progress | What happens | Exact values |
|---|---|---|
| 0.002 → 0.025 | CTA fades out (fast, so a scrolling user can't mis-click it) | opacity 1→0; made `inert` once gone |
| 0.002 → 0.17 | Copy drifts up | translateY 0 → −95px |
| 0.01 → 0.10 | Copy fades | opacity 1→0; `inert` after 0.10 |
| 0.002 → 0.17 | Phone moves from **Start** to **Centred** | `top` |
| 0.000 → 0.035 | Table panel rises from behind the phone | panel top: `phoneStart + 0.28·867Y` → `phoneTop + 144Y`. The panel is a square `min(K,q)` × `min(K,q)` |
| **0.026** | **Tap #1** on the Camera icon | touch cue (§4) |
| 0.07 → 0.09 | Home screen zooms into the Camera app | home opacity 1→0, scale 1→1.14 around the Camera icon |
| 0.09 → 0.17 | Table panel expands to fill the stage | width `min(K,q)`→`K`, height →`q`, top →`J`; photo re-centres vertically |
| 0.16 → 0.20 | Skip link fades in | |
| 0.205 → 0.23 | **QR reticle** appears around the code | opacity 0→1. Positioned from the photo: QR centre at (835.5/1672, 476.5/941) of the photo, side = `photoWidth·114/1672 + 8px` |
| 0.255 → 0.28 | **URL pill** appears | opacity 0→1, translateY 8px→0 |
| **0.305** | **Tap #2** on the pill | |
| ≥ 0.35 | **App Clip opens** (time-based, §5) | |
| **0.448** | **Tap #3** on Open | |
| ≥ 0.493 | **Open sequence** starts (time-based, §5) | |
| 0.67 → 0.75 | Phone zooms to final scale and position | event photo brightness ×(1 − 0.65·t); bottom fade stop 94% → 78% |
| 0.79, 0.85, 0.91 | **Three shots** (§7) | each takes 0.016 of progress |
| 0.935 → 0.975 | "**Name**'s 3 photos are developing…" fades in below the phone | opacity 0→1, translateY 36px→0; serif 28px (24px mobile), `rgba(255,255,255,.9)` |
| 0.97 → 1.00 | Skip link fades out | |
| after 1.0 | **Hand-off** into the next section (§8) | |

`data-scene` names: `intro` (<0.09), `scan` (<0.28), `scan-url` (<0.35), `app-clip` (until the brand camera is fully in), `camera-ready` (until the venue photo starts), `event` (<0.75), `capture` (<0.935), `complete`. Reduced motion uses `static`.

## 4. Touch cue (the fake finger tap)

Each tap plays over a progress window 0.032 long, starting at its trigger (0.026 / 0.305 / 0.448). Let `r` = position inside that window (0→1).

- **Dot:** 20px white circle, 1px `rgba(255,255,255,.7)` border, shadow `0 1px 7px rgba(0,0,0,.53)`.
  - Opacity rises to 0.68 over r 0–0.16, then fades out over r 0.52–0.83.
  - Scale goes 0.86 → 1 over r 0–0.16, then presses in by −0.18 over r 0.16–0.40.
- **Ring:** 22px, 1.5px white border, shadow `0 0 0 1px rgba(0,0,0,.25), 0 1px 5px rgba(0,0,0,.2)`.
  - Opacity rises to 0.8 over r 0.28–0.42, then fades out over r 0.68–1.
  - Scale goes 0.8 → 2.8 over r 0.28–1, so it ripples outward after the press.

## 5. Time-based beats (triggered by scroll, then play on the clock)

These don't scrub with the scroll. Reaching a threshold starts a timer.

**App Clip sheet (`L`, 0→1).**
- Trigger: progress ≥ 0.35 starts it opening: 400ms, ease-out cubic, 80ms delay.
- Dropping back below 0.35 closes it: 280ms.
- It snaps (no animation) when progress < 0.28 or ≥ 0.448, so fast scrolling never leaves it mid-way.
- While open:
  - The sheet slides from `translateY(110%)` to 0.
  - The clip dim fades in.
  - The table panel's brightness drops to 50%.
  - The reticle and pill fade out.

**Open sequence.** A 1,970ms clock that starts when progress ≥ 0.493 and resets below it. Past 0.67 it jumps straight to the end.

| ms | Beat | Easing |
|---|---|---|
| 0–80 | Spinner overlay fades in on the Open button (1 turn per 700ms) | linear |
| 500–580 | Spinner fades out | linear |
| 500–950 | App Clip sheet recedes (scale −3.5%, brightness −30%). System camera fades out. Brand camera fades in and slides down from −56px to 0 | smoothstep for the sheet, ease-out cubic for the camera |
| 1070–1970 | Venue photo appears: fades in (smoothstep), blur 8px→0 (done by 85%), brightness 0.68→1 (done by 90%), viewfinder image drifts 56px into place (ease-out quart). The table panel fades out at the same rate | mixed, as listed |

## 6. The event background ("the phone's view continues outside it")

Once the brand camera is up, the stage behind the phone becomes the same party photo the viewfinder shows. It is sized and offset so the viewfinder crop lines up with the background, scaled by the phone's current scale, and kept in sync while the phone zooms.

- **Edge masks:** the background photo fades out at the left and right edges (transparent → opaque over the outer 10%) and at the top (8%). The bottom fades into the page background at 78–94%.
- **Glow:** behind it, a copy of the photo blurred 45px at 55% opacity adds colour bleed.
- **Panel:** inset 24px, radius 18px.
- **Blur and brightness:** the photo's blur and brightness follow the §5 values. During the 0.67–0.75 zoom the background dims to about 35%, so the phone stands out.

## 7. Shots

There are three shots, at progress 0.79, 0.85 and 0.91.

**Counter.** A horizontal wheel of digit images 20, 19, 18, 17 …. Each digit slot is 30px wide with a 5.8px gap, so the wheel moves 35.8px per shot.
- Each shot slides the wheel one digit over 0.016 progress (smoothstep).
- Digit opacity = `0.2 + 0.8·max(0, 1 − |digit − current|)`, so neighbouring digits cross-fade.

**Shutter press.** Driven by a sine pulse `sin(π·t)` over progress `[shot − 0.004, shot + 0.018]`.
- The shutter scales down 9%.
- The black shade over the viewfinder rises to 70% opacity (the blink).
- The thumbnail scales down 8%.

## 8. Hand-off to the next section

The next section's heading ("Every perspective, one shared album.") is the destination. During the next viewport of scroll after the story ends:

- The "developing" line is cloned into an overlay. Over the first 32% it moves to 46% of the viewport height and scales up to fit the width (max 1.45×). Over 25–49% it fades out and blurs to 6px.
- A copy of the next heading fades in from 8px blur at 92% scale (34–58%), then travels to the heading's real position (58–100%).
- The hero scene fades out over the first 35%.
- The section's content fades in over 78–100% with a 24px rise.

## 9. Chrome and edge cases

- **Skip link.**
  - Placement and style: bottom-right (30px in, 110px up; 18px/28px on mobile), "SKIP ↓" in 13px/500, letter-spacing 0.24rem, `rgba(255,255,255,.3)`.
  - Behaviour: jumps instantly (no smooth scroll) to the section after the hero and moves keyboard focus there.
- **Site header.** On desktop, inside the story, the header hides on scroll-down and reappears on any scroll-up or when it gets keyboard focus.
- **Reduced motion** (`prefers-reduced-motion: reduce`). The tall section collapses to a normal 1,100px block with no sticky stage. It shows one static composition: copy and CTA, with the phone showing the brand camera over the venue photo. No home screen, table or taps.
- **No-JS / not yet enhanced.** The same static composition: the home screen and table are hidden, and the camera and event are shown. A pre-paint inline script sets a "motion enabled" flag on `<html>` so the tall layout is ready before first paint, avoiding a jump.
- **Fast scrolling.** Because every value is a pure function of `n` (plus the two clocks, which snap past their windows), scrolling fast in either direction never leaves a half-finished state.

## 10. Type and colour around the story

| Element | Style |
|---|---|
| Page background | `#0d0d0d` |
| Headline | High-contrast serif, 400 weight, 70px / line-height 1, letter-spacing −0.04em, white. Second line italic. 50px at ≤800px, 36px at ≤480px |
| Sub-line | 14–16.8px (`clamp(14px, 1.05vw, 16.8px)`), line-height 1.6, `#b3b3b3`, letter-spacing 0.02em, 28px under the headline |
| CTA | White pill, dark text, trailing →, 42px below the sub-line (25px at ≤800px, 16px at ≤480px) |
| UI labels | Clean grotesk sans |
