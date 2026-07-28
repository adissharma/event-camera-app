# Auth setup

Passwordless six-digit email OTP. No passwords exist anywhere in the product.

## Why OTP rather than magic links

In a native app a magic link means leaving for a mail client and hoping the deep
link survives the round trip. Worse, mail clients and security scanners that
**pre-fetch URLs** can consume a single-use token before the user ever taps it —
which presents as "the link doesn't work" with no useful error.

A code the user reads and types works from any mail client, on any device,
including one that is not the phone running the app.

## REQUIRED: the email template must contain `{{ .Token }}`

**This is the setup step that silently breaks everything if missed.**

Supabase's stock templates contain only `{{ .ConfirmationURL }}`. With a
link-only email there is no code to type, so `verifyOtp` can never succeed. The
symptom is a sign-in screen that accepts an address, sends an email, and then
goes nowhere — with no error anywhere to explain it.

This was hit during development and is why `supabase/templates/otp.html` exists.

### Local

Already configured. `supabase/config.toml` points both templates at
`supabase/templates/otp.html`:

```toml
[auth.email.template.confirmation]
subject = "Your sign-in code"
content_path = "./supabase/templates/otp.html"

[auth.email.template.magic_link]
subject = "Your sign-in code"
content_path = "./supabase/templates/otp.html"
```

**Both** are needed. A first-time address goes through `confirmation` (sign-up)
and a returning one through `magic_link`. Overriding only one means sign-in
works for new users and breaks for returning ones, or the reverse — a bug that
survives casual testing because most testing is done with one account.

### Hosted — do this before anyone else signs in

Dashboard → **Authentication** → **Emails** → **Templates**:

1. Open **Confirm signup**. Replace the body with the contents of
   `supabase/templates/otp.html`. Set the subject to "Your sign-in code".
2. Open **Magic Link**. Do the same.

Verify by requesting a code and confirming the email contains six digits.

## Local development

The local stack runs **Mailpit** at <http://localhost:54324>, which captures
every outbound email. Use it rather than sending real mail:

- No rate limits. The hosted free tier allows only a few emails per hour, and
  exhausting it blocks your own testing for the next hour.
- No production pollution — no stray users in the real project.
- Any address works, including ones that do not exist.

Note that hosted Supabase rejects some addresses outright as invalid, including
`@example.com`. Local has no such restriction.

## Architecture

Screens depend on the `AuthProvider` interface in `src/features/auth/types.ts`,
never on Supabase directly. Adding **Sign in with Apple** — which the App Store
requires alongside any third-party social sign-in — is a second implementation
of that interface rather than an edit to every screen that touches identity.

Failures are a discriminated union rather than exceptions. Wrong code, expired
code and rate-limited are all expected parts of the flow and each needs
different copy; a `catch` block would lose the type.

Unknown errors return a deliberately generic message. A specific one ("no
account with that email") is a user-enumeration weakness.

## Session storage

- **Native:** Expo SecureStore, via a chunking adapter. SecureStore caps a value
  at 2048 bytes and a Supabase session exceeds it; the write fails *silently* on
  some platforms, which presents as being signed out on every launch.
- **Web:** AsyncStorage → localStorage. Fine for the development preview, **not**
  suitable for production web — shipping the guest web app needs httpOnly
  cookies instead.
- **Server rendering:** a no-op store with persistence disabled. `web.output` is
  `static`, so Expo Router renders routes in Node where there is no `window`;
  without this the dev server crashes outright with `ReferenceError: window is
  not defined`, and a production static export fails the same way.

## Personal workspace

Created by the `on_auth_user_created` trigger, so it cannot be skipped by a
client that crashes mid-onboarding. `ensure_personal_workspace()` is called
after every verification as an idempotent repair path — without it, a user whose
bootstrap failed could sign in and then be unable to create an event.

Verified end to end locally: a fresh sign-in produces one profile row and one
personal workspace with role `owner`.

## Deep links

Scheme: `eventcamera` (temporary — see `docs/renaming.md`).

Registered in `supabase/config.toml` under `additional_redirect_urls`. The
hosted project needs the same values in **Authentication → URL Configuration**
before any build that is not running against localhost.
