# Storyline and copy

**Status: approved, built and live at stills.events.**

## The spine

The buyer is the host, and the one thing only the host feels is this: **they will
miss most of their own party.** They'll be hugging an aunt while the best thing of the
night happens behind them.

So the page opens on that fear and closes it:

> You'll miss most of your own party. → Here's everything you missed.

Everything between is why that's now easy. The order follows one guest through one
night: arrive, sit down, shoot, get dared, leave a message, go home, and then the
morning after.

## The rules I wrote to

Taken from Honey Copy's approach, with the swearing and innuendo left out, because this
sells to people planning their wedding.

1. **One idea per scene.** A headline makes the promise, and a body proves it.
2. **Nouns you can see.** "Your uncle's password", not "seamless onboarding".
3. **Headlines for the heart, bodies for the wallet.** Feel it first, then get the fact.
4. **Sound like the funniest person at the table.** Warm, a bit cheeky, never smug.
5. **At most 8 words in a headline and 30 in a body.**

## The copy

### 0. Hero

**You'll miss most of your own party.**

Your guests won't. Stills turns every phone in the room into one shared camera.

*Button: "Create your event →". Prompt: "Scroll to join the party" ("Swipe up to join the party" on touch screens).*

### 1. Scan

**Nothing to download. Nothing to explain.**

One scan and Stills just opens, like a card trick. Guests type their name and start
shooting. No app. No account. No password your uncle will forget.

*On the phone, the App Clip card: "You're invited", "Find your seat and grab the camera".
Those words need checking against what's set in App Store Connect.*

### 2. Find your seat

**Retire the easel.**

Guests type their name and Stills shows them their table. Add your floor plan and they
can zoom in to find it. No second app. No extra charge.

### 3. Everyone shoots

**120 photographers. Zero invoices.**

Your photographer gets the first dance. Your guests get the speech from table nine, the
auntie on the dance floor and the hug you walked straight past.

### 4. Challenges

**Don't ask for photos. Set a dare.**

Happy Tears. Best Dressed. Caught in the Act. Write your own challenges or grab a
ready-made pack, then watch your quietest table go to work.

### 5. Audio and video guestbook

**A photo can't keep your grandad's voice.**

So Stills has an audio and video guestbook. Guests leave you a message, out loud or on
camera, and only you get to hear it.

### 6. Live or disposable

**Watch it live. Or make them wait.**

**Go live.** Every photo lands in the gallery as it's taken. The party watches itself
happen.

**Go disposable.** A limited roll. Direct flash, a little grain, a printed date stamp.
Nobody sees a thing until the moment you pick.

*This was "Make them wait. Or don't." The order swapped because the disposable half now
runs straight into the reveal. To bring those words back, the live half has to go first
anyway, which would read back to front.*

### 7. The payoff

**Here's everything you missed.**

Every photo, video and message, from every guest, in one place. No chasing the group
chat. Download the lot, and finally attend your own party.

### 8. Use cases

**Any party with more than one phone.**

Tabs: **Birthdays**, **Bach parties**, **Holidays**.

- **Birthdays.** The surprise face. From every angle.
- **Bachelor and bachelorette parties.** What happens on the trip stays in the gallery.
- **Holidays and group trips.** You shot the sunset. They shot you asleep on the beach.

Plus engagements, anniversaries, graduations, baby showers, housewarmings and Christmas
parties. There's a challenge pack for each.

### FAQs

**Good questions.** The seven in `FAQS` in `content.ts`, with the prices that used to have
their own scene.

### Close

**It only happens once. Catch all of it.**

Make your event. Share the QR code. Go enjoy your own party.

*Button: "Create your event →", which goes to the App Store, plus a QR code on desktop.
Host sign in is in the footer.*

## Small print

- **Page title:** Stills: one shared camera for your whole party
- **Description:** Guests scan a QR code and start shooting, with nothing to download.
  Every photo, video and voice note lands in one place.
- **Chapter menu:** Scan, Seat, Shoot, Dare, Messages, Reveal, Album, Parties

## Alternatives worth keeping

| Scene | Alternative | Why it isn't first choice |
|---|---|---|
| Hero | You'll miss most of your own wedding. | Stronger for couples, but shuts out every other event |
| Seat | Two hundred guests. One easel. Not anymore. | Funny, but less punchy |
| Everyone | 120 photographers. No shot list. | Safer if "zero invoices" feels too close to "free" |
| Close | You only get one first dance. | Beautiful, but wedding-only |

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
