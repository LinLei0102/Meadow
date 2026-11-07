#!/usr/bin/env node
/**
 * Meadow 中文补丁构建器
 *
 * 设计原则：仓库 (repo/) 永远保持上游原样，绝不修改。
 * 本脚本把中文以「叠加补丁」形式注入到构建产物 (dist/index.html)。
 * 上游更新后只需 git -C repo pull && npm run build，补丁自动重新套用。
 *
 * 补丁点全部使用唯一锚点；任何锚点数量变化都会直接报错，
 * 避免上游改动后静默产出半成品。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 同时支持两种布局：
//   仓库内运行  -> ROOT/index.html 是上游原版
//   外层工作区  -> ROOT/repo/index.html 是上游原版
const SRC = fs.existsSync(path.join(ROOT, 'repo', 'index.html'))
  ? path.join(ROOT, 'repo', 'index.html')
  : path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'docs');
const OUT = path.join(OUT_DIR, 'index.html');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

let html = fs.readFileSync(SRC, 'utf8');
const applied = [];
const warnings = [];

/** 精确替换，要求锚点恰好出现一次 */
function replaceOnce(name, from, to) {
  const i = html.indexOf(from);
  if (i < 0) throw new Error(`[锚点缺失] ${name}\n  找不到: ${from.slice(0, 90)}`);
  if (html.indexOf(from, i + 1) >= 0)
    throw new Error(`[锚点不唯一] ${name}\n  出现多次: ${from.slice(0, 90)}`);
  html = html.slice(0, i) + to + html.slice(i + from.length);
  applied.push(name);
}

/** 精确替换，指定期望出现次数 */
function replaceN(name, from, to, expect) {
  const n = html.split(from).length - 1;
  if (n !== expect)
    throw new Error(`[锚点数量] ${name} 期望 ${expect} 处，实际 ${n} 处\n  ${from.slice(0, 90)}`);
  html = html.split(from).join(to);
  applied.push(`${name} ×${n}`);
}

/** 取出 anchor 之后第一个括号包裹的字面量原文（{…} 或 […]） */
function grabRaw(anchor, open = '{', close = '}') {
  const i = html.indexOf(anchor);
  if (i < 0) throw new Error(`[锚点缺失] ${anchor}`);
  const start = html.indexOf(open, i + anchor.length - 1);
  let depth = 0, quote = null, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error('字面量未闭合');
}
const grabObject = (anchor) => grabRaw(anchor, '{', '}');
const grabArray = (anchor) => grabRaw(anchor, '[', ']');

// ───────────────────────────── 1. 读取译文 ─────────────────────────────
const en = eval('(' + grabObject('var T = { en:') + ')');           // eslint-disable-line no-eval
const zhTr = readJson(path.join(ROOT, 'i18n', 'zh.json'));
const helpers = readJson(path.join(ROOT, 'i18n', 'zh-helpers.json'));

// 以 en 的键顺序为准；缺失的键回落英文，保证 t() 永不返回 undefined
const zh = {};
const missing = [];
for (const k of Object.keys(en)) {
  if (Object.prototype.hasOwnProperty.call(zhTr, k)) zh[k] = zhTr[k];
  else { zh[k] = en[k]; missing.push(k); }
}
const stale = Object.keys(zhTr).filter((k) => !(k in en));

console.log(`英文字典 ${Object.keys(en).length} 条，译文 ${Object.keys(zhTr).length} 条`);
if (missing.length) warnings.push(`上游新增/未翻译 ${missing.length} 条，已回落英文: ${missing.join(', ')}`);
if (stale.length) warnings.push(`译文中多余 ${stale.length} 条（上游已删）: ${stale.join(', ')}`);

