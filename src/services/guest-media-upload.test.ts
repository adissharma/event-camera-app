import { requireSupabase } from '@/lib/supabase/client';
import { uploadGuestPhoto } from './guest-media-upload';

jest.mock('@/lib/supabase/client', () => ({ requireSupabase: jest.fn() }));
jest.mock('@/lib/supabase/media-signal', () => ({ signalMediaChanged: jest.fn() }));
jest.mock('@/features/media/read-local-image', () => ({
  readLocalMediaBytes: jest.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    sizeBytes: 3,
    mimeType: 'image/jpeg',
  })),
}));
jest.mock('@/features/media/photo-downscale', () => ({
  downscalePhotoForUpload: jest.fn(async () => null),
}));
jest.mock('expo-crypto', () => {
  let next = 0;
  return { randomUUID: () => `client-id-${(next += 1)}` };
});

const lost = { data: null, error: { message: 'fetch failed: The network connection was lost.' } };
const intent = {
  data: {
    media_item_id: 'item',
    upload_intent_id: 'intent',
    bucket: 'event-media',
    storage_path: 'path/original-v1.jpg',
    thumbnail_storage_path: null,
  },
  error: null,
};
const finalised = {
  data: { media_item_id: 'item', status: 'ready', storage_path: 'path/original-v1.jpg', shots_used: 1 },
  error: null,
};

function mockServer({
  rpc,
  upload = [{ error: null }],
}: {
  rpc: unknown[];
  upload?: { error: { message: string } | null }[];
}) {
  const client = {
    rpc: jest.fn(async () => (rpc.length > 1 ? rpc.shift() : rpc[0])),
    storage: {
      from: () => ({ upload: jest.fn(async () => (upload.length > 1 ? upload.shift() : upload[0])) }),
    },
  };
  (requireSupabase as jest.Mock).mockReturnValue(client);
  return client;
}

const post = (localUri: string) =>
  uploadGuestPhoto({ eventCode: 'ABC', guestToken: 't', localUri, source: 'camera', mimeType: 'image/jpeg' });

const clientIdsSent = (client: ReturnType<typeof mockServer>) =>
  (client.rpc.mock.calls as unknown as [string, { p_client_media_id?: string }][])
    .filter(([name]) => name === 'create_guest_media_upload_intent')
    .map(([, args]) => args.p_client_media_id);

describe('posting a photo over a bad connection', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  it('tries again by itself, as the same photo', async () => {
    const client = mockServer({ rpc: [lost, intent, finalised] });

    await expect(post('file:///one.jpg')).resolves.toMatchObject({ shotsUsed: 1 });

    const ids = clientIdsSent(client);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('gives up with the original error when the connection stays down', async () => {
    mockServer({ rpc: [lost] });

    await expect(post('file:///two.jpg')).rejects.toThrow('network connection was lost');
  });

  it('keeps the same photo when the guest taps post again', async () => {
    const down = mockServer({ rpc: [lost] });
    await expect(post('file:///three.jpg')).rejects.toThrow();
    const firstId = clientIdsSent(down)[0];

    const back = mockServer({ rpc: [intent, finalised] });
    await post('file:///three.jpg');

    expect(clientIdsSent(back)[0]).toBe(firstId);
  });

  it('treats a photo that already arrived as uploaded when posting again', async () => {
    mockServer({ rpc: [intent, lost, lost, lost] });
    await expect(post('file:///four.jpg')).rejects.toThrow();

    mockServer({
      rpc: [intent, finalised],
      upload: [{ error: { message: 'The resource already exists' } }],
    });

    await expect(post('file:///four.jpg')).resolves.toMatchObject({ mediaItemId: 'item' });
  });

  it('does not retry something the server refused', async () => {
    const client = mockServer({ rpc: [{ data: null, error: { message: 'shot limit reached' } }] });

    await expect(post('file:///five.jpg')).rejects.toThrow('shot limit reached');

    expect(clientIdsSent(client)).toHaveLength(1);
  });

  it('starts a new photo after a successful post', async () => {
    const first = mockServer({ rpc: [intent, finalised] });
    await post('file:///six.jpg');
    const firstId = clientIdsSent(first)[0];

    const second = mockServer({ rpc: [intent, finalised] });
    await post('file:///six.jpg');

    expect(clientIdsSent(second)[0]).not.toBe(firstId);
  });
});
