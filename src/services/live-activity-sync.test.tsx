import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useAuth } from '@/features/auth/context';
import {
  celebrationKeys,
  listCelebrations,
  type CelebrationSummary,
} from '@/services/celebrations';
import { LiveActivitySyncManager } from './live-activity-sync';

jest.mock('@/features/auth/context', () => ({ useAuth: jest.fn() }));
jest.mock('@/services/live-activity', () => ({
  endLiveActivity: jest.fn(),
  syncLiveActivity: jest.fn(() => true),
}));
jest.mock('@/services/celebrations', () => ({
  celebrationKeys: { list: () => ['celebrations', 'list'] },
  listCelebrations: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.Mock;
const mockedList = listCelebrations as jest.Mock;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const liveEvent = {
  id: 'event-1',
  title: 'Wedding',
  status: 'published',
  endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  primarySession: null,
} as unknown as CelebrationSummary;

function setAuth(isSignedIn: boolean, isBackendConfigured = true) {
  mockedUseAuth.mockReturnValue({ isSignedIn, isBackendConfigured });
}

describe('LiveActivitySyncManager', () => {
  let queryClient: QueryClient;
  let view: ReactTestRenderer | null = null;

  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <LiveActivitySyncManager />
    </QueryClientProvider>
  );

  /** Mounts, or re-renders with the current auth, and lets queries settle. */
  async function renderManager() {
    await act(async () => {
      if (view) view.update(tree());
      else view = create(tree());
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    // As the real function behaves: a signed-out caller is denied the table,
    // and that denial comes back as a successful empty list.
    mockedList.mockImplementation(async () =>
      mockedUseAuth().isSignedIn ? [liveEvent] : [],
    );
  });

  afterEach(async () => {
    await act(async () => {
      view?.unmount();
    });
    view = null;
    queryClient.clear();
  });

  it('caches nothing for the home screen while signed out', async () => {
    setAuth(false);
    await renderManager();

    expect(mockedList).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(celebrationKeys.list())).toBeUndefined();
  });

  it('loads the host’s events as soon as they sign in', async () => {
    setAuth(false);
    await renderManager();

    setAuth(true);
    await renderManager();

    expect(queryClient.getQueryData(celebrationKeys.list())).toEqual([liveEvent]);
  });

  it('still reads local data when no backend is configured', async () => {
    setAuth(false, false);
    await renderManager();

    expect(mockedList).toHaveBeenCalledTimes(1);
  });
});
