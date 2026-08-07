//
//  EventLiveActivityBundle.swift
//  EventLiveActivity
//

import WidgetKit
import SwiftUI

// Widget entry point for the EventLiveActivity extension.
// Only includes our custom Live Activity — the boilerplate EventLiveActivity
// and iOS 18-only EventLiveActivityControl have been removed.
@main
struct EventLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        EventLiveActivityLiveActivity()
    }
}
