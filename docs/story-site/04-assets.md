# Asset library

Everything the page loads lives in `public/story/`, about 7 MB in total. A visitor
only downloads what the page actually reaches, roughly 4 MB by the end of the story.

| Folder | Contents | Made by |
|---|---|---|
| `art/` | Room plate and 18 cast drawings, each as a matched `neg` and `pos` | Generated, then `process-art.mjs` |
| `photo/` | 13 photos as `print-*` (baked Disposable look), `print-*-s` (small) and `raw-*` (viewfinder) | `bake-photos.mjs`, from `assets/sample-event` |
| `poster/` | One still per scene for the linear page, plus `share.jpg` | `capture-stills.mjs`, from the live stage |
| `fonts/` | Isolde, Instrument Sans, and Cormorant Garamond italic (numerals only) as WOFF2 | `build-fonts.mjs` |
| root | `logo.webp`, `icon.webp`, two real QR codes, `story.css` | Hand-written or exported from `assets/` |
| root | `home.html`, `story.js` | `build-home.mjs` |

**Drawn in code, not generated:** the phone, every app screen, the invitation,
festoon lights, table numbers, flash bursts, the gold line.

## Generated illustrations

| Setting | Value |
|---|---|
| Model | `gpt-image-2.5-sunburst`, confirmed against the docs and this account's model list |
| Quality | `high` |
| Room plate | 3840×1440, one continuous drawing |
| Cast | 1024×1536 or 1536×1024 |
| Spend | About **$1.11**: 23 calls, including 3 low-quality drafts and 1 redraw. Worked out from the logged tokens at the published rates, so check it against your OpenAI usage page |

Prompts, including the master style paragraph, are in
[`scripts/story/prompts.mjs`](../../scripts/story/prompts.mjs). Raw outputs and the
token log are in `assets/story-source/` (33 MB, kept local and out of git, and
excluded from deploys by `.vercelignore`). `process-art.mjs` needs them, so back
them up: without them, changing a drawing means paying to generate it again.

**Consistency.** `ayla-shoot` and `dad-a` were generated first and then passed as
image references to everything else. Poses in a pair, like `dad-a` and `dad-b`,
reference each other.

**Why the art is line-only.** All art is black line on white. `process-art.mjs`
derives both states from one drawing:

- `neg`: ivory line on `#0B0B0C`
- `pos`: ink line on `#EFE9E0`

They align exactly, so a pool of light can cross them with no seam. It also flood
fills each figure's outside to get a silhouette, so the room doesn't show through
blank clothes, and trims the transparent margin. Those sizes go into
`src/features/marketing/story/art-manifest.ts`.

## Photography

No photos were generated for this page. The story uses the existing album in
`assets/sample-event`, because `docs/visual-assets.md` rules out generating new
wedding photography for production.

**Check before launch.** That same document bans AI-generated wedding photography
in production, and one source file is named `Codex Image 21 Sept 2026, 11_42_34.png`
(`p12`), which suggests it was generated. The provenance and rights of the whole
album weren't verified as part of this work.

| Moment in the room | Photo |
|---|---|
| Girl and dog | `p01` |
| Running flower girls | `p02` |
| The aunt at her table | `p04`; the camera scene uses `p03` |
| The hug | `p05` |
| The dad dancing | `p06` |
| The sing-along | `p07` |
| Couple and cake | `p08` |

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
