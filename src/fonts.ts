import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const SERIF_SC = "'Noto Serif SC', 'Songti SC', serif";
export const CINZEL = "'Cinzel', 'Noto Serif SC', serif";
export const GARAMOND = "'Cormorant Garamond', 'Garamond', serif";

let loaded: Promise<unknown> | null = null;

export const loadFonts = () => {
  if (!loaded) {
    loaded = Promise.all([
      loadFont({ family: "Noto Serif SC", url: staticFile("fonts/NotoSerifSC-subset.woff2"), weight: "200 900" }),
      loadFont({ family: "Cinzel", url: staticFile("fonts/Cinzel.woff2"), weight: "400 900" }),
      loadFont({
        family: "Cormorant Garamond",
        url: staticFile("fonts/CormorantGaramond.woff2"),
        weight: "300 700",
      }),
    ]);
  }
  return loaded;
};
