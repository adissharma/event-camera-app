# Motion storyboard

**Stage:** one `position: sticky` stage inside a tall wrapper, driven by one
timeline. Timeline units (`u`) map to scroll at 0.24 viewport heights per unit,
about 18 viewports in all. All values for the camera and phone come from layout
functions that differ by breakpoint.

**As built.** Times below are the desktop values from `choreography.ts`, which is
the source of truth; phone times shift slightly later from S4 on. Differences from
the first plan are noted in each scene.

**World:** a single panorama, left to right: entrance with the welcome table and
seating board, dinner tables with numbered signs, dance floor under festoon
lights, and the head table and cake. A "camera" pans and zooms this one drawing
for the whole page, so continuity is real rather than implied.

**Timing grammar:** a transition is short and carries no text. A dwell is long
and holds still. One thing moves at a time, and copy arrives last.

---

## S1. Every great event has a thousand stories (0–12.5 u)

- **A. Purpose.** Feel the room. Understand no one camera can see all of it.
- **B. Start.** Dark room, wide. On load, festoon bulbs come on left to right
  (timer), line art fades up back to front. H1 at top left.
- **C. Assets.** Panorama, bulbs (SVG), dad, hug, aunt, waiter, kid and dog,
  sing-along, photographer.
- **D. Phone.** None. The room has to be felt before any product appears.
- **E. Choreography.** Ambient life first. Camera pushes to the waiter → dad →
  hug. At each stop a small Isolde italic note writes itself beside the figure.
  Camera pulls back wide. At the head table, a single flash: one pool of light,
  the photographer and couple flip positive.
- **F. Scroll.** Scrubbed. Dwells at each vignette.
- **G. Transition.** Everything except that single pool stays dark. It's the
  setup for the rest of the page.
- **H. Copy.** "Every great event has a thousand stories." → "One photographer
  can only be in one place." → "The rest happens in the dark."
- **I. Tech.** Camera transform on world layer, canvas light mask, figure
  crossfade.
- **J. Mobile.** Camera frames one figure at a time on a tighter zoom. Notes sit
  above the figure.

## S2. One little QR code (12.5–19 u)

- **A.** Joining takes one scan, with no app or account.
- **B.** Dark room. A paper invitation lifts off the welcome table and grows.
- **C.** Invitation (HTML/SVG), real QR, phone, iOS camera overlay, join screen.
- **D.** iOS camera → yellow URL pill → real **GuestJoinScreen** (classic cover).
- **E.** Camera pans to entrance; invitation rises, turns to face us, and scales
  (same move in reverse later for the seat line). Phone rises from the bottom.
  Live viewfinder shows the card. Corners lock on, the pill slides in, tap dot,
  screen wipes to join screen.
- **F.** Pin continues; state changes step on scroll.
- **G.** Invitation drops away as the phone takes the frame. The phone stays.
- **H.** "One scan. You're in." / "No app. No account. Point a phone at the QR code on the invitation."
- **I.** Phone screens are stacked HTML layers. The viewfinder is a second copy of
  the invitation, moved in sync.
- **J.** Invitation sits top, phone cropped along the bottom.

## S3. Find your place (19–29 u)

- **A.** Seating is a delightful bonus: it's optional, and the copy says so.
- **B.** Join screen on phone; room visible behind.
- **C.** Find-your-table sheet, floor of tables, Ayla, gold path (SVG).
- **D.** Tap name field → **Find your table** sheet → types "Ayl" → rows "Ayla
  Brooks · Table 7", "Aylin Park · Table 2" → tap → seat card "You're seated at /
  Table 7".
- **E.** Sheet rises. Letters type in. Row is tapped. Seat card arrives. A
  champagne line leaves the words "Table 7", exits the phone, and draws through
  the room to the Table 7 sign. Camera pans along it. Pool of light opens at Table
  7. Ayla walks the line and sits with friends.
- **F.** Line length and walking are scrubbed.
- **G.** Ayla reaches the table, takes out her phone. Screen tap: Join the event.
- **H.** "Find your seat. Join the fun." / "If your host adds a seating plan."
- **I.** `stroke-dashoffset`, walking pose swap on path progress.
- **J.** Line runs up from the phone instead of across.

## S4. Everyone has a camera (29–37.6 u)

- **A.** Many perspectives. The room starts to light.
- **B.** Phone shrinks into Ayla's hand in the room. It's now a small object in
  the drawing, which is the page's key piece of continuity.
- **C.** Shooters, flash stars (SVG), real photos.
- **D.** Small, Ayla's. No readable UI.
- **E.** Camera pulls wide. A rhythm of flashes, one by one and accelerating:
  shooter flips positive, pool opens, a real photo pops from their phone and
  drifts up. Each photo lands in the air above its moment.
- **F.** Flash onset is a sharp scrub, 0.15 u. If you scroll quickly, they fire
  together.
