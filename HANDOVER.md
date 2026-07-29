# Handover

Premium cross-platform event-camera application. Working name `Koto` — a
placeholder, see `docs/renaming.md`.

**Read the "Honest status" section first.** A meaningful amount of the brief is
not built, and knowing which parts matters more than the summary.

---

## 1. Honest status

### Verified working, against a real database

| | Evidence |
|---|---|
| Design system | 18 contrast ratios enforced by `npm run check:contrast` |
| Database schema, RLS, storage policies | 81 pgTAP assertions passing |
| Anonymous lockout | Verified over REST with the shipping anon key |
| Passwordless auth + workspace bootstrap | Signed in end to end; DB shows profile + owner workspace |
| Event creation (12 steps) | Walked in browser; catalogue loads from Postgres |
| Publication | Published a real event; DB shows published status, slug, link, 11 entitlements |
| Dashboard + editing | Edited a live event; change persisted |
| **iOS native build** | Compiled and launched on iPhone 17 Pro simulator (iOS 26.5); real taps, navigation and keyboard verified |
| Guest join / upload intent / finalisation RPCs | 30 pgTAP assertions over the §23 failure matrix |

### Built but NOT verified end to end

- **Cover upload.** Code path exists and typechecks; never exercised with a real
  image from a photo library.
- **Reduce-motion behaviour.** Implemented throughout; not yet confirmed by
  toggling the simulator's Accessibility setting.
- **Haptics.** Called correctly; the simulator does not produce haptic feedback,
  so this needs a physical device.
- **QR scanning.** The code renders a well-formed code; never scanned by a real
  camera at a real distance across a dim room.
- **Android.** Never compiled — no Android SDK or JDK installed.

### NOT built

| Missing | Consequence |
|---|---|
| **Upload queue and processing worker** (Phase 3 back half) | Guests cannot actually upload. The RPCs that authorise and finalise uploads exist and are tested; the client queue, TUS resumption and the worker that produces thumbnails do not. |
| **The entire guest web app** | Nobody can join an event. The QR points at a domain that serves nothing. |
| **Real payments** | No money can be taken. See the warning below. |
| **Onboarding carousel** | Welcome screen covers the introduction. |
| **Multiple functions per celebration** | Schema supports it; UI is flagged off deliberately. |
| **Video, audio, Memory Book** | Schema and entitlements ready; correctly labelled "coming later". |
| **Re-issuing a guest link** | A host who loses their link has no recovery path. Needs a `regenerate_access_link` RPC. |
| **QR export to file/print** | Share sends text only. Needs `react-native-view-shot` and a dev build. |
| **Android build** | Never compiled. No Android SDK or JDK on the development machine. iOS now builds and runs. |

### ⚠️ Must not ship as-is

**Entitlements activate without a verified store receipt.** `publish_celebration`
grants a plan's entitlements immediately and records the purchase as `pending`
with `failure_code = 'unverified_development_purchase'`. In production, anyone
able to call that function could grant themselves any plan. Activation must move
behind server-side receipt verification in an Edge Function before launch. The
schema already carries the provenance needed. Flagged in the SQL itself and in
`docs/payments.md`.

**Email templates on the hosted project are still the stock ones.** OTP sign-in
will fail there until both the "Confirm signup" and "Magic Link" templates carry
`{{ .Token }}`. See `docs/auth-setup.md`.

---

## 2. Project tree

```
src/
  app/                      Expo Router routes
    index.tsx               Welcome
    sign-in.tsx verify.tsx  Passwordless OTP
    home.tsx                Event list / empty state
    create/                 12-step creation flow + success
    celebration/[id]/       Dashboard, edit, guest preview
  components/
    ui/ forms/ layout/ feedback/ media/ brand/
  design/                   Tokens: colour, type, spacing, motion
  features/
    auth/ celebrations/ entitlements/ media/ payments/ sharing/ uploads/
  lib/                      supabase, query-client, analytics, monitoring
  services/                 Typed data access
  i18n/ config/ types/
supabase/
  migrations/               13 migrations
  tests/                    4 pgTAP suites, 81 assertions
  templates/otp.html        REQUIRED — carries {{ .Token }}
  seed.sql config.toml
docs/                       12 documents
```

