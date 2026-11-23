// "A state machine in a file": a YAML file describes three states, which are then drawn as cards joined
// by arrows, and a transition is played through them. Rebuilt on LazyCanvas from the `state-machine` scene
// of https://github.com/motion-canvas/examples (examples/asset-code, MIT), which belongs to the video
// "Could This Asset Be Code?" by aarthificial: https://youtu.be/s1ZQnS_tOg0
//
// Uses: `timeline()` with positions, `stagger`, springs, `Transform` with signals and `origin`, dashed
// strokes, `loopFor`, arrowheads rotated through `Transform`. The animated character of the original is
// replaced by a small shape that idles, walks or falls. Laid out for 1280×720 and scaled to the width.

export const name = "state-machine";

const THEME = {
  bg: "#24211d",
  bgDark: "#0f0d0c",
  stroke: "#66615c",
  window: "#cc812b",
  text: "#e8e3de",
  radius: 5,
  idle: "#0880b4",
  walking: "#64811b",
  falling: "#d73838",
};

const YAML = `idle:
  animation: /animations/idle.anim
  transitions:
    - target: walking
      criteria: [speed, greater, 0.1]
    - target: falling
      criteria: [grounded, equals, 0]
walking:
  animation: /animations/walking.anim
  transitions:
    - target: idle
      criteria: [speed, less, 0.1]
    - target: falling
      criteria: [grounded, equals, 0]
falling:
  animation: /animations/falling.anim
  transitions:
    - target: idle
      criteria: [grounded, equals, 1]`.split("\n");

const CARD_W = 187;
const CARD_H = 235;
const OFFSET = 13;
const DURATION = 14;

