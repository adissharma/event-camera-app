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
  // One setting per use case tab. Same treatment as the venue: the sky is removed, so
  // each one sits on the page's own sky with the phone in front of it.
  {
    id: 'setting-birthday',
    size: '3072x1536',
    quality: 'high',
    refs: ['room'],
    prompt: `${STYLE}

A wide panoramic print of a small, relaxed surprise birthday party among friends in an ordinary back garden after dark, drawn in exactly the same style as the reference, seen straight on from a little above eye level. Homely and scruffy, nothing fancy: no marquee, no tablecloths, no balloons, no tiered cake, no suits, no gowns.
${PEOPLE}
The sky is pure empty white paper and fills the top 35% of the picture. Nothing at all is drawn in the sky.
Along the back, as big simple solid black masses forming one unbroken band from edge to edge: an old brick garden wall thick with climbing ivy, a rough wooden garden gate standing open in it left of centre, the rooftops of terraced houses and big dark trees behind. A sagging string of small round bulbs hangs along the wall, in front of the black, never against the sky.
In front, left of centre and drawn large: a woman in her forties with big curly dark hair and a loose button-up shirt, just through the gate, both hands over her mouth in happy shock. Friends in casual shirts and jumpers stand around her, some seen from behind, clapping, one holding up a smartphone towards her.
To the right, drawn large: a long, worn wooden garden table with paper plates, wine glasses and bottles, and on it one homemade round layer cake crowded with thin lit candles. A little girl with long hair leans in beside it. No writing on anything.
The bottom of the picture is pale paving crossed by long, bold, solid black shadows.`,
  },
  {
    id: 'setting-bach',
    size: '3072x1536',
    quality: 'high',
    refs: ['room'],
    prompt: `${STYLE}

A wide panoramic print of a bachelorette weekend at a glamorous rooftop pool at dusk, drawn in exactly the same style as the reference, seen straight on from a little above eye level.
The sky is pure empty white paper and fills the top 35% of the picture. Nothing at all is drawn in the sky.
Along the back, as big simple solid black masses forming one unbroken band from edge to edge: a skyline of solid black buildings with white windows and tall solid black palm trees.
In front, drawn large: a swimming pool of bold black and white carved ripples, striped sun loungers, big parasols, and a group of friends fully dressed in solid black summer dresses and big sunglasses, dancing with drinks in the air, the bride-to-be in a knee-length white sundress with a small veil in the middle, one of them holding out a smartphone for a selfie. Nobody is in swimwear. No writing on anything.
The bottom of the picture is pale paving crossed by long, bold, solid black shadows.`,
  },
  {
    id: 'setting-trip',
    size: '3072x1536',
    quality: 'high',
    refs: ['room'],
    prompt: `${STYLE}

A wide panoramic print of a group holiday on a Mediterranean beach at dusk, drawn in exactly the same style as the reference, seen straight on from a little above eye level.
The sky is pure empty white paper and fills the top 35% of the picture. Nothing at all is drawn in the sky.
Along the back, as big simple solid black masses forming one unbroken band from edge to edge: solid black headlands and a low white-walled village with black roofs and palm trees, with a solid black sea with carved white lines in front of them and one small fishing boat.
In front, drawn large: pale sand, big parasols, and a man fast asleep on a sun lounger with a straw hat tipped over his face and his mouth open, while a friend crouches next to him, grinning, taking a photo of him on a smartphone. Other friends laugh nearby. No writing on anything.
The bottom of the picture is pale sand crossed by long, bold, solid black shadows.`,
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
  { id: 'uncle-scan', refs: ['dad-a'], prompt: single(`A jolly man in his sixties with a big moustache, glasses pushed up on his forehead and a solid black suit, holding a smartphone out at arm's length in one hand, peering at it, and looking amazed and very pleased with himself that it worked. Three-quarter view facing right. Same print style as the reference.`), size: '1024x1536' },
  { id: 'easel', refs: ['dad-a'], prompt: single(`No people in this one. A tall old wooden easel holding a large seating chart board. The board shows neat rows of small empty boxes and blank lines, with absolutely no writing on it. A small bunch of flowers tied to one leg. Solid black wooden legs with carved white grain. Same print style as the reference.`), size: '1024x1536' },
  { id: 'dare-crew', refs: ['ayla-shoot'], prompt: single(`Three wedding guests going to absurd lengths to get a photo on their smartphones: a shy, neat man in a solid black suit standing on a chair and leaning out precariously, a woman in a black dress lying flat on her back on the floor shooting straight up, and an elegant older lady peering round from behind him with her phone held high. Everyone is thrilled. Drawn as one tight group. Same print style as the reference.`), size: '1536x1024' },
  { id: 'grandad-voice', refs: ['dad-a'], prompt: single(`A grandfather in his eighties with white hair and a solid black suit with a flower in the lapel, sitting on a chair, holding a smartphone up in front of his mouth with both hands like a walkie-talkie, speaking into it with his eyes closed and a small, tender smile. Same print style as the reference.`), size: '1024x1536' },
  { id: 'guest-voice', refs: ['ayla-shoot'], prompt: single(`The mother of the bride in an elegant solid black dress with a small flower corsage, standing, holding a smartphone up near her mouth in one hand like a voice note, speaking into it with her eyes crinkled, laughing and crying at once, a folded handkerchief in her other hand. Warm and completely unguarded. Same print style as the reference.`), size: '1024x1536' },
  { id: 'morning-after', refs: ['hug'], prompt: single(`The morning after a wedding. A barefoot bride in a white dress with her heels on the ground beside her, and a groom with an undone bow tie and his solid black jacket over one shoulder, sitting close together on a low stone step, sharing one smartphone and laughing at what's on it. Tired and completely happy. Drawn as one group. Same print style as the reference.`), size: '1536x1024' },
  { id: 'shooter-teen', refs: ['ayla-shoot'], prompt: single(`A teenage boy in an ill-fitting solid black suit, slouching with one hand in a pocket and casually holding up a smartphone in the other to film something, unimpressed but secretly enjoying it. Three-quarter view. Same print style as the reference.`), size: '1024x1536' },
];
