import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LazyCanvas Test App",
  description: "Testing all @nmmty/lazycanvas functions in Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
