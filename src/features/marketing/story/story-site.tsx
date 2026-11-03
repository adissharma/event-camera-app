import type { ReactNode } from 'react';

import { ASSET, CHAPTERS, GALLERY, LINKS, MEMORIES, NOTES, art, print } from './content';
import { Invitation, Phone } from './phone';
import { FESTOON, FIGURES, TENTS, WORLD, figure, figureSize } from './world';

/**
 * The public homepage's markup: one illustrated reception, told by scrolling.
 *
 * Plain DOM with no hooks. `scripts/story/build-home.mjs` renders this once to
 * static HTML and `entry.ts` animates it, so the homepage needs neither React nor
 * the React Native bundle in the browser. The app's root layout renders nothing
 * until its fonts load, which would otherwise leave this page empty until a
 * multi-megabyte bundle had booted.
 *
 * Two modes share this one DOM. By default it's a linear page of captioned stills,
 * which is what reduced-motion and no-JavaScript visitors get. `STORY_HEAD_SCRIPT`
 * adds `.story-live` before first paint for everyone else.
 */

/** Runs in the head. Falls back to the linear page if the script never boots. */
export const STORY_HEAD_SCRIPT = `(function(){var d=document.documentElement;if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('story-live');setTimeout(function(){var r=document.querySelector('.story');if(r&&!r.dataset.booted)d.classList.remove('story-live')},8000)})();`;

/** Back-layer prints. The first six come from the room's flashes, the next three from the camera scene. */
const PRINT_POOL = ['p07', 'p06', 'p05', 'p02', 'p01', 'p04', 'p06', 'p07', 'p03', 'p08', 'p12', 'p01', 'p14', 'p10', 'p04', 'p11', 'p05', 'p02', 'p13', 'p08', 'p03', 'p07', 'p01', 'p12'];
const FRONT_COUNT = 4;

function catenary(x0: number, y0: number, x1: number, y1: number, sag: number, p: number) {
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p + sag * 4 * p * (1 - p) };
}

