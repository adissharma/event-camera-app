import type { CSSProperties, ReactNode } from 'react';

import { ASSET, CHAPTERS, CLOSE, CTA, DARES, FAQS, GALLERY, LINKS, MEMORIES, NOTES, REVEAL_OPTIONS, SWIRL, USE_CASES, USE_CASES_ALSO, art, print } from './content';
import { Invitation, Phone } from './phone';
import { FESTOON, FIGURES, LATE, SUN, TABLE7, WORLD, figure, figureSize } from './world';

/**
 * The public homepage's markup: one party, told by scrolling.
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

/** Back-layer prints. The first five come from the guests' flashes, in the same order. */
const FLASH_PRINTS = 5;
const PRINT_POOL = ['p01', 'p05', 'p07', 'p06', 'p08', 'p06', 'p07', 'p03', 'p02', 'p12', 'p01', 'p14', 'p10', 'p04', 'p11', 'p05', 'p02', 'p13', 'p08', 'p03', 'p07', 'p01', 'p12'];
/** The rest only exist for the swirl, so they aren't downloaded while it's parked. */
const BACK_PRINTS = SWIRL ? PRINT_POOL : PRINT_POOL.slice(0, FLASH_PRINTS);
const FRONT_COUNT = SWIRL ? 4 : 0;

function catenary(x0: number, y0: number, x1: number, y1: number, sag: number, p: number) {
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p + sag * 4 * p * (1 - p) };
}

