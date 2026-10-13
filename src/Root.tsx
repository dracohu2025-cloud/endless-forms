import React from "react";
import { Composition } from "remotion";
import { Cover } from "./Cover";
import { Europa } from "./Europa";
import { loadFonts } from "./fonts";
import { FPS, H, TOTAL_FRAMES, W } from "./timeline";

loadFonts();

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Europa" component={Europa} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    {/* Same length as the film so <Freeze> inside the cover can reach any frame of it. */}
    <Composition id="Cover-3x4" component={Cover} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={1440}
      defaultProps={{ tall: false }} />
    <Composition id="Cover-9x16" component={Cover} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H}
      defaultProps={{ tall: true }} />
  </>
);
