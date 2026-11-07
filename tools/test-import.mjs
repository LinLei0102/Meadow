#!/usr/bin/env node
/**
 * 导入页的端到端验收：
 *   打开 save/import.html → 点「写入存档」→ 跳到游戏 → 存档生效、且不碰其它存档位。
 *
 * 用法: node tools/test-import.mjs
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--lang=zh-CN'],
  defaultViewport: { width: 620, height: 1000 },
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

// 预先放一个「第 2 号存档」，用来验证导入不会误删别的槽位
await page.evaluateOnNewDocument(() => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('lug_save_v1_s2', JSON.stringify({ v: 1, grass: '42' }));
    localStorage.setItem('lug_slot_v1', '2');
    sessionStorage.setItem('seeded', '1');
  }
});

await page.goto('file:///' + path.join(ROOT, 'save', 'import.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await page.click('#go');
await new Promise((r) => setTimeout(r, 1200));
await new Promise((r) => setTimeout(r, 2600));

const r = await page.evaluate(() => ({
  atGame: location.pathname.endsWith('/docs/index.html'),
  slot: localStorage.getItem('lug_slot_v1'),
  slot1: JSON.parse(localStorage.getItem('lug_save_v1') || 'null'),
  slot2: localStorage.getItem('lug_save_v1_s2'),
  cta: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).find((t) => /继续游戏|开始游戏/.test(t)),
}));

const ok = (c) => (c ? '✓' : '✗');
const correct = r.atGame && r.slot === '1' && r.slot1?.oc === '5e14' && r.cta === '继续游戏';
console.log(`${ok(r.atGame)} 跳转      ${r.atGame ? '已进入游戏页' : '未跳转'}`);
console.log(`${ok(r.slot === '1')} 槽位      当前槽位 = ${r.slot}`);
console.log(`${ok(r.slot1?.oc === '5e14')} 存档      第 1 槽 oc = ${r.slot1?.oc}，grass = ${r.slot1?.grass}`);
console.log(`${ok(!!r.slot2)} 保护      第 2 槽仍在（${r.slot2 ? '未受影响' : '被清空'}）`);
console.log(`${ok(r.cta === '继续游戏')} 菜单      ${r.cta}`);
console.log(`${ok(!errs.length)} 控制台    ${errs.length ? errs.join(' | ') : '无报错'}`);
await browser.close();
process.exit(correct && !errs.length && r.slot2 ? 0 : 1);
