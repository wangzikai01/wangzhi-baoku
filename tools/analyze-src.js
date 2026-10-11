// 分析题库里的"来源"标记，看看目录该怎么分
const fs = require('fs');
const src = fs.readFileSync('src/data/examBank.js', 'utf8');
const m = src.match(/export const EXAM_BANK = ([\s\S]*);\s*$/);
const bank = JSON.parse(m[1]);
const rows = bank.split('\n').filter(Boolean);

console.log('总题数: ' + rows.length);

const full = {};   // 完整来源（含题号）
const group = {};  // 去掉末尾题号后的分组
let noSrc = 0;
const samples = [];

for (const r of rows) {
  const p = r.split('\u0001');
  const sm = p[1].match(/^\d+\.\s*[（(]([^）)]+)[）)]/);
  if (!sm) { noSrc++; if (samples.length < 5) samples.push(p[1].substring(0, 50)); continue; }
  const s = sm[1].trim();
  full[s] = (full[s] || 0) + 1;
  const g = s.replace(/\s*\d+\s*$/, '').trim();
  group[g] = (group[g] || 0) + 1;
}

console.log('没有来源标记的: ' + noSrc);
if (samples.length) samples.forEach((s) => console.log('   例: ' + s));

const gk = Object.keys(group).sort((a, b) => group[b] - group[a]);
console.log('\n分组数: ' + gk.length + '（去掉了末尾题号）');
console.log('前 30 个分组:');
gk.slice(0, 30).forEach((k) => console.log('   ' + k + '  →  ' + group[k] + ' 题'));

const fk = Object.keys(full);
console.log('\n完整来源数: ' + fk.length);
console.log('前 15 个完整来源:');
fk.slice(0, 15).forEach((k) => console.log('   ' + k));

// 按年份看看
const years = {};
for (const k of gk) {
  const ym = k.match(/(19|20)\d{2}/);
  const y = ym ? ym[0] : '无年份';
  years[y] = (years[y] || 0) + group[k];
}
console.log('\n按年份: ' + JSON.stringify(years));
