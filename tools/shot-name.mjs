/** 译名与标题专项截图：zh / en 各一张启动页，并打印 document.title */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 620, height: 1000 },
});
for (const lang of ['zh', 'en']) {
  const p = await b.newPage();
  await p.evaluateOnNewDocument((l) => localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: l })), lang);
  await p.goto('file:///' + path.join(ROOT, 'docs', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2600));
  console.log(lang, '| title:', await p.title(), '| html.lang:', await p.evaluate(() => document.documentElement.lang));
  await p.screenshot({ path: path.join(OUT, `name-${lang}.png`) });
  await p.close();
}
await b.close();