86 TypeScript files, 13 migrations, 123 Jest tests, 81 pgTAP assertions.

---

## 3. Reference audit summary

`docs/reference-audit.md`. Audited live in a browser.

- **WildBran** — typographic confidence, warm canvas, negative space. Not
  borrowed: its bespoke typeface (never downloaded or traced), its mascot.
- **MindMarket** — one connecting motif that carries continuity across sections.
  Became the progress thread. Not borrowed: its palette, doodles, or web-scale
  scroll pinning inside a mobile form.
- **Once** — the category leader. Photography-led, show the host the guest
  experience, short confident copy. **Highest derivative risk**, and the founder
  later chose a black canvas with a light serif, which is precisely Once's
  identity. Six binding differentiators are recorded in `docs/brand-system.md`;
  if they erode, the product becomes a copy.

No fabricated social proof anywhere.

---

## 4. Design system

"Ink & Ivory" — near-black canvas `#0B0B0C`, warm off-white `#F5F2ED`, ivory
primary action, champagne accent for celebratory moments only.

Nothing is pure black or pure white: pure black beside pure white glares,
crushes photographic shadows and smears on OLED during scroll.

Elevation is fill, not shadow — a shadow is invisible on near-black.

---

## 5. Typography and licensing

| Family | Role | Licence | Embedding |
|---|---|---|---|
| Instrument Serif | Display | SIL OFL 1.1 | **Permitted**, verified in `LICENSE_FONT` |
| Instrument Sans | Text / UI | SIL OFL 1.1 | **Permitted**, verified in `LICENSE_FONT` |

Siblings from one superfamily — that shared skeleton is the rationale, not the
reflexive serif-plus-sans habit. Neither is on the brief's excluded list.

**Gap:** neither covers Devanagari, Nastaliq/Arabic, Gurmukhi, Bengali or
Gujarati. Those fall back to the platform font. Adding a language needs an OFL
companion (Noto covers all five), and RTL for Urdu/Arabic is a phase of its own.

---

## 6. Database

`workspaces → celebrations → event_sessions → guest_sessions → media_items`,
plus the upload pipeline and a remotely configurable commercial catalogue.

- RLS on all 23 public tables; no `using (true)` on anything private.
- Policy helpers live in `private` (not exposed via PostgREST) and are SECURITY
  DEFINER, which breaks the recursion you get when a policy queries the table it
  protects.
- Every SECURITY DEFINER function pins `search_path = ''`.
- Clients cannot write media, guest sessions, purchases or entitlements —
  denied by **both** RLS and table privileges.
- Tokens and PINs stored only as 32-byte SHA-256 digests.
- Money in integer minor units.

---

## 7. Media pipeline

Authorisation and finalisation are done and tested; the client and worker are not.

```
capture → local queue → create_media_upload_intent → direct upload
        → finalise_media_upload → verify → process → ready
```

`create_media_upload_intent` is idempotent on `(event_session_id,
client_media_id)`, where the client id is generated **before any network
access**. A retry reuses the row rather than duplicating a photograph.

`finalise_media_upload` moves to `verifying`, never straight to `ready` — a
transfer can complete while the stored object is truncated.

**Missing:** the durable local queue, TUS resumption, and the worker that
verifies objects and generates variants.

---

## 8. Migrations and local Supabase

```bash
npx supabase start          # local stack (needs Docker)
npx supabase db reset       # migrations + seed
npx supabase test db        # 81 pgTAP assertions
```

Hosted:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Mail catcher at <http://localhost:54324> — use it rather than sending real mail;
the hosted free tier allows only a few emails per hour.

---

## 9. Environment variables

`.env.local`, gitignored:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

`EXPO_PUBLIC_*` is inlined into the bundle and readable by anyone with the app.
That is fine for the anon key, which carries no privileges of its own. **The
service-role key must never appear here** — it belongs in Edge Function secrets.

---

## 10. iOS

**Builds and runs.** Xcode 26.6, iOS 26.5 simulator runtime, CocoaPods 1.17.0
(installed via Homebrew). Verified on an iPhone 17 Pro simulator.

