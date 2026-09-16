import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

// The Live Activity's visual layer.
//
// Deliberately free of ActivityKit: this file takes plain values, so the card
// can be rendered in a preview, in a snapshot harness, or anywhere else without
// an activity to hand. `EventLiveActivityLiveActivity.swift` supplies the values
// from the live `ContentState` and owns everything ActivityKit-shaped —
// configuration, the Dynamic Island, the deep link.
//
// The extension runs in its own process and cannot read the app's design
// tokens, so the handful of values it needs are mirrored in `Ink` below and
// must be changed in step with `src/design/colours.ts`.

// MARK: - Design tokens

/// Mirrors `src/design/colours.ts`. Kept deliberately small: only the tokens the
/// Live Activity actually draws with.
enum Ink {
    static let background = Color(red: 11 / 255, green: 11 / 255, blue: 12 / 255)   // #0B0B0C
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.72)
    static let surfaceWhite = Color.white
    static let textOnWhite = Color.black

    /// Mirrors `REVEAL_TRACK_GRADIENT` in `src/design/colours.ts` — the same
    /// stops the reveal toggle and the treatment swatches use, so the one
    /// coloured thing on the lock screen speaks the app's accent language.
    static let accentStops: [Color] = [
        Color(red: 0x5B / 255, green: 0x2A / 255, blue: 0x9E / 255), // #5B2A9E
        Color(red: 0x8A / 255, green: 0x2B / 255, blue: 0xE2 / 255), // #8A2BE2
        Color(red: 0xC1 / 255, green: 0x35 / 255, blue: 0x84 / 255), // #C13584
        Color(red: 0xE1 / 255, green: 0x30 / 255, blue: 0x6C / 255), // #E1306C
        Color(red: 0xF0 / 255, green: 0x73 / 255, blue: 0x6A / 255), // #F0736A
    ]

    /// The accent, completing exactly at `fraction` of the shape's width.
    ///
    /// The stops are mapped to the *filled* portion rather than the whole
    /// track, so the gradient always arrives at coral at the end of the colour
    /// no matter how short it has become. Running it across the full width
    /// instead would mean a two-thirds fill ended mid-magenta and the design
    /// lost its last two stops entirely.
    static func accent(completingAt fraction: Double) -> LinearGradient {
        LinearGradient(
            colors: accentStops,
            startPoint: .leading,
            endPoint: UnitPoint(x: max(0.05, min(1, fraction)), y: 0.5)
        )
    }
}

/// Mirrors `src/design/typography.ts`.
///
/// `Font.custom` falls back to San Francisco without complaint when a face is
/// missing, which would quietly turn the whole design generic. Resolving the
/// face through `UIFont` first means a missing file degrades to the system
/// *serif* instead — still the right shape, just not the right cut.
enum Type {
    #if canImport(UIKit)
    private static let hasDisplay = UIFont(name: "Newsreader-Regular", size: 12) != nil
    private static let hasText = UIFont(name: "InstrumentSans-Regular", size: 12) != nil
    private static let hasTextMedium = UIFont(name: "InstrumentSans-Medium", size: 12) != nil
    #else
    private static let hasDisplay = false
    private static let hasText = false
    private static let hasTextMedium = false
    #endif

