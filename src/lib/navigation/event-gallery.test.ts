import { returnToEventGallery } from './event-gallery';

const gallery = { pathname: '/celebration/[celebrationId]', params: { celebrationId: 'abc' } };

function routerThat(canDismiss: boolean) {
  return { canDismiss: jest.fn(() => canDismiss), dismissTo: jest.fn(), replace: jest.fn() };
}

describe('returning to the event gallery', () => {
  it('closes the screens above the gallery', () => {
    const router = routerThat(true);

    returnToEventGallery(router, 'abc');

    expect(router.dismissTo).toHaveBeenCalledWith(gallery);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces the screen when there is nothing to close', () => {
    const router = routerThat(false);

    returnToEventGallery(router, 'abc');

    expect(router.replace).toHaveBeenCalledWith(gallery);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
