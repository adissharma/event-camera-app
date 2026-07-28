# Form patterns

The creation flow is the product. These rules are binding on every step.

## Structure

- **One meaningful decision per screen.** If a screen has two decisions, one of
  them belongs in advanced settings or on its own step.
- **Persistent progress indicator** — the connecting thread, not a bare bar.
- **Sticky bottom action**, outside the scroll view, above the safe area, so it
  never scrolls away and never lands under the keyboard. Implemented in
  `<Screen stickyAction={…}>`.
- **Automatic draft saving** on every change, plus restoration after an
  interruption.
- **Backwards navigation never loses state.**
- **Live guest preview** wherever a setting changes what a guest will see.

## Control selection

| Situation | Control | Never |
|---|---|---|
| Mutually exclusive, descriptive options (privacy, reveal) | Radio cards | Toggles |
| Mutually exclusive, short options (photo limit) | Option cards / segmented | A dropdown |
| Independent on/off (PIN, downloads, approval) | Toggle | Radio |
| Controlled numbers | Stepper | Free text |
| Advanced or rarely-changed settings | Bottom sheet | An always-visible field |
| A few short choices | Segmented control | More than 4 segments |

Toggles are only ever used for genuinely independent settings. Using a toggle
for a mutually exclusive choice is the single most common way a settings screen
becomes ambiguous.

## Labels and input

- **Visible labels always.** Placeholder-only labelling is never used — the
  label disappears exactly when the user needs it.
- Appropriate keyboard per field (`email-address`, `number-pad`, …).
- Native date and time controls.
- Minimum 48pt touch targets (`layout.minTouchTarget`), exceeding both iOS 44pt
  and Android 48dp guidance.
- One-handed reachability: the primary action sits in the bottom third.

## Validation

- **Only after meaningful interaction** — never while the user is still typing
  their first character.
- **Plain language.** "Choose a closing date after the event starts", not
  "Invalid date range".
- **Focus and scroll to the first error.**
- **Errors are announced** to screen readers and carry an icon, not just colour.
- **When the primary action is unavailable, say why.** A disabled `Next` with no
  explanation is a dead end; `Button` takes a `disabledReason` that is both
  announced and displayed.

## Review screen

- Every consequential setting is listed with a direct edit action.
- Editing returns to review with all other choices intact.
- Price and entitlements are shown as they will actually be charged.

## Accessibility

- Logical focus order, semantic roles, `accessibilityState` for selected /
  disabled / busy.
- Dynamic Type throughout, with per-role caps.
- Layouts tested at the largest accessibility text size — the sticky action must
  remain visible and the hero yields space, never the action.
- Reduced-motion equivalents for every transition.
