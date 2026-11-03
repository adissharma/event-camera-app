/**
 * Prompts for every generated illustration on the homepage story.
 *
 * Kept with the code so any asset can be regenerated. `refs` names earlier
 * outputs passed as image references, which is how the cast stays consistent:
 * see docs/story-site/04-assets.md.
 */

export const STYLE = `Hand-drawn editorial pen illustration. Pure black ink on a pure white background, nothing else.
A single loose, confident brush-pen line with a natural wobble and slightly varying weight, as if drawn fast by a witty magazine cartoonist.
Very sparse hatching only for small shadows. No grey, no wash, no gradient, no shading, no solid black shapes bigger than a coin: dark suits and dark hair are outlined with a few hatch strokes and stay mostly white paper.
No text, no letters, no numbers, no logo, no frame, no border, no signature.
People have heads about 1/5.5 of their height, long expressive limbs, slightly oversized hands, small feet, simple dot eyes, small arc brows and big readable mouths.
A mix of ages, body types and backgrounds in realistic contemporary evening clothes. Warm, funny, affectionate, observed from life. Not glamorous, not cute, not corporate.`;

const single = (subject) => `${STYLE}

${subject}
One standalone drawing, full figure, feet fully visible, centred with a wide white margin on every side. No floor line, no background, no furniture unless described. Every enclosed shape is left blank white paper.`;

export const PLATES = [
  {
    id: 'room',
    size: '3840x1440',
    quality: 'high',
    prompt: `${STYLE}

An extremely wide panoramic drawing of one evening wedding reception in a walled courtyard, seen straight on from a little above eye level, with everything in a single continuous space.
The top 40% of the picture is completely empty white paper: no sky, no lights, no wires, nothing. Do not draw any string lights or bulbs.
From left to right along the back: a stone archway entrance with a small welcome table and an easel holding a large blank board; old stone wall with arched windows; olive trees in pots; a small band on a low stage; tall glass doors; a long head table with flowers.
Across the floor, left to right: an open area near the entrance; then eight round dinner tables with white cloths, chairs, flowers, glasses and a small blank tent card on each; then a large empty parquet dance floor; then a round cake table with a tiered cake at far right.
Many tiny background guests are seated at the far tables and chatting in small groups along the back wall, drawn with a few quick strokes. The front-most floor and the whole dance floor are empty, with no people.
Keep the line weight consistent. The floor area stays mostly white with only a few strokes.`,
  },
];

