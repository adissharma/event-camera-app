import type { MediaStatus } from '@/types/database';
import {
  IllegalMediaTransitionError,
  assertTransition,
  canDiscardLocalFile,
  canTransition,
  isInFlight,
  isTerminal,
  reachableFrom,
} from './state-machine';

const ALL_STATUSES: MediaStatus[] = [
  'local_pending',
  'upload_authorising',
  'queued',
  'uploading',
  'paused',
  'uploaded',
  'verifying',
  'processing',
  'ready',
  'retryable_failed',
  'permanent_failed',
  'hidden',
  'deleted',
];

describe('media state machine', () => {
  describe('the happy path', () => {
    it('walks capture → ready without an illegal move', () => {
      const path: MediaStatus[] = [
        'local_pending',
        'upload_authorising',
        'queued',
        'uploading',
        'uploaded',
        'verifying',
        'processing',
        'ready',
      ];

      for (let i = 0; i < path.length - 1; i += 1) {
        expect(canTransition(path[i], path[i + 1])).toBe(true);
      }
    });
  });

  describe('interruption and recovery', () => {
    it('allows an in-flight upload to pause and resume', () => {
      expect(canTransition('uploading', 'paused')).toBe(true);
      expect(canTransition('paused', 'uploading')).toBe(true);
      expect(canTransition('paused', 'queued')).toBe(true);
    });

    it('returns a retryable failure to the queue', () => {
      expect(canTransition('uploading', 'retryable_failed')).toBe(true);
      expect(canTransition('retryable_failed', 'queued')).toBe(true);
    });

    it('lets a retryable failure become permanent once the budget is spent', () => {
      // Without this edge an item that keeps failing cycles through the queue
      // forever instead of surfacing to the user.
      expect(canTransition('retryable_failed', 'permanent_failed')).toBe(true);
    });

    it('allows re-authorisation when an upload intent has expired', () => {
      expect(canTransition('retryable_failed', 'upload_authorising')).toBe(true);
    });
  });

  describe('illegal transitions', () => {
    it('never skips server verification', () => {
      // The single most damaging shortcut available: marking an item ready
      // because the transfer finished. A transfer can complete while the stored
      // object is truncated or unreadable.
      expect(canTransition('uploaded', 'ready')).toBe(false);
      expect(canTransition('uploading', 'ready')).toBe(false);
      expect(canTransition('queued', 'processing')).toBe(false);
    });

    it('cannot resurrect a permanently failed item', () => {
      expect(canTransition('permanent_failed', 'queued')).toBe(false);
      expect(canTransition('permanent_failed', 'ready')).toBe(false);
    });

    it('treats deleted as absorbing', () => {
      for (const status of ALL_STATUSES) {
        expect(canTransition('deleted', status)).toBe(false);
      }
    });

    it('cannot upload without first authorising', () => {
      expect(canTransition('local_pending', 'uploading')).toBe(false);
      expect(canTransition('local_pending', 'queued')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('returns the target for a legal move', () => {
      expect(assertTransition('queued', 'uploading')).toBe('uploading');
    });

    it('throws a typed error for an illegal move', () => {
      expect(() => assertTransition('ready', 'uploading')).toThrow(IllegalMediaTransitionError);
      expect(() => assertTransition('ready', 'uploading')).toThrow('ready → uploading');
    });
  });

  describe('local file retention', () => {
    it('keeps the local copy until the server has verified the object', () => {
      // These are the states where the server has NOT confirmed a durable,
      // readable object. Discarding here can lose the only copy.
      const mustRetain: MediaStatus[] = [
        'local_pending',
        'upload_authorising',
        'queued',
        'uploading',
        'paused',
        'uploaded',
        'verifying',
        'processing',
        'retryable_failed',
      ];

      for (const status of mustRetain) {
        expect(canDiscardLocalFile(status)).toBe(false);
      }
    });

    it('specifically does not discard on upload completion alone', () => {
      expect(canDiscardLocalFile('uploaded')).toBe(false);
    });

    it('allows discarding once ready', () => {
      expect(canDiscardLocalFile('ready')).toBe(true);
    });
  });

  describe('classification', () => {
    it('marks the three terminal states', () => {
      expect(isTerminal('ready')).toBe(true);
      expect(isTerminal('permanent_failed')).toBe(true);
      expect(isTerminal('deleted')).toBe(true);
      expect(isTerminal('uploading')).toBe(false);
    });

    it('identifies work still owed to the pipeline', () => {
      expect(isInFlight('uploading')).toBe(true);
      expect(isInFlight('verifying')).toBe(true);
      expect(isInFlight('ready')).toBe(false);
      expect(isInFlight('local_pending')).toBe(false);
    });
  });

  describe('graph integrity', () => {
    it('lets every non-terminal status reach a terminal one', () => {
      // Guards against an item being able to get permanently stuck.
      for (const status of ALL_STATUSES) {
        if (isTerminal(status)) continue;
        const reachable = reachableFrom(status);
        const hasTerminal = [...reachable].some(isTerminal);
        expect(hasTerminal).toBe(true);
      }
    });

    it('lets every status reach deleted, so cleanup can always complete', () => {
      for (const status of ALL_STATUSES) {
        if (status === 'deleted') continue;
        expect(reachableFrom(status).has('deleted')).toBe(true);
      }
    });

    it('has no self-transitions', () => {
      for (const status of ALL_STATUSES) {
        expect(canTransition(status, status)).toBe(false);
      }
    });
  });
});
