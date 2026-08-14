/**
 * Bakes the front-camera mirror into recorded video, on web.
 *
 * `expo-camera`'s web layer always CSS-mirrors the preview `<video>` element
 * for the front camera (`transform: scaleX(-1)` in `ExpoCamera.web.tsx`), but
 * that transform is a display-only effect — it never touches the underlying
 * `MediaStreamTrack`. `MediaRecorder` reads that raw track directly, so a
 * video recorded from the front camera comes out un-mirrored: text is the
 * right way round, left and right are swapped, and the result no longer
 * matches what the guest watched themselves record. This is the video
 * counterpart of `isImageMirror` on `takePictureAsync` — the still-photo path
 * expo-camera does support directly, and does apply for exactly this reason.
 *
 * There is no equivalent recording-side option for video, so this rebuilds
 * one: an offscreen `<video>` plays the live track, an offscreen `<canvas>`
 * redraws each frame flipped horizontally, and `canvas.captureStream()` hands
 * back a track that a `MediaRecorder` can record in place of the raw one.
 * Native and the rear camera never go through this — `expo-camera`'s own
 * `mirror` prop already keeps native's preview and its capture in agreement
 * for both photo and video, and the rear camera is never mirrored at all —
 * so this exists solely to bring the one path that actually disagrees back
 * into line with everything else.
 */

export interface MirroredVideoTrack {
  /** Feed this to `MediaRecorder` in place of the raw camera track. */
  track: MediaStreamTrack;
  /** Stops the redraw loop and releases the offscreen video and canvas. */
  stop: () => void;
}

export function createMirroredVideoTrack(sourceTrack: MediaStreamTrack): MirroredVideoTrack {
  const { width = 1280, height = 720, frameRate = 30 } = sourceTrack.getSettings();

  // A second, independent consumer of the same live track — reading it here
  // does not affect the `<video>` the guest is watching themselves in.
  const sourceVideo = document.createElement('video');
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.srcObject = new MediaStream([sourceTrack]);
  // Autoplay can be refused with no user gesture in play, but this element is
  // never shown — a stalled first frame just delays the mirrored track
  // becoming live, not the recording itself, which waits on `oncanplay` below.
  void sourceVideo.play().catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });

  let frameHandle: ReturnType<typeof requestAnimationFrame> | null = null;
  const drawFrame = () => {
    if (context) {
      // The same horizontal flip `isImageMirror` applies once to a still
      // photo's canvas, run here every frame.
      context.setTransform(-1, 0, 0, 1, canvas.width, 0);
      context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
    }
    frameHandle = requestAnimationFrame(drawFrame);
  };
  frameHandle = requestAnimationFrame(drawFrame);

  const canvasStream = canvas.captureStream(frameRate);
  const canvasTrack = canvasStream.getVideoTracks()[0];

  return {
    track: canvasTrack,
    stop: () => {
      if (frameHandle !== null) cancelAnimationFrame(frameHandle);
      // `canvasTrack` is also stopped by the recorder's own track cleanup —
      // stopping an already-stopped track is a defined no-op — but the source
      // video and its `srcObject` are reachable only from here.
      canvasTrack.stop();
      sourceVideo.pause();
      sourceVideo.srcObject = null;
    },
  };
}