// ────────────────────── 2. 注入运行期运行时（helpers） ──────────────────────
// 标题字形：游戏内嵌的 Comic Sans 无中文字形，系统黑体又和手绘调性不搭。
// 取霞鹜文楷（OFL-1.1）子集出「草甸」两字，仅 1.1KB，直接内联，产物仍是单文件离线可用。
const fontPath = path.join(ROOT, 'i18n', 'fonts', 'meadow-title-zh.woff2');
let fontFace = '';
if (fs.existsSync(fontPath)) {
  const b64 = fs.readFileSync(fontPath).toString('base64');
  fontFace =
    `@font-face{font-family:"MeadowZhTitle";` +
    `src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:400;font-display:block;}`;
} else {
  warnings.push('未找到 i18n/fonts/meadow-title-zh.woff2，标题回落到系统黑体');
}

const runtime = `<script id="zh-i18n">
/* Meadow 中文补丁 — 构建期注入，源码未改动 */
window.__ZH_I18N__ = ${JSON.stringify(helpers.exact)};
window.__ZH_PAT__ = ${JSON.stringify(helpers.patterns)}.map(function (p) { return [new RegExp(p[0]), p[1]]; });
window.__ZH__ = function (s) {
  if (s == null) return null;
  s = String(s);
  var E = window.__ZH_I18N__;
  if (Object.prototype.hasOwnProperty.call(E, s)) return E[s];
  var P = window.__ZH_PAT__;
  for (var i = 0; i < P.length; i++) if (P[i][0].test(s)) return s.replace(P[i][0], P[i][1]);
  return null;
};
/* 标签页标题跟随语言：游戏启动时会把 <html lang> 设成当前语言（5748 行） */
(function () {
  var TITLE = { zh: "草甸 Meadow" };
  var sync = function () {
    var l = document.documentElement.lang || "";
    document.title = /^zh/i.test(l) && TITLE.zh ? TITLE.zh : "Meadow";
  };
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true, attributeFilter: ["lang"],
  });
  sync();
})();
</script>
<style id="zh-i18n-style">
${fontFace}
/* 内嵌 Comic Sans 子集不含中日韩字形，补一层 CJK 字体栈 */
:lang(zh) body, :lang(zh) button, :lang(zh) input, :lang(zh) textarea,
:lang(zh) h1, :lang(zh) h2, :lang(zh) p, :lang(zh) div, :lang(zh) span {
  font-family: "ComicSansEmbed", "ComicSansJS", "Comic Sans MS",
               "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC",
               "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC",
               sans-serif;
}
:lang(zh) .e, :lang(zh) p { line-height: 1.45; }

/* 正式译名「草甸」：Logo 里同时放拉丁与中文两套字形，由 :lang() 切换。
   这样英文/俄文玩家的标题仍是原版 Meadow，纯 CSS 完成，无脚本、无闪烁。 */
html:lang(zh) #start .sttl .lgw-zh text {
  font-family: "MeadowZhTitle", "Comic Sans MS", sans-serif;
  font-weight: 400;
}
#start .sttl .lgw-zh { display: none; }
html:lang(zh) #start .sttl .lgw-en { display: none; }
html:lang(zh) #start .sttl .lgw-zh { display: inline; }
/* 汉字笔画密，原始 18px 光晕会糊成一团，中文单独收细 */
html:lang(zh) #start .sttl .lgw-zh .lgg tspan { stroke-width: 10px; opacity: .24; }
/* 关键：拉丁字母笔画疏，描边层是加分的；汉字每一笔都会被再勾一遍轮廓，
   密笔画（如「甸」里的田）会变成一坨网格噪点，所以中文整层去掉，
   改用一层极轻的投影保住"上墨"的立体感。 */
html:lang(zh) #start .sttl .lgw-zh .lgo { display: none; }
html:lang(zh) #start .sttl .lgw-zh .lgf tspan { filter: drop-shadow(0 3px 0 rgba(0, 0, 0, .38)); }
</style>
`;
replaceOnce('注入运行时脚本与 CJK 字体样式', '</head>', runtime + '</head>');

// ───────────────────────── 3. 语言字典：加入 zh ─────────────────────────
replaceOnce(
  'T 字典增加 zh',
  'var T = { en: {',
  'var T = { zh: ' + JSON.stringify(zh) + ',\n        en: {'
);

