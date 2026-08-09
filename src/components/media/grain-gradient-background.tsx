'use dom';

/** @paper-design/shaders-react@0.0.78 */
import { GrainGradient } from '@paper-design/shaders-react';

import type { DOMProps } from 'expo/dom';

export interface GrainGradientBackgroundProps {
  /**
   * Shader playback rate. `0` freezes the shader on `frame`, which is how the
   * reduce-motion path holds a still image rather than dropping the background
   * entirely — same treatment `BackgroundVideo` gives its footage.
   */
  speed: number;
  dom?: DOMProps;
}

/**
 * The welcome screen's animated background.
 *
 * This is an **Expo DOM component** (`'use dom'`), not ordinary React Native.
 * `@paper-design/shaders-react` is a WebGL library that renders into a DOM
 * `<canvas>`, so it cannot mount against the native view tree at all. The
 * directive hands this file to a real browser engine — Expo bundles it
 * separately and mounts it in a webview — which lets the genuine `GrainGradient`
 * run rather than an approximation of it in Skia.
 *
 * `@expo/dom-webview` backs that webview. It ships with `expo` and its pod is
 * already in the iOS build, so no extra native dependency is involved.
 *
 * Every shader parameter below is exactly as exported from Paper. The only
 * departure is sizing: the export hard-codes a 1320×2868 canvas (a 3× phone
 * screen), which would letterbox or crop on any other viewport, so the canvas
 * fills its container instead and the shader scales with the device.
 */
export default function GrainGradientBackground({ speed }: GrainGradientBackgroundProps) {
  return (
    <>
      {/* The webview is a full document, so it carries the UA's default 8px
          body margin. Unreset, that margin shows as a seam of page background
          around all four edges of the shader. */}
      <style>{`
        html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #0F0E18; }
      `}</style>

      <GrainGradient
        speed={speed}
        scale={1.3}
        rotation={0}
        offsetX={0}
        offsetY={0}
        softness={0}
        intensity={0.15}
        noise={0.5}
        shape="blob"
        frame={327709.4000000536}
        colors={['#151515', '#EAEAEA', '#2A2A2A']}
        colorBack="#00000000"
        // Viewport-fixed rather than the export's `height: '100%'`. Expo mounts
        // DOM components through react-native-web's AppRegistry, so the shader
        // sits under a stack of RNW container divs that never resolve a height —
        // a percentage height collapses to zero against them and the canvas
        // renders 0px tall. Anchoring to the viewport skips that chain entirely.
        style={{
          backgroundColor: '#0F0E18',
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
        }}
      />
    </>
  );
}
