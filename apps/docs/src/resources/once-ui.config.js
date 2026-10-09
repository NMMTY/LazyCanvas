// Set NEXT_PUBLIC_SITE_URL to the public address of the site; on Vercel the
// production domain is picked up automatically.
const baseURL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const routes = {};

// Import and set font for each variant
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Sora } from "next/font/google";
import { Lexend } from "next/font/google";

const heading = Sora({
    variable: "--font-heading",
    subsets: ["latin"],
    display: "swap",
});

const body = Lexend({
    variable: "--font-body",
    subsets: ["latin"],
    display: "swap",
});

const label = Inter({
    variable: "--font-label",
    subsets: ["latin"],
    display: "swap",
});

const code = Geist_Mono({
    variable: "--font-code",
    subsets: ["latin"],
    display: "swap",
});

const fonts = {
  heading: heading,
  body: body,
  label: label,
  code: code,
};

const style = {
  theme: "dark",
  brand: "pink",
  accent: "custom",
  neutral: "gray",
  border: "playful",
  solid: "contrast",
  solidStyle: "flat",
  surface: "filled",
  transition: "all",
  scaling: "100",
};

const layout = {
  // units are set in REM
  header: {
    width: 200, // max-width of the content inside the header
  },
  body: {
    width: 200, // max-width of the body
  },
  sidebar: {
    width: 17, // width of the sidebar
    collapsible: true, // accordion or static render
  },
  content: {
    width: 44, // width of the main content block
  },
  sideNav: {
    width: 17, // width of the sideNav on document pages
  },
  footer: {
    width: 44, // width of the content inside the footer
  },
};

const effects = {
  mask: {
    cursor: false,
    x: 50,
    y: 0,
    radius: 100,
  },
  gradient: {
    display: false,
    x: 50,
    y: 0,
    width: 100,
    height: 100,
    tilt: 0,
    colorStart: "brand-background-strong",
    colorEnd: "static-transparent",
    opacity: 50,
  },
  dots: {
    display: false,
    size: 2,
    color: "brand-on-background-weak",
    opacity: 20,
  },
  lines: {
    display: false,
    color: "neutral-alpha-weak",
    opacity: 100,
  },
  grid: {
    display: false,
    color: "neutral-alpha-weak",
    opacity: 100,
  },
};

const social = [
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/NMMTY/LazyCanvas",
  },
  {
    name: "npm",
    icon: "npm",
    link: "https://www.npmjs.com/package/@nmmty/lazycanvas",
  },
];

const schema = {
  logo: "",
  type: "Organization",
  name: "LazyCanvas",
  description:
    "Declarative 2D canvas rendering with flexbox layout, JSX and signal-based animation for Node.js, the browser and React.",
  email: "",
  locale: "en_US",
};

const meta = {
  home: {
    title: `${schema.name} – Declarative 2D canvas for Node.js, the browser and React`,
    description: schema.description,
    path: "/",
    image: "/api/og/generate?title=LazyCanvas&description=Declarative 2D canvas for Node.js, the browser and React",
  },
};

export { effects, style, layout, baseURL, social, schema, meta, routes, fonts };
