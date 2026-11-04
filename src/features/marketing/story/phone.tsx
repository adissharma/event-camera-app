import type { ReactNode } from 'react';

import { ASSET, DARES, DEMO_EVENT, GALLERY, GALLERY_BY, USE_CASES, blurredPrint, blurredRaw, print, raw } from './content';

/**
 * The phone and the real Stills screens inside it, as live HTML.
 *
 * Screenshots couldn't change state as the story scrolls, so each screen is
 * rebuilt at the app's own sizes and read from its source:
 * `guest-join-screen.tsx`, `find-your-table.tsx`, `camera.tsx` and
 * `viewfinder-chrome.tsx`, `event-stat-strip.tsx`, `seat-view-toggle.tsx`,
 * `floorplan-viewer.tsx`, `story-viewer.tsx`, `audio-waveform.tsx` and the event
 * screen `celebration/[celebrationId]/index.tsx`, whose glass card, tiles, tabs, cells
 * and locked cells are measured from it. When those change, this should too. Purely
 * illustrative, so all of it is hidden from assistive tech; each scene describes what's
 * on screen in its own text.
 */

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const Clock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const Camera = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.6" /></svg>
);
const Person = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4.3-6.5 8-6.5s7 2 8 6.5" /></svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><path d="M4 8h3l2-3h5M20 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1" /><circle cx="11.5" cy="13.5" r="3.4" /><path d="M19 3v5M16.5 5.5h5" /></svg>
);
const Close = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><path d="M6 9l6 6 6-6" /></svg>
);
const Flash = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
);
const Flip = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" /></svg>
);
const GuestbookIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" {...stroke}><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2M9 8h6M9 12h6" /></svg>
);
const Qr = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" /><path d="M14 14h3v3h-3zM20.5 14v.1M17 20.5h3.5V17" /></svg>
);
const Grid = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h4.6v4.6H4zM9.7 4h4.6v4.6H9.7zM15.4 4H20v4.6h-4.6zM4 9.7h4.6v4.6H4zM9.7 9.7h4.6v4.6H9.7zM15.4 9.7H20v4.6h-4.6zM4 15.4h4.6V20H4zM9.7 15.4h4.6V20H9.7zM15.4 15.4H20V20h-4.6z" /></svg>
);
const Play = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5l5 2.5-5 2.5z" /></svg>
);
const Share = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" {...stroke} strokeWidth={2}><path d="M12 15V4M8 7.500L12 3.500l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...stroke} strokeWidth={2}><rect x="5" y="11" width="14" height="9.5" rx="2.2" /><path d="M8 11V7.500a4 4 0 0 1 8 0V11" /></svg>
);
const Tray = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7.5 10.500L12 15l4.5-4.500M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>
);
const CameraFill = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="#000"><path d="M9.2 4.500a1.5 1.5 0 0 0-1.25.670L6.9 6.750H4.500A2.5 2.5 0 0 0 2 9.250v8.500a2.5 2.5 0 0 0 2.5 2.500h15a2.5 2.5 0 0 0 2.5-2.500v-8.500a2.5 2.5 0 0 0-2.5-2.500h-2.400l-1.05-1.580a1.5 1.5 0 0 0-1.25-.670z" /><circle cx="12" cy="13.4" r="4" fill="#efe9e0" /><circle cx="12" cy="13.4" r="2.4" /></svg>
);

