# Motion storyboard

**Stage:** one `position: sticky` stage inside a tall wrapper, driven by one
timeline. Timeline units (`u`) map to scroll at 0.24 viewport heights per unit on touch and
0.16 with a mouse, about 38 u and 9 viewports in all on touch. All values for the camera and phone
come from layout functions that differ by breakpoint.

**As built.** Times below are from `choreography.ts`, which is the source of truth. Phones
run a little differently where noted. The copy is in `07-storyline-and-copy.md`.

**World:** a single panorama, left to right: gate and welcome table, five dinner
tables in front of the villa, checkerboard dance floor under festoon lights, and
the head table.

**Timing grammar: every section opens the same way.** The page used to read as one long
shot, with nothing to say a new section had started. Now the opening itself is the signal, and
the scene never leaves:

1. **Pull back into the dark.** The phone goes, the camera pulls back to the whole terrace, the
   hero's view, and the room falls into shadow. The new headline arrives over it.
2. **A light finds the subject.** A spotlight opens on whoever the section's about: the crowd at
   the easel, the dare crew, the guest with her message. Photos is the exception, where the
   whole party lights up flash by flash.
3. **In on the subject.** The camera zooms and pans to them, and the phone comes up as it arrives.
4. **One proof, then a rest.** The one thing that proves the headline, then everything stops for
   at least half a unit before the next section.

**One cast, there all night.** Everyone is on the terrace from the hero onwards, laid out left
to right so no two drawings overlap: the girl with the dog, the auntie, the guest with the
message, the bride and her mother, the crowd at the easel, Ayla, the dare crew, the singalong,
the dancing dad and the cake. Nobody comes or goes: the light and the camera pick out whoever
each section is about. The only exceptions are the crowd bursting into the QR easel, and the
morning, when everyone's gone home and the couple are left.

**The venue sits back.** The terrace drawing has its finest carving smoothed away and its two
tones softened a touch, towards ink-violet and warm paper (`ROOM_*` in `process-art.mjs`), so
the people in pure black and white stand clear of the floor behind them.

Time of day moves under the words: the sky goes dark as "Every guest is your photographer"
arrives, and comes up to morning under the album's. Progress is a thin segmented bar along the
foot, with labels on hover on desktop. The clouds no longer follow the
camera, since they're all that's showing at step 1.

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

Every section below opens with the steps above. These are what comes after, with the unit
each one's words arrive at.

## 1. Join (0.3 u)

The one section that doesn't open on the sky, because the hero's scene is already showing and
moves on smoothly: the event on the phone closes up to the home screen as the first scroll starts,
the phone fades, and the words change over the terrace. In on the gate. The phone comes up on its home screen with the invitation beside
it, or above it on a phone. Tap Camera → it opens → **the invitation moves behind the phone,
appearing in its viewfinder as it goes**: the same card in the same place at the same size, as if
seen through the phone, so it's obvious what's being scanned. Corners lock on, yellow pill → the
**App Clip card** rises → tap Open → the real **join screen**. Rest.

## 2. Seating (about 5.5 u)

The problem first: in on a crowd of baffled guests jammed round the paper seating chart on its
easel. Then the chart becomes one big QR code and the crowd is gone. The phone comes up with
Ayla's seat card, swipes to the floor plan and pinches in on table 7. Rest.

## 3. Photos (about 13 u)

Night falls under the words. The party's the subject, so desktop stays on the whole terrace and a
phone moves along to the far end of it. Flashes go off across it, five on desktop and three on a
phone, each leaving a photo above the moment it caught. **The photos stay**, so the scene ends on
the party and its pictures together. Rest.

## 4. Challenges (about 18 u)

In on the crew, in the light. The event page comes up with the row of challenges lit and the rest
dimmed. Tap → Happy Tears → Add Yours → the camera → one shutter, one flash, and the photo comes
out of the phone with its dare. Then the same again, quicker to follow, for Best Dressed. Rest.

## 5. Guestbook (about 23.5 u)

In on one guest, laughing and teary into her phone, in a light only wide enough for her. The
recording screen comes up, and the only thing moving is the waveform and its timer.

## 6. Disposable, and the morning after (about 28 u)

The story's last section. A disposable is two things together, the limited roll and the wait
while it develops, so both are here. The room falls away as the phone comes up on the camera,
in black and white, at 24. The push in on the counter, and it runs down to 0, slowly and then
quickly, with the flashes dying away early so it never strobes. The phone pulls back to the
locked gallery. Then the sun comes up: the sky lightens to morning, every guest has gone home,
and on desktop it's just the couple on the empty terrace with their phone. The photos develop,
coming out of their locks one at a time, and the story holds there.

The album slide that used to follow is now only on the linear page.

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

## Short laptop screens

Between 521px and 759px tall on desktop, the type and logo follow the height as well as the width, the hero drops to its headline and button with the occasions rotating by themselves, and the camera holds on the whole scene instead of pushing in. The spotlights do the pointing, the roofline stays below the words, and the QR card and photos start under the copy.

## One scroll, one slide

One scroll, swipe or key press plays a whole slide at its own pace and stops at the moment the next slide would take over. Scrolling again while it plays hurries it to the end, and scrolling back returns to the previous stop in 0.3 seconds, one stop per gesture. The last slide runs 1.3× faster. After the last stop the page scrolls normally into the FAQs. With reduced motion on, the story keeps following the scroll position instead.

A second after a slide finishes, a glowing line teases the next one ("Keep scrolling, your table's waiting"), and clicking it moves on. Going back recognises each new flick, even during the last one's momentum.
