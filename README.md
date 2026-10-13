# EUROPA · 欧洲文明史（三千年 · 九十秒）

一支 **92 秒、9:16 竖屏** 的电影感短片，画面与配乐 **100% 由代码生成**：没有一张图片素材，没有一个音频采样。

- **画面**：[Remotion](https://www.remotion.dev)（React → 视频），SVG / Canvas 逐帧程序化绘制
- **配乐**：`music/compose.py` 用 numpy/scipy 从正弦波、锯齿波开始合成一整首管弦乐，终章引用贝多芬《欢乐颂》（公有领域）
- **音画同步**：配乐固定 120 BPM，1 小节 = 2 秒 = 60 帧；合成器同时导出逐帧响度与鼓点时间表，画面的光晕、震屏、闪白、星星出现时机都由它驱动

## 分镜

| 时间 | 段落 | 画面 | 音乐 |
| --- | --- | --- | --- |
| 0:00 | 开场 | 金色欧洲海岸线自绘，城市从雅典向外依次点亮，EUROPA 字标 | 低音嗡鸣、竖琴星光、合唱 |
| 0:08 | 古希腊 | 帕特农神庙金线逐笔绘出，欧几里得作图，爱琴海日出 | 里拉琴琶音 + 阿夫洛斯管旋律 |
| 0:16 | 罗马帝国 | 夕阳下的透视输水道镜头前推，月桂花环随鼓点生长 | 战鼓、铜管号角 |
| 0:24 | 中世纪 | 旋转的哥特玫瑰窗，彩色光柱与浮尘 | 格里高利式圣咏、钟声、管风琴 |
| 0:32 | 文艺复兴 | 羊皮纸上的维特鲁威圆与方、黄金螺线、手稿 | 鲁特琴十六分音符、弦乐 |
| 0:40 | 大航海 → 科学革命 | 点阵地球仪 + 哥伦布/达·伽马/麦哲伦航线，地球缩小为太阳系第三颗行星 | 跳弓弦乐、英雄主题 |
| 0:48 | 启蒙 → 大革命 | 理性之光；「自由 / 平等 / 博爱」踩在三次铜管重击上，三色光柱 | 军鼓进行曲、定音鼓滚奏 |
| 0:56 | 工业革命 | 真实啮合的铜齿轮组、烟雾与火星 | 铁砧、机械节拍 |
| 1:04 | 世界大战 | 裂痕、铁丝网、探照灯、飘落的灰烬；废墟之上的一点光 | Braam 低音、警报，随后孤独的钢琴 |
| 1:12 | 走向联合 | 十二颗星随《欢乐颂》的十二个音符逐一点亮，城市连成网络 | 《欢乐颂》全编制 |
| 1:28 | 片尾 | EUROPA · 欧洲文明史 | 终止和弦 |

顶部有一条贯穿全片的时间轴，年份随剧情滚动（公元前 800 年 → 2026 年）。

## 本地运行

需要 Node 18+、Python 3.10+、ffmpeg。

```bash
npm install
pip install numpy scipy fonttools brotli matplotlib

npm run music        # 合成配乐 → public/bgm.wav + src/data/audio.json
npm run dev          # Remotion Studio 预览：http://localhost:4317
npm run render       # 导出 out/europa.mp4（1080×1920, 30fps, H.264 + AAC）
npm run cover        # 导出封面 out/cover_3x4.png（1080×1440）和 out/cover_9x16.png（1080×1920）
```

封面（`src/Cover.tsx`）同样没有任何图片素材：九扇哥特拱窗里是用 `<Freeze>` 把正片各章节冻结在某一帧后实时渲染的画面。

可选的数据预处理（结果已提交在仓库中，一般无需重跑）：

```bash
python3 scripts/geo.py     # Natural Earth 公有领域陆地数据 → 点阵地球 + 欧洲海岸线（src/data/geo.json）
python3 scripts/fonts.py   # 按片中实际用到的汉字子集化思源宋体（改了文案后需要重跑）
node scripts/stills.mjs 120 900 2400   # 渲染指定帧的静帧到 out/stills/ 便于检查
```

## 目录

```
music/compose.py        程序化作曲与混音（合成器、混响、母带处理）
src/Europa.tsx          主合成：音轨 + 场景序列 + 全局叠加层
src/Cover.tsx           社交平台封面（3:4 与 9:16）
src/timeline.ts         小节/帧换算与段落表
src/scenes/*.tsx        十个场景
src/components/         标题排版、粒子、时间轴、胶片颗粒、闪白、镜头容器
src/lib/audio.ts        读取配乐分析数据，提供响度/鼓点脉冲
scripts/                地理数据、字体子集化、静帧预览
public/fonts/           子集化后的 Noto Serif SC、Cinzel、Cormorant Garamond（OFL 授权）
```
