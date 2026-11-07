/** 让游戏自己存一次档，dump 出真实的 localStorage 内容与序列化格式 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--lang=zh-CN'],
  defaultViewport: { width: 620, height: 1000 },
});
const p = await b.newPage();
await p.evaluateOnNewDocument(() => {
  localStorage.clear();
  localStorage.setItem('lug_settings_v1', JSON.stringify({ lang: 'zh' }));
});
await p.goto('file:///' + path.join(ROOT, 'docs', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2500));
// 点「开始游戏」
const clicked = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(e => /开始游戏|Play/.test(e.textContent));
  if (btn) { btn.click(); return btn.textContent.trim(); }
  return null;
});
console.log('clicked:', clicked);
await new Promise(r => setTimeout(r, 16000));
const dump = await p.evaluate(() => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    o[k] = localStorage.getItem(k);
  }
  return o;
});
for (const k of Object.keys(dump)) console.log(k, '=>', (dump[k] || '').slice(0, 900));
await b.close();
