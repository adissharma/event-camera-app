# App Clip architecture

## The mechanism

`expo-router` discovers routes with, in `expo-router/_ctx.js`:

```js
export const ctx = require.context(process.env.EXPO_ROUTER_APP_ROOT, true, /…/);
```

`require.context` recursively pulls **every** module under that directory into
the bundle. Declaring fewer `<Stack.Screen>` elements does not change this —
screen declarations only set navigation options for routes the bundler has
already included.

So the only way to keep full-app code out of the Clip is to point the Clip's
build at a different routes directory. That is what `app.config.js` does:

| Variant | `APP_VARIANT` | Routes directory | Bundle identifier |
| --- | --- | --- | --- |
| Full app | *(unset)* | `./src/app` | `com.potoevents.eventcamera` |
| App Clip | `clip` | `./src/app-clip` | `com.potoevents.eventcamera.Clip` |

`APP_VARIANT=clip` is set by the `clip` profile in `eas.json`.

Verify the config resolves correctly:

```bash
APP_VARIANT=clip npx expo config --type public --json | grep -o '"root":"[^"]*"'
```

## Routes in the Clip

`src/app-clip/` holds thin re-export modules. Each pulls only its own import
graph, so sibling host routes in `src/app` stay out of the bundle.

```
src/app-clip/
  _layout.tsx                                        guest providers + stack
  index.tsx                                          entry
  j/index.tsx                                        join by event code
  j/[slug].tsx                                       invitation cover, name, join
  e/[eventCode].tsx                                  canonical event link
  e/[eventCode]/gallery.tsx                          gallery
  celebration/[celebrationId]/index.tsx              guest event page
  celebration/[celebrationId]/preview.tsx            preview
  celebration/[celebrationId]/camera.tsx             capture + upload
  celebration/[celebrationId]/challenges/index.tsx   challenge list
  celebration/[celebrationId]/challenges/[id].tsx    challenge detail
  celebration/[celebrationId]/photos/[photoId].tsx   photo viewer
```

Absent from the Clip tree, and therefore from its binary: `index` (welcome),
`sign-in`, `verify`, `your-name`, `home`, `create/*`, and
`celebration/[celebrationId]/edit`.

The Clip layout also omits `CreationDraftProvider`, `LiveActivitySyncManager`
and the mock-data seeding used by the full app. It keeps `AuthContextProvider`,
because shared guest screens read `session` from it; with no sign-in route the
session is always null, so those screens always render their guest branch.

## The video

`src/config/visual-assets.ts` is imported by `premium-image` and
`visual-placeholder`, which guest screens use. It used to also hold
`MOTION_ASSETS`, whose module-scope `require('…/welcome-hero.mp4')` dragged
1.3 MB of footage into anything that touched the registry — including the Clip.

The motion registry now lives in `src/config/motion-assets.ts`, imported only by
`background-video.tsx` (full-app only). **Do not re-export it from
`visual-assets`**; that restores the import edge.

## Measured effect

`npx expo export --platform ios --no-minify`, full app vs `APP_VARIANT=clip`:

| | Full app | App Clip | Delta |
| --- | --- | --- | --- |
| JS bundle (`.hbc`) | 5.44 MB | 4.64 MB | −0.80 MB |
| Bundled assets | 46 | 45 | −1 |
| JS + assets | 16.75 MB | 14.69 MB | −2.06 MB |

The single dropped asset is the 1288 KB `welcome-hero.mp4`. These are unminified
JS figures and uncompressed asset totals, not the shipped `.ipa` size — the real
number needs a build (see below). The iOS 17+ Clip budget is 100 MB.

Remaining bulk in the Clip is the React Native / Expo runtime plus six
Instrument font faces (~410 KB) and the placeholder imagery.

## Developing the Clip: Debug loads from Metro, not the embedded bundle

The Clip's `AppDelegate.swift` resolves its JavaScript differently per
configuration:

```swift
#if DEBUG
  RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
  Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
```

Only the **Release** path uses the bundle produced by the Clip's own build phase
— the one built from `./src/app-clip`. A **Debug** run ignores it completely and
streams JS from whatever Metro is serving.

So `npx expo start` (no variant) + running the Clip from Xcode gives a correct
native App Clip displaying the **full app**: welcome screen, background video,
event creation. That is not a regression; it is the dev server winning.

To develop the Clip with hot reload:

```bash
APP_VARIANT=clip npx expo start --clear
```

To see exactly what ships, run the Clip in the **Release** configuration, or
install a Release build (`xcrun simctl install booted …/clip.app`).

One Metro instance serves one route tree. While `APP_VARIANT=clip` is set the
**main app** will show guest screens against that server, so unset it when
returning to main-app work.

## Fallback to the browser

The QR code and invitation link must encode a real HTTPS URL —
`https://poto.events/j/<slug>#t=<token>` — never a custom scheme. That single
URL is what makes the fallback automatic:

1. **iOS with the Clip available** — the App Clip card appears and the Clip opens
   at `/j/<slug>`.
2. **Full app installed** — the Universal Link wins and the full app opens the
   same path.
3. **Anything else** (older iOS, Android, desktop, Clip unavailable or network
   too slow) — nothing intercepts the URL, so the browser loads the Vercel web
   guest flow at the same path.

The token stays in the URL fragment (`#t=`), so it is not sent to the server or
leaked in `Referer`.

