import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] || 'zh';
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 620, height: 1000, deviceScaleFactor: 3 },
});
const p = await b.newPage();
await p.evaluateOnNewDocument((l) => localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: l })), lang);
await p.goto('file:///' + path.join(ROOT, 'docs', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2600));
const box = await p.evaluate(() => {
  const e = document.querySelector('.sttl');
  const r = e.getBoundingClientRect();
  return { x: r.x - 20, y: r.y - 20, width: r.width + 40, height: r.height + 40 };
});
await p.screenshot({ path: path.join(ROOT, 'shots', `logo-${lang}.png`), clip: box });
console.log('box', JSON.stringify(box));
await b.close();
