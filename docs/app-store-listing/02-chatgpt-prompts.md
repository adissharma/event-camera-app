# ChatGPT prompts for the App Store screenshots

Nine frames, in upload order. Everything to attach is in [`attachments/`](attachments/).

## How to run this

1. Start one new ChatGPT chat, so the look stays consistent across frames.
2. Send the **setup prompt** with its four attachments.
3. Send **frame 1** with its attachments, and refine it until you love it. Everything else
   copies from this one.
4. Send the other frames one at a time. Each lists exactly what to attach, including
   `frame-01-approved.png`, the frame 1 that App Store Connect accepted, so every frame copies its
   look. If you start a new chat partway through, send the setup prompt again first.
5. Download each image with ChatGPT's own download button. Copying it or taking a screenshot
   shrinks it.
6. Run the checks at the end, then size the images for upload. **Never upload ChatGPT's file
   directly.** It comes out smaller than asked (frame 1 came back at 852 × 1847), and App Store
   Connect rejects anything that isn't an exact size.

## Setup prompt

**Attach:** `style-1-sunset.png`, `style-2-night.png`, `style-3-sunrise.png`, `brand-logo.png`

```text
You are the art director for the App Store screenshots of Stills, an iPhone app that turns every guest's phone at a party into one shared camera. I'll ask for nine images, one at a time. Read this brief and reply only "Ready, 1328 x 2880". Don't generate anything yet.

THE AUDIENCE
Someone planning a wedding or big party, deciding in a few seconds whether to download. Each image must be exciting, premium and instantly readable at thumbnail size. Think of a beautifully printed gig poster crossed with a luxury fashion campaign. It must not look like a typical app template.

THE IDEA
The words are deliberately plain: they say exactly what the app does. So the picture has to supply all the excitement. Never make the words clever or decorate them. Make the image extraordinary.

THE LOOK: COPY IT FROM THE THREE ATTACHED PAGES
- World: a bold hand-carved linocut print of a wedding on the terrace of an Italian villa. Strictly black ink and warm white paper, no grey, about half of everything solid black, with detail carved out as white lines. Large simple shapes with strong silhouettes.
- Sky: flat, saturated sunset. Hot pink and violet with flat stylised clouds and a big white sun low behind the print. Sky colours: #7A22B8, #B5249F, #EA2B8C, #FE4D8D, #FF7EA8.
- Night scenes: everything multiplied with deep violet #31206C, with pools of white flash light on the print.
- The contrast that makes it special: the world is an illustrated print, but the guests' photographs are REAL, full-colour, flash-lit photos, and the phone screen is real. Real things look like they are bursting out of the print.
- Print ink #0A090C, paper #FFFBF6, accent #FF2F7E.

TYPE
- Headlines: the elegant high-contrast old-style serif in the attached pages, in warm white #FFFBF6, sentence case, very large, tight line spacing, ranged LEFT, never centred, starting near the top-left. Never bold, no outlines, no gradient or glow.
- Supporting line: a clean modern grotesque sans (like Instrument Sans), warm white, about a third of the headline's size, directly under the headline.
- Small tags: a small pill with a thin white outline and the same sans.
- Only use the words I give you. Copy them exactly, with exact punctuation and curly apostrophes.

LAYOUT
- Canvas: every image is exactly 1328 x 2880 pixels, portrait, with no border, no rounded corners and no transparency. That is 1 unit wide to 2.17 units tall. Never make an image taller, narrower, shorter or wider than that. If you can't produce this size, tell me before generating and say which size you'll use instead.
- Fit the design to the canvas. Never stretch or squash anything to make it fit. If something doesn't fit, make it smaller or let it run off the bottom edge.
- Top 30%: the logo, if I ask for it, then the words. Keep them clear of anything busy, with a margin of about 90 pixels on the left and right.
- Headline size: the longest line fills about 85% of the canvas width. Use exactly the line breaks I give you, and make the type smaller rather than adding a line.
- Bottom 60%: one large modern iPhone with a thin dark titanium frame and Dynamic Island, tilted a little. Its top edge starts at about 40 to 45% of the image height, and it's big enough to run off the bottom or right edge of the canvas. Soft, realistic shadow.
- Keep every word and every important detail at least 40 pixels from all four edges, as the final image gets trimmed very slightly.
- One idea per image. Generous space, few elements, each one large.

THE PHONE SCREENS
For each image I'll attach real screenshots of the app. Place each one on the phone's screen exactly as supplied. Do not redraw, restyle, translate, simplify or correct them. Keep every word, number, icon and photo on them unchanged. If you can't keep a detail perfectly, keep the layout and leave it slightly soft rather than inventing different words.

NEVER INCLUDE
Star ratings, review quotes, laurels, awards, "App of the Day", the Apple logo, prices, guest counts I didn't give you, other app names, other phone brands, watermarks, device labels, emoji I didn't give you, real recognisable people, film-camera clip art, confetti, sparkles, lens flare, 3D glossy gradients, or glassmorphism.
```