function StatusBar() {
  return (
    <div className="sb" aria-hidden="true">
      <span>9:41</span>
      <span className="sb-r">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8" /><rect x="5" y="5" width="3" height="6" rx=".8" /><rect x="10" y="2.5" width="3" height="8.5" rx=".8" /><rect x="15" y="0" width="3" height="11" rx=".8" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor" /><path d="M23 4v4c.8-.3 1.5-1.1 1.5-2S23.8 4.3 23 4z" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

/** The paper invitation. Appears in the room and again in the phone's viewfinder. */
export function Invitation({ className, el }: { className: string; el?: string }) {
  return (
    <div className={`inv ${className}`} data-el={el}>
      <p className="inv-e">Together with their families</p>
      <p className="inv-t">Olivia <i>&amp;</i> Daniel</p>
      <p className="inv-d">Saturday 12 June</p>
      <div className="inv-qr">
        {/* A real, scannable code. */}
        <img src={`${ASSET}/qr-invite.svg`} alt="" width="120" height="120" />
      </div>
      <p className="inv-s">Scan to join the camera</p>
    </div>
  );
}

function IosCamera() {
  return (
    <div className="scr scr-ios" data-el="screen:ios">
      <div className="ios-vf">
        <img className="ios-bg" data-src={`${ASSET}/art/room-entrance.webp`} alt="" />
        <Invitation className="inv-vf" el="invVf" />
        <div className="ios-reticle" data-el="reticle"><i /><i /><i /><i /></div>
        <div className="ios-pill" data-el="pill">
          <img src={`${ASSET}/icon.webp`} alt="" width="14" height="14" />
          stills.events
        </div>
      </div>
      <div className="ios-top"><i /><i /><i /></div>
      <div className="ios-bot">
        <p className="ios-mode"><span>VIDEO</span><b>PHOTO</b><span>PORTRAIT</span></p>
        <div className="ios-row">
          <span className="ios-thumb" />
          <span className="ios-shut"><i /></span>
          <span className="ios-flip"><Flip /></span>
        </div>
      </div>
      {/* The App Clip card iOS raises over the camera. The words are set in App Store Connect. */}
      <div className="clip-dim" data-el="clipDim" />
      <div className="clip" data-el="clipCard">
        <div className="clip-photo">
          <img data-src={raw('p14')} alt="" />
          <span className="clip-x"><Close size={13} /></span>
        </div>
        <div className="clip-info">
          <span className="clip-text"><b>You&rsquo;re invited</b><small>Find your seat and grab the camera</small></span>
          <span className="clip-open" data-el="clipOpen">
            <span data-el="clipOpenText">Open</span>
            <i data-el="clipSpin" />
          </span>
        </div>
        <div className="clip-foot">
          <img src={`${ASSET}/icon.webp`} alt="" width="18" height="18" />
          <span>App Clip &middot; Stills</span>
        </div>
      </div>
    </div>
  );
}

function JoinScreen() {
  return (
    <div className="scr scr-join" data-el="screen:join">
      <div className="join-cover">
        <img data-src={raw('p14')} alt="" />
        <div className="join-scrim" />
      </div>
      <div className="join-id">
        <p className="ey">You&rsquo;re invited</p>
        <p className="d-lg">{DEMO_EVENT.title}</p>
        <div className="join-row">
          <span className="det"><Clock /><span><b>{DEMO_EVENT.timeLeft}</b><small>TIME LEFT</small></span></span>
          <span className="det-div" />
          <span className="det"><Camera /><span><b>{DEMO_EVENT.shots}</b><small>SHOTS LEFT</small></span></span>
        </div>
      </div>
      <div className="join-form">
        <div className="join-field" data-el="joinField"><Person /><span>Enter your name</span></div>
        <div className="join-cta"><Sparkle /><span>Join the event</span></div>
      </div>
    </div>
  );
}

/** A host's floor plan: drawn for paper, so white, and it marks no one's seat. */
function FloorPlan() {
  const tables = [[70, 92, 1], [150, 92, 2], [230, 92, 3], [70, 172, 4], [150, 172, 5], [230, 172, 6], [70, 252, 7], [150, 252, 8]];
  return (
    <svg viewBox="0 0 300 340" aria-hidden="true">
      <rect width="300" height="340" fill="#fff" />
      <path d="M12 12h276v316H12zM120 328v-10M178 328v-10" fill="none" stroke="#111" strokeWidth="2" />
      <rect x="62" y="24" width="176" height="24" fill="none" stroke="#111" strokeWidth="1.6" />
      <text x="150" y="40" textAnchor="middle" fontSize="11" fill="#111">Top table</text>
      {tables.map(([x, y, n]) => (
        <g key={n}>
          <circle cx={x} cy={y} r="26" fill="none" stroke="#111" strokeWidth="1.6" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fill="#111">{n}</text>
        </g>
      ))}
      <rect x="196" y="228" width="72" height="72" fill="none" stroke="#111" strokeWidth="1.6" strokeDasharray="4 3" />
      <text x="232" y="268" textAnchor="middle" fontSize="10" fill="#111">Dance floor</text>
      <text x="150" y="322" textAnchor="middle" fontSize="10" fill="#111">Entrance</text>
    </svg>
  );
}

function TableSheet() {
  return (
    <div className="scr scr-table" data-el="screen:table">
      <div className="tb-head">
        <p className="d-tl">Find your table</p>
        <span className="tb-x"><Close /></span>
      </div>
      <div data-el="tableSearch">
        <div className="tb-field">
          <span className="tb-text">
            <span className="tb-ph" data-el="typePh">Start typing your name</span>
            <span className="tb-typed" data-el="type1">A</span>
            <span className="tb-typed" data-el="type2">Ay</span>
            <span className="tb-typed" data-el="type3">Ayl</span>
          </span>
        </div>
        <p className="tb-help" data-el="typeHelp">Type your name to see where you&rsquo;re sitting.</p>
        <div className="tb-card" data-el="typeRows">
          <div className="tb-row" data-el="typeRow1"><span>{DEMO_EVENT.guest}</span><em>{DEMO_EVENT.seat}</em></div>
          <div className="tb-sep" />
          <div className="tb-row"><span>{DEMO_EVENT.otherGuest}</span><em>{DEMO_EVENT.otherSeat}</em></div>
        </div>
      </div>
      <div className="tb-seat" data-el="seatView">
        <div className="tb-toggle" data-el="seatToggle">
          <i data-el="seatToggleOn" />
          <span>Your seat</span>
          <span>Floor plan</span>
        </div>
        <div className="tb-plan" data-el="seatPlan"><div data-el="planZoom"><FloorPlan /></div></div>
        <div className="tb-seatcard" data-el="seatCard">
          <p className="ey dim">You&rsquo;re seated at</p>
          <p className="d-lg gold" data-el="seatWord">{DEMO_EVENT.seat}</p>
          <p className="b-md dim">{DEMO_EVENT.guest}</p>
        </div>
        <div className="tb-actions">
          <div className="btn-ivory" data-el="seatJoin">Join the event</div>
          <div className="btn-quiet">Not you?</div>
        </div>
      </div>
    </div>
  );
}

function CameraScreen() {
  return (
    <div className="scr scr-cam" data-el="screen:camera">
      <div className="cam-head" data-el="camHead">
        <span className="cam-btn"><Chevron /></span>
        <span className="cam-title">
          <b>{DEMO_EVENT.title}</b>
          <small>{DEMO_EVENT.timeLeft} left</small>
        </span>
        <span className="cam-sp" />
      </div>
      <div className="cam-vf">
        <img data-src={raw('p06')} alt="" data-el="vf1" />
        <img data-src={raw('p03')} alt="" data-el="vf3" />
        {/* The capture-limit step's look: monochrome, darkened, so the number leads. */}
        <img className="cam-mono" data-src={`${ASSET}/photo/raw-p03-l.webp`} data-kind="print" alt="" data-el="vfMono" />
        <div className="cam-fade" data-el="camFade" />
        <div className="cam-flash" data-el="camFlash" />
        <div className="cam-zoom" data-el="camZoom"><span>0.5</span><span className="on">1x</span><span>2.5</span></div>
        {/* The real remaining-shots pill, from `viewfinder-shot-counter.tsx`. */}
        <div className="cam-count" data-el="camCount"><span data-el="camCountN">{DEMO_EVENT.shots}</span></div>
      </div>
      <div className="cam-rail" data-el="camRail">
        <i />
        <span>PHOTO</span><span>VIDEO</span>
      </div>
      <div className="cam-bar" data-el="camBar">
        <span className="cam-c"><Flash /></span>
        <span className="cam-c"><Flip /></span>
        <span className="cam-sh"><i data-el="shutter" /></span>
        <span className="cam-c"><Qr /></span>
        <span className="cam-th">
          <img data-src={print('p06', true)} alt="" data-el="thumb1" />
          <img data-src={print('p07', true)} alt="" data-el="thumb2" />
          <img data-src={print('p03', true)} alt="" data-el="thumb3" />
        </span>
      </div>
    </div>
  );
}

/** The app's challenge blobs, from `CHALLENGE_GRADIENTS` and `CHALLENGE_BLOB_PATHS`. */
const BLOBS: { stops: [string, string, string]; path: string; turn: number }[] = [
  { stops: ['#1A0A42', '#5A2FC7', '#FF6A55'], path: 'M50 1C69 -1 90 9 98 28C105 46 97 69 82 86C66 103 43 101 24 92C6 83 -2 64 3 44C7 25 27 3 50 1Z', turn: 0 },
  { stops: ['#082B74', '#2860C8', '#E53C96'], path: 'M49 2C70 -1 91 12 98 31C104 50 95 72 77 89C60 103 38 98 21 89C4 79 -1 58 5 39C11 20 28 4 49 2Z', turn: 172 },
  { stops: ['#230A4F', '#5A21A8', '#D03B85'], path: 'M51 0C72 1 94 13 99 34C104 54 91 77 74 92C56 106 32 99 16 84C1 70 0 48 9 29C18 10 32 -1 51 0Z', turn: 86 },
  { stops: ['#8C184E', '#8C1EC1', '#351674'], path: 'M48 2C68 -2 91 8 99 27C108 46 97 69 80 86C63 102 40 104 22 93C3 81 -3 60 4 40C11 20 29 4 48 2Z', turn: -92 },
  { stops: ['#0B4D65', '#293F9D', '#7421B8'], path: 'M50 0C71 2 93 14 98 34C104 53 93 75 76 91C58 106 35 100 18 87C2 74 -1 51 7 31C15 11 31 -1 50 0Z', turn: 138 },
  { stops: ['#C53B5C', '#9621C7', '#F67B3D'], path: 'M50 2C70 0 91 11 98 30C106 49 96 72 79 89C62 105 39 101 20 90C3 79 -2 57 5 38C12 19 30 3 50 2Z', turn: -142 },
];

/** Gradients are shared by id, so each is only defined once across all the tiles. */
function BlobDefs() {
  return (
    <svg className="blob-defs" aria-hidden="true">
      <defs>
        {BLOBS.map((blob, i) => (
          <linearGradient key={i} id={`blob-${i}`} x1="8%" y1="8%" x2="92%" y2="92%">
            <stop offset="0" stopColor={blob.stops[0]} />
            <stop offset=".52" stopColor={blob.stops[1]} />
            <stop offset="1" stopColor={blob.stops[2]} />
          </linearGradient>
        ))}
        <radialGradient id="blob-shine" cx="22%" cy="14%" r="88%">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset=".48" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#080418" stopOpacity=".22" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Blob({ index, children, group }: { index: number; children: ReactNode; group?: string }) {
  const blob = BLOBS[index % BLOBS.length];
  return (
    <span className="tile" data-group={group}>
      <svg viewBox="-16 -16 132 132" aria-hidden="true">
        <path d={blob.path} fill={`url(#blob-${index % BLOBS.length})`} transform={`rotate(${blob.turn} 50 50)`} />
        <path d={blob.path} fill="url(#blob-shine)" transform={`rotate(${blob.turn} 50 50)`} />
      </svg>
      <i>{children}</i>
    </span>
  );
}

/** The tiles under the event page's stat strip: the guestbook, then the challenges. */
function ChallengeStrip({ grouped = false }: { grouped?: boolean }) {
  return (
    <div className="strip">
      <Blob index={0}><GuestbookIcon /></Blob>
      {DARES.map((dare, i) => <Blob key={dare.label} index={i + 1} group={grouped ? 'dareTile' : undefined}>{dare.icon}</Blob>)}
      <Blob index={4}>🕺</Blob>
      <Blob index={5}>✨</Blob>
    </div>
  );
}

/** The ivory capsule that opens the camera, floating over the event page. Once it's over, it saves. */
function CameraCapsule({ saving = false }: { saving?: boolean }) {
  return (
    <span className="fab">
      <span className="fab-black">
        <span className="fab-fill">
          <span data-el={saving ? 'fabCamera' : undefined} className="fab-icon"><CameraFill /></span>
          {saving ? <span data-el="fabSave" className="fab-save"><Tray /><b>Save</b></span> : null}
        </span>
      </span>
    </span>
  );
}

/**
 * The top of the event page: the cover to 49% of the screen, then the glass card over its
 * last few points. The blur is one tiny image stretched into place, lined up with the
 * cover behind it, which reads the same as the real `BlurView` under its 70% wash.
 */
function EventHead({ title, cover, blurred, tint, stats, last, strip, children }: {
  title: string;
  cover?: string;
  blurred?: string;
  tint?: string;
  stats: [string, string];
  /** The third figure, or nothing to fill it with `children`. */
  last?: [string, string];
  strip?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="ev-cover" style={tint ? { background: tint } : undefined}>
        {cover ? <img data-src={cover} data-kind={tint ? 'print' : undefined} alt="" /> : tint ? <Camera /> : null}
      </div>
      <div className="ev-card">
        <div className="ev-glass">
          {blurred ? <img data-src={blurred} alt="" /> : <i style={{ background: tint }} />}
          <b />
        </div>
        <div className="ev-rim" />
        <div className="ev-glint" />
        <div className="ev-body">
          <p className="d-ev">{title}</p>
          <div className="ev-stats">
            <span><b>{stats[0]}</b><small>Photos</small></span><i />
            <span><b>{stats[1]}</b><small>Joined</small></span><i />
            {last ? <span><b>{last[0]}</b><small>{last[1]}</small></span> : children}
          </div>
          {strip ?? <div className="strip-gap" />}
          <div className="ev-tabs"><span className="on"><Grid /></span><span><Play /></span><u /></div>
        </div>
      </div>
    </>
  );
}

/** The two round buttons over the cover. */
function EventNav() {
  return (
    <div className="ev-nav">
      <span><Close size={20} /></span>
      <span><Share /></span>
    </div>
  );
}

function DareScreen() {
  return (
    <div className="scr scr-dare" data-el="screen:dare">
      <EventHead
        title={DEMO_EVENT.title}
        cover={raw('p08')}
        blurred={blurredRaw('p08')}
        stats={['412', '86']}
        last={['2', 'Hours left']}
        strip={<ChallengeStrip grouped />}
      />
      <EventNav />
      <CameraCapsule />
      {/* `story-viewer.tsx`: the challenge's own photo blurred behind its intro slide. */}
      <div className="dare-viewer" data-el="dareViewer">
        {DARES.map((dare) => (
          <div key={dare.label} className="dare-slide" data-group="dareSlide">
            <img className="dare-bg" data-src={blurredRaw(dare.photo)} alt="" />
            <span className="dare-icon">{dare.icon}</span>
            <p className="dare-title">{dare.label}</p>
            <span className="dare-rule"><i />✦<i /></span>
            <p className="dare-line">{dare.line}</p>
            <span className="dare-cta" data-group="dareCta">📸 Add Yours</span>
          </div>
        ))}
        <div className="dare-bars">{DARES.map((d, i) => <i key={d.label}><b data-group="dareBar" data-i={i} /></i>)}</div>
        <span className="dare-x"><Close size={20} /></span>
      </div>
      <div className="dare-cam" data-el="dareCam">
        <div className="cam-head">
          <span className="cam-btn"><Chevron /></span>
          <span className="cam-title">
            {DARES.map((dare) => <b key={dare.label} data-group="dareCamTitle">{dare.label}</b>)}
            <small>Challenge</small>
          </span>
          <span className="cam-sp" />
        </div>
        <div className="cam-vf">
          {DARES.map((dare) => <img key={dare.label} data-src={raw(dare.photo)} alt="" data-group="dareShot" />)}
          <div className="cam-flash" data-el="dareFlash" />
        </div>
        <div className="cam-bar cam-bar-solo"><span className="cam-sh"><i data-el="dareShutter" /></span></div>
      </div>
    </div>
  );
}

/** Bars for the recording: the same shape every time, newest on the right. */
function waveBars(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const speech = Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1) * 0.9) + Math.abs(Math.sin(i * 1.3)) * 0.18;
    return Math.max(0.12, Math.min(1, speech));
  });
}

