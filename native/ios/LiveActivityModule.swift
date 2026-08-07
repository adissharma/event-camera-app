import Foundation
import ActivityKit

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
  
  // Dictionary to keep track of active Live Activities keyed by celebrationId
  private var activeActivities = [String: Activity<EventLiveActivityAttributes>]()
  
  @objc(startActivity:celebrationId:photosLeft:endTimeMs:)
  func startActivity(eventName: String, celebrationId: String, photosLeft: Int, endTimeMs: Double) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    
    // If there's already an active Live Activity for this celebration, don't start a new one.
    if activeActivities[celebrationId] != nil {
      // We can just update it to make sure it is in sync
      updateActivity(celebrationId: celebrationId, photosLeft: photosLeft, endTimeMs: endTimeMs)
      return
    }
    
    let attributes = EventLiveActivityAttributes(eventName: eventName, celebrationId: celebrationId)
    
    let targetDate = Date(timeIntervalSince1970: endTimeMs / 1000.0)
    let initialContentState = EventLiveActivityAttributes.ContentState(
      photosLeft: photosLeft,
      endTime: targetDate
    )
    
    do {
      let activity = try Activity.request(
        attributes: attributes,
        content: .init(state: initialContentState, staleDate: nil),
        pushType: nil
      )
      self.activeActivities[celebrationId] = activity
    } catch {
      print("Error starting Live Activity for \(celebrationId): \(error.localizedDescription)")
    }
  }
  
  @objc(updateActivity:photosLeft:endTimeMs:)
  func updateActivity(celebrationId: String, photosLeft: Int, endTimeMs: Double) {
    let targetDate = Date(timeIntervalSince1970: endTimeMs / 1000.0)
    let updatedContentState = EventLiveActivityAttributes.ContentState(
      photosLeft: photosLeft,
      endTime: targetDate
    )
    
    Task {
      if let activity = activeActivities[celebrationId] {
        await activity.update(using: updatedContentState)
      } else {
        // Fallback: search for any active activity matching this celebrationId
        for activity in Activity<EventLiveActivityAttributes>.activities {
          if activity.attributes.celebrationId == celebrationId {
            self.activeActivities[celebrationId] = activity
            await activity.update(using: updatedContentState)
          }
        }
      }
    }
  }
  
  @objc(endActivity:)
  func endActivity(celebrationId: String) {
    Task {
      if let activity = activeActivities[celebrationId] {
        await activity.end(dismissalPolicy: .immediate)
        self.activeActivities.removeValue(forKey: celebrationId)
      } else {
        for activity in Activity<EventLiveActivityAttributes>.activities {
          if activity.attributes.celebrationId == celebrationId {
            await activity.end(dismissalPolicy: .immediate)
          }
        }
      }
    }
  }

  @objc(endAllActivities)
  func endAllActivities() {
    Task {
      for activity in Activity<EventLiveActivityAttributes>.activities {
        await activity.end(dismissalPolicy: .immediate)
      }
      self.activeActivities.removeAll()
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
