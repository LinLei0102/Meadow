/**
 * 中文完整性审计：在 zh 语言下走遍所有界面（主菜单 / 存档列表 / 草地 / 水体 /
 * 地球 / 海洋升级 / 统计 / 设置 / 更新日志），收集可见文本与无障碍名，
 * 报告仍然以英文单词呈现的片段（即漏译）。退出码 1 表示有漏译，可直接接 CI。
 *
 * 用法：node tools/audit-zh.mjs [--verbose]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = 'file:///' + path.join(ROOT, 'docs', 'index.html').replace(/\\/g, '/');

/**
 * 允许保留的英文单词：游戏名、单位、数字缩写、数学记号、专有名词。
 * 只匹配「3 个字母以上」的单词，因此 1.00Sp / 500K / x125Qi / Lv / 250 ms 这类
 * 数字+短后缀天然不会命中。
 */
const ALLOW_WORDS = new Set([
  'Meadow', 'Alpha', 'FPS', 'base', 'log', 'km', 'ms', 'English',
  // 结尾卡里提到的原作名
  'Grass', 'Cutting', 'Incremental',
]);

const raw = fs.readFileSync(path.join(ROOT, 'save', 'perfect.json'), 'utf8');

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=zh-CN'],
  defaultViewport: { width: 620, height: 1200 },
});
const errs = [];
const findings = new Map(); // 文本 -> 出现界面集合

const dumpText = (page) =>
  page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
      if (!e.getClientRects().length) return;
      const own = [...e.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' ');
      const t = own.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
      for (const a of e.attributes || []) {
        if (a.name === 'aria-label' || a.name === 'title' || a.name === 'placeholder')
          if (a.value.trim()) out.push(a.value.trim());
      }
    });
    return [...new Set(out)];
  });

const collect = async (page, screen) => {
  const items = await dumpText(page);
  for (const t of items) {
    // 先剥掉「数字 + 短后缀」这类数值缩写（1.00Sp / 22.1SpDc / 500K / 250 ms）
    const bare = t.replace(/\b\d[\d.,]*\s*[A-Za-z]{1,4}\b/g, ' ');
    const words = bare.match(/[A-Za-z]{3,}/g) || [];
    const bad = words.filter((w) => !ALLOW_WORDS.has(w));
    if (!bad.length) continue;
    if (!findings.has(t)) findings.set(t, new Set());
    findings.get(t).add(screen);
  }
  if (VERBOSE) console.log(`  [${screen}] ${items.length} 条`);
};

const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const clickId = async (page, id) => {
  const ok = await page.evaluate((i) => {
    const e = document.getElementById(i);
    if (!e || e.offsetParent === null) return false;
    e.click();
    return true;
  }, id);
  await settle();
  return ok;
};

// ── 一、主菜单 + 存档列表（带完美存档，才有统计卡内容）──
const menuPage = await browser.newPage();
menuPage.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await menuPage.evaluateOnNewDocument((json) => {
  localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: 'zh' }));
  localStorage.setItem('lug_save_v1', JSON.stringify(JSON.parse(json)));
}, raw);
await menuPage.goto(PAGE, { waitUntil: 'load' });
await settle(2600);
await collect(menuPage, '主菜单');

const openedSave = await menuPage.evaluate(() => {
  // 注意：设置面板里也有含「存档」字样的按钮，但它们此时是隐藏的，
  // 所以必须先按可见性过滤再匹配，否则会点到一个点不动的元素。
  const b = [...document.querySelectorAll('button')]
    .filter((e) => e.offsetParent !== null)
    .find((e) => /存档|读档|Загруз|Save|Load/i.test(e.textContent || ''));
  if (b && b.offsetParent !== null) { b.click(); return b.textContent.trim().slice(0, 12); }
  return null;
});
if (openedSave) {
  await settle(900);
  await collect(menuPage, '存档列表');
  if (VERBOSE) console.log('  已打开存档列表：' + openedSave);
}
await menuPage.close();

// ── 二、游戏内各页 ──
const page = await browser.newPage();
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.evaluateOnNewDocument((json) => {
  localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: 'zh' }));
  localStorage.setItem('lug_save_v1', JSON.stringify(JSON.parse(json)));
  sessionStorage.setItem('lug_skip', '1');
}, raw);
await page.goto(PAGE, { waitUntil: 'load' });
await settle(3000);

await collect(page, '草地');
for (const [nav, name] of [
  ['bWater', '水体'],
  ['bEarth', '地球'],
  ['bStat', '统计'],
  ['bGear', '设置'],
]) {
  if (await clickId(page, nav)) await collect(page, name);
}

// 海洋升级面板：地球页右侧箭头展开（需龙卷风 ≥ 4）
await clickId(page, 'bEarth');
const openedOcean = await page.evaluate(() => {
  const b = document.querySelector('.lfar.r');
  if (b && getComputedStyle(b).display !== 'none') { b.click(); return true; }
  return false;
});
if (openedOcean) {
  await settle(900);
  await collect(page, '海洋升级');
  if (VERBOSE) console.log('  已展开海洋升级面板');
} else if (VERBOSE) console.log('  ! 海洋升级入口未出现（龙卷风等级不足？）');

// 更新日志
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((e) => /更新日志/.test(e.textContent || ''));
  if (b) b.click();
});
await settle(900);
await collect(page, '更新日志');

// ── 报告 ──
console.log(`\n漏译片段 ${findings.size} 条：`);
for (const [t, screens] of [...findings].sort((a, b) =>
  [...a[1]][0].localeCompare([...b[1]][0])
))
  console.log(`  [${[...screens].join('/')}] ${t.slice(0, 110)}`);
if (errs.length) console.log('\n控制台报错：', errs.slice(0, 5));
await browser.close();
process.exit(findings.size ? 1 : 0);
