// ============================================================
// sudokuModule.js —— 「数独」模块（内置第一方模块）
//
// 一个完整的数独游戏，纯 HTML + CSS + JS，跑在应用箱的 WebView 里。
//
// 【两种模式】
//   闯关模式：30 关，难度递增
//       第 1~4 关  4×4（2×2 宫）
//       第 5~10 关 6×6（2×3 宫）
//       第 11~30 关 9×9（3×3 宫），提示数从 46 递减到 24
//   随机模式：自己选棋盘大小（4/6/9/12）和难度
//
// 【三个按钮】
//   提示   —— 帮你填对一格
//   检查   —— 只报"错了几处"，不显示答案
//   对答案 —— 终局：对比你的填写，并把完整答案摆出来
//
// 【出题算法】
//   1. 随机回溯填出一个完整解
//   2. 随机挖空，每挖一个都验证"解仍然唯一"（数解个数，超过 1 就还原）
//   为了不用每次重算，生成结果会缓存进 localStorage。
// ============================================================

export const SUDOKU_MODULE_NAME = '数独';

export const SUDOKU_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>数独</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 34px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
  }
  button { font-family: inherit; }

  .screen { display: none; }
  .screen.on { display: block; }

  /* ---------- 主菜单 ---------- */
  .menu { padding: 64px 26px 0; }
  .menu-logo {
    font-size: 46px; font-weight: 800; letter-spacing: 8px;
    text-align: center; color: #00BFA5; margin-bottom: 6px;
  }
  .menu-sub {
    text-align: center; color: #A0A0A6; font-size: 12px;
    letter-spacing: 3px; margin-bottom: 44px;
  }
  .big-btn {
    display: block; width: 100%; height: 58px; margin-bottom: 14px;
    border: none; border-radius: 17px;
    background: #FFFFFF; color: #1A1A1A;
    font-size: 18px; font-weight: 700;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
  }
  .big-btn.primary {
    background: linear-gradient(135deg, #00C9AC, #00A88F);
    color: #FFFFFF;
    box-shadow: 0 8px 22px rgba(0,191,165,.32);
  }
  .big-btn:active { transform: scale(.985); }
  .menu-note {
    margin-top: 26px; text-align: center;
    font-size: 12px; color: #B0B0B6; line-height: 1.9;
  }

  /* ---------- 顶栏 ---------- */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 14px 12px; background: #FFFFFF;
    border-bottom: 1px solid #EFEFF3;
    position: sticky; top: 0; z-index: 20;
  }
  .topbar .back {
    border: none; background: transparent; padding: 0;
    color: #00BFA5; font-size: 15px; font-weight: 600;
  }
  .topbar-title { font-size: 15px; font-weight: 700; }
  .topbar-sub { font-size: 12px; color: #8A8A8E; min-width: 56px; text-align: right; }

  /* ---------- 关卡列表 ---------- */
  .lv-grid {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 11px; padding: 18px 16px;
  }
  .lv {
    position: relative; height: 56px;
    border: none; border-radius: 14px;
    background: #FFFFFF; color: #1A1A1A;
    font-size: 17px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .lv .lv-size {
    display: block; font-size: 9px; font-weight: 500;
    color: #A8A8B0; margin-top: 1px; letter-spacing: .5px;
  }
  .lv.done { background: #E3F8F4; color: #00A38C; }
  .lv.done::after {
    content: '✓'; position: absolute; top: 3px; right: 5px;
    font-size: 10px; color: #00A38C;
  }
  .lv:active { transform: scale(.95); }

  /* ---------- 随机模式设置 ---------- */
  .card2 {
    background: #FFFFFF; border-radius: 16px;
    margin: 16px 14px 0; padding: 18px;
  }
  .set-label { font-size: 12px; color: #8A8A8E; margin: 4px 0 10px; }
  .set-label + .set-label { margin-top: 22px; }
  .chips { display: flex; flex-wrap: wrap; gap: 9px; }
  .chip {
    border: none; border-radius: 12px;
    background: #F2F3F5; color: #5A5A63;
    font-size: 14px; font-weight: 600;
    padding: 11px 16px; min-width: 62px;
  }
  .chip.on { background: #00BFA5; color: #FFFFFF; }
  .chip small { display: block; font-size: 9px; font-weight: 500; opacity: .7; margin-top: 1px; }

  /* ---------- 棋盘 ---------- */
  .board-wrap { padding: 14px; }
  .board {
    display: grid; width: 100%; aspect-ratio: 1 / 1;
    background: #FFFFFF; border-radius: 14px; overflow: hidden;
    box-shadow: 0 3px 14px rgba(0,0,0,.07);
    border: 2px solid #2B2B36;
  }
  .cell {
    display: flex; align-items: center; justify-content: center;
    background: #FFFFFF; color: #1A1A1A;
    font-weight: 600; line-height: 1;
    border-right: 1px solid #DCE0E6;
    border-bottom: 1px solid #DCE0E6;
    cursor: pointer;
  }
  .cell.given { background: #F4F5F7; color: #2B2B36; font-weight: 800; }
  .cell.peer { background: #EAF7F5; }
  .cell.same { background: #E4F0FB; }
  .cell.sel { background: #00BFA5; color: #FFFFFF; }
  .cell.bad { background: #FFE9E9; color: #E23B3B; }
  .cell.sel.bad { background: #E23B3B; color: #FFFFFF; }
  .cell.revealed { color: #3B82F6; }
  .cell.hint { animation: pop .3s ease; }
  @keyframes pop {
    0% { transform: scale(.5); opacity: .3; }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  .cell.boxr { border-right: 2px solid #2B2B36; }
  .cell.boxb { border-bottom: 2px solid #2B2B36; }
  .cell.lastr { border-right: none; }
  .cell.lastb { border-bottom: none; }
  .board.big .cell { font-size: 15px; }

  /* ---------- 数字键盘 ---------- */
  .pad-wrap { padding: 2px 14px 0; }
  .pad {
    display: grid; gap: 8px;
  }
  .key {
    position: relative; height: 50px;
    border: none; border-radius: 12px;
    background: #FFFFFF; color: #1A1A1A;
    font-size: 19px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .key:active { background: #E3F8F4; }
  .key.used { color: #C4C4CC; }
  .key .left {
    position: absolute; top: 3px; right: 5px;
    font-size: 9px; font-weight: 600; color: #B0B0B6;
  }
  .key.erase { font-size: 13px; font-weight: 600; color: #6B6B73; background: #EFF0F3; }

  /* ---------- 操作按钮 ---------- */
  .actions {
    display: flex; gap: 9px; padding: 14px 14px 0;
  }
  .act {
    flex: 1; height: 48px;
    border: none; border-radius: 13px;
    background: #FFFFFF; color: #3A3A42;
    font-size: 15px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .act.hint { color: #00A38C; }
  .act.check { color: #3B82F6; }
  .act.reveal { color: #E2833B; }
  .act:active { transform: scale(.97); }

  /* 候选数开关 */
  .cand-toggle {
    flex: 1; height: 44px;
    border: none; border-radius: 12px;
    background: #FFFFFF; color: #6B6B73;
    font-size: 14px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .cand-toggle.on { background: #EAF2FE; color: #2E6FD6; }
  .cand-toggle:disabled { color: #C4C4CC; }
  .cand-toggle:active { transform: scale(.97); }

  /* 格子里的小候选数 */
  .cand {
    display: grid; width: 100%; height: 100%;
    font-size: .42em; font-weight: 600; color: #A8B0BC;
    line-height: 1;
  }
  .cand i {
    display: flex; align-items: center; justify-content: center;
    font-style: normal;
  }

  /* ---------- 提示条 ---------- */
  .msg {
    margin: 12px 14px 0; padding: 12px 14px;
    border-radius: 12px; font-size: 13px; line-height: 1.7;
    display: none;
  }
  .msg.on { display: block; }
  .msg.info { background: #EAF2FE; color: #2E6FD6; }
  .msg.good { background: #E3F8F4; color: #00A38C; }
  .msg.bad { background: #FFEFF0; color: #D93B3B; }
  .msg.warn { background: #FFF6E8; color: #C4830F; }

  /* ---------- 通关弹窗 ---------- */
  .mask {
    position: fixed; inset: 0; background: rgba(0,0,0,.42);
    z-index: 200; display: none; align-items: center; justify-content: center;
    padding: 26px;
  }
  .mask.on { display: flex; }
  .win {
    width: 100%; max-width: 400px; background: #FFFFFF;
    border-radius: 22px; padding: 26px 20px 20px; text-align: center;
    box-shadow: 0 18px 50px rgba(0,0,0,.3);
    animation: pop .22s ease-out;
  }
  .win-emoji { font-size: 46px; }
  .win-title { font-size: 21px; font-weight: 800; margin-top: 10px; }
  .win-sub { font-size: 13px; color: #8A8A8E; margin-top: 8px; line-height: 1.8; }
  .win-btns { display: flex; gap: 10px; margin-top: 22px; }
  .win-btns button {
    flex: 1; height: 48px; border: none; border-radius: 13px;
    font-size: 15px; font-weight: 700;
  }
  .win-again { background: #F2F3F5; color: #3A3A42; }
  .win-next { background: #00BFA5; color: #FFFFFF; }

  /* ---------- 继续上一局 ---------- */
  .resume {
    display: none; width: 100%; margin-bottom: 16px;
    border: none; border-left: 4px solid #00BFA5;
    background: #FFFFFF; border-radius: 17px;
    padding: 14px 16px; text-align: left;
    box-shadow: 0 6px 20px rgba(0,191,165,.15);
  }
  .resume.on { display: block; }
  .resume { cursor: pointer; }
  .resume-top { display: flex; justify-content: space-between; align-items: baseline; }
  .resume-title { font-size: 15px; font-weight: 800; color: #00A38C; }
  .resume-time { font-size: 12px; color: #8A8A8E; }
  .resume-sub { display: block; font-size: 12px; color: #8A8A8E; margin-top: 7px; line-height: 1.7; }
  .resume-bar {
    display: block; height: 5px; border-radius: 999px;
    background: #EDEFF2; margin-top: 9px; overflow: hidden;
  }
  .resume-bar i { display: block; height: 100%; border-radius: 999px; background: #00BFA5; }
  .resume-drop {
    margin-top: 12px; border: none; background: transparent;
    color: #B0B0B6; font-size: 12px; padding: 0;
  }

  /* ---------- 我的记录 ---------- */
  .rec-card { background: #FFFFFF; border-radius: 16px; margin: 14px 14px 0; padding: 18px; }
  .rec-h { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
  .rec-big { display: flex; text-align: center; }
  .rec-big > div { flex: 1; min-width: 0; }
  .rec-big .n { font-size: 23px; font-weight: 800; color: #00A38C; letter-spacing: -.5px; }
  .rec-big .l { font-size: 11px; color: #8A8A8E; margin-top: 5px; }
  .rec-row {
    display: flex; align-items: center;
    padding: 10px 0; border-bottom: 1px solid #F5F5F7;
  }
  .rec-row:last-child { border-bottom: none; }
  .rec-row .nm { flex: 1; font-size: 14px; font-weight: 600; }
  .rec-row .ct { font-size: 14px; font-weight: 700; color: #00A38C; margin-right: 12px; }
  .rec-row .ct.zero { color: #C4C4CC; }
  .rec-row .bt { font-size: 12px; color: #A0A0A6; min-width: 46px; text-align: right; }

  .badge { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #F5F5F7; }
  .badge:last-child { border-bottom: none; }
  .badge .ic {
    width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 19px; margin-right: 12px;
    background: #F2F3F5; filter: grayscale(1); opacity: .4;
  }
  .badge.got .ic { background: #E3F8F4; filter: none; opacity: 1; }
  .badge .tx { flex: 1; min-width: 0; }
  .badge .t1 { font-size: 14px; font-weight: 700; color: #A8A8B0; }
  .badge.got .t1 { color: #1A1A1A; }
  .badge .t2 { font-size: 11px; color: #A8A8B0; margin-top: 3px; }
  .badge .ok { font-size: 15px; font-weight: 800; color: #00BFA5; }
  .new-badge {
    margin-top: 14px; padding: 11px 13px; border-radius: 12px;
    background: #FFF7E6; color: #B07407; font-size: 12px; line-height: 1.8;
  }

  /* ============ 技巧教程 ============ */
  .gd-intro {
    margin: 14px 14px 0; padding: 16px;
    background: #FFFFFF; border-radius: 16px;
    font-size: 13px; color: #5A5A63; line-height: 2;
  }
  .gd-intro b { color: #00A38C; }

  .gd-tier { display: flex; align-items: center; gap: 9px; margin: 24px 18px 11px; }
  .gd-tier .dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 9px; }
  .gd-tier .nm { font-size: 15px; font-weight: 800; }
  .gd-tier .ln { flex: 1; height: 1px; background: #E8EAEE; }

  .gd-card {
    margin: 0 14px 10px; padding: 15px 16px;
    background: #FFFFFF; border-radius: 15px;
  }
  .gd-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .gd-idx {
    width: 22px; height: 22px; flex: 0 0 22px; border-radius: 7px;
    background: #E3F8F4; color: #00A38C;
    font-size: 11px; font-weight: 800;
    display: inline-flex; align-items: center; justify-content: center;
    position: relative; top: 3px;
  }
  .gd-name { font-size: 15px; font-weight: 800; }
  .gd-en { font-size: 10px; color: #B0B0B6; letter-spacing: .3px; }
  .gd-when { margin-top: 10px; font-size: 11px; color: #8A8A8E; }
  .gd-body { margin-top: 9px; font-size: 13px; color: #3A3A42; line-height: 1.95; }
  .gd-body b { color: #00A38C; }
  .gd-eg {
    margin-top: 11px; padding: 11px 13px; border-radius: 11px;
    background: #F7F8FA; font-size: 12px; color: #5A5A63; line-height: 1.95;
  }
  .gd-eg b { color: #1A1A1A; }

  /* 关卡按钮上的难度标签 */
  .lv-tier {
    position: absolute; top: 3px; left: 5px;
    font-size: 9px; font-weight: 700;
  }
</style>
</head>
<body>

  <!-- ============ 主菜单 ============ -->
  <div class="screen on" id="scr-menu">
    <div class="menu">
      <div class="menu-logo">数独</div>
      <div class="menu-sub">S U D O K U</div>

      <button class="resume" id="resumeCard">
        <span class="resume-top">
          <span class="resume-title">继续上一局</span>
          <span class="resume-time" id="rsTime"></span>
        </span>
        <span class="resume-sub" id="rsSub"></span>
        <span class="resume-bar"><i id="rsBar" style="width:0%"></i></span>
      </button>

      <button class="big-btn primary" id="btnLevels">闯关模式</button>
      <button class="big-btn" id="btnRandom">随机模式</button>
      <button class="big-btn" id="btnGuide">技巧教程</button>

      <div class="menu-note">
        难度按<b>提示数</b>（开局给的已知数字）分级：<br>
        入门 4×4 / 6×6　·　简单 36~45 个<br>
        中等 30~35 个　·　困难 25~29 个　·　专家 17~24 个<br>
        玩到一半退出也没关系，进度会自动保存
      </div>
    </div>
  </div>

  <!-- ============ 关卡列表 ============ -->
  <div class="screen" id="scr-levels">
    <div class="topbar">
      <button class="back" id="lvBack">‹ 返回</button>
      <span class="topbar-title">闯关模式</span>
      <span class="topbar-sub" id="lvProgress">0 / 30</span>
    </div>
    <div class="lv-grid" id="lvGrid"></div>
    <div style="padding:4px 14px 0">
      <button class="big-btn" id="lvGuide" style="height:50px;font-size:15px">📖 技巧教程（不会做就看这个）</button>
    </div>
  </div>

  <!-- ============ 随机模式设置 ============ -->
  <div class="screen" id="scr-random">
    <div class="topbar">
      <button class="back" id="rdBack">‹ 返回</button>
      <span class="topbar-title">随机模式</span>
      <span class="topbar-sub"></span>
    </div>

    <div class="card2">
      <div class="set-label">棋盘大小（行 = 列）</div>
      <div class="chips" id="rdSizes"></div>

      <div class="set-label">难度</div>
      <div class="chips" id="rdDiffs"></div>

      <button class="big-btn primary" id="rdStart" style="margin-top:24px">开始游戏</button>
      <button class="big-btn" id="rdRecords" style="margin-top:10px">我的记录</button>
      <button class="big-btn" id="rdGuide" style="margin-top:10px">技巧教程</button>
      <div class="menu-note" style="margin-top:14px">
        格子多的棋盘会小一些，建议先用 9×9 试试
      </div>
    </div>
  </div>

  <!-- ============ 技巧教程 ============ -->
  <div class="screen" id="scr-guide">
    <div class="topbar">
      <button class="back" id="gdBack">‹ 返回</button>
      <span class="topbar-title">技巧教程</span>
      <span class="topbar-sub"></span>
    </div>
    <div id="guideBody"></div>
  </div>

  <!-- ============ 我的记录 ============ -->
  <div class="screen" id="scr-records">
    <div class="topbar">
      <button class="back" id="rcBack">‹ 返回</button>
      <span class="topbar-title">我的记录</span>
      <span class="topbar-sub"></span>
    </div>
    <div id="recBody"></div>
  </div>

  <!-- ============ 游戏页 ============ -->
  <div class="screen" id="scr-game">
    <div class="topbar">
      <button class="back" id="gmBack">‹ 返回</button>
      <span class="topbar-title" id="gmTitle">—</span>
      <span class="topbar-sub" id="gmTimer">00:00</span>
    </div>

    <div class="board-wrap">
      <div class="board" id="board"></div>
    </div>

    <div class="pad-wrap">
      <div class="pad" id="pad"></div>
    </div>

    <div class="actions">
      <button class="act hint" id="actHint">提示</button>
      <button class="act check" id="actCheck">检查</button>
      <button class="act reveal" id="actReveal">对答案</button>
    </div>

    <div class="actions" style="padding-top:9px">
      <button class="cand-toggle" id="actCand">显示候选数</button>
    </div>

    <div class="msg" id="msg"></div>
  </div>

  <!-- ============ 通关弹窗 ============ -->
  <div class="mask" id="winMask">
    <div class="win">
      <div class="win-emoji" id="winEmoji">🎉</div>
      <div class="win-title" id="winTitle">过关！</div>
      <div class="win-sub" id="winSub"></div>
      <div id="winBadges"></div>
      <div class="win-btns">
        <button class="win-again" id="winAgain">再来一次</button>
        <button class="win-next" id="winNext">下一关</button>
      </div>
    </div>
  </div>

<script>
  // ============================================================
  //  数独引擎
  // ============================================================

  // 宫格的形状：4→2×2，6→2×3，9→3×3，12→3×4
  function boxDims(n) {
    if (n === 4) return [2, 2];
    if (n === 6) return [2, 3];
    if (n === 12) return [3, 4];
    if (n === 16) return [4, 4];
    return [3, 3];
  }

  // 可复现的随机数（同一个种子每次都出同一道题）
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 这一格能填 v 吗
  function canPlace(g, r, c, v, n, br, bc) {
    for (var i = 0; i < n; i++) {
      if (g[r * n + i] === v) return false;
      if (g[i * n + c] === v) return false;
    }
    var r0 = Math.floor(r / br) * br, c0 = Math.floor(c / bc) * bc;
    for (var rr = r0; rr < r0 + br; rr++) {
      for (var cc = c0; cc < c0 + bc; cc++) {
        if (g[rr * n + cc] === v) return false;
      }
    }
    return true;
  }

  // 填出一个完整解
  function fillFull(g, pos, n, br, bc, rng) {
    if (pos === n * n) return true;
    var r = Math.floor(pos / n), c = pos % n;
    var nums = shuffled(range(1, n), rng);
    for (var i = 0; i < nums.length; i++) {
      if (canPlace(g, r, c, nums[i], n, br, bc)) {
        g[pos] = nums[i];
        if (fillFull(g, pos + 1, n, br, bc, rng)) return true;
        g[pos] = 0;
      }
    }
    return false;
  }

  function range(a, b) {
    var out = [];
    for (var i = a; i <= b; i++) out.push(i);
    return out;
  }

  // 数一数有几个解（最多数到 limit 个就停）
  function countSolutions(src, n, br, bc, limit) {
    var g = src.slice();
    var count = 0;

    function cands(idx) {
      var r = Math.floor(idx / n), c = idx % n, out = [];
      for (var v = 1; v <= n; v++) {
        if (canPlace(g, r, c, v, n, br, bc)) out.push(v);
      }
      return out;
    }

    function rec() {
      // 挑候选最少的空格先填（MRV），快很多
      var best = -1, bestC = null;
      for (var i = 0; i < n * n; i++) {
        if (g[i] !== 0) continue;
        var cs = cands(i);
        if (cs.length === 0) return;
        if (bestC === null || cs.length < bestC.length) {
          best = i; bestC = cs;
          if (cs.length === 1) break;
        }
      }
      if (best === -1) { count++; return; }

      for (var k = 0; k < bestC.length; k++) {
        g[best] = bestC[k];
        rec();
        g[best] = 0;
        if (count >= limit) return;
      }
    }

    rec();
    return count;
  }

  // 挖空出题：每挖一格都验证"解还唯一"
  function makePuzzleOnce(n, targetGivens, seed) {
    var dims = boxDims(n), br = dims[0], bc = dims[1];
    var rng = makeRng(seed);
    var sol = new Array(n * n).fill(0);
    fillFull(sol, 0, n, br, bc, rng);

    var puzzle = sol.slice();
    var order = shuffled(range(0, n * n - 1), rng);
    var givens = n * n;

    for (var i = 0; i < order.length && givens > targetGivens; i++) {
      var idx = order[i];
      var backup = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, n, br, bc, 2) !== 1) {
        puzzle[idx] = backup;      // 挖了就不唯一，还原
      } else {
        givens--;
      }
    }

    return { n: n, br: br, bc: bc, puzzle: puzzle, solution: sol, givens: givens };
  }

  // 提示数越少的题越难挖，而且"挖得动挖不动"和那个解本身关系很大 ——
  // 有的种子一路挖到目标，有的种子挖到一半就卡住了（实测差过 6 个）。
  // 所以同一个目标多试几个种子，留下挖得最狠的那个。
  function makePuzzle(n, targetGivens, seed) {
    var tries;
    if (n !== 9) tries = 1;
    else if (targetGivens <= 21) tries = 10;
    else if (targetGivens <= 24) tries = 8;
    else if (targetGivens <= 29) tries = 6;
    else if (targetGivens <= 35) tries = 4;
    else tries = 2;

    var best = null;
    for (var t = 0; t < tries; t++) {
      var p = makePuzzleOnce(n, targetGivens, seed + t * 1000003);
      if (!best || p.givens < best.givens) best = p;
      if (best.givens <= targetGivens) break;
    }
    return best;
  }

  // ============================================================
  //  状态
  // ============================================================
  var KEY_PROGRESS = 'sudoku-progress-v1';
  var KEY_CACHE = 'sudoku-cache-v1';
  var KEY_STATS = 'sudoku-stats-v1';
  var KEY_SESSION = 'sudoku-session-v1';
  var LEVELS = 30;

  var progress = {};
  var puzzleCache = {};
  var stats = null;

  function loadStore() {
    try { progress = JSON.parse(localStorage.getItem(KEY_PROGRESS) || '{}') || {}; }
    catch (e) { progress = {}; }
    try { puzzleCache = JSON.parse(localStorage.getItem(KEY_CACHE) || '{}') || {}; }
    catch (e) { puzzleCache = {}; }

    try { stats = JSON.parse(localStorage.getItem(KEY_STATS) || 'null'); }
    catch (e) { stats = null; }
    if (!stats || typeof stats !== 'object') stats = {};
    if (!stats.bySize) stats.bySize = {};
    if (!stats.byDiff) stats.byDiff = {};
    if (!stats.badges) stats.badges = {};
    if (typeof stats.total !== 'number') stats.total = 0;
    if (typeof stats.noHint !== 'number') stats.noHint = 0;
    if (typeof stats.perfect9 !== 'number') stats.perfect9 = 0;
  }

  function saveStats() {
    try { localStorage.setItem(KEY_STATS, JSON.stringify(stats)); } catch (e) {}
  }
  function saveProgress() {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(progress));
  }
  function saveCache() {
    // 只留最近 40 道（30 关 + 一些随机的），免得 localStorage 撑爆
    var keys = Object.keys(puzzleCache);
    if (keys.length > 40) {
      for (var i = 0; i < keys.length - 40; i++) delete puzzleCache[keys[i]];
    }
    try { localStorage.setItem(KEY_CACHE, JSON.stringify(puzzleCache)); } catch (e) {}
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ---------- 存档：玩到一半退出，下次接着玩 ----------
  function saveSession() {
    if (!G || G.done) return;
    var data = {
      key: G.key, mode: G.mode, level: G.level, title: G.title, diff: G.diff || '',
      n: G.n, br: G.br, bc: G.bc,
      solution: G.solution,
      given: G.given,
      cells: G.cells,
      hints: G.hints,
      elapsed: G.elapsed,
      elim: G.elim || {},
      showCand: !!G.showCand,
      savedAt: Date.now()
    };
    try { localStorage.setItem(KEY_SESSION, JSON.stringify(data)); } catch (e) {}
  }

  function readSession() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY_SESSION) || 'null');
      if (!s || !s.cells || !s.solution) return null;
      return s;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(KEY_SESSION); } catch (e) {}
  }

  // 存档里已经填了几格
  function sessionProgress(s) {
    var total = 0, done = 0;
    for (var i = 0; i < s.cells.length; i++) {
      if (s.given[i]) continue;
      total++;
      if (s.cells[i]) done++;
    }
    return { total: total, done: done };
  }

  // ---------- 成就 ----------
  function sizeWins(k) { return (stats.bySize[k] || {}).wins || 0; }
  function diffWins(k) { return (stats.byDiff[k] || {}).wins || 0; }

  var BADGES = [
    { id: 'first', ic: '🌱', name: '初次上手', desc: '通关第 1 局',
      got: function (s) { return s.total >= 1; } },
    { id: 'w5', ic: '⭐', name: '小有所成', desc: '累计通关 5 局',
      got: function (s) { return s.total >= 5; } },
    { id: 'w10', ic: '🌟', name: '熟能生巧', desc: '累计通关 10 局',
      got: function (s) { return s.total >= 10; } },
    { id: 'w25', ic: '💫', name: '数独爱好者', desc: '累计通关 25 局',
      got: function (s) { return s.total >= 25; } },
    { id: 'w50', ic: '👑', name: '数独大师', desc: '累计通关 50 局',
      got: function (s) { return s.total >= 50; } },
    { id: 'big12', ic: '🧩', name: '大棋盘挑战者', desc: '通关 1 局 12×12',
      got: function (s) { return sizeWins('12') > 0; } },
    { id: 'hell', ic: '🔥', name: '地狱归来', desc: '通关 1 局「地狱」难度',
      got: function (s) { return diffWins('地狱') > 0; } },
    { id: 'allsize', ic: '🎯', name: '全能选手', desc: '4 种棋盘各通关至少 1 次',
      got: function (s) {
        return sizeWins('4') > 0 && sizeWins('6') > 0 && sizeWins('9') > 0 && sizeWins('12') > 0;
      } },
    { id: 'alldiff', ic: '🏅', name: '难度全通', desc: '4 种难度各通关至少 1 次',
      got: function (s) {
        return diffWins('简单') > 0 && diffWins('普通') > 0 && diffWins('困难') > 0 && diffWins('地狱') > 0;
      } },
    { id: 'nohint10', ic: '🧠', name: '独立思考', desc: '不用提示通关 10 局',
      got: function (s) { return s.noHint >= 10; } },
    { id: 'fast', ic: '⚡', name: '闪电手', desc: '5 分钟内通关一局 9×9',
      got: function (s) {
        var b = (s.bySize['9'] || {}).best;
        return b !== null && b !== undefined && b <= 300;
      } },
    { id: 'perfect9', ic: '💎', name: '完美主义', desc: '不用提示通关一局 9×9',
      got: function (s) { return (s.perfect9 || 0) >= 1; } }
  ];

  function badgeCount() {
    var n = 0;
    for (var i = 0; i < BADGES.length; i++) if (stats.badges[BADGES[i].id]) n++;
    return n;
  }

  // 记一局胜利，返回这一次新解锁的成就
  function recordWin() {
    var sizeKey = String(G.n);
    var isRandom = (G.mode === 'random');

    stats.total++;
    if (G.hints === 0) stats.noHint++;
    if (G.hints === 0 && G.n === 9) stats.perfect9++;

    if (!stats.bySize[sizeKey]) stats.bySize[sizeKey] = { wins: 0, best: null };
    stats.bySize[sizeKey].wins++;
    var b1 = stats.bySize[sizeKey].best;
    if (b1 === null || b1 === undefined || G.elapsed < b1) stats.bySize[sizeKey].best = G.elapsed;

    if (isRandom && G.diff) {
      if (!stats.byDiff[G.diff]) stats.byDiff[G.diff] = { wins: 0, best: null };
      stats.byDiff[G.diff].wins++;
      var b2 = stats.byDiff[G.diff].best;
      if (b2 === null || b2 === undefined || G.elapsed < b2) stats.byDiff[G.diff].best = G.elapsed;
    }

    // 看看有没有新解锁的成就
    var fresh = [];
    for (var i = 0; i < BADGES.length; i++) {
      var b = BADGES[i];
      if (!stats.badges[b.id] && b.got(stats)) {
        stats.badges[b.id] = Date.now();
        fresh.push(b);
      }
    }
    saveStats();
    return fresh;
  }

  // ============================================================
  //  难度分级
  //
  //  按"提示数（开局给出的已知数字）的个数"来分，这是最直观的标准：
  //     入门   4×4 / 6×6        提示数很多，只用唯一余数法就能填完
  //     简单   9×9  36~45 个    基本只需要"唯一余数法"
  //     中等   9×9  30~35 个    需要"隐性唯一数"和简单的候选数排除
  //     困难   9×9  25~29 个    需要候选数法、数对、区块摒除
  //     专家   9×9  17~24 个    需要 X-Wing / XY-Wing / 链，甚至试错
  //
  //  数学上已经证明：有唯一解的数独，最少需要 17 个提示数。
  //  所以"专家"那一档的目标压到 17，但能不能挖到要看运气 ——
  //  挖空时要一直保证解唯一，挖不动就停在能挖到的地方。
  //  关卡列表和游戏页都会显示"实际提示数"，不糊弄。
  // ============================================================

  // 每一关：[棋盘边长, 目标提示数]
  var LEVEL_PLAN = [
    // 1~4   4×4 入门
    [4, 12], [4, 11], [4, 10], [4, 9],
    // 5~8   6×6 入门
    [6, 26], [6, 24], [6, 22], [6, 20],
    // 9~14  9×9 简单（提示数 36~45）
    [9, 45], [9, 43], [9, 41], [9, 39], [9, 38], [9, 36],
    // 15~20 9×9 中等（提示数 30~35）
    [9, 35], [9, 34], [9, 33], [9, 32], [9, 31], [9, 30],
    // 21~26 9×9 困难（提示数 25~29）
    [9, 29], [9, 28], [9, 28], [9, 27], [9, 26], [9, 25],
    // 27~30 9×9 专家（标准是 17~24 个）
    // 实测："随机挖空 + 保证唯一解"这个算法最多挖到 22 个左右，
    // 目标压到 21/20/17 也是白搭（试 24 次最好也就 22）。
    // 所以这里的目标按实际可达的来，列表上显示的是"实到几个"，不糊弄。
    [9, 24], [9, 23], [9, 22], [9, 21]
  ];

  var TIERS = [
    { name: '入门', from: 1,  to: 8,  color: '#00BFA5' },
    { name: '简单', from: 9,  to: 14, color: '#3B82F6' },
    { name: '中等', from: 15, to: 20, color: '#F59E0B' },
    { name: '困难', from: 21, to: 26, color: '#EF4444' },
    { name: '专家', from: 27, to: 30, color: '#8B5CF6' }
  ];

  function tierOf(lv) {
    for (var i = 0; i < TIERS.length; i++) {
      if (lv >= TIERS[i].from && lv <= TIERS[i].to) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  // 第几关是什么配置
  function levelConfig(lv) {
    var p = LEVEL_PLAN[Math.min(Math.max(lv, 1), LEVELS) - 1];
    return { n: p[0], givens: p[1], label: p[0] + '×' + p[0], tier: tierOf(lv).name };
  }

  // 随机模式的四档难度。ratio 是"提示数占格子总数的比例"，
  // givens9 只是给 9×9 显示用的参考值（40/32/27/20，正好对上四档标准）
  var RD_DIFFS = [
    { name: '简单', ratio: 0.50, givens9: 40 },
    { name: '中等', ratio: 0.40, givens9: 32 },
    { name: '困难', ratio: 0.33, givens9: 27 },
    { name: '专家', ratio: 0.25, givens9: 20 }
  ];

  function diffRatio(name) {
    for (var i = 0; i < RD_DIFFS.length; i++) {
      if (RD_DIFFS[i].name === name) return RD_DIFFS[i].ratio;
    }
    return 0.40;
  }

  // 拿到一道题（先查缓存）
  function getPuzzle(key, n, targetGivens, seed) {
    if (puzzleCache[key]) return puzzleCache[key];
    var p = makePuzzle(n, targetGivens, seed);
    puzzleCache[key] = p;
    saveCache();
    return p;
  }

  // ============================================================
  //  界面切换
  // ============================================================
  var scr = 'menu';
  function show(name) {
    scr = name;
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    document.getElementById('scr-' + name).classList.add('on');
    if (name === 'menu') renderResumeCard();
    window.scrollTo(0, 0);
  }

  function msg(text, kind) {
    var el = document.getElementById('msg');
    if (!text) { el.classList.remove('on'); return; }
    el.className = 'msg on ' + (kind || 'info');
    el.innerHTML = text;
  }

  // ============================================================
  //  游戏
  // ============================================================
  var G = null;          // 当前这局
  var timerId = null;

  function startGame(opts) {
    // opts: { mode:'level'|'random', level, n, targetGivens, seed, title, diff }
    msg('');
    clearSession();          // 新开一局，旧的存档作废

    var key = opts.mode === 'level'
      ? ('L' + opts.level)
      : ('R' + opts.n + '_' + opts.targetGivens + '_' + opts.seed);

    var p = getPuzzle(key, opts.n, opts.targetGivens, opts.seed);

    G = {
      key: key,
      mode: opts.mode,
      level: opts.level || 0,
      title: opts.title || '游戏',
      diff: opts.diff || '',
      n: p.n, br: p.br, bc: p.bc,
      solution: p.solution,
      given: p.puzzle.map(function (v) { return v !== 0; }),
      cells: p.puzzle.slice(),
      sel: -1,
      revealed: false,
      bad: {},            // 检查后标红的格子
      elim: {},           // 提示排除掉的候选数 {格号: {数字: 1}}
      showCand: false,    // 要不要显示候选数小字
      hints: 0,
      startAt: Date.now(),
      elapsed: 0,
      done: false
    };
    refreshCur();

    document.getElementById('gmTitle').textContent = G.title + ' · ' + p.givens + '个提示';
    buildBoard();
    buildPad();
    startTimer();
    updateCandButton();
    renderBoard();
    show('game');
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    G.startAt = Date.now() - (G.elapsed || 0) * 1000;
    document.getElementById('gmTimer').textContent = fmtTime(G.elapsed || 0);
    timerId = setInterval(function () {
      if (!G || G.done) return;
      G.elapsed = Math.floor((Date.now() - G.startAt) / 1000);
      document.getElementById('gmTimer').textContent = fmtTime(G.elapsed);
    }, 1000);
  }

  function buildBoard() {
    var n = G.n;
    var board = document.getElementById('board');
    board.className = 'board' + (n >= 12 ? ' big' : '');
    board.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';

    // 字号跟着格子大小走
    var size = n <= 4 ? 34 : n <= 6 ? 27 : n <= 9 ? 21 : 15;
    var html = '';
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var cls = 'cell';
      if ((c + 1) % G.bc === 0 && c !== n - 1) cls += ' boxr';
      if ((r + 1) % G.br === 0 && r !== n - 1) cls += ' boxb';
      if (c === n - 1) cls += ' lastr';
      if (r === n - 1) cls += ' lastb';
      html += '<div class="' + cls + '" data-i="' + i + '" style="font-size:' + size + 'px"></div>';
    }
    board.innerHTML = html;
  }

  function buildPad() {
    var n = G.n;
    var pad = document.getElementById('pad');
    var cols = n <= 6 ? n : (n <= 9 ? 5 : 6);
    pad.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

    var html = '';
    for (var v = 1; v <= n; v++) {
      html += '<button class="key" data-v="' + v + '">' + v + '<span class="left"></span></button>';
    }
    html += '<button class="key erase" data-v="0">擦除</button>';
    pad.innerHTML = html;
  }

  function sameBox(a, b) {
    var n = G.n;
    var ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
    return Math.floor(ra / G.br) === Math.floor(rb / G.br)
        && Math.floor(ca / G.bc) === Math.floor(cb / G.bc);
  }

  // 空格子里的小候选数。4×4 排 2 列、6×6 和 9×9 排 3 列
  function candHTML(i) {
    var n = G.n;
    var cols = n === 4 ? 2 : 3;
    var cs = candsOf(i);
    var html = '<span class="cand" style="grid-template-columns:repeat(' + cols + ',1fr)">';
    for (var v = 1; v <= n; v++) {
      html += cs.indexOf(v) >= 0 ? ('<i>' + v + '</i>') : '<i></i>';
    }
    return html + '</span>';
  }

  function renderBoard() {
    refreshCur();
    var n = G.n;
    var cells = document.querySelectorAll('#board .cell');
    var selVal = G.sel >= 0 ? G.cells[G.sel] : 0;
    var candOn = G.showCand && n <= 9;

    for (var i = 0; i < cells.length; i++) {
      var el = cells[i];
      var v = G.cells[i];
      var cls = 'cell';
      if (G.given[i]) cls += ' given';
      if (G.bad[i]) cls += ' bad';
      if (G.sel >= 0 && i !== G.sel) {
        var r = Math.floor(i / n), c = i % n;
        var sr = Math.floor(G.sel / n), sc = G.sel % n;
        if (r === sr || c === sc || sameBox(i, G.sel)) cls += ' peer';
        if (selVal && v === selVal) cls += ' same';
      }
      if (i === G.sel) cls += ' sel';
      if (G.revealed && !G.given[i] && v !== G.solution[i]) cls += ' revealed';

      // 保留原来的盒子边框类
      var r2 = Math.floor(i / n), c2 = i % n;
      if ((c2 + 1) % G.bc === 0 && c2 !== n - 1) cls += ' boxr';
      if ((r2 + 1) % G.br === 0 && r2 !== n - 1) cls += ' boxb';
      if (c2 === n - 1) cls += ' lastr';
      if (r2 === n - 1) cls += ' lastb';

      if (el.className !== cls) el.className = cls;

      if (v) {
        if (el.textContent !== String(v)) el.textContent = String(v);
      } else if (candOn) {
        var html = candHTML(i);
        if (el.innerHTML !== html) el.innerHTML = html;
      } else if (el.textContent !== '') {
        el.textContent = '';
      }
    }

    // 键盘上显示每个数字还剩几个
    var used = {};
    for (var k = 0; k < n * n; k++) {
      if (G.cells[k]) used[G.cells[k]] = (used[G.cells[k]] || 0) + 1;
    }
    var keys = document.querySelectorAll('#pad .key');
    for (var q = 0; q < keys.length; q++) {
      var vv = parseInt(keys[q].getAttribute('data-v'), 10);
      if (!vv) continue;
      var left = n - (used[vv] || 0);
      keys[q].querySelector('.left').textContent = left > 0 ? left : '';
      keys[q].classList.toggle('used', left <= 0);
    }
  }

  function isComplete() {
    for (var i = 0; i < G.cells.length; i++) {
      if (G.cells[i] !== G.solution[i]) return false;
    }
    return true;
  }

  function checkWin() {
    if (G.done || !isComplete()) return;
    G.done = true;
    if (timerId) clearInterval(timerId);
    clearSession();          // 通关了，存档没用了

    if (G.mode === 'level') {
      progress[G.level] = { done: true, time: G.elapsed, hints: G.hints };
      saveProgress();
    }

    var fresh = recordWin();

    var perfect = G.hints === 0;
    document.getElementById('winEmoji').textContent = perfect ? '🏆' : '🎉';
    document.getElementById('winTitle').textContent = perfect ? '完美通关！' : '过关！';
    document.getElementById('winSub').innerHTML =
      G.title + '　用时 ' + fmtTime(G.elapsed)
      + (G.hints ? '<br>用了 ' + G.hints + ' 次提示' : '<br>全程没用提示');

    // 这一局新解锁的成就
    var wb = document.getElementById('winBadges');
    if (fresh.length) {
      var lines = [];
      for (var i = 0; i < fresh.length; i++) {
        lines.push(fresh[i].ic + ' 解锁成就「' + fresh[i].name + '」');
      }
      wb.innerHTML = '<div class="new-badge">' + lines.join('<br>') + '</div>';
    } else {
      wb.innerHTML = '';
    }

    var nextBtn = document.getElementById('winNext');
    if (G.mode === 'level' && G.level < LEVELS) {
      nextBtn.style.display = '';
      nextBtn.textContent = '下一关';
    } else if (G.mode === 'random') {
      nextBtn.style.display = '';
      nextBtn.textContent = '再来一局';
    } else {
      nextBtn.style.display = 'none';
    }

    document.getElementById('winMask').classList.add('on');
  }

  // ============================================================
  //  三个按钮
  // ============================================================

  // ---- 技巧推理（提示按钮靠这个"讲道理"） ----

  // 算出某一格现在还能填哪些数字
  function candidatesAt(cells, i, n, br, bc) {
    if (cells[i]) return [];
    var used = {};
    var r = Math.floor(i / n), c = i % n, k;
    for (k = 0; k < n; k++) {
      used[cells[r * n + k]] = 1;
      used[cells[k * n + c]] = 1;
    }
    var r0 = Math.floor(r / br) * br, c0 = Math.floor(c / bc) * bc;
    for (var rr = r0; rr < r0 + br; rr++) {
      for (var cc = c0; cc < c0 + bc; cc++) used[cells[rr * n + cc]] = 1;
    }
    var out = [];
    for (var v = 1; v <= n; v++) if (!used[v]) out.push(v);
    return out;
  }

  // 把盘面上"已经能确定是对的"的部分抽出来（用户填错的格子当作没填）
  function knownCells() {
    var n = G.n, out = new Array(n * n).fill(0);
    for (var i = 0; i < n * n; i++) {
      if (G.given[i]) out[i] = G.solution[i];
      else if (G.cells[i] && G.cells[i] === G.solution[i]) out[i] = G.solution[i];
    }
    return out;
  }

  // ---- 候选数 ----
  // CUR 是"已经确定正确的盘面"，所有推理都基于它。
  // 用户填错的格子会被当成空格，免得一条错填把后面的推理全带崩。
  var CUR = null;
  function refreshCur() { CUR = knownCells(); }

  // 第 i 格现在还能填哪些数字（自动算出来的，再减掉提示排除过的）
  function candsOf(i) {
    if (!CUR) refreshCur();
    if (CUR[i]) return [];
    var cs = candidatesAt(CUR, i, G.n, G.br, G.bc);
    var elim = G.elim[i];
    if (!elim) return cs;
    var out = [];
    for (var k = 0; k < cs.length; k++) if (!elim[cs[k]]) out.push(cs[k]);
    return out;
  }

  // 把所有行、列、宫列出来，很多技巧都要按"单元"扫
  function buildUnits() {
    var n = G.n, br = G.br, bc = G.bc;
    var units = [], r, c, rr, cc;
    for (r = 0; r < n; r++) {
      var ur = [];
      for (c = 0; c < n; c++) ur.push(r * n + c);
      units.push({ kind: 'row', idx: r, cells: ur, name: '第 ' + (r + 1) + ' 行' });
    }
    for (c = 0; c < n; c++) {
      var uc = [];
      for (r = 0; r < n; r++) uc.push(r * n + c);
      units.push({ kind: 'col', idx: c, cells: uc, name: '第 ' + (c + 1) + ' 列' });
    }
    for (var b0 = 0; b0 < n; b0 += br) {
      for (var b1 = 0; b1 < n; b1 += bc) {
        var ub = [];
        for (rr = b0; rr < b0 + br; rr++) {
          for (cc = b1; cc < b1 + bc; cc++) ub.push(rr * n + cc);
        }
        units.push({
          kind: 'box', r0: b0, c0: b1, cells: ub,
          name: '第 ' + (Math.floor(b0 / br) + 1) + ' 行第 ' + (Math.floor(b1 / bc) + 1) + ' 列的宫'
        });
      }
    }
    return units;
  }

  function posText(i) {
    return '第 ' + (Math.floor(i / G.n) + 1) + ' 行第 ' + (i % G.n + 1) + ' 列';
  }

  // ---- 能直接填数字的两种技巧 ----

  // 用最基础的两种技巧找一步：① 唯一余数法  ② 隐性唯一数
  function findPlacement() {
    var n = G.n;
    var i, k, v;

    // ① 唯一余数法：某个空格把所有用过的数字排除后，只剩一个候选
    for (i = 0; i < n * n; i++) {
      if (CUR[i]) continue;
      var cs = candsOf(i);
      if (cs.length === 1) {
        return {
          i: i, v: cs[0], tech: '唯一余数法',
          why: '这一格所在的行、列、宫，已经把 ' + n + ' 个数字里的 ' + (n - 1)
             + ' 个都用掉了，只剩 ' + cs[0] + ' 能填'
        };
      }
    }

    // ② 隐性唯一数：某个数字在一行 / 一列 / 一宫里只有一个位置放得下
    var units = buildUnits();
    for (var ui = 0; ui < units.length; ui++) {
      var u = units[ui];
      for (v = 1; v <= n; v++) {
        var placed = false, spots = [];
        for (k = 0; k < u.cells.length; k++) {
          var idx = u.cells[k];
          if (CUR[idx] === v) { placed = true; break; }
          if (CUR[idx]) continue;
          if (candsOf(idx).indexOf(v) >= 0) spots.push(idx);
        }
        if (placed || spots.length !== 1) continue;
        return {
          i: spots[0], v: v, tech: '隐性唯一数',
          why: u.name + ' 里，数字 ' + v + ' 只有这一个位置放得下'
        };
      }
    }

    return null;
  }

  // ---- 只能排除候选数的三种技巧 ----
  // 返回 { tech, why, elims:[{i,v}] }，elims 是"可以划掉的候选数"

  // ③ 数对：同一个单元里两格的候选数完全一样（且只有 2 个），
  //    这两个数字就被这两格占住了，单元里其它格子可以划掉它们
  function findNakedPair(units) {
    for (var ui = 0; ui < units.length; ui++) {
      var u = units[ui], k;
      var pairs = [];
      for (k = 0; k < u.cells.length; k++) {
        var i = u.cells[k];
        if (CUR[i]) continue;
        var cs = candsOf(i);
        if (cs.length === 2) pairs.push({ i: i, cs: cs });
      }
      for (var a = 0; a < pairs.length; a++) {
        for (var b = a + 1; b < pairs.length; b++) {
          if (pairs[a].cs[0] !== pairs[b].cs[0]) continue;
          if (pairs[a].cs[1] !== pairs[b].cs[1]) continue;

          var d1 = pairs[a].cs[0], d2 = pairs[a].cs[1], elims = [];
          for (k = 0; k < u.cells.length; k++) {
            var j = u.cells[k];
            if (CUR[j] || j === pairs[a].i || j === pairs[b].i) continue;
            var cj = candsOf(j);
            if (cj.indexOf(d1) >= 0) elims.push({ i: j, v: d1 });
            if (cj.indexOf(d2) >= 0) elims.push({ i: j, v: d2 });
          }
          if (!elims.length) continue;

          return {
            tech: '数对', elims: elims,
            why: u.name + ' 里的 ' + posText(pairs[a].i) + ' 和 ' + posText(pairs[b].i)
               + ' 候选数都只剩 {' + d1 + ', ' + d2 + '}，这两个数字被它们俩占住了 —— '
               + '所以 ' + u.name + ' 其它格子都不可能是 ' + d1 + ' 或 ' + d2
          };
        }
      }
    }
    return null;
  }

  // ④ 区块摒除：
  //    正向（宫 → 行/列）：宫里某数字的候选位置全挤在同一行 → 那一行在宫外排除它
  //    反向（行/列 → 宫）：行里某数字的候选位置全挤在同一个宫 → 那个宫排除它
  function findLocked(units) {
    var n = G.n, br = G.br, bc = G.bc, v, k;

    // 正向：宫 → 行 / 列
    for (var ui = 0; ui < units.length; ui++) {
      var u = units[ui];
      if (u.kind !== 'box') continue;

      for (v = 1; v <= n; v++) {
        var spots = [];
        for (k = 0; k < u.cells.length; k++) {
          var i = u.cells[k];
          if (!CUR[i] && candsOf(i).indexOf(v) >= 0) spots.push(i);
        }
        if (spots.length < 2) continue;

        var rows = {}, cols = {};
        for (k = 0; k < spots.length; k++) {
          rows[Math.floor(spots[k] / n)] = 1;
          cols[spots[k] % n] = 1;
        }
        var rk = Object.keys(rows), ck = Object.keys(cols);

        if (rk.length === 1) {
          var rr = parseInt(rk[0], 10), elims = [];
          for (var c2 = 0; c2 < n; c2++) {
            var j2 = rr * n + c2;
            if (u.cells.indexOf(j2) >= 0) continue;
            if (!CUR[j2] && candsOf(j2).indexOf(v) >= 0) elims.push({ i: j2, v: v });
          }
          if (elims.length) {
            return {
              tech: '区块摒除', elims: elims,
              why: u.name + ' 里，数字 ' + v + ' 只能放在第 ' + (rr + 1) + ' 行上 —— '
                 + '也就是"第 ' + (rr + 1) + ' 行一定有 ' + v + '"，'
                 + '所以第 ' + (rr + 1) + ' 行在这个宫外面的格子都不可能是 ' + v
            };
          }
        }
        if (ck.length === 1) {
          var cc = parseInt(ck[0], 10), elims2 = [];
          for (var r2 = 0; r2 < n; r2++) {
            var j3 = r2 * n + cc;
            if (u.cells.indexOf(j3) >= 0) continue;
            if (!CUR[j3] && candsOf(j3).indexOf(v) >= 0) elims2.push({ i: j3, v: v });
          }
          if (elims2.length) {
            return {
              tech: '区块摒除', elims: elims2,
              why: u.name + ' 里，数字 ' + v + ' 只能放在第 ' + (cc + 1) + ' 列上 —— '
                 + '也就是"第 ' + (cc + 1) + ' 列一定有 ' + v + '"，'
                 + '所以第 ' + (cc + 1) + ' 列在这个宫外面的格子都不可能是 ' + v
            };
          }
        }
      }
    }

    // 反向：行 / 列 → 宫
    for (var uj = 0; uj < units.length; uj++) {
      var line = units[uj];
      if (line.kind === 'box') continue;

      for (v = 1; v <= n; v++) {
        var sp = [];
        for (k = 0; k < line.cells.length; k++) {
          var q = line.cells[k];
          if (!CUR[q] && candsOf(q).indexOf(v) >= 0) sp.push(q);
        }
        if (sp.length < 2) continue;

        var boxes = {};
        for (k = 0; k < sp.length; k++) {
          var rq = Math.floor(sp[k] / n), cq = sp[k] % n;
          boxes[Math.floor(rq / br) + '_' + Math.floor(cq / bc)] = 1;
        }
        var bk = Object.keys(boxes);
        if (bk.length !== 1) continue;

        var parts = bk[0].split('_');
        var br0 = parseInt(parts[0], 10) * br, bc0 = parseInt(parts[1], 10) * bc;
        var boxName = '第 ' + (parseInt(parts[0], 10) + 1) + ' 行第 ' + (parseInt(parts[1], 10) + 1) + ' 列的宫';

        var elims3 = [];
        for (var rr3 = br0; rr3 < br0 + br; rr3++) {
          for (var cc3 = bc0; cc3 < bc0 + bc; cc3++) {
            var j4 = rr3 * n + cc3;
            if (line.cells.indexOf(j4) >= 0) continue;
            if (!CUR[j4] && candsOf(j4).indexOf(v) >= 0) elims3.push({ i: j4, v: v });
          }
        }
        if (elims3.length) {
          return {
            tech: '区块摒除', elims: elims3,
            why: line.name + ' 里，数字 ' + v + ' 只能落在 ' + boxName + ' 内 —— '
               + '所以这个宫里、' + line.name + ' 以外的格子都不可能是 ' + v
          };
        }
      }
    }

    return null;
  }

  // ⑤ X-Wing：某数字在两行里都只剩同样的两列 → 这两列在其它行排除它
  //    （行列互换同理）
  function findXWing() {
    var n = G.n, v, r, c, k;

    function posInRow(vv, rr) {
      var out = [];
      for (var cc = 0; cc < n; cc++) {
        var i = rr * n + cc;
        if (!CUR[i] && candsOf(i).indexOf(vv) >= 0) out.push(cc);
      }
      return out;
    }
    function posInCol(vv, cc) {
      var out = [];
      for (var rr = 0; rr < n; rr++) {
        var i = rr * n + cc;
        if (!CUR[i] && candsOf(i).indexOf(vv) >= 0) out.push(rr);
      }
      return out;
    }

    // 两行 → 两列
    for (v = 1; v <= n; v++) {
      var rows = [];
      for (r = 0; r < n; r++) rows.push(posInRow(v, r));
      for (var r1 = 0; r1 < n; r1++) {
        if (rows[r1].length !== 2) continue;
        for (var r2 = r1 + 1; r2 < n; r2++) {
          if (rows[r2].length !== 2) continue;
          if (rows[r1][0] !== rows[r2][0] || rows[r1][1] !== rows[r2][1]) continue;

          var c1 = rows[r1][0], c2 = rows[r1][1], elims = [];
          for (var rr2 = 0; rr2 < n; rr2++) {
            if (rr2 === r1 || rr2 === r2) continue;
            var i1 = rr2 * n + c1, i2 = rr2 * n + c2;
            if (!CUR[i1] && candsOf(i1).indexOf(v) >= 0) elims.push({ i: i1, v: v });
            if (!CUR[i2] && candsOf(i2).indexOf(v) >= 0) elims.push({ i: i2, v: v });
          }
          if (!elims.length) continue;

          return {
            tech: 'X-Wing', elims: elims,
            why: '数字 ' + v + ' 在第 ' + (r1 + 1) + ' 行只能放第 ' + (c1 + 1) + '、' + (c2 + 1)
               + ' 列，在第 ' + (r2 + 1) + ' 行也只能放这两列 —— 四格组成一个矩形，'
               + '这两行各占掉一个，所以第 ' + (c1 + 1) + ' 列和第 ' + (c2 + 1)
               + ' 列在其它行的 ' + v + ' 全都可以划掉'
          };
        }
      }
    }

    // 两列 → 两行
    for (v = 1; v <= n; v++) {
      var cols = [];
      for (c = 0; c < n; c++) cols.push(posInCol(v, c));
      for (var c1b = 0; c1b < n; c1b++) {
        if (cols[c1b].length !== 2) continue;
        for (var c2b = c1b + 1; c2b < n; c2b++) {
          if (cols[c2b].length !== 2) continue;
          if (cols[c1b][0] !== cols[c2b][0] || cols[c1b][1] !== cols[c2b][1]) continue;

          var ra = cols[c1b][0], rb = cols[c1b][1], elims2 = [];
          for (var cc4 = 0; cc4 < n; cc4++) {
            if (cc4 === c1b || cc4 === c2b) continue;
            var j1 = ra * n + cc4, j2 = rb * n + cc4;
            if (!CUR[j1] && candsOf(j1).indexOf(v) >= 0) elims2.push({ i: j1, v: v });
            if (!CUR[j2] && candsOf(j2).indexOf(v) >= 0) elims2.push({ i: j2, v: v });
          }
          if (!elims2.length) continue;

          return {
            tech: 'X-Wing', elims: elims2,
            why: '数字 ' + v + ' 在第 ' + (c1b + 1) + ' 列只能放第 ' + (ra + 1) + '、' + (rb + 1)
               + ' 行，在第 ' + (c2b + 1) + ' 列也只能放这两行 —— 四格组成一个矩形，'
               + '这两列各占掉一个，所以第 ' + (ra + 1) + ' 行和第 ' + (rb + 1)
               + ' 行在其它列的 ' + v + ' 全都可以划掉'
          };
        }
      }
    }

    return null;
  }

  // 按"从简单到高级"的顺序找一步能排除候选数的推理
  function findElimination(units) {
    return findNakedPair(units) || findLocked(units) || findXWing();
  }

  function applyElim(e) {
    if (!G.elim) G.elim = {};
    for (var k = 0; k < e.elims.length; k++) {
      var it = e.elims[k];
      if (!G.elim[it.i]) G.elim[it.i] = {};
      G.elim[it.i][it.v] = 1;
    }
  }

  function elimText(e) {
    var parts = [];
    for (var k = 0; k < e.elims.length && k < 6; k++) {
      parts.push(posText(e.elims[k].i) + ' 的 ' + e.elims[k].v);
    }
    if (e.elims.length > 6) parts.push('…等共 ' + e.elims.length + ' 处');
    return parts.join('、');
  }

  // 提示。按"从简单到高级"的顺序找一步：
  //   ① 唯一余数法 / ② 隐性唯一数  —— 能直接填数字
  //   ③ 数对 / ④ 区块摒除 / ⑤ X-Wing —— 只能排除候选数
  // 排除完会再看一眼，说不定就能填了；实在都不行才直接给答案。
  function doHint() {
    if (!G || G.done) return;
    refreshCur();

    // 先确认还有没填对的格子
    var remain = [];
    for (var q = 0; q < G.cells.length; q++) {
      if (!G.given[q] && G.cells[q] !== G.solution[q]) remain.push(q);
    }
    if (!remain.length) { msg('已经全填对了，不需要提示', 'good'); return; }

    G.hints++;
    var target = -1, text = '';

    // ---- 第一步：找能直接填数字的技巧 ----
    var p = findPlacement();

    // ---- 第二步：找只能排除候选数的技巧 ----
    if (!p) {
      var e = findElimination(buildUnits());
      if (e) {
        applyElim(e);
        // 把候选数显示打开，这样"划掉了哪些"才看得见
        if (G.n <= 9) { G.showCand = true; updateCandButton(); }
        refreshCur();

        var head = '【' + e.tech + '】' + e.why
                 + '<br>可以划掉的候选数：' + elimText(e);

        var p2 = findPlacement();
        if (p2) {
          p = p2;
          text = head + '<br>排除之后就有格子确定了 ↓';
        } else {
          renderBoard();
          msg(head + '<br>这一步只做「排除候选」，还不能直接填数。'
              + (G.n <= 9
                  ? '我把<b>候选数</b>显示打开了，你能看到划掉的变化。'
                  : '')
              + '<br>（本局已用 ' + G.hints + ' 次提示）', 'info');
          saveSession();
          return;
        }
      }
    }

    // ---- 第三步：填数 / 兜底给答案 ----
    if (p) {
      target = p.i;
      G.cells[target] = p.v;
      var line = '【' + p.tech + '】' + p.why
               + '<br>所以 <b>' + posText(target) + '</b> 填 <b>' + p.v + '</b>';
      text = text ? (text + '<br>' + line) : line;
    } else {
      target = remain[Math.floor(Math.random() * remain.length)];
      G.cells[target] = G.solution[target];
      text = '这一手用上面这 5 种技巧都推不出来（得动用链式技巧了），直接告诉你答案：'
           + '<b>' + posText(target) + '</b> 填 <b>' + G.solution[target] + '</b>';
    }

    refreshCur();
    delete G.bad[target];
    G.sel = target;
    renderBoard();

    var el = document.querySelector('#board .cell[data-i="' + target + '"]');
    if (el) {
      el.classList.add('hint');
      setTimeout(function () { el.classList.remove('hint'); }, 320);
    }
    msg(text + '<br>（本局已用 ' + G.hints + ' 次提示）', 'info');
    saveSession();
    checkWin();
  }

  // 检查：只报错了几处，不显示答案
  function doCheck() {
    if (!G || G.done) return;

    var empty = 0, bad = [];
    G.bad = {};
    for (var i = 0; i < G.cells.length; i++) {
      if (G.given[i]) continue;
      if (G.cells[i] === 0) { empty++; continue; }
      if (G.cells[i] !== G.solution[i]) { bad.push(i); G.bad[i] = true; }
    }

    renderBoard();

    if (bad.length === 0 && empty === 0) {
      msg('全对！而且已经填满了 🎉', 'good');
      return;
    }
    if (bad.length === 0) {
      msg('目前填的都对 👍　还剩 ' + empty + " 格没填", 'good');
      return;
    }
    msg('有 <b>' + bad.length + '</b> 处填错了（红色格子）' +
        (empty ? '，另外还有 ' + empty + ' 格没填' : '') +
        '<br>答案是保密的，想看得按「对答案」', 'bad');
  }

  // 对答案：终局，显示完整答案
  function doReveal() {
    if (!G || G.done) return;

    var right = 0, wrong = 0, blank = 0;
    for (var i = 0; i < G.cells.length; i++) {
      if (G.given[i]) continue;
      if (G.cells[i] === 0) blank++;
      else if (G.cells[i] === G.solution[i]) right++;
      else wrong++;
    }

    G.revealed = true;
    G.done = true;
    if (timerId) clearInterval(timerId);
    clearSession();          // 看了答案，这局不算了，存档也清掉

    // 把答案摆出来（这里直接改 cells，让棋盘上显示正确值）
    G.cells = G.solution.slice();
    renderBoard();

    msg('答案已揭晓：你填对了 <b>' + right + '</b> 处，填错 <b>' + wrong + '</b> 处'
        + (blank ? '，空着 ' + blank + ' 格' : '')
        + '<br>蓝色数字就是正确答案（整局结束）', 'warn');
  }

  // ============================================================
  //  关卡列表
  // ============================================================
  function renderLevels() {
    var done = 0;
    for (var k = 1; k <= LEVELS; k++) if (progress[k] && progress[k].done) done++;
    document.getElementById('lvProgress').textContent = done + ' / ' + LEVELS;

    var html = '';
    for (var lv = 1; lv <= LEVELS; lv++) {
      var cfg = levelConfig(lv);
      var isDone = progress[lv] && progress[lv].done;
      var tier = tierOf(lv);
      // 已经生成出来的就显示"实际提示数"，还没生成就先显示目标值
      var cached = puzzleCache['L' + lv];
      var gTxt = cached ? cached.givens : cfg.givens;

      html += '<button class="lv' + (isDone ? ' done' : '') + '" data-lv="' + lv + '">'
            +   '<span class="lv-tier" style="color:' + tier.color + '">' + tier.name + '</span>'
            +   lv
            +   '<span class="lv-size">' + cfg.label + '·' + gTxt + '个</span>'
            + '</button>';
    }
    document.getElementById('lvGrid').innerHTML = html;
  }

  // 后台把 30 关都生成出来（一关一关做，做完刷新一下列表），
  // 这样列表上显示的"实际提示数"才是真的，点进去也是秒开
  var buildingAll = false;
  function buildAllPuzzles() {
    if (buildingAll) return;
    buildingAll = true;
    var lv = 1;

    function step() {
      if (lv > LEVELS) { buildingAll = false; renderLevels(); return; }
      var cfg = levelConfig(lv);
      var key = 'L' + lv;
      if (!puzzleCache[key]) {
        puzzleCache[key] = makePuzzle(cfg.n, cfg.givens, lv * 7919);
        saveCache();
      }
      lv++;
      if (scr === 'levels') renderLevels();
      setTimeout(step, 0);
    }
    step();
  }

  // ============================================================
  //  随机模式设置
  // ============================================================
  var rdSize = 9;
  var rdDiff = '中等';

  function renderRandom() {
    var sizes = [4, 6, 9, 12];
    var hs = '';
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i], d = boxDims(s);
      hs += '<button class="chip' + (s === rdSize ? ' on' : '') + '" data-size="' + s + '">'
          + s + '×' + s + '<small>' + d[0] + '×' + d[1] + '宫</small></button>';
    }
    document.getElementById('rdSizes').innerHTML = hs;

    // 难度直接标出"这个棋盘下大概给多少个提示数"
    var total = rdSize * rdSize;
    var hd = '';
    for (var j = 0; j < RD_DIFFS.length; j++) {
      var dd = RD_DIFFS[j];
      var g = Math.max(rdSize + 2, Math.round(total * dd.ratio));
      hd += '<button class="chip' + (dd.name === rdDiff ? ' on' : '') + '" data-diff="' + dd.name + '">'
          + dd.name + '<small>' + g + ' 个提示</small></button>';
    }
    document.getElementById('rdDiffs').innerHTML = hd;
  }

  // ============================================================
  //  我的记录
  // ============================================================
  function renderRecords() {
    var html = '';

    // 总览
    html += '<div class="rec-card">'
          +   '<div class="rec-h">总览</div>'
          +   '<div class="rec-big">'
          +     '<div><div class="n">' + stats.total + '</div><div class="l">累计通关</div></div>'
          +     '<div><div class="n">' + stats.noHint + '</div><div class="l">没用提示</div></div>'
          +     '<div><div class="n">' + badgeCount() + '/' + BADGES.length + '</div><div class="l">已解锁成就</div></div>'
          +   '</div>'
          + '</div>';

    // 按棋盘大小
    var sizes = [4, 6, 9, 12];
    var h1 = '';
    for (var i = 0; i < sizes.length; i++) {
      var rec = stats.bySize[String(sizes[i])] || { wins: 0, best: null };
      h1 += '<div class="rec-row">'
          +   '<span class="nm">' + sizes[i] + '×' + sizes[i] + '</span>'
          +   '<span class="ct' + (rec.wins ? '' : ' zero') + '">' + rec.wins + ' 次</span>'
          +   '<span class="bt">' + (rec.best != null ? '最快 ' + fmtTime(rec.best) : '—') + '</span>'
          + '</div>';
    }
    html += '<div class="rec-card"><div class="rec-h">按棋盘大小</div>' + h1 + '</div>';

    // 按难度
    var diffs = ['简单', '普通', '困难', '地狱'];
    var h2 = '';
    for (var j = 0; j < diffs.length; j++) {
      var rec2 = stats.byDiff[diffs[j]] || { wins: 0, best: null };
      h2 += '<div class="rec-row">'
          +   '<span class="nm">' + diffs[j] + '</span>'
          +   '<span class="ct' + (rec2.wins ? '' : ' zero') + '">' + rec2.wins + ' 次</span>'
          +   '<span class="bt">' + (rec2.best != null ? '最快 ' + fmtTime(rec2.best) : '—') + '</span>'
          + '</div>';
    }
    html += '<div class="rec-card"><div class="rec-h">按难度（随机模式）</div>' + h2 + '</div>';

    // 闯关进度
    var lvDone = 0;
    for (var lv = 1; lv <= LEVELS; lv++) if (progress[lv] && progress[lv].done) lvDone++;
    html += '<div class="rec-card">'
          +   '<div class="rec-h">闯关进度</div>'
          +   '<div class="rec-row"><span class="nm">已完成关卡</span>'
          +   '<span class="ct">' + lvDone + ' / ' + LEVELS + '</span><span class="bt"></span></div>'
          + '</div>';

    // 成就
    var h3 = '';
    for (var b = 0; b < BADGES.length; b++) {
      var bd = BADGES[b];
      var has = !!stats.badges[bd.id];
      h3 += '<div class="badge' + (has ? ' got' : '') + '">'
          +   '<div class="ic">' + bd.ic + '</div>'
          +   '<div class="tx"><div class="t1">' + bd.name + '</div>'
          +   '<div class="t2">' + bd.desc + '</div></div>'
          +   (has ? '<div class="ok">✓</div>' : '')
          + '</div>';
    }
    html += '<div class="rec-card"><div class="rec-h">成就里程碑</div>' + h3 + '</div>';

    document.getElementById('recBody').innerHTML = html;
  }

  // ============================================================
  //  继续上一局
  // ============================================================
  function renderResumeCard() {
    var s = readSession();
    var card = document.getElementById('resumeCard');
    if (!s) { card.classList.remove('on'); return; }

    var pr = sessionProgress(s);
    var pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;

    document.getElementById('rsTime').textContent = fmtTime(s.elapsed) + ' 时';
    document.getElementById('rsSub').textContent =
      s.title + '　已填 ' + pr.done + ' / ' + pr.total + ' 格'
      + (s.hints ? '　用了 ' + s.hints + ' 次提示' : '');
    document.getElementById('rsBar').style.width = pct + '%';
    card.classList.add('on');
  }

  function resumeGame() {
    var s = readSession();
    if (!s) { renderResumeCard(); return; }

    G = {
      key: s.key, mode: s.mode, level: s.level, title: s.title, diff: s.diff || '',
      n: s.n, br: s.br, bc: s.bc,
      solution: s.solution,
      given: s.given,
      cells: s.cells.slice(),
      sel: -1, revealed: false, bad: {},
      elim: s.elim || {},
      showCand: !!s.showCand,
      hints: s.hints || 0,
      startAt: Date.now(),
      elapsed: s.elapsed || 0,
      done: false
    };

    document.getElementById('gmTitle').textContent = G.title;
    buildBoard();
    buildPad();
    startTimer();
    updateCandButton();
    renderBoard();
    show('game');
    msg('已恢复上次的进度，接着填吧', 'info');
  }

  // ============================================================
  //  技巧教程
  //
  //  按"解开这局需要多高级的技巧"分成四档，正好对应提示数的四档。
  // ============================================================
  var GUIDE = [
    {
      tier: '入门 / 简单', color: '#00BFA5',
      items: [
        {
          name: '唯一余数法', en: 'Naked Single',
          when: '任何时候，先从头扫一遍',
          body: '看一个空格子。把它所在的行、列、宫里<b>已经出现过的数字统统划掉</b>。'
              + '如果最后只剩下一个数字没被划掉，那这一格就只能填它。',
          eg: '<b>例子：</b>某格所在的行有 1、3、5、7，列有 2、4、6，宫里有 8 —— '
            + '1~8 全都出现过了，那这格只能是 <b>9</b>。'
        },
        {
          name: '隐性唯一数', en: 'Hidden Single',
          when: '唯一余数法找不到的时候',
          body: '换个方向想：<b>不要盯格子，盯数字</b>。挑一个数字（比如 7），'
              + '看它在某一行里，是不是只有一个空格放得下？如果是，那这格就一定是 7 —— '
              + '哪怕这格还有别的候选数。列和宫也一样。',
          eg: '<b>例子：</b>第 3 行已经有 1、2、4、5、6、8、9，还差 3 和 7。'
            + '而 7 放在第 3 行的左边两格都会和第 3 列已有的 7 冲突 —— '
            + '那 7 只能落在第三格，3 就自动归到剩下的那格。'
        }
      ]
    },
    {
      tier: '中等', color: '#F59E0B',
      items: [
        {
          name: '候选数标记', en: 'Pencil Marks',
          when: '中等难度开始，基本必备',
          body: '上面两招不够用的时候就得动笔了：在每个空格里用很小的字，'
              + '把「这一格有可能填的数字」全写下来。写完以后，很多矛盾会自己浮出来。',
          eg: '<b>实用建议：</b>先把唯一余数和隐性唯一数扫干净，再在真正难的格子上做标记。'
            + '一上来就满盘标记，小字会把眼睛看花。'
        },
        {
          name: '候选数排除', en: 'Elimination',
          when: '做完标记之后',
          body: '一旦某格被填上数字，它所在的行、列、宫里所有空格都要把这个数字'
              + '<b>从候选里划掉</b>。经常划着划着，就有格子只剩一个候选了'
              + '——那就又回到「唯一余数法」。',
          eg: '<b>例子：</b>第 4 行第 6 列填了 5，那么第 4 行、第 6 列、'
            + '以及它所在的那个宫的其它格子里，候选数中的 5 全部划掉。'
        }
      ]
    },
    {
      tier: '困难', color: '#EF4444',
      items: [
        {
          name: '数对', en: 'Naked Pair',
          when: '两个空格的候选数完全一样，而且只有两个',
          body: '如果有两个空格，候选数都恰好只剩 {3, 7}，那么 3 和 7 必定分别落在这两格里'
              + '（只是顺序未知）。既然这两格被 3 和 7 <b>「占住」</b>了，'
              + '同一行 / 同一列 / 同一宫里其他格子就都不可能是 3 或 7，可以把它们划掉。',
          eg: '<b>例子：</b>第 5 行有两格都是 {3,7} —— 那第 5 行其它格子的候选数里的 '
            + '3 和 7 全部划掉。经常一刀下去就有格子变成唯一余数。'
        },
        {
          name: '区块摒除', en: 'Locked Candidates',
          when: '某数字在一个宫里被挤到同一行（或同一列）时',
          body: '看一个宫里的某个数字（比如 4）。如果这个宫里所有能放 4 的位置'
              + '<b>都挤在同一行</b>，那么「这一行一定有 4」就定死了 —— '
              + '哪怕不知道具体在哪格，这一行在这个宫之外的格子也都不可能是 4。'
              + '反过来（行挤在同一宫里）也一样。',
          eg: '<b>例子：</b>左上角的宫里，能放 4 的位置只有第 2 行的两个格子 —— '
            + '那第 2 行在其它两个宫里的格子，候选数中的 4 全都可以划掉。'
        }
      ]
    },
    {
      tier: '专家 / 骨灰级', color: '#8B5CF6',
      items: [
        {
          name: 'X-Wing', en: 'X-Wing',
          when: '某数字在两行里都只剩同样的两列',
          body: '挑一个数字，找两行：这个数字在每一行里都<b>恰好只剩两个可能位置</b>，'
              + '而且这两行对应的是<b>同样的两列</b>。这四格构成一个矩形，'
              + '这个数字必定落在矩形的四个角中的两个，'
              + '于是这两列各自都被占掉一个 —— 这两列上其它所有格子的这个数字都可以划掉。'
              + '行列互换也成立。',
          eg: '<b>例子：</b>数字 6 在第 2 行只能放第 4、7 列，在第 8 行也只能放第 4、7 列'
            + ' —— 那第 4 列和第 7 列在其它行的 6 全部划掉。'
        },
        {
          name: 'XY-Wing', en: 'XY-Wing',
          when: '三个双候选格摆成一个直角时',
          body: '找三个格子，候选数分别是 {X,Y}、{X,Z}、{Y,Z}，'
              + '其中 {X,Y} 那一格同时能「看见」另外两格（同行 / 同列 / 同宫）。'
              + '那么无论 {X,Y} 那格最终填 X 还是 Y，另外两格里<b>总有一个会被定成 Z</b> —— '
              + '所以同时能看见那两格的格子里，Z 一定不成立，可以划掉。',
          eg: '<b>例子：</b>A={2,5}，B={2,9}，C={5,9}，且 A 能看见 B 和 C。'
            + '那么同时能看见 B、C 的格子里，9 全部划掉。'
        },
        {
          name: '剑鱼', en: 'Swordfish',
          when: 'X-Wing 想不通时的三行版本',
          body: '把 X-Wing 从 2 行扩展到 3 行：某数字在三行里，每行只有 2~3 个可能位置，'
              + '而这些位置<b>全都落在同样的三列里</b>。那这个数字在这三列上必定各占一个'
              + '（三行三列互相抵消），于是这三列在其它行的该数字全部划掉。',
          eg: '<b>例子：</b>数字 3 在第 1、4、7 行的候选位置全都落在第 2、5、8 列 —— '
            + '那第 2、5、8 列在其它行的 3 全部划掉。'
        },
        {
          name: '试错法', en: 'Backtracking',
          when: '实在推不动了，最后的手段',
          body: '挑一个候选数最少的格子，<b>假设</b>它填某一个候选值，然后一路往下推。'
              + '如果推到某处出现矛盾（同一行 / 列 / 宫冒出两个相同数字，或者某格没有候选了），'
              + '说明假设错了，退回来换一个。',
          eg: '<b>提醒：</b>试错法是「骨灰级」手段，正规解数独尽量靠逻辑。'
            + '但在真正刁钻的题上（17~24 个提示数那种），试错往往是最快的路。'
        }
      ]
    }
  ];

  function renderGuide() {
    var html = '<div class="gd-intro">'
      + '数独的难度，最直观的标准是看 <b>提示数</b>（开局给出的已知数字个数）：<br>'
      + '入门 4×4 / 6×6　·　简单 36~45 个<br>'
      + '中等 30~35 个　·　困难 25~29 个　·　专家 17~24 个<br>'
      + '数学上已经证明：有唯一解的数独，<b>最少需要 17 个</b>提示数。<br>'
      + '提示数越少，就越需要更高级的技巧。<br><br>'
      + '游戏里的「<b>提示</b>」按钮会按「从简单到高级」的顺序找一步：<br>'
      + '先试 <b>唯一余数法</b> 和 <b>隐性唯一数</b>（这两种能直接填数字）；<br>'
      + '都不行，再试 <b>数对</b>、<b>区块摒除</b>、<b>X-Wing</b>（这三种只能排除候选数，'
      + '提示会自动帮你把「候选数」显示打开，让你看到划掉的变化）；<br>'
      + '每一种都会把<b>为什么</b>讲给你听。实在都推不出来，才会直接给答案。<br><br>'
      + '<b>关于专家档：</b>标准是 17~24 个提示数。但 17 个提示数的题需要专门的'
      + '搜索算法才挖得出来，本游戏用的是"随机挖空 + 每挖一格都验证解唯一"，'
      + '实测最多挖到 <b>22 个</b>左右。所以第 30 关实际是 22~23 个 —— '
      + '仍然落在专家档的范围内，只是到不了理论极限。'
      + '</div>';

    for (var t = 0; t < GUIDE.length; t++) {
      var g = GUIDE[t];
      html += '<div class="gd-tier">'
            +   '<span class="dot" style="background:' + g.color + '"></span>'
            +   '<span class="nm" style="color:' + g.color + '">' + g.tier + '</span>'
            +   '<span class="ln"></span>'
            + '</div>';
      for (var i = 0; i < g.items.length; i++) {
        var it = g.items[i];
        html += '<div class="gd-card">'
              +   '<div class="gd-head">'
              +     '<span class="gd-idx">' + (i + 1) + '</span>'
              +     '<span class="gd-name">' + it.name + '</span>'
              +     '<span class="gd-en">' + it.en + '</span>'
              +   '</div>'
              +   '<div class="gd-when">什么时候用：' + it.when + '</div>'
              +   '<div class="gd-body">' + it.body + '</div>'
              +   '<div class="gd-eg">' + it.eg + '</div>'
              + '</div>';
      }
    }
    document.getElementById('guideBody').innerHTML = html;
  }

  // ============================================================
  //  事件
  // ============================================================
  document.getElementById('btnLevels').onclick = function () {
    renderLevels();
    show('levels');
    buildAllPuzzles();          // 后台慢慢把 30 关都生成出来
  };
  document.getElementById('btnRandom').onclick = function () {
    renderRandom();
    show('random');
  };
  document.getElementById('btnGuide').onclick = function () { renderGuide(); show('guide'); };
  document.getElementById('lvGuide').onclick = function () { renderGuide(); show('guide'); };
  document.getElementById('rdGuide').onclick = function () { renderGuide(); show('guide'); };
  document.getElementById('gdBack').onclick = function () { show('menu'); };

  document.getElementById('lvBack').onclick = function () { show('menu'); };
  document.getElementById('rdBack').onclick = function () { show('menu'); };
  document.getElementById('rcBack').onclick = function () { show('random'); };

  // 继续上一局
  document.getElementById('resumeCard').onclick = function () { resumeGame(); };

  // 我的记录
  document.getElementById('rdRecords').onclick = function () {
    renderRecords();
    show('records');
  };

  document.getElementById('lvGrid').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.lv') : null;
    if (!b) return;
    var lv = parseInt(b.getAttribute('data-lv'), 10);
    var cfg = levelConfig(lv);
    msg('正在出题…');
    show('game');
    document.getElementById('board').innerHTML = '';
    document.getElementById('pad').innerHTML = '';
    document.getElementById('gmTitle').textContent = '第 ' + lv + ' 关';

    setTimeout(function () {
      startGame({
        mode: 'level',
        level: lv,
        n: cfg.n,
        targetGivens: cfg.givens,
        seed: lv * 7919,
        title: '第 ' + lv + ' 关 · ' + cfg.tier
      });
    }, 30);
  };

  document.getElementById('rdSizes').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    rdSize = parseInt(b.getAttribute('data-size'), 10);
    renderRandom();
  };
  document.getElementById('rdDiffs').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    rdDiff = b.getAttribute('data-diff');
    renderRandom();
  };

  document.getElementById('rdStart').onclick = function () {
    var n = rdSize;
    var total = n * n;
    var target = Math.max(n + 2, Math.round(total * diffRatio(rdDiff)));
    var seed = Math.floor(Math.random() * 1000000000) + 1;

    msg('正在出题…');
    show('game');
    document.getElementById('board').innerHTML = '';
    document.getElementById('pad').innerHTML = '';
    document.getElementById('gmTitle').textContent = n + '×' + n + ' · ' + rdDiff;

    setTimeout(function () {
      startGame({
        mode: 'random',
        n: n,
        targetGivens: target,
        seed: seed,
        diff: rdDiff,
        title: n + '×' + n + ' · ' + rdDiff
      });
    }, 30);
  };

  // 点格子
  document.getElementById('board').onclick = function (e) {
    var el = e.target.closest ? e.target.closest('.cell') : null;
    if (!el || !G || G.done) return;
    var i = parseInt(el.getAttribute('data-i'), 10);
    if (G.given[i]) { G.sel = i; renderBoard(); return; }
    G.sel = (G.sel === i) ? -1 : i;
    renderBoard();
  };

  // 点数字键
  document.getElementById('pad').onclick = function (e) {
    var k = e.target.closest ? e.target.closest('.key') : null;
    if (!k || !G || G.done) return;
    var v = parseInt(k.getAttribute('data-v'), 10);

    if (G.sel < 0 || G.given[G.sel]) {
      msg('先点一个空格，再点数字', 'info');
      return;
    }
    if (G.cells[G.sel] === v || v === 0) {
      G.cells[G.sel] = 0;      // 再点一次同样的数字 = 擦掉
    } else {
      G.cells[G.sel] = v;
    }
    delete G.bad[G.sel];
    renderBoard();
    saveSession();
    checkWin();
  };

  // 候选数开关的状态同步到按钮上
  function updateCandButton() {
    var b = document.getElementById('actCand');
    if (!b) return;
    if (G && G.n > 9) {
      b.disabled = true;
      b.classList.remove('on');
      b.textContent = '候选数（' + G.n + '×' + G.n + ' 太小，不显示）';
      return;
    }
    b.disabled = false;
    var on = !!(G && G.showCand);
    b.classList.toggle('on', on);
    b.textContent = on ? '✓ 候选数已显示' : '显示候选数';
  }

  document.getElementById('actHint').onclick = doHint;
  document.getElementById('actCheck').onclick = doCheck;
  document.getElementById('actReveal').onclick = doReveal;

  document.getElementById('actCand').onclick = function () {
    if (!G || G.n > 9) return;
    G.showCand = !G.showCand;
    updateCandButton();
    renderBoard();
    saveSession();
  };

  document.getElementById('gmBack').onclick = function () {
    if (timerId) clearInterval(timerId);
    if (G && !G.done) {
      msg('已退出这一局');
    }
    G = null;
    if (scr === 'game') {
      if (G && G.mode === 'random') show('random');
    }
    show('menu');
  };

  // 通关弹窗
  document.getElementById('winAgain').onclick = function () {
    document.getElementById('winMask').classList.remove('on');
    if (!G) return;
    if (G.mode === 'level') {
      var cfg = levelConfig(G.level);
      startGame({
        mode: 'level', level: G.level, n: cfg.n,
        targetGivens: cfg.givens, seed: G.level * 7919,
        title: '第 ' + G.level + ' 关 · ' + cfg.tier
      });
    } else {
      document.getElementById('rdStart').click();
    }
  };

  document.getElementById('winNext').onclick = function () {
    document.getElementById('winMask').classList.remove('on');
    if (!G) return;
    if (G.mode === 'random') { document.getElementById('rdStart').click(); return; }
    var next = G.level + 1;
    if (next > LEVELS) { show('menu'); return; }
    var cfg = levelConfig(next);
    startGame({
      mode: 'level', level: next, n: cfg.n,
      targetGivens: cfg.givens, seed: next * 7919,
      title: '第 ' + next + ' 关 · ' + cfg.tier
    });
  };

  // ---------- 启动 ----------
  loadStore();
  show('menu');

  // 每 8 秒自动存一次档。
  // 光靠"每走一步存一次"不够 —— 万一用户填完就走了、或者直接
  // 把 App 划掉，最后那段时间就没记上。
  setInterval(function () {
    if (G && !G.done) saveSession();
  }, 8000);

  // 页面被隐藏/关闭时再抢存一次
  function saveNow() { if (G && !G.done) saveSession(); }
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveNow();
  });
</script>
</body>
</html>
`;
