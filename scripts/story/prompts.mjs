/**
 * Prompts for every generated illustration on the homepage story.
 *
 * Kept with the code so any asset can be regenerated. `refs` names earlier
 * outputs passed as image references, which is how the cast stays consistent:
 * see docs/story-site/04-assets.md.
 */

export const STYLE = `A bold hand-carved linocut block print. Pure black ink on pure white paper, nothing else: strictly two tones, no grey, no wash, no gradient.
High contrast and graphic, like a Japanese woodblock poster. Big confident shapes filled with solid black, about half of everything drawn is solid black, and detail is carved out of the black as crisp white gouge lines. Carved hatching only where a shadow meets a light area.
Simple, uncluttered and instantly readable from far away. Few elements, each one large and clear. Every shape has a strong silhouette.
No text, no letters, no numbers, no logo, no frame, no border, no signature.`;

const PEOPLE = `People are drawn with warmth and humour: heads about 1/6 of their height, long expressive limbs, confident gestures, simple faces with clear big smiles. Dark suits, dark hair and dark dresses are solid black with a few carved white lines for folds. Faces, hands and white clothes stay white paper with a bold black outline. A mix of ages, body types and backgrounds in contemporary evening clothes.`;

const single = (subject) => `${STYLE}
${PEOPLE}

${subject}
One standalone figure group, full body, feet fully visible, centred with a wide pure white margin on every side. No floor, no ground shadow, no background, no furniture unless described.`;

export const PLATES = [
  {
    id: 'room',
    size: '3840x1440',
    quality: 'high',
    prompt: `${STYLE}

An extremely wide panoramic print of one grand wedding reception on the stone terrace of an Italian hilltop villa at dusk, seen straight on from a little above eye level. A single continuous space with lots of open room.
The sky is pure empty white paper and fills the whole top of the picture. Nothing at all is drawn in the sky: no clouds, sun, birds, wires or lights. The tallest things reach only 25% down from the top edge, and all of the rest of the skyline is lower.
Back row, left to right, as big simple black masses with a clean skyline against the white: a tall stone archway gate at far left; a few tall solid black cypress trees; a monumental villa in the centre, very large and filling the height of the picture up to the skyline, with one row of five huge arches glowing white inside, a heavy solid black roof and a bold simple facade with big areas of solid black shadow; more cypress trees; solid black rolling hills at far right. The band behind the terrace is unbroken solid black from edge to edge, with no white gaps between trees, hills and buildings.
On the terrace in front, left to right, drawn very large and close to the viewer: at far left a small welcome table with a white cloth beside the gate; then exactly five big round dinner tables with long white tablecloths, each table about 12% of the picture's width, each with one simple bunch of flowers and solid black chairs; then a wide completely empty dance floor of big black and white checkerboard tiles; then at far right a long head table with a white cloth and big flowers under a simple arch of solid black leaves.
A low stone balustrade runs along the back of the terrace. Huge solid black olive tree branches frame the two bottom corners. No people anywhere, the terrace is empty and ready for the party.
The floor is pale stone crossed by long, bold, solid black cast shadows from the low sun: each table, tree and pillar throws a long black shadow stretching down towards the viewer, so that the bottom of the picture feels heavy and dramatic while still leaving broad pale areas where figures can stand.`,
  },
  {
    id: 'clouds',
    size: '3840x2160',
    quality: 'high',
    prompt: `A flat graphic sky of stylised sunset clouds for a Japanese woodblock poster, made of flat shapes with crisp carved edges, on a pure solid black background.
Long horizontal bands of billowing evening clouds with scalloped, curling edges, sweeping across the frame in layers and getting bigger and denser towards the bottom. The cloud shapes use exactly three flat tones: pure white on their sunlit lower edges, a mid grey for their bodies, and a dark grey for the farthest thin wisps. No soft airbrush, no gradient, no realistic texture.
The upper third of the picture is mostly empty black with only a few thin wisps. There is a large gap in the clouds at the lower centre of the picture. No sun, no moon, no stars, no birds, no land, no text.`,
  },
];

