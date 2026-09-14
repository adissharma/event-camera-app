#!/usr/bin/env bash
#
# Build the app and put it on the connected iPhone, in one step.
#
# Use this after changing the Live Activity's Swift — the card lives in the
# widget extension, which Metro cannot hot-reload, so seeing a change on the
# lock screen means a native build. The first one is long because the project
# compiles React Native from source; every one after it is incremental.
#
# `expo run:ios --device` does not pass `-allowProvisioningUpdates`, so it
# cannot refresh a provisioning profile and fails on the Sign In with Apple
# entitlement. This calls xcodebuild directly with that flag, then installs.
#
#   ./scripts/ios-device.sh            # first connected device
#   ./scripts/ios-device.sh <udid>     # a specific one
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$ROOT/ios/Stills.xcworkspace"
LOG="${TMPDIR:-/tmp}/stills-ios-device.log"

if [ ! -d "$WORKSPACE" ]; then
  echo "No Xcode workspace. Run 'npx expo prebuild -p ios' first." >&2
  exit 1
fi

UDID="${1:-}"
if [ -z "$UDID" ]; then
  # Read the UDID from devicectl's JSON. The table output cannot be parsed by
  # column: a device named "Bindu's iPhone" and a model "iPhone 12 Pro Max" both
  # contain spaces, so field offsets land on whatever the name happens to end
  # with — which is how this script once tried to build for a device called
  # "Pro".
  DEV_JSON="${TMPDIR:-/tmp}/stills-devices.json"
  xcrun devicectl list devices --json-output "$DEV_JSON" >/dev/null 2>&1 || true
  UDID=$(python3 -c 'import json,sys
try:
    devs = json.load(open(sys.argv[1]))["result"]["devices"]
except Exception:
    sys.exit(0)
for d in devs:
    if d.get("connectionProperties", {}).get("tunnelState") != "unavailable":
        u = d.get("hardwareProperties", {}).get("udid")
        if u:
            print(u); break' "$DEV_JSON" 2>/dev/null || true)
fi

if [ -z "$UDID" ]; then
  echo "No connected device found. Plug the iPhone in and unlock it." >&2
  exit 1
fi

echo "→ Building for $UDID (log: $LOG)…"
if ! xcodebuild \
      -workspace "$WORKSPACE" \
      -scheme Stills \
      -configuration Debug \
      -destination "id=$UDID" \
      -allowProvisioningUpdates \
      build > "$LOG" 2>&1; then
  echo "Build failed. Last errors:" >&2
  grep -aE "error:|BUILD FAILED" "$LOG" | tail -15 >&2
  echo "(full log: $LOG)" >&2
  exit 1
fi

APP=$(find ~/Library/Developer/Xcode/DerivedData/Stills-*/Build/Products/Debug-iphoneos \
  -maxdepth 1 -name "Stills.app" 2>/dev/null | head -1)
if [ -z "$APP" ]; then
  echo "Built, but could not find Stills.app in DerivedData." >&2
  exit 1
fi

echo "→ Installing…"
xcrun devicectl device install app --device "$UDID" "$APP" > /dev/null
echo "✓ Installed. Any running Live Activity will pick up the new widget."