    /// Newsreader. Event names only — the app's display face, matched by
    /// PostScript name rather than by family, which is what `Font.custom`
    /// resolves against.
    static func display(_ size: CGFloat) -> Font {
        hasDisplay ? .custom("Newsreader-Regular", size: size)
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

    /// The width of a string in the medium face.
    ///
    /// The footer has to know whether its label fits inside the gradient before
    /// it lays anything out, and SwiftUI cannot answer that without a second
    /// layout pass. Measuring the resolved font gives the same answer up front.
    static func measureTextMedium(_ string: String, size: CGFloat) -> CGFloat {
        #if canImport(UIKit)
        let font = UIFont(name: "InstrumentSans-Medium", size: size)
            ?? .systemFont(ofSize: size, weight: .medium)
        return ceil((string as NSString).size(withAttributes: [.font: font]).width)
        #else
        // Harness only. Close enough to exercise the fits/does-not-fit branch.
        return ceil(CGFloat(string.count) * size * 0.55)
        #endif
    }
}

// MARK: - Capture state

/// Whether an event caps capture at all.
///
/// Unlimited arrives two ways: `photosLeft` of -1 is the sentinel the bridge has
/// always sent, and a missing or non-positive allowance means the same thing
/// from the other direction.
func stillsIsUnlimited(photosLeft: Int, allowance: Int?) -> Bool {
    if photosLeft < 0 { return true }
    guard let allowance else { return true }
    return allowance <= 0
}

/// Remaining capture as a fraction of the allowance, clamped to 0...1.
///
/// Unlimited reports full rather than infinity: the footer is a proportion of a
/// whole, and there is no whole to take a proportion of.
func stillsRemainingFraction(photosLeft: Int, allowance: Int?) -> Double {
    if stillsIsUnlimited(photosLeft: photosLeft, allowance: allowance) { return 1 }
    guard let allowance, allowance > 0 else { return 1 }
    return min(1, max(0, Double(photosLeft) / Double(allowance)))
}

// MARK: - Copy

/// How long is left, in the voice the lock screen uses.
///
/// Floored at every step, so someone with two hours and fifty minutes is never
/// told they have three — the same rule the app's own formatters follow.
func timeLeftPhrase(until date: Date, now: Date = Date()) -> String {
    let remaining = date.timeIntervalSince(now)
    if remaining <= 0 { return "Event ended" }

    let hours = Int(remaining) / 3_600

    // Above a day, days are the only unit that reads at a glance; "31hrs" makes
    // a reader do the division themselves.
    if hours >= 24 {
        let days = hours / 24
        return "\(days) \(days == 1 ? "day" : "days") left to go!"
    }

    if hours >= 1 {
        return "\(hours)\(hours == 1 ? "hr" : "hrs") left to go!"
    }

    // Never "0mins": a host inside the last minute still has time to shoot.
    let minutes = max(1, Int(remaining) / 60)
    return "\(minutes)\(minutes == 1 ? "min" : "mins") left to go!"
}

/// The footer's own label. Singular is a real case — the last shot of an event.
func stillsLeftPhrase(photosLeft: Int, allowance: Int?) -> String {
    if stillsIsUnlimited(photosLeft: photosLeft, allowance: allowance) { return "Unlimited stills" }
    if photosLeft <= 0 { return "No stills left" }
    return "\(photosLeft) \(photosLeft == 1 ? "still" : "stills") left"
}

// MARK: - Pieces

/// The brand mark: the gradient blob, small, in the corner.
///
/// The image rather than the wordmark. At this size the wordmark's strokes
/// collapse into a smudge, and the blob is the half of the identity that
/// survives being 22 points wide.
struct StillsMark: View {
    /// Small on purpose. Against a 34pt event name the mark is branding, not
    /// content, and at this size it costs the card less height than the title's
    /// own line spacing — the row it sits in does not grow the card.
    var size: CGFloat = 18

    var body: some View {
        Image("StillsMark")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The grain behind the card.
///
/// Behind all of it, including the footer: the footer paints only what is left
/// to shoot, so where the colour has run out the grain is what shows, and the
/// band reads as part of the card rather than as a component on top of it.
///
/// Filled rather than fitted, so it always covers the area whatever shape the
/// Live Activity is given, and clipped so the overflow does not paint over the
/// footer. The near-black fill underneath is what shows if the asset ever fails
/// to load, which keeps a missing texture from becoming a transparent card.
private struct CardTexture: View {
    var body: some View {
        Ink.background
            .overlay(
                Image("CardTexture")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .allowsHitTesting(false)
            )
            .clipped()
    }
}

/// Clock glyph and how long is left, quieter than everything above it.
struct TimeRemainingView: View {
    let endTime: Date
    var size: CGFloat = 14

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock.fill")
                .font(.system(size: size + 1))
                .foregroundColor(Ink.textPrimary)

            Text(timeLeftPhrase(until: endTime))
                .font(Type.textMedium(size))
                .foregroundColor(Ink.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
    }
}

/// The one action, and the only white shape on the card.
///
/// A wide rounded rectangle rather than a circle: it has to read as a button at
/// a glance on a locked screen, and the landscape shape is what separates it
/// from the round mark in the opposite corner.
struct CameraCTA: View {
    /// Nil renders the face without a link, for previews and snapshots.
    var destination: URL?
    var width: CGFloat = 74
    var height: CGFloat = 52

    var body: some View {
        if let destination {
            Link(destination: destination) { face }
                .accessibilityLabel("Take a photo")
        } else {
            face.accessibilityLabel("Take a photo")
        }
    }

    private var face: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Ink.surfaceWhite)
            .frame(width: width, height: height)
            .overlay(
                Image(systemName: "camera.fill")
                    .font(.system(size: height * 0.42))
                    .foregroundColor(Ink.textOnWhite)
            )
    }
}

// MARK: - The footer

/// Where the footer's top edge sits at a given point across its width.
///
/// Two gentle harmonics rather than one, so the line never settles into the
/// regular rhythm that would read as a sine wave. Expressed as a function of
/// the fraction across the full footer — not of absolute points — so the same
/// curve is drawn whatever the Live Activity's width, and so the filled and
/// unfilled parts always agree about where the edge is.
///
/// It has to be a function, not a sequence of curve segments: the trailing cap
/// starts wherever the fill happens to end, and the path can only meet it
/// smoothly if the height at that exact point is knowable.
func footerEdgeOffset(at fraction: Double, amplitude: CGFloat) -> CGFloat {
    let t = min(1, max(0, fraction))
    let first = sin(t * 2 * .pi * 0.9 + 0.7)
    let second = sin(t * 2 * .pi * 2.1 + 2.3)
    return amplitude * CGFloat(0.55 * first + 0.45 * second)
}

/// The footer's filled area, as a single path.
///
/// Built as one shape rather than a wavy rectangle behind a rounded-rectangle
/// mask. The mask's corner arc began at the *rectangle's* top edge while the
/// wave sat below it, so the arc was cut off partway and met the wave at a
/// visible step — a rounded corner that abruptly became a straight line.
///
/// Here the top edge is walked to the point where the cap begins, and the cap
/// is a half-circle springing from that exact height. A circle's tangent at its
/// topmost point is horizontal and the wave is shallow there, so the two meet
/// without a corner.
struct StillsFooterShape: Shape {
    /// How much of the width is filled, 0...1. A full-width shape (the track)
    /// passes 1 and no cap.
    var fraction: Double = 1
    /// Whether the trailing end is rounded. The track runs to the card's edge
    /// and lets the card's own corner finish it.
    var capped: Bool = true
    var amplitude: CGFloat = 5

