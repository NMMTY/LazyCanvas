// "Loading a game into memory": a game file is split into 63 pieces and loaded into 8 slots of RAM,
// the oldest pieces being thrown out to make room. Rebuilt on LazyCanvas from the `memory` scene of
// https://github.com/motion-canvas/examples (examples/asset-code, MIT), which belongs to the video
// "Could This Asset Be Code?" by aarthificial: https://youtu.be/s1ZQnS_tOg0
//
// Uses: ~100 layers, ~220 signals, tweens, colour blending, a typewriter string interpolator, `all`.
// Everything is laid out for 1280×720 and scaled to the requested width.

export const name = "memory";

const THEME = {
  bg: "#241a1a",
  bgDark: "#0f0a0a",
  code: "#e71720",
  data: "#f58f29",
  text: "#e8e1e1",
  radius: 5,
};

const hex = (c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const part = (x, y) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${part(r1, r2)}${part(g1, g2)}${part(b1, b2)}`;
};

/** Small seeded generator, so that the same pieces are thrown out on every run. */
function random(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (from, to) => from + Math.floor(next() * Math.max(1, to - from)) };
}

/**
 * @param {object} lib - `@nmmty/lazycanvas`
 * @param {object} adapter - a canvas adapter
 * @param {{ width?: number, sceneOptions?: object, fonts?: object }} [options]
 */
export function build(lib, adapter, { width = 1280, sceneOptions = {}, fonts } = {}) {
  const { Scene, Group, Morph, Text, Easing, all, waitFor, createSignal } = lib;
  const k = width / 1280;
  const px = (v) => v * k;
  const height = Math.round(720 * k);

  const PARTS = 63;
  const SLOTS = 8;
  const X = 54;
  const BAR_H = 107;
  const PAD = 13;
  const GAP = 16 / 3;
  const FULL_W = 1173;
  const INNER_FULL = FULL_W - 2 * PAD;
  const START_W = 106;
  const GAME_Y = 88;
  const PC_Y = GAME_Y + BAR_H + 14;
  const PC_W = (FULL_W * 16) / 113;
  const PART_W = (INNER_FULL - (PARTS - 1) * GAP) / PARTS;
  const FONT = { family: "Geist", size: Math.max(8, Math.round(22 * k)), weight: 600 };

  const scene = new Scene(width, height, { adapter, ...sceneOptions });
  if (fonts) scene.lazyCanvas.manager.fonts.loadFonts(fonts);

  // --- signals ---------------------------------------------------------------------------------
  const gameW = createSignal(px(START_W));
  const gameInnerW = createSignal(px(START_W - 2 * PAD));
  const gameRight = createSignal(px(X + START_W));
  const gameName = createSignal("");
  const sizeText = createSignal("11 GB");
  const sizeO = createSignal(0);
  const innerO = createSignal(1);
  const partsO = createSignal(0);
  const pcW = createSignal(0);
  const pcO = createSignal(0);

  const partX = Array.from({ length: PARTS }, (_, i) =>
    createSignal(px(X + PAD + (i * INNER_FULL) / PARTS)),
  );
  const partW = Array.from({ length: PARTS }, () => createSignal(px(INNER_FULL / PARTS)));
  const partFill = Array.from({ length: PARTS }, () => createSignal(THEME.bgDark));
  const ramFill = Array.from({ length: SLOTS }, () => createSignal(THEME.bg));

  // --- layers ----------------------------------------------------------------------------------
  const rect = (color, x, y, w, h, r = 0, extra = {}) =>
    new Morph({
      color,
      size: { width: w, height: h, radius: typeof r === "number" ? { all: px(r) } : r },
      position: { x, y },
      centring: "none",
      ...extra,
    });
  const label = (text, x, y, align, extra = {}) =>
    new Text({
      text,
      color: THEME.text,
      font: FONT,
      position: { x, y },
      align,
      baseline: "top",
      centring: "none",
      ...extra,
    });

  const layers = [rect(THEME.bgDark, 0, 0, width, height)];

  layers.push(label(gameName, px(X), px(52), "left"));
  layers.push(label(sizeText, gameRight, px(52), "right", { opacity: sizeO }));
  layers.push(rect(THEME.bg, px(X), px(GAME_Y), gameW, px(BAR_H), THEME.radius));
  layers.push(
    rect(
      THEME.bgDark,
      px(X + PAD),
      px(GAME_Y + PAD),
      gameInnerW,
      px(BAR_H - 2 * PAD),
      THEME.radius,
      { opacity: innerO },
    ),
  );

  for (let i = 0; i < PARTS; i++) {
    const round = {
      leftTop: i === 0 ? px(THEME.radius) : 0,
      leftBottom: i === 0 ? px(THEME.radius) : 0,
      rightTop: i === PARTS - 1 ? px(THEME.radius) : 0,
      rightBottom: i === PARTS - 1 ? px(THEME.radius) : 0,
    };
    layers.push(
      rect(partFill[i], partX[i], px(GAME_Y + PAD), partW[i], px(BAR_H - 2 * PAD), round, {
        opacity: partsO,
      }),
    );
  }

  layers.push(rect(THEME.bg, px(X), px(PC_Y), pcW, px(BAR_H), THEME.radius));
  for (let j = 0; j < SLOTS; j++) {
    const round = {
      leftTop: j === 0 ? px(THEME.radius) : 0,
      leftBottom: j === 0 ? px(THEME.radius) : 0,
      rightTop: j === SLOTS - 1 ? px(THEME.radius) : 0,
      rightBottom: j === SLOTS - 1 ? px(THEME.radius) : 0,
    };
    layers.push(
      rect(
        ramFill[j],
        px(X + PAD + j * (PART_W + GAP)),
        px(PC_Y + PAD),
        px(PART_W),
        px(BAR_H - 2 * PAD),
        round,
        { opacity: pcO },
      ),
    );
  }
  layers.push(label("PC", px(X), px(PC_Y + BAR_H + 14), "left", { opacity: pcO }));
  layers.push(label("16 GB", px(X + PC_W), px(PC_Y + BAR_H + 14), "right", { opacity: pcO }));

  scene.load(new Group({}).add(...layers));

  // --- animation -------------------------------------------------------------------------------
  const typewriter = (from, to, p) => to.slice(0, Math.round(to.length * p));
  const ease = Easing.easeInOutCubic;

  function* story() {
    yield* waitFor(0.5);
    yield* sizeO.to(1, 0.3);
    yield* waitFor(0.5);

    // The game file grows to its real size while its name is typed.
    yield* all(
      gameW.to(px(FULL_W), 2, { easing: ease }),
      gameInnerW.to(px(FULL_W - 2 * PAD), 2, { easing: ease }),
      gameRight.to(px(X + FULL_W), 2, { easing: ease }),
      gameName.to("Red Dead Redemption 2", 2, { interpolator: typewriter }),
    );
    yield* waitFor(0.6);

    // A PC with 16 GB of memory appears under it.
    yield* all(pcO.to(1, 0.6), pcW.to(px(PC_W), 1, { easing: Easing.easeOutCubic }));
    yield* waitFor(0.6);

    // The file is cut into pieces.
    innerO.set(0);
    partsO.set(1);
    yield* all(
      ...partX.map((x, i) => x.to(px(X + PAD + i * (PART_W + GAP)), 0.6, { easing: ease })),
      ...partW.map((w) => w.to(px(PART_W), 0.6, { easing: ease })),
    );
    yield* waitFor(0.6);

    // The pieces are loaded one by one; when the memory is full, random ones are thrown out.
    yield* all(partFill[0].to(THEME.code, 0.1), ramFill[0].to(THEME.code, 0.1));
    const rnd = random(7);
    const free = [1, 2, 3, 4, 5, 6, 7];
    const allocated = [];
    let event = 0;
    for (let i = 1; i < PARTS; i++) {
      if (free.length === 0) {
        if (event === 0) yield* waitFor(1);
        let remove = event === 0 ? 4 : rnd.int(1, allocated.length - 3);
        while (remove > 0 && allocated.length > 0) {
          remove--;
          const [piece, slot] = allocated.splice(rnd.int(0, allocated.length - 1), 1)[0];
          yield* all(partFill[piece].to(THEME.bgDark, 0.16), ramFill[slot].to(THEME.bg, 0.16));
          free.push(slot);
        }
        if (event === 0) yield* waitFor(1);
        event++;
      }
      const slot = free.shift();
      allocated.push([i, slot]);
      const color = mix(THEME.code, THEME.data, i / (PARTS - 1));
      yield* all(partFill[i].to(color, 0.16), ramFill[slot].to(color, 0.16));
    }
    yield* waitFor(1.5);
  }

  // The size label counts along with the width of the file. A generator that is never finished is
  // not a function, so `scene.duration` does not try to measure it.
  function* counter() {
    for (;;) {
      const text = `${Math.round((gameW.value() / px(FULL_W)) * 120)} GB`;
      if (sizeText.value() !== text) sizeText.set(text);
      yield;
    }
  }

  scene.addAnimation(story);
  scene.addAnimation(counter());

  return {
    name,
    scene,
    width,
    height,
    duration: scene.duration,
    layers: layers.length,
    signals: 2 * PARTS + PARTS + SLOTS + 10,
  };
}
