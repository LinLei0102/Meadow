#!/usr/bin/env node
/**
 * 生成「完美毕业」存档。
 *
 * 全部数值取自源码，不是猜的：
 *   关卡终点   oc >= MS[7] = 5e14              → 第 10 关「完成」（5810 行）
 *   草地升级   spawn 50 / max 90 / rad 40 / boost 600 / dewb 60+30*ocu2（DEFS, 3858）
 *   水体升级   wg 50 / dg 50（WG_MX/DG_MX）
 *   廉价升级   cs 10 / cm 10 / cr 10 / cb 60 / cd 5+3+3*ocu2（cwb, 5092）
 *   臭氧升级   ocu 24 / ocu2 4 / ocu3 9 / ocu4 10 / ocu5 1（6557 起）
 *   其它       tn 5 / ac 5 / rc 5 / dq 6 / fl 100 / dewLv 15（d10、d15 两个成就）
 *
 * 用法: node tools/make-save.mjs
 * 输出: save/perfect.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 上限（全部来自源码常量） ──────────────────────────────────────────────
const OCU2 = 4; // 臭氧升级 2 级：1 级 +30 Dew base 上限、+3 Cheap Dew base 上限
const OCU = 24; // 臭氧升级 1 级：需 oc >= MS[5] 才能到 24，否则 15
const TORNADO = 5; // 龙卷风里程碑 5 解锁 Worldwide Floor

const SAVE = {
  v: 1, // VER
  // ── 龙卷风（转生） ──
  tn: TORNADO,
  tl: true, // 龙卷风已解锁
  ac: 5, // 空气三叶草等级
  // ── 臭氧 / 水体 ──
  steam: '1e24',
  c1: '100', // 小云朵
  c2: '100', // 中云朵
  c3: '100', // 大云朵
  w2d: true, // 水体转露水已解锁
  grass: '1e24',
  total: '1e24',
  wu: true, // 水体系统已解锁
  water: '1e24',
  tsd: '1e24', // 献祭水量（海啸威力）
  oc: '5e14', // 海洋体积 = 最终里程碑 MS[7]
  ocu: OCU,
  ocu2: OCU2,
  ocu3: 9,
  ocu4: 10,
  ocu5: 1, // 需 oc >= MS[6] 且 ocu >= 24；升满后 ocBase 恰好 = 1.0，海洋不再减速
  fl: 100, // Worldwide Floor，每级水体 x2
  // ── 露水 ──
  dewOn: true,
  rained: true,
  dewXP: 0,
  dewLv: 15, // d10 / d15 两个成就的阈值
  // ── 草地 / 水体升级 ──
  wg: 50,
  dg: 50,
  // ── 廉价升级 ──
  cs: 10,
  cm: 10,
  cr: 10,
  cb: 60,
  cd: 5 + 3 + 3 * OCU2, // cwMx("cd", 5)：基础 5 + 龙卷风 3 + 臭氧 3*ocu2
  // ── 成就 ──
  d10: true,
  d15: true,
  // ── 雨云 ──
  rc: 5,
  rcAt: Date.now(),
  dq: 6, // 露水收获
  // ── 四项主升级满级 ──
  up: {
    spawn: 50,
    max: 90,
    rad: 40,
    boost: 600,
    dewb: 60 + 30 * OCU2, // dewMx("dewb")：汉字注意这里是动态上限
  },
};

// 与游戏 S0 的键顺序保持一致，便于人工 diff
const ORDER = [
  'v', 'tn', 'tl', 'ac', 'steam', 'c1', 'c2', 'c3', 'w2d', 'grass', 'total', 'wu',
  'water', 'tsd', 'oc', 'ocu', 'ocu2', 'ocu3', 'ocu4', 'ocu5', 'fl', 'dewOn',
  'rained', 'dewXP', 'dewLv', 'wg', 'dg', 'cs', 'cm', 'cr', 'cb', 'cd', 'd10',
  'd15', 'rc', 'rcAt', 'dq', 'up',
];
const ordered = {};
for (const k of ORDER) {
  if (!(k in SAVE)) throw new Error(`字段缺失: ${k}`);
  ordered[k] = SAVE[k];
}
const extra = Object.keys(SAVE).filter((k) => !ORDER.includes(k));
if (extra.length) throw new Error(`未登记的字段: ${extra.join(', ')}`);

const out = path.join(ROOT, 'save', 'perfect.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ordered, null, 2) + '\n', 'utf8');

// ── 导入页 ────────────────────────────────────────────────────────────────
// file:// 下不能 fetch 本地 JSON（CORS），所以把存档直接内联进页面。
const oneLine = JSON.stringify(ordered);
const importHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>导入存档 · 草甸</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 40px 20px;
    background: radial-gradient(circle at 50% 0%, #1d3a22, #0b120c 70%);
    color: #e6f2e6; font: 16px/1.7 "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
  }
  .card { width: min(620px, 100%); background: #131d14; border: 2px solid #2f4a33; border-radius: 14px; padding: 26px 26px 22px; }
  h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 1px; }
  .sub { margin: 0 0 18px; color: #9fb8a3; font-size: 14px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 0 20px; font-size: 14px; }
  dt { color: #8aa88f; }
  dd { margin: 0; color: #d6e8d8; }
  button {
    width: 100%; padding: 13px 18px; font: inherit; font-weight: 700; cursor: pointer;
    color: #0d1a0f; background: #9be04e; border: 0; border-radius: 10px;
  }
  button:hover { background: #aeea6a; }
  code, textarea { font-family: ui-monospace, Consolas, monospace; }
  textarea { width: 100%; height: 120px; margin-top: 8px; resize: vertical; font-size: 12px;
    background: #0a110b; color: #9fb8a3; border: 1px solid #2f4a33; border-radius: 8px; padding: 8px; }
  .warn { color: #ffb98f; font-size: 13px; margin: 12px 0 0; }
  .ok { color: #9be04e; }
  .hide { display: none; }
</style>
</head>
<body>
<div class="card">
  <h1>完美毕业存档</h1>
  <p class="sub">Meadow / 草甸 · 0.1.02v · 第 1 号存档位</p>
  <dl>
    <dt>进度</dt><dd>第 10 关「完成」——海洋 5e14 m³，内测内容通关</dd>
    <dt>草地升级</dt><dd>生长速度 50 · 草地大小 90 · 触碰半径 40 · 基础草量 600 · 基础露水 180</dd>
    <dt>水体升级</dt><dd>水草 50 · 露水增益 50 · 四项廉价升级满级</dd>
    <dt>海洋</dt><dd>体积 5e14 · 五项臭氧升级满级</dd>
    <dt>其它</dt><dd>龙卷风 5 · 空气三叶草 5 · 雨云 5 · 露水收获 6 · Worldwide Floor 100 · 露水 Lv15</dd>
  </dl>
  <button id="go">写入存档 → 打开游戏</button>
  <p class="warn" id="msg">注意：会覆盖第 1 号存档位，其他存档位不受影响。</p>
  <p><a href="#" id="toggle" style="color:#8aa88f;font-size:13px">手动方式（控制台粘贴）</a></p>
  <div id="manual" class="hide">
    <p class="sub" style="margin:6px 0 0">打开游戏后按 F12 → Console，粘贴下面这行回车：</p>
    <textarea readonly id="snip">localStorage.setItem('lug_save_v1', JSON.stringify(${oneLine})); localStorage.setItem('lug_slot_v1','1'); location.reload();</textarea>
  </div>
</div>
<script>
  var SAVE = ${oneLine};
  document.getElementById('toggle').onclick = function (e) {
    e.preventDefault();
    document.getElementById('manual').classList.toggle('hide');
    var t = document.getElementById('snip');
    if (!document.getElementById('manual').classList.contains('hide')) { t.focus(); t.select(); }
  };
  document.getElementById('go').onclick = function () {
    try {
      localStorage.setItem('lug_save_v1', JSON.stringify(SAVE));
      localStorage.setItem('lug_slot_v1', '1');
      location.href = '../docs/index.html';
    } catch (e) {
      document.getElementById('manual').classList.remove('hide');
      document.getElementById('msg').textContent = '写入失败：' + e.message + '（浏览器可能禁用了本地存储）';
      document.getElementById('msg').className = 'warn';
    }
  };
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'save', 'import.html'), importHtml, 'utf8');

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`已生成 ${path.relative(ROOT, out)} (${kb} KB)`);
console.log(`进度终点: oc=5e14 = MS[7]，第 10 关「完成」`);
console.log(`升级上限: spawn ${ordered.up.spawn} / max ${ordered.up.max} / rad ${ordered.up.rad} / boost ${ordered.up.boost} / dewb ${ordered.up.dewb}`);
