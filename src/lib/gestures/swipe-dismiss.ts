export interface SwipeDismissThresholds {
  /** A drag at least this far dismisses, whatever its speed. */
  distance: number;
  /** A flick has to have travelled at least this far... */
  flickDistance: number;
  /** ...at this speed, in whichever unit the gesture reports its velocity. */
  flickVelocity: number;
}

/**
 * Which way a released drag dismisses a full screen viewer: `1` down, `-1` up, or
 * `0` if it should settle back. Up and down are treated alike. A flick only counts
 * if it is moving the same way the drag went, so dragging down and then flicking
 * back up is someone changing their mind.
 */
export function swipeDismissDirection(
  translation: number,
  velocity: number,
  { distance, flickDistance, flickVelocity }: SwipeDismissThresholds,
): -1 | 0 | 1 {
  const direction = translation < 0 ? -1 : 1;
  const travelled = Math.abs(translation);
  if (travelled >= distance) return direction;
  if (travelled >= flickDistance && velocity * direction >= flickVelocity) return direction;
  return 0;
}
