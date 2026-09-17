import ActivityKit
import Foundation
import WidgetKit
import SwiftUI

// ActivityKit configuration for the Live Activity and the Dynamic Island.
// CRITICAL: In Xcode, check Target Membership ONLY for "EventLiveActivityExtension".
//
// The visual layer lives in `StillsLockScreenCard.swift`, which knows nothing
// about ActivityKit. This file is the seam between the two: it unpacks the
// live `ContentState` and hands plain values to the card.

/// Builds a URL for the application that owns the activity.
///
/// The App Clip has its own scheme, so a Clip activity's links are only ever
/// claimed by the Clip and never by the full app's `eventcamera`. Where a link
/// leaves the guest once inside is decided by the app, in
/// `src/lib/navigation/entry-intent.ts`.
private func eventURL(for celebrationId: String, path: String = "") -> URL {
    let isClipActivity = Bundle.main.bundleIdentifier?.hasSuffix(".Clip.liveactivities") == true
    let scheme = isClipActivity ? "eventcameraclip" : "eventcamera"
    return URL(string: "\(scheme)://celebration/\(celebrationId)\(path)")!
}

/// The default card target is the event gallery.
private func galleryURL(for celebrationId: String) -> URL {
    eventURL(for: celebrationId)
}

/// The explicit camera control opens the viewfinder.
private func cameraURL(for celebrationId: String) -> URL {
    eventURL(for: celebrationId, path: "/camera")
}

struct EventLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EventLiveActivityAttributes.self) { context in
            StillsLockScreenCard(
                eventName: context.attributes.eventName,
                photosLeft: context.state.photosLeft,
                allowance: context.state.photoAllowance,
                endTime: context.state.endTime,
                cameraDestination: cameraURL(for: context.attributes.celebrationId)
            )
            // Without a URL, tapping the card causes iOS to fall back to a
            // generic App Clip handoff. The event surface must instead open
            // its own gallery, while the nested CameraCTA retains its
            // higher-priority, viewfinder-specific Link.
            .widgetURL(galleryURL(for: context.attributes.celebrationId))
            // The gradient retreats rather than jumping when a shot is taken.
            // Restrained on purpose: a spring here would read as a game.
            .animation(.easeInOut(duration: 0.45), value: context.state.photosLeft)
            // An opaque layer of our own, edge to edge, as well as the tint.
            // The tint alone leaves the system's container material showing at
            // the edges, which reads as a pale rim around the card.
            .background(Ink.background)
            .activityBackgroundTint(Ink.background)
            .activitySystemActionForegroundColor(Ink.textPrimary)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    StillsMark(size: 18)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    TimeRemainingView(endTime: context.state.endTime, size: 12)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .center, spacing: 12) {
                            Text(context.attributes.eventName)
                                .font(Type.display(24))
                                .foregroundColor(Ink.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)

                            Spacer(minLength: 8)

                            CameraCTA(
                                destination: cameraURL(for: context.attributes.celebrationId),
                                width: 58,
                                height: 40
                            )
                        }

                        // The island has no card edge to run into, so the footer
                        // keeps its shape at a smaller scale rather than bleeding.
                        StillsRemainingFooter(
                            photosLeft: context.state.photosLeft,
                            allowance: context.state.photoAllowance,
                            height: 40,
                            labelSize: 13
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .padding(.top, 4)
                    .animation(.easeInOut(duration: 0.45), value: context.state.photosLeft)
                }
            } compactLeading: {
                StillsMark(size: 16)
            } compactTrailing: {
                Text(
                    stillsIsUnlimited(
                        photosLeft: context.state.photosLeft,
                        allowance: context.state.photoAllowance
                    ) ? "∞" : "\(max(0, context.state.photosLeft))"
                )
                    .font(Type.textMedium(13).monospacedDigit())
                    .foregroundColor(Ink.textPrimary)
            } minimal: {
                StillsMark(size: 16)
            }
            // The whole Dynamic Island opens the gallery. Its explicit camera
            // Link above still takes priority when the button is tapped.
            .widgetURL(galleryURL(for: context.attributes.celebrationId))
            .keylineTint(Ink.accentStops[2])
        }
    }
}
