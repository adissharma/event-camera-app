# Prompt: build the "scan the seating board" scroll story for the Stills homepage

> Paste everything below the line into Claude Code (or another coding agent), run from the root of the `event-camera-app` repo.

---

You're building a scroll-driven hero animation for the Stills public homepage (`src/app/index.web.tsx`). The reference is the hero on **once.film**, a competitor. In their version a phone opens its camera, scans a QR table card on a plate, gets an App Clip invite and lands in their event camera. We want the same choreography, pacing and polish, but the phone scans **a canvas seating board on an easel** with a "Find your seat" illustration and a QR code, then goes into our guest flow.

Work in three phases and don't skip ahead: **analyse → storyboard → build**. Each phase produces a file the next one depends on.

## Ground rules

- **Rebuild it, don't lift it.** Measure their motion (timings, scroll ranges, easing, transforms, layering, breakpoints) as closely as you can, then write our own code. Do not copy their JS bundle, CSS files, images, fonts, copy text or brand marks into this repo. Every asset and line of code we ship is ours. Match the feel exactly; the implementation and assets are original.
- Read `AGENTS.md` first. This is **Expo SDK 57** with Expo Router and react-native-web. Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code, especially on web-only (`.web.tsx`) routes and DOM components.
- **React Compiler gotcha (this repo has been bitten by it):** hooks that mutate module-level `let` variables get miscompiled. Keep scroll and animation state in refs or in the DOM (CSS custom properties, `data-*` attributes), not module-level mutable variables. After building, check the *served* web bundle, not just the source.
- The homepage is web-only, so the story can be a web-only component that renders plain DOM and CSS (`<div>`, `position: sticky`, CSS transforms) instead of React Native primitives. Pick whichever is cleanest under Expo 57's web rules and explain the choice in a comment at the top of the component.

## Phase 1: analyse once.film (output: `docs/landing-story/once-analysis.md`)

The scan story is an **A/B variant** and most visitors get the plain control hero. To force it, set the cookie and reload:

```js
document.cookie = 'once_marketing_hero_v1=variant; path=/'; location.reload();
```

You'll know it's working when the page has a `.hero-story` element with `data-hero-story`, `data-scene` and `data-story-progress` attributes, and the first screen shows a phone with an iOS home screen sitting above a table on brown linen.

Use a real browser you can script (Playwright, or the browser tools you have) and capture:

1. **Scroll structure.** The height of `.hero-story` (about 4,700px at an 800px-tall viewport, so roughly 6 viewports of scroll), which element is sticky, and how scroll position maps to progress.
2. **The scene timeline.** Step through the story in small increments (e.g. every 1% of progress) and log `data-scene`, `data-story-progress` and every `data-*` state attribute that changes. Build a table: scene name → scroll-progress range → what's visible.
3. **Per-element motion.** For each `hero-story__*` element (stage, table, phone, phone-frame, screen, system, home, camera, scan, scan-url, clip, open-tap, open-loading, touch / touch-dot / touch-ring, camera-header, viewfinder, shutter, shutter-shade, counter-wheel, thumbnail, developing, copy, cta, skip, event-photo, event-wash and the rest), sample the computed `transform`, `opacity`, `clip-path`, `filter`, `border-radius`, `width/height` and `top/left` at each progress step. Record start value, end value, the progress range over which it changes, and the easing. Work out the easing from the samples if it isn't declared, and note any `transition` / `animation` declarations and `@keyframes`.
4. **Time-based vs scroll-scrubbed.** Some beats (the fake finger tap, loading spinner, shutter flash, counter wheel tick) may play on a timer once a scene is reached instead of scrubbing with scroll. Note which is which, with durations.
5. **The QR "lock-on".** How the scan reticle appears, how the yellow URL pill ("You're invited to the album!") slides in, and how the camera view zooms or tracks onto the card.
6. **The App Clip sheet.** How it rises, its blur/dim backdrop, the tap target and the loading state on its button.
7. **The hand-off into their camera UI and the album.** How the viewfinder goes full-bleed, how the shot counter animates, how a thumbnail "develops", and how the story exits into the next section.
8. **Responsive behaviour.** Repeat the key measurements at 375×812, 768×1024 and 1440×900. Note what changes: scale, phone position, whether the table photo crops differently, whether copy moves.
9. **Edge cases.** `prefers-reduced-motion` (emulate it), the "Skip" button (what it jumps to and how), the no-JS / `html[data-hero-pending]` fallback, and behaviour when you scroll back up fast.
10. **Visual record.** Screenshots at roughly 15 keyframes per breakpoint saved to `docs/landing-story/reference/`. Keep them out of the shipped bundle; they're for comparison only.

Write it all up in `once-analysis.md` as a precise spec someone could rebuild from without visiting the site.

## Phase 2: storyboard our version (output: `docs/landing-story/stills-storyboard.md`)