export function build(lib, adapter, { width = 1280, sceneOptions = {}, fonts } = {}) {
  const {
    Scene,
    Group,
    Morph,
    Text,
    Line,
    Polygon,
    Transform,
    Easing,
    all,
    chain,
    createSignal,
    loopFor,
    stagger,
    timeline,
    waitFor,
  } = lib;
  const k = width / 1280;
  const px = (v) => v * k;
  const height = Math.round(720 * k);

  const scene = new Scene(width, height, { adapter, ...sceneOptions });
  if (fonts) scene.lazyCanvas.manager.fonts.loadFonts(fonts);

  const UI = { family: "Geist", size: Math.max(8, Math.round(22 * k)), weight: 600 };
  const CODE = { family: "GeistMono", size: Math.max(7, Math.round(15 * k)), weight: 400 };
  const layers = [];
  let signals = 0;
  const signal = (v) => {
    signals++;
    return createSignal(v);
  };

  layers.push(
    new Morph({
      color: THEME.bgDark,
      size: { width, height },
      position: { x: 0, y: 0 },
      centring: "none",
    }),
  );

  // --- the YAML file -----------------------------------------------------------------------------
  layers.push(
    new Morph({
      color: THEME.bg,
      size: { width: px(520), height: px(666), radius: { all: px(THEME.radius) } },
      position: { x: px(27), y: px(27) },
      centring: "none",
    }),
    new Text({
      text: "state_machine.yaml",
      color: THEME.stroke,
      font: { ...CODE, family: "GeistMono" },
      position: { x: px(47), y: px(43) },
      align: "left",
      baseline: "top",
      centring: "none",
    }),
  );
  const lineO = YAML.map(() => signal(1));
  YAML.forEach((text, i) => {
    layers.push(
      new Text({
        text,
        color: THEME.text,
        font: CODE,
        position: { x: px(47), y: px(82 + i * 22) },
        align: "left",
        baseline: "top",
        centring: "none",
        opacity: lineO[i],
      }),
    );
  });

  // --- the cards ---------------------------------------------------------------------------------
  const perimeter = px(2 * (CARD_W + CARD_H));
  const dashUnit = (2 / 3) * k;
  const dash = [
    perimeter / 5 - 80 * dashUnit,
    8 * dashUnit,
    8 * dashUnit,
    8 * dashUnit,
    32 * dashUnit,
    8 * dashUnit,
    8 * dashUnit,
    8 * dashUnit,
  ];

  const card = (name, cx, cy, color) => {
    const c = {
      name,
      cx,
      cy,
      h: signal(0),
      o: signal(0),
      outW: signal(0.01),
      outOff: signal(0),
      tx: signal(0),
      ty: signal(0),
      sc: signal(1),
    };
    layers.push(
      new Morph({
        color: THEME.bg,
        size: { width: px(CARD_W), height: c.h, radius: { all: px(THEME.radius) } },
        position: { x: px(cx), y: px(cy) },
        centring: "center",
      }),
      new Text({
        text: name,
        color: THEME.text,
        font: UI,
        position: { x: px(cx), y: px(cy - 92) },
        align: "center",
        baseline: "top",
        centring: "none",
        opacity: c.o,
      }),
      new Morph({
        color: THEME.bgDark,
        size: { width: px(160), height: px(160), radius: { all: px(THEME.radius) } },
        position: { x: px(cx), y: px(cy + 22) },
        centring: "center",
        opacity: c.o,
      }),
      new Morph({
        color,
        size: { width: px(44), height: px(44), radius: { all: px(22) } },
        position: { x: px(cx), y: px(cy + 22) },
        centring: "center",
        opacity: c.o,
        transform: new Transform({
          translate: { x: c.tx, y: c.ty },
          scale: c.sc,
          origin: "center",
        }),
      }),
      // The glowing dashed outline that marks the active state.
      new Morph({
        color: THEME.window,
        size: { width: px(CARD_W), height: px(CARD_H), radius: { all: px(THEME.radius) } },
        position: { x: px(cx), y: px(cy) },
        centring: "center",
        stroke: { width: c.outW, dash, dashOffset: c.outOff },
      }),
    );
    return c;
  };
  const idle = card("idle", 907, 227, THEME.idle);
  const walking = card("walking", 747, 493, THEME.walking);
  const falling = card("falling", 1067, 493, THEME.falling);

  // --- the arrows --------------------------------------------------------------------------------
  const HEAD = 12;
  const arrow = (points, startHead) => {
    // Pull both ends back from the cards, as `startOffset` and `endOffset` do in the original.
    const unit = (a, b) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    };
    const first = unit(points[0], points[1]);
    const last = unit(points[points.length - 2], points[points.length - 1]);
    const p = points.map((q) => [...q]);
    p[0] = [p[0][0] + first[0] * OFFSET, p[0][1] + first[1] * OFFSET];
    const e = p.length - 1;
    p[e] = [p[e][0] - last[0] * OFFSET, p[e][1] - last[1] * OFFSET];

    const color = signal(THEME.stroke);
    const segments = [];
    for (let i = 0; i < p.length - 1; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[i + 1];
      const seg = {
        x1,
        y1,
        x2,
        y2,
        length: Math.hypot(x2 - x1, y2 - y1),
        endX: signal(px(x1)),
        endY: signal(px(y1)),
        o: signal(0),
      };
      segments.push(seg);
      layers.push(
        new Line({
          color,
          position: { x: px(x1), y: px(y1), endX: seg.endX, endY: seg.endY },
          stroke: { width: px(5), cap: "round" },
          opacity: seg.o,
        }),
      );
    }

    const head = (at, dir, o) => {
      const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI + 90;
      layers.push(
        new Polygon({
          color,
          size: { width: px(HEAD), height: px(HEAD), count: 3, radius: 0 },
          position: {
            x: px(at[0] - dir[0] * HEAD * 0.5 - HEAD / 2),
            y: px(at[1] - dir[1] * HEAD * 0.5 - HEAD / 2),
          },
          centring: "none",
          opacity: o,
          transform: new Transform({ rotate: angle, origin: "center" }),
        }),
      );
    };
    const startO = signal(0);
    const endO = signal(0);
    if (startHead) head(p[0], [-first[0], -first[1]], startO);
    head(p[e], last, endO);

    const total = segments.reduce((sum, s) => sum + s.length, 0);
    function* run(seconds, easing) {
      startO.set(1);
      let t = 0;
      while (t < seconds - 1e-9) {
        const dt = yield;
        t += dt ?? 1 / 60;
        let drawn = easing(Math.min(t / seconds, 1)) * total;
        for (const s of segments) {
          const part = Math.max(0, Math.min(drawn, s.length));
          drawn -= part;
          if (part > 0) {
            s.o.set(1);
            s.endX.set(px(s.x1 + ((s.x2 - s.x1) * part) / s.length));
            s.endY.set(px(s.y1 + ((s.y2 - s.y1) * part) / s.length));
          }
        }
      }
      endO.set(1);
    }
    return {
      color,
      draw: (seconds, easing = Easing.linear) => lib.withDuration(run(seconds, easing), seconds),
      pulse: () => chain(color.to(THEME.window, 0.25), color.to(THEME.stroke, 0.45)),
    };
  };

  const idleLeft = [907 - CARD_W / 2, 227];
  const idleRight = [907 + CARD_W / 2, 227];
  const walkTop = [747, 493 - CARD_H / 2];
  const fallTop = [1067, 493 - CARD_H / 2];
  const arrowIdleWalking = arrow([idleLeft, [747, 227], walkTop], true);
  const arrowFallingIdle = arrow([fallTop, [1067, 227], idleRight], true);
  const arrowWalkingFalling = arrow(
    [
      [747 + CARD_W / 2, 493],
      [1067 - CARD_W / 2, 493],
    ],
    false,
  );

  scene.load(new Group({}).add(...layers));

  // --- animation ---------------------------------------------------------------------------------
  const ease = Easing.easeInOutCubic;
  const focus = (selected, dim = 0.25, seconds = 0.5) =>
    all(...lineO.map((o, i) => o.to(selected.includes(i) ? 1 : dim, seconds)));
  const reveal = (c) =>
    all(c.h.to(px(CARD_H), 0.6, { easing: ease }), c.o.to(1, 0.6, { easing: ease }));
  const activate = (c, on) => c.outW.to(on ? px(10) : 0.01, 0.3);

  // Built by a function: every run needs animations of its own, and `scene.duration` runs the factory once
  // to measure it.
  const makeStory = () =>
    timeline()
      .label("intro", 0.8)
      .add(focus([0, 7, 14], 0.25, 0.6), "intro")
      .add(
        focus(
          lineO.map((_, i) => i),
          1,
          0.4,
        ),
        2.2,
      )
      .label("machine", 2.8)
      .add(stagger(0.12, [reveal(idle), reveal(walking), reveal(falling)]), "machine")
      .label("arrows", "machine+=1.1")
      .add(
        chain(
          arrowIdleWalking.draw(0.6, Easing.easeIn),
          arrowWalkingFalling.draw(0.2),
          arrowFallingIdle.draw(0.6, Easing.easeOut),
        ),
        "arrows",
      )
      .add(focus([4, 6, 11, 13, 18], 0.25, 0.4), "arrows+=1.8")
      .add(
        focus(
          lineO.map((_, i) => i),
          1,
          0.4,
        ),
        "arrows+=3",
      )
      .label("play", "arrows+=3.6")
      .add(activate(idle, true), "play")
      .add(
        all(arrowIdleWalking.pulse(), activate(idle, false), activate(walking, true)),
        "play+=1.2",
      )
      .add(
        all(arrowWalkingFalling.pulse(), activate(walking, false), activate(falling, true)),
        "play+=2.6",
      )
      .add(
        all(arrowFallingIdle.pulse(), activate(falling, false), activate(idle, true)),
        "play+=4",
      );

  const duration = Math.max(DURATION, makeStory().duration ?? 0);
  const marching = (c) =>
    loopFor(function* () {
      c.outOff.set(0);
      yield* c.outOff.to(perimeter, 8, { easing: Easing.linear });
    }, duration);

  scene.addAnimation(() => makeStory().play());
  scene.addAnimation(() => all(marching(idle), marching(walking), marching(falling)));
  // What each state shows while it waits: breathing, walking to and fro, falling and starting again.
  scene.addAnimation(() =>
    loopFor(
      () =>
        chain(
          idle.sc.to(1.18, 0.7, { easing: Easing.easeInOutSine }),
          idle.sc.to(1, 0.7, { easing: Easing.easeInOutSine }),
        ),
      duration,
    ),
  );
  scene.addAnimation(() =>
    loopFor(
      () =>
        chain(
          all(
            walking.tx.to(px(46), 0.55, { easing: Easing.easeInOutSine }),
            chain(
              walking.ty.to(px(-12), 0.275, { easing: Easing.easeOut }),
              walking.ty.to(0, 0.275, { easing: Easing.easeIn }),
            ),
          ),
          all(
            walking.tx.to(px(-46), 0.55, { easing: Easing.easeInOutSine }),
            chain(
              walking.ty.to(px(-12), 0.275, { easing: Easing.easeOut }),
              walking.ty.to(0, 0.275, { easing: Easing.easeIn }),
            ),
          ),
        ),
      duration,
    ),
  );
  scene.addAnimation(() =>
    loopFor(function* () {
      falling.ty.set(px(-46));
      yield* falling.ty.to(px(46), 0.7, { easing: Easing.easeIn });
      yield* waitFor(0.25);
    }, duration),
  );

  return { name, scene, width, height, duration: scene.duration, layers: layers.length, signals };
}