    var animatableData: Double {
        get { fraction }
        set { fraction = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let full = rect.width
        let baseline = rect.minY + amplitude
        let bottom = rect.maxY
        let width = max(0, full * CGFloat(min(1, max(0, fraction))))

        // How far before the cap the edge starts rising to meet it. Long
        // enough that the rise is a slope rather than a bump, short enough that
        // the wave still reads as a wave for most of the bar's length.
        let blendLength: CGFloat = 64

        func waveY(atX x: CGFloat) -> CGFloat {
            guard full > 0 else { return baseline }
            return baseline + footerEdgeOffset(at: Double(x / full), amplitude: amplitude)
        }

        // Where the straight run of the top edge stops and the cap takes over.
        // The radius depends on the edge's height and the height depends on
        // where the cap starts, so it is estimated once and then refined —
        // the curve is shallow enough that one pass settles it.
        // The cap is always the same size, and always full thickness.
        //
        // Deriving the radius from the edge's height wherever the fill happened
        // to stop made the bulge a lottery: end on a crest and it was round and
        // generous, end in a trough and it was a stub. The edge instead eases up
        // to its highest point over the last stretch before the cap, so the end
        // of the bar reads the same at every count.
        let crestY = baseline - amplitude
        let capRadius: CGFloat = capped ? max(0, (bottom - crestY) / 2) : 0
        let capCentreX = max(rect.minX, width - capRadius)

        func edgeY(atX x: CGFloat) -> CGFloat {
            let wave = waveY(atX: x)
            guard capped, blendLength > 0 else { return wave }
            let start = capCentreX - blendLength
            guard x > start else { return wave }
            // Smoothstep, so the rise leaves the wave and arrives at the crest
            // with no slope of its own — a linear blend would kink at both ends.
            let t = min(1, max(0, (x - start) / blendLength))
            let eased = t * t * (3 - 2 * t)
            return wave + (crestY - wave) * eased
        }

        let edgeEnd = capped ? capCentreX : width
        guard edgeEnd >= rect.minX else { return path }

        // The top edge, sampled. Enough steps that the curve is smooth at any
        // width a Live Activity is given, few enough to stay cheap.
        let steps = 48
        path.move(to: CGPoint(x: rect.minX, y: edgeY(atX: rect.minX)))
        if edgeEnd > rect.minX {
            for step in 1...steps {
                let x = rect.minX + (edgeEnd - rect.minX) * CGFloat(step) / CGFloat(steps)
                path.addLine(to: CGPoint(x: x, y: edgeY(atX: x)))
            }
        }

        if capped && capRadius > 0 {
            path.addArc(
                center: CGPoint(x: capCentreX, y: bottom - capRadius),
                radius: capRadius,
                startAngle: .degrees(-90),
                endAngle: .degrees(90),
                clockwise: false
            )
        } else {
            path.addLine(to: CGPoint(x: edgeEnd, y: bottom))
        }

        path.addLine(to: CGPoint(x: rect.minX, y: bottom))
        path.closeSubpath()

        return path
    }
}

/// The bottom of the card, given over to what is left to shoot.
///
/// Not a bar inside the card — the whole band is the indicator. The track runs
/// the full width and the gradient occupies the remaining fraction of it, so the
/// colour visibly retreats leftwards as an event is shot through.
struct StillsRemainingFooter: View {
    let photosLeft: Int
    let allowance: Int?
    var height: CGFloat = 50
    var labelSize: CGFloat = 15