Map every once.film scene onto ours, keeping the same number of beats, scroll ranges and easing unless there's a reason to change one:

| once.film beat | Stills beat |
|---|---|
| Hero copy + CTA above a phone showing the iOS home screen | Same structure with our headline and CTA. Copy should come from the existing app / App Store listing; ask if there isn't any |
| Background: table card on a plate, brown linen | Background: **a canvas seating board on a wooden easel** at a reception entrance (soft evening light, florals, blurred venue behind). The board has a hand-drawn "Find your seat" illustration, the couple's names and a QR code |
| Camera app opens, viewfinder frames the card | Camera app opens, viewfinder frames the board |
| QR detected → reticle locks on → yellow pill "You're invited to the album!" | Same lock-on. Pill reads e.g. "Find your seat at Olivia & Daniel's" |
| Tap → App Clip card ("You're invited!") → loading | Tap → **our App Clip card** (we have one in `src/app-clip/`), same rise and loading treatment |
| Lands in their event camera | Lands in our **guest join + find-your-table** flow. Show the guest typing their name and getting their table, mirroring the real UI in `src/features/seating/find-your-table.tsx` and `src/features/celebrations/join/guest-join-screen.tsx` |
| Event camera: shutter tap, counter wheel, thumbnail develops | Then into our capture screen: shutter, shots-left counter, thumbnail. Match the real Stills camera UI |
| Album grid + "Create your event album" CTA | Our gallery + our CTA |

For every beat, list the elements, the property changes and the scroll range, using the Phase 1 numbers as the baseline.

**Assets to make (ours, not theirs):**
- **Board scene photo.** Shoot or generate a photo of an easel with a blank canvas board, matching once.film's framing and light so the phone overlay sits the same way. Render the board's contents (illustration, names, QR) as **HTML/SVG layered on top**, not baked into the photo, so the QR stays sharp, the reticle lines up exactly with it, and the names can change.
- **The QR code** should point at a real demo event join URL on stills.events, so anyone who scans the hero with their actual phone gets a working demo.
- **"Find your seat" illustration.** Original artwork. Put a placeholder in and flag it if we don't have one yet.
- **Phone frame.** Draw it in CSS/SVG; don't use their phone images.
- **App screens.** Real screenshots of our own app taken in the iOS simulator at 3x, or live HTML recreations of our screens if that animates better. Note which you chose for each.

Stop after Phase 2 and summarise the storyboard and asset list so a human can sign off before you build.

## Phase 3: build

- **Structure.** A tall section (same viewport multiple as once.film) holding a `position: sticky` stage. One scroll listener (or `ScrollTimeline` / `animation-timeline: view()` where supported, with a JS fallback for Safari) writes a single `--progress` CSS custom property plus a `data-scene` attribute on the root. All per-element motion is derived in CSS from those, via `calc()` and scene selectors. No per-frame React re-renders.
- **Animate only `transform`, `opacity`, `clip-path` and `filter`.** No layout properties per frame. Use `will-change` sparingly, only on elements that are currently moving.
- **Timer-driven beats** (the tap, the spinner, the shutter flash, the counter tick) fire once when their scene is entered and reset when you scroll back out.
- **Preload** each scene's images just before it's needed. The first frame must not wait on images from later scenes. Keep LCP on the hero headline.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, show a static, well-composed frame (the board with the QR lock-on and pill visible) plus the copy and CTA. No scroll-jacking.
- **Skip button**, same placement and behaviour as theirs.
- **No-JS / slow-JS fallback** that still shows the headline, CTA and a single still of the board.
- **Accessibility.** The headline and CTA are real text and come first in DOM order. The phone/board stage is `aria-hidden` with one descriptive `aria-label` on its container. Keyboard focus never lands inside the animation.
- Use the existing design tokens in `src/design` for colours, spacing and type wherever the story shows Stills UI.

## Verification (do this yourself, don't hand it back)

1. Record both sites at 375, 768 and 1440 widths, scrolling through at the same positions. Put the keyframes side by side in `docs/landing-story/comparison/` and check that timing, easing and composition match. List every place we deliberately differ.
2. Test in Safari (including iOS Safari in the simulator) as well as Chrome, since sticky positioning and scroll timelines differ there.
3. Scroll fast both ways, resize mid-story, and reload partway down. The story should never get stuck between scenes.
4. Run Lighthouse on the built web export (`npx expo export -p web`, then serve `dist`). Report LCP, CLS and total JS/image weight added.
5. Run the existing lint, typecheck and jest suites and confirm they pass.
6. Check the served bundle for the React Compiler issue above: scroll position and scene state must update correctly in the production export, not just in dev.

**Done means:** the homepage plays the board-scan story with motion that matches once.film beat for beat, all assets and code are original to us, reduced-motion and no-JS fallbacks work, there's no regression on mobile performance, and the comparison folder shows the match.
