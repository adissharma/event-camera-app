# Development notes

## How it's served

The homepage is a **static page that doesn't use the app**. The root layout renders
nothing until its fonts load, so going through Expo Router would leave `/` empty
until a 6 MB bundle had booted, and it would fire a Supabase call too.

```text
src/features/marketing/story/   source
        │  scripts/story/build-home.mjs   (run by hand, output committed)
        ▼
public/story/home.html, story.js          copied to dist/ by expo export
        │  scripts/story/install-home.mjs (run by vercel.json's build command)
        ▼
dist/index.html                           what visitors get at /
```

`src/app/index.web.tsx` still renders the same markup, for `expo start` and for
anyone navigating to `/` from inside the running app.

**After changing anything in `src/features/marketing/story` or `content.ts`, re-run
`build-home.mjs` and commit the output.** Vercel doesn't rebuild it. After a visible
change to the stage, re-run `capture-stills.mjs` too, or the linear page goes stale.
It needs the local server:

Run `story-static` from `.claude/launch.json`, then open http://localhost:8090.

## Files

| File | Holds |
|---|---|
| `content.ts` | All copy, links, demo event values and photo order. **Start here for wording** |
| `world.ts` | Where each figure, table number and light wire sits, in panorama pixels |
| `choreography.ts` | Every movement on the page, top to bottom in story order |
| `timeline.ts` | The small scrubbed timeline engine |
| `boot.ts` | Scroll loop, canvas light, image loading, resize |
| `phone.tsx` | The phone and rebuilt app screens |
| `story-site.tsx` | Page markup |
| `art-manifest.ts` | Generated. Don't edit by hand |
| `public/story/story.css` | All styles. Default rules are the linear page; `.story-live` is the stage |

## Concepts

**One clock.** Each value is a pure function of story time `t`, and scroll maps to
`t` at 0.24 viewport heights per unit (`UNIT_VH` in `boot.ts`). Change that to make
the whole page longer or shorter. Nothing can get stranded, because nothing keeps
its own state.

**The camera.** `{ cx, cy, vh }` is a point in the panorama and how much of its
height is on screen. `shot()` and `wide()` keep it inside the drawing. To move the
story, add a `camTo()`.

**Light.** `addLight(x, y)` makes a pool in world coordinates, and growing its `r`
opens it. `boot.ts` draws them all to one canvas: a soft mask, the `pos` plate
through it, then a warm edge. `figLit(id, t)` flips a person to positive.

**Two heights.** `L.h` is the stage, which fills the largest viewport so a collapsing
iOS toolbar never reveals its edge. `L.vis` is the smallest viewport. Put anything
that must stay in view, such as the phone, in `L.vis`.

**Layout modes.** `m` means phone-style composition: narrower than 760 px, or
portrait. CSS must match, with `(max-width: 759px), (max-aspect-ratio: 9/10)`.
Landscape phones get their own CSS block.

## Common changes

| To change | Edit |
|---|---|
| A headline | `content.ts`, then build and recapture stills |
| A phone screen, because the app changed | `phone.tsx` and `story.css`, comparing with the source file named at the top of `phone.tsx` |
| Where someone stands | `world.ts`, then build |
| A drawing | `prompts.mjs`, `generate.mjs --force <id>`, `process-art.mjs <id>`, then build |
| The invitation QR, once a demo event exists | Regenerate `public/story/qr-invite.svg` |
| Timing of a beat | `choreography.ts`. Add tweens per property in time order, because each starts from where that property last was |

## Things that will bite

- **`opacity` vs `alpha`.** In the timeline, `opacity` also sets `visibility`, while `alpha` doesn't. Chapter copy uses `alpha`, so screen readers can reach all of it.
- **Hidden starts.** An element's starting opacity is read from the stylesheet when the timeline is built.
- **Module state.** Keep state inside `bootStory` or in the DOM. This repo has been bitten by the React Compiler miscompiling hooks around module-level `let`s.
- **Sticky needs a free ancestor.** Any `overflow` on `html`, `body` or a parent breaks it. `story.css` undoes Expo's scroll reset for this reason.

## Why not GSAP

GSAP is what FlyCrooked uses, and it would have worked. The timeline here is about
150 lines, the whole script is 8 KB gzipped, and `docs/marketing-motion-spec.md` asks
that a library earn its bytes. If choreography ever outgrows it, swapping would mean
rewriting `choreography.ts`, but the markup and art would carry over.
