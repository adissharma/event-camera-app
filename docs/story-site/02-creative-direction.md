# Stills.events: creative direction

## The idea: the sun goes down, and the guests light the party

One wedding on the terrace of an Italian villa, printed as a **bold black and white
woodcut against a hot pink and violet sunset**.

The page opens in the last of the sun, and the first scroll goes straight to the
product: one scan, no app. As the party starts the sun sets, the sky turns deep
violet and the terrace goes dark. Each guest's flash lights a patch of it back up,
and a **real, full-colour photograph** of that moment leaves their phone.

- At first it's bright, and the phone does the talking.
- Night falls, and guests' flashes light one patch at a time.
- At the climax the patches merge and the sunset comes back.

The last frame is the same view as the first. *Everyone sees something different.
Together, you get the whole story.*

## What it takes from FlyCrooked, and what it doesn't

The owner asked for FlyCrooked's background and impact, so this page deliberately
sits closer to it than the first version did.

| FlyCrooked | Stills |
|---|---|
| Hot pink with lighter sun rays | The same pinks (around `#FE4D8D`), deepening to violet, with flat sunset clouds instead of rays |
| Black woodblock plate with white highlights | The same print language, with its own subject |
| White sun low behind the plate | A white sun behind the cypress trees, which actually sets |
| Many cities, each with its own font | One venue, one type system |
| Pink stays pink until a scene drains it | Sunset to night and back, driven by the guests' flashes |
| Mascot's voice | Quiet copy, with the guests' photos doing the talking |

## Brand system

The marketing page now breaks one rule on purpose. `src/design/colours.ts` says
"Photography supplies the colour in this product". That still holds inside the app
screens, which keep their real ink and ivory, but the page around them is pink
because the owner asked for it.

| Role | Value |
|---|---|
| Sky | `#7A22B8` → `#B5249F` → `#EA2B8C` → `#FE4D8D` → `#FF7EA8` |
| Night | `#31206C`, multiplied over everything |
| Print | `#0A090C` ink, `#FFFBF6` paper |
| The line to your table | `#FF2F7E` |
| Display | Isolde regular and italic |
| Text, UI | Instrument Sans |
| Date stamp | The app's seven-segment orange `#ff7c38`, on photographs only |

Composition stays ranged left, as `docs/brand-system.md` requires.

## Illustration system

| Trait | Rule |
|---|---|
| Medium | A hand-carved linocut: strictly two tones, no grey |
| Weight | About half of everything drawn is solid black, with detail carved out as white lines |
| Simplicity | Few elements, each large with a strong silhouette. Grandeur comes from scale, not from many small things |
| People | Heads about 1:6 of height, long expressive limbs, big clear smiles. Dark clothes and hair are solid black, faces and white clothes stay paper |
| Depth | Sky, then villa and trees, then tables, then large figures |
| Lighting | Long black cast shadows from the low sun, and later the flash |

Source of truth: `scripts/story/prompts.mjs`. Each drawing is black on white, and
`scripts/story/process-art.mjs` makes it transparent where it needs to be.

### Why night is one layer and not a second set of drawings

Night is a single canvas multiplied over the whole scene, so white falls to violet
and black stays black. A flash is a soft hole in it. That keeps one file per drawing
(the first version needed two) and means a pool of light can cross anything without
a seam.

## The cast

Most mirror a real photo in the Stills sample album. There are nine groups, down
from fourteen, drawn larger.

| Who | Moment | Real photo they become |
|---|---|---|
| **Ayla** | Our guest. Curly hair, black jumpsuit. Finds Table 7, shoots | Not one person's photo: she's who you follow |
| **The dad** | White shirt, finger in the air, dancing like no one's watching | `06` |
| **Olivia and her mum** | The long hug | `05` |
| **The little girl and the dog** | A big black dog with a flower collar | `01` |
| **The sing-along** | The loudest corner of the dance floor | `07` |
| **Olivia & Daniel** | Cutting the cake, laughing | `08` |
| **Other shooters** | Man with phone overhead, auntie at arm's length, teen filming | Show that everyone has a camera |

## Photography

The existing sample event library (`assets/sample-event`) is used, with no new
generated photos. It's already candid, flash-lit and warm, and
`docs/visual-assets.md` bans generated wedding photography in production. Some of
the library may itself be generated: see the launch check in `04-assets.md`.

Photos are finished offline with a simplified version of the app's Disposable look:
warm flash colour, grain, soft vignette, and the real seven-segment date stamp
geometry from `disposable-date-stamp.ts`. It's an approximation, not the app's own
render pipeline.

## Type voice

Headlines are short and set large in Isolde, in white. One line of Instrument Sans
at most.

## Product truth

Real screens are rebuilt as live HTML in the phone, with values taken from source:

| Claim | Source |
|---|---|
| No app, no account, just scan | App Store listing; `src/app/j/[slug].tsx` |
| Find your table is optional and host-enabled | `find-your-table.tsx`, shown only when a seating plan exists |
| Limited shots | `viewfinder-shot-counter.tsx`; host-set per event |
| Disposable look is one option | `photo-treatment.ts` |
| Host decides when guests see the gallery | `reveal/state.ts`; App Store listing |

Nothing else is claimed. No fake ratings, counts or testimonials.