function Festoon() {
  return (
    <svg className="festoon intro-venue" viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} data-el="festoonGlow">
      <defs>
        <radialGradient id="bulbGlow">
          <stop offset="0" stopColor="#fff3d6" stopOpacity=".95" />
          <stop offset=".3" stopColor="#ffb9d2" stopOpacity=".38" />
          <stop offset="1" stopColor="#ff7eb0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {FESTOON.slice(1).map((f) => (
        <path key={f.x0} className="pole" d={`M${f.x0} ${f.y0 - 6} L${f.x0} 800`} />
      ))}
      {FESTOON.map((f, i) => {
        const mid = catenary(f.x0, f.y0, f.x1, f.y1, f.sag, 0.5);
        const count = Math.round((f.x1 - f.x0) / 118);
        return (
          <g key={i}>
            <path d={`M${f.x0} ${f.y0} Q${mid.x} ${mid.y + f.sag} ${f.x1} ${f.y1}`} />
            {Array.from({ length: count }, (_, k) => {
              const p = (k + 0.5) / count;
              const at = catenary(f.x0, f.y0, f.x1, f.y1, f.sag, p);
              return (
                <g key={k}>
                  <circle className="bulb-glow" cx={at.x} cy={at.y + 12} r={62} />
                  <ellipse className="bulb" cx={at.x} cy={at.y + 12} rx={10} ry={13} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** The one call to action, wherever it appears. Hosts make their events in the iPhone app. */
function CreateEvent({ small }: { small?: boolean }) {
  return (
    <a className={small ? 'cta cta-s' : 'cta'} href={LINKS.appStore}>
      {CTA.create}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
    </a>
  );
}

function Figure({ id, order }: { id: string; order: number }) {
  const def = figure(id);
  const size = figureSize(def);
  return (
    <div className="fig intro-person" data-el={`fig:${id}`} style={{ width: size.w, height: size.h, '--i': order } as CSSProperties}>
      {def.frames.map((frame, i) => (
        <div
          key={frame}
          className={`fig-frame${def.flip ? (i === 0 ? ' flip-a' : ' flip-b') : ''}`}
          data-group={`frame:${id}`}
        >
          <img data-src={art(frame)} data-kind={LATE.includes(id) ? 'figure-late' : 'figure'} alt="" />
        </div>
      ))}
    </div>
  );
}

function Note({ id, text }: { id: string; text: string }) {
  return <p className="note" data-el={`note:${id}`}>{text}</p>;
}

function World() {
  return (
    <>
      <div className="sky art" aria-hidden="true">
        <div className="sky-dawn" data-el="dawn" />
        <img className="clouds" data-el="clouds" src={art('clouds')} alt="" />
      </div>
      <div className="world world-back art" data-el="worldBack" aria-hidden="true">
        <div className="sun" data-el="sun" style={{ left: SUN.x, top: SUN.y, width: SUN.d, height: SUN.d }} />
        <picture>
          <source media="(max-width: 759px)" srcSet={`${ASSET}/art/room.m.webp`} />
          <img className="intro-venue" data-el="plate" src={art('room')} alt="" width={WORLD.w} height={WORLD.h} fetchPriority="high" />
        </picture>
      </div>
      <div className="world world-front art" aria-hidden="true" data-el="worldFront">
        {FIGURES.map((f, i) => <Figure key={f.id} id={f.id} order={i} />)}
      </div>
      <canvas className="night art" data-el="night" aria-hidden="true" />
      <div className="world world-top art" data-el="worldTop" aria-hidden="true">
        <Festoon />
        <div style={{ position: 'absolute', left: TABLE7.x, top: TABLE7.y }}>
          <span className="tent" data-el="tent7">7</span>
        </div>
        <Note id="table7" text={NOTES.table7} />
        {Array.from({ length: 11 }, (_, i) => <div key={i} className="flash" data-el={`flash:${i}`} />)}
      </div>
    </>
  );
}

function Prints() {
  return (
    <>
      <div className="layer prints-back art" aria-hidden="true">
        {BACK_PRINTS.map((id, i) => (
          <div key={i} className="print" data-group="print-back print">
            <img data-src={print(id, i > 4)} data-kind="print" alt="" />
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

function Chapter({ name, heading, big, poster, children }: {
  name: keyof typeof CHAPTERS;
  heading: 'h1' | 'h2';
  big?: boolean;
  poster: string;
  children?: ReactNode;
}) {
  const c = CHAPTERS[name] as { title: string; titleAfter?: string; body?: string; alt: string };
  const Heading = heading;
  return (
    <section className={`ch ch-${name}`} data-el={`ch:${name}`}>
      <Heading className={big ? 'h-xl' : 'h-lg'}>
        {c.title}
        {c.titleAfter ? <> <span data-el={`after:${name}`}>{c.titleAfter}</span></> : null}
      </Heading>
      {c.body ? <p className="b-l">{c.body}</p> : null}
      {children}
      <p className="sr">{c.alt}</p>
      <img className="poster" src={`${ASSET}/poster/${poster}.webp`} alt={c.alt} loading="lazy" width="1600" height="1000" />
    </section>
  );
}

export function StoryMarkup() {
  const chapters = (['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'] as const).map((k) => ({ k, label: CHAPTERS[k].label }));

  return (
    <div className="story">
      <a className="skip" href="#get-stills">Skip the story</a>
      <header className="nav" data-el="nav">
        <a className="nav-logo" href="/" aria-label="Stills, home">
          <img src={`${ASSET}/logo.webp`} alt="" width="104" height="42" />
        </a>
        <div className="nav-get" data-el="navGet">
          <CreateEvent small />
        </div>
      </header>
      <main>
        <div className="track" data-el="track">
          <div className="stage" data-el="stage">
            <div className="stage-in">
              <div className="vis-probe art" data-el="visProbe" />
              <World />
              <div className="layer art dim-layer" data-el="dim" aria-hidden="true" />
              <div className="layer art copy-shade" data-el="copyShade" aria-hidden="true" />
              <Prints />
              <svg className="goldline art" aria-hidden="true">
                <path data-el="goldPath" pathLength={1} />
                <circle data-el="goldDot" r="5" />
              </svg>
              <div className="inv-wrap art" aria-hidden="true">
                <div data-el="invRoom" className="inv-room-w"><Invitation className="inv-room" /></div>
              </div>
              <div className="layer art" style={{ zIndex: 10 }} aria-hidden="true"><Phone /></div>
              <div className="layer art uc-stage" data-el="ucStage" aria-hidden="true">
                <i className="uc-sun" />
                {USE_CASES.map((useCase) => (
                  <img key={useCase.id} className="uc-setting" data-group="ucSetting" data-src={art(useCase.art)} data-kind="print" alt="" />
                ))}
              </div>
              <div className="art">
                {DARES.map((dare) => (
                  <div key={dare.label} className="lift" data-group="darePrint" aria-hidden="true">
                    <div className="print-in"><img data-src={print(dare.photo)} data-kind="print" alt="" /></div>
                    <p>{dare.label}</p>
                  </div>
                ))}
                {MEMORIES.map((m) => (
                  <div key={m.photo} className="lift" data-group="lift" aria-hidden="true">
                    <div className="print-in"><img data-src={print(m.photo)} data-kind="print" alt="" /></div>
                    <p>{m.note}</p>
                  </div>
                ))}
              </div>
              <div className="white art" data-el="white" aria-hidden="true" />

              <Chapter name="s1" heading="h1" big poster="s1">
                <div className="cta-row" data-el="heroCta">
                  <CreateEvent />
                </div>
              </Chapter>
              <Chapter name="s2" heading="h2" poster="s2" />
              <Chapter name="s3" heading="h2" poster="s3" />
              <Chapter name="s4" heading="h2" poster="s4" />
              <Chapter name="s5" heading="h2" poster="s5" />
              <Chapter name="s6" heading="h2" poster="s6" />
              <Chapter name="s7" heading="h2" poster="s7">
                <div className="opts">
                  {REVEAL_OPTIONS.map((option, i) => (
                    <p key={option.name} className="b-l opt" data-el={`opt:${i}`}><b>{option.name}</b> {option.line}</p>
                  ))}
                </div>
              </Chapter>
              <Chapter name="s8" heading="h2" poster="s8" />
              <Chapter name="s9" heading="h2" poster="s9">
                <div className="uc-tabs" role="tablist" aria-label="Kinds of party">
                  {USE_CASES.map((useCase, i) => (
                    <button key={useCase.id} type="button" role="tab" id={`uc-tab-${useCase.id}`} aria-controls={`uc-panel-${useCase.id}`} aria-selected={i === 0} tabIndex={i === 0 ? 0 : -1} className="uc-tab" data-group="ucTab">
                      {useCase.tab}
                    </button>
                  ))}
                </div>
                <div className="uc-panels">
                  {USE_CASES.map((useCase, i) => (
                    <p key={useCase.id} id={`uc-panel-${useCase.id}`} role="tabpanel" aria-labelledby={`uc-tab-${useCase.id}`} className={`b-l uc-panel${i === 0 ? ' on' : ''}`} data-group="ucPanel">
                      <b>{useCase.title}</b> {useCase.line}
                    </p>
                  ))}
                </div>
                <p className="b-l uc-also" data-el="ucAlso">{USE_CASES_ALSO}</p>
              </Chapter>

              <button type="button" className="scroll-hint" data-el="hint">
                <span className="hint-text hint-scroll">{CTA.scroll}</span>
                <span className="hint-text hint-swipe">{CTA.swipe}</span>
                <span className="hint-arrow">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                </span>
              </button>
              <nav className="chapters" data-el="chapters" aria-label="Chapters">
                {chapters.map(({ k, label }) => (
                  <button key={k} type="button" data-group="chapter" data-chapter={k}>{label}</button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Past the story the page scrolls like any other. Same in both modes, so no posters. */}
        <section className="faq" id="faqs" aria-labelledby="faq-title">
          <h2 className="h-lg" id="faq-title">Good questions.</h2>
          <div className="faq-list">
            {FAQS.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>
                  {item.q}
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="close" id="get-stills" aria-labelledby="close-title">
          <img className="close-art" src={`${ASSET}/poster/s1.webp`} alt="" loading="lazy" width="1600" height="1000" />
          <div className="close-in">
            <h2 className="h-lg" id="close-title">{CLOSE.title}</h2>
            <p className="b-l">{CLOSE.body}</p>
            <div className="cta-row">
              <CreateEvent />
              <span className="cta-qr">
                <img src={`${ASSET}/qr-appstore.svg`} alt="" width="64" height="64" />
                <span>{CTA.scan}</span>
              </span>
            </div>
          </div>
        </section>
      </main>
      <footer className="foot">
        <img src={`${ASSET}/logo.webp`} alt="Stills." width="112" height="45" />
        <div className="foot-links">
          <a href={LINKS.appStore}>Get the app</a>
          <a href={LINKS.hostPortal}>Host sign in</a>
          <a href={LINKS.privacy}>Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
