import ActivityKit
import WidgetKit
import SwiftUI
import UIKit

// UI configuration for the iOS Live Activity and Dynamic Island.
// CRITICAL: In Xcode, check Target Membership ONLY for "EventLiveActivityExtension".
//
// The visual language is "Ink & Ivory", the same system the app's screens use:
// a near-black canvas, warm ivory display serif for the one thing that matters
// (the event name), wide-tracked sans for everything supporting it, and a single
// ivory action. Nothing here is a system widget default — the extension runs in
// its own process and cannot read the app's design tokens, so the handful of
// values it needs are mirrored in `Ink` below and must be changed in step with
// `src/design/colours.ts`.

// MARK: - Design tokens

/// Mirrors `src/design/colours.ts`. Kept deliberately small: only the tokens the
/// Live Activity actually draws with.
private enum Ink {
    static let background = Color(red: 11 / 255, green: 11 / 255, blue: 12 / 255)   // #0B0B0C
    static let textPrimary = Color(red: 245 / 255, green: 242 / 255, blue: 237 / 255) // #F5F2ED
    static let textSecondary = Color(red: 162 / 255, green: 156 / 255, blue: 148 / 255) // #A29C94
    static let brandPrimary = Color(red: 239 / 255, green: 233 / 255, blue: 224 / 255) // #EFE9E0
    static let textOnBrand = Color(red: 11 / 255, green: 11 / 255, blue: 12 / 255)  // #0B0B0C
    static let accentWarm = Color(red: 217 / 255, green: 195 / 255, blue: 154 / 255) // #D9C39A
    static let hairline = Color.white.opacity(0.08)
}

/// Mirrors `src/design/typography.ts`.
///
/// `Font.custom` falls back to San Francisco without complaint when a face is
/// missing, which would quietly turn the whole design generic. Resolving the
/// face through `UIFont` first means a missing file degrades to the system
/// *serif* instead — still the right shape, just not the right cut.
private enum Type {
    private static let hasDisplay = UIFont(name: "InstrumentSerif-Regular", size: 12) != nil
    private static let hasText = UIFont(name: "InstrumentSans-Regular", size: 12) != nil
    private static let hasTextMedium = UIFont(name: "InstrumentSans-Medium", size: 12) != nil

    /// Instrument Serif. Event names only.
    static func display(_ size: CGFloat) -> Font {
        hasDisplay ? .custom("InstrumentSerif-Regular", size: size)
                   : .system(size: size, design: .serif)
    }

    /// Instrument Sans. Supporting metadata.
    static func text(_ size: CGFloat) -> Font {
        hasText ? .custom("InstrumentSans-Regular", size: size)
                : .system(size: size)
    }

    static func textMedium(_ size: CGFloat) -> Font {
        hasTextMedium ? .custom("InstrumentSans-Medium", size: size)
                      : .system(size: size, weight: .medium)
    }
}

/// The brand name. Mirrors `BRAND_CONFIG.shortName` in `src/config/brand.ts`.
private let brandName = "Candidly"

/// `eventcamera://celebration/<id>/camera` — straight into the viewfinder for
/// this event, not into the app's home screen.
private func cameraURL(for celebrationId: String) -> URL {
    URL(string: "eventcamera://celebration/\(celebrationId)/camera")!
}

// MARK: - Pieces

/// The brand marker: the wordmark in the display serif behind a hairline.
///
/// Text rather than the logo asset. The supplied logo is an outline-stroke
/// wordmark — at the 12pt this slot deserves, those strokes collapse into a
/// smudge. Setting the name in the same serif the logo is drawn from carries the
/// brand at small size and stays legible.
private struct BrandMark: View {
    var size: CGFloat = 12

    var body: some View {
        Text(brandName)
            .font(Type.display(size))
            .foregroundColor(Ink.accentWarm)
            .lineLimit(1)
            .padding(.horizontal, size * 0.55)
            .padding(.vertical, size * 0.18)
            .overlay(
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .strokeBorder(Ink.accentWarm.opacity(0.4), lineWidth: 1)
            )
    }
}

/// Icon plus value. The icon carries the warmth, the value carries the weight —
/// which is what lets the pair read at a glance without either shouting.
private struct Metric<Value: View>: View {
    let symbol: String
    var iconSize: CGFloat = 13
    @ViewBuilder var value: Value

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.system(size: iconSize, weight: .regular))
                .foregroundColor(Ink.accentWarm)
            value
                .foregroundColor(Ink.textPrimary)
        }
    }
}

/// The primary action, and the only filled shape on the surface.
private struct ShutterButton: View {
    let celebrationId: String
    var diameter: CGFloat = 56

    var body: some View {
        Link(destination: cameraURL(for: celebrationId)) {
            Circle()
                .fill(Ink.brandPrimary)
                .frame(width: diameter, height: diameter)
                .overlay(
                    Image(systemName: "camera")
                        .font(.system(size: diameter * 0.42, weight: .regular))
                        .foregroundColor(Ink.textOnBrand)
                )
        }
        .accessibilityLabel("Take a photo")
    }
}

