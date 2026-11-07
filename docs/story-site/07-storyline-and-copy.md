# Storyline and copy

**Status: approved, built and live at stills.events.**

## The spine

Stills is new and nobody's heard of it, so the page says what it is first: a shared camera app for weddings and parties. Then it follows one guest through one night, and each scene names the feature plainly before anything clever: join, find your seat, shoot, challenges, guestbook, reveal, album.

## The rules I wrote to

1. **Say what it is.** A stranger should be able to repeat each headline back. Canva and Monday do this.
2. **Name the feature.** "A seating chart on every phone", not "Retire the easel".
3. **One idea per scene.** The headline makes the promise, the body adds the fact.
4. **Short.** At most two lines of body on any screen, and at most 90 characters.
5. **A little warmth.** Keep the human detail where it adds something: your mum in tears, your best friend at 1am.

## The copy

### 0. Hero

**The shared camera app for weddings and parties.**

Guests scan a QR code and start shooting. Every photo lands in one album.

*On phones the hero is centred, with no description, just the headline, the button and the mock.*

*Button: "Create your event →". Prompt: "Scroll to join the party" ("Swipe up to join the party" on touch screens).*

*Buttons, on desktop only: Weddings, Birthdays, Bach parties, Holidays. They change only when clicked. Phones have no buttons, so the mock slowly fades through the four parties by itself. Each brings its own setting and its own event on the phone, with the challenges from that party's pack in `challenge-packs.ts`.*

### 1. Join

**Guests join with one scan.**

No app download, no account, no password needed. They scan your QR code and they’re in.

*On the phone, the App Clip card: "You're invited", "Find your seat and grab the camera". Those words need checking against what's set in App Store Connect.*

*The yellow prompt in the viewfinder says "You're invited!" for the story. The real iOS camera shows the link's domain there, not words we choose.*

### 2. Seating

**A seating chart on every phone.**

No crowd round the easel. Guests scan, find their table and zoom into your floor plan.

### 3. Photos

**Every guest is your photographer.**

Your photographer can’t be everywhere. Your guests are, catching the moments you miss.

### 4. Challenges

**Photo challenges get everyone shooting.**

Set prompts like Happy Tears and Best Dressed, or pick a ready-made pack for your event.

### 5. Guestbook

**A guestbook you can actually hear.**

Guests leave private voice or video messages: your mum in tears, your best friend at 1am.

*A guest laughing and crying into her phone, from `guest-voice` in `prompts.mjs`, in a light only wide enough for her.*

### 6. Disposable

**Turn every phone into a disposable camera.**

Limited shots, and photos that develop overnight. Or reveal them live as guests snap.

### 7. Album, the story's close

**Your guests are already taking the photos.**

Get every photo, video and message in one album. All you need is a QR code.

*With a "Create your event →" button on desktop.*

### Linear page only

**Any party with more than one phone.** The four parties in a list, for reduced motion and no JavaScript.

### FAQs

**Good questions.** The seven in `FAQS` in `content.ts`, with the prices that used to have their own scene.

### Close

**It only happens once. Catch all of it.**

Create your event in the app, share your QR code, and let your guests do the rest.

*One very big "Create your event →" in the middle, which goes to the App Store, on the hero's terrace. Host sign in is in the footer.*

## Small print

- **Page title:** Stills: the shared camera app for weddings and parties
- **Description:** Guests scan a QR code and start shooting, with nothing to download.
  Every photo, video and voice note lands in one place.
- **Chapter menu:** Join, Seating, Photos, Challenges, Guestbook, Disposable, Album

## How the story could look

The art can carry the same arc: **sunset, then night, then sunrise**. Today's page goes
back to sunset at the end. Ending on sunrise makes the delayed reveal literal, because
scene 7 is the morning after.

| Scene | Picture |
|---|---|
| 0 Hero | The terrace at sunset, party in full swing, one host hugging someone with their back to it all |
| 1 Scan | Phone and invitation, with the uncle managing it |
| 2 Seat | Abandoned easel, floor plan on the phone, Ayla walking to her table |
| 3 Everyone | Night falls, flashes light the party, real photos appear |
| 4 Challenges | Challenge cards on the phone, one table on a mission |
| 5 Guestbook | Grandad talking into a phone, with a waveform |
| 6 Reveal | A live gallery filling up, then the counter running down, then the locked gallery |
| 7 Payoff | Sunrise, the empty terrace, the host in bed with the album |
| 8 Use cases | Three new drawings |
| Close | Back to the hero's view |

## Fact check

Checked against the code on 3 Nov 2026, not by using a live event.

| Claim | Source | Result |
|---|---|---|
| Guests install nothing, no account | `docs/app-clip.md`, `src/app/j/[slug].tsx` | App Clip on recent iPhones, browser elsewhere. **Not yet tried on Android** |
| Seating has no extra charge | `event-entitlements.ts` | Not a gated feature, so it's on every plan |
| Floor plan upload | `floorplan-file.ts`, `floorplan-viewer.tsx` | PNG, JPEG or PDF. Guests pinch to zoom, but it doesn't mark their table |
| Challenge names and packs | `challenge-packs.ts` | Real, and hosts can write their own. **Stills+ only** |
| Videos | `plan-catalogue.ts`, `camera.tsx` | Up to 30 seconds. **Stills+ only** |
| Audio guestbook | `camera.tsx`, `guestbook-screen.tsx` | Live, up to 60 seconds. **Stills+ only**. `FEATURE_FLAGS.audioGuestbook` says false, but nothing reads it |
| "Only you get to hear it" | `guestbook.tsx`, database rules | Guests can only fetch their own message |
| Disposable look | `photo-treatment.ts` | The app's own description |
| Limited roll | `stepped-slider-values.ts` | 5 to 36 shots. Copy avoids a number, because the paywall promises 20 per guest, which isn't a choice in the flow |
| Reveal on a chosen moment | `src/i18n/en-GB.ts` | When the event closes, or a custom day and time |
| Download the lot | `host-portal/downloads.ts` | From the web portal, as ZIP files |
| Locked cell wording | Event screen in the app | "Revealed in" and the lock are the app's own. "Unlocking…" is shortened from "Unlocking your photos…" |
| Prices | `plan-catalogue.ts` | £14.99, £29.99, £49.99, one-off per event. Catalogue can change, so check before launch |
| Use case list | `challenge-packs.ts` | A pack exists for each one named |

**Left out because they're switched off or don't exist yet:** recap videos, live
slideshow, memory book, written guestbook messages, host approval of photos, and the
Android host app.
