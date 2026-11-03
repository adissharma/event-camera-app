import { ASSET, DEMO_EVENT, GALLERY, print, raw } from './content';

/**
 * The phone and the real Stills screens inside it, as live HTML.
 *
 * Screenshots couldn't change state as the story scrolls, so each screen is
 * rebuilt at the app's own sizes and read from its source:
 * `guest-join-screen.tsx`, `find-your-table.tsx`, `camera.tsx` and
 * `viewfinder-chrome.tsx`, `event-stat-strip.tsx`. When those change, this
 * should too. Purely illustrative, so all of it is hidden from assistive tech;
 * each scene describes what's on screen in its own text.
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
const Qr = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" /><path d="M14 14h3v3h-3zM20.5 14v.1M17 20.5h3.5V17" /></svg>
);
const Grid = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h4.6v4.6H4zM9.7 4h4.6v4.6H9.7zM15.4 4H20v4.6h-4.6zM4 9.7h4.6v4.6H4zM9.7 9.7h4.6v4.6H9.7zM15.4 9.7H20v4.6h-4.6zM4 15.4h4.6V20H4zM9.7 15.4h4.6V20H9.7zM15.4 15.4H20V20h-4.6z" /></svg>
);
const Play = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5l5 2.5-5 2.5z" /></svg>
);

function StatusBar() {
  return (
    <div className="sb" aria-hidden="true">
      <span>9:41</span>
      <span className="sb-r">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8" /><rect x="5" y="5" width="3" height="6" rx=".8" /><rect x="10" y="2.5" width="3" height="8.5" rx=".8" /><rect x="15" y="0" width="3" height="11" rx=".8" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor" /><path d="M23 4v4c.8-.3 1.5-1.1 1.5-2S23.800 4.300 23 4z" fill="currentColor" opacity=".5" /></svg>
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
        <div className="tb-seatcard">
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
      <div className="cam-head">
        <span className="cam-btn"><Chevron /></span>
        <span className="cam-title">
          <b>{DEMO_EVENT.title}</b>
          <small>{DEMO_EVENT.timeLeft} left</small>
        </span>
        <span className="cam-sp" />
      </div>
      <div className="cam-vf">
        <img data-src={raw('p06')} alt="" data-el="vf1" />
        <img data-src={raw('p07')} alt="" data-el="vf2" />
        <img data-src={raw('p03')} alt="" data-el="vf3" />
        <div className="cam-flash" data-el="camFlash" />
        <div className="cam-count">
          <div className="cam-roll" data-el="camRoll">
            <span>20</span><span>19</span><span>18</span><span>17</span>
          </div>
        </div>
        <div className="cam-zoom"><span>0.5</span><span className="on">1x</span><span>2.5</span></div>
      </div>
      <div className="cam-bar">
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

function EventScreen() {
  return (
    <div className="scr scr-ev" data-el="screen:event">
      <div className="ev-scroll" data-el="evScroll">
        <div className="ev-cover">
          <img data-src={raw('p08')} alt="" />
        </div>
        <div className="ev-card">
          <p className="d-ev">{DEMO_EVENT.title}</p>
          <div className="ev-stats">
            <span><b>1,284</b><small>Photos</small></span><i />
            <span><b>86</b><small>Joined</small></span><i />
            <span><b>2</b><small>Days ago</small></span>
          </div>
          <div className="ev-tabs"><span className="on"><Grid /></span><span><Play /></span></div>
        </div>
        <div className="ev-grid" data-el="evGrid">
          {GALLERY.map((id) => (
            <span key={id} className="ev-cell" data-group="cell"><img data-src={print(id, true)} alt="" /></span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Phone() {
  return (
    <div className="phone" data-el="phone" aria-hidden="true">
      <div className="ph-body">
        <div className="ph-screen" data-el="screen">
          <div className="ph-bg" />
          <IosCamera />
          <JoinScreen />
          <TableSheet />
          <CameraScreen />
          <EventScreen />
          <div className="ph-sb-d" data-el="sbDark"><StatusBar /></div>
          <div className="ph-island" />
          <div className="ph-tap" data-el="tap" />
        </div>
      </div>
    </div>
  );
}
