/**
 * Live Activity (WidgetKit extension) target.
 *
 * This target previously existed only inside the gitignored `ios/` directory,
 * added by hand in Xcode with no config plugin to recreate it. Because the
 * project uses Continuous Native Generation, every `expo prebuild` — including
 * the one EAS runs on every cloud build — regenerated `ios/` and silently
 * dropped it. Declaring it here is what makes it survive.
 *
 * Contents:
 * - `EventLiveActivityBundle.swift`       `@main` WidgetBundle entry point.
 * - `EventLiveActivityLiveActivity.swift` the Live Activity UI.
 * - `EventLiveActivityAttributes.swift`   the shared ActivityAttributes model.
 * - `*.ttf`                               brand faces, registered via
 *                                         `UIAppFonts` in `Info.plist`. They
 *                                         sit at the target root, not in a
 *                                         `Fonts/` subdirectory, because
 *                                         `UIAppFonts` entries are bare
 *                                         filenames resolved at the bundle root.
 *
 * `EventLiveActivityAttributes.swift` must ALSO be compiled into the main app
 * target — the app constructs the attributes when starting an activity, the
 * extension reads them when rendering. `plugins/with-live-activity-module.js`
 * handles that side.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  // ActivityKit requires iOS 16.2. WidgetKit extension targets default lower,
  // which would fail to compile the `ActivityConfiguration` in the Live Activity.
  deploymentTarget: '16.2',
  entitlements: {},
});
