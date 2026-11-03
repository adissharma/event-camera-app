# FlyCrooked: reference analysis

Inspected 2 Nov 2026, using headless Chrome driven by a script. It captured 49
evenly spaced scroll positions at 1440×900 and at 390×844, four intermediate
states between every pair of timeline labels at 1280×800, the timer-driven
intro, and a reduced-motion context. The page's `story.js` and `story.css` were
read for analysis only. Nothing from them ships in Stills.

Contact sheets are in `reference/`, kept local and out of git because they're
screenshots of someone else's site: `d1–d3` desktop top to bottom, `m` mobile, `t`
between-label transitions, `i` the intro.

## What I could and couldn't observe

| Evidence | Status |
|---|---|
| Libraries, timeline length, labels, pin range | **Measured**, read from the running page (`window.__crowTL`, `ScrollTrigger.getAll()`) |
| Scene order, composition, phone behaviour, mobile layout | **Observed** in screenshots |
| Wheel/touch stepping between labels | **Read from source**. Headless capture used `scrollTo`, so the feel of the stepping wasn't experienced |
| Felt smoothness and frame rate | **Not observed**. Headless rendering used a software GPU |
| Sound | None found |
| Cookie banner | Left unanswered, so it appears in the captures |
| Interaction with real touch hardware | **Not observed** |

The source also holds a large parked Lisbon/Kyoto chapter behind `if(!TOUR.on)`.
It doesn't run today, so everything below describes what actually plays.

## Technology

**Identified:**

- GSAP 3.12.5 and ScrollTrigger: one timeline, one pin, `scrub: 1`.
- d3-array and d3-geo, for the closing globe.
- 106 inline SVGs, 9 canvases (WebGL2 frame border, rain, globe), 80 images,
  mostly WebP plates with `-m` mobile variants.
- A Next.js shell that serves the story as a standalone `/story-v10/story.js`
  (480 KB) and `story.css` (140 KB).

**Not present:** Lottie, video, Three.js, image sequences.

**Inferred:** the plates look like AI-assisted or heavily processed ink artwork,
since they share one engraving treatment. The source doesn't confirm how they
were made.

### The structure

| Measure | Value |
|---|---|
| Pinned element | one `#stage` section, `height: 100vh` |
| Pin length at 1440×900 | 0 → 15,480 px, about 17.2 viewports |
| Pin length at 390×844 | 0 → 14,517 px, about 17.2 viewports |
| Timeline duration | 40 units, about 0.43 vh of scroll per unit |
| Scene labels | 21: `c0 c1a c1 c1s1…c1s5 c4 c4s1…c4s3 c7 c7s1 c7s2 c10 c10s1…c10s3 c11 c12` |
| Default ease | `power2.inOut` |

**The page is one stage with one master clock.** It has no sections in the
conventional sense. That single decision is why nothing ever jumps: there are no
boundaries between scenes for anything to jump across.

**Scrolling is stepped.** Wheel, touch and keyboard input advance to the next
label in a timed tween (`stepTo`), with slower durations for the big transitions.
Each label is a resting frame. Dragging the scrollbar settles on the next scene
after 350 ms. On resize, the story is rebuilt and returned to the nearest label.

## Scene breakdown

| # | Time | Message | Carrying image | What moves | Copy | Exit |
|---|---|---|---|---|---|---|
| Intro | timer | "This isn't a travel app ad" | Kyoto and Fuji ink plate on pink | Pagoda rises from the bottom edge, rays burst behind a white sun, the headline lands, marker notes scribble on | 2 words + 1 sentence | Phone rises, rays spin up |
| Marrakech | 0.9–12.6 | "Just say where" → days built, tripwires, real cost, today | Minaret plate, palm and lantern corners | Phone stays still while **its screen changes**; dark cards pop out wider than the phone | 3-word city headline, 3-word sub-head, 1 sentence | Double exposure into London |
| London | 12.6–20 | "Not Heathrow" → fare watch, Lock Screen, last mile | Big Ben, Eye, Thames | Eye turns, boat crosses, green Live Activity card | Same pattern | Plate cross-dissolves; Eiffel appears through Big Ben |
| Paris | 20–25.5 | "Closed Tuesdays" → plans fix themselves, weather, menu | Eiffel, awning, rain, umbrellas | Rain strengthens with scroll, letters are visibly damaged | Same pattern | Pink drains, night comes in |
| New York | 25.5–35.4 | "Skip Times Square" → free Saturday, near me, walk there, notes | Skyline, pink lit windows | Headline flickers on like neon, windows blink, mascot appears on screen | Same pattern | Phone exits, headline dims, camera pushes into a lit window until it **fills the frame with pink** |
| Finale | 35.4–40 | "Next time, it already knows" | Engraved globe with the trip route drawn on it | Globe rises and turns, phone ghosts through and resolves | 2-line headline, price line, App Store | Normal scrolling into footer |

