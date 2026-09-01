import Foundation
import ActivityKit

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
  
  @objc(startActivity:celebrationId:photosLeft:endTimeMs:)
  func startActivity(eventName: String, celebrationId: String, photosLeft: Int, endTimeMs: Double) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    
    let targetDate = Date(timeIntervalSince1970: endTimeMs / 1000.0)
    let contentState = EventLiveActivityAttributes.ContentState(
      photosLeft: photosLeft,
      endTime: targetDate
    )
    
    Task { @MainActor in
      // If there's already an active Live Activity for this celebration, update it instead of creating duplicates.
      if let existingActivity = Activity<EventLiveActivityAttributes>.activities.first(where: { $0.attributes.celebrationId == celebrationId }) {
        await existingActivity.update(
          ActivityContent<EventLiveActivityAttributes.ContentState>(
            state: contentState,
            staleDate: nil
          )
        )
        return
      }
      
      let attributes = EventLiveActivityAttributes(eventName: eventName, celebrationId: celebrationId)
      do {
        _ = try Activity.request(
          attributes: attributes,
          content: .init(state: contentState, staleDate: nil),
          pushType: nil
        )
      } catch {
        print("[LiveActivityModule] Error starting Live Activity for \(celebrationId): \(error.localizedDescription)")
      }
    }
  }
  
  @objc(updateActivity:photosLeft:endTimeMs:)
  func updateActivity(celebrationId: String, photosLeft: Int, endTimeMs: Double) {
    let targetDate = Date(timeIntervalSince1970: endTimeMs / 1000.0)
    let updatedContentState = EventLiveActivityAttributes.ContentState(
      photosLeft: photosLeft,
      endTime: targetDate
    )
    
    Task { @MainActor in
      for activity in Activity<EventLiveActivityAttributes>.activities where activity.attributes.celebrationId == celebrationId {
        await activity.update(
          ActivityContent<EventLiveActivityAttributes.ContentState>(
            state: updatedContentState,
            staleDate: nil
          )
        )
      }
    }
  }
  
  @objc(endActivity:)
  func endActivity(celebrationId: String) {
    Task { @MainActor in
      for activity in Activity<EventLiveActivityAttributes>.activities where activity.attributes.celebrationId == celebrationId {
        await activity.end(dismissalPolicy: .immediate)
      }
    }
  }

  @objc(endAllActivities)
  func endAllActivities() {
    Task { @MainActor in
      for activity in Activity<EventLiveActivityAttributes>.activities {
        await activity.end(dismissalPolicy: .immediate)
      }
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

