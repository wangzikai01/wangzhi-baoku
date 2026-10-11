// ============================================================
// cdp.js —— 用 Chrome 调试协议操控 WebView 里运行的模块
//
// 用途：调试模块时，不用靠"猜坐标点屏幕"，直接问页面：
//   · 某个元素在哪、内容是什么
//   · 直接改数据、触发点击、读 localStorage
//
// 前置条件：
//   1. ModuleViewerScreen 里开了 webviewDebuggingEnabled
//   2. 已经做了端口转发：
//      adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
//
// 用法：
//   node tools/cdp.js "document.body.innerText"
//   node tools/cdp.js "JSON.parse(localStorage.getItem('ledger-records-v1')).length"
//   node tools/cdp.js "document.getElementById('openAdd').click(); '已点击'"
//   node tools/cdp.js @tools/seed.js        <- 从文件读脚本（脚本长了用这个，省得转义）
// ============================================================

const fs = require('fs');

let EXPR = process.argv[2] || 'document.title';

// 以 @ 开头 = 从文件读脚本
if (EXPR.startsWith('@')) {
  const file = EXPR.slice(1);
  if (!fs.existsSync(file)) {
    console.error('找不到脚本文件:', file);
    process.exit(1);
  }
  EXPR = fs.readFileSync(file, 'utf8');
}

async function main() {
  // 1. 问调试端口有哪些页面
  const res = await fetch('http://127.0.0.1:9222/json');
  const pages = await res.json();

  // 2. 挑出我们模块那个页面（域名是 https://module-xxx.local/）
  const page =
    pages.find((p) => p.url && p.url.includes('module-')) ||
    pages.find((p) => p.webSocketDebuggerUrl);

  if (!page) {
    console.error('没有找到可调试的页面。确认模块已经打开。');
    process.exit(1);
  }

  console.log('# 目标页面:', page.url || page.title);

  // 3. 连上它，执行表达式
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const done = (code) => {
    try { ws.close(); } catch (e) { /* 忽略 */ }
    process.exit(code);
  };

  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: EXPR,
        returnByValue: true,
        awaitPromise: true,
      },
    }));
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== 1) return;

    const r = msg.result || {};
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      console.error('页面执行出错:', (e.exception && e.exception.description) || e.text);
      done(1);
      return;
    }

    const v = r.result ? r.result.value : undefined;
    console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    done(0);
  };

  ws.onerror = (e) => {
    console.error('连接调试端口失败:', (e && e.message) || e);
    done(1);
  };

  setTimeout(() => { console.error('超时'); done(1); }, 15000);
}

main().catch((e) => {
  console.error('出错:', e.message);
  process.exit(1);
});
