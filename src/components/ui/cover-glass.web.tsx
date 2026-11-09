import { useId, type CSSProperties } from 'react';
import { useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';

import { colours } from '@/design';
import { useWebCoverMotion } from '@/features/celebrations/use-web-cover-motion';
import { EventGlass, EVENT_GLASS_RADIUS } from '@/components/ui/event-glass';
import type { CoverGlassProps } from '@/components/ui/cover-glass';

/** Baked by scripts/story/bake-glass-map.mjs, and shared with the homepage. */
const GLASS_MAP = '/story/glass-map.png';
/** The map's own shape. The filter works in fractions of its box, so the box keeps this. */
const MAP_ASPECT = 392 / 300;
/** The bend as a fraction of the box; held to a phone's strength on a wider screen. */
const BEND = 0.11;
const BEND_FULL_WIDTH = 430;
const WASH = 'rgba(11, 11, 12, 0.35)';
const RIM_STOPS =
  'rgba(240,242,245,.12) 0, rgba(214,232,255,.65) 7%, #fff 13%, rgba(240,242,245,.18) 24%, rgba(240,242,245,.04) 44%, rgba(214,232,255,.25) 64%, rgba(255,255,255,.85) 74%, rgba(240,242,245,.14) 83%, rgba(225,237,255,.62) 95%, rgba(240,242,245,.12) 100%';

const FILL: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const RIM_MASK = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)';

function uriOf(source: unknown): string | null {
  if (typeof source === 'number') return Asset.fromModule(source).uri;
  if (typeof source === 'string') return source;
  const uri = (source as { uri?: unknown } | null)?.uri;
  return typeof uri === 'string' ? uri : null;
}

/** Phones and tablets, and any window narrower than a tablet. */
const MOBILE_WEB_MAX_WIDTH = 768;

function isMobileWeb(width: number): boolean {
  if (width < MOBILE_WEB_MAX_WIDTH) return true;
  return typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Mobile web always gets `EventGlass`'s tinted blur, by the owner's decision: the
 * bent-glass filter below did not hold up on phones. Do not extend it to mobile web
 * unless the owner explicitly asks. See AGENTS.md.
 */
export function CoverGlass(props: CoverGlassProps) {
  const { width } = useWindowDimensions();
  return isMobileWeb(width) ? <EventGlass /> : <DesktopCoverGlass {...props} />;
}

/**
 * iOS 26's Liquid Glass, as near as a desktop browser gets.
 *
 * A displacement filter can't read what is behind an element in Safari, so this
 * bends its own blurred copy of the cover, lined up with the real one and moved by
 * the same scroll motion, so the copy never drifts. Same wash and foot as `EventGlass`, and the
 * same approach as the homepage's phone mock (`.ev-glass` in public/story/story.css).
 * The foot is measured from where the picture ends, so it lands first however tall
 * the card grows.
 */
function DesktopCoverGlass({ cover, coverTop, coverHeight, reach, motion }: CoverGlassProps) {
  const { width } = useWindowDimensions();
  const coverRef = useWebCoverMotion(motion.distance, motion.follow) as unknown as (el: HTMLDivElement | null) => void;
  const coverUri = uriOf(cover);
  /** How far the picture really runs under the card, which can be short of `reach`. */
  const visible = Math.min(reach, coverTop + coverHeight);
  const filterId = `cover-glass-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div style={FILL} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={filterId} x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage href={GLASS_MAP} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={BEND * Math.min(1, BEND_FULL_WIDTH / width)} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          aspectRatio: MAP_ASPECT,
          overflow: 'hidden',
          background: colours.background,
          filter: `url(#${filterId})`,
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: reach, overflow: 'hidden' }}>
          <div ref={coverRef} style={{ position: 'absolute', left: 0, right: 0, top: coverTop, height: coverHeight }}>
            {coverUri ? (
              <img
                src={coverUri}
                alt=""
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(3px)' }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ ...FILL, background: `linear-gradient(${WASH} 0, ${WASH} ${visible * 0.4}px, ${colours.background} ${visible * 0.95}px)` }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 110,
          maskImage: 'linear-gradient(#000 36%, transparent)',
          WebkitMaskImage: 'linear-gradient(#000 36%, transparent)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0 0 -40px',
            boxSizing: 'border-box',
            borderRadius: `${EVENT_GLASS_RADIUS}px ${EVENT_GLASS_RADIUS}px 0 0`,
            padding: '1px 1px 0',
            background: `linear-gradient(90deg, ${RIM_STOPS})`,
            WebkitMask: RIM_MASK,
            WebkitMaskComposite: 'xor',
            mask: RIM_MASK,
            maskComposite: 'exclude',
          }}
        />
      </div>
    </div>
  );
}
