#!/usr/bin/env node
/**
 * 毕业存档的验收脚本。
 *
 * 做四件事：
 *   1. 把 save/perfect.json 注入 localStorage，加载游戏
 *   2. 断言：进度到「#10 - 完成」、所有升级显示满级、最终导航（地球）出现、无报错
 *   3. 逐页截图到 shots/save-*.png
 *   4. 等一次自动存档，比对回写内容（只允许 steam / rcAt 这类活字段变化）
 *
 * 用法: node tools/verify-save.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const raw = fs.readFileSync(path.join(ROOT, 'save', 'perfect.json'), 'utf8');
const WANT = JSON.parse(raw);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=zh-CN'],
  defaultViewport: { width: 620, height: 1200 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.evaluateOnNewDocument((json) => {
  localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: 'zh' }));
  localStorage.setItem('lug_save_v1', JSON.stringify(JSON.parse(json)));
  sessionStorage.setItem('lug_skip', '1');
}, raw);

await page.goto('file:///' + path.join(ROOT, 'docs', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 3200));

/** 在指定页面上统计升级按钮的满级情况 */
const countUps = async (nav) => {
  if (nav) await page.evaluate((id) => document.getElementById(id)?.click(), nav);
  await new Promise((r) => setTimeout(r, 800));
  return page.evaluate(() => {
    const txt = (e) => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const ups = [...document.querySelectorAll('button.up')]
      .filter((e) => e.offsetParent !== null && txt(e) && !/^买|重置|开始下雨/.test(txt(e)));
    return {
      total: ups.length,
      maxed: ups.filter((e) => /满级|MAX/.test(txt(e))).length,
      left: ups.filter((e) => !/满级|MAX/.test(txt(e))).map((e) => txt(e).slice(0, 30)),
    };
  });
};
const meadow = await countUps('bMeadow');
// 进度条在草地页上，必须在切走之前读
const progress = await page.evaluate(() => (document.querySelector('#ptxt2')?.innerText || '').trim());
const water = await countUps('bWater');
const state = {
  progress,
  earthNav: await page.evaluate(() => !!document.querySelector('#bEarth')),
  ups: meadow.total + water.total,
  upMaxed: meadow.maxed + water.maxed,
  notMaxed: [...meadow.left, ...water.left],
  detail: `草地 ${meadow.maxed}/${meadow.total} · 水体 ${water.maxed}/${water.total}`,
};


const shot = async (nav, name) => {
  if (nav) await page.evaluate((id) => document.getElementById(id)?.click(), nav);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(ROOT, 'shots', `save-${name}.png`) });
};
await shot(null, 'meadow');
await shot('bWater', 'water');
await shot('bEarth', 'earth');
await shot('bStat', 'stats');

// 回写一致性（活字段允许变化）
await new Promise((r) => setTimeout(r, 11000));
const back = JSON.parse(await page.evaluate(() => localStorage.getItem('lug_save_v1')));
const LIVE = new Set(['steam', 'rcAt', 'grass', 'total', 'dewXP', 'dewLv', 'water', 'rc']);
const drift = [];
for (const k of Object.keys(WANT)) {
  if (LIVE.has(k)) continue;
  const a = WANT[k], b = back[k];
  // Decimal 字段序列化形式会变（5e14 ↔ 500000000000000），按数值比
  const na = Number(a), nb = Number(b);
  const same = Number.isFinite(na) && Number.isFinite(nb)
    ? Math.abs(na - nb) <= Math.abs(na) * 1e-12
    : JSON.stringify(a) === JSON.stringify(b);
  if (!same) drift.push(`${k}: ${a} → ${b}`);
}

const ok = (c) => (c ? '✓' : '✗');
console.log(`${ok(/完成/.test(state.progress) && /10/.test(state.progress))} 进度      ${state.progress}`);
console.log(`${ok(state.ups > 0 && state.upMaxed === state.ups)} 升级满级  ${state.upMaxed}/${state.ups}（${state.detail}）${state.notMaxed.length ? '  未满: ' + state.notMaxed.join(' | ') : ''}`);
console.log(`${ok(state.earthNav)} 最终导航  地球页${state.earthNav ? '已出现' : '缺失'}`);
console.log(`${ok(!drift.length)} 回写一致  ${drift.length ? drift.join('; ') : '除活字段外无变化'}`);
console.log(`${ok(!errs.length)} 控制台    ${errs.length ? errs.slice(0, 3).join(' | ') : '无报错'}`);
await browser.close();
process.exit(state.upMaxed === state.ups && !errs.length && !drift.length ? 0 : 1);