function Festoon() {
  let bulb = 0;
  return (
    <svg className="festoon" viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} data-el="festoonGlow">
      <defs>
        <radialGradient id="bulbGlow">
          <stop offset="0" stopColor="#ffe7b3" stopOpacity=".95" />
          <stop offset=".3" stopColor="#f0cf8e" stopOpacity=".35" />
          <stop offset="1" stopColor="#d9c39a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {FESTOON.slice(1).map((f) => (
        <path key={f.x0} className="pole" d={`M${f.x0} ${f.y0 - 6} L${f.x0 + 3} 640`} />
      ))}
      {FESTOON.map((f, i) => {
        const mid = catenary(f.x0, f.y0, f.x1, f.y1, f.sag, 0.5);
        const count = Math.round((f.x1 - f.x0) / 74);
        return (
          <g key={i}>
            <path d={`M${f.x0} ${f.y0} Q${mid.x} ${mid.y + f.sag} ${f.x1} ${f.y1}`} />
            {Array.from({ length: count }, (_, k) => {
              const p = (k + 0.5) / count;
              const at = catenary(f.x0, f.y0, f.x1, f.y1, f.sag, p);
              const delay = 0.15 + bulb++ * 0.022;
              return (
                <g key={k} className="bulb-g" style={{ animationDelay: `${delay}s` }}>
                  <circle className="bulb-glow" cx={at.x} cy={at.y + 12} r={42} />
                  <ellipse className="bulb" cx={at.x} cy={at.y + 12} rx={7} ry={9.5} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function Figure({ id }: { id: string }) {
  const def = figure(id);
  const size = figureSize(def);
  return (
    <div className="fig" data-el={`fig:${id}`} style={{ width: size.w, height: size.h }}>
      {def.frames.map((frame, i) => (
        <div
          key={frame}
          className={`fig-frame${def.flip ? (i === 0 ? ' flip-a' : ' flip-b') : ''}`}
          data-group={`frame:${id}`}
        >
          <img data-src={art(frame, 'neg')} data-kind="figure" alt="" />
          <img className="pos" data-src={art(frame, 'pos')} data-kind="figure-lit" data-group={`pos:${id}`} alt="" />
        </div>
      ))}
    </div>
  );
}

function Note({ id, text, lit }: { id: string; text: string; lit?: boolean }) {
  return <p className={`note${lit ? ' note-lit' : ''}`} data-el={`note:${id}`}>{text}</p>;
}

function World() {
  return (
    <>
      <div className="world world-back art" data-el="worldBack" aria-hidden="true">
        <picture>
          <source media="(max-width: 759px)" srcSet={`${ASSET}/art/room.neg.m.webp`} />
          <img data-el="plateNeg" src={art('room', 'neg')} alt="" width={WORLD.w} height={WORLD.h} fetchPriority="high" />
        </picture>
      </div>
      <canvas className="light art" data-el="light" aria-hidden="true" />
      <div className="world world-front art" data-el="worldFront" aria-hidden="true">
        <Festoon />
        {TENTS.map((t) => (
          <div key={t.n} style={{ position: 'absolute', left: t.x, top: t.y }}>
            <span className="tent">{t.n}</span>
            {t.n === 7 ? <span className="tent tent-on" data-el="tentOn:7">{t.n}</span> : null}
          </div>
        ))}
        {FIGURES.map((f) => <Figure key={f.id} id={f.id} />)}
        <Note id="waiter" text={NOTES.waiter} />
        <Note id="dad" text={NOTES.dad} />
        <Note id="hug" text={NOTES.hug} />
        <Note id="table7" text={NOTES.table7} lit />
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="flash" data-el={`flash:${i}`} />)}
      </div>
    </>
  );
}

function Prints() {
  return (
    <>
      <div className="layer prints-back art" aria-hidden="true">
        {PRINT_POOL.map((id, i) => (
          <div key={i} className="print" data-group="print-back print">
            <img data-src={print(id, i > 8)} data-kind="print" alt="" />
          </div>
        ))}
      </div>
      <div className="layer prints-front art" data-el="printsFront" aria-hidden="true">
        {GALLERY.slice(0, FRONT_COUNT).map((id) => (
          <div key={id} className="print" data-group="print-front print">
            <img data-src={print(id)} data-kind="print" alt="" />
          </div>
        ))}
      </div>
    </>
  );
}

function Chapter({ name, heading, big, onPaper, extra, poster, children }: {
  name: keyof typeof CHAPTERS;
  heading: 'h1' | 'h2';
  big?: boolean;
  onPaper?: boolean;
  extra?: ReactNode;
  poster: string;
  children?: ReactNode;
}) {
  const c = CHAPTERS[name] as { title: string; eyebrow?: string; body?: string; alt: string };
  const Heading = heading;
  return (
    <section className={`ch ch-${name}${onPaper ? ' ch-on-paper' : ''}`} data-el={`ch:${name}`}>
      {c.eyebrow ? <p className="ey-l">{c.eyebrow}</p> : null}
      <Heading className={big ? 'h-xl' : 'h-lg'}>{c.title}</Heading>
      {c.body ? <p className="b-l">{c.body}</p> : null}
      {children}
      <p className="sr">{c.alt}</p>
      <img className="poster" src={`${ASSET}/poster/${poster}.webp`} alt={c.alt} loading="lazy" width="1600" height="1000" />
      {extra}
    </section>
  );
}

export function StoryMarkup() {
  const chapters = (['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const).map((k) => ({ k, label: (CHAPTERS[k] as { label: string }).label }));

  return (
    <div className="story" data-tone="ink">
      <a className="skip" href="#get-stills">Skip the story</a>
      <header className="nav" data-el="nav">
        <a className="nav-logo" href="/" aria-label="Stills, home">
          <img src={`${ASSET}/logo.webp`} alt="" width="104" height="42" />
        </a>
        <a className="nav-get" href={LINKS.appStore}>Get Stills</a>
      </header>
      <main>
        <div className="track" data-el="track">
          <div className="stage" data-el="stage">
            <div className="vis-probe art" data-el="visProbe" />
            <World />
            <div className="layer art" data-el="dim" aria-hidden="true" style={{ background: 'var(--ink)', zIndex: 5, opacity: 0 }} />
            <div className="scrim art" data-el="scrim" aria-hidden="true" />
            <Prints />
            <svg className="goldline art" aria-hidden="true">
              <path data-el="goldPath" pathLength={1} />
              <circle data-el="goldDot" r="5" />
            </svg>
            <div className="inv-wrap art" aria-hidden="true">
              <div data-el="invRoom" className="inv-room-w"><Invitation className="inv-room" /></div>
            </div>
            <div className="layer art" style={{ zIndex: 10 }} aria-hidden="true"><Phone /></div>
            <div className="art">
              {MEMORIES.map((m) => (
                <div key={m.photo} className="lift" data-group="lift" aria-hidden="true">
                  <div className="print-in"><img data-src={print(m.photo)} data-kind="print" alt="" /></div>
                  <p>{m.note}</p>
                </div>
              ))}
            </div>
            <div className="white art" data-el="white" aria-hidden="true" />

            <Chapter name="s1" heading="h1" big poster="s1" />
            <Chapter name="s1b" heading="h2" poster="s1b" />
            <Chapter name="s2" heading="h2" poster="s2" />
            <Chapter name="s3" heading="h2" poster="s3" />
            <Chapter name="s4" heading="h2" poster="s4" />
            <Chapter name="s5" heading="h2" poster="s5" />
            <Chapter name="s6" heading="h2" poster="s6" />
            <Chapter name="s6b" heading="h2" onPaper poster="s6b" />
            <Chapter name="s7" heading="h2" onPaper poster="s7" />
            <Chapter name="s8" heading="h2" big poster="s8">
              <div className="cta-row" id="get-stills">
                <a className="btn btn-1" href={LINKS.appStore}>Download on the App Store</a>
                <a className="btn btn-2" href={LINKS.hostPortal}>Host sign in</a>
                <span className="cta-qr">
                  <img src={`${ASSET}/qr-appstore.svg`} alt="" width="64" height="64" />
                  <span>Scan to get<br />Stills on iPhone</span>
                </span>
              </div>
            </Chapter>

            <div className="scroll-hint" data-el="hint" aria-hidden="true"><i />Scroll</div>
            <nav className="chapters" aria-label="Chapters">
              {chapters.map(({ k, label }) => (
                <button key={k} type="button" data-group="chapter" data-chapter={k}>{label}</button>
              ))}
            </nav>
          </div>
        </div>
      </main>
      <footer className="foot">
        <img src={`${ASSET}/logo.webp`} alt="Stills." width="112" height="45" />
        <div className="foot-links">
          <a href={LINKS.appStore}>App Store</a>
          <a href={LINKS.hostPortal}>Host sign in</a>
          <a href={LINKS.privacy}>Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
