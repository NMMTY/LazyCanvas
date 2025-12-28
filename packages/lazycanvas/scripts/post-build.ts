import * as fs from "fs";
import * as path from "path";

const sourceDir = "./src";
const destinationDir = "./dist";

function postBuild(source: string, destination: string, extension: string): void {
  if (!fs.existsSync(source)) {
    console.error(`Source directory "${source}" does not exist.`);
    return;
  }

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const items = fs.readdirSync(source);

  items.forEach((item) => {
    const sourcePath = path.join(source, item);
    const destinationPath = path.join(destination, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      postBuild(sourcePath, destinationPath, extension);
    } else if (item.endsWith(extension)) {
      fs.copyFileSync(sourcePath, destinationPath);
      console.log(`Moved: ${sourcePath} -> ${destinationPath}`);
    }
  });
}

postBuild(sourceDir, destinationDir, ".d.ts");
