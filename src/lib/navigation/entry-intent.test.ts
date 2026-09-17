import {
  CAMERA_ROUTE,
  EVENT_ROUTE,
  decideEntry,
  parseEntryURL,
  stackFromState,
  type EntryIntent,
  type StackRoute,
} from './entry-intent';

const ID = '8039e30c-47e7-42d3-a221-4a448fe49091';
const CAMERA_URL = `eventcameraclip://celebration/${ID}/camera`;
const EVENT_URL = `eventcameraclip://celebration/${ID}`;
const INVITATION_URL = 'https://stills.events/j/abc123#t=token';

const event: StackRoute = { name: EVENT_ROUTE, celebrationId: ID };
const camera: StackRoute = { name: CAMERA_ROUTE, celebrationId: ID };
const joinedInvitation: EntryIntent = { kind: 'event', celebrationId: ID, source: 'invitation' };

describe('parseEntryURL', () => {
  it('reads the Live Activity camera and card links', () => {
    expect(parseEntryURL(CAMERA_URL)).toEqual({ kind: 'camera', celebrationId: ID });
    expect(parseEntryURL(EVENT_URL)).toEqual({
      kind: 'event',
      celebrationId: ID,
      source: 'live-activity',
    });
  });

  it('reads the full app scheme the same way', () => {
    expect(parseEntryURL(`eventcamera://celebration/${ID}/camera`)).toEqual({
      kind: 'camera',
      celebrationId: ID,
    });
  });

  it('reads invitation links on either path, ignoring the token', () => {
    expect(parseEntryURL(INVITATION_URL)).toEqual({ kind: 'invitation', code: 'abc123' });
    expect(parseEntryURL('https://withstills.com/e/XYZ?x=1')).toEqual({
      kind: 'invitation',
      code: 'XYZ',
    });
  });

  it('leaves everything else alone', () => {
    expect(parseEntryURL('eventcameraclip:///')).toEqual({ kind: 'other' });
    expect(parseEntryURL(`eventcameraclip://celebration/${ID}/guestbook`)).toEqual({ kind: 'other' });
    expect(parseEntryURL('https://stills.events/privacy')).toEqual({ kind: 'other' });
  });
});

describe('decideEntry — camera', () => {
  it('cold: starts on the event page and follows with the viewfinder', () => {
    expect(
      decideEntry({ kind: 'camera', celebrationId: ID }, { url: CAMERA_URL, initial: true, stack: [] }),
    ).toEqual({ type: 'open-event-then-camera', celebrationId: ID });
  });

  it('warm on the event page: presents the viewfinder over it', () => {
    expect(
      decideEntry({ kind: 'camera', celebrationId: ID }, { url: CAMERA_URL, initial: false, stack: [event] }),
    ).toEqual({ type: 'navigate', path: CAMERA_URL });
  });

  it('viewfinder already open: does not stack a second one', () => {
    expect(
      decideEntry(
        { kind: 'camera', celebrationId: ID },
        { url: CAMERA_URL, initial: false, stack: [event, camera] },
      ),
    ).toMatchObject({ type: 'ignore' });
  });
});

describe('decideEntry — the invitation that arrives with a camera tap', () => {
  it('never moves a guest off the viewfinder they asked for', () => {
    expect(
      decideEntry(joinedInvitation, { url: INVITATION_URL, initial: false, stack: [event, camera] }),
    ).toMatchObject({ type: 'ignore' });
  });

  it('is ignored while a cold camera entry is still waiting on its event page', () => {
    expect(
      decideEntry(joinedInvitation, { url: INVITATION_URL, initial: false, stack: [event] }),
    ).toMatchObject({ type: 'ignore' });
  });

  it('is ignored when the camera is the only screen', () => {
    expect(
      decideEntry(joinedInvitation, { url: INVITATION_URL, initial: false, stack: [camera] }),
    ).toMatchObject({ type: 'ignore' });
  });

  it('still opens the event when the guest is somewhere else', () => {
    expect(
      decideEntry(joinedInvitation, {
        url: INVITATION_URL,
        initial: false,
        stack: [{ name: 'index' }],
      }),
    ).toEqual({ type: 'navigate', path: `/celebration/${ID}` });
  });

  it('opens the event directly at launch, skipping the join screen', () => {
    expect(
      decideEntry(joinedInvitation, { url: INVITATION_URL, initial: true, stack: [] }),
    ).toEqual({ type: 'navigate', path: `/celebration/${ID}` });
  });

  it('sends a device that has not joined to the join screen, token intact', () => {
    expect(
      decideEntry({ kind: 'invitation', code: 'abc123' }, { url: INVITATION_URL, initial: false, stack: [] }),
    ).toEqual({ type: 'navigate', path: INVITATION_URL });
  });
});

describe('decideEntry — the Live Activity card', () => {
  const card: EntryIntent = { kind: 'event', celebrationId: ID, source: 'live-activity' };

  it('cold: opens the event page', () => {
    expect(decideEntry(card, { url: EVENT_URL, initial: true, stack: [] })).toEqual({
      type: 'navigate',
      path: `/celebration/${ID}`,
    });
  });

  it('already on the event page: adds nothing', () => {
    expect(decideEntry(card, { url: EVENT_URL, initial: false, stack: [event] })).toMatchObject({
      type: 'ignore',
    });
  });

  it('from the viewfinder: returns to the event page rather than covering it', () => {
    expect(decideEntry(card, { url: EVENT_URL, initial: false, stack: [event, camera] })).toEqual({
      type: 'return-to-event',
      celebrationId: ID,
    });
  });

  it('from another event: opens this one', () => {
    const other: StackRoute = { name: EVENT_ROUTE, celebrationId: 'another' };
    expect(decideEntry(card, { url: EVENT_URL, initial: false, stack: [other] })).toEqual({
      type: 'navigate',
      path: `/celebration/${ID}`,
    });
  });
});

describe('stackFromState', () => {
  it('reads the app navigator nested under Expo Router’s root route', () => {
    const state = {
      index: 0,
      routes: [
        {
          name: '__root',
          state: {
            index: 1,
            routes: [
              { name: EVENT_ROUTE, params: { celebrationId: ID } },
              { name: CAMERA_ROUTE, params: { celebrationId: ID } },
            ],
          },
        },
      ],
    };
    expect(stackFromState(state)).toEqual([event, camera]);
  });

  it('is empty until that navigator has mounted', () => {
    expect(stackFromState({ index: 0, routes: [{ name: '__root' }] })).toEqual([]);
    expect(stackFromState(undefined)).toEqual([]);
  });
});
