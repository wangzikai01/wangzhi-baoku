// 给「账本」模块灌几条测试数据，然后重新渲染。
// 用法：node tools/cdp.js @tools/seed-ledger.js

(function () {
  var KEY = 'ledger-records-v1';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayAgo(off) {
    var x = new Date();
    x.setDate(x.getDate() - off);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  var seed = [
    { id: 's1', type: 'expense', amount: 25.5, cat: '餐饮', note: '公司楼下的面', date: dayAgo(0), ts: Date.now() - 1000 },
    { id: 's2', type: 'expense', amount: 6, cat: '交通', note: '地铁往返', date: dayAgo(0), ts: Date.now() - 2000 },
    { id: 's3', type: 'expense', amount: 199, cat: '购物', note: '无线耳机', date: dayAgo(0), ts: Date.now() - 3000 },
    { id: 's4', type: 'expense', amount: 38.8, cat: '餐饮', note: '和同事吃饭', date: dayAgo(1), ts: Date.now() - 4000 },
    { id: 's5', type: 'expense', amount: 12, cat: '交通', note: '打车', date: dayAgo(1), ts: Date.now() - 5000 },
    { id: 's6', type: 'income', amount: 8000, cat: '工资', note: '这个月工资', date: dayAgo(3), ts: Date.now() - 6000 },
    { id: 's7', type: 'expense', amount: 2600, cat: '居家', note: '房租', date: dayAgo(3), ts: Date.now() - 7000 }
  ];

  localStorage.setItem(KEY, JSON.stringify(seed));

  // 直接调用模块里的渲染函数，让界面立刻更新
  render();

  return '已写入 ' + seed.length + ' 条测试数据';
})()
