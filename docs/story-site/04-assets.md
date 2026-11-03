# Asset library

Everything the page loads lives in `public/story/`, about 5.4 MB in total. A visitor
only downloads what the page actually reaches, roughly 2.5 MB by the end of the story.

| Folder | Contents | Made by |
|---|---|---|
| `art/` | Venue, clouds and 13 cast drawings, one transparent file each | Generated, then `process-art.mjs` |
| `photo/` | 13 photos as `print-*` (baked Disposable look), `print-*-s` (small) and `raw-*` (viewfinder) | `bake-photos.mjs`, from `assets/sample-event` |
| `poster/` | One still per scene for the linear page, plus `share.jpg` | `capture-stills.mjs`, from the live stage |
| `fonts/` | Isolde, Instrument Sans, and Cormorant Garamond italic (numerals only) as WOFF2 | `build-fonts.mjs` |
| root | `logo.webp`, `icon.webp`, two real QR codes, `story.css` | Hand-written or exported from `assets/` |
| root | `home.html`, `story.js` | `build-home.mjs` |

**Drawn in code, not generated:** the phone, every app screen, the invitation,
sky gradient, sun, festoon lights, table sign, flash bursts, the line to your table.

## Generated illustrations

| Setting | Value |
|---|---|
| Model | `gpt-image-2.5-sunburst`, confirmed against the docs and this account's model list |
| Quality | `high` |
| Venue | 3840×1440, one continuous drawing |
| Clouds | 3840×2160, three flat tones on black |
| Cast | 1024×1536 or 1536×1024 |
| Spend | About **$0.85** for this set: 19 calls, including 4 low-quality drafts. The first set cost about $1.11. Both are estimates from the logged tokens, so check them against your OpenAI usage page |

Prompts, including the master style paragraph, are in
[`scripts/story/prompts.mjs`](../../scripts/story/prompts.mjs). Raw outputs and the
token log are in `assets/story-source/` (33 MB, kept local and out of git, and
excluded from deploys by `.vercelignore`). `process-art.mjs` needs them, so back
them up: without them, changing a drawing means paying to generate it again.

The first, ink-and-ivory set is archived in `assets/story-source/v1/`.

**Consistency.** `ayla-shoot` and `dad-a` were generated first and then passed as
image references to everything else. Poses in a pair, like `dad-a` and `dad-b`,
reference each other.

**How the art is processed.** All art is black on white. `process-art.mjs`:

- gives each figure a silhouette, by flood filling its outside, so nothing shows
  through white clothes, then trims the margin. Those sizes go into
  `src/features/marketing/story/art-manifest.ts`
- removes the venue's sky, flooding down from the top edge only, so the sunset shows
  behind it while the white arches stay solid
- turns the clouds' tones into transparency, so they pick up the sky's colour

## Photography

No photos were generated for this page. The story uses the existing album in
`assets/sample-event`, because `docs/visual-assets.md` rules out generating new
wedding photography for production.

**Check before launch.** That same document bans AI-generated wedding photography
in production, and one source file is named `Codex Image 21 Sept 2026, 11_42_34.png`
(`p12`), which suggests it was generated. The provenance and rights of the whole
album weren't verified as part of this work.

| Moment on the terrace | Photo |
|---|---|
| Girl and dog | `p01` |
| The hug | `p05` |
| The dad dancing | `p06` |
| The sing-along | `p07` |
| Couple and cake | `p08` |

The drawn dog is black and the photographed one is golden, so they no longer match
exactly.

## Regenerating

Generation and processing tools (`sharp`, `esbuild`, `wawoff2`, `subset-font`,
`playwright-core`) aren't app dependencies. Install them anywhere and pass paths:

```bash
OPENAI_KEY_FILE=/path/to/key node scripts/story/generate.mjs --force waiter
```

```bash
SHARP_PATH=/path/to/sharp node scripts/story/process-art.mjs waiter
```

```bash
ESBUILD_PATH=/path/to/esbuild node scripts/story/build-home.mjs
```

`generate.mjs` skips files that already exist, so a re-run only pays for what's
missing. The key is read from the environment or a file and is never stored in
the repo.
