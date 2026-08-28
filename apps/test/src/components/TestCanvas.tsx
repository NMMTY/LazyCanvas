"use client";

import { BrowserCanvasAdapter } from "@nmmty/adapter-browser";
import {
  BezierLayer,
  Centring,
  Div,
  Easing,
  FillType,
  FontWeight,
  Gradient,
  GradientType,
  Scene as LazyScene,
  LineLayer,
  MorphLayer,
  Path2DLayer,
  PatternType,
  PolygonLayer,
  Signal,
  TextLayer,
} from "@nmmty/lazycanvas";
import { useEffect, useRef, useState } from "react";

const NC = Centring.None;

function createTestScene(canvas: HTMLCanvasElement, test: string): LazyScene {
  const w = canvas.width;
  const h = canvas.height;
  const adapter = new BrowserCanvasAdapter(canvas);
  const sc = new LazyScene(w, h, { adapter });

  switch (test) {
    case "morph": {
      const r1 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 200, height: 100, radius: { all: 16 } },
        position: { x: 10, y: 20 },
        centring: NC,
      });
      const r2 = new MorphLayer({
        color: "#ef4444",
        size: { width: 150, height: 80, radius: { all: 12 } },
        position: { x: 250, y: 50 },
        centring: NC,
      });
      const r3 = new MorphLayer({
        color: "#22c55e",
        size: { width: 120, height: 120, radius: { all: 60 } },
        position: { x: 120, y: 140 },
        centring: NC,
      });
      sc.load(new Div().add(r1, r2, r3));
      break;
    }

    case "morph-stroke": {
      const s1 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 200, height: 100, radius: { all: 8 } },
        position: { x: 10, y: 20 },
        centring: NC,
        stroke: { width: 3, cap: "round", join: "round", dash: [], dashOffset: 0, miterLimit: 10 },
      });
      const s2 = new MorphLayer({
        color: "#f59e0b",
        size: { width: 150, height: 80, radius: { all: 4 } },
        position: { x: 240, y: 40 },
        centring: NC,
        stroke: {
          width: 2,
          cap: "square",
          join: "bevel",
          dash: [5, 3],
          dashOffset: 0,
          miterLimit: 10,
        },
      });
      sc.load(new Div().add(s1, s2));
      break;
    }

    case "text": {
      const t1 = new TextLayer({
        text: "Hello World",
        color: "#ffffff",
        font: { family: "sans-serif", size: 32, weight: FontWeight.Bold },
        align: "center",
        position: { x: 260, y: 40 },
        size: { width: "vw", height: 0 },
        centring: NC,
      });
      const t2 = new TextLayer({
        text: "Small text",
        color: "#94a3b8",
        font: { family: "sans-serif", size: 14, weight: FontWeight.Regular },
        align: "left",
        position: { x: 20, y: 80 },
        centring: NC,
      });
      const t3 = new TextLayer({
        text: "Right aligned",
        color: "#60a5fa",
        font: { family: "sans-serif", size: 18, weight: FontWeight.Medium },
        align: "right",
        position: { x: 200, y: 120 },
        size: { width: "vw", height: 0 },
        centring: NC,
      });
      sc.load(new Div().add(t1, t2, t3));
      break;
    }

    case "multiline": {
      const ml = new TextLayer({
        text: "This is a multiline text that should wrap across multiple lines and test the multiline rendering functionality",
        color: "#e2e8f0",
        font: { family: "sans-serif", size: 16, weight: FontWeight.Regular },
        align: "left",
        multiline: { enabled: true, spacing: 1.4 },
        size: { width: 350, height: 200 },
        position: { x: 20, y: 20 },
        centring: NC,
      });
      sc.load(new Div().add(ml));
      break;
    }

    case "line": {
      const l1 = new LineLayer({
        position: { x: 50, y: 50, endX: 350, endY: 150 },
        color: "#3b82f6",
        stroke: { width: 3, cap: "round", join: "round", dash: [], dashOffset: 0, miterLimit: 10 },
        filled: false,
      });
      const l2 = new LineLayer({
        position: { x: 50, y: 150, endX: 350, endY: 50 },
        color: "#ef4444",
        stroke: {
          width: 2,
          cap: "square",
          join: "miter",
          dash: [8, 4],
          dashOffset: 0,
          miterLimit: 10,
        },
        filled: false,
      });
      sc.load(new Div().add(l1, l2));
      break;
    }

    case "bezier": {
      const b1 = new BezierLayer({
        position: { x: 30, y: 150, endX: 370, endY: 150 },
        controlPoints: [
          { x: 120, y: 20 },
          { x: 280, y: 280 },
        ],
        color: "#8b5cf6",
        stroke: { width: 3, cap: "round", join: "round", dash: [], dashOffset: 0, miterLimit: 10 },
      });
      sc.load(new Div().add(b1));
      break;
    }

    case "polygon": {
      const p1 = new PolygonLayer({
        size: { width: 120, height: 120, count: 3, radius: 0 },
        color: "#f59e0b",
        position: { x: 10, y: 10 },
        centring: NC,
      });
      const p2 = new PolygonLayer({
        size: { width: 120, height: 120, count: 5, radius: 10 },
        color: "#06b6d4",
        position: { x: 160, y: 10 },
        centring: NC,
      });
      const p3 = new PolygonLayer({
        size: { width: 120, height: 120, count: 6, radius: 0 },
        color: "#ec4899",
        position: { x: 80, y: 110 },
        centring: NC,
      });
      sc.load(new Div().add(p1, p2, p3));
      break;
    }

    case "path2d": {
      const path = new Path2DLayer({
        path2D: null,
        color: "#22c55e",
      });
      path.setPath("M 50 50 L 150 50 L 150 150 L 50 150 Z");

      const circle = new Path2DLayer({
        path2D: null,
        color: "#3b82f6",
        position: { x: 180, y: 50 },
      });
      const c = new (globalThis as any).Path2D();
      c.arc(75, 75, 60, 0, Math.PI * 2);
      circle.setPath(c);
      circle.props.position = { x: 180, y: 50 };

      sc.load(new Div().add(path, circle));
      break;
    }

    case "gradient": {
      const g1 = new MorphLayer({
        color: new Gradient({
          props: {
            fillType: FillType.Gradient,
            type: GradientType.Linear,
            points: [
              { x: 0, y: 0 },
              { x: 250, y: 100 },
            ],
            stops: [
              { color: "#3b82f6", offset: 0 },
              { color: "#8b5cf6", offset: 1 },
            ],
          },
        }),
        size: { width: 250, height: 100, radius: { all: 12 } },
        position: { x: 10, y: 10 },
        centring: NC,
      });
      const g2 = new MorphLayer({
        color: new Gradient({
          props: {
            fillType: FillType.Gradient,
            type: GradientType.Radial,
            points: [
              { x: 100, y: 100, r: 10 },
              { x: 100, y: 100, r: 100 },
            ],
            stops: [
              { color: "#f59e0b", offset: 0 },
              { color: "#ef4444", offset: 1 },
            ],
          },
        }),
        size: { width: 200, height: 200, radius: { all: 100 } },
        position: { x: 210, y: 10 },
        centring: NC,
      });
      sc.load(new Div().add(g1, g2));
      break;
    }

    case "centring": {
      const c1 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 100, height: 60 },
        position: { x: 200, y: 100 },
        centring: Centring.Center,
      });
      const c2 = new MorphLayer({
        color: "#ef4444",
        size: { width: 60, height: 60, radius: { all: 30 } },
        position: { x: 100, y: 50 },
        centring: Centring.Start,
      });
      const c3 = new MorphLayer({
        color: "#22c55e",
        size: { width: 80, height: 40 },
        position: { x: 300, y: 200 },
        centring: Centring.End,
      });
      sc.load(new Div().add(c1, c2, c3));
      break;
    }

    case "shadow": {
      const sh1 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 150, height: 100, radius: { all: 12 } },
        position: { x: 20, y: 20 },
        centring: NC,
        shadow: { offsetX: 4, offsetY: 4, blur: 12, color: "rgba(59,130,246,0.5)" },
      });
      const sh2 = new MorphLayer({
        color: "#ef4444",
        size: { width: 150, height: 100, radius: { all: 12 } },
        position: { x: 220, y: 60 },
        centring: NC,
        shadow: { offsetX: -4, offsetY: 6, blur: 20, color: "rgba(239,68,68,0.4)" },
      });
      sc.load(new Div().add(sh1, sh2));
      break;
    }

    case "opacity": {
      const o1 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 120, height: 120 },
        position: { x: 10, y: 20 },
        centring: NC,
        opacity: 1.0,
      });
      const o2 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 120, height: 120 },
        position: { x: 150, y: 20 },
        centring: NC,
        opacity: 0.6,
      });
      const o3 = new MorphLayer({
        color: "#3b82f6",
        size: { width: 120, height: 120 },
        position: { x: 290, y: 20 },
        centring: NC,
        opacity: 0.3,
      });
      sc.load(new Div().add(o1, o2, o3));
      break;
    }

    case "toJSON": {
      const tj = new MorphLayer({
        color: "#3b82f6",
        size: { width: 200, height: 100, radius: { all: 8 } },
        position: { x: 50, y: 50 },
        centring: NC,
      });
      const json = tj.toJSON();
      console.log("[toJSON]", JSON.stringify(json, null, 2));
      sc.load(new Div().add(tj));
      break;
    }
  }

  return sc;
}

export interface TestCanvasProps {
  test: string;
  width?: number;
  height?: number;
}

export default function TestCanvas({ test, width = 420, height = 280 }: TestCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: width/height are read off the canvas element, so a change must rebuild the scene.
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    try {
      const sc = createTestScene(canvas, test);
      if (test !== "signal") {
        sc.renderFrame(0)
          .then(() => {
            setStatus("ok");
          })
          .catch((err) => {
            setStatus("error");
            setError(String(err));
          });
      } else {
        setStatus("ok");
      }
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  }, [test, width, height]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} />
      {status === "ok" && <div className="status">Rendered</div>}
      {status === "error" && <div className="status error">{error}</div>}
    </div>
  );
}
