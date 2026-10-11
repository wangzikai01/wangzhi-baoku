// ============================================================
// minesweeperModule.js —— 「扫雷」模块（内置第一方模块）
//
// 纯 HTML + CSS + JS，跑在应用箱的 WebView 里。
//
// 【布雷时机】
//   第一次点击之后才布雷，而且第一下点的格子 + 它周围一圈都不放雷。
//   这样第一下必定不会踩雷，而且几乎总能翻开一小片，开局不会憋屈。
//
// 【手机上的操作】
//   点一下     —— 翻开格子
//   长按       —— 插旗 / 取消旗
//   「插旗模式」开关 —— 开了之后点一下就是插旗（单手玩更方便）
//   点已翻开的数字 —— 如果周围旗数够了，自动翻开周围（扫雷的"和弦"操作）
//
// 【页面为什么要能滑】
//   手机屏幕小，像 30×16 这种棋盘竖着放不下、横着也放不下，
//   所以棋盘放在一个可以横向滚动的容器里，整页也可以纵向滚。
//
// 【三个按钮】
//   提示   —— 帮你翻开一个安全格
//   检查   —— 只报"旗插错了几面"，不显示雷在哪
//   看雷   —— 终局：把所有的雷都标出来
// ============================================================

export const MINESWEEPER_MODULE_NAME = '扫雷';

