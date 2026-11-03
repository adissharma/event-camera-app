# Stills.events: creative direction

## The idea: the room gets lit one flash at a time

A wedding reception at night, drawn as one continuous room in **ivory ink on the
near-black Stills canvas**. It reads like a photographic negative.

When a guest's camera flashes, a soft pool of light opens in the room. Inside it
the drawing **develops into a positive**: warm ivory paper with ink lines, and
the people caught in the flash flip with it. Then a **real, full-colour
photograph** of that moment leaves their phone.

One flash lights one corner. That is the argument of the page, shown rather than
told:

- At the start there's one photographer, one pool of light, and a room in the dark.
- Guests scan in. More phones means more pools.
- At the climax the pools merge, the whole room is lit, and the page itself
  turns from ink to ivory.

The last frame is the same room as the first, now fully seen. *Everyone sees
something different. Together, you get the whole story.*

## Why this and not FlyCrooked's approach

FlyCrooked's engine (one stage, one clock, a phone anchor, a world that pays off)
is adapted here. Its look isn't:

| FlyCrooked | Stills |
|---|---|
| Engraved plates on hot pink | Loose pen line, ink ↔ ivory, no spot colour |
| Architecture, tiny people | People first: expression and body language |
| Many cities, each with its own font | One room, one type system |
| Colour = brand pink | Colour = **real photographs only** |
| Mascot's voice | The guests' moments, narrated quietly |

This follows the brand rule in `src/design/colours.ts`: "Photography supplies the
colour in this product. Chrome recedes." The drawing never has colour, which makes
each photograph's arrival an event.

## Brand system (unchanged)

| Role | Token |
|---|---|
| Ink canvas | `#0B0B0C` |
| Ivory line, positive paper | `#EFE9E0` / `#F5F2ED` |
| Champagne: light, table highlight, connecting lines | `#D9C39A` |
| Display | Isolde regular and italic |
| Text, UI | Instrument Sans |
| Eyebrow | 11 px, uppercase, wide-tracked |
| Date stamp | The app's seven-segment orange `#ff7c38`, on photographs only |

Composition stays ranged left, as `docs/brand-system.md` requires. The one
refinement is the ivory-paper state in the climax. It's the brand's own colours
swapped, and `docs/brand-system.md` already keeps a light direction in reserve.

## Illustration system

| Trait | Rule |
|---|---|
| Line | One loose, confident pen line with some wobble and varying weight, like a fine brush pen. Sparse hatching, used only for shadow |
| Fills | None in the source art. Interiors are blank paper, and solid black is limited to small accents so the negative stays readable |
| Proportions | Heads about 1:5.5 of height, slightly oversized hands, small feet, long limbs that exaggerate a gesture |
| Faces | Dots or small arcs for eyes, a big mouth when laughing. Readable at 80 px tall |
| Humour | Observed, not slapstick: the waiter's impossible tray, the dad dance, a phone held at arm's length |
| People | Mixed ages, sizes and backgrounds; realistic evening clothes. Not glamorous or idealised |
| Depth | Three layers: room plate, mid-room figures, foreground figures slightly larger |
| Lighting | Only one kind: the flash. No drawn shading implies another source |

Source of truth: `scripts/story/prompts.mjs` holds prompts and the master style
paragraph. Generated art is black line on white, then processed by
`scripts/story/process-art.mjs` into matched negative and positive files, so the
two states align pixel for pixel.

### Why a line plate and not two generations

Two separately generated versions of a scene never align exactly. One line plate
yields both states by processing, which also makes a pool of light cross it
without any seam. It's the decision that makes the central effect possible.

## The cast

They appear throughout, and most mirror a real photo in the Stills sample album.

| Who | Moment | Real photo they become |
|---|---|---|
| **Ayla** | Our guest. Curly hair, jumpsuit. Finds Table 7, shoots | Not one person's photo: she's who you follow |
| **The dad** | White shirt, finger in the air, dancing like no one's watching | `06` |
| **Olivia and her mum** | The long hug | `05` |
| **The aunt at Table 4** | Dabbing her eyes through the speeches | `03`, `04` |
| **The little girl and the dog** | Golden retriever with a flower collar | `01` |
| **The running flower girls** | Late for nothing | `02` |
| **The sing-along** | The loudest corner of the dance floor | `07` |
| **Olivia & Daniel** | Cutting the cake, laughing | `08` |
| **The waiter** | Too many glasses | Humour, ambient |
| **Other shooters** | Man with phone overhead, aunt at arm's length, teen filming | Show that everyone has a camera |
| **The photographer** | Big camera, at the head table | Sets up the premise |

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

Headlines are short and set large in Isolde. One line of Instrument Sans at most.
Isolde Italic is used for small notes that sit beside a moment in the room, like
someone pointing it out to you at the party.

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