## Frame 1: what it is

**Attach:** `screen-event-hero.png`, `photo-happy-tears.png`, `photo-hug.png`, `photo-dance-floor-friends.png`, `art-hug.png`, `brand-logo.png`

```text
Create image 1 of 9. Canvas: exactly 1328 x 2880 pixels, portrait. This is the most important image, so it must stop someone scrolling.

WORDS (exactly):
Headline, on three lines:
The shared
camera app for
weddings and parties.
Supporting line: Guests scan a QR code and start shooting. Every photo lands in one album.

SCENE: Blazing hot pink and violet sunset over the linocut villa terrace, with the huge white sun low on the right and flat clouds, like the first attached style page. In the foreground at bottom left, the black and white print figures from art-hug.png, two people lost in a warm hug, cropped at about knee height by the bottom edge. The party is in full swing behind them.

PHONE: Tilted about 6 degrees, lower right, about 62% of the canvas width, with its top edge at about 40% of the image height, so that nearly the whole screen is in view. Only the very bottom of the phone may run off the bottom edge. Its screen is screen-event-hero.png, unchanged. Working down the screen, all of this must be visible: the couple's cover photo, the frosted glass event card with the title and stats, the row of round challenge icons, the row with the grid and video tabs, and below that the two guest photos in the album, with the guests' faces clearly showing and the camera button over them. Never cut the screen off at the challenge icons, and never replace the guest photos with empty black space.

THE MOMENT: Three real photographs fly out of the phone, up and to the left, overlapping the sky as if thrown. They are photo-happy-tears.png, photo-hug.png and photo-dance-floor-friends.png, as small white-bordered flash prints at slightly different angles, overlapping each other. They sit between the words and the phone, above and to the left of it, and can overlap the phone's top left corner. Keep them full colour against the print, and keep them clear of the words.

Put brand-logo.png small at the very top left, above the headline.
```

## Frame 2: joining

**Attach:** `frame-01-approved.png`, `screen-scan-appclip.png`, `screen-join.png`, `art-uncle-scan.png`

```text
Create image 2 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

WORDS (exactly):
Headline, on two lines:
Guests join
with one scan.
Supporting line: No app download, no account, no password needed. They scan your QR code and they’re in.

SCENE: The last of the sunset, so the sky is deeper violet at the top and hot pink at the horizon, and the white sun is half gone. The linocut terrace runs along the bottom. On the left, the print figure from art-uncle-scan.png, large, an older guest holding up his phone to scan, with a clear look of pleased surprise.

PHONES: Two phones overlapping, because this frame shows how quick joining is. At the back, higher up and smaller: screen-scan-appclip.png, the card that pops up after scanning. In front, lower right and larger, running off the edge: screen-join.png. Both screens unchanged.

A single thin curved line in #FF2F7E leads from the first phone to the second, showing one step. Add no other arrows, numbers or labels.
```

## Frame 3: the disposable camera

**Attach:** `frame-01-approved.png`, `screen-gallery-locked.png`, `detail-counter-wheel.png`

One phone, front and centre, shows the photos waiting to be revealed. Behind it, a giant disposable
camera counter wheel rises like the moon, with 24 at the top. It takes the place of the sun in the
other frames, so it needs no second phone, line or arrow to explain it.