export const MINESWEEPER_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>扫雷</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 40px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
    overscroll-behavior: contain;
  }
  button { font-family: inherit; }

  .screen { display: none; }
  .screen.on { display: block; }

  /* ---------- 主菜单 ---------- */
  .menu { padding: 56px 26px 0; }
  .menu-logo {
    font-size: 44px; font-weight: 800; letter-spacing: 8px;
    text-align: center; color: #00BFA5; margin-bottom: 6px;
  }
  .menu-sub {
    text-align: center; color: #A0A0A6; font-size: 11px;
    letter-spacing: 2px; margin-bottom: 40px;
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
    margin-top: 24px; text-align: center;
    font-size: 12px; color: #B0B0B6; line-height: 1.9;
  }

  /* ---------- 继续上一局 ---------- */
  .resume {
    display: none; width: 100%; margin-bottom: 16px; cursor: pointer;
    border: none; border-left: 4px solid #00BFA5;
    background: #FFFFFF; border-radius: 17px;
    padding: 14px 16px; text-align: left;
    box-shadow: 0 6px 20px rgba(0,191,165,.15);
  }
  .resume.on { display: block; }
  .resume-top { display: flex; justify-content: space-between; align-items: baseline; }
  .resume-title { font-size: 15px; font-weight: 800; color: #00A38C; }
  .resume-time { font-size: 12px; color: #8A8A8E; }
  .resume-sub { display: block; font-size: 12px; color: #8A8A8E; margin-top: 7px; line-height: 1.7; }
  .resume-bar {
    display: block; height: 5px; border-radius: 999px;
    background: #EDEFF2; margin-top: 9px; overflow: hidden;
  }
  .resume-bar i { display: block; height: 100%; border-radius: 999px; background: #00BFA5; }

  /* ---------- 顶栏 ---------- */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 14px 12px; background: #FFFFFF;
    border-bottom: 1px solid #EFEFF3;
    position: sticky; top: 0; z-index: 30;
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
    position: relative; height: 58px;
    border: none; border-radius: 14px;
    background: #FFFFFF; color: #1A1A1A;
    font-size: 17px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .lv .lv-size {
    display: block; font-size: 9px; font-weight: 500;
    color: #A8A8B0; margin-top: 1px;
  }
  .lv.done { background: #E3F8F4; color: #00A38C; }
  .lv.done::after {
    content: '✓'; position: absolute; top: 3px; right: 5px;
    font-size: 10px; color: #00A38C;
  }
  /* 经典标准难度的那几关，标个金星 */
  .lv.std { box-shadow: inset 0 0 0 2px #F5C242, 0 1px 4px rgba(0,0,0,.05); }
  .lv.std::before {
    content: '★'; position: absolute; top: 2px; left: 5px;
    font-size: 9px; color: #E8A400;
  }
  .lv:active { transform: scale(.95); }
  .lv-legend {
    padding: 0 16px 6px; font-size: 11px; color: #A0A0A6; line-height: 1.8;
  }

  /* ---------- 通用卡片 ---------- */
  .card2 { background: #FFFFFF; border-radius: 16px; margin: 16px 14px 0; padding: 18px; }
  .set-label { font-size: 12px; color: #8A8A8E; margin: 4px 0 10px; }
  .set-label + .set-label { margin-top: 22px; }
  .chips { display: flex; flex-wrap: wrap; gap: 9px; }
  .chip {
    border: none; border-radius: 12px;
    background: #F2F3F5; color: #5A5A63;
    font-size: 14px; font-weight: 600;
    padding: 10px 14px; min-width: 60px;
  }
  .chip.on { background: #00BFA5; color: #FFFFFF; }
  .chip small { display: block; font-size: 9px; font-weight: 500; opacity: .72; margin-top: 2px; }

  .mine-label { color: #00A38C; font-weight: 800; margin-left: 4px; }
  input[type=range] {
    width: 100%; height: 34px; margin: 8px 0 0;
    accent-color: #00BFA5; background: transparent;
  }

  /* ---------- 游戏页 ---------- */
  .hud {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 14px 0;
  }
  .hud-pill {
    background: #FFFFFF; border-radius: 11px;
    padding: 9px 12px; font-size: 13px; color: #6B6B73;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .hud-pill b { color: #1A1A1A; font-size: 15px; }
  .hud-flag {
    margin-left: auto; border: none; border-radius: 11px;
    background: #FFFFFF; color: #6B6B73;
    padding: 10px 14px; font-size: 13px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .hud-flag.on { background: #FF7043; color: #FFFFFF; }

  /* 棋盘容器：放不下就横向滚 */
  .board-scroll {
    margin: 12px 0 0; padding: 0 14px 6px;
    overflow-x: auto; overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .board-scroll::-webkit-scrollbar { height: 4px; }
  .board-scroll::-webkit-scrollbar-thumb { background: #D8DAE0; border-radius: 4px; }

  .board { display: grid; gap: 2px; margin: 0 auto; touch-action: manipulation; }

  .cell {
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    background: #C9D1DA;
    font-weight: 800; line-height: 1;
    user-select: none; cursor: pointer;
    box-shadow: inset 0 -2px 0 rgba(0,0,0,.13), inset 0 2px 0 rgba(255,255,255,.45);
  }
  .cell.open {
    background: #EDEFF2;
    box-shadow: none;
    color: #8A8A8E;
  }
  .cell.empty { background: #E8EAEE; }
  .cell.flag { background: #C9D1DA; }
  .cell.boom { background: #FF5252; }
  .cell.mine-shown { background: #E8EAEE; }
  .cell.wrongflag { background: #FFCDD2; }
  .cell.safe-hint { animation: pop .35s ease; }
  .cell.press { background: #B7C1CC; }
  @keyframes pop {
    0% { transform: scale(.7); }
    60% { transform: scale(1.12); }
    100% { transform: scale(1); }
  }

  .cell.n1 { color: #1976D2; }
  .cell.n2 { color: #2E7D32; }
  .cell.n3 { color: #D32F2F; }
  .cell.n4 { color: #7B1FA2; }
  .cell.n5 { color: #C2185B; }
  .cell.n6 { color: #0097A7; }
  .cell.n7 { color: #455A64; }
  .cell.n8 { color: #8D6E63; }

  /* ---------- 操作按钮 ---------- */
  .actions { display: flex; gap: 9px; padding: 14px 14px 0; }
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

  .restart {
    flex: 1; height: 46px;
    border: none; border-radius: 13px;
    background: #FFFFFF; color: #3A3A42;
    font-size: 14px; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .restart:active { transform: scale(.97); background: #F2F3F5; }

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

  /* ---------- 弹窗 ---------- */
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
  .new-badge {
    margin-top: 14px; padding: 11px 13px; border-radius: 12px;
    background: #FFF7E6; color: #B07407; font-size: 12px; line-height: 1.8;
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
  .rec-row .bt { font-size: 12px; color: #A0A0A6; min-width: 50px; text-align: right; }

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
</style>
</head>
<body>

  <!-- ============ 主菜单 ============ -->
  <div class="screen on" id="scr-menu">
    <div class="menu">
      <div class="menu-logo">扫雷</div>
      <div class="menu-sub">M I N E S W E E P E R</div>

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

      <div class="menu-note">
        经典标准难度：初级 9×9·10雷　中级 16×16·40雷　高级 30×16·99雷<br>
        闯关模式共 30 关，第 9 / 18 / 27 关就是这三个标准<br>
        雷是在你第一次点击之后才布的，第一下绝不会踩雷<br>
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
    <div class="lv-legend">
      ★ 是扫雷的三个经典标准难度：<br>
      第 9 关 初级 9×9·10雷　第 18 关 中级 16×16·40雷　第 27 关 高级 30×16·99雷
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
      <div class="set-label">难度</div>
      <div class="chips" id="rdDiffs"></div>

      <!-- 只有选「自定义」时才显示 -->
      <div id="rdCustom" style="display:none">
        <div class="set-label">棋盘大小（列 × 行）</div>
        <div class="chips" id="rdSizes"></div>

        <div class="set-label">雷数 <span id="rdMineLabel" class="mine-label"></span></div>
        <input type="range" id="rdMines" min="1" max="100" step="1" value="10">
      </div>

      <button class="big-btn primary" id="rdStart" style="margin-top:24px">开始游戏</button>
      <button class="big-btn" id="rdRecords" style="margin-top:10px">我的记录</button>
      <div class="menu-note" style="margin-top:14px">
        棋盘放不下时可以左右滑动<br>
        长按格子也能插旗
      </div>
    </div>
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

    <div class="hud">
      <span class="hud-pill">💣 <b id="hudMines">0</b></span>
      <span class="hud-pill">🚩 <b id="hudFlags">0</b></span>
      <button class="hud-flag" id="actFlag">插旗模式</button>
    </div>

    <div class="board-scroll" id="boardScroll">
      <div class="board" id="board"></div>
    </div>

    <div class="actions">
      <button class="act hint" id="actHint">提示</button>
      <button class="act check" id="actCheck">检查</button>
      <button class="act reveal" id="actReveal">看雷</button>
    </div>

    <div class="actions" style="padding-top:9px">
      <button class="restart" id="actRestart">🔄 再来一次（重新布雷）</button>
    </div>

    <div class="msg" id="msg"></div>
  </div>

  <!-- ============ 弹窗 ============ -->
  <div class="mask" id="winMask">
    <div class="win">
      <div class="win-emoji" id="winEmoji">🎉</div>
      <div class="win-title" id="winTitle">通关！</div>
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
  //  基础
  // ============================================================
  var LEVELS = 30;

  var KEY_PROGRESS = 'ms-progress-v1';
  var KEY_STATS    = 'ms-stats-v1';
  var KEY_SESSION  = 'ms-session-v1';

  var progress = {};
  var stats = null;

  function loadStore() {
    try { progress = JSON.parse(localStorage.getItem(KEY_PROGRESS) || '{}') || {}; }
    catch (e) { progress = {}; }

    try { stats = JSON.parse(localStorage.getItem(KEY_STATS) || 'null'); }
    catch (e) { stats = null; }
    if (!stats || typeof stats !== 'object') stats = {};
    if (!stats.bySize) stats.bySize = {};
    if (!stats.byDiff) stats.byDiff = {};
    if (!stats.badges) stats.badges = {};
    if (typeof stats.total !== 'number') stats.total = 0;
    if (typeof stats.noHint !== 'number') stats.noHint = 0;
    if (typeof stats.perfect !== 'number') stats.perfect = 0;
  }

  function saveStats() {
    try { localStorage.setItem(KEY_STATS, JSON.stringify(stats)); } catch (e) {}
  }
  function saveProgress() {
    try { localStorage.setItem(KEY_PROGRESS, JSON.stringify(progress)); } catch (e) {}
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ============================================================
  //  关卡配置
  //
  //  以扫雷的三个"经典标准难度"为骨架：
  //     初级  9×9  / 10 雷
  //     中级  16×16 / 40 雷
  //     高级  30×16 / 99 雷
  //
  //  它们分别落在第 9 关、第 18 关、第 27 关，
  //  前面用更小的棋盘热身，中间用 12×12 过渡，后面比标准高级还要更密。
  //
  //  表里每一项是 [列, 行, 雷数]
  // ============================================================
  var LEVEL_PLAN = [
    // 1~4   6×6 热身
    [6, 6, 4], [6, 6, 5], [6, 6, 6], [6, 6, 7],
    // 5~8   8×8
    [8, 8, 9], [8, 8, 10], [8, 8, 11], [8, 8, 12],
    // 9~12  9×9   ← 第 9 关就是标准【初级】
    [9, 9, 10], [9, 9, 12], [9, 9, 14], [9, 9, 16],
    // 13~17 12×12 过渡
    [12, 12, 22], [12, 12, 25], [12, 12, 28], [12, 12, 31], [12, 12, 34],
    // 18~23 16×16 ← 第 18 关就是标准【中级】
    [16, 16, 40], [16, 16, 45], [16, 16, 50], [16, 16, 55], [16, 16, 60], [16, 16, 66],
    // 24~30 30×16 ← 第 27 关就是标准【高级】，之后更难
    [30, 16, 80], [30, 16, 88], [30, 16, 96], [30, 16, 99], [30, 16, 106], [30, 16, 114], [30, 16, 122]
  ];

  // 这几个关卡用的就是经典标准难度，关卡列表上会标出来
  var STANDARD_LEVELS = { 9: '初级', 18: '中级', 27: '高级' };

  function levelConfig(lv) {
    var i = Math.min(Math.max(lv, 1), LEVELS) - 1;
    var p = LEVEL_PLAN[i];
    return { cols: p[0], rows: p[1], mines: p[2], label: p[0] + '×' + p[1] };
  }

  // ============================================================
  //  状态
  // ============================================================
  var G = null;
  var timerId = null;
  var flagMode = false;

  function newGame(opts) {
    var rows = opts.rows, cols = opts.cols, total = rows * cols;

    G = {
      key: opts.key,
      mode: opts.mode,
      level: opts.level || 0,
      title: opts.title,
      diff: opts.diff || '',
      sizeLabel: cols + '×' + rows,
      rows: rows, cols: cols, total: total,
      mineCount: Math.min(opts.mines, total - 9 > 0 ? total - 9 : total - 1),
      mines: null,                 // 第一次点击后才生成
      revealed: new Array(total).fill(false),
      flags: new Array(total).fill(false),
      started: false,
      over: false,
      won: false,
      exploded: -1,
      hints: 0,
      elapsed: opts.elapsed || 0,
      startAt: Date.now()
    };
    if (G.mineCount < 1) G.mineCount = 1;
  }

  function idx(r, c) { return r * G.cols + c; }
  function rowOf(i) { return Math.floor(i / G.cols); }
  function colOf(i) { return i % G.cols; }

  function neighbors(i) {
    var r = rowOf(i), c = colOf(i), out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= G.rows || cc < 0 || cc >= G.cols) continue;
        out.push(idx(rr, cc));
      }
    }
    return out;
  }

  // ============================================================
  //  布雷 —— 关键：第一次点击之后才布
  // ============================================================
  function placeMines(firstIdx) {
    var total = G.total;
    var forbidden = {};

    // 第一下点的格子本身，加上它周围一圈，都不放雷
    forbidden[firstIdx] = true;
    var ring = neighbors(firstIdx);
    for (var k = 0; k < ring.length; k++) forbidden[ring[k]] = true;

    // 万一雷太多、安全区塞不下，就只保住点的那一格
    if (total - Object.keys(forbidden).length < G.mineCount) {
      forbidden = {};
      forbidden[firstIdx] = true;
    }

    var pool = [];
    for (var i = 0; i < total; i++) if (!forbidden[i]) pool.push(i);

    // 洗牌后取前 mineCount 个
    for (var j = pool.length - 1; j > 0; j--) {
      var t = Math.floor(Math.random() * (j + 1));
      var tmp = pool[j]; pool[j] = pool[t]; pool[t] = tmp;
    }

    G.mines = new Array(total).fill(false);
    for (var m = 0; m < G.mineCount; m++) G.mines[pool[m]] = true;
    G.started = true;
  }

  function adjacentMines(i) {
    if (!G.mines) return 0;
    var nb = neighbors(i), n = 0;
    for (var k = 0; k < nb.length; k++) if (G.mines[nb[k]]) n++;
    return n;
  }

  function flagsAround(i) {
    var nb = neighbors(i), n = 0;
    for (var k = 0; k < nb.length; k++) if (G.flags[nb[k]]) n++;
    return n;
  }

  // ============================================================
  //  翻开
  // ============================================================
  function reveal(i) {
    if (G.over || G.revealed[i] || G.flags[i]) return;

    if (!G.started) placeMines(i);       // 第一下 → 现在才布雷

    if (G.mines[i]) {                    // 踩雷
      G.revealed[i] = true;
      G.exploded = i;
      G.over = true;
      if (timerId) clearInterval(timerId);
      clearSession();
      renderAll();
      msg('💥 踩到雷了！点下面的「🔄 再来一次」可以换一批雷重开，或者「看雷」看看雷都在哪', 'bad');
      return;
    }

    // 空白格连锁翻开（用栈，不用递归，免得大棋盘爆栈）
    var stack = [i];
    var opened = 0;
    while (stack.length) {
      var cur = stack.pop();
      if (G.revealed[cur] || G.flags[cur]) continue;
      if (G.mines && G.mines[cur]) continue;
      G.revealed[cur] = true;
      opened++;
      if (adjacentMines(cur) === 0) {
        var nb = neighbors(cur);
        for (var k = 0; k < nb.length; k++) {
          if (!G.revealed[nb[k]] && !G.flags[nb[k]]) stack.push(nb[k]);
        }
      }
    }

    renderAll();
    updateHud();
    saveSession();
    if (checkWin()) return;
    if (opened > 1) msg('一下子翻开了 ' + opened + ' 格', 'info');
  }

  // 点已翻开的数字：周围旗够了就自动翻开周围（和弦）
  function chord(i) {
    if (G.over || !G.revealed[i]) return;
    var num = adjacentMines(i);
    if (num === 0) return;
    if (flagsAround(i) !== num) {
      msg('这一格周围有 ' + num + ' 个雷，但你只插了 ' + flagsAround(i) + ' 面旗', 'warn');
      return;
    }
    var nb = neighbors(i);
    for (var k = 0; k < nb.length; k++) {
      if (!G.revealed[nb[k]] && !G.flags[nb[k]]) reveal(nb[k]);
    }
  }

  function toggleFlag(i) {
    if (G.over || G.revealed[i]) return;
    if (!G.started) {
      // 还没开始就插旗，等于先点了这一格再插旗？——不允许，先翻开
      msg('先点一下开始布雷，之后才能插旗', 'warn');
      return;
    }
    G.flags[i] = !G.flags[i];
    renderCell(i);
    updateHud();
    saveSession();
    if (checkWin()) return;
  }

  function checkWin() {
    if (G.over) return false;
    // 所有非雷格子都翻开 = 赢
    for (var i = 0; i < G.total; i++) {
      if (!G.mines[i] && !G.revealed[i]) return false;
    }
    G.over = true;
    G.won = true;
    if (timerId) clearInterval(timerId);
    clearSession();

    // 剩下的雷自动插旗
    for (var j = 0; j < G.total; j++) if (G.mines[j]) G.flags[j] = true;

    if (G.mode === 'level') {
      progress[G.level] = { done: true, time: G.elapsed, hints: G.hints };
      saveProgress();
    }

    var fresh = recordWin();
    renderAll();
    updateHud();
    showWin(fresh);
    return true;
  }

  function showWin(fresh) {
    var perfect = G.hints === 0;
    document.getElementById('winEmoji').textContent = perfect ? '🏆' : '🎉';
    document.getElementById('winTitle').textContent = perfect ? '漂亮！一次提示都没用' : '通关！';
    document.getElementById('winSub').innerHTML =
      G.title + '　用时 ' + fmtTime(G.elapsed) + '　' + G.mineCount + ' 个雷'
      + (G.hints ? '<br>用了 ' + G.hints + ' 次提示' : '<br>全程没用提示');

    var wb = document.getElementById('winBadges');
    if (fresh && fresh.length) {
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
  //  渲染
  // ============================================================
  var CELL = 36;

  function sizeBoard() {
    var wrap = document.getElementById('boardScroll');
    var avail = wrap.clientWidth;
    // 页面还没显示出来时量到的是 0，退回用窗口宽度
    if (!avail) avail = window.innerWidth || 360;
    avail -= 28;                              // 减掉左右 padding

    var fit = Math.floor((avail - (G.cols - 1) * 2) / G.cols);
    CELL = Math.min(48, fit);
    if (CELL < 26) CELL = 26;                 // 太小点不准，宁可让容器横向滚
  }

  function buildBoard() {
    sizeBoard();
    var board = document.getElementById('board');
    board.style.gridTemplateColumns = 'repeat(' + G.cols + ', ' + CELL + 'px)';
    board.style.width = (CELL * G.cols + (G.cols - 1) * 2) + 'px';

    var font = Math.round(CELL * 0.56);
    var html = '';
    for (var i = 0; i < G.total; i++) {
      html += '<div class="cell" data-i="' + i + '" style="width:' + CELL + 'px;height:' + CELL
            + 'px;font-size:' + font + 'px"></div>';
    }
    board.innerHTML = html;
  }

  function cellClass(i) {
    var cls = 'cell';
    if (G.revealed[i]) {
      cls += ' open';
      if (G.mines && G.mines[i]) cls += G.exploded === i ? ' boom' : ' mine-shown';
      else {
        var n = adjacentMines(i);
        if (n > 0) cls += ' n' + n;
        else cls += ' empty';
      }
    } else if (G.flags[i]) {
      cls += ' flag';
    } else if (G.over && G.mines && G.mines[i]) {
      cls += ' mine-shown';       // 输了之后把没插旗的雷也露出来
    }
    if (G.over && !G.revealed[i] && !(G.mines && G.mines[i]) && G.flags[i]) cls += ' wrongflag';
    return cls;
  }

  function cellText(i) {
    if (G.revealed[i]) {
      if (G.mines && G.mines[i]) return '💥';
      var n = adjacentMines(i);
      return n > 0 ? String(n) : '';
    }
    if (G.flags[i]) return G.over && !(G.mines && G.mines[i]) ? '❌' : '🚩';
    if (G.over && G.mines && G.mines[i]) return '💣';
    return '';
  }

  function renderCell(i) {
    var el = document.querySelector('#board .cell[data-i="' + i + '"]');
    if (!el) return;
    var cls = cellClass(i);
    if (el.className !== cls) el.className = cls;
    var t = cellText(i);
    if (el.textContent !== t) el.textContent = t;
  }

  function renderAll() {
    for (var i = 0; i < G.total; i++) renderCell(i);
  }

  function updateHud() {
    var f = 0;
    for (var i = 0; i < G.total; i++) if (G.flags[i]) f++;
    document.getElementById('hudFlags').textContent = f;
    document.getElementById('hudMines').textContent = Math.max(0, G.mineCount - f);
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    G.startAt = Date.now() - (G.elapsed || 0) * 1000;
    document.getElementById('gmTimer').textContent = fmtTime(G.elapsed || 0);
    timerId = setInterval(function () {
      if (!G || G.over) return;
      G.elapsed = Math.floor((Date.now() - G.startAt) / 1000);
      document.getElementById('gmTimer').textContent = fmtTime(G.elapsed);
    }, 1000);
  }

  function msg(text, kind) {
    var el = document.getElementById('msg');
    if (!text) { el.classList.remove('on'); return; }
    el.className = 'msg on ' + (kind || 'info');
    el.innerHTML = text;
  }

  // ============================================================
  //  存档
  // ============================================================
  function saveSession() {
    if (!G || G.over || !G.started) return;   // 还没布雷就不用存
    var data = {
      key: G.key, mode: G.mode, level: G.level, title: G.title, diff: G.diff,
      sizeLabel: G.sizeLabel,
      rows: G.rows, cols: G.cols, mineCount: G.mineCount,
      mines: G.mines, revealed: G.revealed, flags: G.flags,
      hints: G.hints, elapsed: G.elapsed, savedAt: Date.now()
    };
    try { localStorage.setItem(KEY_SESSION, JSON.stringify(data)); } catch (e) {}
  }

  function readSession() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY_SESSION) || 'null');
      if (!s || !s.mines || !s.revealed) return null;
      return s;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(KEY_SESSION); } catch (e) {}
  }

  function sessionProgress(s) {
    var opened = 0, safe = 0;
    for (var i = 0; i < s.revealed.length; i++) {
      if (s.mines[i]) continue;
      safe++;
      if (s.revealed[i]) opened++;
    }
    return { opened: opened, safe: safe };
  }

  // ============================================================
  //  成就
  // ============================================================
  function sizeWins(k) { return (stats.bySize[k] || {}).wins || 0; }
  function diffWins(k) { return (stats.byDiff[k] || {}).wins || 0; }

  var BADGES = [
    { id: 'first', ic: '🌱', name: '初次排雷', desc: '通关第 1 局',
      got: function (s) { return s.total >= 1; } },
    { id: 'w5', ic: '⭐', name: '排雷新手', desc: '累计通关 5 局',
      got: function (s) { return s.total >= 5; } },
    { id: 'w10', ic: '🌟', name: '排雷好手', desc: '累计通关 10 局',
      got: function (s) { return s.total >= 10; } },
    { id: 'w25', ic: '💫', name: '排雷专家', desc: '累计通关 25 局',
      got: function (s) { return s.total >= 25; } },
    { id: 'w50', ic: '👑', name: '排雷大师', desc: '累计通关 50 局',
      got: function (s) { return s.total >= 50; } },
    { id: 'beg', ic: '🥉', name: '初级毕业', desc: '通关 1 局初级（9×9 / 10 雷）',
      got: function (s) { return diffWins('初级') > 0; } },
    { id: 'mid', ic: '🥈', name: '中级毕业', desc: '通关 1 局中级（16×16 / 40 雷）',
      got: function (s) { return diffWins('中级') > 0; } },
    { id: 'exp', ic: '🥇', name: '高级毕业', desc: '通关 1 局高级（30×16 / 99 雷）',
      got: function (s) { return diffWins('高级') > 0; } },
    { id: 'allstd', ic: '🏅', name: '三难度全通', desc: '初级、中级、高级各通关至少 1 次',
      got: function (s) {
        return diffWins('初级') > 0 && diffWins('中级') > 0 && diffWins('高级') > 0;
      } },
    { id: 'big', ic: '🗺️', name: '大地图', desc: '通关 1 局 16×16 或更大',
      got: function (s) { return sizeWins('16×16') > 0 || sizeWins('30×16') > 0; } },
    { id: 'custom', ic: '🧩', name: '自定义玩家', desc: '用「自定义」难度通关 1 局',
      got: function (s) { return diffWins('自定义') > 0; } },
    { id: 'nohint10', ic: '🧠', name: '独立思考', desc: '不用提示通关 10 局',
      got: function (s) { return s.noHint >= 10; } },
    { id: 'fast', ic: '⚡', name: '闪电手', desc: '2 分钟内通关一局中级',
      got: function (s) {
        var b = (s.byDiff['中级'] || {}).best;
        return b !== null && b !== undefined && b <= 120;
      } },
    { id: 'perfect', ic: '💎', name: '完美排雷', desc: '不用提示通关 5 局',
      got: function (s) { return s.perfect >= 5; } }
  ];

  function badgeCount() {
    var n = 0;
    for (var i = 0; i < BADGES.length; i++) if (stats.badges[BADGES[i].id]) n++;
    return n;
  }

  function recordWin() {
    stats.total++;
    if (G.hints === 0) { stats.noHint++; stats.perfect++; }

    var sk = G.sizeLabel;
    if (!stats.bySize[sk]) stats.bySize[sk] = { wins: 0, best: null };
    stats.bySize[sk].wins++;
    var b1 = stats.bySize[sk].best;
    if (b1 === null || b1 === undefined || G.elapsed < b1) stats.bySize[sk].best = G.elapsed;

    if (G.mode === 'random' && G.diff) {
      if (!stats.byDiff[G.diff]) stats.byDiff[G.diff] = { wins: 0, best: null };
      stats.byDiff[G.diff].wins++;
      var b2 = stats.byDiff[G.diff].best;
      if (b2 === null || b2 === undefined || G.elapsed < b2) stats.byDiff[G.diff].best = G.elapsed;
    }

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
  //  三个按钮
  // ============================================================
  function doHint() {
    if (!G || G.over) return;

    // 还没开始 → 随便挑个角落开一下
    if (!G.started) {
      placeMines(idx(0, 0));
      G.hints++;
      reveal(idx(0, 0));
      msg('已开局。提示用了 1 次', 'info');
      return;
    }

    // 优先找"已经能确定是安全"的格子（周围旗数够了的那种）
    var safe = [];
    for (var i = 0; i < G.total; i++) {
      if (G.revealed[i] || G.flags[i] || G.mines[i]) continue;
      var nb = neighbors(i), certain = false;
      for (var k = 0; k < nb.length; k++) {
        var j = nb[k];
        if (G.revealed[j] && adjacentMines(j) > 0 && flagsAround(j) === adjacentMines(j)) {
          certain = true; break;
        }
      }
      if (certain) safe.push(i);
    }

    // 没有能推断的，就随机给一个安全格
    if (!safe.length) {
      for (var q = 0; q < G.total; q++) {
        if (!G.revealed[q] && !G.flags[q] && !G.mines[q]) safe.push(q);
      }
    }
    if (!safe.length) { msg('已经没有可以提示的格子了', 'good'); return; }

    var pick = safe[Math.floor(Math.random() * safe.length)];
    G.hints++;
    reveal(pick);
    var el = document.querySelector('#board .cell[data-i="' + pick + '"]');
    if (el) { el.classList.add('safe-hint'); setTimeout(function () { el.classList.remove('safe-hint'); }, 360); }
    if (!G.over) msg('提示：帮你翻开了一格安全区（本局已用 ' + G.hints + ' 次）', 'info');
  }

  function doCheck() {
    if (!G || G.over) return;
    if (!G.started) { msg('还没开始呢，先点一下棋盘', 'warn'); return; }

    var wrongFlags = 0, rightFlags = 0, opened = 0, safe = 0;
    for (var i = 0; i < G.total; i++) {
      if (G.mines[i]) {
        if (G.flags[i]) rightFlags++;
      } else {
        safe++;
        if (G.revealed[i]) opened++;
        if (G.flags[i]) wrongFlags++;
      }
    }

    var lines = '已翻开 <b>' + opened + ' / ' + safe + '</b> 个安全格';
    lines += '<br>插对的旗 <b>' + rightFlags + ' / ' + G.mineCount + '</b>';
    if (wrongFlags) {
      lines += '<br>有 <b>' + wrongFlags + '</b> 面旗插在了安全格上（错的）';
      msg(lines + '<br>雷具体在哪是保密的，想看得按「看雷」', 'bad');
    } else {
      msg(lines + '<br>目前插的旗都是对的 👍', 'good');
    }
  }

  function doReveal() {
    if (!G || G.over) return;
    if (!G.started) { msg('还没开始，没有雷可以看', 'warn'); return; }

    G.over = true;
    if (timerId) clearInterval(timerId);
    clearSession();

    var wrongFlags = 0;
    for (var i = 0; i < G.total; i++) {
      if (G.mines[i]) G.flags[i] = true;
      else if (G.flags[i]) wrongFlags++;
    }
    renderAll();
    updateHud();
    msg('雷都标出来了：<b>' + G.mineCount + '</b> 个'
        + (wrongFlags ? '，其中 <b>' + wrongFlags + '</b> 面旗插错了（红色 ❌）' : '')
        + '<br>这一局结束了', 'warn');
  }

  // ============================================================
  //  界面切换
  // ============================================================
  function show(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    document.getElementById('scr-' + name).classList.add('on');
    if (name === 'menu') renderResumeCard();
    window.scrollTo(0, 0);
  }

  function renderLevels() {
    var done = 0;
    for (var k = 1; k <= LEVELS; k++) if (progress[k] && progress[k].done) done++;
    document.getElementById('lvProgress').textContent = done + ' / ' + LEVELS;

    var html = '';
    for (var lv = 1; lv <= LEVELS; lv++) {
      var cfg = levelConfig(lv);
      var isDone = progress[lv] && progress[lv].done;
      var std = STANDARD_LEVELS[lv];
      html += '<button class="lv' + (isDone ? ' done' : '') + (std ? ' std' : '') + '" data-lv="' + lv + '">'
            + lv + '<span class="lv-size">' + cfg.label + '·' + cfg.mines + '雷</span></button>';
    }
    document.getElementById('lvGrid').innerHTML = html;
  }

  // ============================================================
  //  随机模式设置
  // ============================================================
  // 三个经典标准难度 + 自定义
  var RD_PRESETS = [
    { name: '初级', cols: 9,  rows: 9,  mines: 10 },
    { name: '中级', cols: 16, rows: 16, mines: 40 },
    { name: '高级', cols: 30, rows: 16, mines: 99 },
    { name: '自定义', cols: 0, rows: 0, mines: 0 }
  ];
  var RD_DIFF_NAMES = ['初级', '中级', '高级', '自定义'];

  // 选「自定义」时能挑的棋盘。def 是每种棋盘的默认雷数，
  // 取的是和它相称的经典密度（9×9 用初级标准，16×16 用中级标准…）
  var RD_SIZES = [
    { label: '9×9',   cols: 9,  rows: 9,  def: 10 },
    { label: '12×12', cols: 12, rows: 12, def: 22 },
    { label: '16×16', cols: 16, rows: 16, def: 40 },
    { label: '30×16', cols: 30, rows: 16, def: 99 }
  ];

  var rdDiff = 1;      // 默认停在「中级」
  var rdSize = 2;      // 默认 16×16
  var rdMines = 40;

  function currentSetup() {
    var p = RD_PRESETS[rdDiff];
    if (p.mines) return { cols: p.cols, rows: p.rows, mines: p.mines, diff: p.name };
    var s = RD_SIZES[rdSize];
    return { cols: s.cols, rows: s.rows, mines: rdMines, diff: '自定义' };
  }

  function updateMineLabel() {
    var sz = RD_SIZES[rdSize];
    var total = sz.cols * sz.rows;
    document.getElementById('rdMineLabel').textContent =
      rdMines + ' 个（密度 ' + (rdMines / total * 100).toFixed(1) + '%）';
  }

  function renderRandom() {
    // 难度
    var hd = '';
    for (var i = 0; i < RD_PRESETS.length; i++) {
      var p = RD_PRESETS[i];
      var l1 = p.mines ? (p.cols + '×' + p.rows) : '棋盘和雷数';
      var l2 = p.mines ? (p.mines + ' 雷') : '自己定';
      hd += '<button class="chip' + (i === rdDiff ? ' on' : '') + '" data-diff="' + i + '">'
          + p.name + '<small>' + l1 + '</small><small>' + l2 + '</small></button>';
    }
    document.getElementById('rdDiffs').innerHTML = hd;

    // 只有「自定义」才展开棋盘和雷数
    var custom = document.getElementById('rdCustom');
    if (RD_PRESETS[rdDiff].mines) { custom.style.display = 'none'; return; }
    custom.style.display = '';

    var hs = '';
    for (var j = 0; j < RD_SIZES.length; j++) {
      var s = RD_SIZES[j];
      hs += '<button class="chip' + (j === rdSize ? ' on' : '') + '" data-size="' + j + '">'
          + s.label + '<small>' + (s.cols * s.rows) + ' 格</small></button>';
    }
    document.getElementById('rdSizes').innerHTML = hs;

    var sz = RD_SIZES[rdSize];
    var total = sz.cols * sz.rows;
    var max = Math.max(1, total - 9);            // 给第一下的安全区留位置
    var slider = document.getElementById('rdMines');
    slider.max = max;
    if (rdMines > max) rdMines = Math.max(1, Math.round(max * 0.2));
    slider.value = rdMines;
    updateMineLabel();
  }

  // ============================================================
  //  我的记录
  // ============================================================
  function renderRecords() {
    var html = '';
    html += '<div class="rec-card"><div class="rec-h">总览</div><div class="rec-big">'
          + '<div><div class="n">' + stats.total + '</div><div class="l">累计通关</div></div>'
          + '<div><div class="n">' + stats.noHint + '</div><div class="l">没用提示</div></div>'
          + '<div><div class="n">' + badgeCount() + '/' + BADGES.length + '</div><div class="l">已解锁成就</div></div>'
          + '</div></div>';

    var h1 = '';
    for (var i = 0; i < RD_SIZES.length; i++) {
      var k = RD_SIZES[i].label;
      var rec = stats.bySize[k] || { wins: 0, best: null };
      h1 += '<div class="rec-row"><span class="nm">' + k + '</span>'
          + '<span class="ct' + (rec.wins ? '' : ' zero') + '">' + rec.wins + ' 次</span>'
          + '<span class="bt">' + (rec.best != null ? '最快 ' + fmtTime(rec.best) : '—') + '</span></div>';
    }
    html += '<div class="rec-card"><div class="rec-h">按棋盘大小</div>' + h1 + '</div>';

    var h2 = '';
    for (var j = 0; j < RD_DIFF_NAMES.length; j++) {
      var nm = RD_DIFF_NAMES[j];
      var rec2 = stats.byDiff[nm] || { wins: 0, best: null };
      h2 += '<div class="rec-row"><span class="nm">' + nm + '</span>'
          + '<span class="ct' + (rec2.wins ? '' : ' zero') + '">' + rec2.wins + ' 次</span>'
          + '<span class="bt">' + (rec2.best != null ? '最快 ' + fmtTime(rec2.best) : '—') + '</span></div>';
    }
    html += '<div class="rec-card"><div class="rec-h">按难度</div>' + h2 + '</div>';

    var lvDone = 0;
    for (var lv = 1; lv <= LEVELS; lv++) if (progress[lv] && progress[lv].done) lvDone++;
    html += '<div class="rec-card"><div class="rec-h">闯关进度</div>'
          + '<div class="rec-row"><span class="nm">已完成关卡</span>'
          + '<span class="ct">' + lvDone + ' / ' + LEVELS + '</span><span class="bt"></span></div></div>';

    var h3 = '';
    for (var b = 0; b < BADGES.length; b++) {
      var bd = BADGES[b];
      var has = !!stats.badges[bd.id];
      h3 += '<div class="badge' + (has ? ' got' : '') + '">'
          + '<div class="ic">' + bd.ic + '</div>'
          + '<div class="tx"><div class="t1">' + bd.name + '</div>'
          + '<div class="t2">' + bd.desc + '</div></div>'
          + (has ? '<div class="ok">✓</div>' : '') + '</div>';
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
    var pct = pr.safe ? Math.round(pr.opened / pr.safe * 100) : 0;
    document.getElementById('rsTime').textContent = fmtTime(s.elapsed) + ' 时';
    document.getElementById('rsSub').textContent =
      s.title + '　已翻开 ' + pr.opened + ' / ' + pr.safe + ' 格'
      + (s.hints ? '　用了 ' + s.hints + ' 次提示' : '');
    document.getElementById('rsBar').style.width = pct + '%';
    card.classList.add('on');
  }

  function resumeGame() {
    var s = readSession();
    if (!s) { renderResumeCard(); return; }

    newGame({
      key: s.key, mode: s.mode, level: s.level, title: s.title, diff: s.diff,
      rows: s.rows, cols: s.cols, mines: s.mineCount
    });
    G.sizeLabel = s.sizeLabel;
    G.mines = s.mines;
    G.revealed = s.revealed;
    G.flags = s.flags;
    G.started = true;
    G.hints = s.hints || 0;
    G.elapsed = s.elapsed || 0;

    document.getElementById('gmTitle').textContent = G.title;
    show('game');            // 先切页面，再排棋盘
    buildBoard();
    renderAll();
    updateHud();
    startTimer();
    msg('已恢复上次的进度，接着排雷吧', 'info');
  }

  // ============================================================
  //  开局
  // ============================================================
  function beginGame(opts) {
    msg('');
    clearSession();
    newGame(opts);
    flagMode = false;
    updateFlagButton();
    document.getElementById('gmTitle').textContent = G.title;
    show('game');            // 必须先切到游戏页，不然下面量不到容器宽度
    buildBoard();
    renderAll();
    updateHud();
    startTimer();
  }

  function updateFlagButton() {
    var b = document.getElementById('actFlag');
    b.textContent = flagMode ? '🚩 插旗中' : '插旗模式';
    b.classList.toggle('on', flagMode);
  }

  // ============================================================
  //  事件
  // ============================================================
  document.getElementById('btnLevels').onclick = function () { renderLevels(); show('levels'); };
  document.getElementById('btnRandom').onclick = function () { renderRandom(); show('random'); };
  document.getElementById('lvBack').onclick = function () { show('menu'); };
  document.getElementById('rdBack').onclick = function () { show('menu'); };
  document.getElementById('rcBack').onclick = function () { show('random'); };
  document.getElementById('resumeCard').onclick = function () { resumeGame(); };
  document.getElementById('rdRecords').onclick = function () { renderRecords(); show('records'); };

  document.getElementById('lvGrid').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.lv') : null;
    if (!b) return;
    var lv = parseInt(b.getAttribute('data-lv'), 10);
    var cfg = levelConfig(lv);
    beginGame({
      mode: 'level', level: lv,
      rows: cfg.rows, cols: cfg.cols, mines: cfg.mines,
      key: 'L' + lv,
      title: '第 ' + lv + ' 关' + (STANDARD_LEVELS[lv] ? '（' + STANDARD_LEVELS[lv] + '）' : ''),
      // 第 9/18/27 关就是三个标准难度，通关后也计入对应难度的战绩
      diff: STANDARD_LEVELS[lv] || ''
    });
  };

  document.getElementById('rdSizes').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    rdSize = parseInt(b.getAttribute('data-size'), 10);
    rdMines = RD_SIZES[rdSize].def;       // 换棋盘就把雷数调成相称的默认值
    renderRandom();
  };
  document.getElementById('rdDiffs').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.chip') : null;
    if (!b) return;
    rdDiff = parseInt(b.getAttribute('data-diff'), 10);
    renderRandom();
  };
  document.getElementById('rdMines').oninput = function () {
    rdMines = parseInt(this.value, 10) || 1;
    updateMineLabel();
  };

  document.getElementById('rdStart').onclick = function () {
    var s = currentSetup();
    beginGame({
      mode: 'random',
      rows: s.rows, cols: s.cols, mines: s.mines,
      key: 'R' + s.cols + 'x' + s.rows + '_' + s.mines + '_' + Date.now(),
      title: s.cols + '×' + s.rows + ' · ' + s.diff,
      diff: s.diff
    });
  };

  // ---- 棋盘：点 / 长按 --------------------------------------------------
  //
  // 用指针事件统一处理触摸和鼠标。
  // pointerdown 时起一个 380ms 的定时器；到点还没抬手 = 长按 = 插旗。
  // 抬手时如果没触发长按，就当成普通点击。
  var pressTimer = null;
  var pressedIdx = -1;
  var longPressed = false;

  function clearPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (pressedIdx >= 0) {
      var el = document.querySelector('#board .cell[data-i="' + pressedIdx + '"]');
      if (el) el.classList.remove('press');
    }
    pressedIdx = -1;
  }

  document.getElementById('board').addEventListener('pointerdown', function (e) {
    var el = e.target.closest ? e.target.closest('.cell') : null;
    if (!el || !G || G.over) return;
    pressedIdx = parseInt(el.getAttribute('data-i'), 10);
    longPressed = false;
    el.classList.add('press');

    pressTimer = setTimeout(function () {
      longPressed = true;
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      var el2 = document.querySelector('#board .cell[data-i="' + pressedIdx + '"]');
      if (el2) el2.classList.remove('press');
      if (pressedIdx >= 0) toggleFlag(pressedIdx);
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) {} }
    }, 380);
  });

  document.getElementById('board').addEventListener('pointerup', function (e) {
    if (pressedIdx < 0) { clearPress(); return; }
    var i = pressedIdx;
    var wasLong = longPressed;
    clearPress();
    if (wasLong || !G || G.over) return;

    // 抬手在另一个格子上就不算
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var cell = el && el.closest ? el.closest('.cell') : null;
    if (cell && parseInt(cell.getAttribute('data-i'), 10) !== i) return;

    if (flagMode) { toggleFlag(i); return; }
    if (G.revealed[i]) chord(i);
    else reveal(i);
  });

  document.getElementById('board').addEventListener('pointercancel', clearPress);
  document.getElementById('board').addEventListener('pointerleave', clearPress);
  // 屏蔽长按弹出的系统菜单
  document.getElementById('board').addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.getElementById('board').addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  document.getElementById('actFlag').onclick = function () {
    flagMode = !flagMode;
    updateFlagButton();
    msg(flagMode ? '插旗模式开着：点格子就是插旗，再点一下取消' : '插旗模式关了：点格子是翻开，长按可以插旗', 'info');
  };

  document.getElementById('actHint').onclick = doHint;
  document.getElementById('actCheck').onclick = doCheck;
  document.getElementById('actReveal').onclick = doReveal;

  // 再来一次：用同样的棋盘和雷数重开一局，雷的位置重新随机
  document.getElementById('actRestart').onclick = function () {
    if (!G) return;
    var opts = {
      mode: G.mode, level: G.level,
      rows: G.rows, cols: G.cols, mines: G.mineCount,
      key: G.key, title: G.title, diff: G.diff
    };
    beginGame(opts);
    msg('已经重新布雷，这一局的地雷位置和刚才完全不同', 'info');
  };

  document.getElementById('gmBack').onclick = function () {
    saveSession();
    if (timerId) clearInterval(timerId);
    G = null;
    show('menu');
  };

  document.getElementById('winAgain').onclick = function () {
    document.getElementById('winMask').classList.remove('on');
    if (!G) return;
    if (G.mode === 'level') {
      var cfg = levelConfig(G.level);
      beginGame({ mode: 'level', level: G.level, rows: cfg.rows, cols: cfg.cols,
                  mines: cfg.mines, key: 'L' + G.level, title: '第 ' + G.level + ' 关', diff: '' });
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
    beginGame({ mode: 'level', level: next, rows: cfg.rows, cols: cfg.cols,
                mines: cfg.mines, key: 'L' + next, title: '第 ' + next + ' 关', diff: '' });
  };

  // 屏幕转横/竖屏时重排棋盘
  window.addEventListener('resize', function () {
    if (G && document.getElementById('scr-game').classList.contains('on')) {
      buildBoard();
      renderAll();
    }
  });

  // ---------- 启动 ----------
  loadStore();
  updateFlagButton();
  show('menu');

  setInterval(function () { if (G && !G.over) saveSession(); }, 8000);
  function saveNow() { if (G && !G.over) saveSession(); }
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveNow();
  });
</script>
</body>
</html>
`;