// MARK: - Remaining values

/// The shot counter, as a bare figure. "10", not "10 shots left" — the camera
/// glyph beside it already says what the number counts.
private func remainingShots(_ photosLeft: Int) -> String {
    photosLeft < 0 ? "∞" : "\(photosLeft)"
}

/// Whole days, then whole hours, then minutes.
///
/// Floored at every step, so someone with six days and twenty hours is never
/// told they have seven — the same rule `formatDaysLeft` follows in the app.
private func compactTimeLeft(until date: Date) -> String {
    let remaining = date.timeIntervalSinceNow
    if remaining <= 0 { return "Ended" }

    let days = Int(remaining) / 86_400
    if days >= 1 { return "\(days)d left" }

    let hours = Int(remaining) / 3_600
    if hours >= 1 { return "\(hours)h left" }

    return "\(max(1, Int(remaining) / 60))m left"
}

/// Time remaining, self-updating.
///
/// A unit-labelled string everywhere above an hour. The obvious alternative — a
/// system `timerInterval` throughout — renders "19:36" beside the clock glyph,
/// which on a lock screen reads as twenty-to-eight rather than as time left.
/// A stale "18h left" is a far smaller lie than a figure people misread as a
/// wall clock, and the app refreshes the activity long before a whole hour of
/// drift accumulates.
///
/// Inside the final hour it does switch to a live ticker. That is the one window
/// where the number moves fast enough for staleness to mislead, and a display
/// visibly counting down cannot be mistaken for the time of day.
private struct TimeRemaining: View {
    let endTime: Date
    var size: CGFloat = 15

    var body: some View {
        let remaining = endTime.timeIntervalSinceNow

        if remaining <= 0 {
            Text("Ended").font(Type.textMedium(size))
        } else if remaining > 3_600 {
            Text(compactTimeLeft(until: endTime)).font(Type.textMedium(size))
        } else {
            // The width needs to be both fixed and generous. `timerInterval`
            // reports an unbounded ideal width, so letting it size itself
            // (`fixedSize`) starves the shutter button out of the row; pinning it
            // too tightly makes the system give up on the seconds and draw
            // "15:--". This is measured to hold "59:59" with room to spare.
            Text(timerInterval: Date()...endTime, countsDown: true)
                .font(Type.textMedium(size).monospacedDigit())
                .frame(width: size * 4.6, alignment: .leading)
        }
    }
}

// MARK: - Lock screen

/// Everything the host needs in under a second: which event, how many shots
/// left, how long remains, and one obvious way to take another.
private struct LockScreenView: View {
    let context: ActivityViewContext<EventLiveActivityAttributes>

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                BrandMark()

                Text(context.attributes.eventName)
                    .font(Type.display(30))
                    .foregroundColor(Ink.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    // Generous above, tight below: the serif belongs to the
                    // metadata under it, not to the brand mark over it.
                    .padding(.top, 12)
                    .padding(.bottom, 6)

                HStack(spacing: 12) {
                    Metric(symbol: "camera") {
                        Text(remainingShots(context.state.photosLeft))
                            .font(Type.textMedium(15).monospacedDigit())
                    }

                    Rectangle()
                        .fill(Ink.textSecondary.opacity(0.3))
                        .frame(width: 1, height: 14)

                    Metric(symbol: "clock") {
                        TimeRemaining(endTime: context.state.endTime)
                    }
                }
            }

            Spacer(minLength: 8)

            ShutterButton(celebrationId: context.attributes.celebrationId)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        // `strokeBorder` draws inside the shape, so the hairline sits flush with
        // the system container rather than being clipped in half by it.
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Ink.hairline, lineWidth: 1)
        )
        .activityBackgroundTint(Ink.background)
        .activitySystemActionForegroundColor(Ink.textPrimary)
    }
}

// MARK: - Widget

struct EventLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventLiveActivityAttributes.self) { context in
            LockScreenView(context: context)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandMark(size: 11)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Metric(symbol: "clock", iconSize: 11) {
                        TimeRemaining(endTime: context.state.endTime, size: 12)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(context.attributes.eventName)
                                .font(Type.display(22))
                                .foregroundColor(Ink.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)

                            Metric(symbol: "camera", iconSize: 11) {
                                Text(remainingShots(context.state.photosLeft))
                                    .font(Type.textMedium(12).monospacedDigit())
                            }
                        }

                        Spacer(minLength: 8)

                        ShutterButton(
                            celebrationId: context.attributes.celebrationId,
                            diameter: 40
                        )
                    }
                    .padding(.top, 6)
                }
            } compactLeading: {
                Image(systemName: "camera")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(Ink.accentWarm)
            } compactTrailing: {
                Text(remainingShots(context.state.photosLeft))
                    .font(Type.textMedium(13).monospacedDigit())
                    .foregroundColor(Ink.textPrimary)
            } minimal: {
                Image(systemName: "camera")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(Ink.accentWarm)
            }
            .widgetURL(cameraURL(for: context.attributes.celebrationId))
            .keylineTint(Ink.accentWarm)
        }
    }
}