```text
Create image 3 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

ONE EXCEPTION TO IMAGE 1: The phone is centred rather than lower right, as described below.

MOOD: Anticipation. A real disposable camera at a party: a fixed number of shots, every one of them counting, and every photo waiting for the morning. Slick, graphic and confident.

WORDS (exactly):
Headline, on two lines:
Turn every phone into
a disposable camera.
Supporting line: Limited shots, and the photos develop overnight. Wake up to every one of them.

SCENE: Night has fallen. A clean, deep violet sky going almost to #31206C, with a few flat clouds. Instead of the sun, the giant counter wheel below rises behind the phone like an enormous moon. Along the very bottom, in front of the wheel and either side of the phone, the black and white linocut balustrade of the terrace.

THE COUNTER WHEEL: Copy it exactly from detail-counter-wheel.png: a huge warm white disc with a finely ridged black edge, like the thumbwheel on a disposable camera, with big black serif numbers curving round its rim, a short black tick between each number, and a small hot pink #FF2F7E triangle fixed just above the rim, pointing down at the number 24. The 24 is upright at the very top of the wheel. Then 23, 22 and 21 run down the left side and 25, 26 and 27 down the right, each turned to follow the curve. The wheel is wider than the canvas, so it runs off both sides. The top of its rim is at about 27% of the image height, just below the supporting line. The whole of the number 24 must be clear above the top of the phone, with nothing covering it.

PHONE: One phone, front and centre, overlapping the lower part of the wheel, tilted only about 3 degrees, about 64% of the canvas width, with its top edge at about 41% of the image height, so that nearly the whole screen is in view. Only the very bottom of the phone may run off the bottom edge. Its screen is screen-gallery-locked.png, unchanged. The album below the challenge icons must be clearly visible: the blurred guest photos, the round lock icons, and the words "Reveals in 8h 12m" under each lock, sharp and readable. Never cut this screen off at the challenge icons, and never sharpen or redraw the blurred photos.

Don't connect the wheel to the phone in any way. No lines, arrows, callouts, labels or magnifying effects anywhere in the image. No second phone. No film strips, film-camera clip art or flash bursts. No other numbers apart from those on the wheel and on the phone's screen.
```

## Frame 4: every guest

**Attach:** `frame-01-approved.png`, `screen-gallery-grid.png`, `photo-dance-floor-dad.png`, `photo-girl-and-dog.png`, `art-shooter-auntie.png`, `style-2-night.png`

```text
Create image 4 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

WORDS (exactly):
Headline, on two lines:
Every guest is
your photographer.
Supporting line: Your photographer can’t be everywhere. Your guests are, catching the moments you miss.

SCENE: The party at night, as in the attached night page. Deep violet sky, a string of lit bulbs, and the terrace and checkered dance floor in black and white print, with pools of white flash light. On the left, large, the print figure from art-shooter-auntie.png taking a photo, and her flash lights up a patch of the print around her.

PHONE: Large, lower right, tilted slightly and running off the edge. Its screen is screen-gallery-grid.png, unchanged, so the guests' name tags on the photos stay readable. This should look like a gallery that's overflowing with great photos.

THE MOMENT: The real photographs photo-dance-floor-dad.png and photo-girl-and-dog.png float out of the flash, as small white-bordered prints at angles. Their full colour should be the brightest thing in the image.
```

## Frame 5: photo challenges

**Attach:** `frame-01-approved.png`, `screen-challenge.png`, `photo-happy-tears.png`, `art-dare-crew.png`

```text
Create image 5 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

WORDS (exactly):
Headline, on two lines:
Photo challenges get
everyone shooting.
Supporting line: Set prompts like Happy Tears and Best Dressed, or pick a ready-made pack for your event.
Small pill tag under the supporting line: Challenges with Stills+

SCENE: Night terrace, deep violet, hot pink glow at the horizon, playful and full of energy. At the bottom left, the print figures from art-dare-crew.png, going to absurd lengths to get the shot.

PHONE: Large, right of centre, running off the edge. Its screen is screen-challenge.png, unchanged, showing the Happy Tears challenge.

THE MOMENT: The real photograph photo-happy-tears.png sits next to the phone, as a white-bordered print with a slight tilt, overlapping the phone's edge, so you can see the challenge and the photo it produced together. Don't add any words to the print.
```