- **G.** Room about 40% lit. The stage's light level rises.
- **H.** "Now everyone has a camera." / "The best moments happen everywhere."
- **I.** Canvas light mask (circle list), photos on GPU layers.
- **J.** Camera pans across 3 shooters rather than holding wide.

## S5. The joy of the disposable camera (37.6–45.2 u)

- **A.** The camera itself should look irresistible.
- **B.** Camera dives past the photos; Ayla's phone comes up to fill the frame.
- **C.** Camera UI (HTML), real photo in viewfinder, shutter, white flash.
- **D.** Real camera screen: close button, title, "2d 4h left", viewfinder radius
  28, counter pill, zoom pill, flash, flip, 76 px shutter, QR, thumbnail.
- **E.** Three shots, each: shutter dips → full-stage white flash → viewfinder
  freezes → print leaves the phone with grain and date stamp, lands at the side →
  counter rolls 20→19→18→17 → thumbnail updates. Viewfinder moves to next moment.
- **F.** Scrubbed; flash peaks at the exact shutter moment.
- **G.** Prints stay on stage for S6.
- **H.** "Less posing. More living." / "A set number of shots. Direct flash, a
  little grain and a printed date stamp, if your host picks the Disposable look."
- **I.** Baked prints as WebP. Counter as a vertical strip.
- **J.** Phone larger, headline shortened to fit; prints land above it.

## S6. A thousand perspectives. One story. (45.2–57 u): **the set piece**

- **A.** Separate moments become one thing.
- **B.** Prints at the side, phone centre, dark room behind.
- **C.** About 28 photo instances, from all library images.
- **D.** Phone stays, its screen goes to gallery background.
- **E.** Three movements:
  1. **Arrive:** photos stream in from where the figures stand, at different
     depths, with rotation. Some pass in front of the phone, large and blurred.
  2. **Swirl:** they slow into a loose ring as all pools expand and merge. The
     whole room develops, and the stage crosses from ink to ivory.
  3. **Settle:** rotation drains; photos resolve into a two-column grid. The grid
     shrinks into the phone's gallery. Hand-off to the real gallery UI happens
     under the final positions, so there's no visible cut.
- **F.** Longest scrub on the page, no dwell until the end.
- **G.** Ends on the lit room, phone, gallery.
- **H.** "Everyone sees something different." → "Together, you get the whole
  story." Ink type on ivory.
- **I.** Computed curves per photo. `will-change: transform` only while in range.
- **J.** Same photos, ring squeezed tall and narrow.

## S7. Relive the moments (57–66 u)

- **A.** The album's lasting value. Motion calms.
- **B.** Lit room in the background, softly. Phone with gallery.
- **C.** Real event page UI: title, stat strip, tabs, grid. The Prompts row is left
  out to give the photos more room.
- **D.** Event page; grid scrolls slowly; photo tapped and enlarges past the phone.
- **E.** Three photos in turn lift out of the grid to full size beside the phone,
  each with a note. "Table 4, all through the speeches." "You were at the bar for
  this one." "Best guest of the night."
- **F.** Long dwells, slow scrub.
- **G.** Photos return to grid. Camera begins to pull out.
- **H.** "The moments you missed. The memories you'll keep." / "Every guest's
  photos in one shared gallery. You choose when it opens."
- **I.** Phone grid scroll, simple transforms.
- **J.** Photos overlay the phone's top half.

## S8. Make your next event unforgettable (66–71.5 u)

- **A.** Act. The story is complete.
- **B.** Camera pulls back to the same frame as S1, now completely lit, with every
  figure positive.
- **C.** Whole cast, bulbs. Phone sets down at the right.
- **D.** Event page.
- **E.** Headline and buttons arrive after the camera stops. Ambient life
  resumes, confetti of a few photos at rest in the room.
- **F.** Stage releases; normal scroll into footer.
- **H.** "Every moment deserves a place." / "Create a shared camera for your next
  wedding, party or celebration." **Primary:** Download on the App Store.
  **Secondary:** Host sign in. Desktop adds a real QR code to the App Store.
- **J.** Buttons full-width; QR hidden, since you're on the phone already.

---

## Accessibility and fallback

- **Reduced motion or no JS:** a linear page of ten captioned sections, each with a
  composed still (`/story/poster/*.webp`), real copy, and alt text. No sticky stage.
- **Real text:** chapter copy is real DOM in reading order, in both modes.
- **Keyboard:** native scroll, chapter buttons, a "Skip the story" link. Focus
  never lands in the phone.
- **Screen readers:** illustration and phone are hidden, with a text description
  per scene.

## Motion rules

From `docs/marketing-motion-spec.md`: `transform` and `opacity` only, one rAF
loop, no scroll-jacking. The one exception is the light mask, drawn on a canvas
only when it changes. Camera and copy scrub with a short smoothing behind scroll.
