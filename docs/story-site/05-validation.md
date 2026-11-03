# Validation

Tested 2 Nov 2026 against the static page, plus one production export.

## Results

| Check | How | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | Passes |
| Lint | `expo lint` | 0 errors. 57 warnings across the repo; none reviewed individually |
| Tests | `jest` | 47 suites, 527 tests pass. The story itself has no automated tests |
| Production export | `expo export` to a scratch folder, then the deploy's post-build steps | `/` serves the story |
| Homepage independence | Network log on the exported page | 0 requests to Supabase or the Expo bundle |
| Other routes | `/privacy` and `/host/sign-in` on the export | Both render |
| Inside the app | `/` under `expo start` | Boots and scrolls |
| Accessibility rules | axe-core (WCAG 2 A and AA, 2.1 AA, best practice) on both modes | 0 violations |
| Keyboard | Tabbed through the page | Skip link, header, closing links, chapters, footer, in order. Focus never lands in the phone |
| Reduced motion | `prefers-reduced-motion` at desktop and phone width | Linear page, 10 captioned stills, no sticky stage, no sideways scroll |
| No JavaScript | JavaScript disabled | Page renders. Screenshot taken, but it was the only check run on this mode |
| Rough use | Jump forward, jump back, resize mid-story, chapter buttons | Position kept, no errors |
| Sizes | 1920×1080, 1440×900, 768×1024, 390×844, 375×667, 844×390 | Checked by eye at sampled frames |

## Performance

From headless Chrome on this Mac, scripting a 30-second scroll through the whole
story. The phone profile adds 4× CPU slowdown and a simulated slow connection
(1.6 Mbps, 150 ms latency).

| Measure | Desktop | Phone profile |
|---|---|---|
| Largest Contentful Paint | 88 ms, local server | **1.0 s** |
| Cumulative Layout Shift | 0 | 0 |
| Frame rate | 59 fps | 59.5 fps |
| Frames over 50 ms | 1 of 1,773 | 2 of 1,786 |
| Total downloaded | 4.1 MB | 3.8 MB |
| Homepage JavaScript | 8 KB gzipped | Same |

**These are indicative, not field numbers.** Headless Chrome didn't report whether
it was using the GPU, so I can't say what it was rendering on. Figures come from
a local server, not Vercel, and CPU slowdown isn't the same as an older phone.

## iOS Safari

Viewed in the iOS Simulator (iPhone 17), at sampled moments rather than a full
frame-by-frame pass. It confirmed that sticky positioning, the canvas light and the
line art all work.

It also caught two bugs that headless Chrome couldn't, both now addressed:

- Collapsing the toolbar left a black band under the stage. Fixed, and confirmed in the Simulator.
- Browser chrome stayed black when the page turned ivory. Fixed in code, but not re-checked in the Simulator afterwards.

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
- **Demo data:** "1,284 photos, 86 joined" and the names are illustrative, for the fictional event on screen. Nothing on the page claims real usage.
- **Walking:** Ayla's walk has two poses, so it's a stylised flipbook.
- **Long page on a phone:** about 19 screen-heights. It holds together in the Simulator, but whether it feels too long needs a real thumb.
- **No wheel stepping:** unlike FlyCrooked, scroll is native by design, so a hard flick can skip past a beat. Chapter buttons cover this on larger screens, but phones don't have them.
