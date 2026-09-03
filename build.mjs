import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "dist");
const visionRoot = join(projectRoot, "node_modules", "@mediapipe", "tasks-vision");
const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "vendor"), { recursive: true });
await mkdir(join(outputRoot, "models"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", ".nojekyll"]) {
  await writeFile(join(outputRoot, file), await readFile(join(projectRoot, file)));
}

await cp(join(visionRoot, "vision_bundle.mjs"), join(outputRoot, "vendor", "vision_bundle.mjs"));
await cp(join(visionRoot, "wasm"), join(outputRoot, "vendor", "wasm"), { recursive: true });

const modelResponse = await fetch(modelUrl, { signal: AbortSignal.timeout(120000) });
if (!modelResponse.ok) throw new Error(`Face model download failed with HTTP ${modelResponse.status}`);
await writeFile(join(outputRoot, "models", "face_landmarker.task"), Buffer.from(await modelResponse.arrayBuffer()));

console.log("HeadFlight static site created in dist/");
