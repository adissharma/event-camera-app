# Motion system

Tokens: `src/design/motion.ts`. Resolver: `useMotion()`. Primitive: `<Reveal>`.

Motion exists to explain — what changed, what caused it, what is now available.
It is never decoration.

## Three tiers

| Tier | Range | Token | Used for |
|---|---|---|---|
| Micro | 120–220ms | `microFast` `micro` `microSlow` | Press states, option selection, toggles, theme / photo-limit / QR-template choice |
| Standard | 200–320ms | `standardFast` `standard` `standardSlow` | Step changes, bottom sheets, advanced-option disclosure, validation messages, preview updates |
| Emotional | 350–550ms | `emotionalFast` `emotional` `emotionalSlow` | Publication, QR generation, package upgrade, first event on home, Memory Book unlock |

## The connecting motif

Borrowed as a *principle* from MindMarket, not as a visual (see
`docs/reference-audit.md`): one element carries continuity across the creation
flow rather than each step arriving as an isolated screen.

Here that element is the progress thread — it persists across every step and
changes state, and it never disappears and reappears. The cover editor and the
guest preview are connected the same way: the cover transforms into the device
frame rather than cross-fading between two unrelated compositions.

## Rules

- **Interruptible.** No animation blocks input. A user who taps through a
  staggered reveal gets the end state immediately.
- **Affected elements only.** Changing the photo limit updates the counter and
  the preview. It does not re-run a screen transition.
- **No artificial delay.** Nothing is slowed down to feel substantial.
- **Stagger is capped** at 6 items (`stagger.maxItems`). Beyond that the last
  item's wait reads as lag rather than choreography.
- **Springs are restrained.** `gentle` and `responsive` barely overshoot.
  `celebratory` is the only springy one and is reserved for publication.
- **Confetti is not used** for ordinary interactions.

## Reduce motion

`useMotion()` reads `AccessibilityInfo.isReduceMotionEnabled()` and subscribes
to changes. When enabled:

- every duration collapses to `REDUCED_MOTION_DURATION` (120ms);
- translation distances become `0`;
- stagger delays become `0`;
- springs become critically damped (no oscillation).

Meaning is preserved — the element still fades in, so "something new arrived"
still reads. Only the movement is removed. No information is conveyed by motion
alone anywhere in the app.

## Implementation note: why `<Reveal>` does not use `entering=`

Reanimated's `entering=` layout animations take the element **out of normal
flow** on React Native Web for the duration of the transition. Any parent sized
by its children collapses to its padding and the content overflows it. This was
observed directly on the welcome screen, where the statement block collapsed to
56pt while its children rendered outside it.

`<Reveal>` therefore drives opacity and transform through `useAnimatedStyle`,
which keeps the element in flow on every platform and behaves identically on
iOS and Android.

Two further defects were found and fixed while building it, both worth knowing
about because they recur:

1. **A worklet cannot call an ordinary JS closure.** `useAnimatedStyle` runs on
   the UI thread; calling `motion.translate(...)` inside it leaves the value
   unresolved. Resolve to primitives on the JS thread first.
2. **Do not depend on the `motion` object in the effect.** A new object identity
   restarts the timing every render, stranding the animation a few percent in —
   which presents as a permanently invisible element. Depend on the resolved
   numbers.

### Guaranteed settle

`<Reveal>` schedules a timeout at `delay + duration + 250ms` that snaps to the
final state if the animation has not completed.

Content must never be invisible because an animation failed to run. Reanimated's
timing clock does not advance under React Native Web in this project's
configuration, and a device can drop the frame loop while backgrounded. An
entrance animation is an enhancement; legibility is not.
