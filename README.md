# 摇六爻 · Toss in Six

真实的纳甲六爻摇卦：在木桌上摇三枚乾隆通宝，六次成卦，排盘解卦。

- `packages/core` — 排盘引擎（TypeScript）：纳甲、八宫世应、六亲六神、旬空伏神、变卦、干支历（节气月建）、解卦提示词
- `apps/web` — Next.js 网页：提问 → 摇卦（真实录音与照片，物理弹跳与录音同步）→ 卦盘 → 复制解卦提示词

## 运行

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 排盘引擎测试
```

## 素材

铜钱录音、木纹照片、铜钱照片均为 CC0，来源见 `apps/web/sounds-src/SOURCES.md`。