function GuestbookScreen() {
  return (
    <div className="scr scr-cam" data-el="screen:guestbook">
      <div className="cam-head">
        <span className="cam-btn"><Close size={16} /></span>
        <span className="cam-title">
          <b>Guestbook</b>
          <small>Audio message</small>
        </span>
        <span className="cam-sp" />
      </div>
      <div className="cam-vf gb-stage">
        <div className="cam-rec cam-rec-on">
          <i />
          <span className="cam-time" data-el="gbTime">1:00</span>
        </div>
        <div className="gb-wave">
          <div className="gb-strip" data-el="gbStrip">
            {waveBars(120).map((level, i) => <i key={i} style={{ height: `${Math.round(level * 100)}%` }} />)}
          </div>
        </div>
        <p className="gb-hint">Listening…</p>
      </div>
      <div className="cam-rail cam-rail-audio">
        <i />
        <span>AUDIO</span><span>VIDEO</span>
      </div>
      <div className="cam-bar cam-bar-solo"><span className="cam-sh cam-sh-rec"><i /></span></div>
    </div>
  );
}

function EventScreen() {
  return (
    <div className="scr scr-ev" data-el="screen:event">
      <div className="ev-scroll" data-el="evScroll">
        <EventHead
          title={DEMO_EVENT.title}
          cover={raw('p08')}
          blurred={blurredRaw('p08')}
          stats={['1,284', '86']}
          strip={<ChallengeStrip />}
        >
          <span className="ev-last">
            <span data-el="evLeft"><b>2</b><small>Hours left</small></span>
            <span data-el="evEnded"><b className="ev-word">Ended</b></span>
          </span>
        </EventHead>
        <div className="ev-grid" data-el="evGrid">
          {GALLERY.map((id, i) => (
            <span key={id} className="ev-cell" data-group="cell">
              <img data-src={print(id, true)} alt="" />
              <em>{GALLERY_BY[i]}</em>
              {/* The real locked cell, from the event screen: blurred, a lock, and how long. */}
              <span className="ev-lock" data-group="cellLock">
                <img data-src={blurredPrint(id)} alt="" />
                <span className="ev-lock-in" data-group="cellLockIn">
                  <i><Lock /></i>
                  <small data-group="cellLockText">Revealed in 8h 12m</small>
                </span>
              </span>
            </span>
          ))}
        </div>
        <EventNav />
      </div>
      {/* The real page once it's scrolled: a solid status bar, with the tabs pinned under it. */}
      <div className="ev-sb-back" data-el="evBack" />
      <div className="ev-pinned" data-el="evPinned">
        <div className="ev-tabs"><span className="on"><Grid /></span><span><Play /></span><u /></div>
      </div>
      <CameraCapsule saving />
    </div>
  );
}

