/*
 * Stands in for `@shopify/react-native-skia` in the browser, so the real filter
 * modules run against CanvasKit's WebGL backend.
 *
 * Same contract as `skia-shim.cjs`, which does this for Node: pure API
 * adaptation, no filter logic. Anything reimplemented here is somewhere the
 * tuner could disagree with the app, so keep it to shape differences only.
 */
let CK = null;

export function setCanvasKit(canvasKit) {
  CK = canvasKit;
  patchDrawPath(canvasKit);
}

/*
 * React Native Skia builds a path by calling moveTo/lineTo/close on it.
 * CanvasKit's Path has neither — it is constructed in one shot from a flat
 * command array. So record the calls and materialise on use, and patch
 * drawPath to accept the recorder. Still pure API adaptation: the shipped code
 * keeps its own path-building exactly as it is.
 */

/**
 * CanvasKit's Surface/Image lack `flush()` and `makeNonTextureImage()` — both
 * are meaningless for its CPU backend, but the app calls them, so they are
 * stubbed here to keep the real module runnable unmodified.
 */

/**
 * react-native-skia's `readPixels` takes all-optional arguments and defaults
 * the image info to the image's own; CanvasKit's requires it. Wrapping keeps
 * the app's call sites — which rely on that defaulting — runnable here.
 */
function wrapImage(image) {
  if (!image) return null;
  const wrapped = {
    width: () => image.width(),
    height: () => image.height(),
    makeNonTextureImage: () => wrapped,
    encodeToBytes: (...a) => image.encodeToBytes(...a),
    readPixels: (x = 0, y = 0, info) =>
      image.readPixels(x, y, info ?? {
        width: image.width(), height: image.height(),
        colorType: CK.ColorType.RGBA_8888,
        alphaType: CK.AlphaType.Unpremul,
        colorSpace: CK.ColorSpace.SRGB,
      }),
    // The underlying CanvasKit image, for drawing back into a CanvasKit canvas.
    __raw: image,
  };
  return wrapped;
}

function wrapSurface(surface) {
  if (!surface) return null;
  return {
    getCanvas: () => surface.getCanvas(),
    flush: () => surface.flush?.(),
    makeImageSnapshot: (...args) => wrapImage(surface.makeImageSnapshot(...args)),
  };
}

function makePath() {
  const cmds = [];
  const path = {
    moveTo(x, y) { cmds.push(CK.MOVE_VERB, x, y); return path; },
    lineTo(x, y) { cmds.push(CK.LINE_VERB, x, y); return path; },
    close() { cmds.push(CK.CLOSE_VERB); return path; },
    __materialise: () => CK.Path.MakeFromCmds(cmds),
  };
  return path;
}

function patchDrawPath(canvasKit) {
  if (canvasKit.Canvas.prototype.__pathPatched) return;
  const original = canvasKit.Canvas.prototype.drawPath;
  canvasKit.Canvas.prototype.drawPath = function drawPath(path, paint) {
    const real = path && path.__materialise ? path.__materialise() : path;
    const result = original.call(this, real, paint);
    if (real !== path) real.delete();
    return result;
  };
  canvasKit.Canvas.prototype.__pathPatched = true;
}


export const BlendMode = new Proxy({}, { get: (_, key) => CK.BlendMode[key] });
export const TileMode = new Proxy({}, { get: (_, key) => CK.TileMode[key] });
export const FilterMode = new Proxy({}, { get: (_, key) => CK.FilterMode[key] });
export const MipmapMode = new Proxy({}, { get: (_, key) => CK.MipmapMode[key] });

// CanvasKit takes a bare nine-element array as a local matrix; React Native
// Skia wraps one in an object with chainable mutators. Be both.
function makeMatrix() {
  const array = Array.from(CK.Matrix.identity());
  const assign = (next) => {
    for (let i = 0; i < 9; i += 1) array[i] = next[i];
    return array;
  };
  Object.defineProperty(array, 'translate', {
    value: (x, y) => assign(CK.Matrix.multiply(array, CK.Matrix.translated(x, y))),
    enumerable: false,
  });
  Object.defineProperty(array, 'scale', {
    value: (x, y) => assign(CK.Matrix.multiply(array, CK.Matrix.scaled(x, y === undefined ? x : y))),
    enumerable: false,
  });
  return array;
}

export const Skia = {
  RuntimeEffect: {
    Make: (source) =>
      CK.RuntimeEffect.Make(source, (error) => {
        throw new Error(`SkSL failed to compile:\n${error}`);
      }),
  },
  Matrix: makeMatrix,
  Paint: () => new CK.Paint(),
  ImageFilter: {
    MakeBlur: (sx, sy, mode, input) => CK.ImageFilter.MakeBlur(sx, sy, mode, input ?? null),
  },
  Path: { Make: makePath },
  XYWHRect: (x, y, w, h) => CK.XYWHRect(x, y, w, h),
  Surface: {
    // CanvasKit in Node has no GPU; the CPU surface exercises the same drawing
    // code, which is what the parity check is comparing.
    MakeOffscreen: (w, h) => wrapSurface(CK.MakeSurface(w, h)),
    Make: (w, h) => wrapSurface(CK.MakeSurface(w, h)),
  },
  Data: { fromURI: () => Promise.resolve(null), fromBytes: (b) => b },
  Image: { MakeImageFromEncoded: (d) => CK.MakeImageFromEncoded(d) },

  PictureRecorder: () => {
    const recorder = new CK.PictureRecorder();
    return {
      beginRecording: (rect) => recorder.beginRecording(rect),
      finishRecordingAsPicture: () => recorder.finishRecordingAsPicture(),
    };
  },

  Color: (value) => CK.parseColorString(value),

  XYWHRect: (x, y, w, h) => CK.XYWHRect(x, y, w, h),
};
