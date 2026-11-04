# Motion storyboard

**Stage:** one `position: sticky` stage inside a tall wrapper, driven by one
timeline. Timeline units (`u`) map to scroll at 0.2 viewport heights per unit, about
17 viewports in all. All values for the camera and phone come from layout functions
that differ by breakpoint.

**As built.** Times below are the desktop values from `choreography.ts`, which is the
source of truth; phone times run slightly later from the seat scene on. The copy is
in `07-storyline-and-copy.md`.

**World:** a single panorama, left to right: gate and welcome table, five dinner
tables in front of the villa, checkerboard dance floor under festoon lights, and
the head table. A "camera" pans and zooms this one drawing
for the whole page, so continuity is real rather than implied.

**Timing grammar:** a transition is short and carries no text. A dwell is long
and holds still. One thing moves at a time, and copy arrives last.

---

The day runs **sunset, then night, then sunrise**. The story ends on the parties, the
sticky stage lets go, and the rest of the page scrolls normally.

**Focus on desktop.** The terrace is wide and busy, so each scene pushes the camera in
on its subject and drops the rest of the room into shadow, using the night canvas with
one pool of light. `spot` in `choreography.ts` turns this on: it's off on phones, which
are close already, and on landscape phones, which have no room around the copy. Pushed
in, there's no empty sky behind the words, so a soft shade (`copyShade`) sits behind them.

## 0. Hero (0 u, plays on load)

Sky and logo are there from the first paint. Then the venue rises from the bottom
edge, then the headline and button, then the people left to right, then the clouds and
sun from behind the venue. The first scroll leaves straight away, even mid-opening.
**Button:** "Create your event →". Once you scroll, a smaller one stays in the header.

