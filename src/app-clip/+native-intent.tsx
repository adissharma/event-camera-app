import { routeSystemEntry } from '@/lib/navigation/system-entry';

/**
 * Every system URL the Clip receives — the one it launched with
 * (`initial: true`) and each one delivered while it runs — passes through
 * here before Expo Router turns it into navigation. `path` is the full URL.
 *
 * A single tap can deliver more than one: a Live Activity link, and the App
 * Clip invocation link iOS hands over alongside it. `routeSystemEntry` decides
 * what each should do given where the guest already is, so a generic
 * invitation can never land on top of the viewfinder the guest asked for.
 * Returning null leaves navigation untouched.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): Promise<string | null> {
  return routeSystemEntry(path, initial);
}
