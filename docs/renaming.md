# Renaming checklist

`Koto` is a temporary working name. Everything below must change before launch.

The application is renameable by editing a small number of configuration values
and replacing logo assets. **No screen component, migration, table name, bucket,
RPC name, analytics event, error message, share template, QR template or legal
string contains a brand name.**

## 1. Brand strings — `src/config/brand.ts`

| Field | Current | Action |
|---|---|---|
| `appName` | `Koto` | Final product name |
| `shortName` | `Koto` | Short form for tight spaces |
| `tagline` | `Every guest. Every angle.` | Final tagline |
| `supportEmail` | `support@example.com` | Real support address |
| `websiteUrl` | `https://example.com` | Marketing site |
| `guestDomain` | `https://example.com` | Domain guest links resolve on |

## 2. Logo assets — `assets/brand/`

Drop in the real files and populate `BRAND_ASSETS`. Only populate variants that
actually exist. See `assets/brand/README.md`.

## 3. Platform identifiers — `src/config/app-config.ts` and `app.json`

| Identifier | Current | Notes |
|---|---|---|
| Expo slug | `event-camera-app` | Must match the EAS project |
| iOS bundle ID | `com.example.eventcamera` | **Cannot change after App Store release** |
| Android package | `com.example.eventcamera` | **Cannot change after Play release** |
| Deep-link scheme | `eventcamera` | Must match Supabase auth redirect config |
| App display name | `event-camera-app` | `app.json` → `expo.name` |

The bundle ID and package name are the two that are genuinely irreversible.
Settle the product name before the first store submission.

## 4. Backend configuration

- Supabase auth redirect URLs must include the final deep-link scheme.
- Universal links / App Links for `guestDomain` need `apple-app-site-association`
  and `assetlinks.json` on the real domain.
- Storage bucket names (`celebration-covers`, `event-media`, `qr-assets`) are
  brand-neutral and do **not** need to change.

## 5. Store metadata

App name, subtitle, description, keywords, screenshots, privacy policy URL and
support URL — none of these are in source control.

## What deliberately does not change

Internal terminology is brand-neutral by design and should stay as-is:
`workspaces`, `celebrations`, `event_sessions`, `guest_sessions`, `media_items`,
`publish_event`, `event-media`.

## Verification

After renaming, this must return no hits outside `src/config/brand.ts`,
`docs/` and this file:

```bash
grep -ri "koto" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.json" .
```
