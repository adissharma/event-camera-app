# Header, search results, promotional text and What's New

Written 8 November 2026 for the version after 1.0. Apple's guidance: <https://developer.apple.com/app-store/asset-best-practices/>

## Creative assets

| File (in `creative/`) | Size | Line on it |
|---|---|---|
| `Product page header 3840x1646.png` | 21:9 | It only happens once. Catch all of it. |
| `Search results 3840x2560.png` | 3:2 | The shared camera app for weddings and parties. |

Apple asks the header for one clear idea and a short phrase that adds to the picture, and asks
search results to state the obvious and show the real experience. Key art is kept to the centre, as
Apple warns about clipping. Check both in App Store Connect's Preview tool before submitting.

Built from the website's own artwork at exact size. No prices, URLs, awards or other platforms.

## Promotional text (165 of 170)

```text
New: a seating chart on every phone. Guests scan one QR code, find their table and start shooting. Free for up to 5 guests, then pay once per event. No subscription.
```

## What's New (904 of 4,000)

```text
Our biggest update yet.

A SEATING CHART ON EVERY PHONE
No crowd round the easel. Add your seating plan by hand, or import a CSV file or pasted guest list. Guests find their table as they join and can zoom into your floor plan. It comes with every plan.

A NEW HOME FOR YOUR EVENTS
Your event now fills the screen, with previous albums a swipe away. There's a new Liquid Glass event card, and you can swipe up or down to close any photo, video or story.

THE REVEAL, DONE RIGHT
Locking the photos until the reveal? Hosts can now wait for it too. And if you keep the photos private, guests are told so kindly instead of being promised a reveal.

MORE CONTROL WITH STILLS+
Choose exactly how many guests can join.

FIXES
Google sign-in now brings you straight back to the app. Signing in with Apple or Google skips the name screen. Prices show in your own currency. The welcome screen no longer gets stuck.
```

Left out on purpose: web checkout (the App Store shouldn't point people to paying elsewhere), the
host web portal (not public yet), private promo codes, and server-side limit checks.

## Keywords (100 of 100)

```text
photo,album,guest,qr,event,seating,chart,table,guestbook,bachelorette,birthday,reception,film,reveal
```

Assumes the name "Stills: Shared Party Camera" and subtitle "Disposable camera for weddings", so it
doesn't repeat stills, shared, party, camera, disposable or wedding. Adds the seating terms now
that seating ships in this version. Not tested against search volume: compare with Apple Ads'
search popularity.