Each of those is a dwell-heavy chapter: the stage holds still while the phone
does the talking, then one short, bold transition moves on.

## Storytelling devices

1. **A recurring protagonist with a point of view.** Crow is the mascot, the
   narrator of the marker notes and the voice of the copy.
2. **One journey.** Marrakech to New York to home is one trip. The route on the
   closing globe literally collects every earlier scene, so the ending pays off
   the whole page.
3. **Each headline is a joke set in the place.** "Not Heathrow" under Big Ben,
   "Closed Tuesdays" with damaged lettering. The illustration and the claim are
   the same idea.
4. **Three levels of reading.** Big claim, then small feature label, then one
   sentence. You can stop at any level and still follow.
5. **Colour as an event.** Pink is the world until it drains away for New York,
   where it returns only in lit windows and finally swallows the frame. The same
   colour changes meaning.

## Illustration system

| Trait | How it works |
|---|---|
| Medium | Black engraving or woodcut plate, white highlights, on one flat spot colour |
| Consistency | Every plate shares a palette and a mark, so very different cities feel like one book |
| Detail | Very dense in the plate, but contained in the lower third, so the sky stays empty for type |
| Depth | Layers (far, mid, near, corner foliage) moving at different rates. The "corner vignette" of palm or awning frames each scene |
| People | Rare and tiny. The world is architecture, so character comes from the mascot and copy, not figures |
| Screen sizes | Separate `-m` plates. Mobile crops to a landmark and uses the sky for type |

## Motion vocabulary

- **Master scrub:** smoothed one second behind scroll.
- **Pin:** one, for the whole story.
- **Print-in:** layers rising back to front on `power2/3.out`.
- **Double exposure:** a short cross-dissolve where the next landmark appears
  inside the current one. Used because two plates share a horizon and palette.
- **Fly-through:** the window and sun transitions scale an object until its colour
  fills the frame, turning it into the next scene's background.
- **Pop-out card:** `back.out` scale from the phone, wider than the phone,
  beside the part of the screen it describes.
- **Text beats:** letter-by-letter neon flicker, plus a fast fade and lift on
  chapter changes.
- **Ambient loops:** small motion once a scene has arrived (boat, ripples,
  windows, gusts). These run on time, not scroll, so a paused page still breathes.
- **Pointer parallax:** on fine pointers only.

**Choreography.** Plate moves first, then headline, then phone, then card. Only
one thing asks for attention at a time. Transitions are short and hold no text,
while dwell frames are long and hold still. That contrast is where the sense of
pace comes from.

## Product integration

- A single 3D-lit phone stays at a fixed spot for the whole story. Scenes change
  around it, which makes it the anchor of the page.
- Screens are **live HTML rebuilt in the page, not screenshots**, so they can
  change state, scroll their contents up and hand off to cards.
- Cards break out of the phone's frame, so the product joins the page composition.
- On desktop the phone stands at right, rising from the bottom edge. On mobile
  only the top of the phone shows, rising below the headline. It's cropped, not
  shrunk, so the text inside stays readable.

## Mobile

The same timeline length and the same scenes, with a recomposed layout:
headline and copy stack at top, landmark behind, phone cropped along the bottom.
Corner foliage and side marker notes go away. No separate mobile story exists.

## Reduced motion

The pin stays and a scrub remains. `stepTo` durations collapse to 0.01 s, so
steps become cuts. It's a cuts version of the same story, not a linear page.

## Principles to adapt

Adopt the thinking, not the look.

| Principle | Adapted to Stills |
|---|---|
| One stage, one clock | Yes. Sticky stage and a single timeline |
| A world that ends by collecting the whole journey | Yes. The room lit by everyone's flashes, and the gallery of everything shot |
| One colour whose meaning changes | Yes, but light rather than pink: flash is the colour event |
| Headlines that are ideas in the scene | Yes, set in the room and answered by what's happening there |
| Phone as fixed anchor with live, changing UI | Yes, and it goes further: the phone leaves the anchor to become a guest's phone in the room |
| Dwell, then one bold transition | Yes |
| Cards leaving the phone | Yes. The seat card's line leaves the phone and reaches the table; photos leave the phone |
| Ambient life after arrival | Yes |

## What not to take

- Hot pink, engraved plates, per-city display fonts, mascot, marker-note voice.
- GSAP: the timeline here is simple enough to own, and
  [`docs/marketing-motion-spec.md`](../marketing-motion-spec.md) says no animation
  library unless it earns its bytes.
- **Wheel hijacking.** It's what gives FlyCrooked its controlled pacing, but the
  same spec forbids a scroll-jacking handler, and native scroll is kinder to
  trackpads, assistive tech and scrollbar users. Stills paces through long dwell
  plateaus in the timeline instead.
- The reduced-motion approach. Stills gives a real linear page.