## Frame 6: the guestbook

**Attach:** `frame-01-approved.png`, `screen-guestbook.png`, `art-guest-voice.png`

```text
Create image 6 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

MOOD: This is the emotional one, so make it quieter and more spacious than the others.

WORDS (exactly):
Headline, on two lines:
A guestbook you
can actually hear.
Supporting line: Guests leave private voice or video messages: your mum in tears, your best friend at 1am.
Small pill tag under the supporting line: Guestbook with Stills+

SCENE: Deep violet night, almost no background detail, one soft pool of white light only wide enough for her. At the left, large, the print figure from art-guest-voice.png, a woman in a long dress laughing as she speaks into her phone.

PHONE: Large, lower right, running off the edge. Its screen is screen-guestbook.png, unchanged.

THE MOMENT: The white sound waveform on the phone's screen seems to continue out of the phone to the left, in #FF2F7E, travelling across the image to her phone, as one simple elegant line of bars. Nothing else moves in the picture.
```

## Frame 7: the album

**Attach:** `frame-01-approved.png`, `screen-album.png`, `art-morning-after.png`, `photo-hug.png`, `photo-cake.png`, `style-3-sunrise.png`

```text
Create image 7 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

MOOD: This is the payoff of the whole night, and should feel like relief and joy.

WORDS (exactly):
Headline, on two lines:
Your guests are already
taking the photos.
Supporting line: Get every photo in one album. All you need is a QR code.

SCENE: The morning after. A soft lilac and pink sky with big flat clouds and a low white sun, lighter and more hopeful than any other image in the set. The terrace is empty and the party is over. At the bottom left, the print figures from art-morning-after.png, last night's couple sitting together on the steps, looking through the photos on a phone.

PHONE: Lower right, about 62% of the canvas width, with its top edge at about 40% of the image height, so that nearly the whole screen is in view. Only the very bottom of the phone may run off the bottom edge. Its screen is screen-album.png, unchanged. The guest photos in the album below the challenge icons must be clearly visible, with the guests' faces showing. Never cut the screen off at the challenge icons.

THE MOMENT: The real photographs photo-hug.png and photo-cake.png drift gently up from the phone, as white-bordered prints catching the morning light. They should feel calm and floating, not thrown.
```

## Frame 8: seating

**Attach:** `frame-01-approved.png`, `screen-find-table.png`, `screen-floor-plan.png`, `art-easel-crowd.png`

```text
Create image 8 of 9. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). There's no logo on this image, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

MOOD: The words are plain, so the humour is all in the picture.

WORDS (exactly):
Headline, on two lines:
A seating chart
on every phone.
Supporting line: No crowd round the easel. Guests scan, find their table and zoom into your floor plan.
Small pill tag under the supporting line: Included in every plan

SCENE: Bright hot pink and warm violet early evening sky with flat clouds. On the left, large, the print illustration from art-easel-crowd.png: a crowd of guests squeezing round a paper seating chart on an easel, squinting and pointing. It runs partly off the left edge.

PHONES: Two phones overlapping. Front, lower right and larger, running off the edge: screen-find-table.png, unchanged, showing Table 7. Behind it, higher and tilted the other way: screen-floor-plan.png, unchanged, zoomed in on table 7.

Add one thin line in #FF2F7E that sweeps from the crowd at the easel to the "Table 7" on the front phone's screen.
```

## Frame 9: every kind of party

**Attach:** `frame-01-approved.png`, `screen-party-birthday.png`, `art-setting-birthday.png`, `art-setting-bach.png`, `art-setting-trip.png`, `brand-logo.png`

