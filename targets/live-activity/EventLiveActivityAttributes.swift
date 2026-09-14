import ActivityKit
import Foundation

// Shared data model structure between the React Native app and the iOS Widget Extension.
// CRITICAL: In Xcode, check Target Membership for BOTH "eventcameraapp" and "EventLiveActivityExtension".
struct EventLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var photosLeft: Int
        var endTime: Date

        /// The event's full capture allowance, which `photosLeft` counts down from.
        ///
        /// The footer draws remaining as a fraction of the whole, so the total is
        /// the one thing the design needs that the old state could not supply —
        /// `photosLeft` alone says "24" but not "24 of what".
        ///
        /// Optional on purpose. Synthesised `Codable` ignores property defaults,
        /// so a non-optional addition would fail to decode any activity started
        /// by an older build and silently kill it on upgrade. `nil` means "an
        /// older client started this", and the footer treats it as unlimited.
        ///
        /// A non-positive value means the event has no cap at all.
        ///
        /// Interpreting this — unlimited, and the remaining fraction — lives in
        /// `StillsLockScreenCard.swift` rather than here. This file is compiled
        /// into the main app target too, which does not have the widget's views,
        /// so anything it references has to exist on both sides.
        var photoAllowance: Int?
    }

    var eventName: String
    var celebrationId: String
}