**The prompt to scroll.** A band along the bottom edge: "Scroll to join the party" ("Swipe
up" on touch screens) and a white arrow, which goes to the App Clip card when clicked.
About a second after the opening finishes, if nobody has scrolled, the whole page lifts
and drops, four times over 17 seconds, then rests. The first scroll stops it for good.

## 1. Scan (0–6.5 u)

Camera moves to the gate and the room falls into shadow. The invitation lifts off the
welcome table and is held up beside the phone, then **moves behind the phone, appearing in
its viewfinder as it goes**: the same card in the same place at the same size, as if seen
through the phone, so it's obvious what's being scanned. Corners lock on → yellow pill → tap
→ the **App Clip card** rises over the blurred camera ("You're invited", "Find your seat
and grab the camera", Open, "App Clip · Stills") → tap Open, spinner → real **join screen**.

## 2. Seat (6.5–19.6 u)

A seating chart on an easel rises in the only light in the room. As soon as "Retire the
easel" is up, **the easel is thrown out of the frame**, and the light moves to Table 7.
Only then does the phone start: the **Find your table** sheet, "Ayl", rows, tap, seat card.

The moment "Table 7" appears, the room starts too. A pink line leaves those words, leaves
the phone, reaches the sign on the table and lets go of the phone, and Ayla walks to it with
the light following her. **At the same time**, the phone swipes left to the **floor plan**,
with the toggle following, two fingers pinch in on table 7, and it swipes back. On phones
the phone has to slide low to show the walk, so the floor plan comes straight after it.

## 3. Shoot (19–28 u)

Ayla's at her table, so that's the job done. There's no join tap, no viewfinder and no
shrinking: **the phone slides off to the right** and the camera slides across to the whole
terrace. The sun drops behind the villa, the sky goes violet and the festoon lights glow.
Then along the terrace, left to right, one moment at a time: each flash opens a pool in
the night and a real photo drifts up above its moment, clearing for the next. On desktop
the last moment sinks back as the next is lit, and the camera pulls back at the end to see
the whole party. Night is one canvas multiplied over the scene, with a soft hole per pool.

## 4. Dare (28–37 u)

Phone back up from below, onto the event page with its **challenge strip**. The camera pushes in on a
group of guests rising, lit, going to absurd lengths. Tap a tile: the real challenge story
(**Happy Tears**, **Best Dressed**, **Caught in the Act**, word for word), "Add Yours",
camera, shutter. Each photo stacks up beside the phone with its challenge as a caption.

## 5. Messages (36–41 u)

Straight from the dare to the **Guestbook**. The camera pushes in on Grandad, lit, and the
phone records him: the bars of a voice message scrolling and the timer running from 1:00.
There's no video on screen, because it muddied the idea. The copy says guests can leave
audio or video.

## 6. Reveal (41–58 u)

**Watch it live.** The room fades back. The phone lands on the event page, with its grid
filling photo by photo.

**Or make them wait.** The second half of the headline arrives. Everything but the phone
all but disappears and the phone moves to a fresh camera, while the page pushes in on the
remaining-shots pill, the same idea as the app's "How many photos can guests take?" step.
The viewfinder falls to monochrome and every other control fades, so the number is all
that's left. The counter is the app's own: `viewfinder-shot-counter.tsx`, Isolde numerals
in a dark pill, grown in the phone's own pixels so it stays sharp. It **rolls up from 0 to
24 when the camera opens, then runs down to 0**, slowly and then faster and faster. The
flashes die away after the first few, so it never strobes.

**The wait.** Back out to the whole phone, on the event page as the app shows it before a
reveal: every photo blurred, with a lock and "Revealed in 8h 12m", counting down. The
stat reads "Ended" and the floating button becomes "Save". Scroll back and it all winds
back.

## 7. Album (58–71 u)

The sky turns to dawn and the sun rises **on the far side of the villa from where it set**.
Everyone slides away home, leaving last night's couple on the terrace. When the count
reaches "Unlocking…", the phone moves to the centre and **each slot reveals its photo, one
at a time**. Then "Here's everything you missed": on desktop the phone goes back to the
right and the camera eases in a little with the couple on the left, as close as it can get
with the villa still below the words, in full daylight with no spotlight, as three photos lift out with notes. A phone's screen would cover the couple,
so they only appear on desktop.

The swirl of photos that used to lead into this is parked, not deleted. `SWIRL` in
`content.ts` turns it back on. It would need the cell reveal moving out of its way.

## 8. Parties (71–80 u)

The camera tilts up off the terrace into the morning sky. **Three tabs: Birthdays, Bach
parties, Holidays.** Each has its own whole setting rising in behind, its own line of
copy and its own event on the phone. Scrolling moves through them by itself; picking a
tab holds it until you leave the scene. Arrow keys work, as tabs should.

All three tabs have real photos on their phones, in `USE_CASES` in `content.ts`. The rows
below the phone's edge are placeholder tiles, which nobody can scroll to.

## After the story

Ordinary scrolling, the same in every mode: **Good questions** (seven FAQs in native
`<details>`), then **It only happens once. Catch all of it.** over the terrace at sunset,
with "Create your event →" and a QR code on desktop, then the footer. Over these, the
fixed header gets a solid background.

---

## Accessibility and fallback

- **Reduced motion or no JS:** a linear page of nine captioned sections, then the FAQs and close, each with a
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

## The opening and the hero (Nov 2026)

The hero has the phone on screen from the start, open on the chosen party's event. Scrolling fades back to the wedding terrace whichever chip was showing, closes the event into its icon on the home screen, taps Camera, and carries on into the QR scan. The story now ends on the album, and the page scrolls on to the FAQs.

On desktop, a thin line across the foot of the page has a small break for each section. It fills as you scroll. The sections' names appear on hover, and each one jumps to its section.

The story was cut to about 43 units from about 72 after testing with a mouse wheel, and desktop now uses less scroll per unit than touch. Seating skips the typing and doesn't return to the seat tab. Challenges dim the phone around the strip before the tap, and run two dares rather than three. The live gallery is gone, the counter and locked gallery are shorter, and the album's flying photos are gone.
