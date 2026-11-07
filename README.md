# Meadow · 简体中文版

Meadow 的简体中文汉化。采用**构建期叠加**的方式实现：仓库根目录的 `index.html`（上游原版）保持原样，中文以独立补丁的形式在构建时注入，产出 `docs/index.html`。

这样做的好处是：上游更新时 `git merge origin/main` 不会产生冲突，重新跑一次构建即可拿到新版中文。

## 直接游玩

下载 [`docs/index.html`](docs/index.html)，用浏览器打开即可（单文件、离线可玩）。

打开后默认**跟随浏览器语言**：中文环境自动进中文，其他环境是英文，可在「设置 → 语言」里随时切换 English / Русский / 简体中文。

## 目录结构

```
index.html          ← 上游原版（请勿直接修改）
docs/index.html     ← 构建产物：中文版成品
i18n/zh.json        主 UI 文案（185 条）
i18n/zh-helpers.json  存档面板 / 统计面板文案（102 条，含正则规则）
i18n/zh-upd.json    更新日志（9 组）
tools/build.mjs     构建脚本：锚点替换
tools/shot.mjs      用本机 Edge 无头截图（排版自查）
tools/langtest.mjs  zh / en / ru 三语回归测试
tools/overflow.mjs  文本溢出检测
```

## 重新构建

```bash
npm install        # 仅首次
npm run build      # 生成 docs/index.html
```

构建脚本的每个补丁点都使用**唯一锚点**。上游一旦改动导致锚点对不上，构建会直接报错并指出是哪一处，不会静默产出半成品。

`i18n/zh.json` 里缺少的键会自动回退英文（而不是显示 `undefined`），所以上游新增文案时可以先构建，再补译。

## 同步上游

```bash
git fetch origin main
git merge origin/main    # 只会更新根目录 index.html，通常无冲突
npm run build            # 重新套用中文补丁
```

## 翻译覆盖面

游戏的语言系统并非集中式字典，而是分散在五处，本项目逐一处理：

| 层面 | 位置 | 处理方式 |
|---|---|---|
| `T` 字典 + `t()` | 主界面 | 注入 `zh` 语言包（185 条） |
| `svT(en, ru)` | 设置 / 存档面板 | 拦截 helper，查表翻译（26 条） |
| `Q(en, r)` | 统计面板 | 拦截 helper，查表翻译（76 条） |
| `SET.lang === "ru" ? … : …` | 内联三元 28 处 | 逐条替换字面量 |
| `UPD` / `SPT` | 更新日志、剧透提示 | 各补一个 `zh` 数组 |

## 已知限制

- 标题「Meadow」是手绘 SVG 路径，无法文本化，保留原名。
- 底部导航为纯图标，无文字。
- 内嵌的 Comic Sans 字体子集不含中日韩字形，中文回落到系统字体（微软雅黑 / 苹方 / Noto Sans SC）。样式作用域限定在 `:lang(zh)`，不影响英文与俄文的原始观感。

## 版权

游戏本体版权归原作者所有。本仓库仅包含中文文本、构建脚本与构建产物。