// ───────────────────────── 4. 默认语言 / 存档校验 ─────────────────────────
replaceOnce(
  '默认语言改为跟随浏览器',
  'SET = { lang: "en",',
  'SET = { lang: (/^zh/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "") ? "zh" : "en"),'
);
replaceOnce(
  '本地设置恢复时接受 zh',
  'if (sr.lang === "ru" || sr.lang === "en")',
  'if (sr.lang === "ru" || sr.lang === "en" || sr.lang === "zh")'
);

// ───────────────────────── 5. 设置面板语言选项 ─────────────────────────
replaceOnce(
  '语言选择器加入「简体中文」',
  'mkGroup("lang", [{ v: "en", n: "English" }, { v: "ru", n: "Русский" }]);',
  'mkGroup("lang", [{ v: "en", n: "English" }, { v: "ru", n: "Русский" }, { v: "zh", n: "简体中文" }]);'
);

// ───────────── 6. 两个文本 helper：存档面板 svT() / 统计面板 Q() ─────────────
replaceOnce(
  'svT() 拦截',
  'function svT(en, ru) { return svRu() ? ru : en; }',
  'function svT(en, ru) { if (SET.lang === "zh") { var z = window.__ZH__(en); if (z != null) return z; } return svRu() ? ru : en; }'
);
replaceOnce(
  'Q() 拦截',
  'function Q(en, r) { return ru() ? r : en; }',
  'function Q(en, r) { if (SET.lang === "zh") { var z = window.__ZH__(en); if (z != null) return z; } return ru() ? r : en; }'
);

// ───────────────────────── 7. 剧透提示文案 ─────────────────────────
replaceOnce(
  'SPT 剧透文案增加 zh',
  'var SPN = 3, SPT = { en: [',
  'var SPN = 3, SPT = { zh: ["剧透！！", "以下是内测版的剩余内容。点击选择要显示的部分。", "全部显示", "点击某个分区，只显示该分区。"], en: ['
);

// ───────────────────── 7b. 更新日志（缺文件则回落英文）─────────────────────
const updPath = path.join(ROOT, 'i18n', 'zh-upd.json');
if (fs.existsSync(updPath)) {
  const updZh = readJson(updPath);
  const updEn = JSON.parse(JSON.stringify(eval('(' + grabArray('var UPD = { "en": ') + ')'))); // eslint-disable-line no-eval
  if (updZh.length !== updEn.length)
    warnings.push(`更新日志条目数不一致：译文 ${updZh.length} / 原文 ${updEn.length}，请核对`);
  replaceOnce(
    'UPD 更新日志增加 zh',
    'var UPD = { "en": [',
    'var UPD = { "zh": ' + JSON.stringify(updZh) + ', "en": ['
  );
} else {
  warnings.push('未找到 i18n/zh-upd.json，更新日志将显示英文');
}

// ───────── 8. 内联三元里的零散英文（字典与 helper 覆盖不到的部分）─────────
replaceN('公式前缀', ': "Formula: 1 + log"', ': "公式：1 + log"', 1);
replaceN('献祭公式分母', ': "(donated / "', ': "（已献祭 / "', 1);
replaceN('读档提示', ': "Loading save…"', ': "正在读取存档…"', 1);
replaceN('自定义数量占位符', ': "custom"', ': "自定义"', 2);
replaceN('自定义数量说明', ': "Set your amount here."', ': "在此输入数量。"', 2);
replaceN('删档确认', ': "Are you sure you want to delete slot "', ': "确定要删除栏位 "', 1);
replaceN('秒单位(画布/倒计时/自动保存)', ': " s")', ': " 秒")', 4);
replaceN('分钟单位(自动保存)', ': " min")', ': " 分")', 1);
replaceN('蒸汽产出速率', '" steam/s (" + stPct() + "% of water)"', '" 蒸汽/秒（占水量 " + stPct() + "%）"', 1);

