# Motion storyboard

**Stage:** one `position: sticky` stage inside a tall wrapper, driven by one
timeline. Timeline units (`u`) map to scroll at 0.24 viewport heights per unit,
about 14 viewports in all. All values for the camera and phone come from layout
functions that differ by breakpoint.

**As built.** Times below are the desktop values from `choreography.ts`, which is
the source of truth; phone times shift slightly later from S4 on. Differences from
the first plan are noted in each scene.

**World:** a single panorama, left to right: gate and welcome table, five dinner
tables in front of the villa, checkerboard dance floor under festoon lights, and
the head table. A "camera" pans and zooms this one drawing
for the whole page, so continuity is real rather than implied.

**Timing grammar:** a transition is short and carries no text. A dwell is long
and holds still. One thing moves at a time, and copy arrives last.

---

## S1. Every great event has a thousand stories (0 u)

- **A. Purpose.** Impact: the sunset, the villa and the party in one frame.
- **B. Start.** Plays on load, on a timer rather than scroll, one layer at a time.
  The sky and logo are there from the first paint.
- **C. Assets.** Sky gradient, clouds, sun, venue, all the guests, festoon lights.
- **D. Phone.** None, for this one frame only.
- **E. Choreography.** The venue rises from the bottom edge (about 0.1 s after
  loading), then the people, left to right (0.7 s), then the clouds and sun, from
  behind the venue (1.5 s), then the headline and the rest of the header (2.3 s). Each
  step waits for its art, except that the words wait at most 4.5 s from when the script starts. A reload
  partway down the page skips all of it, and the first scroll leaves straight away,
  even mid-opening.
- **H. Copy.** "Every great event has a thousand stories."
- **J. Mobile.** Frames the villa's edge, the sun and the dance floor.

## S2. One scan (0–4.6 u)

- **A.** Joining takes one scan, with no app or account. **This is the first thing
  the scroll shows**, and the copy arrives as the phone does.
- **B.** The headline leaves; the camera moves to the gate.
- **C.** Invitation (HTML/SVG), real QR, phone, iOS camera overlay, join screen.
- **D.** iOS camera → yellow URL pill → real **GuestJoinScreen** (classic cover).
- **E.** The invitation lifts off the welcome table as the phone rises. Viewfinder
  moves onto the card, corners lock, pill slides in, tap, screen wipes to join.
- **F.** Scrubbed; state changes step on scroll.
- **G.** The invitation drops away and the phone stays.
- **H.** "No app needed" / "One scan. You're in." / "No download. No account. Just
  point your phone at the QR code on the invitation."
- **I.** Phone screens are stacked HTML layers. The viewfinder is a second copy of
  the invitation, moved in sync.
- **J.** The invitation sits between the copy and the phone, tucked behind it.

## S3. Find your place (4.6–14.6 u)

- **A.** Seating is a delightful bonus: it's optional, and the copy says so.
- **B.** Join screen on phone; terrace visible behind, still at sunset.
- **C.** Find-your-table sheet, tables, Ayla, pink line (SVG).
- **D.** Tap name field → **Find your table** sheet → types "Ayl" → rows "Ayla
  Brooks · Table 7", "Aylin Park · Table 2" → tap → seat card "You're seated at /
  Table 7".
- **E.** Sheet rises. Letters type in. Row is tapped. Seat card arrives. A pink line
  leaves the words "Table 7", exits the phone, and reaches a sign on the table.
  Ayla walks across the terrace to it.
- **F.** Line length and walking are scrubbed.
- **G.** Ayla takes out her phone. Screen tap: Join the event.
- **H.** "Find your seat. Join the fun." / "If your host adds a seating plan."
- **I.** `stroke-dashoffset`, walking pose swap on path progress.
- **J.** Line runs up from the phone instead of across.

## S4. Everyone has a camera (14.6–22.6 u)

- **A.** Many perspectives. Night falls, and the guests light it back up.
- **B.** Phone shrinks into Ayla's hand. It's now a small object in the drawing.
- **C.** Shooters, flash stars, real photos, night layer.
- **D.** Small, Ayla's. No readable UI.
- **E.** Camera pulls wide. The sun drops behind the villa, the sky goes violet and
  the festoon lights start to glow. Then five flashes, one by one and accelerating:
  a pool opens and a real photo drifts up above its moment.
- **F.** If you scroll quickly, the flashes fire together.
- **G.** Most of the terrace is still dark.
- **H.** "Now everyone has a camera." / "The best moments happen everywhere."
- **I.** One canvas multiplied over the scene, with a hole per pool.
- **J.** Camera pans between moments rather than holding wide.

## S5. The joy of the disposable camera (37.6–45.2 u)

- **A.** The camera itself should look irresistible.
- **B.** Ayla's phone comes up to fill the frame.
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
  2. **Swirl:** they slow into a loose ring as all the pools expand and merge. The
     sun rises again and the sunset returns.
  3. **Settle:** rotation drains; photos resolve into a two-column grid. The grid
     shrinks into the phone's gallery. Hand-off to the real gallery UI happens
     under the final positions, so there's no visible cut.
- **F.** Longest scrub on the page, no dwell until the end.
- **G.** Ends on the lit room, phone, gallery.
- **H.** "Everyone sees something different." → "Together, you get the whole
  story."
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
- **B.** Camera pulls back to the same frame as S1.
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

- **Reduced motion or no JS:** a linear page of nine captioned sections, each with a
  composed still (`/story/poster/*.webp`), real copy, and alt text. No sticky stage.
- **Real text:** chapter copy is real DOM in reading order, in both modes.
- **Keyboard:** native scroll, chapter buttons, a "Skip the story" link. Focus
  never lands in the phone.
- **Screen readers:** illustration and phone are hidden, with a text description
  per scene.

## Motion rules

From `docs/marketing-motion-spec.md`: `transform` and `opacity` only, one rAF
loop, no scroll-jacking. The one exception is the night layer, drawn on a canvas
only when it changes. Camera and copy scrub with a short smoothing behind scroll.