    /// Breathing room between the end of the label and the end of the gradient.
    /// Generous, because the gradient's trailing cap is round — a padding that
    /// looks right against a square edge leaves the text touching the curve.
    private let trailingPad: CGFloat = 26
    /// The least gradient that may sit to the label's left before the label is
    /// moved out. Below this the text is technically inside but visually crammed
    /// against the leading edge.
    private let minLeadIn: CGFloat = 14
    private let iconSize: CGFloat = 15
    private let iconGap: CGFloat = 7

    private var label: String {
        stillsLeftPhrase(photosLeft: photosLeft, allowance: allowance)
    }

    /// What the icon-and-text group needs, measured rather than guessed.
    private var labelWidth: CGFloat {
        iconSize + iconGap + Type.measureTextMedium(label, size: labelSize)
    }

    var body: some View {
        GeometryReader { geo in
            let full = geo.size.width
            let fraction = stillsRemainingFraction(photosLeft: photosLeft, allowance: allowance)
            let fill = full * CGFloat(fraction)
            // Inside only when the gradient can hold the label, its trailing
            // padding and a little run-up. Otherwise it sits past the gradient
            // on the track, which stays readable at any fill width — the one
            // thing that must never happen is the text clipping the colour.
            let fitsInside = fill >= labelWidth + trailingPad + minLeadIn

            ZStack(alignment: .leading) {
                // No track is drawn. What is left to shoot is the only thing
                // the footer paints; where the colour has run out, the card's
                // own grain simply continues, so the band reads as part of the
                // card rather than as a component laid on top of it.
                //
                // The edge function is still evaluated over the full width, so
                // the gradient's top follows exactly the line it would have if
                // a track were there — the colour just stops earlier.
                StillsFooterShape(fraction: fraction, capped: true)
                    .fill(Ink.accent(completingAt: fraction))

                if fill > 0.5 {
                    // Padding before the frame, never after: a trailing pad
                    // applied outside the frame widens the frame instead of
                    // insetting the label, which leaves the text sitting
                    // exactly on the gradient's rounded cap.
                    footerLabel(onGradient: fitsInside)
                        .padding(.trailing, fitsInside ? trailingPad : 0)
                        .padding(.leading, fitsInside ? 0 : max(0, min(fill + 12, full - labelWidth - 12)))
                        .frame(
                            width: fitsInside ? fill : full,
                            alignment: fitsInside ? .trailing : .leading
                        )
                } else {
                    // Nothing left to shoot: no gradient to sit in, so the label
                    // starts where the card's own text does.
                    footerLabel(onGradient: false)
                        .padding(.leading, 20)
                }
            }
            .frame(width: full, height: height)
        }
        .frame(height: height)
    }

    private func footerLabel(onGradient: Bool) -> some View {
        HStack(spacing: iconGap) {
            Image(systemName: "camera.fill")
                .font(.system(size: iconSize))
            Text(label)
                .font(Type.textMedium(labelSize))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        // White in both positions. The label steps off the gradient precisely
        // when there is least colour left to read it against, so dimming it
        // there would quiet the message exactly when it matters most.
        .foregroundColor(Ink.textPrimary)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
    }
}

// MARK: - The card

/// Which event, how long is left, one way to shoot, and how much is left to
/// shoot with — in that order down the card.
struct StillsLockScreenCard: View {
    let eventName: String
    let photosLeft: Int
    let allowance: Int?
    let endTime: Date
    /// Nil in previews and snapshots; the deep link in the real activity.
    var cameraDestination: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 0) {
                    StillsMark()

                    Text(eventName)
                        // Set large and allowed to shrink, rather than set safe
                        // and never filling the card: a short name should use
                        // the space it has, and only a long one pay for it.
                        .font(Type.display(40))
                        .foregroundColor(Ink.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.45)
                        // Newsreader sits higher in its line box than the face
                        // this replaced, so the mark needs the gap restating
                        // or it reads as touching the ascenders.
                        .padding(.top, 10)
                        .padding(.bottom, 6)

                    TimeRemainingView(endTime: endTime)
                }

                Spacer(minLength: 8)

                // Centred against the title-and-time block rather than pinned to
                // the top, which is what keeps it from floating away from the
                // content it belongs to.
                CameraCTA(destination: cameraDestination)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 14)
            .frame(maxWidth: .infinity, alignment: .leading)

            StillsRemainingFooter(photosLeft: photosLeft, allowance: allowance)
        }
        // Behind the whole card, footer included. The footer draws no track of
        // its own, so the grain runs under the unfilled part and the only thing
        // interrupting it is the gradient.
        .background(CardTexture())
        // No horizontal or bottom padding on the stack itself: the footer has to
        // reach the card's edges and let the system container's corners clip it,
        // which is what makes it part of the card rather than inside it.
    }
}
