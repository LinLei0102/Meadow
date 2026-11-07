import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu','--hide-scrollbars'], defaultViewport:{width:390,height:844} });
const p = await b.newPage();
await p.evaluateOnNewDocument(()=>{ localStorage.setItem('lug_settings_v1', JSON.stringify({lang:'zh'})); sessionStorage.setItem('lug_skip','1'); });
await p.goto('file:///' + path.join(ROOT,'docs','index.html').replace(/\\/g,'/'), {waitUntil:'load'});
await new Promise(r=>setTimeout(r,3200));
const report = async (tag) => {
  const bad = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !e.getClientRects().length) return;
      const t = (e.textContent || '').trim();
      if (!t || e.children.length) return;
      if (e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll')
        out.push({ cls: e.className || e.tagName, txt: t.slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth });
    });
    return out;
  });
  console.log(`[${tag}] 溢出元素 ${bad.length}`);
  bad.slice(0, 10).forEach((x) => console.log('   ', JSON.stringify(x)));
};
await report('start');
await p.evaluate(()=>document.getElementById('bGear')?.click()); await new Promise(r=>setTimeout(r,800));
await report('settings');
await p.evaluate(()=>document.getElementById('bGear')?.click());
await p.evaluate(()=>document.getElementById('bMeadow')?.click()); await new Promise(r=>setTimeout(r,800));
await report('meadow');
await p.evaluate(()=>document.getElementById('bWater')?.click()); await new Promise(r=>setTimeout(r,800));
await report('water');
await b.close();
