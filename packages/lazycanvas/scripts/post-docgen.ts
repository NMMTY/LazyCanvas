import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Copies the generated API reference (.mdx and meta.json files) into the
 * documentation site, where it is served under /reference.
 */
const source = path.join(__dirname, "..", "public", "reference");
const destination = path.join(__dirname, "../../..", "apps", "docs", "src", "content", "reference");

function copyFiles(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyFiles(sourcePath, destPath);
    } else if (/\.(mdx|json)$/i.test(entry.name)) {
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