`public/.well-known/apple-app-site-association` declares both, and must be
served from `poto.events` over HTTPS as `application/json` with no redirect:

```json
{
  "applinks": { "apps": [], "details": [
    { "appID": "AL3AF36W3B.com.potoevents.eventcamera", "paths": ["/e/*", "/j/*"] }
  ]},
  "appclips": { "apps": ["AL3AF36W3B.com.potoevents.eventcamera.Clip"] }
}
```

Both IDs previously read `com.example.eventcamera` and the paths covered only
`/e/*`, so neither Universal Links nor Clip invocation could have worked.

## The native Clip target

`ios.appClips` in `app.json` was never a real Expo key — absent from the
`ExpoConfig` schema, read by no config plugin — so it was silently ignored on
every build and `--profile clip` produced the full app under a different name.
It has been removed.

The target is now generated by `@bacons/apple-targets` from `targets/clip/`,
which works with CNG. `expo-target.config.js` sets `type: 'clip'`,
`bundleIdentifier: '.Clip'`, `exportJs: true` and the `appclips:` associated
domains.

### Why `plugins/with-clip-js-bundle.js` exists

`exportJs` is implemented by attaching the **main app target's** "Bundle React
Native code and images" phase object to the Clip target — both targets end up
sharing one phase. The Clip would therefore embed the main app's bundle, built
from `./src/app`: the whole full app, video included. That would have undone the
route isolation at the native layer.

The plugin gives the Clip a duplicated phase prefixed with
`export APP_VARIANT=clip`, so its bundle is built from `./src/app-clip`. It must
stay listed after `@bacons/apple-targets` in `plugins`.

### Verified

`npx expo prebuild -p ios --clean` then `pod install`:

- Three targets exist — `application` (app), `app-extension` (Live Activity),
  and `application.on-demand-install-capable` (**the App Clip**).
- Two *distinct* "Bundle React Native code and images" phases. Only the Clip's
  begins `export APP_VARIANT=clip`; the app's is untouched.
- `Pods-clip` links `React-Core` and `hermes`, so the Clip runs the RN runtime.

Builds (`xcodebuild -scheme clip` and `-scheme eventcameraapp`):

- Clip Debug — **BUILD SUCCEEDED**
- Clip Release — **BUILD SUCCEEDED**
- Main app Debug — **BUILD SUCCEEDED** (regression check for the injected
  Live Activity sources)

The Release `clip.app` embeds a 4.6 MB `main.jsbundle` containing **0**
occurrences of `welcome-hero`, `BackgroundVideo`, `MOTION_ASSETS` or
`Create Event`, and the bundle contains **no `.mp4` at all**.

### Size: not yet a real number

The Release simulator `clip.app` is 122 MB, but that is not what Apple measures.
Simulator builds are unthinned, unstripped and uncompressed. The 100 MB budget
(iOS 17+; 15 MB on iOS 16) applies to the **thinned, compressed** device build.
The dominant contributors are the Clip executable (36 MB) and the React,
hermesvm, libavif, ExpoModulesCore, ZXingObjC and ExpoVideo frameworks.

Getting the real figure needs a device archive and its App Thinning Size Report.
Until that is measured, treat the Clip size as unknown. If it lands over budget,
the first candidates to drop are `libavif` (7.9 MB), `ZXingObjC` (3.0 MB, barcode
scanning — guests scan with the system camera, not in-app) and `ExpoVideo`
(3.0 MB, now that no guest screen plays video).

## The Live Activity target

The Live Activity had the same root cause as the original Clip bug: the
extension target, `LiveActivityModule.swift`/`.m`,
`EventLiveActivityAttributes.swift` and the `NSSupportsLiveActivities` Info.plist
key all existed **only** inside the gitignored `ios/` directory, with nothing to
recreate them. Every `expo prebuild` — including EAS's, on every cloud build —
deleted them, so Live Activities could not have worked in any cloud build.

It is now reproducible from config:

- `targets/live-activity/` — the WidgetKit extension: `@main` bundle, the Live
  Activity UI, the shared attributes, and the three brand `.ttf` faces. The
  fonts sit at the target root, not in `Fonts/`, because the `UIAppFonts` entries
  in its `Info.plist` are bare filenames resolved at the bundle root.
- `plugins/with-live-activity-module.js` — copies the RN bridge module into the
  **main app** target and registers it, plus the shared attributes file, which
  both targets must compile.
- `NSSupportsLiveActivities` moved into `app.json` under `ios.infoPlist`.

`EventLiveActivityAttributes.swift` has one source of truth, in
`targets/live-activity/`; the plugin copies it into the app target rather than
keeping a second copy, so the two can never drift.

## Plugin order matters

```json
["./plugins/with-clip-js-bundle", "@bacons/apple-targets", "./plugins/with-live-activity-module", …]
```

`with-clip-js-bundle` must be listed **before** `@bacons/apple-targets`, which
reads backwards but is correct. apple-targets registers a custom base mod
provider (`xcodeProjectBeta2`), and Expo rejects any mod added to a provider
after it is registered. Expo also composes mods so the earlier-registered action
runs later — so listing it first is what makes it run *after* the Clip target
exists. Listing it after apple-targets fails with
"Provider must be the last mod added".

The plugin throws if the Clip target or its bundling phase is missing, rather
than returning quietly. A silent no-op here would ship the full app's JS inside
the Clip — which is exactly how the original `ios.appClips` bug stayed invisible.
