import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "dist");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", ".nojekyll"]) {
  await writeFile(join(outputRoot, file), await readFile(join(projectRoot, file)));
}

await cp(join(projectRoot, "vendor"), join(outputRoot, "vendor"), { recursive: true });
await cp(join(projectRoot, "models"), join(outputRoot, "models"), { recursive: true });

console.log("HeadFlight self-contained static site created in dist/");
