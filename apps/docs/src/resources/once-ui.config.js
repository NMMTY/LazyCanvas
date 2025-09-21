const baseURL = "https://docs.once-ui.com";

const routes = {
  '/changelog':  false,
  '/roadmap':    false,
}

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

const dataStyle = {
  variant: "gradient", // flat | gradient | outline
  mode: "categorical", // categorical | divergent | sequential
  height: 24, // default chart height
  axis: {
    stroke: "var(--neutral-alpha-weak)",
  },
  tick: {
    fill: "var(--neutral-on-background-weak)",
    fontSize: 11,
    line: false
  },
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
  // Links are automatically displayed.
  // Import new icons in /once-ui/icons.ts
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/NMMTY",
  }
];

const schema = {
  logo: "",
  type: "Organization",
  name: "NMMTY",
  description: "Website with documentation for NMMTY organization modules and its participants.",
  email: "",
  locale: "en_US"
};

const meta = {
  home: {
    title: `RE:Docs – ${schema.name}`,
    description: schema.description,
    path: "/",
    image: "/api/og/generate?title=RE:Docs&description=Documentation for NMMTY modules"
  },
  roadmap: {
    title: `Roadmap – ${schema.name}`,
    description: schema.description,
    path: "/roadmap",
    image: "/api/og/generate?title=Roadmap"
  },
  changelog: {
    title: `Changelog – ${schema.name}`,
    description: schema.description,
    path: "/changelog",
    image: "/api/og/generate?title=Changelog"
  }
};

export { dataStyle, effects, style, layout, baseURL, social, schema, meta, routes, fonts };
