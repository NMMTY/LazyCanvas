"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import TestCanvas from "@/components/TestCanvas";
import SignalSceneTest from "@/components/SignalSceneTest";

const ReactSceneTest = dynamic(() => import("@/components/ReactSceneTest"), { ssr: false });

const TESTS = [
  { id: "morph", title: "MorphLayer — fill + radius", desc: "Basic filled rectangles with rounded corners" },
  { id: "morph-stroke", title: "MorphLayer — stroke + dash", desc: "Stroke with dash patterns and line caps" },
  { id: "text", title: "TextLayer — alignment", desc: "Left, center, right text alignment" },
  { id: "multiline", title: "TextLayer — multiline", desc: "Word-wrapping multiline text" },
  { id: "line", title: "LineLayer", desc: "Lines with solid and dashed strokes" },
  { id: "bezier", title: "BezierLayer", desc: "Cubic bezier curves" },
  { id: "polygon", title: "PolygonLayer", desc: "Triangle, pentagon, hexagon shapes" },
  { id: "path2d", title: "Path2DLayer", desc: "SVG path and arc rendering" },
  { id: "gradient", title: "Gradient", desc: "Linear and radial gradient fills" },
  { id: "centring", title: "Centring", desc: "Center, start, end centring modes" },
  { id: "shadow", title: "Shadow", desc: "Shadow offsets and blur" },
  { id: "opacity", title: "Opacity", desc: "Transparency levels (1.0, 0.6, 0.3)" },
  { id: "toJSON", title: "toJSON", desc: "Layer serialization to JSON (check console)" },
  { id: "react-scene", title: "React <Scene> - Signal + Easing", desc: "lazycanvas-react Scene component with registerLayer" },
];

export default function Home() {
  return (
    <div className="app">
      <h1>@nmmty/lazycanvas — Next.js Test</h1>
      <p className="subtitle">All features rendered in browser via BrowserCanvasAdapter</p>

      <div className="section">
        <h2 className="section-title">Components</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: 16 }}>
          {TESTS.filter((t) => t.id !== "react-scene").map((t) => (
            <div className="card" key={t.id}>
              <div className="card-title">{t.title}</div>
              <div style={{ color: "#737373", fontSize: 12, marginBottom: 12 }}>{t.desc}</div>
              <TestCanvas test={t.id} />
            </div>
          ))}
        </div>
        <Logs/>
      </div>

      <div className="section">
        <h2 className="section-title">React Integration</h2>
        <div className="card">
          <div className="card-title">lazycanvas-react &lt;Scene&gt;</div>
          <div style={{ color: "#737373", fontSize: 12, marginBottom: 12 }}>
            JSX rendering with registerLayer and useScene hook
          </div>
          <div  style={{
            flexDirection: 'row'
          }}>
            <ReactSceneTest />
            <SignalSceneTest />
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">API Summary</h2>
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ padding: "8px 12px" }}>Feature</th>
                <th style={{ padding: "8px 12px" }}>Package</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["MorphLayer", "@nmmty/lazycanvas", "ok"],
                ["TextLayer", "@nmmty/lazycanvas", "ok"],
                ["ImageLayer", "@nmmty/lazycanvas", "ok"],
                ["LineLayer", "@nmmty/lazycanvas", "ok"],
                ["BezierLayer", "@nmmty/lazycanvas", "ok"],
                ["PolygonLayer", "@nmmty/lazycanvas", "ok"],
                ["Path2DLayer", "@nmmty/lazycanvas", "ok"],
                ["Div (group)", "@nmmty/lazycanvas", "ok"],
                ["Gradient", "@nmmty/lazycanvas", "ok"],
                ["Signal + Easing", "@nmmty/lazycanvas", "ok"],
                ["Scene", "@nmmty/lazycanvas", "ok"],
                ["BrowserCanvasAdapter", "@nmmty/lazycanvas-adapter-browser", "ok"],
                ["React <Scene>", "@nmmty/lazycanvas-react", "ok"],
                ["registerLayer()", "@nmmty/lazycanvas-react", "ok"],
                ["useScene() hook", "@nmmty/lazycanvas-react", "ok"],
              ].map(([feat, pkg, status]) => (
                <tr key={feat} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "6px 12px" }}>{feat}</td>
                  <td style={{ padding: "6px 12px", color: "#737373" }}><code className="code">{pkg}</code></td>
                  <td style={{ padding: "6px 12px", color: "#22c55e" }}>{status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Logs() {
  const logsRef = useRef<string[]>([]);
  const [, rerender] = useState(0);

  useEffect(() => {
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logsRef.current = [...logsRef.current, args.join(" ")];
      rerender((n) => n + 1);
      origLog(...args);
    };
    return () => { console.log = origLog; };
  }, []);

  return (
    <div>
      <div className="log">
        {logsRef.current.length === 0 && <div className="log-entry">Waiting for render...</div>}
        {logsRef.current.map((l, i) => (
          <div className="log-entry success" key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
