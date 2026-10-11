// ============================================================
// sampleModule.js —— 内置示例模块
//
// 这是一个"模块"的完整范例：一个自包含的 HTML 文件。
// 它展示了模块应该怎么写：
//   · 自带 CSS，不依赖外部文件
//   · 数据存在自己的 localStorage 里（每个模块的存储是隔离的）
//   · 适配手机屏幕
//
// 你可以把这个文件当成模板：复制一份，改掉 HTML 和 JS，就是一个新模块。
// ============================================================

export const SAMPLE_MODULE_NAME = '示例 · 简易记账';

export const SAMPLE_MODULE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>简易记账</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; padding: 16px 16px 40px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
  }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  .hint { font-size: 12px; color: #8A8A8E; margin-bottom: 16px; line-height: 1.6; }

  .card { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
  .total-label { font-size: 12px; color: #8A8A8E; }
  .total { font-size: 32px; font-weight: 700; color: #00BFA5; margin-top: 4px; }

  .input-row { display: flex; gap: 8px; }
  input {
    flex: 1; min-width: 0; height: 46px; padding: 0 14px;
    border: 1px solid #E6E6EA; border-radius: 12px;
    font-size: 16px; background: #FAFAFC; color: #1A1A1A;
  }
  input:focus { outline: none; border-color: #00BFA5; background: #fff; }
  button.add {
    height: 46px; padding: 0 20px; border: none; border-radius: 12px;
    background: #00BFA5; color: #fff; font-size: 16px; font-weight: 600;
  }
  button.add:active { opacity: .8; }

  ul { list-style: none; margin: 0; padding: 0; }
  li {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 0; border-bottom: 1px solid #F0F0F3; font-size: 15px;
  }
  li:last-child { border-bottom: none; }
  li .note { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li .amount { font-weight: 600; }
  li .date { font-size: 11px; color: #A0A0A6; }
  button.del {
    border: none; background: #FFF1F0; color: #FF4D4F;
    border-radius: 8px; padding: 6px 10px; font-size: 12px;
  }
  .empty { text-align: center; color: #B0B0B6; font-size: 14px; padding: 30px 0; }
</style>
</head>
<body>

  <h1>简易记账</h1>
  <div class="hint">
    这是一个示例模块：展示模块该怎么写。<br>
    数据存在模块自己的本地存储里，关掉再打开也不会丢。
  </div>

  <div class="card">
    <div class="total-label">合计支出</div>
    <div class="total" id="total">0.00</div>
  </div>

  <div class="card">
    <div class="input-row">
      <input id="note" type="text" placeholder="买了什么">
      <input id="amount" type="number" inputmode="decimal" placeholder="金额" style="max-width:110px">
    </div>
    <div style="height:10px"></div>
    <button class="add" id="addBtn" style="width:100%">记一笔</button>
  </div>

  <div class="card">
    <ul id="list"></ul>
  </div>

<script>
  var KEY = 'records';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render() {
    var list = load();
    var total = 0;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      total += list[i].amount;
      html += '<li>'
            +   '<span class="note">' + esc(list[i].note) + '</span>'
            +   '<span class="date">' + esc(list[i].date) + '</span>'
            +   '<span class="amount">' + list[i].amount.toFixed(2) + '</span>'
            +   '<button class="del" data-i="' + i + '">删</button>'
            + '</li>';
    }
    if (!html) { html = '<div class="empty">还没有记录，试着记一笔</div>'; }
    document.getElementById('list').innerHTML = html;
    document.getElementById('total').textContent = total.toFixed(2);
  }

  function todayStr() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  document.getElementById('addBtn').onclick = function () {
    var noteEl = document.getElementById('note');
    var amtEl = document.getElementById('amount');
    var note = (noteEl.value || '').trim();
    var amount = parseFloat(amtEl.value);

    if (!note) { alert('写点什么吧'); return; }
    if (isNaN(amount) || amount <= 0) { alert('金额要大于 0'); return; }

    var list = load();
    list.unshift({ note: note, amount: amount, date: todayStr() });
    save(list);

    noteEl.value = '';
    amtEl.value = '';
    render();
  };

  document.getElementById('list').onclick = function (e) {
    var btn = e.target.closest ? e.target.closest('.del') : null;
    if (!btn) return;
    var i = parseInt(btn.getAttribute('data-i'), 10);
    var list = load();
    list.splice(i, 1);
    save(list);
    render();
  };

  render();
</script>
</body>
</html>
`;
