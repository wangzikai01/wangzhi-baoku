// ============================================================
// zongceModule.js —— 「综测记录」模块
//
// 用来登记综测要用的证明材料：一条记录 = 名称 + 时间 + 图片
// 两个界面：添加 / 记录，记录页可以把全部内容导出成 Word（.docx）
//
// 【图片存哪】
//   localStorage 只有 4.5MB，装不下照片。所以：
//   · 图片本体（压缩后的 JPEG，Blob）→ IndexedDB，空间大得多
//   · 名称/时间/缩略图 → localStorage（都是小数据）
//
// 【Word 怎么生成】
//   .docx 其实就是个 zip，里面 word/document.xml 写正文，
//   word/media/imageN.jpg 放图片。这里手写了一个只做"存储"不压缩的
//   zip 写入器（图片本来就是压缩过的，再压没意义），
//   CRC32 是 zip 要求的，躲不掉。
// ============================================================

export const ZONGCE_MODULE_NAME = '综测记录';

export const ZONGCE_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>综测记录</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 40px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
  }
  button, input, textarea { font-family: inherit; }
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
  .tb-badge { font-size: 12px; color: #6B6B73; background: #F2F3F5; border-radius: 8px; padding: 5px 9px; }
  .tb-badge b { color: #3D5AFE; }

  .tabs { display: flex; gap: 8px; margin-top: 11px; padding-bottom: 11px; }
  .tab {
    flex: 1; height: 38px; border: none; border-radius: 10px;
    background: #F2F3F5; color: #5A5A63; font-size: 14px; font-weight: 700;
  }
  .tab.on { background: #3D5AFE; color: #FFFFFF; }
  .tab:active { opacity: .85; }

  .pad { padding: 14px; }
  .card {
    background: #FFFFFF; border-radius: 16px;
    padding: 18px; margin-bottom: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .empty { text-align: center; padding: 54px 30px; color: #A8A8B0; font-size: 14px; line-height: 2.1; }
  .empty .big { font-size: 42px; display: block; margin-bottom: 12px; opacity: .5; }

  /* ---------- 表单 ---------- */
  .lb {
    display: block; font-size: 13px; font-weight: 700; color: #6B6B73;
    margin: 0 0 8px 2px; letter-spacing: 1px;
  }
  .lb .must { color: #E23B3B; }
  .fld {
    display: block; width: 100%; height: 50px;
    border: 1px solid #E4E6EA; border-radius: 12px;
    background: #FAFBFC; color: #1A1A1A;
    font-size: 16px; padding: 0 14px; margin-bottom: 20px;
    outline: none; -webkit-appearance: none; appearance: none;
  }
  .fld:focus { border-color: #3D5AFE; background: #FFFFFF; }
  input[type=date].fld { line-height: 50px; }

  /* 选图区 */
  .picker {
    border: 2px dashed #D8DCE4; border-radius: 14px;
    background: #FAFBFC; padding: 26px 16px;
    text-align: center; color: #9A9AA2; font-size: 14px;
    line-height: 1.9; margin-bottom: 14px;
  }
  .picker .ic { font-size: 36px; display: block; margin-bottom: 8px; opacity: .55; }
  .picker.has { border-style: solid; border-color: #3D5AFE; background: #FFFFFF; padding: 10px; }
  .picker img { max-width: 100%; border-radius: 10px; display: block; }

  .pick-btns { display: flex; gap: 10px; margin-bottom: 22px; }
  /* 关键：file input 直接铺满按钮、设成透明。
     这样手指点到的是 input 本身，不用 JS 去 .click() ——
     Android WebView 里对隐藏的 file input 调 .click() 经常没反应。 */
  .pick-wrap {
    position: relative; flex: 1; height: 50px;
    border: 1px solid #E4E6EA; border-radius: 12px;
    background: #FFFFFF; overflow: hidden;
  }
  .pick-wrap .look {
    position: absolute; left: 0; top: 0; right: 0; bottom: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #3A3A42;
    pointer-events: none;
  }
  .pick-wrap input[type=file] {
    position: absolute; left: 0; top: 0;
    width: 100%; height: 100%;
    opacity: 0; z-index: 3; border: 0; padding: 0; margin: 0;
    cursor: pointer;
  }
  .pick-wrap:active { background: #F2F3F5; }

  .big-btn {
    display: block; width: 100%; height: 52px; margin-top: 6px;
    border: none; border-radius: 14px;
    background: #3D5AFE; color: #FFFFFF;
    font-size: 17px; font-weight: 800; letter-spacing: 2px;
  }
  .big-btn:active { opacity: .85; }
  .big-btn:disabled { background: #C9CED8; }
  .big-btn.ghost { background: #F2F3F5; color: #3A3A42; }

  /* ---------- 记录列表 ---------- */
  .rec {
    display: flex; gap: 13px; align-items: flex-start;
    background: #FFFFFF; border-radius: 14px;
    padding: 13px; margin-bottom: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .rec .thumb {
    width: 78px; height: 78px; flex: 0 0 78px; border-radius: 10px;
    background: #F1F2F5; object-fit: cover; display: block;
  }
  .rec .mid { flex: 1; min-width: 0; }
  .rec .nm {
    font-size: 15px; font-weight: 700; line-height: 1.5;
    word-break: break-word;
  }
  .rec .dt { font-size: 13px; color: #8A8A8E; margin-top: 7px; }
  .rec .no { font-size: 11px; color: #B5B5BC; margin-top: 5px; }
  .rec .del {
    flex: 0 0 auto; border: none; background: transparent;
    color: #C0C0C8; font-size: 20px; padding: 2px 4px; line-height: 1;
  }
  .rec .del:active { color: #E23B3B; }

  .list-head {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: #8A8A8E; margin: 2px 2px 12px;
  }
  .list-head .sp { flex: 1; }
  .mini {
    border: 1px solid #E4E6EA; background: #FFFFFF; color: #6B6B73;
    border-radius: 9px; padding: 7px 12px; font-size: 12px; font-weight: 700;
  }
  .mini.red { border-color: rgba(226,59,59,.35); color: #E23B3B; }

  .tip {
    font-size: 12px; color: #9A9AA2; line-height: 1.95;
    margin: 12px 2px 0;
  }

  /* ---------- 进度 / 提示 ---------- */
  .mask {
    position: fixed; left: 0; top: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,.4); z-index: 200;
    display: none; align-items: center; justify-content: center;
  }
  .mask.on { display: flex; }
  .mask .box {
    background: #FFFFFF; border-radius: 16px; padding: 26px 30px;
    text-align: center; font-size: 14px; color: #4A4A52; min-width: 200px;
  }
  .mask .box .sp {
    width: 30px; height: 30px; margin: 0 auto 14px;
    border: 3px solid #E4E6EA; border-top-color: #3D5AFE;
    border-radius: 50%; animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .toast {
    position: fixed; left: 50%; bottom: 46px; transform: translateX(-50%);
    background: rgba(26,26,26,.93); color: #FFFFFF;
    padding: 12px 20px; border-radius: 12px; font-size: 13px;
    z-index: 300; opacity: 0; transition: opacity .2s;
    pointer-events: none; max-width: 86%; text-align: center; line-height: 1.7;
  }
  .toast.on { opacity: 1; }
</style>
</head>
<body>

  <!-- ============ 添加 ============ -->
  <div class="screen on" id="scr-add">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">综测记录</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="addBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab on" data-go="add">添加</button>
        <button class="tab" data-go="list">记录</button>
      </div>
    </div>
    <div class="pad">
      <div class="card">
        <label class="lb">名称 <span class="must">*</span></label>
        <input class="fld" id="fName" type="text" placeholder="例如：国家励志奖学金证书"
               autocomplete="off" autocorrect="off" spellcheck="false">

        <label class="lb">时间 <span class="must">*</span></label>
        <input class="fld" id="fDate" type="date">

        <label class="lb">图片 <span class="must">*</span></label>
        <div class="picker" id="picker">
          <span class="ic">🖼</span>
          还没有选图片<br>点下面的按钮选一张
        </div>
        <div class="pick-btns">
          <label class="pick-wrap" id="wrapCamera">
            <span class="look" id="camHint">📷 拍照</span>
            <input type="file" id="fileCamera" accept="image/*" capture="environment">
          </label>
          <label class="pick-wrap">
            <span class="look">🖼 从相册选</span>
            <input type="file" id="fileGallery" accept="image/*">
          </label>
        </div>

        <button class="big-btn" id="btnSave">保 存 这 条</button>
      </div>
      <div class="tip">提示：图片会自动压缩后存在手机里，导出 Word 时按「名称 时间」一行、图片在下一行的顺序排版。</div>
    </div>
  </div>

  <!-- ============ 记录 ============ -->
  <div class="screen" id="scr-list">
    <div class="topbar">
      <div class="tb-row">
        <span class="tb-title">我的记录</span>
        <span class="tb-sp"></span>
        <span class="tb-badge" id="listBadge">—</span>
      </div>
      <div class="tabs">
        <button class="tab" data-go="add">添加</button>
        <button class="tab on" data-go="list">记录</button>
      </div>
    </div>
    <div class="pad" id="listBody"></div>
  </div>

  <div class="mask" id="mask"><div class="box"><div class="sp"></div><div id="maskText">处理中…</div></div></div>
  <div class="toast" id="toast"></div>

<script>
  // ============================================================
  //  存储：文字在 localStorage，图片在 IndexedDB
  // ============================================================
  var KEY_META = 'zz-meta-v1';
  var RECS = [];          // [{id, name, date, thumb, w, h, added}]
  var pending = null;     // 刚选好、还没保存的图片 {big: Blob, thumb: dataURL, w, h}
  var cameraOk = false;   // 相机权限有没有拿到

  var DB_NAME = 'zz-img', STORE = 'imgs', DB = null;

  function openDB(cb) {
    if (DB) { cb(DB); return; }
    try {
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      rq.onsuccess = function (e) { DB = e.target.result; cb(DB); };
      rq.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function putImg(id, blob, cb) {
    openDB(function (db) {
      if (!db) { cb(false); return; }
      try {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = function () { cb(true); };
        tx.onerror = function () { cb(false); };
      } catch (e) { cb(false); }
    });
  }
  function getImg(id, cb) {
    openDB(function (db) {
      if (!db) { cb(null); return; }
      try {
        var g = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        g.onsuccess = function () { cb(g.result || null); };
        g.onerror = function () { cb(null); };
      } catch (e) { cb(null); }
    });
  }
  function delImg(id) {
    openDB(function (db) {
      if (!db) return;
      try { db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch (e) {}
    });
  }

  function loadMeta() {
    try { RECS = JSON.parse(localStorage.getItem(KEY_META) || '[]') || []; }
    catch (e) { RECS = []; }
  }
  function saveMeta() {
    try { localStorage.setItem(KEY_META, JSON.stringify(RECS)); }
    catch (e) { toast('文字数据存不下了，请先导出、再删掉一些记录'); }
  }

  // ============================================================
  //  小工具
  // ============================================================
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function newId() { return 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function show(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
    document.getElementById('scr-' + name).classList.add('on');
    window.scrollTo(0, 0);
  }
  var toastTimer = null;
  function toast(t) {
    var el = document.getElementById('toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 3200);
  }
  function busy(on, text) {
    document.getElementById('maskText').textContent = text || '处理中…';
    document.getElementById('mask').classList.toggle('on', !!on);
  }

  // ============================================================
  //  选图 → 压缩
  // ============================================================
  function dataURLtoBlob(d) {
    var i = d.indexOf(',');
    var head = d.slice(0, i), body = d.slice(i + 1);
    var mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(body);
    var u8 = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    return new Blob([u8], { type: mime });
  }
  function drawScaled(img, maxW, quality) {
    var scale = Math.min(1, maxW / img.naturalWidth);
    var w = Math.max(1, Math.round(img.naturalWidth * scale));
    var h = Math.max(1, Math.round(img.naturalHeight * scale));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: c.toDataURL('image/jpeg', quality), w: w, h: h };
  }

  function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { toast('请选一张图片'); return; }
    busy(true, '正在处理图片…');
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var big = drawScaled(img, 1500, 0.82);     // 给 Word 用
          var small = drawScaled(img, 260, 0.62);    // 列表缩略图
          pending = {
            big: dataURLtoBlob(big.data),
            thumb: small.data,
            w: big.w,
            h: big.h
          };
          var p = document.getElementById('picker');
          p.className = 'picker has';
          p.innerHTML = '<img src="' + small.data + '">';
          toast('图片已选好（' + big.w + '×' + big.h + '）');
        } catch (e) {
          toast('图片处理失败：' + e);
        }
        busy(false);
      };
      img.onerror = function () { busy(false); toast('这张图片读不出来'); };
      img.src = reader.result;
    };
    reader.onerror = function () { busy(false); toast('读取图片失败'); };
    reader.readAsDataURL(file);
  }

  // ============================================================
  //  保存一条
  // ============================================================
  function saveRec() {
    var name = document.getElementById('fName').value.trim();
    var date = document.getElementById('fDate').value;
    if (!name) { toast('请填「名称」'); document.getElementById('fName').focus(); return; }
    if (!date) { toast('请选「时间」'); return; }
    if (!pending) { toast('请先选一张图片'); return; }

    var rec = {
      id: newId(),
      name: name,
      date: date,
      thumb: pending.thumb,
      w: pending.w,
      h: pending.h,
      added: Date.now()
    };
    busy(true, '正在保存…');
    putImg(rec.id, pending.big, function (ok) {
      busy(false);
      if (!ok) { toast('图片存不下了，试试删掉一些旧记录'); return; }
      RECS.unshift(rec);
      saveMeta();
      pending = null;
      document.getElementById('fName').value = '';
      document.getElementById('picker').className = 'picker';
      document.getElementById('picker').innerHTML =
        '<span class="ic">🖼</span>还没有选图片<br>点下面的按钮选一张';
      renderAdd();
      toast('已保存「' + name + '」');
    });
  }

  // ============================================================
  //  添加页
  // ============================================================
  function renderAdd() {
    document.getElementById('addBadge').innerHTML = '已记录 <b>' + RECS.length + '</b> 条';
  }

  // ============================================================
  //  记录页
  // ============================================================
  function renderList() {
    document.getElementById('listBadge').innerHTML = '共 <b>' + RECS.length + '</b> 条';
    var box = document.getElementById('listBody');

    if (!RECS.length) {
      box.innerHTML = '<div class="empty"><span class="big">📋</span>还没有记录<br>去「添加」登记第一条吧</div>';
      return;
    }

    var html = '<div class="list-head"><span>共 ' + RECS.length + ' 条</span><span class="sp"></span>'
             + '<button class="mini" id="btnExport">导出 Word</button>'
             + '<button class="mini red" id="btnClear">全部删除</button></div>';

    for (var i = 0; i < RECS.length; i++) {
      var r = RECS[i];
      html += '<div class="rec" data-id="' + r.id + '">'
            +   '<img class="thumb" src="' + r.thumb + '">'
            +   '<div class="mid">'
            +     '<div class="nm">' + esc(r.name) + '</div>'
            +     '<div class="dt">' + esc(r.date) + '</div>'
            +     '<div class="no">第 ' + (i + 1) + ' 条 · 图片 ' + r.w + '×' + r.h + '</div>'
            +   '</div>'
            +   '<button class="del" data-del="' + r.id + '">×</button>'
            + '</div>';
    }
    box.innerHTML = html;

    document.getElementById('btnExport').onclick = doExport;
    document.getElementById('btnClear').onclick = function () {
      var b = this;
      if (b.getAttribute('data-ok') === '1') {
        for (var i = 0; i < RECS.length; i++) delImg(RECS[i].id);
        RECS = []; saveMeta();
        renderList(); renderAdd();
        toast('全部删掉了');
        return;
      }
      b.setAttribute('data-ok', '1');
      b.textContent = '再点一次确认';
      setTimeout(function () {
        if (b.getAttribute('data-ok') === '1') { b.removeAttribute('data-ok'); b.textContent = '全部删除'; }
      }, 4000);
    };
  }

  function deleteRec(id) {
    RECS = RECS.filter(function (r) { return r.id !== id; });
    delImg(id);
    saveMeta();
    renderList(); renderAdd();
    toast('已删除一条');
  }

  // ============================================================
  //  生成 Word（.docx）
  // ============================================================
  var CRC_T = null;
  function crcTable() {
    if (CRC_T) return CRC_T;
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    CRC_T = t;
    return t;
  }
  function crc32(u8) {
    var t = crcTable(), c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  // 只做"存储"不压缩的 zip
  function makeZip(files) {
    var parts = [], central = [], offset = 0;
    for (var i = 0; i < files.length; i++) {
      var nm = utf8(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);

      var lh = new Uint8Array(30 + nm.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0x21, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nm.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nm, 30);
      parts.push(lh, data);

      var ch = new Uint8Array(46 + nm.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nm.length, true);
      cv.setUint32(42, offset, true);
      ch.set(nm, 46);
      central.push(ch);

      offset += lh.length + data.length;
    }
    var cdSize = 0;
    for (var j = 0; j < central.length; j++) cdSize += central[j].length;
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    var all = parts.concat(central, [eocd]);
    var total = 0;
    for (var m = 0; m < all.length; m++) total += all[m].length;
    var out = new Uint8Array(total);
    var pos = 0;
    for (var q = 0; q < all.length; q++) { out.set(all[q], pos); pos += all[q].length; }
    return out;
  }
  function u8b64(u8) {
    var CH = 0x8000, s = '';
    for (var i = 0; i < u8.length; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CH, u8.length)));
    }
    return btoa(s);
  }

  var W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
           + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
           + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
           + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
           + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  // 一行文字
  function pText(s, bold, size) {
    return '<w:p><w:pPr><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:rPr>'
      + '<w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman"/>'
      + (bold ? '<w:b/>' : '')
      + '<w:sz w:val="' + (size || 24) + '"/><w:szCs w:val="' + (size || 24) + '"/>'
      + '</w:rPr><w:t xml:space="preserve">' + s + '</w:t></w:r></w:p>';
  }
  // 一行图片
  function pImage(rid, pid, cx, cy, fname) {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="left"/></w:pPr>'
      + '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
      + '<wp:extent cx="' + cx + '" cy="' + cy + '"/>'
      + '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
      + '<wp:docPr id="' + pid + '" name="Picture ' + pid + '"/>'
      + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
      + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
      + '<pic:pic>'
      + '<pic:nvPicPr><pic:cNvPr id="' + pid + '" name="' + fname + '"/><pic:cNvPicPr/></pic:nvPicPr>'
      + '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
      + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
      + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }

  var EMU_MAXW = 5486400;   // A4 正文宽度约 6 英寸

  function doExport() {
    if (!RECS.length) { toast('还没有记录'); return; }
    busy(true, '正在读取图片…');

    var blobs = {}, left = RECS.length, failed = 0;
    var done = function () {
      left--;
      if (left > 0) return;
      busy(true, '正在生成 Word…');
      setTimeout(function () { packDocx(blobs, failed); }, 30);
    };
    for (var i = 0; i < RECS.length; i++) {
      (function (r) {
        getImg(r.id, function (blob) {
          if (!blob) { failed++; done(); return; }
          if (blob.arrayBuffer) {
            blob.arrayBuffer().then(function (buf) {
              blobs[r.id] = new Uint8Array(buf);
              done();
            })['catch'](function () { failed++; done(); });
          } else {
            var fr = new FileReader();
            fr.onload = function () { blobs[r.id] = new Uint8Array(fr.result); done(); };
            fr.onerror = function () { failed++; done(); };
            fr.readAsArrayBuffer(blob);
          }
        });
      })(RECS[i]);
    }
  }

  function packDocx(blobs, failed) {
    var media = [], rels = [], body = '', pid = 1;

    for (var i = 0; i < RECS.length; i++) {
      var r = RECS[i];
      if (!blobs[r.id]) continue;
      var fname = 'image' + (i + 1) + '.jpg';
      var rid = 'rId' + (i + 1);
      media.push({ name: 'word/media/' + fname, data: blobs[r.id] });
      rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + fname + '"/>');

      // 顺序：名称 + 时间 一行，下一行是图片
      body += pText(esc(r.name) + '　　' + esc(r.date), true, 28);

      var w = r.w || 1000, h = r.h || 750;
      var cx = Math.round(w * 9525), cy = Math.round(h * 9525);
      if (cx > EMU_MAXW) { cy = Math.round(cy * EMU_MAXW / cx); cx = EMU_MAXW; }
      body += pImage(rid, pid++, cx, cy, fname);
      body += '<w:p/>';
    }

    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="jpg" ContentType="image/jpeg"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '</Types>';

    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '</Relationships>';

    var docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + rels.join('') + '</Relationships>';

    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document ' + W_NS + '><w:body>' + body
      + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
      + '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>'
      + '</w:sectPr></w:body></w:document>';

    var files = [
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8(rootRels) },
      { name: 'word/document.xml', data: utf8(documentXml) },
      { name: 'word/_rels/document.xml.rels', data: utf8(docRels) }
    ].concat(media);

    var zipBytes;
    try {
      zipBytes = makeZip(files);
    } catch (e) {
      busy(false);
      toast('生成失败：' + e);
      return;
    }

    var b64 = u8b64(zipBytes);
    var name = '综测记录-' + today() + '.docx';
    busy(true, '正在保存文件…');
    hostCall({
      type: 'saveBinaryFile',
      name: name,
      base64: b64,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }, function (res) {
      busy(false);
      if (!res || !res.ok) {
        if (res && res.canceled) { toast('已取消'); return; }
        toast('保存失败：' + ((res && (res.error2 || res.error)) || '未知原因'));
        return;
      }
      var mb = (zipBytes.length / 1048576).toFixed(1);
      toast('导出成功！' + media.length + ' 张图，' + mb + 'MB\n存到了：' + (res.saved || []).join(' + ')
        + (failed ? '\n（有 ' + failed + ' 张图读不出来，已跳过）' : ''));
    });
  }

  // ============================================================
  //  宿主桥接
  // ============================================================
  var hostSeq = 0, hostPending = {};
  function hostCall(payload, cb) {
    var id = 'h' + (++hostSeq);
    hostPending[id] = cb;
    payload.id = id;
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {
      delete hostPending[id];
      if (cb) cb({ ok: false, error: '和 App 的连接断了' });
    }
  }
  window.__hostResult = function (res) {
    if (!res || !res.id) return;
    var cb = hostPending[res.id];
    delete hostPending[res.id];
    if (cb) cb(res);
  };

  // ============================================================
  //  事件
  // ============================================================
  document.getElementById('fileCamera').onchange = function (e) { handleFile(e.target.files[0]); e.target.value = ''; };
  document.getElementById('fileGallery').onchange = function (e) { handleFile(e.target.files[0]); e.target.value = ''; };
  document.getElementById('btnSave').onclick = saveRec;

  document.addEventListener('click', function (e) {
    var t = e.target;
    var tab = t.closest ? t.closest('.tab') : null;
    if (tab) {
      var g = tab.getAttribute('data-go');
      show(g);
      if (g === 'list') renderList();
      if (g === 'add') renderAdd();
      return;
    }
    var del = t.closest ? t.closest('[data-del]') : null;
    if (del) { deleteRec(del.getAttribute('data-del')); return; }
  });

  // ---------- 启动 ----------
  loadMeta();
  document.getElementById('fDate').value = today();
  renderAdd();
  renderList();
  openDB(function () {});

  // 相机权限要**提前**申请好：
  // Android 的 WebView 是在点 file input 的那一刻同步检查权限的，
  // 没授权就直接静默失败（只打一行 log），根本来不及临时申请。
  cameraOk = false;
  hostCall({ type: 'requestCamera' }, function (res) {
    cameraOk = !!(res && res.granted);
    var btn = document.getElementById('camHint');
    if (btn) {
      btn.textContent = cameraOk ? '📷 拍照' : '📷 拍照（没相机权限）';
      btn.style.color = cameraOk ? '' : '#B5B5BC';
    }
    if (!cameraOk) {
      // 没权限就干脆把"拍照"这半边藏掉，免得点了没反应让人困惑
      var w = document.getElementById('wrapCamera');
      if (w) w.style.display = 'none';
    }
  });
</script>
</body>
</html>
`;
