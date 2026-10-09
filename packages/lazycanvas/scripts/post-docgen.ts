import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Copies the generated API reference (.mdx and meta.json files) into the
 * documentation site, where it is served under /reference.
 */
const source = path.join(__dirname, "..", "public", "reference");
const destination = path.join(__dirname, "../../..", "apps", "docs", "src", "content", "reference");

/**
 * The generator writes tables as `<Table data={{ headers: […], rows: […] }} />`.
 * next-mdx-remote 6 refuses JavaScript expressions in MDX by default (a
 * security measure), so pass the same data as a URL-encoded JSON string
 * attribute instead; `CustomTable` decodes it.
 */
function encodeTables(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const prefix = "<Table data={{ headers: ";
      const suffix = " }} />";
      if (!line.startsWith(prefix) || !line.endsWith(suffix)) return line;
      const body = line.slice(prefix.length, line.length - suffix.length);
      const split = body.indexOf("], rows: ");
      if (split === -1) return line;
      const headers = JSON.parse(body.slice(0, split + 1));
      const rows = JSON.parse(body.slice(split + "], rows: ".length));
      return `<Table data="${encodeURIComponent(JSON.stringify({ headers, rows }))}" />`;
    })
    .join("\n");
}

function copyFiles(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyFiles(sourcePath, destPath);
    } else if (/\.mdx$/i.test(entry.name)) {
      fs.writeFileSync(destPath, encodeTables(fs.readFileSync(sourcePath, "utf8")));
    } else if (/\.json$/i.test(entry.name)) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

if (!fs.existsSync(source)) {
  throw new Error(`Generated documentation not found at ${source}. Did docgen run?`);
}

fs.rmSync(destination, { recursive: true, force: true });
copyFiles(source, destination);

// The section is called after the generator's `name`; give it a proper title
// and place it after the guides.
const metaPath = path.join(destination, "meta.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
meta.title = "API Reference";
meta.order = 2;
fs.writeFileSync(metaPath, JSON.stringify(meta));

console.log(`API reference copied to ${path.relative(process.cwd(), destination)}`);
