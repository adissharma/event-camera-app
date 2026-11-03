# Validation

First tested 2 Nov 2026 against the static page, plus one production export. The
sunset redesign was tested on 3 Nov 2026, and the full storyline rebuild after that:
rows marked \* come from the latest pass, and the rest haven't been repeated since.

## Results

| Check | How | Result |
|---|---|---|
| Typecheck \* | `tsc --noEmit` | Passes |
| Lint \* | `eslint src/features/marketing` | Clean |
| Tests \* | `jest` | 527 tests pass. The story itself has no automated tests |
| Production export | `expo export` to a scratch folder, then the deploy's post-build steps | `/` serves the story |
| Homepage independence | Network log on the exported page | 0 requests to Supabase or the Expo bundle |
| Other routes | `/privacy` and `/host/sign-in` on the export | Both render |
| Inside the app | `/` under `expo start` | Boots and scrolls |
| Accessibility rules \* | axe-core (WCAG 2 A and AA, 2.1 AA, best practice) on both modes | 0 violations. axe can't judge white text on the sky gradient, so contrast there was worked out by hand: about 7.6:1 at the top, 5.6:1 by a quarter of the way down, 4:1 by halfway. Copy sits in the upper part, but clouds can reduce it, and it needs a look on real screens |
| Keyboard | Tabbed through the page | Skip link, header, closing links, chapters, footer, in order. Focus never lands in the phone |
| Reduced motion \* | `prefers-reduced-motion` at desktop and phone width | Linear page, 9 captioned stills, then FAQs and close, no sticky stage, no sideways scroll |
| Shot counter \* | Scrolled forward and back through the scene | Rolls 0 to 24, then down to 0, and all of it in reverse. Sharp at 2× in a full-resolution capture |
| Parked swirl \* | Built once with `SWIRL` on | Runs with no errors, over the locked cells. Off again for release |
| Use case tabs \* | Scrolling, clicks, arrow keys, leaving and returning | Tab, copy, setting and phone always agree. A click holds until you leave the scene |
| Against the real app \* | Viewed the running app in the Simulator: the capture-limit step and event page | Counter, zoom pill and event page matched by eye. The live camera screen wasn't opened, because it needs camera permission, so its details come from the code |
| No JavaScript | JavaScript disabled | Page renders. Screenshot taken, but it was the only check run on this mode |
| Rough use | Jump forward, jump back, resize mid-story, chapter buttons | Position kept, no errors |
| Sizes \* | 1920×1080, 1440×900, 1024×768, 390×844, 844×390 | Checked by eye at sampled frames |

## Performance

From headless Chrome on this Mac using its Metal GPU, scripting a 30-second scroll
through the whole story. The phone profile adds 4× CPU slowdown and a simulated slow
connection (1.6 Mbps, 150 ms latency).

| Measure | Desktop | Phone profile |
|---|---|---|
| Largest Contentful Paint | 0.6 s, local server | **3.8 s** |
| Cumulative Layout Shift | 0 | 0 |
| Frame rate | 60 fps | 60 fps |
| Frames over 50 ms | 0 of 1,800 | 0 of about 1,800 |
| Total downloaded | 3.6 MB | 3.5 MB |
| Homepage JavaScript | 12 KB gzipped | Same |

**These are indicative, not field numbers.** A fast Mac GPU flatters the night
layer, figures come from a local server rather than Vercel, and CPU slowdown isn't
the same as an older phone. The headline comes in right after the venue so it doesn't hold this number back. Most of
what's left on the phone profile is the wait for the script and venue art on a simulated
1.6 Mbps connection.

## iOS Safari

Viewed in the iOS Simulator (iPhone 17) at sampled moments on 3 Nov 2026, rather
than a full frame-by-frame pass. Sticky positioning, the clouds, the night blend, the
counter zoom and tapping the use case tabs all work.

Safari colours its top and bottom bars when the page loads and didn't update them as
the sky changed, so at night they stay violet above and below a darker page. Setting
`theme-color` and fixed strips at the edges made no difference.

## Product accuracy

Each screen is rebuilt from its source file. The join screen was also compared side
by side with a live event's join page, opened without joining.

| Screen | Source | Compared with |
|---|---|---|
| Join | `guest-join-screen.tsx` | Live page: a close match |
| Find your table | `find-your-table.tsx` | Source values only |
| Camera | `camera.tsx`, `viewfinder-chrome.tsx`, `viewfinder-shot-counter.tsx` | Source values only |
| Event page | `event-stat-strip.tsx`, App Store screenshots | Source and screenshots |
| iOS camera | Not Stills UI: an approximation of Apple's camera | Not compared |

**Simplifications:**

- The event page leaves out the Prompts row.
- Scanning shows the join screen directly and skips the App Clip card that iOS may show first.
- Scene 7's lifted photos are illustrative: the page's own motion, not the app's photo viewer.

## Known limitations

- **Not tested:** physical phones, Android, desktop Safari, Firefox, screen readers with a person using them.
- **Invitation QR:** goes to `stills.events`, since there's no demo event to send people to.
- **Apple's product rules:** the rebuilt phone has a Dynamic Island and side buttons, and one screen imitates Apple's camera. Apple's marketing guidelines ask that illustrated devices don't copy details unique to its products, and that its own bezels are used instead. This hasn't been changed, and is worth a decision.
- **Brand:** the pink page deliberately departs from "photography supplies the colour". `docs/brand-system.md` hasn't been updated, because that's a decision for its owner.
- **Demo data:** "1,284 photos, 86 joined" and the names are illustrative, for the fictional event on screen. Nothing on the page claims real usage.
- **Walking:** Ayla's walk has two poses, so it's a stylised flipbook.
- **Long page:** about 17 screen-heights. It holds together in the Simulator, but whether it feels too long needs a real thumb.
- **No wheel stepping:** unlike FlyCrooked, scroll is native by design, so a hard flick can skip past a beat. Chapter buttons cover this on larger screens, but phones don't have them.
