import type { ImperativeRouter } from 'expo-router';

type GalleryRouter = Pick<ImperativeRouter, 'canDismiss' | 'dismissTo' | 'replace'>;

/**
 * Lands on an event's gallery, closing whatever screens led here.
 *
 * Replaces instead when there is nothing to close, as after a deep link, so the
 * finished form is never left on the stack to go back to.
 */
export function returnToEventGallery(router: GalleryRouter, celebrationId: string): void {
  const gallery = {
    pathname: '/celebration/[celebrationId]',
    params: { celebrationId },
  } as const;

  if (router.canDismiss()) {
    router.dismissTo(gallery);
  } else {
    router.replace(gallery);
  }
}
