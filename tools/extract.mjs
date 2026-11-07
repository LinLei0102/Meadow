import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2], 'utf8');
function grab(anchor) {
  const i = html.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + anchor);
  const start = html.indexOf('{', i + anchor.length - 1);
  let depth = 0, q = null, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return { src: html.slice(start, j + 1), at: start }; }
  }
}
const en = grab('var T = { en:');
const obj = eval('(' + en.src + ')');
const keys = Object.keys(obj);
console.log('en dict keys:', keys.length, ' at offset', en.at);
console.log('total chars:', en.src.length);
const lens = keys.map(k => (obj[k] || '').length).sort((a,b)=>b-a);
console.log('longest values:', lens.slice(0,5));
console.log('contains \\n:', keys.filter(k=>String(obj[k]).includes('\n')).length);
console.log('contains {n}:', keys.filter(k=>/\{\w+\}/.test(String(obj[k]))).length, keys.filter(k=>/\{\w+\}/.test(String(obj[k]))).join(','));
fs.writeFileSync(process.argv[3], JSON.stringify(obj, null, 2));
console.log('wrote', process.argv[3]);
