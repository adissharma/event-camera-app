import Constants from 'expo-constants';

import { BRAND_CONFIG, LEGACY_GUEST_DOMAINS } from '@/config/brand';

/**
 * Recognising an event invitation, wherever it came from.
 *
 * One parser for the QR scanner and the paste field both, so a link that works
 * when scanned works when pasted and the two can never disagree about what
 * counts as ours. It is also the security boundary for the scanner: a QR code
 * is untrusted input that arrives without anybody typing it, so nothing here
 * ever yields a destination that is not this product's own join route.
 */

export interface JoinTarget {
  /** The event code — the `slug` segment of `/j/[slug]`. */
  code: string;
  /**
   * The invitation token from the link's fragment, when the link carried one.
   *
   * Preserved because it is what distinguishes an invited guest from someone
   * who merely knows the code, and dropping it silently downgrades the join.
   */
  token: string | null;
}

/**
 * Hosts we will follow. Anything else is somebody else's website.
 *
 * The canonical host plus every host we have previously published links
 * from. A QR code printed on a wedding sign outlives a domain move, so
 * accepting only the current host would silently reject invitations that
 * are still very much in circulation — the scanner would report a valid
 * link as "not one of ours".
 *
 * Still an allow-list, and still exact-match: adding old hosts widens what
 * we accept by exactly the set we ourselves issued, and nothing else.
 */
const GUEST_HOSTS: ReadonlySet<string> = new Set(
  [BRAND_CONFIG.guestDomain, ...LEGACY_GUEST_DOMAINS]
    .map(hostOf)
    .filter((host): host is string => Boolean(host)),
);

/**
 * The app's own deep-link scheme, read from the manifest rather than repeated
 * here — it is declared once in `app.json` and changing it in two places is
 * how a scheme quietly stops matching itself.
 */
const APP_SCHEME = (Constants.expoConfig?.scheme ?? 'eventcamera') as string;

/**
 * An event code, conservatively.
 *
 * Wide enough for any code the backend generates, narrow enough that a
 * sentence, a file path or a URL cannot be mistaken for one.
 */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Reads an invitation URL, and only an invitation URL.
 *
 * This is what the scanner uses. A QR code can contain anything at all —
 * a rival's link, a payment page, a `javascript:` URL — and the camera hands
 * it over without the guest having chosen it, so the rule here is a strict
 * allow-list of our own host and our own path. A bare event code is
 * deliberately *not* accepted: a sticker reading "WEDDING" is not consent to
 * join an event called WEDDING.
 */
export function parseJoinUrl(raw: string): JoinTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  const isWebLink =
    (scheme === 'https' || scheme === 'http') && GUEST_HOSTS.has(url.host.toLowerCase());
  // The app's own deep-link scheme, which is what an OS-level link handoff
  // and some printed codes use. `eventcamera://j/abc` parses with the code as
  // the host rather than as a path segment, so both shapes are read below.
  const isAppLink = scheme === APP_SCHEME;

  if (!isWebLink && !isAppLink) return null;

  const segments = `${isAppLink ? `${url.host}/` : ''}${url.pathname}`
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

  // `/j/<code>` and nothing else. A longer path is a different page.
  if (segments.length !== 2 || segments[0]!.toLowerCase() !== 'j') return null;

  const code = segments[1]!;
  if (!CODE_PATTERN.test(code)) return null;

  return { code, token: readToken(url) };
}

/**
 * The token, from the fragment or the query.
 *
 * Links are minted with it in the fragment (`#t=…`) so it stays out of server
 * logs and the `Referer` header — see `buildGuestUrl`. The query string is
 * read too, because a link that has been through a share sheet, a messaging
 * app or a QR generator may come back rewritten.
 */
function readToken(url: URL): string | null {
  const fragment = url.hash.replace(/^#/, '');
  const fromFragment = new URLSearchParams(fragment).get('t');
  if (fromFragment) return fromFragment;
  return url.searchParams.get('t');
}

/**
 * Reads anything a guest might reasonably paste.
 *
 * Looser than the scanner's rule by exactly one case: a bare event code,
 * because someone reading a code off a place card and typing it in has
 * plainly chosen to join, which is the consent the scanner cannot assume.
 */
export function parseJoinInput(raw: string): JoinTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const asUrl = parseJoinUrl(trimmed);
  if (asUrl) return asUrl;

  if (CODE_PATTERN.test(trimmed)) return { code: trimmed, token: null };
  return null;
}

/** The in-app route an invitation resolves to — the existing guest flow. */
export function joinRouteFor(target: JoinTarget): string {
  const query = target.token ? `?t=${encodeURIComponent(target.token)}` : '';
  return `/j/${encodeURIComponent(target.code)}${query}`;
}