```bash
npx expo start            # then scan the QR with Expo Go
npx expo run:ios          # dev build — requires Xcode
npx eas build -p ios      # cloud build — requires an Expo account
```

Expo Go works today. It will stop working once QR export or camera capture land,
because those need native modules Expo Go does not bundle.

---

## 11. Android

**Never compiled.** No Android SDK or JDK on the development machine.

```bash
npx expo run:android
npx eas build -p android
```

---

## 12. Test commands

```bash
npm run typecheck        # strict TypeScript
npm run lint             # ESLint + React Compiler rules
npm test                 # 123 Jest tests
npm run check:contrast   # 18 measured contrast ratios
npm run check:sql        # 7 static schema invariants
npx supabase test db     # 81 pgTAP assertions
```

All currently pass.

---

## 13. Payment assumptions needing confirmation

Full detail in `docs/payments.md`. Four decisions need a human:

1. **Is this a digital good or a real-world service?** Default position: digital,
   so StoreKit is required on iOS. The service argument is weak while the
   deliverable is entirely in-app, and betting a launch on it costs a review cycle.
2. **Physical goods** (printed signage, photobooks) must **not** go through IAP
   and need a separate payment path.
3. **Small Business Program** — 15% rather than 30% under $1M/year. Changes pricing.
4. **UK/EU alternative billing** is moving quickly; verify at submission.

---

## 14. Security summary

- Tokens and PINs are digests only; plaintext returned exactly once.
- The guest link carries its token in the URL **fragment**, so it stays out of
  server logs, `Referer` headers and analytics.
- Anonymous requests are refused at the privilege layer (`42501`), before RLS is
  consulted — verified against the hosted project with the shipping anon key.
- Analytics and crash reports refuse anything credential-shaped, enforced by
  tests rather than by call-site discipline.
- Storage buckets are private; reads go through short-lived signed URLs.
- Path traversal rejected in every storage-path segment.

**Outstanding:** unverified purchases (§1), and web session storage uses
localStorage, which is unsuitable for a production web deployment — the guest web
app needs httpOnly cookies.

---

## 15. Known limitations

- Guests cannot upload; the guest app does not exist.
- No Android build has ever been produced.
- Reduce-motion and QR scanning are unverified; haptics need a physical device.
- No production photography; every image is a labelled placeholder.
- No logo; `BrandLogo` renders a placeholder rather than a fabricated mark.
- Background video is correctly licensed stock, marked `isPlaceholder`.
- Non-Latin scripts fall back to the platform font.
- Component tests are absent — all 123 tests are pure logic. Rendering tests
  need a Reanimated mock that this setup does not yet have.

---

## 16. Pre-production checklist

1. Move entitlement activation behind verified receipts. **Blocking.**
2. Update hosted email templates to carry `{{ .Token }}`. **Blocking for auth.**
3. Replace bundle ID, package name, slug, deep-link scheme (`docs/renaming.md`).
   Bundle ID and package name are irreversible after first submission.
4. Replace store product identifiers.
5. Supply the logo and real photography.
6. Build the guest web app.
7. Build the upload queue and processing worker.
8. Wire Sentry and PostHog into the existing abstractions.
9. Run accessibility QA on device: VoiceOver, TalkBack, largest Dynamic Type,
   reduce-motion.
10. Add `regenerate_access_link` so a host who loses their link can recover.

---

## 17. Recommended next phase

**The guest web camera and upload experience.**

It is the only thing standing between this and a usable product. Everything it
needs already exists and is tested: public slugs, restricted guest tokens,
anonymous guest sessions, the idempotent intent and finalisation operations,
private storage, processing job rows, and delayed reveal.

Build in this order:

1. Guest web app: QR landing → join → camera → counter → developing → gallery.
2. The durable upload queue — client UUID before network, restore after restart,
   and **never delete the local file until the server has verified the object**.
   The state machine already enforces this and has tests.
3. TUS resumption for poor venue networks.
4. The processing worker: verify, inspect actual file type, correct orientation,
   generate variants, strip metadata from derivatives, mark ready.

Only after that is there a product a guest can use.
