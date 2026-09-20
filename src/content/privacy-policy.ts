import { BRAND_CONFIG } from '@/config/brand';

/**
 * The privacy policy, as data.
 *
 * Kept out of the screen so that revising a clause is a content change rather
 * than a component change, and so the same text can be rendered in-app later
 * without being transcribed a second time and drifting.
 */

/**
 * The inbox named in the policy. Rights requests, deletion requests and reports
 * about a child's data all arrive here, so it has to be one somebody reads.
 *
 * Named once. It appears three times in the text below, and a policy that
 * offers two different addresses is a policy nobody trusts.
 */
const PRIVACY_EMAIL = BRAND_CONFIG.supportEmail;

/** Shown under the title. Update whenever the text below changes materially. */
export const PRIVACY_LAST_UPDATED = '14 September 2026';

export type PolicyBlock =
  | { kind: 'lead'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'paragraph'; label?: string; text: string }
  | { kind: 'list'; items: { label?: string; text: string }[] }
  | { kind: 'address'; lines: string[] };

export const PRIVACY_POLICY: PolicyBlock[] = [
  {
    kind: 'lead',
    text:
      'Stills. (“Stills.”, “we”, “us”, “our”) helps hosts create private events where guests can capture, upload, and enjoy shared photos, videos, and guestbook messages. This Privacy Policy explains how we collect, use, store, and share personal data when you use the Stills. mobile app, website, and guest event links (the “Service”).',
  },

  { kind: 'section', text: '1. Information We Collect' },
  {
    kind: 'paragraph',
    label: 'Account information.',
    text:
      'If you create a host account, we collect your email address and, where provided, your name. You may sign in using email, Sign in with Apple, or Google. Apple or Google may provide identity information in accordance with the permissions you choose.',
  },
  {
    kind: 'paragraph',
    label: 'Event information.',
    text:
      'Hosts create event details such as event title, type, date and time, time zone, venue name or address, cover image, selected design theme, guest limits, challenges, guestbook instructions, and visibility settings.',
  },
  {
    kind: 'paragraph',
    label: 'Guest information.',
    text:
      'Guests can join an event using its invitation link and provide a display name. Guests do not need to create a full account. We create a random, device-local identifier and guest session so that the guest can continue participating in that event on the same device.',
  },
  {
    kind: 'paragraph',
    label: 'Content you create or upload.',
    text:
      'We collect photos, videos, audio or video guestbook messages, cover images, and optional captions or challenge submissions that you choose to create or upload through the Service. This content may include people, voices, locations, and other personal information visible or audible in it.',
  },
  {
    kind: 'paragraph',
    label: 'Purchase information.',
    text:
      'When you buy a paid event package on iOS, Apple processes the purchase. We receive transaction and product identifiers needed to confirm the purchase and provide the package. RevenueCat helps us manage purchase status and entitlements. We do not receive or store your full payment-card details.',
  },
  {
    kind: 'paragraph',
    label: 'Technical information.',
    text:
      'We and our service providers may process basic technical data needed to operate and secure the Service, such as IP address, device/browser type, operating system, app version, timestamps, and server logs.',
  },
  {
    kind: 'paragraph',
    label: 'Permissions.',
    text:
      'We request camera and microphone access only when you choose to capture photos, videos, or audio. We request photo-library access only when you choose media from your device. You can change permissions in your device settings.',
  },

  { kind: 'section', text: '2. How We Use Information' },
  { kind: 'paragraph', text: 'We use personal data to:' },
  {
    kind: 'list',
    items: [
      { text: 'Create and operate host accounts, events, invitations, and guest sessions.' },
      { text: 'Store, process, display, and share event content according to the host’s event settings.' },
      { text: 'Process and validate purchases and provide paid features.' },
      { text: 'Maintain security, prevent abuse, troubleshoot issues, and improve reliability.' },
      { text: 'Respond to support requests and communicate important service updates.' },
      { text: 'Comply with legal obligations and enforce our terms.' },
    ],
  },
  {
    kind: 'paragraph',
    text:
      'For UK and EEA users, we process data where necessary to provide the Service, pursue legitimate interests such as security and reliability, comply with law, or obtain consent where required.',
  },

  { kind: 'section', text: '3. Who Can See Event Content' },
  {
    kind: 'paragraph',
    text:
      'Event content is not public by default. It is available to the host and to guests permitted by that event’s settings.',
  },
  {
    kind: 'paragraph',
    text:
      'The host controls whether guests can view photos taken by other guests. Guest display names may appear alongside their contributions. Anyone who receives an event invitation link may be able to access the event invitation and join it, so hosts should share links only with intended guests.',
  },

  { kind: 'section', text: '4. Service Providers' },
  {
    kind: 'paragraph',
    text:
      'We do not sell personal information or use it for third-party advertising or cross-app tracking.',
  },
  { kind: 'paragraph', text: 'We use trusted providers to run the Service:' },
  {
    kind: 'list',
    items: [
      { label: 'Supabase', text: 'for authentication, database services, and private media storage.' },
      { label: 'Vercel', text: 'for web hosting and related infrastructure.' },
      { label: 'Apple', text: 'for iOS in-app purchases.' },
      { label: 'RevenueCat', text: 'for purchase validation and entitlement management.' },
      { label: 'Apple and Google', text: 'when you choose to use their sign-in services.' },
    ],
  },
  {
    kind: 'paragraph',
    text:
      'These providers process data only as needed to provide their services to us and under their own contractual and privacy obligations.',
  },

  { kind: 'section', text: '5. Storage and Retention' },
  {
    kind: 'paragraph',
    text: 'We keep account, event, and content data for as long as needed to provide the Service.',
  },
  {
    kind: 'paragraph',
    text:
      'When a host moves an event to Trash, it is scheduled for permanent deletion after 7 days unless restored first. Deleting an event also deletes associated event records and content as part of the deletion process, subject to limited backup or legal retention periods.',
  },
  {
    kind: 'paragraph',
    text:
      'We retain purchase records where necessary for accounting, fraud prevention, dispute handling, and legal obligations. Technical logs may be retained for a limited period for security and operational purposes.',
  },

  { kind: 'section', text: '6. Security' },
  {
    kind: 'paragraph',
    text:
      'We use reasonable technical and organisational measures designed to protect personal data, including encrypted connections and access controls. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
  },

  { kind: 'section', text: '7. Your Rights and Choices' },
  {
    kind: 'paragraph',
    text:
      'Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive a copy of your personal data.',
  },
  {
    kind: 'paragraph',
    text: `Hosts can manage or delete events in the app. You can also request help with access, correction, deletion, or other privacy requests by contacting us at ${PRIVACY_EMAIL}. We may need to verify your identity before responding and may retain limited data where legally required.`,
  },
  {
    kind: 'paragraph',
    text:
      'If you are in the UK or EEA, you may also complain to your local data-protection authority. In the UK, this is the Information Commissioner’s Office.',
  },

  { kind: 'section', text: '8. International Transfers' },
  {
    kind: 'paragraph',
    text:
      'Our providers may process data in countries outside the UK, EEA, or your country of residence. Where required, we use appropriate safeguards for international transfers.',
  },

  { kind: 'section', text: '9. Children' },
  {
    kind: 'paragraph',
    text: `Stills. is not intended for children under 13, and we do not knowingly collect personal data from children under 13 without appropriate authorisation. If you believe a child has provided personal data to us improperly, contact us at ${PRIVACY_EMAIL}.`,
  },

  { kind: 'section', text: '10. Changes to This Policy' },
  {
    kind: 'paragraph',
    text:
      'We may update this Privacy Policy when our practices or legal obligations change. We will post the updated version here and update the “Last updated” date. For material changes, we may provide additional notice in the app or by email.',
  },

  { kind: 'section', text: '11. Contact Us' },
  {
    kind: 'address',
    lines: [`Email: ${PRIVACY_EMAIL}`, 'Website: stills.events'],
  },
];
