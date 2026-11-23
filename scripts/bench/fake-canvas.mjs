// A canvas that accepts every call and draws nothing, counting what it was asked to do.
//
// Running a scene on it measures what the library itself costs (layout, animation, walking the layers,
// working out geometry and colours) with the native drawing taken out; the calls are counted, so the same run
// says how many times per frame the library goes into the canvas. Subtracting it from a run on the real canvas
// gives the time the canvas spends.

const METHODS = [
  "save",
  "restore",
  "clearRect",
  "beginPath",
  "closePath",
  "moveTo",
  "lineTo",
  "rect",
  "roundRect",
  "arcTo",
  "arc",
  "ellipse",
  "bezierCurveTo",
  "quadraticCurveTo",
  "fill",
  "stroke",
  "fillRect",
  "strokeRect",
  "drawImage",
  "fillText",
  "strokeText",
  "clip",
  "translate",
  "rotate",
  "scale",
  "transform",
  "setTransform",
  "resetTransform",
  "setLineDash",
  "putImageData",
];

/**
 * @param {object} real - a real adapter, for its fonts and image loading
 * @returns {object} an adapter whose canvases draw nothing; `.calls` counts what they were asked
 */
export function createFakeAdapter(real) {
  const calls = { total: 0, byName: Object.create(null) };
  const count = (name) => {
    calls.total++;
    calls.byName[name] = (calls.byName[name] ?? 0) + 1;
  };

  const makeContext = (canvas) => {
    const ctx = {
      canvas,
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      globalAlpha: 1,
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
    };
    for (const name of METHODS) {
      ctx[name] = () => count(name);
    }
    ctx.measureText = (text) => {
      count("measureText");
      return { width: text.length * 9, fontBoundingBoxAscent: 16, fontBoundingBoxDescent: 4 };
    };
    ctx.getTransform = () => {
      count("getTransform");
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    };
    ctx.getImageData = (x, y, w, h) => {
      count("getImageData");
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    };
    const gradient = () => {
      count("createGradient");
      return { addColorStop: () => count("addColorStop") };
    };
    ctx.createLinearGradient = gradient;
    ctx.createRadialGradient = gradient;
    ctx.createConicGradient = gradient;
    ctx.createPattern = () => {
      count("createPattern");
      return {};
    };
    // Anything else the library may call is accepted too. Not `then`: an async function that returns the context
    // would take it for a promise and wait for it for ever.
    return new Proxy(ctx, {
      // Setting a property (`fillStyle`, `globalAlpha`, `filter`) goes into the native library too.
      set: (target, name, value) => {
        count(`set ${String(name)}`);
        target[name] = value;
        return true;
      },
      get: (target, name) => {
        if (name in target) return target[name];
        if (name === "then" || typeof name === "symbol") return undefined;
        return () => count(String(name));
      },
    });
  };

  return {
    fonts: real.fonts,
    loadImage: (src) => real.loadImage(src),
    Path2D: real.Path2D,
    calls,
    createCanvas(width, height) {
      const canvas = { width, height, toBuffer: () => Buffer.alloc(0), toDataURL: () => "" };
      const ctx = makeContext(canvas);
      canvas.getContext = () => ctx;
      return canvas;
    },
  };
}
