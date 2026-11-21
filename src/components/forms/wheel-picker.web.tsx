import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { AppText } from '@/components/ui/text';
import { colours, layout, spacing } from '@/design';

export const WHEEL_ROW_HEIGHT = 48;
const DEFAULT_VISIBLE_ROWS = 5;
/** How long the wheel must sit still before its position counts as chosen. */
const SETTLE_MS = 140;
/** How much of a neighbouring row shows through, matching the native fades. */
const NEIGHBOUR_ALPHA = 0.28;

export interface WheelPickerProps<T extends string | number> {
  values: T[];
  selectedIndex: number;
  onChange: (index: number) => void;
  formatValue?: (value: T) => string;
  accessibilityLabel: string;
  width?: number;
  /** Unused here: the fades are a mask, so they suit whatever is behind them. */
  fadeColor?: string;
  /** Rows shown at once, selected row included. Must be odd. */
  visibleRows?: number;
  /** Shows the selection alone, with no neighbours and no scrolling. */
  locked?: boolean;
}

const WHEEL_CSS = `
.wheel-scroll { scrollbar-width: none; scroll-snap-type: y mandatory; overscroll-behavior: contain; }
.wheel-scroll::-webkit-scrollbar { display: none; }
.wheel-row { scroll-snap-align: center; cursor: pointer; }
.wheel:focus { outline: none; }
.wheel:focus-visible { outline: 2px solid ${colours.focusRing}; outline-offset: 4px; border-radius: 8px; }
`;

/**
 * The wheel, for a browser.
 *
 * It looks the same as the native one and is the same idea, but a browser
 * gives it different things to work with. A list there reports no "momentum
 * ended", and a mouse has no fling at all, so the native wheel's way of
 * knowing a value was chosen never fires. This one treats the wheel coming to
 * rest as the choice, lets the browser's own scroll snapping find the row, and
 * adds what a desk needs: click a row to choose it, or use the arrow keys.
 *
 * The top and bottom fades are a mask rather than blocks of canvas colour, so
 * the wheel reads correctly on any background.
 */
export function WheelPicker<T extends string | number>({
  values,
  selectedIndex,
  onChange,
  formatValue = String,
  accessibilityLabel,
  width = 96,
  visibleRows = DEFAULT_VISIBLE_ROWS,
  locked = false,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSettled = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(selectedIndex * WHEEL_ROW_HEIGHT);
  const edgePadding = WHEEL_ROW_HEIGHT * Math.floor(visibleRows / 2);
  const height = WHEEL_ROW_HEIGHT * visibleRows;

  // Read by the settle timer, which outlives the render that started it.
  const latest = useRef({ selectedIndex, onChange, count: values.length });
  latest.current = { selectedIndex, onChange, count: values.length };

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  // The opening position is simply correct; a later change made elsewhere is
  // shown as the wheel moving to it.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const target = selectedIndex * WHEEL_ROW_HEIGHT;
    if (Math.abs(element.scrollTop - target) > 1) {
      element.scrollTo({ top: target, behavior: hasSettled.current ? 'smooth' : 'auto' });
    }
    if (!hasSettled.current) setOffset(target);
    hasSettled.current = true;
  }, [selectedIndex, values.length]);

  function clamp(index: number) {
    return Math.max(0, Math.min(latest.current.count - 1, index));
  }

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    setOffset(element.scrollTop);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      const next = clamp(Math.round(element.scrollTop / WHEEL_ROW_HEIGHT));
      if (next !== latest.current.selectedIndex) latest.current.onChange(next);
    }, SETTLE_MS);
  }

  function choose(index: number) {
    if (locked) return;
    const next = clamp(index);
    if (next !== selectedIndex) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowUp: selectedIndex - 1,
      ArrowDown: selectedIndex + 1,
      PageUp: selectedIndex - 3,
      PageDown: selectedIndex + 3,
      Home: 0,
      End: values.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
  }

  const selected = values[selectedIndex];
  const mask = `linear-gradient(to bottom, rgba(0,0,0,${NEIGHBOUR_ALPHA}) ${edgePadding}px, #000 ${edgePadding}px, #000 ${edgePadding + WHEEL_ROW_HEIGHT}px, rgba(0,0,0,${NEIGHBOUR_ALPHA}) ${edgePadding + WHEEL_ROW_HEIGHT}px)`;

  return (
    <div
      className="wheel"
      role="spinbutton"
      tabIndex={locked ? -1 : 0}
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={values.length - 1}
      aria-valuenow={selectedIndex}
      aria-valuetext={selected === undefined ? undefined : formatValue(selected)}
      aria-disabled={locked || undefined}
      onKeyDown={locked ? undefined : handleKeyDown}
      style={{ position: 'relative', width, height, flex: 'none' }}
    >
      <style dangerouslySetInnerHTML={{ __html: WHEEL_CSS }} />
      <div
        ref={scrollRef}
        className="wheel-scroll"
        onScroll={handleScroll}
        style={{
          height,
          overflowY: locked ? 'hidden' : 'auto',
          padding: `${edgePadding}px 0`,
          boxSizing: 'border-box',
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {values.map((value, index) => {
          const distance = Math.min(Math.abs(offset - index * WHEEL_ROW_HEIGHT) / (WHEEL_ROW_HEIGHT * 2), 1);
          return (
            <div
              key={`${String(value)}-${index}`}
              className="wheel-row"
              onClick={() => choose(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: WHEEL_ROW_HEIGHT,
                padding: `0 ${spacing.xs}px`,
                opacity: 1 - distance * 0.55,
                transform: `scale(${1 - distance * 0.18})`,
                visibility: locked && index !== selectedIndex ? 'hidden' : undefined,
              }}
            >
              <AppText variant="titleMedium" align="center" numberOfLines={1} style={{ width: '100%' }}>
                {formatValue(value)}
              </AppText>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: edgePadding,
          height: WHEEL_ROW_HEIGHT,
          boxSizing: 'border-box',
          borderTop: `${layout.hairline}px solid ${colours.borderSubtle}`,
          borderBottom: `${layout.hairline}px solid ${colours.borderSubtle}`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
