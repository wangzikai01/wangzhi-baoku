// ============================================================
// poetryModule.js —— 「古诗文」模块（内置第一方模块）
//
// 目的：学习和背诵古诗文。
//
// 【学习流程】
//   列表 → 点一首 → 看全文 / 翻译 / 鉴赏 / 字词注释
//        → 点「开始背诵」→ 两种模式：
//            ① 填空拖拽：诗句打乱，拖到对应位置
//            ② 全文默写：手敲，敲错的位置立刻变红
//
// 【列表上的圆圈】
//   ○ 灰  = 还没背过
//   ◐ 青  = 拖拽填空完成过
//   ● 绿  = 全文默写通过
//
// 【内容怎么来】
//   用 AI 按固定格式生成一个 txt，然后在「导入」里选文件直接导入。
//   格式说明和提示词都写在这个文件里（见 FORMAT_SPEC / AI_PROMPT），
//   导入页会显示出来，还能一键复制。
// ============================================================

export const POETRY_MODULE_NAME = '古诗文';

export const POETRY_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>古诗文</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 40px;
    font-family: "Kaiti SC", "KaiTi", "STKaiti", "Songti SC", "SimSun", "Noto Serif CJK SC", serif;
    background-color: #F7F3EA;
    background-image:
      radial-gradient(circle at 18% 12%, rgba(90,110,120,.055) 0%, rgba(90,110,120,0) 42%),
      radial-gradient(circle at 84% 74%, rgba(120,90,60,.05) 0%, rgba(120,90,60,0) 46%),
      radial-gradient(circle at 50% 50%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 70%);
    color: #2A2622;
  }
  button, textarea, input { font-family: inherit; }

  .screen { display: none; }
  .screen.on { display: block; }

  /* 淡墨圈水印 */
  .ink-ring {
    position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
    border: 14px solid rgba(60,70,80,.028);
  }
  .ink-ring.a { width: 320px; height: 320px; top: -70px; right: -90px; }
  .ink-ring.b { width: 220px; height: 220px; bottom: 40px; left: -80px; border-width: 10px; }

  /* ============ 顶栏 ============ */
  .topbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 8px;
    padding: 14px 14px 12px;
    background: rgba(247,243,234,.94);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(90,80,60,.12);
  }
  .topbar .brand {
    font-size: 19px; font-weight: 700; letter-spacing: 3px; color: #33302B;
  }
  .topbar .brand small {
    display: block; font-size: 9px; letter-spacing: 2px;
    color: #A79C88; font-weight: 400; margin-top: 1px;
  }
  .topbar .sp { flex: 1; }
  .tbtn {
    border: 1px solid rgba(140,47,47,.35);
    background: transparent; color: #8C2F2F;
    border-radius: 9px; padding: 7px 13px;
    font-size: 13px; font-weight: 700; letter-spacing: 1px;
  }
  .tbtn.solid { background: #8C2F2F; color: #FBF7F0; border-color: #8C2F2F; }
  .tbtn:active { opacity: .7; }
  .tbtn.ghost { border-color: rgba(90,80,60,.25); color: #6B6255; }

  /* ============ 诗词列表 ============ */
  .list { padding: 8px 14px 0; position: relative; z-index: 1; }

  .prow {
    display: flex; align-items: center; gap: 12px;
    width: 100%; text-align: left;
    background: rgba(255,253,248,.72);
    border: 1px solid rgba(120,105,80,.13);
    border-radius: 14px;
    padding: 15px 16px; margin-bottom: 10px;
    box-shadow: 0 1px 4px rgba(120,100,70,.05);
  }
  .prow:active { background: rgba(255,253,248,1); }
  .prow .mid { flex: 1; min-width: 0; }
  .prow .nm {
    font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #2A2622;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .prow .sub {
    font-size: 12px; color: #9A9080; margin-top: 5px; letter-spacing: 1px;
  }

  /* 状态圆圈 */
  .dot {
    width: 24px; height: 24px; flex: 0 0 24px;
    border-radius: 50%; border: 2px solid rgba(120,110,95,.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; color: #fff;
  }
  .dot.half {
    border-color: #2E7D6B;
    background: linear-gradient(to right, #2E7D6B 0 50%, transparent 50% 100%);
  }
  .dot.done { border-color: #2E7D6B; background: #2E7D6B; }

  .empty {
    text-align: center; padding: 60px 30px; color: #A79C88;
    font-size: 14px; line-height: 2.1; letter-spacing: 1px;
  }
  .empty .big { font-size: 44px; display: block; margin-bottom: 14px; opacity: .5; }

  /* ============ 诗词详情 ============ */
  .detail { padding: 24px 22px 0; position: relative; z-index: 1; }
  .d-title {
    text-align: center; font-size: 38px; font-weight: 700;
    letter-spacing: 8px; color: #2A2622;
  }
  .d-meta {
    text-align: center; font-size: 16px; color: #9A9080;
    letter-spacing: 3px; margin-top: 14px;
  }
  .d-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 32px 0 20px;
  }
  .d-divider .ln { flex: 1; height: 1px; background: rgba(120,105,80,.18); }
  .d-divider .tx {
    font-size: 15px; letter-spacing: 5px; color: #8C2F2F; font-weight: 700;
  }

  .d-body {
    font-size: 30px; line-height: 2.1; letter-spacing: 4px;
    text-align: center; color: #2A2622;
  }
  .d-body p { margin: 0 0 8px; }
  /* 翻译和鉴赏也居中 */
  .d-block {
    font-size: 19px; line-height: 2.05; color: #453F34;
    letter-spacing: 1px; text-align: center;
  }
  .d-block p { margin: 0 0 16px; }

  /* 字词表：左边词条，右边解释。
     用两栏 flex，解释换行后会自然和"解释那一栏的第一个字"对齐，
     不会跑到词条下面去。 */
  .gw {
    display: flex; align-items: flex-start; gap: 14px;
    max-width: 540px; margin: 0 auto;
    padding: 8px 0;
  }
  .gw .w {
    flex: 0 0 86px;
    font-size: 19px; font-weight: 700; color: #2A2622;
    letter-spacing: 2px; line-height: 1.8;
  }
  .gw .ex {
    flex: 1; min-width: 0;
    font-size: 19px; color: #5C5448;
    line-height: 1.85; letter-spacing: .5px;
  }
  .gw.jia .w { color: #8C2F2F; }
  .gw.jia .ex { color: #8C2F2F; }
  .gw .tag {
    font-size: 11px; color: #8C2F2F;
    border: 1px solid rgba(140,47,47,.4);
    border-radius: 5px; padding: 0 5px; margin-left: 5px; vertical-align: 3px;
  }

  .big-btn {
    display: block; width: 100%; height: 54px; margin: 24px 0 0;
    border: none; border-radius: 14px;
    background: #8C2F2F; color: #FBF7F0;
    font-size: 17px; font-weight: 700; letter-spacing: 4px;
  }
  .big-btn.ghost {
    background: transparent; color: #6B6255;
    border: 1px solid rgba(90,80,60,.25);
  }
  .big-btn:active { opacity: .82; }

  /* ============ 背诵：模式选择 ============ */
  .mask {
    position: fixed; inset: 0; background: rgba(30,26,20,.5);
    z-index: 200; display: none; align-items: flex-end;
  }
  .mask.on { display: flex; }
  .sheet {
    width: 100%; background: #FBF7F0;
    border-radius: 22px 22px 0 0;
    padding: 24px 20px 30px;
    animation: up .22s ease-out;
  }
  @keyframes up { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
  .sheet h3 {
    margin: 0 0 6px; font-size: 18px; letter-spacing: 3px;
    text-align: center; color: #2A2622; font-weight: 700;
  }
  .sheet .hint {
    text-align: center; font-size: 12px; color: #A79C88;
    margin-bottom: 20px; letter-spacing: 1px;
  }
  .mode-btn {
    display: flex; align-items: center; gap: 14px;
    width: 100%; text-align: left;
    background: rgba(255,253,248,.8);
    border: 1px solid rgba(120,105,80,.16);
    border-radius: 14px; padding: 16px; margin-bottom: 11px;
  }
  .mode-btn .ic {
    width: 42px; height: 42px; flex: 0 0 42px; border-radius: 12px;
    background: rgba(140,47,47,.08); color: #8C2F2F;
    display: flex; align-items: center; justify-content: center; font-size: 20px;
  }
  .mode-btn .t1 { font-size: 16px; font-weight: 700; letter-spacing: 2px; }
  .mode-btn .t2 { font-size: 12px; color: #9A9080; margin-top: 4px; letter-spacing: .5px; }
  .mode-btn:active { background: rgba(255,253,248,1); }

  /* ============ 填空拖拽 ============ */
  .fill { padding: 16px 14px 0; position: relative; z-index: 1; }
  .fill-tip {
    font-size: 12px; color: #9A9080; letter-spacing: 1px;
    text-align: center; margin-bottom: 14px; line-height: 1.9;
  }
  .slots { margin-bottom: 20px; }
  .slot {
    display: flex; align-items: center; gap: 12px;
    min-height: 68px; margin-bottom: 10px;
    border: 1px dashed rgba(120,105,80,.32);
    border-radius: 13px; padding: 11px 14px;
    background: rgba(255,253,248,.5);
    transition: background .15s, border-color .15s;
    /* 没有这句的话，从槽里往外拖会被浏览器当成"滚动页面"给吃掉 */
    touch-action: none;
  }
  .slot .no {
    font-size: 13px; color: #B5AA96; flex: 0 0 22px;
    font-family: -apple-system, sans-serif;
  }
  .slot .txt {
    font-size: 22px; letter-spacing: 3px; color: #2A2622; flex: 1;
  }
  .slot.filled { border-style: solid; border-color: rgba(120,105,80,.25); background: rgba(255,253,248,.95); }
  .slot.over { border-color: #8C2F2F; background: rgba(140,47,47,.06); }
  .slot.ok { border-color: #2E7D6B; background: rgba(46,125,107,.07); }
  .slot.bad { border-color: #B33A3A; background: rgba(179,58,58,.07); }
  .slot.ok .txt { color: #2E7D6B; }
  .slot.bad .txt { color: #B33A3A; }
  .slot .ph { font-size: 15px; color: #C4BAA6; letter-spacing: 2px; }
  .slot.dragging { opacity: .35; }

  .pool-title {
    font-size: 13px; color: #9A9080; letter-spacing: 4px;
    text-align: center; margin: 22px 0 12px;
  }
  .pool {
    display: flex; flex-wrap: wrap; gap: 11px;
    padding: 14px; border-radius: 15px;
    background: rgba(120,105,80,.05);
    min-height: 74px;
  }
  .piece {
    font-size: 21px; letter-spacing: 3px; color: #2A2622;
    background: rgba(255,253,248,.95);
    border: 1px solid rgba(120,105,80,.2);
    border-radius: 11px; padding: 13px 16px;
    box-shadow: 0 1px 4px rgba(120,100,70,.07);
    touch-action: none; user-select: none;
  }
  .piece.dragging { opacity: .25; }
  /* 拖动时跟着手指走的"幽灵"元素。
     注意：类名千万不要叫 .ghost —— 会和上面 .tbtn.ghost（镂空按钮）
     撞车，把顶栏按钮变成 position:fixed 加 pointer-events:none。 */
  .drag-ghost {
    position: fixed; z-index: 500; pointer-events: none;
    font-size: 17px; letter-spacing: 2px; color: #2A2622;
    background: rgba(255,253,248,.98);
    border: 1px solid #8C2F2F; border-radius: 10px;
    padding: 10px 13px; box-shadow: 0 8px 22px rgba(60,40,20,.22);
    transform: translate(-50%, -50%);
  }
  .piece.used { display: none; }

  /* ============ 全文默写 ============ */
  /* 内容不挤在最上面：上边留白，让默写区落在大约上三分之一处 */
  .write { padding: 34px 16px 0; position: relative; z-index: 1; }
  .w-prog {
    display: flex; align-items: center; gap: 12px;
    font-size: 14px; color: #9A9080; margin-bottom: 30px;
    font-family: -apple-system, sans-serif;
  }
  .w-bar { flex: 1; height: 7px; border-radius: 99px; background: rgba(120,105,80,.16); overflow: hidden; }
  .w-bar i { display: block; height: 100%; background: #2E7D6B; border-radius: 99px; transition: width .2s; }
  .w-err { color: #C0392B; font-weight: 700; }

  /* 一句一行 */
  .w-line {
    display: flex; justify-content: center; flex-wrap: nowrap;
    gap: 9px; margin-bottom: 18px;
  }
  .w-ch {
    width: 50px; height: 62px; flex: 0 0 50px;
    border: none; border-bottom: 3px solid rgba(120,105,80,.3);
    background: transparent; border-radius: 9px 9px 0 0;
    text-align: center; font-family: inherit;
    font-size: 31px; color: #2A2622; letter-spacing: 0;
    padding: 0; outline: none;
    -webkit-appearance: none; appearance: none;
  }
  .w-ch:focus { background: rgba(140,47,47,.06); border-bottom-color: #8C2F2F; }
  .w-ch.ok { color: #2E7D6B; border-bottom-color: #2E7D6B; }
  .w-ch.bad { color: #C0392B; background: rgba(192,57,43,.09); border-bottom-color: #C0392B; }
  .w-hint {
    text-align: center; font-size: 13px; color: #B5AA96;
    letter-spacing: 1px; margin-top: 24px; line-height: 2;
  }

  /* ============ 导入页 ============ */
  .imp { padding: 16px 16px 0; position: relative; z-index: 1; }
  .card {
    background: rgba(255,253,248,.78);
    border: 1px solid rgba(120,105,80,.14);
    border-radius: 14px; padding: 16px; margin-bottom: 14px;
  }
  .card h4 {
    margin: 0 0 10px; font-size: 15px; letter-spacing: 2px; color: #2A2622;
  }
  .card p { margin: 0 0 8px; font-size: 13px; line-height: 1.95; color: #5C5448; letter-spacing: .5px; }
  .card code, .spec {
    font-family: Consolas, Menlo, monospace;
    font-size: 11.5px; line-height: 1.85; color: #4A4438;
    background: rgba(120,105,80,.07);
    border-radius: 9px; padding: 12px; display: block;
    white-space: pre-wrap; word-break: break-all;
    max-height: 260px; overflow: auto;
  }
  .mini-btn {
    border: 1px solid rgba(140,47,47,.35); background: transparent;
    color: #8C2F2F; border-radius: 9px; padding: 8px 14px;
    font-size: 13px; font-weight: 700; margin-top: 10px;
  }
  .mini-btn:active { opacity: .7; }

  .toast {
    position: fixed; left: 50%; bottom: 46px; transform: translateX(-50%);
    background: rgba(42,38,34,.93); color: #FBF7F0;
    padding: 13px 20px; border-radius: 12px;
    font-size: 13px; line-height: 1.75; letter-spacing: .5px;
    max-width: 84%; text-align: center; z-index: 300;
    opacity: 0; transition: opacity .22s; pointer-events: none;
    font-family: -apple-system, "PingFang SC", sans-serif;
  }
  .toast.on { opacity: 1; }
</style>
</head>
<body>

<div class="ink-ring a"></div>
<div class="ink-ring b"></div>

  <!-- ============ 列表 ============ -->
  <div class="screen on" id="scr-list">
    <div class="topbar">
      <div class="brand">古诗文<small>诵 读 与 默 写</small></div>
      <div class="sp"></div>
      <button class="tbtn ghost" id="btnHome">首页</button>
      <button class="tbtn solid" id="btnImport">导入</button>
    </div>
    <div class="list" id="poemList"></div>
  </div>

  <!-- ============ 详情 ============ -->
  <div class="screen" id="scr-detail">
    <div class="topbar">
      <button class="tbtn ghost" id="btnBackList">‹ 返回</button>
      <div class="sp"></div>
      <button class="tbtn ghost" id="btnHome2">首页</button>
      <button class="tbtn solid" id="btnRecite">背诵</button>
    </div>
    <div class="detail" id="detailBody"></div>
  </div>

  <!-- ============ 填空拖拽 ============ -->
  <div class="screen" id="scr-fill">
    <div class="topbar">
      <button class="tbtn ghost" id="btnFillBack">‹ 返回</button>
      <div class="sp"></div>
      <button class="tbtn ghost" id="btnFillReset">重来</button>
    </div>
    <div class="fill">
      <div class="fill-tip">把下面打乱的诗句，拖到上面正确的位置</div>
      <div class="slots" id="fillSlots"></div>
      <div class="pool-title">待 选 诗 句</div>
      <div class="pool" id="fillPool"></div>
    </div>
  </div>

  <!-- ============ 全文默写 ============ -->
  <div class="screen" id="scr-write">
    <div class="topbar">
      <button class="tbtn ghost" id="btnWriteBack">‹ 返回</button>
      <div class="sp"></div>
      <button class="tbtn ghost" id="btnWriteReveal">对答案</button>
    </div>
    <div class="write">
      <div class="w-prog">
        <span id="wProgText">0 / 0</span>
        <div class="w-bar"><i id="wProgBar" style="width:0%"></i></div>
        <span id="wErrText"></span>
      </div>
      <div id="writeBody"></div>
      <div class="w-hint">点格子直接敲字，敲错会变红<br>按退格键可以删掉上一个字</div>
    </div>
  </div>

  <!-- ============ 导入 ============ -->
  <div class="screen" id="scr-import">
    <div class="topbar">
      <button class="tbtn ghost" id="btnImpBack">‹ 返回</button>
      <div class="sp"></div>
      <button class="tbtn ghost" id="btnImpHome">首页</button>
    </div>
    <div class="imp">
      <div class="card">
        <h4>第 一 步 ：让 AI 生成 .txt 文件</h4>
        <p>把下面这段提示词复制给任意 AI（DeepSeek、豆包、ChatGPT 都行）。
           它会<b>直接生成一个 .txt 文件</b>给你下载 —— 下载下来，到第三步导入就行。<br>
           如果那个 AI 只能输出文字、产不了文件，就把内容复制到记事本里，
           存成 <b>.txt</b>（编码选 UTF-8）。</p>
        <button class="mini-btn" id="btnCopyPrompt">复制提示词</button>
        <div class="spec" id="promptBox"></div>
      </div>

      <div class="card">
        <h4>第 二 步 ：生成的文件长这样</h4>
        <p>如果 AI 生成的不太对，你也可以自己用记事本改。一个 .txt 文件里可以放很多首。</p>
        <div class="spec" id="specBox"></div>
      </div>

      <div class="card">
        <h4>第 三 步 ：导入</h4>
        <p>选那个 <b>.txt</b> 文件就行。导入的诗词会和你已有的合并（同名同作者的会覆盖）。</p>
        <button class="big-btn" id="btnPickFile" style="margin-top:14px">选择文件导入</button>
        <button class="big-btn ghost" id="btnClearAll" style="margin-top:10px;height:46px;font-size:14px">清空全部诗词</button>
      </div>
    </div>
  </div>

  <!-- 背诵模式选择 -->
  <div class="mask" id="modeMask">
    <div class="sheet">
      <h3 id="modeTitle">选择背诵方式</h3>
      <div class="hint">两种方式，先易后难</div>
      <button class="mode-btn" id="modeFill">
        <span class="ic">⇅</span>
        <span>
          <span class="t1">填空拖拽</span>
          <span class="t2" style="display:block">诗句打乱，拖到正确的位置</span>
        </span>
      </button>
      <button class="mode-btn" id="modeWrite">
        <span class="ic">✎</span>
        <span>
          <span class="t1">全文默写</span>
          <span class="t2" style="display:block">自己手敲全文，敲错立刻变红</span>
        </span>
      </button>
      <button class="big-btn ghost" id="modeDelete" style="margin-top:6px;height:46px;font-size:14px;color:#B33A3A;border-color:rgba(179,58,58,.35)">删 除 这 首</button>
      <button class="big-btn ghost" id="modeCancel" style="margin-top:10px;height:46px;font-size:14px">取消</button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
  // ============================================================
  //  存储
  // ============================================================
  var KEY_POEMS = 'gs-poems-v1';
  var KEY_PROG  = 'gs-progress-v1';

  var poems = [];       // [{id, title, author, dynasty, genre, body[], trans[], appreciation[], words[]}]
  var progress = {};    // { poemId: { fill:true, write:true } }

  function loadStore() {
    try { poems = JSON.parse(localStorage.getItem(KEY_POEMS) || 'null') || []; }
    catch (e) { poems = []; }
    try { progress = JSON.parse(localStorage.getItem(KEY_PROG) || '{}') || {}; }
    catch (e) { progress = {}; }
    if (!poems.length) { poems = SAMPLE_POEMS.slice(); savePoems(); }
  }
  function savePoems() {
    try { localStorage.setItem(KEY_POEMS, JSON.stringify(poems)); } catch (e) {}
  }
  function saveProg() {
    try { localStorage.setItem(KEY_PROG, JSON.stringify(progress)); } catch (e) {}
  }
  function progOf(id) {
    if (!progress[id]) progress[id] = {};
    return progress[id];
  }

  function toast(text, ms) {
    var el = document.getElementById('toast');
    el.innerHTML = text;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('on'); }, ms || 2600);
  }

  // ============================================================
  //  内置示例（第一首，让你打开就有东西看）
  // ============================================================
  var SAMPLE_POEMS = [
    {
      id: 'sample-jingyesi',
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      genre: '五言绝句',
      body: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'],
      trans: [
        '明亮的月光洒在床前，好像地上泛起了一层白霜。',
        '我抬起头望着天上的明月，低下头思念起故乡。'
      ],
      appreciation: [
        '这是写思乡之情最著名的一首小诗。全篇只有二十个字，没有用一个生僻的典故，却把"月夜思乡"这个中国人共有的情感写得人人能懂。',
        '"疑是地上霜"是错觉：月色太亮、夜太静，才会把地上的月光错看成霜。一个"疑"字，写尽了深夜独处时的恍惚。',
        '"举头"与"低头"两个动作对着写：抬头是望月，低头是思乡。动作越简单，情感越沉。'
      ],
      words: [
        { w: '床前', py: 'chuáng qián', ex: '"床"在这里不是睡觉的床，古人多指井栏或坐具。' },
        { w: '疑', py: 'yí', ex: '好像、以为。' },
        { w: '举头', py: 'jǔ tóu', ex: '抬起头。' },
        { w: '思', py: 'sī', ex: '思念、怀念。' }
      ]
    },
    {
      id: 'sample-chunxiao',
      title: '春晓',
      author: '孟浩然',
      dynasty: '唐',
      genre: '五言绝句',
      body: ['春眠不觉晓，处处闻啼鸟。', '夜来风雨声，花落知多少。'],
      trans: [
        '春天睡得香甜，不知不觉天就亮了，醒来只听见处处都是鸟叫。',
        '想起昨夜隐约的风雨声，不知道院子里的花被吹落了多少。'
      ],
      appreciation: [
        '全诗写的是"醒来那一瞬间"的感受，没有一句描写眼前的景物，全靠听觉和猜想。',
        '"不觉晓"三个字写尽春睡的酣畅；"处处闻啼鸟"是听觉；"夜来风雨声"是回忆；最后一句"花落知多少"是揣测。',
        '整首诗由近及远、由实到虚，把惜春之情藏在一句轻描淡写的疑问里，这正是唐诗含蓄的高明处。'
      ],
      words: [
        { w: '不觉晓', py: 'bù jué xiǎo', ex: '不知不觉天就亮了。晓：天亮。' },
        { w: '闻', py: 'wén', ex: '听见。（不是"闻气味"）' },
        { w: '啼鸟', py: 'tí niǎo', ex: '鸟叫。这里是倒装，即"鸟啼"。' }
      ]
    }
  ];

  // ============================================================
  //  格式说明 + AI 提示词
  // ============================================================
  var FORMAT_SPEC = [
    '【标题】静夜思',
    '【作者】李白',
    '【朝代】唐',
    '【体裁】五言绝句',
    '',
    '【正文】',
    '床前明月光，疑是地上霜。',
    '举头望明月，低头思故乡。',
    '',
    '【翻译】',
    '明亮的月光洒在床前，好像地上泛起了一层白霜。',
    '我抬起头望着天上的明月，低下头思念起故乡。',
    '',
    '【鉴赏】',
    '这首诗写的是在寂静的月夜思念家乡的感受……',
    '',
    '【字词】',
    '床前 | "床"在这里不是睡觉的床，古人多指井栏或坐具。',
    '疑 | 好像、以为。',
    '举头 | 抬起头。',
    '',
    '（一篇写完，紧接着写下一篇的【标题】就行，',
    '  一个文件里可以放很多首）'
  ].join('\n');

  var AI_PROMPT = [
    '你是古诗文资料整理助手。我要把古诗文导入一个背诵 App，这个 App 只认一种文件：',
    '',
    '    ★ UTF-8 编码的【纯文本文件】，后缀名必须是 .txt ★',
    '',
    '所以请你【直接生成这个 .txt 文件，作为文件交付给我下载】，',
    '不要只在聊天窗口里输出文字。',
    '',
    '对交付物的要求：',
    '',
    '1. 不要生成 Word、PDF、Excel 这类文件，也不要只在聊天里输出 ——',
    '   请直接生成一个 UTF-8 编码的 .txt 文件并交付给我',
    '2. 文件内容不要用 Markdown 语法（不要 # 标题、不要 ** 加粗、不要表格）',
    '3. 文件内容不要加代码块围栏（也就是不要写三个反引号）',
    '4. 文件第一行就是【标题】，前面不要写"好的，以下是为您整理的……"这类话',
    '5. 每个【】都必须用中文全角方括号，不要用 [ ]',
    '6. 一次生成不完，就分成几个 .txt 文件，每个文件都从【标题】开始',
    '',
    '（只有在你所在的平台完全无法生成文件时，才退而求其次：',
    '  把完整内容放进一个代码块里，代码块之外不要加任何解释文字，方便我整体复制）',
    '',
    '===== 文件里每一篇的写法（必须完全一致）=====',
    '',
    '【标题】诗的标题',
    '【作者】作者名（无名氏就写"佚名"）',
    '【朝代】朝代（如 唐 / 宋 / 先秦）',
    '【体裁】体裁（如 五言绝句 / 七言律诗 / 词·水调歌头）',
    '',
    '【正文】',
    '第一句，',
    '第二句，',
    '（每句独占一行，标点用中文全角，和通行版本一致）',
    '',
    '【翻译】',
    '第一句的白话翻译。',
    '第二句的白话翻译。',
    '（每句一行，顺序必须和【正文】严格一一对应；正文有几句，这里就有几行）',
    '',
    '【鉴赏】',
    '一段或两段，200~400 字。讲清楚：写了什么景、抒了什么情、',
    '用了什么手法（如动静结合、以景结情、借代、用典），以及它好在哪里。',
    '不要写成作者生平介绍。',
    '',
    '【字词】',
    '词条 | 解释',
    '词条 | 解释',
    '',
    '===== 【字词】这一节的写法（很重要）=====' ,
    '1. 每行一条，用两个部分，中间用半角竖线 | 隔开：词条 | 解释',
    '2. 顺序是：先列【通假字】，再列【关键词】，最后列【生僻字】',
    '3. 通假字的解释必须写成这种形式：  通「本字」，意思',
    '   例如：尊 | 通「樽」，酒杯',
    '   例如：蚤 | 通「早」，早上',
    '4. 解释要直白，一句话说完，20 字以内最好',
    '5. 挑 3~8 个理解全篇必须知道的词，不要把所有字都列上',
    '6. 不要写拼音',
    '',
    '===== 内容要求 =====',
    '- 正文必须是通行版本，不要自己改字',
    '- 翻译要通顺自然，不要逐字硬译',
    '- 不要编造典故，不确定的就不写',
    '',
    '===== 现在请整理以下篇目 =====',
    '（在这里写你要的篇目，例如：静夜思、春晓、登鹳雀楼……）',
    '',
    '如果一次输出太长被截断，就分几次输出，每次从【标题】开始完整输出若干篇即可。'
  ].join('\n');

  // ============================================================
  //  解析器（写得很宽容，AI 生成的小毛病都能救回来）
  // ============================================================
  var SECTION_ALIAS = {
    '标题': 'title', '题目': 'title', '诗名': 'title', '名称': 'title',
    '作者': 'author', '诗人': 'author',
    '朝代': 'dynasty', '年代': 'dynasty', '时期': 'dynasty',
    '体裁': 'genre', '类型': 'genre',
    '正文': 'body', '原文': 'body', '诗文': 'body', '内容': 'body',
    '翻译': 'trans', '译文': 'trans', '白话': 'trans', '白话翻译': 'trans',
    '鉴赏': 'appreciation', '赏析': 'appreciation', '讲解': 'appreciation',
    '解析': 'appreciation', '评析': 'appreciation',
    '字词': 'words', '注释': 'words', '字词注释': 'words', '词语': 'words',
    '通假字': 'words', '注音': 'words', '重点字词': 'words'
  };

  // 去掉行首的标记，取出节名。
  // AI 输出的花样很多，这里认三种写法：
  //   ① 【正文】 / [正文] / 【正文】：      最标准的
  //   ② ## 正文 / # 正文                    万一 AI 用了 Markdown
  //   ③ 正文：                               纯冒号（只在节名是已知别名时才认，免得把诗句认成节名）
  function sectionName(line) {
    var s = String(line || '').trim();
    var m = s.match(/^[【\[]\s*([^】\]]{1,12}?)\s*[】\]]\s*[:：]?\s*(.*)$/);
    if (m) return { name: m[1].trim(), rest: m[2].trim() };

    m = s.match(/^#{1,4}\s*([^\s#:：]{1,12})\s*[:：]?\s*(.*)$/);
    if (m && SECTION_ALIAS[m[1].trim()]) return { name: m[1].trim(), rest: m[2].trim() };

    m = s.match(/^([^\s:：]{1,8})\s*[:：]\s*(.*)$/);
    if (m && SECTION_ALIAS[m[1].trim()]) return { name: m[1].trim(), rest: m[2].trim() };

    return null;
  }

  function normalizePunct(s) {
    return String(s || '')
      .replace(/[，,]/g, '，').replace(/[。.]/g, '。')
      .replace(/[！!]/g, '！').replace(/[？?]/g, '？')
      .replace(/[；;]/g, '；').replace(/[：:]/g, '：')
      .trim();
  }

  function parsePoems(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var cur = null;
    var sect = null;      // 正在收哪个"多行小节"（正文/翻译/鉴赏/字词）
    var pending = null;   // 正在等下一行来填的"单值字段"（标题/作者/朝代/体裁）

    function push() {
      if (cur && cur.title && cur.body.length) out.push(finishPoem(cur));
      cur = null;
    }
    function startNew() {
      push();
      cur = { title: '', author: '', dynasty: '', genre: '',
              body: [], trans: [], appreciation: [], words: [] };
      sect = null;
      pending = null;
    }

    // 把一行文字分配给当前的字段或小节
    function takeText(t) {
      if (!cur) return;
      if (pending) { cur[pending] = t; pending = null; return; }
      if (sect === 'body') cur.body.push(normalizePunct(t));
      else if (sect === 'trans') cur.trans.push(t);
      else if (sect === 'appreciation') cur.appreciation.push(t);
      else if (sect === 'words') {
        var w = parseWordLine(t);
        if (w) cur.words.push(w);
      }
      // sect 和 pending 都为空时，这行是游离文字，直接丢掉
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+$/, '');
      var sec = sectionName(line);

      if (sec) {
        var key = SECTION_ALIAS[sec.name];
        if (key) {
          if (key === 'title') {
            startNew();
            // 【标题】静夜思  → 同一行就有；  ## 标题 换行 静夜思 → 等下一行
            if (sec.rest) cur.title = sec.rest;
            else pending = 'title';
            continue;
          }

          if (!cur) startNew();

          if (key === 'body' || key === 'trans' || key === 'appreciation' || key === 'words') {
            sect = key;
            pending = null;
            if (sec.rest) takeText(sec.rest);   // 【正文】后面同一行还有内容
          } else {
            if (sec.rest) { cur[key] = sec.rest; pending = null; }
            else pending = key;
            sect = null;
          }
          continue;
        }
      }

      var t = line.trim();
      if (!t) continue;
      takeText(t);
    }

    push();
    return out;
  }

  // 词条 | 解释          （现在的格式，两段）
  // 词条 | 拼音 | 解释    （老的格式也认，拼音会被摘出来但不显示）
  // 竖线中英文都认，也容忍用两个以上空格分隔
  function parseWordLine(line) {
    var parts = line.split(/\s*[|｜]\s*/).map(function (s) { return s.trim(); });
    if (parts.length < 2) parts = line.split(/\s{2,}/).map(function (s) { return s.trim(); });

    var w = (parts[0] || '').trim();
    if (!w) return null;
    if (parts.length === 1) return { w: w, py: '', ex: '' };

    var rest = parts.slice(1);
    var py = '';
    // 第一段如果长得像拼音（纯字母 + 声调符号），就当成注音摘出来
    if (rest.length >= 2 && /^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ0-9\s'·-]+$/.test(rest[0])) {
      py = rest.shift();
    }
    return { w: w, py: py, ex: rest.join(' | ') };
  }

  function finishPoem(p) {
    p.title = String(p.title || '').trim() || '无题';
    p.author = String(p.author || '').trim() || '佚名';
    p.dynasty = String(p.dynasty || '').trim();
    p.genre = String(p.genre || '').trim();
    // 翻译如果只有一段而正文有多句，就按句子拆开，保证一一对应
    if (p.trans.length === 1 && p.body.length > 1) {
      var seg = p.trans[0].split(/(?<=[。！？])/).filter(function (s) { return s.trim(); });
      if (seg.length === p.body.length) p.trans = seg.map(function (s) { return s.trim(); });
    }
    p.id = 'p-' + hashStr(p.title + '|' + p.author);
    return p;
  }

  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // ============================================================
  //  界面切换
  // ============================================================
  var scr = 'list';
  function show(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    document.getElementById('scr-' + name).classList.add('on');
    scr = name;
    window.scrollTo(0, 0);
  }

  function dotClass(id) {
    var pr = progress[id] || {};
    if (pr.write) return 'done';
    if (pr.fill) return 'half';
    return '';
  }

  // ============================================================
  //  列表
  // ============================================================
  function renderList() {
    var box = document.getElementById('poemList');
    if (!poems.length) {
      box.innerHTML = '<div class="empty"><span class="big">📜</span>'
        + '还没有诗词<br>点右上角「导入」<br>让 AI 生成一个 txt 导进来</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < poems.length; i++) {
      var p = poems[i];
      var meta = [p.author, p.dynasty, p.genre].filter(Boolean).join(' · ');
      html += '<button class="prow" data-id="' + p.id + '">'
            +   '<span class="mid">'
            +     '<span class="nm">' + esc(p.title) + '</span>'
            +     '<span class="sub">' + esc(meta) + '</span>'
            +   '</span>'
            +   '<span class="dot ' + dotClass(p.id) + '">' + (dotClass(p.id) === 'done' ? '✓' : '') + '</span>'
            + '</button>';
    }
    box.innerHTML = html;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findPoem(id) {
    for (var i = 0; i < poems.length; i++) if (poems[i].id === id) return poems[i];
    return null;
  }

  // ============================================================
  //  详情
  // ============================================================
  var curPoem = null;

  function renderDetail(p) {
    curPoem = p;
    var meta = [p.dynasty, p.author, p.genre].filter(Boolean).join(' · ');

    var html = '<div class="d-title">' + esc(p.title) + '</div>'
             + '<div class="d-meta">' + esc(meta) + '</div>';

    html += '<div class="d-divider"><span class="ln"></span><span class="tx">原 文</span><span class="ln"></span></div>';
    html += '<div class="d-body">';
    for (var i = 0; i < p.body.length; i++) html += '<p>' + esc(p.body[i]) + '</p>';
    html += '</div>';

    if (p.trans.length) {
      html += '<div class="d-divider"><span class="ln"></span><span class="tx">翻 译</span><span class="ln"></span></div>';
      html += '<div class="d-block">';
      for (var j = 0; j < p.trans.length; j++) html += '<p>' + esc(p.trans[j]) + '</p>';
      html += '</div>';
    }

    if (p.appreciation.length) {
      html += '<div class="d-divider"><span class="ln"></span><span class="tx">鉴 赏</span><span class="ln"></span></div>';
      html += '<div class="d-block">';
      for (var k = 0; k < p.appreciation.length; k++) html += '<p>' + esc(p.appreciation[k]) + '</p>';
      html += '</div>';
    }

    if (p.words.length) {
      html += '<div class="d-divider"><span class="ln"></span><span class="tx">字 词</span><span class="ln"></span></div>';
      for (var m = 0; m < p.words.length; m++) {
        var w = p.words[m];
        var isJia = /通\s*[「『"']/.test(w.ex || '');
        html += '<div class="gw' + (isJia ? ' jia' : '') + '">'
              +   '<div class="w">' + esc(w.w) + (isJia ? '<span class="tag">通假</span>' : '') + '</div>'
              +   '<div class="ex">' + esc(w.ex) + '</div>'
              + '</div>';
      }
    }

    // 背诵按钮只留右上角那个，这里不放按钮了
    html += '<div style="height:36px"></div>';

    document.getElementById('detailBody').innerHTML = html;
  }

  function deleteCurPoem() {
    var p = curPoem;
    if (!p) return;
    poems = poems.filter(function (x) { return x.id !== p.id; });
    delete progress[p.id];
    savePoems(); saveProg();
    renderList(); show('list');
    toast('已删除「' + esc(p.title) + '」');
  }

  // ============================================================
  //  把诗句切成"背诵单位"
  //  五言/七言这种短句整句作为一个单位；长句按逗号再切
  // ============================================================
  function bodyUnits(p) {
    var units = [];
    for (var i = 0; i < p.body.length; i++) {
      var s = p.body[i];
      // 一行里如果有多句（用逗号/句号分开的），每句当一个单位
      var seg = s.split(/(?<=[，。！？；])/).map(function (x) { return x.trim(); })
                 .filter(function (x) { return x.length; });
      for (var j = 0; j < seg.length; j++) units.push(seg[j]);
    }
    return units;
  }

  // ============================================================
  //  填空拖拽
  // ============================================================
  var F = null;

  function startFill(p) {
    var units = bodyUnits(p);
    var order = [];
    for (var i = 0; i < units.length; i++) order.push(i);
    // 洗牌（尽量保证不是原顺序）
    for (var t = 0; t < 30; t++) {
      for (var k = order.length - 1; k > 0; k--) {
        var r = Math.floor(Math.random() * (k + 1));
        var tmp = order[k]; order[k] = order[r]; order[r] = tmp;
      }
      var same = true;
      for (var q = 0; q < order.length; q++) if (order[q] !== q) { same = false; break; }
      if (!same) break;
    }

    F = {
      poem: p,
      units: units,
      slots: new Array(units.length).fill(-1),   // 槽 -> 单位号
      pool: order.slice(),                        // 待选的单位号
      checked: false
    };
    renderFill();
    show('fill');
  }

  function renderFill() {
    var slots = document.getElementById('fillSlots');
    var sh = '';
    for (var i = 0; i < F.slots.length; i++) {
      var u = F.slots[i];
      var cls = 'slot' + (u >= 0 ? ' filled' : '');
      if (F.checked && u >= 0) cls += (u === i ? ' ok' : ' bad');
      sh += '<div class="' + cls + '" data-slot="' + i + '">'
          +   '<span class="no">' + (i + 1) + '</span>'
          +   (u >= 0
                ? '<span class="txt">' + esc(F.units[u]) + '</span>'
                : '<span class="ph">拖到这里</span>')
          + '</div>';
    }
    slots.innerHTML = sh;

    var pool = document.getElementById('fillPool');
    var ph = '';
    for (var j = 0; j < F.pool.length; j++) {
      var k = F.pool[j];
      ph += '<button class="piece" data-unit="' + k + '">' + esc(F.units[k]) + '</button>';
    }
    pool.innerHTML = ph || '<span style="font-size:12px;color:#B5AA96;padding:8px">都放上去了</span>';
  }

  function fillDone() {
    for (var i = 0; i < F.slots.length; i++) if (F.slots[i] < 0) return false;
    return true;
  }

  function checkFill() {
    F.checked = true;
    renderFill();
    var wrong = 0;
    for (var i = 0; i < F.slots.length; i++) if (F.slots[i] !== i) wrong++;
    if (wrong === 0) {
      progOf(F.poem.id).fill = true;
      saveProg();
      renderList();
      toast('全部正确！这首诗的句子顺序你已经记住了', 3200);
    } else {
      toast('有 <b>' + wrong + '</b> 处放错了（红色的），点错的格子可以拿回来重放', 3600);
    }
  }

  // ---- 拖拽（用指针事件，触摸和鼠标都能用）----
  //
  // 待选区里的句子可以拖；【已经放到槽里的句子也能再拖】——
  // 拖到别的槽就换位，拖到空地上就退回待选区。
  // 注意：检查过之后不能锁死，否则放错了就再也改不了了。
  var drag = null;

  function beginDrag(e, unit, from) {
    if (!F) return;
    var ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = F.units[unit];
    document.body.appendChild(ghost);

    drag = {
      unit: unit,
      from: from,                 // 'pool' 或槽的序号
      ghost: ghost,
      slot: -1,
      x0: e.clientX, y0: e.clientY,
      moved: false
    };
    var src = e.target.closest ? e.target.closest('.piece, .slot') : null;
    if (src) src.classList.add('dragging');
    moveGhost(e.clientX, e.clientY);
    e.preventDefault();
  }

  function moveGhost(x, y) {
    if (!drag) return;
    drag.ghost.style.left = x + 'px';
    drag.ghost.style.top = y + 'px';
    if (Math.abs(x - drag.x0) > 8 || Math.abs(y - drag.y0) > 8) drag.moved = true;

    var el = document.elementFromPoint(x, y);
    var slot = el && el.closest ? el.closest('.slot') : null;
    var all = document.querySelectorAll('#fillSlots .slot');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('over');
    drag.slot = -1;
    if (slot) {
      drag.slot = parseInt(slot.getAttribute('data-slot'), 10);
      slot.classList.add('over');
    }
  }

  function endDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);

    var all = document.querySelectorAll('#fillSlots .slot');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('over');
    var marked = document.querySelectorAll('.dragging');
    for (var j = 0; j < marked.length; j++) marked[j].classList.remove('dragging');

    var fromSlot = (typeof d.from === 'number');
    var toPool = function (u) { if (u >= 0 && F.pool.indexOf(u) < 0) F.pool.push(u); };

    // 单纯点一下（没移动）而且是槽里的：退回待选区
    if (!d.moved && fromSlot) {
      F.slots[d.from] = -1;
      toPool(d.unit);
      F.checked = false;
      renderFill();
      return;
    }

    // 丢到没有槽的地方 → 退回待选区
    if (d.slot < 0) {
      if (fromSlot) F.slots[d.from] = -1;
      toPool(d.unit);
      F.checked = false;
      renderFill();
      return;
    }

    var old = F.slots[d.slot];

    if (fromSlot) {
      // 槽 → 槽：直接换位（目标原来空着的话，源槽就空了）
      F.slots[d.slot] = d.unit;
      F.slots[d.from] = old;
      if (old >= 0) {
        F.pool = F.pool.filter(function (x) { return x !== old; });
      }
    } else {
      // 待选区 → 槽：槽里原来那个退回待选区
      F.slots[d.slot] = d.unit;
      F.pool = F.pool.filter(function (x) { return x !== d.unit; });
      toPool(old);
    }

    F.checked = false;
    renderFill();
    if (fillDone()) checkFill();
  }

  // ============================================================
  //  全文默写
  // ============================================================
  var W = null;

  // 只留汉字/字母/数字，标点空白全部忽略 —— 这样"标点打不打"就不影响判定
  function keyChars(s) {
    return String(s || '').replace(/[^\u4e00-\u9fa5\u3400-\u4dbfa-zA-Z0-9]/g, '');
  }

  // 目标序列：按标点拆成"一句"，一句一行（五言就是每行 5 个格子）
  function buildWriteGroups(p) {
    var groups = [];
    for (var i = 0; i < p.body.length; i++) {
      var seg = String(p.body[i]).split(/[，。！？；、,.!?;]+/);
      for (var j = 0; j < seg.length; j++) {
        var ks = keyChars(seg[j]);
        if (ks.length) groups.push(ks.split(''));
      }
    }
    return groups;
  }

  var W_FLAT = [];    // 铺平后的目标字序列
  var W_START = [];   // 每一行在 W_FLAT 里的起始下标

  function flattenWrite() {
    W_FLAT = [];
    W_START = [];
    var k = 0;
    for (var g = 0; g < W.groups.length; g++) {
      W_START.push(k);
      for (var c = 0; c < W.groups[g].length; c++) {
        W_FLAT.push(W.groups[g][c]);
        k++;
      }
    }
  }

  function startWrite(p) {
    var groups = buildWriteGroups(p);
    var total = 0;
    for (var i = 0; i < groups.length; i++) total += groups[i].length;

    W = {
      poem: p,
      groups: groups,
      total: total,
      vals: new Array(total).fill(''),   // 每一格用户敲进去的字
      revealed: false,
      done: false
    };
    renderWrite();
    show('write');
    setTimeout(function () { focusBox(0); }, 320);
  }

  function renderWrite() {
    flattenWrite();
    var html = '';
    for (var g = 0; g < W.groups.length; g++) {
      html += '<div class="w-line">';
      for (var c = 0; c < W.groups[g].length; c++) {
        var k = W_START[g] + c;
        html += '<input class="w-ch" data-k="' + k + '" type="text"'
              + ' autocomplete="off" autocorrect="off" autocapitalize="off"'
              + ' spellcheck="false">';
      }
      html += '</div>';
    }
    document.getElementById('writeBody').innerHTML = html;
    for (var q = 0; q < W.vals.length; q++) paintBox(q);
    updateWriteStats();
  }

  function boxEl(k) {
    return document.querySelector('#writeBody .w-ch[data-k="' + k + '"]');
  }

  function paintBox(k) {
    var el = boxEl(k);
    if (!el) return;
    var v = W.vals[k] || '';
    if (el.value !== v) el.value = v;
    var cls = 'w-ch';
    if (v) cls += (v === W_FLAT[k] ? ' ok' : ' bad');
    if (el.className !== cls) el.className = cls;
  }

  function focusBox(k) {
    var el = boxEl(k);
    if (el) { try { el.focus(); } catch (e) {} }
  }

  // 敲完一个字，自动跳到下一个还没填的格子
  function focusNext(k) {
    for (var t = k + 1; t < W_FLAT.length; t++) {
      if (!W.vals[t]) { focusBox(t); return; }
    }
    if (k + 1 < W_FLAT.length) focusBox(k + 1);
  }

  function updateWriteStats() {
    var filled = 0, wrong = 0;
    for (var k = 0; k < W_FLAT.length; k++) {
      if (W.vals[k]) {
        filled++;
        if (W.vals[k] !== W_FLAT[k]) wrong++;
      }
    }
    document.getElementById('wProgText').textContent = filled + ' / ' + W.total;
    document.getElementById('wProgBar').style.width =
      (W.total ? Math.round(filled / W.total * 100) : 0) + '%';
    document.getElementById('wErrText').innerHTML =
      wrong ? '<span class="w-err">错 ' + wrong + '</span>' : '';

    if (!W.revealed && !W.done && filled >= W.total && wrong === 0) {
      W.done = true;
      progOf(W.poem.id).write = true;
      saveProg();
      toast('一字不差！<b>' + esc(W.poem.title) + '</b> 已经背下来了', 3400);
    }
  }

  // 直接在格子里敲字。一次进来多个字（粘贴、或者输入法一次提交一串）就往后铺开
  function onBoxInput(e) {
    var el = e.target;
    if (!el || !el.classList || !el.classList.contains('w-ch')) return;
    if (!W || W.revealed) return;
    if (e.isComposing) return;                    // 输入法还在拼，先不处理

    var k = parseInt(el.getAttribute('data-k'), 10);
    var v = keyChars(String(el.value || ''));     // 标点和空格不算
    if (!v) { el.value = ''; W.vals[k] = ''; paintBox(k); updateWriteStats(); return; }

    if (v.length > 1) {
      // 多个字：从这一格开始，一格一个字往后铺
      var last = k;
      for (var t = 0; t < v.length && (k + t) < W_FLAT.length; t++) {
        W.vals[k + t] = v[t];
        paintBox(k + t);
        last = k + t;
      }
      paintBox(k);                                // 当前格只显示第一个字
      updateWriteStats();
      focusNext(last);
      return;
    }

    W.vals[k] = v;
    paintBox(k);
    updateWriteStats();
    focusNext(k);
  }

  // 退格：格子空了就往前一格删
  function onBoxKey(e) {
    var el = e.target;
    if (!el || !el.classList || !el.classList.contains('w-ch')) return;
    if (!W || W.revealed) return;
    if (e.key !== 'Backspace') return;
    if (el.value) return;                         // 格子里有字，交给浏览器自己删

    var k = parseInt(el.getAttribute('data-k'), 10);
    if (k <= 0) return;
    e.preventDefault();
    var prev = k - 1;
    W.vals[prev] = '';
    paintBox(prev);
    updateWriteStats();
    focusBox(prev);
  }

  // 对答案：把不对的格子直接用红色填上正确答案
  function revealWrite() {
    if (!W) return;
    W.revealed = true;
    for (var k = 0; k < W_FLAT.length; k++) {
      var el = boxEl(k);
      if (!el) continue;
      if (W.vals[k] === W_FLAT[k]) { el.className = 'w-ch ok'; continue; }
      el.value = W_FLAT[k];
      el.className = 'w-ch bad';
      el.setAttribute('readonly', 'readonly');
    }
    toast('正确答案已经用红色标出来了（这一局不计入进度）', 3200);
  }

  function writeBack() {
    if (W && W.poem) { renderList(); renderDetail(W.poem); show('detail'); }
    else show('list');
  }

  // ============================================================
  //  与王之宝库的桥接（导入文件要用）
  // ============================================================
  var hostSeq = 0;
  var hostPending = {};

  function hostCall(payload) {
    return new Promise(function (resolve) {
      if (!window.ReactNativeWebView) {
        resolve({ ok: false, error: '当前不在王之宝库里运行，没法选文件' });
        return;
      }
      var id = 'h' + (++hostSeq);
      hostPending[id] = resolve;
      payload.id = id;
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    });
  }

  window.__hostResult = function (res) {
    if (!res || !res.id) return;
    var cb = hostPending[res.id];
    if (cb) { delete hostPending[res.id]; cb(res); }
  };

  // ============================================================
  //  模式选择弹层
  // ============================================================
  function openModeSheet() {
    document.getElementById('modeTitle').textContent = curPoem ? curPoem.title : '选择背诵方式';
    document.getElementById('modeMask').classList.add('on');
  }
  function closeModeSheet() {
    document.getElementById('modeMask').classList.remove('on');
  }

  // ============================================================
  //  事件
  // ============================================================
  document.getElementById('poemList').onclick = function (e) {
    var b = e.target.closest ? e.target.closest('.prow') : null;
    if (!b) return;
    var p = findPoem(b.getAttribute('data-id'));
    if (!p) return;
    renderDetail(p);
    show('detail');
  };

  document.getElementById('btnBackList').onclick = function () { renderList(); show('list'); };
  document.getElementById('btnHome').onclick = function () { renderList(); show('list'); };
  document.getElementById('btnHome2').onclick = function () { renderList(); show('list'); };
  document.getElementById('btnImpHome').onclick = function () { renderList(); show('list'); };

  document.getElementById('btnRecite').onclick = openModeSheet;
  document.getElementById('modeCancel').onclick = closeModeSheet;
  document.getElementById('modeDelete').onclick = function () {
    var b = this;
    if (b.getAttribute('data-ok') === '1') {
      closeModeSheet();
      b.removeAttribute('data-ok');
      b.textContent = '删 除 这 首';
      deleteCurPoem();
      return;
    }
    b.setAttribute('data-ok', '1');
    b.textContent = '再点一次，确认删除';
    setTimeout(function () {
      if (b.getAttribute('data-ok') === '1') {
        b.removeAttribute('data-ok');
        b.textContent = '删 除 这 首';
      }
    }, 4000);
  };
  document.getElementById('modeMask').onclick = function (e) {
    if (e.target === this) closeModeSheet();
  };
  document.getElementById('modeFill').onclick = function () {
    closeModeSheet();
    if (curPoem) startFill(curPoem);
  };
  document.getElementById('modeWrite').onclick = function () {
    closeModeSheet();
    if (curPoem) startWrite(curPoem);
  };

  // 填空页
  document.getElementById('btnFillBack').onclick = function () {
    if (F && F.poem) { renderDetail(F.poem); show('detail'); } else show('list');
  };
  document.getElementById('btnFillReset').onclick = function () {
    if (F && F.poem) startFill(F.poem);
  };

  document.getElementById('fillPool').addEventListener('pointerdown', function (e) {
    var pc = e.target.closest ? e.target.closest('.piece') : null;
    if (pc) beginDrag(e, parseInt(pc.getAttribute('data-unit'), 10), 'pool');
  });

  // 已经放进槽里的句子，也能再拖出来（换位子 / 退回待选区）
  document.getElementById('fillSlots').addEventListener('pointerdown', function (e) {
    if (!F) return;
    var sl = e.target.closest ? e.target.closest('.slot') : null;
    if (!sl) return;
    var i = parseInt(sl.getAttribute('data-slot'), 10);
    if (F.slots[i] < 0) return;
    beginDrag(e, F.slots[i], i);
  });
  document.addEventListener('pointermove', function (e) {
    if (drag) { moveGhost(e.clientX, e.clientY); e.preventDefault(); }
  }, { passive: false });
  document.addEventListener('pointerup', function () { if (drag) endDrag(); });
  document.addEventListener('pointercancel', function () { if (drag) endDrag(); });

  // 默写页：直接在格子里敲字，没有额外的输入框
  document.getElementById('btnWriteBack').onclick = writeBack;
  document.getElementById('writeBody').addEventListener('input', onBoxInput);
  document.getElementById('writeBody').addEventListener('keydown', onBoxKey);
  document.getElementById('btnWriteReveal').onclick = revealWrite;

  // 导入页
  document.getElementById('btnImport').onclick = function () {
    document.getElementById('promptBox').textContent = AI_PROMPT;
    document.getElementById('specBox').textContent = FORMAT_SPEC;
    show('import');
  };
  document.getElementById('btnImpBack').onclick = function () { renderList(); show('list'); };

  document.getElementById('btnCopyPrompt').onclick = function () {
    var btn = this;
    var done = function () { btn.textContent = '已复制 ✓'; setTimeout(function () { btn.textContent = '复制提示词'; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(AI_PROMPT).then(done, function () { fallbackCopy(AI_PROMPT, done); });
    } else {
      fallbackCopy(AI_PROMPT, done);
    }
  };

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) {
      toast('没法自动复制，请长按下面的文字手动选中复制');
    }
  }

  document.getElementById('btnPickFile').onclick = function () {
    toast('请选择 AI 生成的 txt 文件…', 20000);
    hostCall({ type: 'pickTextFile' }).then(function (res) {
      if (!res || res.canceled) { toast('已取消'); return; }
      if (!res.ok) { toast('读取失败：' + (res.error || ''), 4000); return; }

      var got = parsePoems(res.text);
      if (!got.length) {
        toast('这个文件里没解析出诗词。<br>检查一下是不是有【标题】和【正文】这两节', 5000);
        return;
      }

      // 同名同作者覆盖，其余追加
      var added = 0, replaced = 0;
      for (var i = 0; i < got.length; i++) {
        var np = got[i];
        var hit = -1;
        for (var j = 0; j < poems.length; j++) {
          if (poems[j].title === np.title && poems[j].author === np.author) { hit = j; break; }
        }
        if (hit >= 0) { poems[hit] = np; replaced++; }
        else { poems.push(np); added++; }
      }
      savePoems();
      renderList();
      show('list');
      toast('导入成功：新增 <b>' + added + '</b> 首'
            + (replaced ? '，覆盖 <b>' + replaced + '</b> 首' : ''), 3600);
    });
  };

  document.getElementById('btnClearAll').onclick = function () {
    var b = this;
    if (b.getAttribute('data-ok') === '1') {
      poems = [];
      progress = {};
      savePoems(); saveProg();
      renderList();
      b.removeAttribute('data-ok');
      b.textContent = '清空全部诗词';
      toast('已清空');
      return;
    }
    b.setAttribute('data-ok', '1');
    b.textContent = '再点一次，确认清空';
    setTimeout(function () {
      if (b.getAttribute('data-ok') === '1') {
        b.removeAttribute('data-ok');
        b.textContent = '清空全部诗词';
      }
    }, 4000);
  };

  // ---------- 启动 ----------
  loadStore();
  renderList();
</script>
</body>
</html>
`;