export const FIGURES = [
  // Anchor drawings: everything after these is referenced against them.
  { id: 'ayla-shoot', prompt: single(`Ayla, a woman in her thirties with big curly black hair and a simple wide-leg black jumpsuit, standing and holding a smartphone up in both hands to take a photo, delighted, leaning slightly back and laughing. The phone is seen edge-on from the side. Three-quarter view facing right.`), size: '1024x1536' },
  { id: 'dad-a', prompt: single(`A man in his sixties with white hair, a white shirt with rolled sleeves and solid black trousers, dancing with total commitment and no skill. One arm straight up with one finger pointing at the sky, other arm low, knees bent, eyes shut, huge grin. Three-quarter view.`), size: '1024x1536' },

  { id: 'ayla-scan', refs: ['ayla-shoot'], prompt: single(`The same woman Ayla, same hair, same black jumpsuit, same print style, standing and holding her phone out at chest height with both hands, looking down at it with a curious half smile, as if pointing it at something. Three-quarter view facing right.`), size: '1024x1536' },
  { id: 'ayla-walk-a', refs: ['ayla-shoot'], prompt: single(`The same woman Ayla, same hair, same black jumpsuit, same print style, walking to the right mid-stride with her left foot forward, one hand holding a phone and glancing at it, other arm swinging. Side view facing right.`), size: '1024x1536' },
  { id: 'ayla-walk-b', refs: ['ayla-walk-a'], prompt: single(`Exactly the same woman, same print style, same scale and same position, but with her legs passing each other in the middle of her stride: feet close together, one knee slightly bent and lifting. She still holds her phone in the same hand. The legs must look clearly different from the reference. Side view facing right.`), size: '1024x1536' },
  { id: 'dad-b', refs: ['dad-a'], prompt: single(`Exactly the same man at the same scale and same position in the frame, the next moment of the same dance: both knees bent the other way, hips out, finger now pointing up with the opposite arm, big grin. Change only the pose.`), size: '1024x1536' },

  { id: 'hug', refs: ['dad-a'], prompt: single(`A bride with dark hair in a simple white slip dress and her mother, shorter, with cropped curly hair and a solid black dress, in a long tight hug. Eyes closed, cheeks pressed together, the mother's hand holding the back of the bride's head. Two people drawn as one group. Same print style as the reference.`), size: '1024x1536' },
  { id: 'girl-dog', refs: ['dad-a'], prompt: single(`A little girl of about five in a white party dress, crouching with both hands in the fur of a big happy dog with a solid black coat and a collar of white flowers. The dog is grinning with its tongue out. Same print style as the reference.`), size: '1536x1024' },
  { id: 'singalong', refs: ['dad-a'], prompt: single(`A tight group of four friends in their thirties singing at the top of their lungs with their arms around each other: mouths wide open, one man in a black suit with an undone bow tie, one woman in a black dress with a raised glass, one man pointing up. Drawn as one group. Same print style as the reference.`), size: '1536x1024' },
  { id: 'cake', refs: ['dad-a'], prompt: single(`Olivia and Daniel, a laughing bride in a white lace dress with fair hair pinned back and a groom with dark curls in a solid black dinner jacket, cutting a tall white tiered cake together, heads bent together, cracking up about something. The cake stands on a small round table. Drawn as one group. Same print style as the reference.`), size: '1024x1536' },
  { id: 'shooter-overhead', refs: ['ayla-shoot'], prompt: single(`A tall bearded man in a solid black suit with a loosened tie, holding a smartphone high overhead with one arm to take a photo over a crowd, squinting up at the screen. Three-quarter view. Same print style as the reference.`), size: '1024x1536' },
  { id: 'shooter-auntie', refs: ['ayla-shoot'], prompt: single(`An older South Asian woman in a beautifully draped sari with bold black and white patterned borders, holding a smartphone out at full arm's length with both hands, head tilted back to see the screen, utterly determined. Three-quarter view. Same print style as the reference.`), size: '1024x1536' },
  { id: 'shooter-teen', refs: ['ayla-shoot'], prompt: single(`A teenage boy in an ill-fitting solid black suit, slouching with one hand in a pocket and casually holding up a smartphone in the other to film something, unimpressed but secretly enjoying it. Three-quarter view. Same print style as the reference.`), size: '1024x1536' },
];
