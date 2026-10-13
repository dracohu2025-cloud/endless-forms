// Renders still frames for visual review: node scripts/stills.mjs 120 400 900 …
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Europa" });
for (const frame of frames) {
  const output = path.resolve(`out/stills/f${String(frame).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, output, frame, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5 });
  console.log("wrote", output);
}
