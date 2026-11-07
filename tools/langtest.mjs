/**
 * 语言回归测试：分别以 zh / en / ru 启动，检查界面语言是否正确、是否互相污染。
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'docs', 'index.html');
const OUTDIR = path.join(ROOT, 'shots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(OUTDIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 620, height: 1000 },
});

const sample = async (lang) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((l) => {
    localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: l, not: 'mix', st: '0' }));
    sessionStorage.setItem('lug_skip', '1');
  }, lang);
  await page.goto('file:///' + TARGET.replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 3000));
  // 进入游戏
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => /Play|Играть|开始游戏/.test(e.textContent));
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUTDIR, `lang-${lang}.png`) });
  const s = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.getElementById('sub')?.textContent,
    up1: document.querySelector('.up .n')?.textContent,
    buy: document.querySelector('.up.opt .n')?.textContent,
    slabs: [...document.querySelectorAll('#sset .slab')].map((e) => e.textContent).slice(0, 3),
  }));
  console.log(lang, '=>', JSON.stringify(s), errors.length ? 'ERR:' + errors[0] : '');
  await page.close();
};

for (const l of ['zh', 'en', 'ru']) await sample(l);
await browser.close();
