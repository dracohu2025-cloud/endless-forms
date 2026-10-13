import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const SANS = "'Noto Sans SC', sans-serif";
export const DISPLAY = "'Unbounded', 'Noto Sans SC', sans-serif";
export const MONO = "'JetBrains Mono', 'Noto Sans SC', monospace";

let loaded: Promise<unknown> | null = null;

export const loadEvolutionFonts = () => {
  if (!loaded) {
    loaded = Promise.all([
      loadFont({ family: "Noto Sans SC", url: staticFile("fonts/NotoSansSC-subset.woff2"), weight: "100 900" }),
      loadFont({ family: "Unbounded", url: staticFile("fonts/Unbounded.woff2"), weight: "200 900" }),
      loadFont({ family: "JetBrains Mono", url: staticFile("fonts/JetBrainsMono.woff2"), weight: "100 800" }),
    ]);
  }
  return loaded;
};
