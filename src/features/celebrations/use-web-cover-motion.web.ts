import { useLayoutEffect, useState } from 'react';
import type { View } from 'react-native';

/** Keep the cover on the browser's scrolling timeline, outside React/Animated. */
export function useWebCoverMotion(distance: number, follow: number) {
  const [view, setView] = useState<View | null>(null);

  useLayoutEffect(() => {
    const image = view as unknown as HTMLElement | null;
    if (!image) return;
    let scroller = image.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    const source = scroller;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const Timeline = (window as unknown as {
      ScrollTimeline?: new (options: { source: HTMLElement; axis: string }) => AnimationTimeline;
    }).ScrollTimeline;
    let animation: Animation | undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = reduced.matches ? 0 : Math.min(distance, Math.max(0, source.scrollTop)) * follow;
      image.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const onScroll = () => {
      if (!animation && !frame) frame = requestAnimationFrame(update);
    };
    const configure = () => {
      cancelAnimationFrame(frame);
      animation?.cancel();
      animation = undefined;
      update();
      if (Timeline && CSS.supports('animation-range-end', `${distance}px`) && !reduced.matches) {
        animation = image.animate(
          [{ transform: 'translate3d(0, 0, 0)' },
            { transform: `translate3d(0, ${distance * follow}px, 0)` }],
          {
            timeline: new Timeline({ source, axis: 'y' }),
            rangeStart: '0px',
            rangeEnd: `${distance}px`,
            fill: 'both',
            easing: 'linear',
          } as KeyframeAnimationOptions,
        );
      }
    };
    image.style.willChange = 'transform';
    configure();
    source.addEventListener('scroll', onScroll, { passive: true });
    reduced.addEventListener('change', configure);
    return () => {
      animation?.cancel();
      cancelAnimationFrame(frame);
      source.removeEventListener('scroll', onScroll);
      reduced.removeEventListener('change', configure);
      image.style.willChange = '';
      image.style.transform = '';
    };
  }, [view, distance, follow]);

  return setView;
}
