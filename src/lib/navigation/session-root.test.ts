import {
  resetToAuthenticatedRoot,
  resetToUnauthenticatedRoot,
} from './session-root';

describe('session root navigation', () => {
  it('clears the current stack before entering the authenticated root', () => {
    const router = { dismissAll: jest.fn(), replace: jest.fn() };

    resetToAuthenticatedRoot(router);

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/home');
    expect(router.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      router.replace.mock.invocationCallOrder[0],
    );
  });

  it('clears the authenticated stack before returning to welcome', () => {
    const router = { dismissAll: jest.fn(), replace: jest.fn() };

    resetToUnauthenticatedRoot(router);

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