/** One event per use case tab, on the real event page layout. */
function PartyScreen() {
  return (
    <div className="scr scr-ev" data-el="screen:party">
      {USE_CASES.map((useCase) => (
        <div key={useCase.id} className="party" data-group="ucPhone">
          <div className="ev-scroll" data-group="ucScroll">
            <EventHead
              title={useCase.event.title}
              cover={useCase.photos[0]}
              blurred={useCase.blurred}
              tint={useCase.tint}
              stats={[useCase.event.photos, useCase.event.joined]}
              last={[useCase.event.when, useCase.event.when === '1' ? 'Day ago' : 'Days ago']}
              strip={<ChallengeStrip />}
            />
            <div className="ev-grid">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="ev-cell party-cell" style={{ background: `color-mix(in srgb, ${useCase.tint} 16%, #111)` }}>
                  {useCase.photos[i + 1] ? <><img data-src={useCase.photos[i + 1]} data-kind="print" alt="" /><em>{useCase.by?.[i]}</em></> : <Camera />}
                </span>
              ))}
            </div>
            <EventNav />
          </div>
          <CameraCapsule />
        </div>
      ))}
    </div>
  );
}

export function Phone() {
  return (
    <div className="phone" data-el="phone" aria-hidden="true">
      <div className="ph-body">
        <div className="ph-screen" data-el="screen">
          <BlobDefs />
          <div className="ph-bg" />
          <IosCamera />
          <JoinScreen />
          <TableSheet />
          <CameraScreen />
          <DareScreen />
          <GuestbookScreen />
          <EventScreen />
          <PartyScreen />
          <div className="ph-sb-d" data-el="sbDark"><StatusBar /></div>
          <div className="ph-island" />
          <div className="ph-tap" data-el="tap" />
          <div className="ph-tap" data-el="tap2" />
        </div>
      </div>
    </div>
  );
}
