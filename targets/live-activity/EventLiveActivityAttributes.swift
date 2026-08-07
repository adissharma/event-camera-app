import ActivityKit
import Foundation

// Shared data model structure between the React Native app and the iOS Widget Extension.
// CRITICAL: In Xcode, check Target Membership for BOTH "eventcameraapp" and "EventLiveActivityExtension".
struct EventLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var photosLeft: Int
        var endTime: Date
    }

    var eventName: String
    var celebrationId: String
}
