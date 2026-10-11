// ============================================================
// examModule.js —— 「考公答题」模块
//
// 题库来自 examBank.js（由 tools/parse-exam.js 从 docx 自动生成）
//
// 【答题流程】
//   打开 → 出现一道"还没答过"的题（按题号顺序）
//   → 点选项 → 对了变绿、错了变红（同时把正确答案也标绿）
//   → 下面出现解析 + 「下一题」
//
// 【三个页面】
//   答题   当前这道题
//   历史   答过的题，从新到旧；点一条可以回去看
//   错题   答错的题合集，可以"只重做错题"
// ============================================================

import { EXAM_BANK } from './examBank';

export const EXAM_MODULE_NAME = '考公答题';

// 把题库字符串塞进 HTML 里。
// 注意：要把 </ 转义一下，免得数据里万一出现 </script> 把页面截断。
const BANK_JSON = JSON.stringify(EXAM_BANK).replace(/<\//g, '<\\/');

export const EXAM_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>考公答题</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 40px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
  }
  button { font-family: inherit; }
  .screen { display: none; }
  .screen.on { display: block; }

  /* ---------- 顶栏 ---------- */
  .topbar {
    position: sticky; top: 0; z-index: 30;
    background: #FFFFFF; border-bottom: 1px solid #EFEFF3;
    padding: 13px 14px 0;
  }
  .tb-row { display: flex; align-items: center; gap: 8px; }
  .tb-title { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
  .tb-sp { flex: 1; }
  .tb-badge {
    font-size: 12px; color: #6B6B73; background: #F2F3F5;
    border-radius: 8px; padding: 5px 9px;
  }
  .tb-badge b { color: #00A38C; }

  .tabs { display: flex; gap: 6px; margin-top: 11px; padding-bottom: 11px; }
  .tab {
    flex: 1; height: 38px; border: none; border-radius: 10px;
    background: #F2F3F5; color: #5A5A63;
    font-size: 13px; font-weight: 700;
  }
  .tab.on { background: #00BFA5; color: #FFFFFF; }
  .tab:active { opacity: .8; }

  /* ---------- 通用 ---------- */
  .pad { padding: 14px; }
  .card {
    background: #FFFFFF; border-radius: 16px;
    padding: 18px; margin-bottom: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .empty {
    text-align: center; padding: 54px 30px; color: #A8A8B0;
    font-size: 14px; line-height: 2.1;
  }
  .empty .big { font-size: 42px; display: block; margin-bottom: 12px; opacity: .5; }

  /* ---------- 统计条 ---------- */
  .stats { display: flex; background: #FFFFFF; border-radius: 14px; padding: 14px 0; margin-bottom: 12px; }
  .stats > div { flex: 1; text-align: center; min-width: 0; }
  .stats > div + div { border-left: 1px solid #F2F2F5; }
  .stats .n { font-size: 20px; font-weight: 800; color: #00A38C; letter-spacing: -.5px; }
  .stats .n.gray { color: #6B6B73; }
  .stats .n.red { color: #E23B3B; }
  .stats .l { font-size: 11px; color: #8A8A8E; margin-top: 5px; }

  /* ---------- 答题 ---------- */
  .q-head {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: #8A8A8E; margin-bottom: 12px;
  }
  .q-head .sp { flex: 1; }
  .q-head .chip {
    background: #EAF7F5; color: #00A38C; border-radius: 7px;
    padding: 3px 8px; font-weight: 700;
  }
  .stem {
    font-size: 16px; line-height: 1.95; color: #1A1A1A;
    letter-spacing: .3px; margin-bottom: 18px;
    word-break: break-word;
  }

  .opt {
    display: flex; align-items: flex-start; gap: 11px;
    width: 100%; text-align: left;
    background: #F7F8FA; border: 1.5px solid transparent;
    border-radius: 13px; padding: 14px;
    margin-bottom: 10px; font-size: 15px; line-height: 1.7;
    color: #1A1A1A;
  }
  .opt .letter {
    width: 26px; height: 26px; flex: 0 0 26px; border-radius: 8px;
    background: #FFFFFF; color: #6B6B73;
    font-size: 14px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid #E4E6EA;
  }
  .opt .otext { flex: 1; min-width: 0; }
  .opt:active { background: #EFF1F4; }

  .opt.right { background: #E3F8F4; border-color: #00BFA5; }
  .opt.right .letter { background: #00BFA5; color: #FFFFFF; border-color: #00BFA5; }
  .opt.wrong { background: #FFEFF0; border-color: #E23B3B; }
  .opt.wrong .letter { background: #E23B3B; color: #FFFFFF; border-color: #E23B3B; }
  .opt.locked { opacity: .62; }

  /* 判定条 */
  .verdict {
    display: flex; align-items: center; gap: 9px;
    padding: 13px 15px; border-radius: 12px;
    font-size: 15px; font-weight: 700; margin-bottom: 12px;
  }
  .verdict.ok { background: #E3F8F4; color: #00A38C; }
  .verdict.no { background: #FFEFF0; color: #D93B3B; }
  .verdict .big { font-size: 19px; }

  /* 解析 */
  .exp-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; color: #8C8C94; letter-spacing: 3px;
    margin: 4px 0 12px;
  }
  .exp-title .ln { flex: 1; height: 1px; background: #EDEEF1; }
  .exp {
    font-size: 14px; line-height: 2; color: #4A4A52;
    letter-spacing: .2px; white-space: pre-wrap; word-break: break-word;
  }

  .big-btn {
    display: block; width: 100%; height: 52px; margin-top: 18px;
    border: none; border-radius: 14px;
    background: #00BFA5; color: #FFFFFF;
    font-size: 17px; font-weight: 800; letter-spacing: 2px;
  }
  .big-btn:active { opacity: .85; }
  .big-btn.ghost { background: #F2F3F5; color: #3A3A42; }
  .big-btn.ghost:active { background: #E8EAEE; }

  /* ---------- 列表行 ---------- */
  .row {
    display: flex; align-items: flex-start; gap: 11px;
    width: 100%; text-align: left;
    background: #FFFFFF; border-radius: 13px;
    padding: 14px; margin-bottom: 9px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
    border: none;
  }
  .row:active { background: #FAFAFC; }
  .row .badge {
    width: 24px; height: 24px; flex: 0 0 24px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800; color: #FFFFFF;
  }
  .row .badge.ok { background: #00BFA5; }
  .row .badge.no { background: #E23B3B; }
  .row .mid { flex: 1; min-width: 0; }
  .row .t1 {
    display: block;
    font-size: 14px; font-weight: 700; color: #1A1A1A;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row .t2 {
    display: block;
    font-size: 12px; color: #8A8A8E; margin-top: 5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row .t2 .bad { color: #E23B3B; font-weight: 700; }
  .row .t2 .good { color: #00A38C; font-weight: 700; }

  .list-title {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: #8A8A8E; margin: 4px 2px 12px;
  }
  .list-title .sp { flex: 1; }
  .mini {
    border: 1px solid #E4E6EA; background: #FFFFFF; color: #6B6B73;
    border-radius: 9px; padding: 7px 12px; font-size: 12px; font-weight: 700;
  }
  .mini.red { border-color: rgba(226,59,59,.35); color: #E23B3B; }

  /* ---------- 目录 ---------- */
  .toc-h {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: #8A8A8E; margin: 6px 2px 12px;
  }
  .toc-h .ln { flex: 1; height: 1px; background: #E8EAEE; }
  .toc-h b { color: #00A38C; }

  .chips { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 24px; }
  .chips.nowrap { flex-wrap: nowrap; gap: 7px; }
  .chips.nowrap .chip { min-width: 0; flex: 1; padding: 11px 4px; }
  .chip {
    border: 1px solid #E4E6EA; background: #FFFFFF; color: #3A3A42;
    border-radius: 11px; padding: 11px 10px;
    font-size: 14px; font-weight: 700; min-width: 98px;
    text-align: center;
  }
  .chip small { display: block; font-size: 10px; font-weight: 500; color: #A0A0A6; margin-top: 4px; }
  .chip.full { background: #E3F8F4; border-color: rgba(0,191,165,.4); color: #00A38C; }
  .chip.full small { color: #00A38C; }
  .chip:active { background: #F2F3F5; }

  .src-row {
    display: block; width: 100%; text-align: left;
    background: #FFFFFF; border-radius: 12px;
    padding: 13px 14px; margin-bottom: 8px;
    border: none; box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .src-row:active { background: #FAFAFC; }
  .src-top { display: flex; align-items: baseline; gap: 10px; }
  .src-top .nm { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; }
  .src-top .ct { font-size: 12px; color: #8A8A8E; white-space: nowrap; }
  .src-top .ct b { color: #00A38C; }
  .src-bar { height: 4px; border-radius: 99px; background: #F1F2F5; margin-top: 8px; overflow: hidden; }
  .src-bar i { display: block; height: 100%; background: #00BFA5; border-radius: 99px; }

  /* 题号网格 */
  .numgrid {
    display: grid; grid-template-columns: repeat(10, 1fr);
    gap: 5px; margin-bottom: 26px;
  }
  .numcell {
    height: 38px; padding: 0;
    border: 1px solid #E8EAEE; background: #FFFFFF;
    border-radius: 8px; font-size: 12px; font-weight: 700; color: #5A5A63;
  }
  .numcell.ok { background: #E3F8F4; border-color: rgba(0,191,165,.35); color: #00A38C; }
  .numcell.no { background: #FFEFF0; border-color: rgba(226,59,59,.3); color: #E23B3B; }
  .numcell:active { background: #F2F3F5; }

  /* 本轮小结 */
  .round-box { text-align: center; padding: 8px 0 4px; }
  .round-box .em { font-size: 46px; }
  .round-box .tt { font-size: 20px; font-weight: 800; margin-top: 10px; }
  .round-box .sc { font-size: 14px; color: #8A8A8E; margin-top: 12px; line-height: 2; }
  .round-box .sc b { color: #00A38C; font-size: 18px; }
  .round-box .sc b.red { color: #E23B3B; }
</style>
</head>
<body>

  <!-- ============ 答题 ============ -->
  <div class="screen on" id="scr-quiz">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">考公答题</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="quizBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab on" data-go="quiz">答题</button>
        <button class="tab" data-go="hist">历史</button>
        <button class="tab" data-go="wrong">错题</button>
        <button class="tab" data-go="toc">目录</button>
      </div>
    </div>
    <div class="pad" id="quizBody"></div>
  </div>

  <!-- ============ 历史 ============ -->
  <div class="screen" id="scr-hist">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">答题历史</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="histBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab" data-go="quiz">答题</button>
        <button class="tab on" data-go="hist">历史</button>
        <button class="tab" data-go="wrong">错题</button>
        <button class="tab" data-go="toc">目录</button>
      </div>
    </div>
    <div class="pad" id="histBody"></div>
  </div>

  <!-- ============ 错题 ============ -->
  <div class="screen" id="scr-wrong">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">错题本</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="wrongBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab" data-go="quiz">答题</button>
        <button class="tab" data-go="hist">历史</button>
        <button class="tab on" data-go="wrong">错题</button>
      </div>
    </div>
    <div class="pad" id="wrongBody"></div>
  </div>

  <!-- ============ 目录 ============ -->
  <div class="screen" id="scr-toc">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">目录</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="tocBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab" data-go="quiz">答题</button>
        <button class="tab" data-go="hist">历史</button>
        <button class="tab" data-go="wrong">错题</button>
        <button class="tab on" data-go="toc">目录</button>
      </div>
    </div>
    <div class="pad" id="tocBody"></div>
  </div>

<script>
  var BANK_RAW = ${BANK_JSON};

  // ============================================================
  //  题库
  // ============================================================
  var QS = [];          // 全部题目
  var BY_NO = {};       // 题号 → 题目

  function parseBank() {
    var out = [];
    if (!BANK_RAW) return out;
    var lines = BANK_RAW.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].split('\u0001');
      if (p.length < 5) continue;
      var raw = p[2].split('\u0002');
      var opts = [];
      for (var j = 0; j < raw.length; j++) {
        if (raw[j].length < 2) continue;
        opts.push({ k: raw[j].charAt(0), text: raw[j].slice(2) });
      }
      if (opts.length < 2) continue;
      out.push({
        ord: out.length + 1,        // 第几题（1 开始，跳过的不算）
        no: parseInt(p[0], 10),     // 原文档里的题号
        stem: p[1],
        opts: opts,
        ans: p[3].charAt(0),
        exp: p[4] || ''
      });
    }
    return out;
  }

  // ============================================================
  //  存储
  // ============================================================
  var KEY_HIST = 'kg-hist-v1';
  var hist = {};        // { 题号: [选了哪个, 对不对(0/1), 时间戳] }

  function loadHist() {
    try { hist = JSON.parse(localStorage.getItem(KEY_HIST) || '{}') || {}; }
    catch (e) { hist = {}; }
  }
  function saveHist() {
    try { localStorage.setItem(KEY_HIST, JSON.stringify(hist)); } catch (e) {}
  }

  function answeredCount() {
    var n = 0;
    for (var k in hist) if (hist.hasOwnProperty(k)) n++;
    return n;
  }
  function rightCount() {
    var n = 0;
    for (var k in hist) if (hist.hasOwnProperty(k) && hist[k][1]) n++;
    return n;
  }
  function wrongNos() {
    var out = [];
    for (var k in hist) if (hist.hasOwnProperty(k) && !hist[k][1]) out.push(parseInt(k, 10));
    out.sort(function (a, b) { return b - a; });
    return out;
  }
  function histNos() {
    var out = [];
    for (var k in hist) if (hist.hasOwnProperty(k)) out.push(parseInt(k, 10));
    out.sort(function (a, b) { return hist[b][2] - hist[a][2]; });
    return out;
  }

  // ============================================================
  //  状态
  // ============================================================
  var curQ = null;        // 当前题
  var picked = '';        // 当前题选了什么（没答就空）
  var reviewing = false;  // true = 从历史点进来回顾（这时候可以点「重做这道」）
  var mode = 'all';       // all 顺序答 | wrong 只做错题
  var wrongQueue = [];    // 错题模式的队列
  var wrongIdx = 0;

  // ---- 每轮答题 ----
  var PER_ROUND = 20;     // 每轮答多少题（0 = 全部）
  var sessionOn = false;  // 是不是在"每轮 N 题"模式里
  var sessionOver = false;// 本轮答完了
  var sessionStart = 0;   // 从 QS 的哪个下标开始
  var sessionTotal = 0;   // 本轮一共几题
  var sessionPos = 0;     // 本轮第几题（0 开始）

  // 本轮的统计（直接按历史算，避免重复计数）
  function roundStats() {
    var done = 0, right = 0;
    for (var i = 0; i < sessionTotal; i++) {
      var q = QS[sessionStart + i];
      if (!q) continue;
      var r = hist[q.no];
      if (r !== undefined) { done++; if (r[1]) right++; }
    }
    return { done: done, right: right, wrong: done - right };
  }

  function startSession(i) {
    if (!QS.length) return;
    if (isNaN(i) || i < 0) i = 0;
    if (i >= QS.length) i = 0;
    sessionOn = true;
    sessionOver = false;
    sessionStart = i;
    sessionTotal = PER_ROUND ? Math.min(PER_ROUND, QS.length - i) : (QS.length - i);
    if (sessionTotal < 1) sessionTotal = 1;
    sessionPos = 0;
    mode = 'all';
    reviewing = false;
    curQ = QS[i];
    picked = '';
    show('quiz');
    renderQuiz();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  function show(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    document.getElementById('scr-' + name).classList.add('on');
    window.scrollTo(0, 0);
  }

  // 下一道"没答过"的题（按题号顺序）
  function nextUnanswered(fromNo) {
    var start = 0;
    for (var i = 0; i < QS.length; i++) {
      if (QS[i].no > fromNo) { start = i; break; }
      start = i + 1;
    }
    for (var j = start; j < QS.length; j++) {
      if (hist[QS[j].no] === undefined) return QS[j];
    }
    for (var k = 0; k < QS.length; k++) {
      if (hist[QS[k].no] === undefined) return QS[k];
    }
    return null;
  }

  function firstUnanswered() {
    for (var i = 0; i < QS.length; i++) {
      if (hist[QS[i].no] === undefined) return QS[i];
    }
    return null;
  }

  // ============================================================
  //  答题页
  // ============================================================
  function renderQuiz() {
    var done = answeredCount(), right = rightCount();
    document.getElementById('quizBadge').innerHTML =
      '已答 <b>' + done + '</b>' + (done ? ' · 正确率 <b>' + pct(right, done) + '%</b>' : '');

    var box = document.getElementById('quizBody');

    if (!QS.length) {
      box.innerHTML = '<div class="empty"><span class="big">📄</span>题库是空的</div>';
      return;
    }

    // 本轮答完了 → 小结
    if (sessionOver) {
      var rs = roundStats();
      var pr = sessionTotal ? Math.round(rs.right / sessionTotal * 100) : 0;
      box.innerHTML = '<div class="card"><div class="round-box">'
        + '<div class="em">' + (pr >= 80 ? '🎉' : pr >= 60 ? '👍' : '💪') + '</div>'
        + '<div class="tt">本轮完成</div>'
        + '<div class="sc">这一轮从第 <b>' + QS[sessionStart].ord + '</b> 题开始，共 ' + sessionTotal + ' 题<br>'
        +   '答对 <b>' + rs.right + '</b> 题 · 答错 <b class="red">' + rs.wrong + '</b> 题<br>'
        +   '正确率 <b>' + pr + '%</b></div>'
        + '</div>'
        + '<button class="big-btn" id="btnNextRound">再 来 一 轮</button>'
        + '<button class="big-btn ghost" id="btnBackToc" style="margin-top:10px;height:46px;font-size:14px">回 目 录 选 题</button>'
        + '</div>';
      document.getElementById('btnNextRound').onclick = function () {
        var n = sessionStart + sessionTotal;
        if (n >= QS.length) {
          var fu = firstUnanswered();
          n = fu ? QS.indexOf(fu) : 0;
        }
        startSession(n);
      };
      document.getElementById('btnBackToc').onclick = function () { show('toc'); renderToc(); };
      return;
    }

    if (!curQ) {
      var t = answeredCount();
      box.innerHTML = '<div class="card" style="text-align:center">'
        + '<div style="font-size:44px">🎉</div>'
        + '<div style="font-size:19px;font-weight:800;margin-top:10px">全部答完了</div>'
        + '<div style="font-size:13px;color:#8A8A8E;margin-top:10px;line-height:1.9">'
        +   '共 ' + QS.length + ' 题，答对 ' + rightCount() + ' 题（' + pct(rightCount(), t) + '%）'
        +   (wrongNos().length ? '<br>还有 ' + wrongNos().length + ' 道错题可以重做' : '')
        + '</div>'
        + '<button class="big-btn" id="btnRedoWrong" style="margin-top:20px">只重做错题</button>'
        + '<button class="big-btn ghost" id="btnRestart" style="margin-top:10px">从头再来一遍</button>'
        + '</div>';
      var rw = document.getElementById('btnRedoWrong');
      if (rw) rw.onclick = startWrongMode;
      var rs = document.getElementById('btnRestart');
      if (rs) rs.onclick = function () { curQ = QS[0]; picked = ''; reviewing = false; renderQuiz(); };
      return;
    }

    var q = curQ;
    var rec = hist[q.no];
    var answered = picked !== '';
    var isRight = answered && picked === q.ans;

    var html = '';

    var headText;
    if (mode === 'wrong') {
      headText = '错题 <b>' + (wrongIdx + 1) + '</b> / ' + wrongQueue.length;
    } else if (sessionOn) {
      headText = '本轮 <b>' + (sessionPos + 1) + '</b> / ' + sessionTotal
               + '　<span style="color:#C0C0C6">第 ' + q.ord + ' 题</span>';
    } else {
      headText = '第 <b>' + q.ord + '</b> 题';
    }

    html += '<div class="card">';
    html += '<div class="q-head">'
          +   '<span>' + headText + '</span>'
          +   '<span class="sp"></span>'
          +   (rec !== undefined && !answered ? '<span>之前答过</span>' : '')
          +   (answered ? '<span class="chip">' + (isRight ? '答对了' : '答错了') + '</span>' : '')
          + '</div>';
    html += '<div class="stem">' + esc(q.stem) + '</div>';

    for (var i = 0; i < q.opts.length; i++) {
      var o = q.opts[i];
      var cls = 'opt';
      if (answered) {
        if (o.k === q.ans) cls += ' right';
        else if (o.k === picked) cls += ' wrong';
        else cls += ' locked';
      }
      html += '<button class="' + cls + '" data-k="' + o.k + '">'
            +   '<span class="letter">' + o.k + '</span>'
            +   '<span class="otext">' + esc(o.text) + '</span>'
            + '</button>';
    }

    if (answered) {
      html += '<div class="verdict ' + (isRight ? 'ok' : 'no') + '">'
            +   '<span class="big">' + (isRight ? '✓' : '✗') + '</span>'
            +   (isRight ? '答对了！' : '答错了，正确答案是 ' + q.ans)
            + '</div>';
      if (q.exp) {
        html += '<div class="exp-title"><span class="ln"></span>解 析<span class="ln"></span></div>'
              + '<div class="exp">' + esc(q.exp) + '</div>';
      }
      html += '<button class="big-btn" id="btnNext">下 一 题</button>';
      html += '<button class="big-btn ghost" id="btnPrev" style="margin-top:10px;height:46px;font-size:14px">看上一题</button>';
      if (reviewing) {
        html += '<button class="big-btn ghost" id="btnRedo" style="margin-top:10px;height:46px;font-size:14px">重 做 这 道</button>';
      }
      html += '</div>';
      box.innerHTML = html;
      document.getElementById('btnNext').onclick = goNext;
      document.getElementById('btnPrev').onclick = goPrev;
      var rb = document.getElementById('btnRedo');
      if (rb) rb.onclick = function () { reviewing = false; picked = ''; renderQuiz(); };
      return;
    }

    html += '</div>';
    box.innerHTML = html;
  }

  function pickOption(k) {
    if (!curQ || picked !== '') return;
    var q = curQ;
    var ok = (k === q.ans);
    picked = k;
    reviewing = false;
    hist[q.no] = [k, ok ? 1 : 0, Date.now()];
    saveHist();
    renderQuiz();
    // 答完自动滚到解析那里
    setTimeout(function () {
      var el = document.querySelector('.verdict');
      if (el) window.scrollTo(0, Math.max(0, el.offsetTop - 120));
    }, 60);
  }

  function goNext() {
    reviewing = false;
    if (mode === 'wrong') {      wrongIdx++;
      if (wrongIdx >= wrongQueue.length) {
        toast('错题都做完了');
        mode = 'all';
        curQ = nextUnanswered(0);
        picked = '';
        renderQuiz();
        return;
      }
      curQ = BY_NO[wrongQueue[wrongIdx]];
      picked = '';
      renderQuiz();
      return;
    }
    // 每轮模式：答满本轮就收尾
    if (sessionOn) {
      if (sessionPos + 1 >= sessionTotal) { sessionOver = true; renderQuiz(); return; }
      sessionPos++;
      curQ = QS[sessionStart + sessionPos];
      picked = '';
      renderQuiz();
      return;
    }
    var n = nextUnanswered(curQ ? curQ.no : 0);
    curQ = n;
    picked = '';
    renderQuiz();
  }

  function goPrev() {
    if (!curQ) return;
    reviewing = false;
    if (sessionOn) {
      if (sessionPos > 0) {
        sessionPos--;
        curQ = QS[sessionStart + sessionPos];
        picked = '';
        renderQuiz();
      }
      return;
    }
    var i = QS.indexOf(curQ);
    if (i > 0) { curQ = QS[i - 1]; picked = ''; renderQuiz(); }
  }

  function startWrongMode() {
    var w = wrongNos();
    if (!w.length) { toast('没有错题'); return; }
    wrongQueue = w;
    wrongIdx = 0;
    mode = 'wrong';
    reviewing = false;
    curQ = BY_NO[w[0]];
    picked = '';
    show('quiz');
    renderQuiz();
  }

  // ============================================================
  //  历史页
  // ============================================================
  function renderHist() {
    var done = answeredCount(), right = rightCount();
    document.getElementById('histBadge').innerHTML = '共 <b>' + QS.length + '</b> 题';

    var box = document.getElementById('histBody');
    if (!done) {
      box.innerHTML = '<div class="empty"><span class="big">📝</span>还没有答过题<br>去「答题」开始吧</div>';
      return;
    }

    var html = '<div class="stats">'
      + '<div><div class="n">' + done + '</div><div class="l">已答</div></div>'
      + '<div><div class="n">' + right + '</div><div class="l">答对</div></div>'
      + '<div><div class="n red">' + (done - right) + '</div><div class="l">答错</div></div>'
      + '<div><div class="n gray">' + pct(right, done) + '%</div><div class="l">正确率</div></div>'
      + '</div>';

    html += '<div class="list-title"><span>从新到旧</span><span class="sp"></span>'
          + '<button class="mini red" id="btnClearHist">清除历史</button></div>';

    var nos = histNos();
    for (var i = 0; i < nos.length; i++) {
      var no = nos[i], r = hist[no], q = BY_NO[no];
      if (!q) continue;
      var ok = !!r[1];
      html += '<button class="row" data-no="' + no + '">'
            +   '<span class="badge ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + '</span>'
            +   '<span class="mid">'
            +     '<span class="t1">第 ' + q.ord + ' 题</span>'
            +     '<span class="t2">' + esc(q.stem.replace(/^\d+\.\s*/, '').substring(0, 40))
            +       (ok ? '　<span class="good">你选 ' + r[0] + '</span>'
                   : '　<span class="bad">你选 ' + r[0] + '，正确 ' + q.ans + '</span>')
            +     '</span>'
            +   '</span>'
            + '</button>';
    }
    box.innerHTML = html;

    document.getElementById('btnClearHist').onclick = function () {
      var b = this;
      if (b.getAttribute('data-ok') === '1') {
        hist = {}; saveHist(); mode = 'all'; curQ = firstUnanswered(); picked = '';
        renderHist(); renderQuiz();
        toast('历史已清除');
        return;
      }
      b.setAttribute('data-ok', '1');
      b.textContent = '再点一次确认';
      setTimeout(function () {
        if (b.getAttribute('data-ok') === '1') { b.removeAttribute('data-ok'); b.textContent = '清除历史'; }
      }, 4000);
    };
  }

  // ============================================================
  //  错题页
  // ============================================================
  function renderWrong() {
    var w = wrongNos();
    document.getElementById('wrongBadge').innerHTML = '错题 <b>' + w.length + '</b> 道';

    var box = document.getElementById('wrongBody');
    if (!w.length) {
      box.innerHTML = '<div class="empty"><span class="big">✨</span>还没有错题<br>继续保持</div>';
      return;
    }

    var html = '<button class="big-btn" id="btnStartWrong" style="margin:0 0 16px">开 始 重 做 错 题</button>';
    for (var i = 0; i < w.length; i++) {
      var no = w[i], q = BY_NO[no];
      if (!q) continue;
      html += '<button class="row" data-no="' + no + '">'
            +   '<span class="badge no">✗</span>'
            +   '<span class="mid">'
            +     '<span class="t1">第 ' + q.ord + ' 题</span>'
            +     '<span class="t2">' + esc(q.stem.replace(/^\d+\.\s*/, '').substring(0, 40))
            +       '　<span class="bad">你选 ' + hist[no][0] + '，正确 ' + q.ans + '</span></span>'
            +   '</span>'
            + '</button>';
    }
    box.innerHTML = html;
    document.getElementById('btnStartWrong').onclick = startWrongMode;
  }

  // ============================================================
  //  目录页
  // ============================================================
  var GROUPS = [];       // [{name, list}]  按"地区/考试"分组

  // 从题干开头的（2024 深圳 16）里取出"地区/考试"和年份
  function srcOf(stem) {
    var m = String(stem).match(/^\d+\.\s*[（(]([^）)]+)[）)]/);
    return m ? m[1].trim() : '';
  }
  function srcRegion(stem) {
    var s = srcOf(stem);
    if (!s) return '未标注来源';
    var r = s.replace(/^(19|20)\d{2}\s*/, '').replace(/\s*\d+\s*$/, '').trim();
    return r || '未标注来源';
  }

  function buildGroups() {
    var map = {};
    for (var i = 0; i < QS.length; i++) {
      var r = srcRegion(QS[i].stem);
      if (!map[r]) map[r] = [];
      map[r].push(QS[i]);
    }
    GROUPS = [];
    for (var k in map) if (map.hasOwnProperty(k)) GROUPS.push({ name: k, list: map[k] });
    GROUPS.sort(function (a, b) { return b.list.length - a.list.length; });
  }

  function doneIn(list) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (hist[list[i].no] !== undefined) n++;
    return n;
  }
  // 一组题里，第一道还没答过的（都答过就回到第一道）
  function firstUnansweredIn(list) {
    for (var i = 0; i < list.length; i++) if (hist[list[i].no] === undefined) return list[i];
    return list[0];
  }

  function jumpTo(q) {
    if (!q) return;
    mode = 'all';
    reviewing = false;
    curQ = q;
    picked = '';
    show('quiz');
    renderQuiz();
  }

  function renderToc() {
    var total = QS.length;
    document.getElementById('tocBadge').innerHTML = '共 <b>' + total + '</b> 题';

    var html = '';

    // ① 按题号（每 100 题一段）
    html += '<div class="toc-h">按题号<span class="ln"></span></div><div class="chips">';
    for (var s = 0; s < total; s += 100) {
      var e = Math.min(s + 100, total);
      var part = QS.slice(s, e);
      var d = doneIn(part);
      html += '<button class="chip' + (d >= part.length ? ' full' : '') + '"'
            +   ' data-range="' + s + '-' + e + '">'
            +   '第 ' + (s + 1) + '-' + e + ' 题'
            +   '<small>' + d + '/' + part.length + '　' + Math.round(d / part.length * 100) + '%</small>'
            + '</button>';
    }
    html += '</div>';

    // ② 每轮答多少题
    html += '<div class="toc-h">每轮答多少题<span class="ln"></span></div>'
          + '<div class="chips nowrap">';
    var OPTS = [10, 20, 50, 100, 0];
    for (var k = 0; k < OPTS.length; k++) {
      var v = OPTS[k];
      html += '<button class="chip' + (PER_ROUND === v ? ' full' : '') + '" data-per="' + v + '">'
            + (v ? v + ' 题' : '全部') + '</button>';
    }
    html += '</div>';

    // ③ 从第几题开始（绿=答对 红=答错 白=没答）
    html += '<div class="toc-h">从第几题开始<span class="ln"></span>点一下就从那题开始</div>';
    html += '<div class="numgrid">';
    for (var i = 0; i < total; i++) {
      var q = QS[i];
      var rec = hist[q.no];
      var st = rec === undefined ? '' : (rec[1] ? ' ok' : ' no');
      html += '<button class="numcell' + st + '" data-start="' + i + '">' + q.ord + '</button>';
    }
    html += '</div>';

    document.getElementById('tocBody').innerHTML = html;
  }
  var toastTimer = null;
  function toast(text) {
    var el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2400);
  }

  // ============================================================
  //  事件
  // ============================================================
  document.addEventListener('click', function (e) {
    var t = e.target;

    var tab = t.closest ? t.closest('.tab') : null;
    if (tab) {
      var g = tab.getAttribute('data-go');
      show(g);
      if (g === 'hist') renderHist();
      if (g === 'wrong') renderWrong();
      if (g === 'quiz') renderQuiz();
      if (g === 'toc') renderToc();
      return;
    }

    // 目录：每轮答多少题
    var chip = t.closest ? t.closest('.chip') : null;
    if (chip) {
      var per = chip.getAttribute('data-per');
      if (per !== null && per !== undefined) {
        PER_ROUND = parseInt(per, 10) || 0;
        renderToc();
        return;
      }
      // 目录：题号区间 → 从这一段里第一道没答过的开始
      var rng = (chip.getAttribute('data-range') || '').split('-');
      var a = parseInt(rng[0], 10), b = parseInt(rng[1], 10);
      if (!isNaN(a) && !isNaN(b)) {
        var first = firstUnansweredIn(QS.slice(a, b));
        startSession(QS.indexOf(first));
      }
      return;
    }

    // 目录：题号格 → 从这一题开始
    var cell = t.closest ? t.closest('.numcell') : null;
    if (cell) {
      startSession(parseInt(cell.getAttribute('data-start'), 10));
      return;
    }

    var opt = t.closest ? t.closest('.opt') : null;
    if (opt) { pickOption(opt.getAttribute('data-k')); return; }

    var row = t.closest ? t.closest('.row') : null;
    if (row) {
      var no = parseInt(row.getAttribute('data-no'), 10);
      mode = 'all';
      curQ = BY_NO[no];
      // 从历史/错题点进来：先把上次的作答显示出来给你回顾，
      // 想重新做就点下面的「重做这道」
      if (hist[no]) { picked = hist[no][0]; reviewing = true; }
      else { picked = ''; reviewing = false; }
      show('quiz');
      renderQuiz();
      return;
    }
  });

  // ---------- 启动 ----------
  QS = parseBank();
  for (var i = 0; i < QS.length; i++) BY_NO[QS[i].no] = QS[i];
  buildGroups();
  loadHist();
  curQ = firstUnanswered();
  if (!curQ) curQ = QS.length ? QS[0] : null;
  renderQuiz();
</script>

<div class="toast" id="toast"></div>
<style>
  .toast {
    position: fixed; left: 50%; bottom: 46px; transform: translateX(-50%);
    background: rgba(42,38,34,.93); color: #FFFFFF;
    padding: 12px 20px; border-radius: 12px;
    font-size: 13px; z-index: 300; opacity: 0;
    transition: opacity .2s; pointer-events: none;
  }
  .toast.on { opacity: 1; }
</style>
</body>
</html>
`;
