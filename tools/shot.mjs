/**
 * 用本机 Edge 跑无头截图 + 收集控制台报错，用于验证中文补丁的实际渲染效果。
 * 用法: node tools/shot.mjs [目标文件] [输出目录]
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.argv[2] || path.join(ROOT, 'docs', 'index.html');
const OUTDIR = process.argv[3] || path.join(ROOT, 'shots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

fs.mkdirSync(OUTDIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=zh-CN'],
  defaultViewport: { width: 620, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('file:///' + TARGET.replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 3500));

const shot = async (name) => {
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUTDIR, name + '.png') });
  console.log('  shot ->', name + '.png');
};

const clickText = async (text) => {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, .opt, .nb, .mk, div')];
    const el = els.find((e) => e.textContent.trim() === t && e.getBoundingClientRect().width > 0);
    if (!el) return false;
    el.click();
    return true;
  }, text);
  console.log(`  click "${text}" -> ${ok}`);
  return ok;
};

console.log('lang =', await page.evaluate(() => document.documentElement.lang));
await shot('01-start');

// 开始游戏
if (await clickText('开始游戏')) await shot('02-menu');

// 打开设置
await page.evaluate(() => document.getElementById('bGear')?.click());
await shot('03-settings');

// 语言分组所在位置截图
await page.evaluate(() => {
  const lab = [...document.querySelectorAll('#sset .slab')].find((e) => e.dataset.k === 'lang');
  lab?.scrollIntoView({ block: 'center' });
});
await shot('04-settings-lang');

// 关闭设置，进草地主界面
await page.evaluate(() => document.getElementById('bGear')?.click());
await page.evaluate(() => document.getElementById('bMeadow')?.click());
await shot('05-meadow');

// 水 / 地球页
await page.evaluate(() => document.getElementById('bWater')?.click());
await shot('06-water');

// 统计面板
await page.evaluate(() => document.getElementById('bStat')?.click());
await shot('07-stats');

const state = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  sample: [...document.querySelectorAll('.slab, .up .n, .up .e')].slice(0, 14).map((e) => e.textContent.trim()),
}));
console.log('\nDOM 抽样:', JSON.stringify(state.sample, null, 0));
console.log('\n控制台错误:', errors.length ? errors.slice(0, 12) : '无');

await browser.close();