```text
Create image 9 of 9, the closing image. Canvas: exactly 1328 x 2880 pixels, portrait, the same shape as image 1.

MATCH IMAGE 1: The attached frame-01-approved.png is the approved image 1. It sets the look for the whole set, so match it exactly:
- The same serif headline in warm white, at the same type size, starting at the same left edge (about 7% in) and the same height (its first line about 9% down). The logo goes at the bottom of this image, not the top, but don't move the headline up to fill the space: the headlines must line up when someone swipes through the set.
- The same sans supporting line, at the same size and spacing under the headline.
- The same bold two-tone linocut print, flat colour and flat stylised clouds. The time of day and the sky can change, as the scene below describes.
- The same iPhone: dark titanium frame, Dynamic Island, the same soft shadow. Where there's one phone, make it the same size as in image 1, with its top edge at about the same height.
- The same white-bordered flash prints for any real photographs.
Only the scene, the words and the phone screens change.

MOOD: It should mirror image 1, so that the set ends where it began.

WORDS (exactly):
Headline, on two lines:
Any party with
more than one phone.
Supporting line: Weddings. Birthdays. Bach parties. Group trips.
Final line, slightly larger than the supporting line, directly below it: Pay once per event. No subscription.

SCENE: The hot pink and violet sunset from image 1, with the big white sun back in the sky. The bottom third is a single continuous linocut skyline that blends the attached settings into one panorama: art-setting-birthday.png, art-setting-bach.png and art-setting-trip.png, all in black and white print.

PHONE: Right of centre, tilted about 6 degrees the opposite way to image 1, about 62% of the canvas width, with its top edge at about 40% of the image height, so that nearly the whole screen is in view. Only the very bottom of the phone may run off the bottom edge. Its screen is screen-party-birthday.png, unchanged. The guest photos in the album below the challenge icons must be clearly visible, with the guests' faces showing. Never cut the screen off at the challenge icons.

Put brand-logo.png small at the bottom left, on a clear area of the print.
```

## Fixing common problems

Paste these as follow-ups in the same chat.

| Problem | Say this |
|---|---|
| The app screen was redrawn or its text changed | `The phone screen has changed. Regenerate with the attached screenshot placed exactly as supplied, with all its words, numbers and photos unchanged.` |
| Spelling or punctuation is off | `Keep everything else identical. Correct the headline to read exactly: [paste words]` |
| It looks like a generic app template | `Too much like an app template. Make the linocut print and the sun far bigger and bolder, cut anything that isn't essential, and match the attached sunset page more closely.` |
| The print looks soft or 3D | `Make the illustration a true two-tone linocut: flat black and warm white only, with carved white lines, no grey, no shading.` |
| The words are too small | `Make the headline about 30% larger. It must still be readable when this image is 120 pixels wide.` |
| Frame 3's counter wheel is small, changed or hidden | `Keep everything else identical. Copy the wheel exactly from detail-counter-wheel.png: a huge warm white disc with a ridged black edge, wider than the canvas, rising behind the phone, with the pink triangle pointing at 24 and the whole of the 24 clear above the top of the phone. Remove any lines, arrows or callouts.` |
| The album's photos are cut off or missing below the challenge icons (frames 1, 7 and 9) | `Keep the words, sky, print figures and floating photos identical. Change only the phone: make it about 62% of the canvas width with its top edge at about 40% of the image height, and show the attached screenshot in full, unchanged, including the guest photos below the challenge icons, with their faces clearly showing. Only the very bottom of the phone may run off the bottom edge.` |
| Frame 3's locked photos are hidden, sharp or lose their wording | `Keep everything else identical. Show screen-gallery-locked.png on the phone unchanged, with the blurred guest photos, the lock icons and the words "Reveals in 8h 12m" clearly visible and readable.` |
| An award or star rating appeared | `Remove all ratings, stars, laurels and awards.` |
| The image is the wrong shape | `This is the wrong size. Recreate it with the same art, words and phone screen at exactly 1328 x 2880 pixels, portrait. Don't stretch or squash anything: tighten the space between elements and let the phone and figures run further off the bottom edge.` |
| The frames are drifting apart | `Compare this with frame-01-approved.png. Match its headline size and position, colours, print style and phone exactly, and keep this image's scene, words and screens.` |
| The headline is bigger, smaller or higher than in image 1 | `Keep everything else identical. Make the headline the same size and at the same height and left edge as in frame-01-approved.png.` |

