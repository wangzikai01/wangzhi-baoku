// 解析导出的题库文本，检查异常，并生成 App 用的紧凑数据
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '');

const blocks = [];
let cur = null;

for (const line of lines) {
  let m;
  if ((m = line.match(/^【题(\d+)】\s*(.*)$/))) {
    if (cur) blocks.push(cur);
    cur = { no: +m[1], head: [], answer: '', explain: [], stage: 'head' };
    if (m[2]) cur.head.push(m[2]);
    continue;
  }
  if (!cur) continue;

  if ((m = line.match(/^【答(\d+)】\s*(.*)$/))) {
    cur.stage = 'ans';
    const am = m[2].match(/【答案】\s*([A-Za-z]+)/);
    if (am) cur.answer = am[1].toUpperCase();
    continue;
  }
  if (/^【解析】/.test(line)) {
    cur.stage = 'exp';
    const t = line.replace(/^【解析】\s*/, '');
    if (t) cur.explain.push(t);
    continue;
  }
  if (cur.stage === 'exp') { cur.explain.push(line); continue; }

  if (cur.stage === 'ans') {
    const am = line.match(/【答案】\s*([A-Za-z]+)/);
    if (am) { cur.answer = am[1].toUpperCase(); continue; }
    // 没有【解析】标记，直接就是解析正文
    cur.stage = 'exp';
    cur.explain.push(line);
    continue;
  }

  cur.head.push(line);
}
if (cur) blocks.push(cur);

// 把 head 拆成 题干 + 选项
const LETTERS = 'ABCDEF';
const bad = [];
for (const b of blocks) {
  b.opts = [];
  b.stem = [];
  let started = false;
  for (const line of b.head) {
    const om = line.match(/^([A-F])[.、．)）]\s*(.*)$/);
    if (om) {
      started = true;
      b.opts.push({ k: LETTERS.indexOf(om[1]), text: om[2].trim() });
    } else if (started && b.opts.length) {
      b.opts[b.opts.length - 1].text += line;   // 选项续行，直接接上
    } else {
      b.stem.push(line);
    }
  }
  b.stemText = b.stem.join('');

  if (b.opts.length !== 4 || !b.answer || !b.stemText) {
    bad.push(b);
  }
}

console.log('总题数: ' + blocks.length);
console.log('答案字母分布: ' + JSON.stringify(
  blocks.reduce((a, b) => { a[b.answer || '?'] = (a[b.answer || '?'] || 0) + 1; return a; }, {})
));
console.log('每题选项数分布: ' + JSON.stringify(
  blocks.reduce((a, b) => { a[b.opts.length] = (a[b.opts.length] || 0) + 1; return a; }, {})
));
console.log('题干为空的: ' + blocks.filter((b) => !b.stemText).length);
console.log('没有解析的: ' + blocks.filter((b) => b.explain.length === 0).length);
console.log('异常的题: ' + bad.length);

if (process.argv[3] === '--show') {
  for (const b of bad.slice(0, 8)) {
    console.log('\n───── 题 ' + b.no + ' ─────');
    console.log('题干: ' + b.stemText.substring(0, 80));
    console.log('选项数: ' + b.opts.length + '  ' + JSON.stringify(b.opts.map((o) => o.text.substring(0, 20))));
    console.log('答案: [' + b.answer + ']');
    console.log('原始 head 前几行:');
    b.head.slice(0, 8).forEach((l) => console.log('    ' + l.substring(0, 70)));
  }
}

if (process.argv[3] === '--gen') {
  // 只保留"选项 ≥2 个且正确答案在选项里"的题
  const usable = blocks.filter((b) => {
    if (!b.stemText || b.opts.length < 2) return false;
    return b.opts.map((o) => LETTERS[o.k]).indexOf(b.answer) >= 0;
  });
  const skipped = blocks.filter((b) => usable.indexOf(b) < 0);

  // 紧凑格式：字段用 \u0001 隔开，选项之间用 \u0002，题目之间用换行
  const rows = usable.map((b) => [
    b.no,
    b.stemText,
    b.opts.map((o) => LETTERS[o.k] + '.' + o.text).join('\u0002'),
    b.answer,
    b.explain.join('').replace(/\s+/g, ' '),
  ].join('\u0001'));

  const payload = rows.join('\n');
  const js = '// 自动生成，不要手改。源：行测5000题·政治理论与常识判断（' + usable.length + ' 题）\n'
    + '// 字段分隔 \\u0001，选项分隔 \\u0002，题目分隔 \\n\n'
    + 'export const EXAM_BANK = '
    + JSON.stringify(payload)
    + ';\n';

  const dst = process.argv[4];
  fs.writeFileSync(dst, js, 'utf8');
  console.log('\n已生成: ' + dst);
  console.log('可用题目: ' + usable.length);
  console.log('跳过题目: ' + skipped.length + '（题号 ' + skipped.slice(0, 20).map((b) => b.no).join(', ')
    + (skipped.length > 20 ? ' …' : '') + '）');
  console.log('文件大小: ' + (fs.statSync(dst).size / 1024).toFixed(0) + ' KB');

  const sample = usable[0];
  console.log('\n第一条解出来的样子：');
  console.log('  题号: ' + sample.no);
  console.log('  题干: ' + sample.stemText.substring(0, 60) + '…');
  sample.opts.forEach((o) => console.log('    ' + LETTERS[o.k] + '. ' + o.text.substring(0, 40)));
  console.log('  答案: ' + sample.answer);
  console.log('  解析: ' + sample.explain.join('').substring(0, 60) + '…');
}