// ───────────────────── 9. 正式译名：草甸 ─────────────────────
// 「Meadow」的正式中文译名。草甸是植物学/地理学里 meadow 的对应词（区别于「草原」steppe），
// 两字简短、字形对称，且与游戏内已用的「草地」（field，指你收割的那片）区分开。
const NAME_ZH = '草甸';
// 两个字的取色沿用原 Logo 的调色板首位：#9be04e 嫩草绿 + #7ec4ee 露水蓝（游戏只有草与水两种资源）
const LOGO_ZH = {
  chars: [['草', '#9be04e'], ['甸', '#7ec4ee']],
  // 原拉丁字形为 100px；汉字笔画更满，且只有两字，需放大并拉开字距才撑得住版面
  size: 122,
  y: 104,
  ls: 14,
};

replaceOnce('页面标题改为译名', '<title>Meadow</title>', `<title>${NAME_ZH} Meadow</title>`);
replaceOnce(
  'Logo 无障碍名',
  '<div class="sttl" role="img" aria-label="Meadow">',
  `<div class="sttl" role="img" aria-label="Meadow ${NAME_ZH}">`
);
replaceOnce(
  '导航键无障碍名',
  'id="bMeadow" type="button" aria-label="Meadow"',
  `id="bMeadow" type="button" aria-label="${NAME_ZH}"`
);

// Logo 在 SVG 里是 <text>+<tspan> 而非手绘路径，可以换字。
// 保留原拉丁三层不动，另建一层中文，用 .lgw-en / .lgw-zh 由 CSS 按语言切换。
{
  const open = html.indexOf('<svg class="lgsvg" viewBox="0 0 380 110"');
  if (open < 0) throw new Error('[锚点缺失] 启动页 Logo（svg.lgsvg）');
  const tagEnd = html.indexOf('>', open) + 1;
  const close = html.indexOf('</svg>', tagEnd);
  const inner = html.slice(tagEnd, close);

  const defsEnd = inner.indexOf('</defs>');
  if (defsEnd < 0) throw new Error('[Logo 结构变化] 缺少 <defs>');
  const defs = inner.slice(0, defsEnd + '</defs>'.length);
  const latin = inner.slice(defsEnd + '</defs>'.length);

  const layers = latin.match(/<text class="(?:lgg|lgf|lgo)"[^>]*>[\s\S]*?<\/text>/g) || [];
  if (layers.length !== 3 || !latin.includes('x="190" y="84"'))
    throw new Error(`[Logo 结构变化] 期望 3 个 <text> 且坐标 190/84，实际 ${layers.length} 个`);

  const spans = LOGO_ZH.chars
    .map(([c, col]) => `<tspan style="--c:${col}">${c}</tspan>`)
    .join('');
  // 用内联 style 而不是 font-size 属性：后者是 SVG 表现属性，优先级低于
  // `.sttl text { font-size: 100px }` 这条 CSS，会被覆盖回去。
  const zhLayer = (cls) =>
    `<text class="${cls}" x="190" y="${LOGO_ZH.y}" text-anchor="middle"` +
    ` style="font-size:${LOGO_ZH.size}px;letter-spacing:${LOGO_ZH.ls}px">${spans}</text>`;

  const zh = `<g filter="url(#lgGlow)">${zhLayer('lgg')}</g>${zhLayer('lgf')}${zhLayer('lgo')}`;
  html =
    html.slice(0, tagEnd) +
    defs +
    `<g class="lgw lgw-en">${latin}</g><g class="lgw lgw-zh">${zh}</g>` +
    html.slice(close);
  applied.push(`启动页 Logo 换成「${NAME_ZH}」（CSS 按语言切换）`);
}

// ───────────────────────── 10. 输出 ─────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

console.log('\n已套用补丁:');
for (const a of applied) console.log('  ✓ ' + a);
if (warnings.length) {
  console.log('\n注意:');
  for (const w of warnings) console.log('  ! ' + w);
}
console.log(`\n输出: ${path.relative(ROOT, OUT)} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