export const FIGURES = [
  // Anchor drawings: everything after these is referenced against them.
  { id: 'ayla-shoot', prompt: single(`Ayla, a woman in her thirties with big curly hair and a simple wide-leg jumpsuit, standing and holding a smartphone up in both hands to take a photo, delighted, leaning slightly back and laughing. The phone is seen edge-on from the side. She is shown in three-quarter view facing right.`), size: '1024x1536' },
  { id: 'dad-a', prompt: single(`A man in his sixties with white hair, white shirt with rolled sleeves and grey trousers, dancing with total commitment and no skill. One arm straight up with one finger pointing at the sky, other arm low, knees bent, eyes shut, huge grin. Three-quarter view.`), size: '1024x1536' },

  { id: 'ayla-scan', refs: ['ayla-shoot'], prompt: single(`The same woman Ayla, same hair, same jumpsuit, same line quality, standing and holding her phone out at chest height with both hands, looking down at it with a curious half smile, as if pointing it at something. Three-quarter view facing right.`), size: '1024x1536' },
  { id: 'ayla-walk-a', refs: ['ayla-shoot'], prompt: single(`The same woman Ayla, same hair, same jumpsuit, same line quality, walking to the right mid-stride with her left foot forward, one hand holding a phone and glancing at it, other arm swinging. Side view facing right.`), size: '1024x1536' },
  { id: 'ayla-walk-b', refs: ['ayla-walk-a'], prompt: single(`Exactly the same woman, same drawing style, same scale and same position, but with her legs passing each other in the middle of her stride: feet close together, one knee slightly bent and lifting, trousers hanging straighter. She still holds her phone in the same hand. The legs must look clearly different from the reference. Side view facing right.`), size: '1024x1536' },
  { id: 'dad-b', refs: ['dad-a'], prompt: single(`Exactly the same man at the same scale and same position in the frame, the next moment of the same dance: both knees bent the other way, hips out, finger now pointing up with the opposite arm, big grin. Change only the pose.`), size: '1024x1536' },

  { id: 'hug', refs: ['dad-a'], prompt: single(`A bride with dark hair in a simple slip dress and her mother, shorter, with cropped curly hair and a dark sheer dress, in a long tight hug. Eyes closed, cheeks pressed together, the mother's hand holding the back of the bride's head. Two people drawn as one group. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'aunt', refs: ['dad-a'], prompt: single(`An aunt in her fifties with a soft updo and a lacy dress, seated in a chair at the corner of a round table, dabbing her eye with a napkin while laughing, with a wine glass and a small flower arrangement in front of her. The man next to her in a waistcoat is laughing at her. Two people at a small piece of table, drawn as one group. Same line quality as the reference.`), size: '1536x1024' },
  { id: 'girl-dog', refs: ['dad-a'], prompt: single(`A little girl of about five in a party dress, crouching with both hands in the fur of a big happy golden retriever wearing a collar of flowers. The dog is grinning with its tongue out. Same line quality as the reference.`), size: '1536x1024' },
  { id: 'flower-girls', refs: ['dad-a'], prompt: single(`Two small flower girls in white dresses and white socks sprinting across the frame with enormous joy, hair flying, one looking back at the other. Same line quality as the reference.`), size: '1536x1024' },
  { id: 'singalong', refs: ['dad-a'], prompt: single(`A tight group of five friends in their thirties singing at the top of their lungs with their arms around each other: mouths wide open, one man with an undone bow tie, one woman with a raised glass, one man pointing up. Drawn as one group. Same line quality as the reference.`), size: '1536x1024' },
  { id: 'cake', refs: ['dad-a'], prompt: single(`Olivia and Daniel, a laughing bride in a lacy dress with fair hair pinned back and a groom with dark curls in a dinner jacket, cutting a small tiered cake together, heads bent together, cracking up about something. The cake stands on a small round table. Drawn as one group. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'waiter', refs: ['dad-a'], prompt: single(`A thin young waiter in a white shirt and bow tie, walking very carefully with an enormous impossibly stacked tray of champagne glasses balanced on one hand, looking up at it with terrified concentration. Three-quarter view. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'photographer', refs: ['dad-a'], prompt: single(`A professional wedding photographer in dark practical clothes with two big cameras on straps, crouching on one knee and looking through a large camera with a flash head. Serious and focused. Side view facing right. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'shooter-overhead', refs: ['ayla-shoot'], prompt: single(`A tall bearded man in a loosened tie holding a smartphone high overhead with one arm to take a photo over a crowd, squinting up at the screen. Three-quarter view. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'shooter-auntie', refs: ['ayla-shoot'], prompt: single(`An older South Asian woman in a beautifully draped sari holding a smartphone out at full arm's length with both hands, head tilted back to see the screen, utterly determined. Three-quarter view. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'shooter-teen', refs: ['ayla-shoot'], prompt: single(`A teenage boy in an ill-fitting suit, slouching with one hand in a pocket and casually holding up a smartphone in the other to film something, unimpressed but secretly enjoying it. Three-quarter view. Same line quality as the reference.`), size: '1024x1536' },
  { id: 'shooter-grandad', refs: ['ayla-shoot'], prompt: single(`A Black grandfather in a sharp three-piece suit and a flat cap, sitting on a chair and taking a photo with a smartphone held in one big hand, one eye closed as if using a real camera, smiling. Three-quarter view. Same line quality as the reference.`), size: '1024x1536' },
];
