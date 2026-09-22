# 铜钱录音来源

全部为 CC0 1.0（公有领域），可商用、无需署名。下载日期 2026-09-21。

| 文件 | 作者 / 来源 | 说明 |
|---|---|---|
| shake-1..4.mp3 | SpaceJoe, Freesound, pack "Coin Sounds" https://freesound.org/people/SpaceJoe/packs/27440/ (sounds 485766–485769) | 手里晃硬币；高质量预览 MP3 |
| oga-coin_drop.wav | Vinrax, OpenGameArt https://opengameart.org/content/coin-drop | 单枚硬币落桌 |
| oga-coinsounds011015.wav | syncopika, OpenGameArt https://opengameart.org/content/coin-sounds | 真硬币多段录音 |
| bsb-2697-spin.wav | BigSoundBank https://bigsoundbank.com/coin-spinning-on-a-table-1-s2697.html （许可 https://bigsoundbank.com/licenses.html） | €2 硬币在上漆木桌上转到停 |
| fs-coin-fall-on-table.mp3 | cupido-1, Freesound https://freesound.org/people/cupido-1/sounds/563264/ | 硬币落桌 |
| fs-couple-coins-wood-top.mp3 | nicoproson, Freesound https://freesound.org/people/nicoproson/sounds/776504/ | 几枚硬币落木面 |
| fs-flip-coin-wood-table.mp3 | Zrte, Freesound https://freesound.org/people/Zrte/sounds/470901/ | 木桌上翻硬币 |
| fs-spinning-coin-drop.mp3 | Diim_1, Freesound https://freesound.org/people/Diim_1/sounds/854261/ | 硬币落下并旋转 |
| fs-coin-drop.mp3 | Diim_1, Freesound https://freesound.org/people/Diim_1/sounds/854248/ | 硬币落下 |
| fs-coins-fall-on-table.mp3 | AardsReal, Freesound https://freesound.org/people/AardsReal/sounds/842173/ | 硬币落桌 |

Freesound 的文件是站点提供的 HQ 预览 MP3（原始 WAV 需登录下载）；许可以各声音页面标注为准，均为 CC0。

处理：`afconvert` 转 44.1k 单声道 → `scripts/slice-sounds.py` 按起音切片、归一化 → AAC 96k 写入 `public/sounds/lib/`。

# 桌面木纹来源

均为 PolyHaven，CC0 1.0，1k 漫反射贴图，下载日期 2026-09-21。

| 文件 | 来源 |
|---|---|
| public/textures/wood_table_worn.jpg | https://polyhaven.com/a/wood_table_worn |
| public/textures/dark_wood.jpg | https://polyhaven.com/a/dark_wood |

# 铜钱照片来源

Wikimedia Commons，Gary Lee Todd 收藏，CC0 1.0。原图放 coins-src/（不入库），处理后贴图在 public/coins/。

| 原图 | 页面 | 用途 |
|---|---|---|
| q364.jpg | https://commons.wikimedia.org/wiki/File:364_S-1464,_Qianlong,_1735-1796,_25mm.jpg | 铜钱 a |
| q368.jpg | https://commons.wikimedia.org/wiki/File:368_S-1468,_Qianlong,_1735-1796,_25mm.jpg | 铜钱 b |
| q376.jpg | https://commons.wikimedia.org/wiki/File:376_S-1478,_Qianlong,_1735-1796,_25mm.jpg | 铜钱 c |
| q372.jpg | https://commons.wikimedia.org/wiki/File:372_S-1473,_Qianlong,_1735-1796,_25mm.jpg | 锈蚀过重，未用 |