## Before you upload

**On every image:**

- [ ] The words match this file exactly.
- [ ] The phone's screen matches the attached screenshot, including small text. A garbled word or changed number can mean rejection under Apple's accuracy rules, so check closely.
- [ ] Faces and hands in the real photos haven't warped.
- [ ] **Frames 1, 7 and 9:** the guest photos show below the challenge icons, so the album doesn't look empty.
- [ ] **Frame 3:** the wheel reads 24 under the pointer with nothing covering it, there are no lines or arrows, and the locked photos are blurred with "Reveals in 8h 12m" readable.
- [ ] The headline is readable when the image is shrunk to thumbnail size.
- [ ] The height divided by the width is between 2.12 and 2.23. Anything outside that is the wrong shape, so regenerate it.

**Check these against the live app before submitting:**

- [ ] **Frame 2:** the App Clip card's cover image and wording ("You're invited", "Find your seat and grab the camera") match what's set in App Store Connect. Your own notes flag this as unchecked.
- [ ] **Frame 8:** the floor plan is in the live build. It was only committed on 1 November, the day before 1.0 went live. If it isn't, remove `screen-floor-plan.png` and end the supporting line at "find their table" until an update ships it, or skip this frame.

## Sizing the images for upload

App Store Connect rejects anything that isn't an exact size, and ChatGPT never produces one. It
ignores the 1328 × 2880 in the prompt and returns something smaller in roughly the right shape, such
as 852 × 1847. The prompt still asks for 1328 × 2880 because that keeps the shape right, and a last
step resizes each image to Apple's exact pixels.

Size images straight from Downloads:

```bash
sh docs/app-store-listing/size-for-upload.sh ~/Downloads/"Stills Wedding Party App Poster.png"
```

Or put them all in `finished/` as `01.png`, `02.png` and so on, and run it with no file names:

```bash
sh docs/app-store-listing/size-for-upload.sh
```

| Folder | Size | Where it goes in App Store Connect |
|---|---|---|
| `upload/6.9/` | 1320 × 2868 | iPhone 6.9" |
| `upload/6.3/` | 1206 × 2622 | iPhone 6.1" or 6.3" |

Upload the file from `upload/6.3/` to the tab App Store Connect calls "iPhone with Dynamic Island
(medium display)". It makes JPEGs with no transparency, trims at most a few pixels from the edges,
and refuses any image that's the wrong shape rather than cutting off your words. Smaller images are
enlarged, and it says when that happens. If ChatGPT's small text comes out soft, the fix is to keep its background
and composition, then lay the real screenshot and crisp type on top at full resolution.

## What's in `attachments/`

Refreshed on 7 November from the redesigned app and the live website.

| Files | Source |
|---|---|
| `screen-album`, `screen-gallery-grid`, `screen-challenge`, `screen-dashboard`, `screen-previous-albums` | The real app in the simulator, in its new design, using the sample album |
| All other `screen-*` | The phone screens on stills.events, rebuilt from the app's source. Numbers such as "1,284 photos" are illustrative, as they are on the website |
| `detail-counter-wheel` | A disposable camera's counter wheel at 24, drawn in the app's serif and the set's colours, for frame 3 |
| `detail-shot-counter` | The camera's real shots-left pill, drawn large in the app's own font and colours. A spare |
| `frame-01-approved` | Frame 1 as App Store Connect accepted it, attached to frames 2 to 9 so they copy its look |
| `style-*` | The website's sunset, night and morning scenes, for the look and type |
| `art-*`, `photo-*`, `brand-*` | The website's current print figures, demo photos, logo and icon |

**Spares, not used in a frame:** `screen-camera` (the camera with its real 24 counter), `screen-gallery-revealed` (the website's album, with 1,284 photos),
`screen-dashboard` and `screen-previous-albums` (the new home screen), and the photos
`couple-cover`, `couple-at-night`, `flower-girl`, `mum-at-the-table` and `terrace-at-night`.
`screen-gallery-revealed` is the one to swap into frame 7 if the real album's "7 Photos" feels too small.

The photos are illustrative samples, not customers' photos, so don't caption them as real events.
