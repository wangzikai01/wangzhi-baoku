// 账本 v2 功能自测：隐藏金额 / 天周月切换 / 搜索
// 用法：node tools/cdp.js @tools/test-ledger.js

(function () {
  var out = {};

  // 先把状态重置干净，免得受上一次操作影响
  searchField = 'all';
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  renderFieldSelect();
  document.querySelector('#segPeriod button[data-period=month]').click();
  anchor = new Date();
  // 隐藏状态是会被记住的，测试前强制回到"显示"
  hideAmount = false;
  localStorage.setItem('ledger-hide-amount', '0');
  render();

  function txt(id) { return document.getElementById(id).textContent; }
  function rowCount() { return document.querySelectorAll('.rec').length; }
  function names() {
    var a = [], els = document.querySelectorAll('.rec-name');
    for (var i = 0; i < els.length; i++) a.push(els[i].textContent);
    return a;
  }
  function setSearch(v) {
    var si = document.getElementById('searchInput');
    si.value = v;
    si.dispatchEvent(new Event('input'));
  }

  // 1. 隐藏金额（v3.1 起：整块收起来，不留 ＊＊＊＊）
  document.getElementById('toggleHide').click();
  out['1_隐藏后_金额块display'] = getComputedStyle(document.querySelector('.sum-body')).display;
  out['1_隐藏后_按钮文字'] = document.getElementById('toggleHide').textContent.trim();
  out['1_隐藏后_空白行高度'] = Math.round(document.querySelector('.sum-spacer').getBoundingClientRect().height);

  // 2. 再点一次恢复
  document.getElementById('toggleHide').click();
  out['2_恢复后_金额块display'] = getComputedStyle(document.querySelector('.sum-body')).display;
  out['2_恢复后_按钮文字'] = document.getElementById('toggleHide').textContent.trim();
  out['2_恢复后_支出显示'] = txt('periodExpense');

  // 3. 切到「天」
  document.querySelector('#segPeriod button[data-period=day]').click();
  out['3_天_卡标题'] = txt('sumLabel');
  out['3_天_期间'] = txt('periodText');
  out['3_天_记录条数'] = rowCount();

  // 4. 切到「周」
  document.querySelector('#segPeriod button[data-period=week]').click();
  out['4_周_卡标题'] = txt('sumLabel');
  out['4_周_期间'] = txt('periodText');
  out['4_周_记录条数'] = rowCount();

  // 5. 切回「月」，按名称搜索
  document.querySelector('#segPeriod button[data-period=month]').click();
  setSearch('交通');
  out['5_搜交通_条数'] = rowCount();
  out['5_搜交通_结果'] = names();

  // 6. 按金额搜索
  setSearch('199');
  out['6_搜199_条数'] = rowCount();
  out['6_搜199_结果'] = names();

  // 7. 搜不到的情况
  setSearch('xyz不存在');
  out['7_搜不存在_条数'] = rowCount();

  // 8. 清空搜索，恢复原样
  setSearch('');
  out['8_清空后_条数'] = rowCount();

  // 9. 前后翻期间：往前翻一个月，看汇总跟着变
  document.getElementById('prevPeriod').click();
  out['9_上个月_期间'] = txt('periodText');
  out['9_上个月_卡标题'] = txt('sumLabel');
  out['9_上个月_支出'] = txt('periodExpense');
  document.getElementById('nextPeriod').click();
  out['9_回到本月_期间'] = txt('periodText');
  out['9_回到本月_支出'] = txt('periodExpense');

  return JSON.stringify(out, null, 2);
})()
