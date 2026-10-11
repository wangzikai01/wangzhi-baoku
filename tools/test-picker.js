// 账本 v3 自测：上限拦截 / 三种选择器 / 红点
// 用法：node tools/cdp.js @tools/test-picker.js

(function () {
  var out = {};

  function txt(id) { return document.getElementById(id).textContent; }
  function pickerOpen() { return document.getElementById('pickerMask').classList.contains('on'); }
  function closePicker() { document.getElementById('pickerMask').classList.remove('on'); }
  function setPeriod(p) { document.querySelector('#segPeriod button[data-period=' + p + ']').click(); }
  function openPicker() { document.getElementById('openPicker').click(); }

  // ---- 1. 主筛选条的"下一个"按钮上限 ----
  setPeriod('day');
  out['1_天视图_下一个按钮是否禁用'] = document.getElementById('nextPeriod').disabled;
  setPeriod('week');
  out['1_周视图_下一个按钮是否禁用'] = document.getElementById('nextPeriod').disabled;
  setPeriod('month');
  out['1_月视图_下一个按钮是否禁用'] = document.getElementById('nextPeriod').disabled;

  // 往前翻一个月后，"下一个"应该又变得可以点
  document.getElementById('prevPeriod').click();
  out['1_翻到上个月后_下一个按钮是否禁用'] = document.getElementById('nextPeriod').disabled;
  document.getElementById('nextPeriod').click();
  out['1_翻回本月'] = txt('periodText');

  // ---- 2. 月选择器：未来的月份点了没用 ----
  openPicker();
  var futureMonths = document.querySelectorAll('.month-cell.future');
  out['2_月选择器_灰色月份数'] = futureMonths.length;
  var before = txt('periodText');
  if (futureMonths.length) futureMonths[futureMonths.length - 1].click();
  out['2_点未来月份后_选择器还开着吗'] = pickerOpen();
  out['2_点未来月份后_期间有没有变'] = (txt('periodText') === before) ? '没变（被拦住了）' : '变了（没拦住！）';
  closePicker();

  // ---- 3. 天选择器：未来的日子点了没用；有记录的日子有红点 ----
  setPeriod('day');
  openPicker();
  var futureDays = document.querySelectorAll('.cal-cell.future');
  out['3_天选择器_灰色日期数'] = futureDays.length;
  out['3_天选择器_红点数（有记录的天）'] = document.querySelectorAll('.cal-cell .dot').length;
  var before3 = txt('periodText');
  if (futureDays.length) futureDays[0].click();
  out['3_点未来日期后_期间有没有变'] = (txt('periodText') === before3) ? '没变（被拦住了）' : '变了（没拦住！）';

  // 点一个过去的日期（23 号有记录）
  var d23 = document.querySelector('.cal-cell[data-day$="-23"]');
  if (d23) {
    d23.click();
    out['3_点23号后_期间'] = txt('periodText');
    out['3_点23号后_选择器关了吗'] = !pickerOpen();
    out['3_点23号后_记录条数'] = document.querySelectorAll('.rec').length;
  }

  // ---- 4. 周选择器：只列周 ----
  setPeriod('week');
  openPicker();
  out['4_周选择器_行数'] = document.querySelectorAll('.week-row').length;
  out['4_周选择器_有没有出现日期格'] = document.querySelectorAll('.cal-cell').length;
  var firstWeek = document.querySelector('.week-row');
  if (firstWeek) {
    firstWeek.click();
    out['4_点第一周后_期间'] = txt('periodText');
  }

  // ---- 5. 回到今天 ----
  setPeriod('month');
  openPicker();
  document.getElementById('pickerToday').click();
  out['5_回到今天_期间'] = txt('periodText');
  out['5_回到今天_选择器关了吗'] = !pickerOpen();

  // 收拾干净
  document.getElementById('searchInput').value = '';
  return JSON.stringify(out, null, 2);
})()
