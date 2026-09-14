/* 临时全量校验：JSON 合法性 + JS 语法 + 品牌字样零残留（用后即删） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = __dirname;
let bad = 0;
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');

function walk(dir, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((it) => {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

let files = walk(path.join(root, 'miniprogram'));
fs.readdirSync(root, { withFileTypes: true }).forEach((it) => {
  if (it.isFile() && /\.(md|html|json)$/.test(it.name)) files.push(path.join(root, it.name));
});

// 1) JSON 合法性
files.filter((f) => f.endsWith('.json')).forEach((f) => {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
    console.log('JSON OK  ' + rel(f));
  } catch (e) {
    bad++;
    console.log('JSON BAD ' + rel(f) + ' -> ' + e.message);
  }
});

// 2) JS 语法
files.filter((f) => f.endsWith('.js') && rel(f).indexOf('miniprogram/') === 0).forEach((f) => {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('JS OK   ' + rel(f));
  } catch (e) {
    bad++;
    console.log('JS BAD  ' + rel(f));
  }
});

// 3) 品牌字样零残留（No.2 / 2号），排除临时脚本自身
const pats = [/No\.2/, /2号/];
files.filter((f) => /\.(js|json|wxml|wxss|md|html)$/.test(f) && f.indexOf('.tmp.js') < 0).forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  pats.forEach((p) => {
    if (p.test(s)) {
      bad++;
      console.log('RESIDUE ' + p + ' in ' + rel(f));
    }
  });
});

console.log(bad === 0 ? 'ALL GOOD' : 'FOUND ' + bad + ' PROBLEM(S)');
process.exit(bad === 0 ? 0 : 1);
