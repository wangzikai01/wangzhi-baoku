// ============================================================
// ledgerModule.js —— 「账本」模块（内置第一方模块）
//
// 这是一个完整的记账 App，用 HTML + CSS + JS 写成，
// 通过应用箱的 WebView 运行。
//
// 【v4 新增】账单导入
//   · 汇总卡上加了「导入」按钮，点开有三个来源：支付宝 / 微信 / 工行
//   · 选文件后自动识别：交易时间→日期、商品/商品说明→备注、金额→金额
//   · 分类不再用手选，改成按备注文字自动判断
//   · 所以「记一笔」里的分类标签去掉了
//
// 【三个来源的文件差异（很重要）】
//   工行 csv   UTF-8(带BOM)  列为 交易日期/交易时间/收-支/金额（元）
//   支付宝 csv  GBK          前面有 23 行说明，真正表头在第 24 行
//   微信 xlsx   压缩包       要解压出 sharedStrings.xml + sheet1.xml
//
// 【为什么放在 src/data 里，而不是让用户导入】
//   因为它要反复迭代。App 每次启动会把它同步进模块仓库，
//   模块 id 保持不变 → localStorage 不被清空 → 账目一条不丢。
// ============================================================

export const LEDGER_MODULE_NAME = '账本';

// 【为什么用 String.raw】
//   模块的 HTML 里有很多正则，比如 /\r?\n/、/\d{3}/、/\s/。
//   如果写成普通的模板字符串，JS 会把这些反斜杠当转义符吃掉 ——
//   /\r?\n/ 会真的变成一个换行，直接把正则劈成两半，整个 script 报语法错误。
//   String.raw 不做任何转义处理，反斜杠原样保留。
export const LEDGER_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>账本</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; padding: 0 0 40px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #F4F5F7; color: #1A1A1A;
  }
  button { font-family: inherit; }

  /* ============ 顶部横栏 ============ */
  .tabs {
    position: sticky; top: 0; z-index: 20;
    display: flex; gap: 8px;
    padding: 10px 14px;
    background: #FFFFFF;
    border-bottom: 1px solid #EFEFF3;
  }
  .tab {
    flex: 1; height: 38px;
    border: none; border-radius: 999px;
    background: #F2F3F5; color: #6B6B73;
    font-size: 14px; font-weight: 600;
  }
  .tab.on { background: #00BFA5; color: #FFFFFF; }

  .page { display: none; }
  .page.on { display: block; }

  /* ============ 卡片 ============ */
  .card {
    background: #FFFFFF; border-radius: 16px;
    margin: 14px 14px 0; padding: 18px;
  }

  .sum-head { display: flex; align-items: center; justify-content: space-between; }
  .sum-label { font-size: 12px; color: #8A8A8E; }
  .sum-actions { display: flex; align-items: center; gap: 8px; }

  /* 隐藏 / 显示按钮 */
  .eye {
    height: 28px; padding: 0 11px 0 9px;
    border: none; border-radius: 999px;
    background: #F4F5F7; color: #6B6B73;
    font-size: 12px; font-weight: 600;
    display: flex; align-items: center; gap: 4px;
  }
  .eye:active { background: #EAEBEE; }
  .eye.on { background: #E3F8F4; color: #00A38C; }

  .sum-amount {
    font-size: 36px; font-weight: 800; letter-spacing: -1px;
    margin-top: 4px; line-height: 1.15;
  }
  .sum-row {
    display: flex; gap: 26px;
    margin-top: 14px; padding-top: 14px;
    border-top: 1px solid #F2F2F5;
    font-size: 13px; color: #8A8A8E;
  }
  .sum-row b { color: #1A1A1A; font-weight: 700; }

  /* 隐藏状态：金额和收入整块收起，只留一行空白 */
  .sum-spacer { display: none; height: 22px; }
  .card.hide-amount .sum-body { display: none; }
  .card.hide-amount .sum-spacer { display: block; }

  .add-btn {
    display: block; width: calc(100% - 28px);
    margin: 14px 14px 0; height: 50px;
    border: none; border-radius: 14px;
    background: #00BFA5; color: #FFFFFF;
    font-size: 16px; font-weight: 700;
  }
  .add-btn:active { opacity: .85; }

  /* 筛选区 */
  .filters { margin: 18px 14px 0; }

  .frow1 { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
  .seg-period { display: flex; background: #E9EAEE; border-radius: 999px; padding: 3px; flex: 0 0 auto; }
  .seg-period button {
    border: none; background: transparent; color: #6B6B73;
    font-size: 13px; font-weight: 600;
    padding: 6px 10px; border-radius: 999px; white-space: nowrap;
  }
  .seg-period button.on {
    background: #FFFFFF; color: #1A1A1A;
    box-shadow: 0 1px 3px rgba(0,0,0,.10);
  }
  /* 收支筛选选中时用主题绿，和期间切换区分开 */
  .seg-flow button.on { background: #00BFA5; color: #FFFFFF; }

  .period-nav {
    display: flex; align-items: center;
    background: #FFFFFF; border-radius: 999px; padding: 3px 4px;
    flex: 0 0 auto;
  }
  .period-nav .nav-btn {
    width: 26px; height: 28px; padding: 0;
    border: none; background: transparent;
    color: #6B6B73; font-size: 17px; line-height: 1;
    border-radius: 50%;
  }
  .period-nav .nav-btn:active { background: #F2F3F5; }
  .period-nav .nav-btn:disabled { color: #D8D8DE; }
  .period-nav .label {
    border: none; background: transparent;
    display: block; padding: 0 2px;
    min-width: 76px; text-align: center;
    font-size: 13px; font-weight: 600; color: #1A1A1A;
    white-space: nowrap; overflow: hidden;
  }

  .frow2 { display: flex; align-items: center; gap: 8px; margin-top: 10px; }

  /* 自绘下拉菜单：贴着按钮下方弹出，白底圆角 + 主题绿高亮 */
  .field-select { position: relative; flex: 0 0 auto; z-index: 40; }
  .fs-btn {
    height: 38px;
    border: none; border-radius: 11px;
    background: #FFFFFF; color: #3A3A42;
    font-size: 13px; font-weight: 600;
    padding: 0 11px 0 13px;
    display: flex; align-items: center; gap: 6px;
  }
  .fs-btn .caret {
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid #A2A2AA;
    transition: transform .15s ease;
  }
  .field-select.open .fs-btn { background: #E9F8F5; color: #00A38C; }
  .field-select.open .fs-btn .caret {
    border-top-color: #00A38C;
    transform: rotate(180deg);
  }

  .fs-menu {
    position: absolute; left: 0; top: calc(100% + 6px);
    min-width: 118px;
    background: #FFFFFF;
    border-radius: 13px;
    box-shadow: 0 10px 26px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.07);
    padding: 5px;
    display: none;
    animation: pop .12s ease-out;
  }
  @keyframes pop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .field-select.open .fs-menu { display: block; }

  .fs-item {
    padding: 10px 13px; border-radius: 9px; white-space: nowrap;
    font-size: 14px; color: #2E2E36;
  }
  .fs-item.on { background: #E3F8F4; color: #00A38C; font-weight: 700; }
  .fs-item.on::after { content: '✓'; float: right; font-size: 13px; }

  /* 导入按钮：比"显示"更醒目一点 */
  .imp {
    height: 28px; padding: 0 13px;
    border: none; border-radius: 999px;
    background: #00BFA5; color: #FFFFFF;
    font-size: 12px; font-weight: 700;
  }
  .imp:active { opacity: .85; }
  .field-select.open .imp { background: #00A38C; }
  #importSelect .fs-menu { left: auto; right: 0; min-width: 132px; }

  .search-box { position: relative; flex: 1; min-width: 0; }
  .search-box .ico {
    position: absolute; left: 11px; top: 50%;
    transform: translateY(-50%);
    font-size: 14px; opacity: .4; pointer-events: none;
  }
  .search-box input {
    width: 100%; height: 38px;
    border: none; border-radius: 11px;
    background: #FFFFFF;
    padding: 0 12px 0 33px;
    font-size: 14px; color: #1A1A1A; outline: none;
  }
  .search-box input::placeholder { color: #B4B4BB; }

  /* ============ 流水列表 ============ */
  .group { margin: 18px 14px 0; }
  .group-head {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 12px; color: #8A8A8E; margin-bottom: 8px; padding: 0 4px;
  }
  .group-head b { font-weight: 600; color: #6B6B73; }
  .group-card { background: #FFFFFF; border-radius: 16px; overflow: hidden; }

  .rec {
    display: flex; align-items: center;
    padding: 13px 14px;
    border-bottom: 1px solid #F5F5F7;
  }
  .rec:last-child { border-bottom: none; }
  .rec-ico {
    width: 38px; height: 38px; border-radius: 11px;
    background: #F3F4F6; flex: 0 0 38px;
    display: flex; align-items: center; justify-content: center;
    font-size: 19px; margin-right: 12px;
  }
  .rec-mid { flex: 1; min-width: 0; }
  .rec-name {
    font-size: 15px; font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rec-sub {
    font-size: 12px; color: #A0A0A6; margin-top: 3px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rec-amt { font-size: 16px; font-weight: 700; margin-left: 10px; }
  .rec-amt.income { color: #00BFA5; }
  .rec-del {
    margin-left: 10px; width: 28px; height: 28px; flex: 0 0 28px;
    border: none; border-radius: 8px;
    background: #F5F5F7; color: #B0B0B6;
    font-size: 15px; line-height: 1; padding: 0;
  }
  .rec.pending { background: #FFF1F0; }
  .rec.pending .rec-del { background: #FF4D4F; color: #FFFFFF; }
  .rec.pending .rec-sub { color: #FF4D4F; font-weight: 600; }

  .empty { text-align: center; color: #B0B0B6; font-size: 14px; padding: 46px 20px; line-height: 1.9; }

  /* ============ 占位页 ============ */
  .placeholder {
    text-align: center; color: #A0A0A6;
    padding: 90px 30px; font-size: 14px; line-height: 2;
  }
  .placeholder .big { font-size: 40px; display: block; margin-bottom: 12px; }

  /* ============ 底部弹层 ============ */
  .mask {
    position: fixed; left: 0; right: 0; top: 0; bottom: 0;
    background: rgba(0,0,0,.35); z-index: 100;
    display: none; align-items: flex-end;
  }
  .mask.on { display: flex; }
  .sheet {
    width: 100%; background: #FFFFFF;
    border-radius: 20px 20px 0 0;
    padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
    animation: up .18s ease-out;
  }
  @keyframes up { from { transform: translateY(24px); opacity: .4; } to { transform: none; opacity: 1; } }

  /* ============ 记账弹层 ============ */
  .sheet-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .sheet-title { font-size: 17px; font-weight: 700; }
  .seg { display: flex; background: #F2F3F5; border-radius: 999px; padding: 3px; }
  .seg button {
    border: none; background: transparent; color: #6B6B73;
    font-size: 13px; font-weight: 600;
    padding: 6px 16px; border-radius: 999px;
  }
  .seg button.on { background: #FFFFFF; color: #1A1A1A; box-shadow: 0 1px 3px rgba(0,0,0,.08); }

  .amount-box {
    display: flex; align-items: center; gap: 8px;
    border-bottom: 2px solid #EFEFF3; padding-bottom: 10px;
  }
  .amount-box .yen { font-size: 26px; font-weight: 700; color: #B0B0B6; }
  .amount-box input {
    flex: 1; min-width: 0; border: none; outline: none;
    font-size: 34px; font-weight: 800; font-family: inherit;
    color: #1A1A1A; background: transparent; padding: 0;
  }

  #note {
    width: 100%; height: 46px; margin-top: 18px;
    border: 1px solid #E9E9EE; border-radius: 12px;
    padding: 0 14px; font-size: 15px; font-family: inherit;
    background: #FAFAFC; color: #1A1A1A; outline: none;
  }
  #note:focus { border-color: #00BFA5; background: #FFFFFF; }
  .note-tip { margin-top: 8px; font-size: 12px; color: #A0A0A6; }

  .tip { height: 20px; margin-top: 6px; font-size: 12px; color: #FF4D4F; }
  .save {
    width: 100%; height: 50px; margin-top: 6px;
    border: none; border-radius: 14px;
    background: #00BFA5; color: #FFFFFF;
    font-size: 16px; font-weight: 700;
  }
  .save:active { opacity: .85; }

  /* ============ 修改记录弹层 ============ */
  .edit-label { margin: 16px 0 8px; font-size: 12px; color: #8A8A8E; }
  .edit-input {
    width: 100%; height: 46px;
    border: 1px solid #E9E9EE; border-radius: 12px;
    padding: 0 14px; font-size: 15px; font-family: inherit;
    background: #FAFAFC; color: #1A1A1A; outline: none;
  }
  .edit-input:focus { border-color: #00BFA5; background: #FFFFFF; }
  #editCats { margin: 0; }
  .edit-date {
    width: 100%; height: 46px;
    border: 1px solid #E9E9EE; border-radius: 12px;
    background: #FAFAFC; color: #1A1A1A;
    font-size: 15px; font-family: inherit; text-align: left;
    padding: 0 14px;
  }
  .edit-btns { display: flex; gap: 10px; margin-top: 16px; }
  .edit-btns button {
    height: 50px; border: none; border-radius: 14px;
    font-size: 16px; font-weight: 700; font-family: inherit;
  }
  .edit-del { flex: 0 0 132px; background: #FFF1F0; color: #FF4D4F; font-size: 15px !important; }
  .edit-del[data-ok="1"] { background: #FF4D4F; color: #FFFFFF; }
  .edit-save { flex: 1; background: #00BFA5; color: #FFFFFF; }
  .edit-btns button:active { opacity: .85; }

  /* ============ 统计页 ============ */
  .stat-card { padding: 16px; margin-top: 14px; }
  .stat-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
  .stat-empty { text-align: center; color: #B0B0B6; font-size: 13px; padding: 26px 0; }

  /* ① 收支总览 */
  .ov-row { display: flex; }
  .ov-item { flex: 1; text-align: center; min-width: 0; }
  .ov-item + .ov-item { border-left: 1px solid #F2F2F5; }
  .ov-label { font-size: 12px; color: #8A8A8E; }
  .ov-value {
    margin-top: 7px; font-size: 17px; font-weight: 800;
    letter-spacing: -.4px; overflow: hidden; text-overflow: ellipsis;
  }
  .ov-value.income { color: #00BFA5; }

  /* ② 环形图 */
  .donut-wrap { position: relative; width: 172px; height: 172px; margin: 2px auto 18px; }
  .donut-svg { width: 100%; height: 100%; display: block; }
  .donut-center {
    position: absolute; left: 0; top: 0; width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .donut-total { font-size: 18px; font-weight: 800; letter-spacing: -.5px; }
  .donut-sub { font-size: 11px; color: #8A8A8E; margin-top: 3px; }

  .legend-row {
    display: flex; align-items: center;
    padding: 9px 0; border-bottom: 1px solid #F5F5F7; font-size: 14px;
  }
  .legend-row:last-child { border-bottom: none; }
  .legend-dot { width: 9px; height: 9px; border-radius: 3px; margin-right: 9px; flex: 0 0 9px; }
  .legend-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legend-pct { color: #8A8A8E; font-size: 12px; margin: 0 12px 0 8px; }
  .legend-amt { font-weight: 700; }

  /* ③ 排行 */
  .rank-row { margin-bottom: 14px; }
  .rank-row:last-child { margin-bottom: 0; }
  .rank-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .rank-name {
    font-size: 14px; font-weight: 600; margin-right: 10px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rank-amt { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .rank-bar { height: 7px; border-radius: 999px; background: #F1F2F5; overflow: hidden; }
  .rank-bar i { display: block; height: 100%; border-radius: 999px; background: #00BFA5; }

  /* ④ 趋势 */
  .trend { display: flex; align-items: flex-end; gap: 3px; }
  .trend-col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
  .trend-bar-wrap { width: 100%; height: 96px; display: flex; align-items: flex-end; }
  .trend-bar {
    width: 100%; max-width: 24px; margin: 0 auto;
    background: #00BFA5; border-radius: 4px 4px 2px 2px; min-height: 2px;
  }
  .trend-col span { margin-top: 5px; font-size: 9px; color: #A8A8B0; }

  /* ⑤ 最大单笔 */
  .top-row { display: flex; align-items: center; padding: 11px 0; border-bottom: 1px solid #F5F5F7; }
  .top-row:last-child { border-bottom: none; }
  .top-idx {
    width: 22px; height: 22px; flex: 0 0 22px; border-radius: 7px;
    background: #F2F3F5; color: #6B6B73;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; margin-right: 10px;
  }
  .top-mid { flex: 1; min-width: 0; }
  .top-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .top-sub { font-size: 11px; color: #A0A0A6; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .top-amt { font-size: 15px; font-weight: 700; margin-left: 10px; }

  /* ============ 设置页 ============ */
  .set-desc { font-size: 13px; color: #8A8A8E; line-height: 1.75; margin-bottom: 12px; }
  .set-info {
    font-size: 12px; color: #6B6B73; line-height: 1.8;
    background: #F7F8FA; border-radius: 11px;
    padding: 11px 13px; margin-bottom: 14px;
  }
  .set-btn {
    display: block; width: 100%; height: 48px; margin-top: 10px;
    border: none; border-radius: 13px;
    background: #F2F3F5; color: #3A3A42;
    font-size: 15px; font-weight: 700; font-family: inherit;
    padding: 0 12px;
  }
  .set-btn.primary { background: #00BFA5; color: #FFFFFF; }
  .set-btn.danger { background: #FFF1F0; color: #FF4D4F; }
  .set-btn.danger[data-ok="1"] { background: #FF4D4F; color: #FFFFFF; }
  .set-btn[data-ok="1"] { font-size: 14px; }
  .set-btn:active { opacity: .85; }

  /* ============ 日期选择器 ============ */
  .picker-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px;
  }
  .picker-title { font-size: 17px; font-weight: 700; }
  .today-btn {
    border: none; background: #E3F8F4; color: #00A38C;
    font-size: 13px; font-weight: 700;
    padding: 7px 14px; border-radius: 999px;
  }

  .picker-nav {
    display: flex; align-items: center; justify-content: center; gap: 18px;
    padding: 6px 0 12px;
  }
  .picker-nav button {
    width: 34px; height: 34px; padding: 0;
    border: none; border-radius: 50%;
    background: #F4F5F7; color: #4A4A52;
    font-size: 17px; line-height: 1;
  }
  .picker-nav button:disabled { color: #D8D8DE; }
  .picker-nav .pk-title {
    min-width: 128px; text-align: center;
    font-size: 15px; font-weight: 700;
  }

  .picker-body { max-height: 46vh; overflow-y: auto; }

  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .cal-wd { text-align: center; font-size: 12px; color: #A0A0A6; padding: 4px 0 8px; }
  .cal-cell {
    position: relative; height: 44px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px; font-size: 15px; color: #1A1A1A;
  }
  .cal-cell.blank { visibility: hidden; }
  .cal-cell.future { color: #D2D2D9; }
  .cal-cell.today { color: #00BFA5; font-weight: 700; }
  .cal-cell.sel { background: #00BFA5; color: #FFFFFF; font-weight: 700; }
  .cal-cell .dot {
    position: absolute; left: 50%; bottom: 6px;
    width: 5px; height: 5px; margin-left: -2.5px;
    border-radius: 50%; background: #FF9A9A;
  }
  .cal-cell.sel .dot { background: #FFFFFF; }

  .week-row {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    height: 46px; margin-bottom: 8px; border-radius: 12px;
    background: #F7F8FA; font-size: 14px; color: #1A1A1A;
  }
  .week-row.future { color: #D2D2D9; }
  .week-row.sel { background: #00BFA5; color: #FFFFFF; font-weight: 700; }
  .week-row .dot {
    position: absolute; right: 16px;
    width: 6px; height: 6px; border-radius: 50%; background: #FF9A9A;
  }
  .week-row.sel .dot { background: #FFFFFF; }

  .month-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
  .month-cell {
    position: relative; height: 54px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px; background: #F7F8FA;
    font-size: 14px; font-weight: 600; color: #1A1A1A;
  }
  .month-cell.future { color: #D2D2D9; }
  .month-cell.sel { background: #00BFA5; color: #FFFFFF; }
  .month-cell .dot {
    position: absolute; left: 50%; bottom: 8px;
    width: 5px; height: 5px; margin-left: -2.5px;
    border-radius: 50%; background: #FF9A9A;
  }
  .month-cell.sel .dot { background: #FFFFFF; }

  /* ============ 疑似重复：确认弹窗 ============ */
  .dup-mask {
    position: fixed; left: 0; right: 0; top: 0; bottom: 0;
    background: rgba(0,0,0,.45);
    z-index: 200;
    display: none; align-items: center; justify-content: center;
    padding: 22px;
  }
  .dup-mask.on { display: flex; }

  .dup-box {
    width: 100%; max-width: 430px;
    background: #FFFFFF;
    border-radius: 20px;
    padding: 20px 16px 16px;
    box-shadow: 0 18px 50px rgba(0,0,0,.3);
    animation: pop2 .18s ease-out;
  }
  @keyframes pop2 { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }

  .dup-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 14px;
  }
  .dup-title { font-size: 16px; font-weight: 700; }
  .dup-count { font-size: 12px; color: #8A8A8E; }

  .dup-item {
    border-radius: 14px; padding: 13px 14px;
    background: #F7F8FA;
    border: 1px solid #EFF0F3;
  }
  .dup-item.old { background: #F3F7FF; border-color: #E3EDFC; }
  .dup-item.new { background: #FFF7F1; border-color: #FBE7DA; }

  .dup-tag {
    display: inline-block;
    font-size: 11px; font-weight: 700;
    padding: 2px 9px; border-radius: 999px;
    margin-bottom: 9px;
  }
  .dup-item.old .dup-tag { background: #E2ECFB; color: #2E6FD6; }
  .dup-item.new .dup-tag { background: #FBE7DA; color: #D9793B; }

  .dup-line {
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  }
  .dup-amt { font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
  .dup-item.new .dup-amt { color: #D9793B; }
  .dup-time { font-size: 12px; color: #8A8A8E; white-space: nowrap; }
  .dup-note {
    margin-top: 6px; font-size: 13px; line-height: 1.5;
    color: #5A5A63; word-break: break-all;
  }
  .dup-note.empty { color: #B4B4BB; }

  .dup-gap { height: 10px; }

  .dup-btns { display: flex; gap: 8px; margin-top: 20px; }
  .dup-btns button {
    flex: 1;
    border: none; border-radius: 13px;
    padding: 10px 2px;
    background: #F2F3F5; color: #3A3A42;
    font-size: 14px; font-weight: 700; line-height: 1.3;
  }
  .dup-btns button small {
    display: block; margin-top: 2px;
    font-size: 10px; font-weight: 500; color: #9A9AA2;
  }
  .dup-btns button:active { opacity: .8; }
  .dup-btns button.primary { background: #00BFA5; color: #FFFFFF; }
  .dup-btns button.primary small { color: rgba(255,255,255,.78); }
  .dup-btns button.danger { background: #FFF1F0; color: #FF4D4F; }
  .dup-btns button.danger small { color: #FF9EA0; }

  /* ============ 提示条 ============ */
  .toast {
    position: fixed; left: 50%; bottom: 46px;
    transform: translateX(-50%) translateY(8px);
    background: rgba(28,28,36,.94); color: #FFFFFF;
    font-size: 13px; line-height: 1.5;
    padding: 12px 20px; border-radius: 14px;
    max-width: 82%; text-align: center;
    z-index: 300; opacity: 0; pointer-events: none;
    transition: opacity .18s ease, transform .18s ease;
  }
  .toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>

  <!-- 顶部横栏 -->
  <div class="tabs">
    <button class="tab on" data-tab="records">记录</button>
    <button class="tab" data-tab="stats">统计</button>
    <button class="tab" data-tab="settings">设置</button>
  </div>

  <!-- 页面一：记录 -->
  <div class="page on" id="page-records">

    <div class="card" id="sumCard">
      <div class="sum-head">
        <span class="sum-label" id="sumLabel">本月支出</span>

        <div class="sum-actions">
          <button class="eye" id="toggleHide"></button>

          <div class="field-select" id="importSelect">
            <button class="imp" id="importBtn">导入</button>
            <div class="fs-menu" id="importMenu">
              <div class="fs-item" data-src="alipay">支付宝账单</div>
              <div class="fs-item" data-src="wechat">微信账单</div>
              <div class="fs-item" data-src="icbc">工商银行</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sum-body">
        <div class="sum-amount" id="periodExpense">0.00</div>
        <div class="sum-row" id="sumRow"></div>
      </div>

      <div class="sum-spacer"></div>
    </div>

    <button class="add-btn" id="openAdd">＋ 记一笔</button>

    <div class="filters">
      <div class="frow1">
        <div class="seg-period js-period">
          <button data-period="day">日</button>
          <button data-period="week">周</button>
          <button class="on" data-period="month">月</button>
          <button data-period="year">年</button>
        </div>

        <!-- 收支筛选：全部 / 只支出 / 只收入 -->
        <div class="seg-period seg-flow js-flow">
          <button class="on" data-flow="all">全部</button>
          <button data-flow="expense">支出</button>
          <button data-flow="income">收入</button>
        </div>

        <div class="period-nav">
          <button class="nav-btn js-prev">‹</button>
          <button class="label js-picker"><span class="js-ptext">—</span></button>
          <button class="nav-btn js-next">›</button>
        </div>
      </div>

      <div class="frow2">
        <div class="field-select" id="fieldSelect">
          <button class="fs-btn" id="fsBtn">
            <span id="fsLabel">全部</span><i class="caret"></i>
          </button>
          <div class="fs-menu" id="fsMenu">
            <div class="fs-item on" data-field="all">全部</div>
            <div class="fs-item" data-field="amount">金额</div>
            <div class="fs-item" data-field="name">名称</div>
          </div>
        </div>

        <div class="search-box">
          <span class="ico">🔍</span>
          <input id="searchInput" type="text" placeholder="搜索金额或名称" autocomplete="off">
        </div>
      </div>
    </div>

    <div id="listWrap"></div>
  </div>

  <!-- 页面二：统计 -->
  <div class="page" id="page-stats">

    <div class="filters">
      <div class="frow1">
        <div class="seg-period js-period">
          <button data-period="day">日</button>
          <button data-period="week">周</button>
          <button class="on" data-period="month">月</button>
          <button data-period="year">年</button>
        </div>

        <div class="seg-period seg-flow js-flow">
          <button class="on" data-flow="all">全部</button>
          <button data-flow="expense">支出</button>
          <button data-flow="income">收入</button>
        </div>

        <div class="period-nav">
          <button class="nav-btn js-prev">‹</button>
          <button class="label js-picker"><span class="js-ptext">—</span></button>
          <button class="nav-btn js-next">›</button>
        </div>
      </div>
    </div>

    <!-- ① 收支总览 -->
    <div class="card stat-card">
      <div class="ov-row">
        <div class="ov-item">
          <div class="ov-label">支出</div>
          <div class="ov-value" id="ovExpense">0.00</div>
        </div>
        <div class="ov-item">
          <div class="ov-label">收入</div>
          <div class="ov-value income" id="ovIncome">0.00</div>
        </div>
        <div class="ov-item">
          <div class="ov-label">结余</div>
          <div class="ov-value" id="ovBalance">0.00</div>
        </div>
      </div>
    </div>

    <!-- ② 分类占比 -->
    <div class="card stat-card">
      <div class="stat-title" id="donutTitle">支出分类占比</div>
      <div class="donut-wrap">
        <div class="donut" id="donutSvg"></div>
        <div class="donut-center">
          <div class="donut-total" id="donutTotal">0.00</div>
          <div class="donut-sub" id="donutSub">总支出</div>
        </div>
      </div>
      <div class="legend" id="catLegend"></div>
    </div>

    <!-- ③ 对方排行 -->
    <div class="card stat-card">
      <div class="stat-title" id="peerTitle">花钱最多的对方 Top 5</div>
      <div id="peerRank"></div>
    </div>

    <!-- ④ 趋势 -->
    <div class="card stat-card" id="trendCard">
      <div class="stat-title" id="trendTitle">支出趋势</div>
      <div class="trend" id="trendChart"></div>
    </div>

    <!-- ⑤ 最大单笔 -->
    <div class="card stat-card">
      <div class="stat-title" id="topTitle">最大单笔 Top 5</div>
      <div id="topList"></div>
    </div>
  </div>

  <!-- 页面三：设置 -->
  <div class="page" id="page-settings">

    <div class="card stat-card">
      <div class="stat-title">备份</div>
      <div class="set-desc">
        把全部账目导出成一个 JSON 文件，存到手机上。<br>
        换手机、误删之后，可以用这个文件恢复。
      </div>
      <div class="set-info" id="backupInfo">—</div>
      <button class="set-btn primary" id="btnExport">导出备份</button>
      <button class="set-btn" id="btnImport">从备份恢复</button>
    </div>

    <div class="card stat-card">
      <div class="stat-title">数据管理</div>
      <div class="set-desc">清空之后无法撤销（除非你做过备份）。</div>
      <button class="set-btn danger" id="btnClear">清空所有账目</button>
    </div>
  </div>

  <!-- 记账弹层 -->
  <div class="mask" id="mask">
    <div class="sheet">
      <div class="sheet-head">
        <div class="sheet-title">记一笔</div>
        <div class="seg">
          <button class="on" data-type="expense">支出</button>
          <button data-type="income">收入</button>
        </div>
      </div>

      <div class="amount-box">
        <span class="yen">¥</span>
        <input id="amount" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off">
      </div>

      <input id="note" type="text" placeholder="备注（写清楚点，会自动判断分类）" autocomplete="off">
      <div class="note-tip">分类根据备注里的关键词自动判断，比如"外卖"→餐饮、"地铁"→交通</div>

      <div class="tip" id="tip"></div>
      <button class="save" id="save">保存</button>
    </div>
  </div>

  <!-- 修改记录弹层 -->
  <div class="mask" id="editMask">
    <div class="sheet">
      <div class="sheet-head">
        <div class="sheet-title">修改记录</div>
        <div class="seg" id="editSeg">
          <button class="on" data-type="expense">支出</button>
          <button data-type="income">收入</button>
        </div>
      </div>

      <div class="amount-box">
        <span class="yen">¥</span>
        <input id="editAmount" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off">
      </div>

      <div class="edit-label">分类</div>
      <div class="cats" id="editCats"></div>

      <div class="edit-label">交易对方</div>
      <input class="edit-input" id="editPeer" type="text" placeholder="比如：瑞幸咖啡" autocomplete="off">

      <div class="edit-label">备注</div>
      <input class="edit-input" id="editNote" type="text" placeholder="比如：生椰拿铁" autocomplete="off">

      <div class="edit-label">日期</div>
      <button class="edit-date" id="editDate">—</button>

      <div class="tip" id="editTip"></div>

      <div class="edit-btns">
        <button class="edit-del" id="editDelete">删除这条</button>
        <button class="edit-save" id="editSave">保存</button>
      </div>
    </div>
  </div>

  <!-- 日期选择器弹层 -->
  <div class="mask" id="pickerMask">
    <div class="sheet">
      <div class="picker-head">
        <div class="picker-title" id="pickerTitle">选择日期</div>
        <button class="today-btn" id="pickerToday">回到今天</button>
      </div>

      <div class="picker-nav">
        <button id="pkPrev">‹</button>
        <div class="pk-title" id="pkTitle">—</div>
        <button id="pkNext">›</button>
      </div>

      <div class="picker-body" id="pickerBody"></div>
    </div>
  </div>

  <!-- 隐藏的文件选择框（由「导入」按钮触发） -->
  <input type="file" id="fileInput"
         style="position:absolute; left:-9999px; top:0; width:1px; height:1px; opacity:0;">

  <!-- 疑似重复：确认弹窗 -->
  <div class="dup-mask" id="dupMask">
    <div class="dup-box">
      <div class="dup-head">
        <div class="dup-title">疑似重复的流水</div>
        <div class="dup-count" id="dupCount"></div>
      </div>

      <div class="dup-item old">
        <span class="dup-tag">原本的</span>
        <div class="dup-line">
          <span class="dup-amt" id="dupOldAmt">0.00</span>
          <span class="dup-time" id="dupOldTime"></span>
        </div>
        <div class="dup-note" id="dupOldNote"></div>
      </div>

      <div class="dup-gap"></div>

      <div class="dup-item new">
        <span class="dup-tag">重复的</span>
        <div class="dup-line">
          <span class="dup-amt" id="dupNewAmt">0.00</span>
          <span class="dup-time" id="dupNewTime"></span>
        </div>
        <div class="dup-note" id="dupNewNote"></div>
      </div>

      <div class="dup-btns">
        <button id="dupKeepOld">保留<small>原本的</small></button>
        <button id="dupDropOld" class="danger">删除<small>原本的</small></button>
        <button id="dupKeepBoth" class="primary">全部保留<small>两条都要</small></button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
  var KEY = 'ledger-records-v1';
  var KEY_HIDE = 'ledger-hide-amount';

  var CAT_ICON = {
    '餐饮': '🍜', '交通': '🚇', '购物': '🛍️', '居家': '🏠',
    '娱乐': '🎮', '医疗': '💊', '学习': '📚', '其他': '📦',
    '工资': '💰', '奖金': '🎁', '红包': '🧧', '理财': '📈'
  };

  // 可以选的分类（修改记录时用）
  var CAT_LIST = {
    expense: ['餐饮', '交通', '购物', '居家', '娱乐', '医疗', '学习', '其他'],
    income: ['工资', '奖金', '红包', '理财', '其他']
  };

  var SVG_EYE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var SVG_EYE_OFF = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  // ---------- 状态 ----------
  var period = 'month';
  var anchor = new Date();
  var searchQuery = '';
  var searchField = 'all';
  var flowFilter = 'all';          // all | expense | income
  var hideAmount = localStorage.getItem(KEY_HIDE) === '1';

  var pkYear = anchor.getFullYear();
  var pkMonth = anchor.getMonth();

  var pendingDelete = null;

  // ---------- 数据读写 ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  // ---------- 日期工具 ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return ymd(new Date()); }
  function parseYmd(s) {
    var p = String(s).split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function computeRange(date, p) {
    var a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var s, e;
    if (p === 'day') {
      s = new Date(a); e = new Date(a);
    } else if (p === 'week') {
      var dow = (a.getDay() + 6) % 7;
      s = new Date(a); s.setDate(a.getDate() - dow);
      e = new Date(s); e.setDate(s.getDate() + 6);
    } else if (p === 'year') {
      s = new Date(a.getFullYear(), 0, 1);
      e = new Date(a.getFullYear(), 11, 31);
    } else {
      s = new Date(a.getFullYear(), a.getMonth(), 1);
      e = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    }
    return { start: ymd(s), end: ymd(e), s: s, e: e };
  }
  function getRange() { return computeRange(anchor, period); }

  function periodText(r) {
    if (period === 'day') {
      if (ymd(r.s) === todayStr()) return '今天';
      return (r.s.getMonth() + 1) + '月' + r.s.getDate() + '日';
    }
    if (period === 'week') {
      return (r.s.getMonth() + 1) + '月' + r.s.getDate() + '日 - '
           + (r.e.getMonth() + 1) + '月' + r.e.getDate() + '日';
    }
    if (period === 'year') return r.s.getFullYear() + '年';
    return r.s.getFullYear() + '年' + (r.s.getMonth() + 1) + '月';
  }

  // 汇总卡标题的前缀：今日 / 本周 / 本月 / 本年（翻到过去的期间就是"当日/该周/该月/该年"）
  function periodBase() {
    var r = getRange();
    if (period === 'day') return ymd(r.s) === todayStr() ? '今日' : '当日';
    if (period === 'week') return computeRange(new Date(), 'week').start === r.start ? '本周' : '该周';
    if (period === 'year') return computeRange(new Date(), 'year').start === r.start ? '本年' : '该年';
    return computeRange(new Date(), 'month').start === r.start ? '本月' : '该月';
  }

  function money(n) {
    var s = Math.abs(n).toFixed(2);
    var parts = s.split('.');
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }
  // 带符号的金额（结余可能是负的）
  function moneySigned(n) {
    return (n < 0 ? '-' : '') + money(n);
  }
  function dateLabel(dateStr) {
    var t = todayStr();
    if (dateStr === t) return '今天';
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (dateStr === ymd(y)) return '昨天';
    var p = dateStr.split('-');
    return parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日';
  }
  function iconOf(cat) { return CAT_ICON[cat] || '📦'; }

  // 列表每一行显示什么：
  //   上（大字）= 名称 —— 优先"交易对方"，没有就用"备注"，再没有就用"分类"
  //   下（小字）= 分类，后面跟备注（如果备注没被用到上面）
  function rowTitle(r) {
    if (r.peer) return r.peer;
    if (r.note) return r.note;
    return r.cat || '—';
  }
  function rowSub(r) {
    var parts = [];
    if (r.cat) parts.push(r.cat);
    if (r.peer && r.note) parts.push(r.note);
    return parts.join(' · ');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- 分类自动判断 ----------
  // 用备注/商品说明里的关键词猜分类，手动记账和导入账单共用同一套规则
  var CAT_RULES = [
    ['餐饮', /餐|饭|外卖|奶茶|咖啡|食堂|美食|食品|饮料|烧烤|火锅|小吃|面包|蛋糕|水果|零食|酒|茶/],
    ['交通', /交通|地铁|公交|打车|单车|出行|加油|停车|高铁|火车|机票|出租|滴滴|高德|哈啰|车费|ETC/],
    ['购物', /购物|百货|超市|服饰|数码|电器|家居|商城|淘宝|天猫|京东|拼多多|便利店|文具|日用/],
    ['居家', /房租|水费|电费|燃气|物业|居家|家具|装修|宽带|话费|通讯/],
    ['娱乐', /娱乐|游戏|电影|视频|音乐|休闲|会员|月卡|点券|皮肤|充值|直播|演出/],
    ['医疗', /医疗|药店|医院|诊所|健康|体检|挂号/],
    ['学习', /学习|图书|课程|教育|培训|书籍|考试/]
  ];

  function guessCat(text, isIncome) {
    var t = String(text == null ? '' : text);
    if (isIncome) {
      if (/工资|薪|代发|劳务/.test(t)) return '工资';
      if (/奖金|奖励|绩效|报销/.test(t)) return '奖金';
      if (/红包|转账|收到/.test(t)) return '红包';
      if (/理财|基金|收益|利息|余额宝|零钱通/.test(t)) return '理财';
      return '其他';
    }
    for (var i = 0; i < CAT_RULES.length; i++) {
      if (CAT_RULES[i][1].test(t)) return CAT_RULES[i][0];
    }
    return '其他';
  }

  // ---------- 筛选 ----------
  function inRange(rec, r) { return rec.date >= r.start && rec.date <= r.end; }

  // 金额一律按「大于等于」筛选：
  //   输入 100 → 找出所有金额 ≥ 100 的记录
  //   输入 2.8 → 能命中 2.80（留了 0.005 的误差容限）
  // 名称（分类+备注）用「包含」匹配，因为文字本来就是模糊找。
  function matchAmount(rec, s) {
    var want = parseFloat(s);
    if (isNaN(want)) return false;
    return rec.amount >= want - 0.005;
  }

  function matchQuery(rec, q, field) {
    if (!q) return true;
    var s = q.trim().toLowerCase();
    if (!s) return true;

    var name = (String(rec.cat) + ' ' + String(rec.note || '')).toLowerCase();

    if (field === 'amount') return matchAmount(rec, s);
    if (field === 'name') return name.indexOf(s) >= 0;

    // 全部：输入的是纯数字，就当金额筛选（≥）；输入的是文字，就按名称模糊找。
    // 否则搜 "20" 会因为备注里的日期 "2026-09-23" 命中一大堆，等于没用。
    if (/^\d+(\.\d+)?$/.test(s)) return matchAmount(rec, s);
    return name.indexOf(s) >= 0;
  }

  function visibleRecords() {
    var r = getRange();
    var list = load();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!inRange(it, r)) continue;
      if (flowFilter !== 'all' && it.type !== flowFilter) continue;   // 收支筛选
      if (!matchQuery(it, searchQuery, searchField)) continue;
      out.push(it);
    }
    return out;
  }

  function recordDateSet() {
    var list = load(), set = {};
    for (var i = 0; i < list.length; i++) set[list[i].date] = true;
    return set;
  }

  // ---------- 渲染 ----------
  function renderSummary() {
    var r = getRange();
    var list = load();
    var exp = 0, inc = 0;
    for (var i = 0; i < list.length; i++) {
      if (!inRange(list[i], r)) continue;
      if (list[i].type === 'income') inc += list[i].amount;
      else exp += list[i].amount;
    }

    var bal = inc - exp;            // 结余 = 收入 − 支出
    var base = periodBase();

    // 大数字跟着收支筛选走：选"全部"看结余、选"支出"看支出、选"收入"看收入；
    // 下面小字显示另外两项。
    var bigName, bigValue, rest;
    if (flowFilter === 'expense') {
      bigName = '支出'; bigValue = money(exp);
      rest = [['收入', money(inc)], ['结余', moneySigned(bal)]];
    } else if (flowFilter === 'income') {
      bigName = '收入'; bigValue = money(inc);
      rest = [['支出', money(exp)], ['结余', moneySigned(bal)]];
    } else {
      bigName = '结余'; bigValue = moneySigned(bal);
      rest = [['支出', money(exp)], ['收入', money(inc)]];
    }

    document.getElementById('sumLabel').textContent = base + bigName;
    document.getElementById('periodExpense').textContent = bigValue;

    var row = '';
    for (var k = 0; k < rest.length; k++) {
      row += '<span>' + rest[k][0] + '<b>' + rest[k][1] + '</b></span>';
    }
    document.getElementById('sumRow').innerHTML = row;

    document.getElementById('sumCard').classList.toggle('hide-amount', hideAmount);

    var btn = document.getElementById('toggleHide');
    btn.classList.toggle('on', hideAmount);
    btn.innerHTML = hideAmount
      ? SVG_EYE + '<span>显示</span>'
      : SVG_EYE_OFF + '<span>隐藏</span>';
  }

  function renderFilters() {
    var r = getRange();
    var txt = periodText(r);

    // 记录页和统计页各有一套筛选条，全部一起更新
    var spans = document.querySelectorAll('.js-ptext');
    for (var i = 0; i < spans.length; i++) spans[i].textContent = txt;

    var btns = document.querySelectorAll('.js-period button');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.toggle('on', btns[j].getAttribute('data-period') === period);
    }

    var fbtns = document.querySelectorAll('.js-flow button');
    for (var k = 0; k < fbtns.length; k++) {
      fbtns[k].classList.toggle('on', fbtns[k].getAttribute('data-flow') === flowFilter);
    }

    var nexts = document.querySelectorAll('.js-next');
    for (var m = 0; m < nexts.length; m++) nexts[m].disabled = !canGoNext();
  }

  function renderList() {
    var list = visibleRecords();
    var wrap = document.getElementById('listWrap');

    if (!list.length) {
      var all = load();
      var msg = all.length
        ? '这个期间没有符合条件的记录<br>换个时间范围或清空搜索试试'
        : '还没有账目，点上面的「＋ 记一笔」<br>或者用右上角「导入」导入账单';
      wrap.innerHTML = '<div class="empty">' + msg + '</div>';
      return;
    }

    var groups = [], index = {};
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      if (!index[rec.date]) {
        index[rec.date] = { date: rec.date, items: [], exp: 0, inc: 0 };
        groups.push(index[rec.date]);
      }
      index[rec.date].items.push(rec);
      if (rec.type === 'income') index[rec.date].inc += rec.amount;
      else index[rec.date].exp += rec.amount;
    }

    var html = '';
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var sums = [];
      if (flowFilter !== 'income') sums.push('支出 ' + money(grp.exp));
      if (flowFilter !== 'expense' && grp.inc > 0) sums.push('收入 ' + money(grp.inc));
      html += '<div class="group">';
      html +=   '<div class="group-head"><span>' + dateLabel(grp.date) + '</span>'
             + '<b>' + sums.join('　') + '</b></div>';
      html +=   '<div class="group-card">';
      for (var j = 0; j < grp.items.length; j++) {
        var it = grp.items[j];
        var isIncome = it.type === 'income';
        var pend = pendingDelete === it.id;
        var subtitle = pend ? '再点一次就删除' : (rowSub(it) || '—');
        html += '<div class="rec' + (pend ? ' pending' : '') + '" data-id="' + it.id + '">'
              +   '<div class="rec-ico">' + iconOf(it.cat) + '</div>'
              +   '<div class="rec-mid">'
              +     '<div class="rec-name">' + esc(rowTitle(it)) + '</div>'
              +     '<div class="rec-sub">' + esc(subtitle) + '</div>'
              +   '</div>'
              +   '<div class="rec-amt' + (isIncome ? ' income' : '') + '">'
              +     (isIncome ? '+' : '-') + money(it.amount)
              +   '</div>'
              +   '<button class="rec-del" data-del="' + it.id + '">' + (pend ? '!' : '×') + '</button>'
              + '</div>';
      }
      html +=   '</div></div>';
    }
    wrap.innerHTML = html;
  }

  // ---------- 统计页 ----------
  var STAT_COLORS = ['#00BFA5', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
                     '#10B981', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];

  // "全部"时统计支出视角；选了"收入"就切成收入视角
  function statDirection() {
    return flowFilter === 'income' ? 'income' : 'expense';
  }

  function renderStats() {
    var r = getRange();
    var list = load();
    var want = statDirection();
    var isIncome = (want === 'income');
    var word = isIncome ? '收入' : '支出';

    var exp = 0, inc = 0;
    var byCat = {}, byPeer = {}, byDay = {}, byMonth = {}, tops = [];

    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!inRange(it, r)) continue;
      if (it.type === 'income') inc += it.amount; else exp += it.amount;
      if (it.type !== want) continue;

      byCat[it.cat] = (byCat[it.cat] || 0) + it.amount;
      var pn = it.peer || it.note || it.cat || '（无名称）';
      byPeer[pn] = (byPeer[pn] || 0) + it.amount;
      byDay[it.date] = (byDay[it.date] || 0) + it.amount;
      var mk = it.date.slice(0, 7);
      byMonth[mk] = (byMonth[mk] || 0) + it.amount;
      tops.push(it);
    }

    // ① 收支总览
    document.getElementById('ovExpense').textContent = money(exp);
    document.getElementById('ovIncome').textContent = money(inc);
    document.getElementById('ovBalance').textContent = moneySigned(inc - exp);

    // ② 分类占比
    var cats = [];
    for (var ck in byCat) if (byCat.hasOwnProperty(ck)) cats.push({ name: ck, value: byCat[ck] });
    cats.sort(function (a, b) { return b.value - a.value; });

    var total = 0;
    for (var ci = 0; ci < cats.length; ci++) total += cats[ci].value;

    document.getElementById('donutTitle').textContent = word + '分类占比';
    document.getElementById('donutSub').textContent = '总' + word;
    document.getElementById('donutTotal').textContent = money(total);

    var R = 44, CIRC = 2 * Math.PI * R, off = 0, arcs = '';
    if (total > 0) {
      for (var d = 0; d < cats.length; d++) {
        var len = cats[d].value / total * CIRC;
        arcs += '<circle cx="60" cy="60" r="' + R + '" fill="none"'
              + ' stroke="' + STAT_COLORS[d % STAT_COLORS.length] + '"'
              + ' stroke-width="17"'
              + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (CIRC - len).toFixed(2) + '"'
              + ' stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
        off += len;
      }
    } else {
      arcs = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#EFEFF3" stroke-width="17"></circle>';
    }
    document.getElementById('donutSvg').innerHTML =
      '<svg class="donut-svg" viewBox="0 0 120 120"><g transform="rotate(-90 60 60)">' + arcs + '</g></svg>';

    var lg = '';
    if (!cats.length) {
      lg = '<div class="stat-empty">这个期间没有' + word + '记录</div>';
    } else {
      for (var l = 0; l < cats.length; l++) {
        lg += '<div class="legend-row">'
            +   '<i class="legend-dot" style="background:' + STAT_COLORS[l % STAT_COLORS.length] + '"></i>'
            +   '<span class="legend-name">' + esc(cats[l].name) + '</span>'
            +   '<span class="legend-pct">' + (cats[l].value / total * 100).toFixed(1) + '%</span>'
            +   '<span class="legend-amt">' + money(cats[l].value) + '</span>'
            + '</div>';
      }
    }
    document.getElementById('catLegend').innerHTML = lg;

    // ③ 对方排行 Top 5
    var peers = [];
    for (var pk in byPeer) if (byPeer.hasOwnProperty(pk)) peers.push({ name: pk, value: byPeer[pk] });
    peers.sort(function (a, b) { return b.value - a.value; });
    peers = peers.slice(0, 5);

    document.getElementById('peerTitle').textContent =
      (isIncome ? '收入来源' : '花钱最多的对方') + ' Top 5';

    var pr = '';
    if (!peers.length) {
      pr = '<div class="stat-empty">没有数据</div>';
    } else {
      var maxP = peers[0].value || 1;
      for (var q = 0; q < peers.length; q++) {
        var w = Math.max(3, Math.round(peers[q].value / maxP * 100));
        pr += '<div class="rank-row">'
            +   '<div class="rank-top"><span class="rank-name">' + esc(peers[q].name) + '</span>'
            +   '<span class="rank-amt">' + money(peers[q].value) + '</span></div>'
            +   '<div class="rank-bar"><i style="width:' + w + '%"></i></div>'
            + '</div>';
      }
    }
    document.getElementById('peerRank').innerHTML = pr;

    // ④ 趋势（日视图不显示，一天看不出趋势）
    var bars = [];
    if (period === 'year') {
      for (var m = 0; m < 12; m++) {
        bars.push({ label: (m + 1), value: byMonth[r.s.getFullYear() + '-' + pad(m + 1)] || 0 });
      }
    } else if (period === 'week' || period === 'month') {
      var cur = new Date(r.s);
      while (ymd(cur) <= r.end) {
        bars.push({ label: cur.getDate(), value: byDay[ymd(cur)] || 0 });
        cur.setDate(cur.getDate() + 1);
      }
    }

    var tcard = document.getElementById('trendCard');
    if (!bars.length) {
      tcard.style.display = 'none';
    } else {
      tcard.style.display = '';
      document.getElementById('trendTitle').textContent =
        word + '趋势（' + (period === 'year' ? '按月' : '按天') + '）';

      var maxB = 0;
      for (var b = 0; b < bars.length; b++) if (bars[b].value > maxB) maxB = bars[b].value;

      var th = '';
      for (var t = 0; t < bars.length; t++) {
        var hh = maxB > 0 ? Math.round(bars[t].value / maxB * 100) : 0;
        th += '<div class="trend-col">'
            +   '<div class="trend-bar-wrap"><div class="trend-bar" style="height:' + hh + '%"></div></div>'
            +   '<span>' + bars[t].label + '</span>'
            + '</div>';
      }
      document.getElementById('trendChart').innerHTML = th;
    }

    // ⑤ 最大单笔 Top 5
    tops.sort(function (a, b) { return b.amount - a.amount; });
    tops = tops.slice(0, 5);

    var tl = '';
    if (!tops.length) {
      tl = '<div class="stat-empty">没有数据</div>';
    } else {
      for (var z = 0; z < tops.length; z++) {
        var tt = tops[z];
        tl += '<div class="top-row">'
            +   '<div class="top-idx">' + (z + 1) + '</div>'
            +   '<div class="top-mid">'
            +     '<div class="top-name">' + esc(rowTitle(tt)) + '</div>'
            +     '<div class="top-sub">' + esc(rowSub(tt) || '—') + ' · ' + dateLabel(tt.date) + '</div>'
            +   '</div>'
            +   '<div class="top-amt">' + (isIncome ? '+' : '-') + money(tt.amount) + '</div>'
            + '</div>';
      }
    }
    document.getElementById('topList').innerHTML = tl;
  }

  function render() {
    renderSummary();
    renderFilters();
    renderList();
    renderStats();
    renderBackupInfo();
  }

  // ---------- 提示条 ----------
  var toastTimer = null;
  function toast(msg, ms) {
    var el = document.getElementById('toast');
    el.innerHTML = msg;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, ms || 2800);
  }

  // ============================================================
  //  账单导入
  // ============================================================

  // ---- 编码识别 ----
  // 工行的 csv 是 UTF-8（带 BOM），支付宝的是 GBK。
  // 先用严格 UTF-8 试；解不出来就说明是 GBK。
  function decodeBytes(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      try { return new TextDecoder('gbk').decode(bytes); }
      catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
    }
  }

  // ---- CSV ----
  function splitCsvLine(line) {
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i++; }
          else { inQ = false; }
        } else { cur += c; }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { out.push(cur); cur = ''; }
        else { cur += c; }
      }
    }
    out.push(cur);
    return out;
  }

  function toRows(text) {
    var lines = String(text).split(/\r?\n/);
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].replace(/\s/g, '')) continue;
      rows.push(splitCsvLine(lines[i]));
    }
    return rows;
  }

  // 找表头在第几行
  function findHeader(rows, mustHave) {
    for (var i = 0; i < rows.length; i++) {
      var joined = rows[i].join('|');
      var ok = true;
      for (var k = 0; k < mustHave.length; k++) {
        if (joined.indexOf(mustHave[k]) < 0) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }

  function colIndex(head, key) {
    for (var i = 0; i < head.length; i++) {
      if (String(head[i]).replace(/\s/g, '').indexOf(key) >= 0) return i;
    }
    return -1;
  }

  function num(s) {
    var v = parseFloat(String(s == null ? '' : s).replace(/[¥￥,,\s元]/g, ''));
    return isNaN(v) ? 0 : Math.round(v * 100) / 100;
  }

  function isIncomeText(io) {
    var t = String(io || '');
    return t.indexOf('收') >= 0 && t.indexOf('支') < 0;
  }

  // Excel 把日期存成"从 1900-01-01 起的天数"（比如 46289.72 = 2026-09-24 17:16）。
  // xlsx 里的时间列几乎都是这个格式，必须转换，否则整列读不出来。
  function excelDateToYmd(v) {
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0 || n > 200000) return '';
    var days = Math.floor(n);
    var d = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  // 时间列可能是 'YYYY-MM-DD HH:mm:ss' 字符串，也可能是 Excel 序列号，两种都认
  function toYmd(v) {
    var s = String(v == null ? '' : v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(s)) return excelDateToYmd(s);
    return '';
  }

  // Excel 序列号的小数部分就是"当天的几点"
  function excelSerialToTime(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return '';
    var secs = Math.round((n - Math.floor(n)) * 86400);
    if (secs >= 86400) secs = 86399;
    return pad(Math.floor(secs / 3600)) + ':' + pad(Math.floor((secs % 3600) / 60)) + ':' + pad(secs % 60);
  }

  // 时间列 → 'HH:mm:ss'。三种来源格式各不相同，统一在这里处理。
  function toClock(v) {
    var s = String(v == null ? '' : v).trim();
    var m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return pad(parseInt(m[1], 10)) + ':' + m[2] + ':' + (m[3] || '00');
    if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToTime(s);
    return '';
  }

  function nowClock() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // 记录 → 精确到毫秒的时间戳（用来判断"1 分钟内"）
  function recordMs(rec) {
    if (!rec || !rec.date) return null;
    var t = rec.time || '';
    if (!/^\d{2}:\d{2}/.test(t)) return null;
    var d = parseYmd(rec.date);
    d.setHours(parseInt(t.slice(0, 2), 10), parseInt(t.slice(3, 5), 10),
               parseInt(t.slice(6, 8), 10) || 0, 0);
    return d.getTime();
  }

  function recTimeText(rec) {
    var s = rec.date ? dateLabel(rec.date) : '';
    if (rec.time) s += ' ' + rec.time.slice(0, 5);
    return s;
  }

  // ---- 工商银行 ----
  // 表头: 序号,交易日期,交易时间,收/支,金额（元）
  function parseIcbc(rows) {
    var hi = findHeader(rows, ['交易日期', '交易时间']);
    if (hi < 0) throw new Error('没找到工行表头（应有「交易日期、交易时间」）');
    var head = rows[hi];
    var iDate = colIndex(head, '交易日期'), iTime = colIndex(head, '交易时间');
    var iIO = colIndex(head, '收'), iAmt = colIndex(head, '金额');
    if (iDate < 0 || iAmt < 0) throw new Error('工行表头列名对不上');

    var out = [];
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      var date = String(r[iDate] || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      var amt = num(r[iAmt]);
      if (amt <= 0) continue;
      var inc = isIncomeText(r[iIO]);
      out.push({
        type: inc ? 'income' : 'expense',
        amount: amt,
        date: date,
        time: toClock(r[iTime]),
        peer: '',                    // 工行流水没有"交易对方"这一列
        note: '工商银行',
        cat: guessCat('工商银行', inc)
      });
    }
    return out;
  }

  // ---- 支付宝 ----
  // 表头: 交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,...
  function parseAlipay(rows) {
    var hi = findHeader(rows, ['交易时间', '商品说明', '收/支']);
    if (hi < 0) throw new Error('没找到支付宝表头（应有「交易时间、商品说明、收/支」）');
    var head = rows[hi];
    var iTime = colIndex(head, '交易时间'), iCat = colIndex(head, '交易分类');
    var iTo = colIndex(head, '交易对方'), iDesc = colIndex(head, '商品说明');
    var iIO = colIndex(head, '收/支'), iAmt = colIndex(head, '金额');

    var out = [];
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 7) continue;
      var io = String(r[iIO] || '').trim();
      if (io === '' || io === '不计收支' || io === '/') continue;
      var amt = num(r[iAmt]);
      if (amt <= 0) continue;
      var t = toYmd(r[iTime]);
      if (!t) continue;
      var inc = isIncomeText(io);
      var desc = String(r[iDesc] || '').trim();
      out.push({
        type: inc ? 'income' : 'expense',
        amount: amt,
        date: t,
        time: toClock(r[iTime]),
        peer: String(r[iTo] || '').trim(),        // 交易对方
        note: desc,
        cat: guessCat(String(r[iCat] || '') + ' ' + String(r[iTo] || '') + ' ' + desc, inc)
      });
    }
    return out;
  }

  // ---- 微信 ----
  // 表头: 交易时间,交易类型,交易对方,商品,收/支,金额(元),...
  function parseWechat(rows) {
    var hi = findHeader(rows, ['交易时间', '商品', '收/支']);
    if (hi < 0) throw new Error('没找到微信表头（应有「交易时间、商品、收/支」）');
    var head = rows[hi];
    var iTime = colIndex(head, '交易时间'), iType = colIndex(head, '交易类型');
    var iTo = colIndex(head, '交易对方'), iGoods = colIndex(head, '商品');
    var iIO = colIndex(head, '收/支'), iAmt = colIndex(head, '金额');

    var out = [];
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || r.length < 6) continue;
      var io = String(r[iIO] || '').trim();
      if (io === '' || io === '中性交易' || io === '/') continue;
      var amt = num(r[iAmt]);
      if (amt <= 0) continue;
      var t = toYmd(r[iTime]);          // 微信的是 Excel 序列号，要转换
      if (!t) continue;
      var inc = isIncomeText(io);
      var goods = String(r[iGoods] || '').trim();
      if (!goods || goods === '/') goods = String(r[iTo] || '').trim();
      out.push({
        type: inc ? 'income' : 'expense',
        amount: amt,
        date: t,
        time: toClock(r[iTime]),
        peer: String(r[iTo] || '').trim(),        // 交易对方
        note: goods,
        cat: guessCat(String(r[iType] || '') + ' ' + goods + ' ' + String(r[iTo] || ''), inc)
      });
    }
    return out;
  }

  // ---- xlsx 解压读取 ----
  // xlsx 本质是个 zip。用浏览器自带的 DecompressionStream 解 deflate，
  // 不需要任何第三方库。
  function colToIndex(letters) {
    var n = 0;
    for (var i = 0; i < letters.length; i++) {
      n = n * 26 + (letters.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  function readZipEntry(bytes, wantName) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // 从尾部找 ZIP 中央目录结束标记
    var eocd = -1;
    var lowest = Math.max(0, bytes.length - 66000);
    for (var i = bytes.length - 22; i >= lowest; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('这不是标准的 xlsx 文件'));

    var count = dv.getUint16(eocd + 10, true);
    var p = dv.getUint32(eocd + 16, true);

    for (var k = 0; k < count; k++) {
      if (p + 46 > bytes.length) break;
      if (dv.getUint32(p, true) !== 0x02014b50) break;

      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var cmtLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var entryName = new TextDecoder('utf-8').decode(bytes.subarray(p + 46, p + 46 + nameLen));

      if (entryName === wantName) {
        var lNameLen = dv.getUint16(localOff + 26, true);
        var lExtraLen = dv.getUint16(localOff + 28, true);
        var start = localOff + 30 + lNameLen + lExtraLen;
        var data = bytes.subarray(start, start + compSize);

        if (method === 0) {
          return Promise.resolve(new TextDecoder('utf-8').decode(data));
        }
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).arrayBuffer().then(function (buf) {
          return new TextDecoder('utf-8').decode(new Uint8Array(buf));
        });
      }
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return Promise.resolve(null);
  }

  function readXlsxRows(bytes) {
    return Promise.all([
      readZipEntry(bytes, 'xl/sharedStrings.xml'),
      readZipEntry(bytes, 'xl/worksheets/sheet1.xml')
    ]).then(function (res) {
      var sharedXml = res[0], sheetXml = res[1];
      if (!sheetXml) throw new Error('xlsx 里找不到工作表');

      var shared = [];
      if (sharedXml) {
        var sdoc = new DOMParser().parseFromString(sharedXml, 'application/xml');
        var sis = sdoc.getElementsByTagName('si');
        for (var i = 0; i < sis.length; i++) shared.push(sis[i].textContent || '');
      }

      var doc = new DOMParser().parseFromString(sheetXml, 'application/xml');
      var rowNodes = doc.getElementsByTagName('row');
      var rows = [];
      for (var r = 0; r < rowNodes.length; r++) {
        var cells = rowNodes[r].getElementsByTagName('c');
        var line = [];
        for (var c = 0; c < cells.length; c++) {
          var cell = cells[c];
          var ref = cell.getAttribute('r') || '';
          var letters = ref.replace(/[^A-Za-z]/g, '').toUpperCase();
          var ci = letters ? colToIndex(letters) : c;
          var type = cell.getAttribute('t');
          var vNode = cell.getElementsByTagName('v')[0];
          var val = '';
          if (type === 's' && vNode) val = shared[parseInt(vNode.textContent, 10)] || '';
          else if (vNode) val = vNode.textContent || '';
          if (ci >= 0) line[ci] = val;
        }
        rows.push(line);
      }
      return rows;
    });
  }

  // ---- 导入落地 ----
  // 三层去重：
  //   ① 日期+金额+备注 完全相同  → 直接跳过，不用问
  //   ② 金额相同 + 时间相差 1 分钟内 → 弹窗让用户定夺
  //      （跨来源重复：比如用支付宝绑工行卡付款，两边都会记一笔）
  //   ③ 其余 → 直接导入

  function makeRecord(r) {
    var rec = {
      id: newId(),
      type: r.type,
      amount: r.amount,
      cat: r.cat,
      peer: r.peer || '',          // 交易对方
      note: r.note || '',
      date: r.date,
      time: r.time || ''
    };
    rec.ts = recordMs(rec) || Date.now();
    return rec;
  }

  // id 必须绝对唯一。之前只用 时间戳+随机数，批量导入时偶尔会撞车，
  // 一撞车「删除」「押金配对」就会按 id 误伤到另一条记录。
  var idSeq = 0;
  function newId() {
    idSeq++;
    return 'r' + Date.now().toString(36) + idSeq.toString(36)
         + Math.floor(Math.random() * 100000).toString(36);
  }

  function sortList(list) {
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (recordMs(b) || b.ts || 0) - (recordMs(a) || a.ts || 0);
    });
  }

  // 在已有记录里找"金额相同 + 时间在 1 分钟内"的那条
  function findConflict(list, rec) {
    var ms = recordMs(rec);
    if (ms == null) return null;                  // 新记录没有时间，不做时间判断
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type !== rec.type) continue;
      if (Math.abs(e.amount - rec.amount) > 0.001) continue;
      var ems = recordMs(e);
      if (ems == null) continue;                  // 老记录没有时间，跳过
      if (Math.abs(ms - ems) <= 60000) return e;  // 1 分钟内
    }
    return null;
  }

  var dupQueue = [];
  var dupStat = { added: 0, skipped: 0, keptOld: 0, droppedOld: 0, keptBoth: 0, deposits: 0 };

  function resetDupStat() {
    dupStat = { added: 0, skipped: 0, keptOld: 0, droppedOld: 0, keptBoth: 0, deposits: 0 };
    dupQueue = [];
  }

  // ---- 押金 / 退款识别 ----
  // 两种典型情况：
  //   押金：租东西先付押金，当天原路退回
  //   退款：下单付了钱，过一两天商家退回来（比如订票失败自动退）
  // 共同特征：同一个「交易对方」、同样金额、一收一支。
  // 注意：不能要求"备注也一样" —— 退款那笔的备注经常不同
  //       （比如付款是"12306消费"，退款是"中铁网络"）。
  // 规则：同对方 + 同金额 + 一收一支 + 日期相差不超过 7 天 → 两条都去掉。
  var REFUND_WINDOW_DAYS = 7;

  function removeDepositPairs(list) {
    var used = {};
    var removed = [];
    var win = REFUND_WINDOW_DAYS * 86400000;

    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (used[a.id]) continue;
      if (!a.peer) continue;                        // 没有交易对方就不判断
      var ams = recordMs(a);

      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (used[b.id]) continue;
        if (b.peer !== a.peer) continue;            // 必须是同一个交易对方
        if (b.type === a.type) continue;            // 必须一收一支
        if (Math.abs(b.amount - a.amount) > 0.005) continue;

        var bms = recordMs(b);
        if (ams != null && bms != null && Math.abs(ams - bms) > win) continue;

        used[a.id] = true;
        used[b.id] = true;
        removed.push({ peer: a.peer, amount: a.amount, d1: a.date, d2: b.date });
        break;
      }
    }

    if (!removed.length) return { list: list, removed: [] };
    var out = [];
    for (var k = 0; k < list.length; k++) {
      if (!used[list[k].id]) out.push(list[k]);
    }
    return { list: out, removed: removed };
  }

  function importRecords(recs) {
    var list = load();

    // ① 完全相同的直接跳过（日期+时间+金额+备注 四项全一样）
    //    注意：时间也要算进去。否则"同一天、同金额、同备注、但时间不同"
    //    的两笔会被误判成同一笔。
    function exactKey(o) {
      return o.date + '|' + (o.time || '') + '|' + o.amount + '|' + (o.note || '');
    }

    var exact = {};
    for (var i = 0; i < list.length; i++) {
      exact[exactKey(list[i])] = true;
    }

    var fresh = [], conflicts = [];
    for (var j = 0; j < recs.length; j++) {
      var r = recs[j];
      var key = exactKey(r);
      if (exact[key]) { dupStat.skipped++; continue; }
      exact[key] = true;

      var hit = findConflict(list, r);             // ② 金额相同 + 时间在 1 分钟内
      if (hit) conflicts.push({ oldRec: hit, newRec: r });
      else fresh.push(r);
    }

    // 不冲突的先入库
    for (var k = 0; k < fresh.length; k++) list.push(makeRecord(fresh[k]));
    dupStat.added = fresh.length;

    // 押金配对：同一天 + 同对方 + 同金额 的一收一支 → 两条都去掉
    var dep = removeDepositPairs(list);
    list = dep.list;
    dupStat.deposits = dep.removed.length;

    sortList(list);
    save(list);
    render();

    // ③ 冲突的一条一条问
    dupQueue = conflicts;
    if (conflicts.length) showNextDup();
    else finishImport();
  }

  // ---- 疑似重复确认弹窗 ----
  function showNextDup() {
    if (!dupQueue.length) {
      document.getElementById('dupMask').classList.remove('on');
      finishImport();
      return;
    }

    var c = dupQueue[0];
    var o = c.oldRec, n = c.newRec;
    function sign(r) { return (r.type === 'income' ? '+' : '-') + money(r.amount); }

    document.getElementById('dupCount').textContent = '还有 ' + dupQueue.length + ' 条待确认';

    document.getElementById('dupOldAmt').textContent = sign(o);
    document.getElementById('dupOldTime').textContent = recTimeText(o);
    document.getElementById('dupOldNote').textContent = o.note || '（没有名称）';
    document.getElementById('dupOldNote').className = 'dup-note' + (o.note ? '' : ' empty');

    document.getElementById('dupNewAmt').textContent = sign(n);
    document.getElementById('dupNewTime').textContent = recTimeText(n);
    document.getElementById('dupNewNote').textContent = n.note || '（没有名称）';
    document.getElementById('dupNewNote').className = 'dup-note' + (n.note ? '' : ' empty');

    document.getElementById('dupMask').classList.add('on');

    // 弹窗出现时把"正在解析…"的提示条收掉，免得两个叠在一起
    document.getElementById('toast').classList.remove('on');
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  function resolveDup(action) {
    var c = dupQueue.shift();
    if (!c) { showNextDup(); return; }

    var list = load();

    if (action === 'keepOld') {
      // 保留原本的 → 新导入的这条丢掉
      dupStat.keptOld++;

    } else if (action === 'dropOld') {
      // 删除原本的 → 用新导入的这条替换
      var next = [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== c.oldRec.id) next.push(list[i]);
      }
      next.push(makeRecord(c.newRec));
      sortList(next);
      save(next);
      dupStat.droppedOld++;

    } else {
      // 全部保留
      list.push(makeRecord(c.newRec));
      sortList(list);
      save(list);
      dupStat.keptBoth++;
    }

    render();
    showNextDup();
  }

  function finishImport() {
    var lines = [];

    if (dupStat.added) lines.push('新增 <b>' + dupStat.added + '</b> 条');
    if (dupStat.skipped) {
      lines.push('已有 <b>' + dupStat.skipped + '</b> 条完全一样（日期+时间+金额+备注），未重复记账');
    }
    if (dupStat.keptOld) lines.push('保留原本的 ' + dupStat.keptOld + ' 条');
    if (dupStat.droppedOld) lines.push('换成新导入的 ' + dupStat.droppedOld + ' 条');
    if (dupStat.keptBoth) lines.push('两条都留 ' + dupStat.keptBoth + ' 条');
    if (dupStat.deposits) {
      lines.push('识别为押金/退款，成对去除 <b>' + dupStat.deposits + '</b> 对（' + (dupStat.deposits * 2) + ' 条）');
    }

    if (!lines.length) lines.push('没有可以导入的记录');

    toast('导入结果<br>' + lines.join('<br>'), 5200);
    resetDupStat();
  }

  // ---- 文件选择与解析 ----
  var pendingSource = null;
  var pickerTarget = 'period';     // period | edit —— 日期选择器选完之后给谁
  var editing = null;              // 正在修改的记录（工作副本）

  function pickFileFor(source) {
    pendingSource = source;
    var input = document.getElementById('fileInput');
    input.value = '';
    input.click();
  }

  function handleFile(source, file) {
    toast('正在解析「' + esc(file.name) + '」…', 30000);

    return file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var isZip = bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4B;

      if (source === 'icbc') {
        return parseIcbc(toRows(decodeBytes(bytes)));

      } else if (source === 'alipay') {
        return parseAlipay(toRows(decodeBytes(bytes)));

      } else {
        // 微信：可能是 xlsx，也可能是 csv，两种都认
        if (isZip) return readXlsxRows(bytes).then(parseWechat);
        return Promise.resolve(parseWechat(toRows(decodeBytes(bytes))));
      }
    }).then(function (recs) {
      if (!recs || !recs.length) {
        toast('没解析出记录<br>确认一下是不是这个来源的账单文件');
        return;
      }
      resetDupStat();
      importRecords(recs);
    }).catch(function (e) {
      toast('导入失败：' + esc((e && e.message) ? e.message : e));
    });
  }

  // ---------- 日期选择器 ----------
  function pickerCanNext() {
    var now = new Date();
    if (period === 'month' || period === 'year') return pkYear < now.getFullYear();
    return pkYear < now.getFullYear() || (pkYear === now.getFullYear() && pkMonth < now.getMonth());
  }

  function renderPicker() {
    var body = document.getElementById('pickerBody');
    var title = document.getElementById('pkTitle');
    var today = todayStr();
    var has = recordDateSet();
    var isYear = (period === 'year');
    // 修改记录时，高亮的是那条记录的日期；平时高亮的是当前筛选期间
    var selDate = (pickerTarget === 'edit' && editing) ? editing.date : null;
    var selRange = selDate ? computeRange(parseYmd(selDate), period) : getRange();

    title.textContent = isYear
      ? '选择年份'
      : (period === 'month' ? pkYear + '年' : pkYear + '年' + (pkMonth + 1) + '月');
    document.getElementById('pkPrev').disabled = isYear;
    document.getElementById('pkNext').disabled = isYear || !pickerCanNext();

    // 年：只列年份（最近 12 年）
    if (isYear) {
      var nowY = new Date().getFullYear();
      var curY = selRange.s.getFullYear();
      var hy = '<div class="month-grid">';
      for (var y = nowY; y > nowY - 12; y--) {
        var cy = 'month-cell';
        if (y === curY) cy += ' sel';
        var hasY = false;
        for (var ky in has) {
          if (has.hasOwnProperty(ky) && ky.slice(0, 4) === String(y)) { hasY = true; break; }
        }
        hy += '<div class="' + cy + '" data-year="' + y + '">' + y + '年'
            + (hasY ? '<i class="dot"></i>' : '') + '</div>';
      }
      hy += '</div>';
      body.innerHTML = hy;
      return;
    }

    // 天：完整日历
    if (period === 'day') {
      var first = new Date(pkYear, pkMonth, 1);
      var startDow = first.getDay();
      var days = new Date(pkYear, pkMonth + 1, 0).getDate();
      var wd = ['日', '一', '二', '三', '四', '五', '六'];

      var h = '<div class="cal-grid">';
      for (var w = 0; w < 7; w++) h += '<div class="cal-wd">' + wd[w] + '</div>';
      for (var b = 0; b < startDow; b++) h += '<div class="cal-cell blank"></div>';
      for (var d = 1; d <= days; d++) {
        var ds = pkYear + '-' + pad(pkMonth + 1) + '-' + pad(d);
        var cls = 'cal-cell';
        if (ds > today) cls += ' future';
        if (ds === today) cls += ' today';
        if (ds === (selDate || ymd(anchor))) cls += ' sel';
        h += '<div class="' + cls + '" data-day="' + ds + '">' + d
           + (has[ds] ? '<i class="dot"></i>' : '') + '</div>';
      }
      h += '</div>';
      body.innerHTML = h;
      return;
    }

    // 周：一周一行
    if (period === 'week') {
      var f2 = new Date(pkYear, pkMonth, 1);
      var dow2 = (f2.getDay() + 6) % 7;
      var cur = new Date(f2); cur.setDate(f2.getDate() - dow2);
      var lastDay = new Date(pkYear, pkMonth + 1, 0);
      var curStart = selRange.start;

      var h2 = '';
      while (cur <= lastDay) {
        var we = new Date(cur); we.setDate(we.getDate() + 6);
        var ws = ymd(cur);
        var cls2 = 'week-row';
        if (ws > today) cls2 += ' future';
        if (ws === curStart) cls2 += ' sel';

        var hasRec = false;
        for (var t = new Date(cur); t <= we; t.setDate(t.getDate() + 1)) {
          if (has[ymd(t)]) { hasRec = true; break; }
        }

        h2 += '<div class="' + cls2 + '" data-week="' + ws + '">'
            +   (cur.getMonth() + 1) + '月' + cur.getDate() + '日 - '
            +   (we.getMonth() + 1) + '月' + we.getDate() + '日'
            +   (hasRec ? '<i class="dot"></i>' : '') + '</div>';
        cur.setDate(cur.getDate() + 7);
      }
      body.innerHTML = h2;
      return;
    }

    // 月：12 个月
    var curYM = today.slice(0, 7);
    var curM = selRange.start.slice(0, 7);
    var h3 = '<div class="month-grid">';
    for (var m = 0; m < 12; m++) {
      var ym = pkYear + '-' + pad(m + 1);
      var cls3 = 'month-cell';
      if (ym > curYM) cls3 += ' future';
      if (ym === curM) cls3 += ' sel';

      var hasM = false;
      for (var key in has) {
        if (has.hasOwnProperty(key) && key.slice(0, 7) === ym) { hasM = true; break; }
      }
      h3 += '<div class="' + cls3 + '" data-month="' + m + '">' + (m + 1) + '月'
          + (hasM ? '<i class="dot"></i>' : '') + '</div>';
    }
    h3 += '</div>';
    body.innerHTML = h3;
  }

  function openPicker() {
    var base = (pickerTarget === 'edit' && editing) ? parseYmd(editing.date) : anchor;
    pkYear = base.getFullYear();
    pkMonth = base.getMonth();
    renderPicker();
    document.getElementById('pickerMask').classList.add('on');
  }
  function closePicker() {
    document.getElementById('pickerMask').classList.remove('on');
    pickerTarget = 'period';
  }

  // ---------- 记账弹层 ----------
  var curType = 'expense';

  function openSheet() {
    document.getElementById('amount').value = '';
    document.getElementById('note').value = '';
    document.getElementById('tip').textContent = '';
    document.getElementById('mask').classList.add('on');
  }
  function closeSheet() {
    document.getElementById('mask').classList.remove('on');
  }

  // ---------- 修改记录 ----------
  function openEdit(rec) {
    editing = {
      id: rec.id, type: rec.type, amount: rec.amount, cat: rec.cat,
      peer: rec.peer || '', note: rec.note || '',
      date: rec.date, time: rec.time || ''
    };
    document.getElementById('editAmount').value = Number(rec.amount).toFixed(2);
    document.getElementById('editPeer').value = rec.peer || '';
    document.getElementById('editNote').value = rec.note || '';
    document.getElementById('editDate').textContent = rec.date;
    document.getElementById('editTip').textContent = '';
    renderEditSeg();
    renderEditCats();
    document.getElementById('editMask').classList.add('on');
  }

  function renderEditSeg() {
    var btns = document.querySelectorAll('#editSeg button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-type') === editing.type);
    }
  }

  function renderEditCats() {
    var arr = (CAT_LIST[editing.type] || CAT_LIST.expense).slice();
    if (editing.cat && arr.indexOf(editing.cat) < 0) arr.push(editing.cat);
    var html = '';
    for (var i = 0; i < arr.length; i++) {
      html += '<button class="cat' + (arr[i] === editing.cat ? ' on' : '') + '" data-cat="' + arr[i] + '">'
            + iconOf(arr[i]) + ' ' + arr[i] + '</button>';
    }
    document.getElementById('editCats').innerHTML = html;
  }

  function closeEdit() {
    document.getElementById('editMask').classList.remove('on');
    editing = null;
  }

  function saveEdit() {
    if (!editing) return;
    var raw = (document.getElementById('editAmount').value || '').trim();
    var amt = parseFloat(raw);
    var tip = document.getElementById('editTip');

    if (!raw || isNaN(amt) || amt <= 0) { tip.textContent = '请输入大于 0 的金额'; return; }
    if (amt > 99999999) { tip.textContent = '金额太大了'; return; }

    var list = load();
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === editing.id) {
        list[i].type = editing.type;
        list[i].amount = Math.round(amt * 100) / 100;
        list[i].cat = editing.cat;
        list[i].peer = (document.getElementById('editPeer').value || '').trim();
        list[i].note = (document.getElementById('editNote').value || '').trim();
        list[i].date = editing.date;
        found = list[i];
        break;
      }
    }
    if (!found) { closeEdit(); return; }

    sortList(list);
    save(list);
    closeEdit();
    render();
    toast('已保存修改');
  }

  function deleteEditing() {
    if (!editing) return;
    var label = editing.peer || editing.note || editing.cat || '这条记录';
    var list = load();
    var next = [];
    for (var i = 0; i < list.length; i++) { if (list[i].id !== editing.id) next.push(list[i]); }
    save(next);
    closeEdit();
    render();
    toast('已删除「' + esc(label) + '」');
  }

  // ---------- 事件 ----------
  document.querySelector('.tabs').onclick = function (e) {
    var btn = e.target.closest ? e.target.closest('.tab') : null;
    if (!btn) return;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) { tabs[i].classList.remove('on'); }
    btn.classList.add('on');
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) { pages[j].classList.remove('on'); }
    document.getElementById('page-' + btn.getAttribute('data-tab')).classList.add('on');
  };

  // 时间粒度切换（记录页和统计页各有一套）
  var periodSegs = document.querySelectorAll('.js-period');
  for (var ps = 0; ps < periodSegs.length; ps++) {
    periodSegs[ps].onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      period = btn.getAttribute('data-period');
      anchor = new Date();
      render();
    };
  }

  // 收支筛选：全部 / 只支出 / 只收入
  var flowSegs = document.querySelectorAll('.js-flow');
  for (var fs = 0; fs < flowSegs.length; fs++) {
    flowSegs[fs].onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      flowFilter = btn.getAttribute('data-flow');
      render();
    };
  }

  function shiftAnchorDate(delta) {
    var a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (period === 'day') a.setDate(a.getDate() + delta);
    else if (period === 'week') a.setDate(a.getDate() + delta * 7);
    else if (period === 'year') a.setFullYear(a.getFullYear() + delta);
    else a.setMonth(a.getMonth() + delta);
    return a;
  }
  function canGoNext() { return ymd(shiftAnchorDate(1)) <= todayStr(); }

  var prevs = document.querySelectorAll('.js-prev');
  for (var pv = 0; pv < prevs.length; pv++) {
    prevs[pv].onclick = function () { anchor = shiftAnchorDate(-1); render(); };
  }

  var nexts = document.querySelectorAll('.js-next');
  for (var nx = 0; nx < nexts.length; nx++) {
    nexts[nx].onclick = function () {
      if (!canGoNext()) return;
      anchor = shiftAnchorDate(1);
      render();
    };
  }

  var pickers = document.querySelectorAll('.js-picker');
  for (var pk = 0; pk < pickers.length; pk++) {
    pickers[pk].onclick = openPicker;
  }

  document.getElementById('pkPrev').onclick = function () {
    if (period === 'month') { pkYear -= 1; }
    else { pkMonth -= 1; if (pkMonth < 0) { pkMonth = 11; pkYear -= 1; } }
    renderPicker();
  };
  document.getElementById('pkNext').onclick = function () {
    if (!pickerCanNext()) return;
    if (period === 'month') { pkYear += 1; }
    else { pkMonth += 1; if (pkMonth > 11) { pkMonth = 0; pkYear += 1; } }
    renderPicker();
  };
  document.getElementById('pickerToday').onclick = function () {
    anchor = new Date();
    closePicker();
    render();
  };

  document.getElementById('pickerBody').onclick = function (e) {
    var el = e.target.closest ? e.target.closest('[data-day],[data-week],[data-month],[data-year]') : null;
    if (!el) return;
    var today = todayStr();
    var picked = '';

    if (el.hasAttribute('data-day')) {
      var ds = el.getAttribute('data-day');
      if (ds > today) return;
      picked = ds;

    } else if (el.hasAttribute('data-week')) {
      var ws = el.getAttribute('data-week');
      if (ws > today) return;
      picked = ws;

    } else if (el.hasAttribute('data-year')) {
      var y = parseInt(el.getAttribute('data-year'), 10);
      if (y > parseInt(today.slice(0, 4), 10)) return;
      picked = y + '-01-01';

    } else {
      var m = parseInt(el.getAttribute('data-month'), 10);
      if ((pkYear + '-' + pad(m + 1)) > today.slice(0, 7)) return;
      picked = pkYear + '-' + pad(m + 1) + '-01';
    }

    // 从"修改记录"进来的 → 只改那条记录的日期
    if (pickerTarget === 'edit' && editing) {
      editing.date = picked;
      document.getElementById('editDate').textContent = picked;
      closePicker();
      return;
    }

    // 平时 → 切换筛选期间
    anchor = parseYmd(picked);
    closePicker();
    render();
  };

  document.getElementById('pickerMask').onclick = function (e) {
    if (e.target === document.getElementById('pickerMask')) closePicker();
  };

  // 搜索
  document.getElementById('searchInput').oninput = function () {
    searchQuery = this.value;
    renderList();
  };

  function renderFieldSelect() {
    var names = { all: '全部', amount: '金额', name: '名称' };
    var places = {
      all: '搜名称，或输入金额（≥）',
      amount: '输入金额，找出 ≥ 它的记录',
      name: '搜分类或备注'
    };
    document.getElementById('fsLabel').textContent = names[searchField] || '全部';
    document.getElementById('searchInput').placeholder = places[searchField] || '搜索';
    var items = document.querySelectorAll('#fsMenu .fs-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('on', items[i].getAttribute('data-field') === searchField);
    }
  }

  document.getElementById('fsBtn').onclick = function () {
    document.getElementById('fieldSelect').classList.toggle('open');
  };
  document.getElementById('fsMenu').onclick = function (e) {
    var it = e.target.closest ? e.target.closest('.fs-item') : null;
    if (!it) return;
    searchField = it.getAttribute('data-field');
    document.getElementById('fieldSelect').classList.remove('open');
    renderFieldSelect();
    renderList();
  };

  // 导入
  document.getElementById('importBtn').onclick = function () {
    document.getElementById('importSelect').classList.toggle('open');
  };
  document.getElementById('importMenu').onclick = function (e) {
    var it = e.target.closest ? e.target.closest('.fs-item') : null;
    if (!it) return;
    var src = it.getAttribute('data-src');
    document.getElementById('importSelect').classList.remove('open');
    pickFileFor(src);
  };

  document.getElementById('fileInput').onchange = function () {
    var f = this.files && this.files[0];
    if (!f || !pendingSource) return;
    var src = pendingSource;
    pendingSource = null;
    handleFile(src, f);
  };

  // 疑似重复弹窗的三个选择
  document.getElementById('dupKeepOld').onclick = function () { resolveDup('keepOld'); };
  document.getElementById('dupDropOld').onclick = function () { resolveDup('dropOld'); };
  document.getElementById('dupKeepBoth').onclick = function () { resolveDup('keepBoth'); };

  // 点别的地方收起所有下拉菜单
  document.addEventListener('click', function (e) {
    var boxes = document.querySelectorAll('.field-select');
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].contains(e.target)) boxes[i].classList.remove('open');
    }
  });

  // 隐藏 / 显示金额
  document.getElementById('toggleHide').onclick = function () {
    hideAmount = !hideAmount;
    localStorage.setItem(KEY_HIDE, hideAmount ? '1' : '0');
    renderSummary();
  };

  // 支出 / 收入 切换
  document.querySelector('.seg').onclick = function (e) {
    var btn = e.target.closest ? e.target.closest('button') : null;
    if (!btn) return;
    var all = document.querySelectorAll('.seg button');
    for (var i = 0; i < all.length; i++) { all[i].classList.remove('on'); }
    btn.classList.add('on');
    curType = btn.getAttribute('data-type');
  };

  document.getElementById('openAdd').onclick = openSheet;
  document.getElementById('mask').onclick = function (e) {
    if (e.target === document.getElementById('mask')) closeSheet();
  };

  // 保存（分类按备注自动判断，不再手选）
  document.getElementById('save').onclick = function () {
    var raw = (document.getElementById('amount').value || '').trim();
    var amount = parseFloat(raw);
    var tip = document.getElementById('tip');

    if (!raw || isNaN(amount) || amount <= 0) { tip.textContent = '请输入大于 0 的金额'; return; }
    if (amount > 99999999) { tip.textContent = '金额太大了'; return; }

    var note = (document.getElementById('note').value || '').trim();
    var isIncome = curType === 'income';

    var list = load();
    list.unshift(makeRecord({
      type: curType,
      amount: Math.round(amount * 100) / 100,
      cat: guessCat(note, isIncome),
      note: note,
      date: todayStr(),
      time: nowClock()
    }));
    save(list);
    closeSheet();
    render();
  };

  // 删除（两段确认）
  document.getElementById('listWrap').onclick = function (e) {
    // 点右边的 × → 两段确认删除
    var btn = e.target.closest ? e.target.closest('.rec-del') : null;
    if (btn) {
      var id = btn.getAttribute('data-del');
      if (pendingDelete === id) {
        var list = load();
        var next = [];
        for (var i = 0; i < list.length; i++) { if (list[i].id !== id) next.push(list[i]); }
        save(next);
        pendingDelete = null;
        render();
        return;
      }
      pendingDelete = id;
      render();
      setTimeout(function () {
        if (pendingDelete === id) { pendingDelete = null; render(); }
      }, 3000);
      return;
    }

    // 点整行 → 打开"修改记录"弹窗
    var row = e.target.closest ? e.target.closest('.rec') : null;
    if (!row) return;
    var rid = row.getAttribute('data-id');
    var all = load();
    for (var k = 0; k < all.length; k++) {
      if (all[k].id === rid) { openEdit(all[k]); return; }
    }
  };

  // ---------- 修改记录弹层的事件 ----------
  document.getElementById('editSeg').onclick = function (e) {
    var btn = e.target.closest ? e.target.closest('button') : null;
    if (!btn || !editing) return;
    editing.type = btn.getAttribute('data-type');
    var arr = CAT_LIST[editing.type] || [];
    if (arr.indexOf(editing.cat) < 0) editing.cat = arr[0];
    renderEditSeg();
    renderEditCats();
  };

  document.getElementById('editCats').onclick = function (e) {
    var btn = e.target.closest ? e.target.closest('.cat') : null;
    if (!btn || !editing) return;
    editing.cat = btn.getAttribute('data-cat');
    renderEditCats();
  };

  document.getElementById('editDate').onclick = function () {
    if (!editing) return;
    pickerTarget = 'edit';
    openPicker();
  };

  document.getElementById('editMask').onclick = function (e) {
    if (e.target === document.getElementById('editMask')) closeEdit();
  };

  document.getElementById('editSave').onclick = saveEdit;

  document.getElementById('editDelete').onclick = function () {
    var b = this;
    if (b.getAttribute('data-ok') === '1') {
      b.removeAttribute('data-ok');
      b.textContent = '删除这条';
      deleteEditing();
      return;
    }
    b.setAttribute('data-ok', '1');
    b.textContent = '再点一次删除';
    setTimeout(function () {
      if (b.getAttribute('data-ok') === '1') {
        b.removeAttribute('data-ok');
        b.textContent = '删除这条';
      }
    }, 3000);
  };

  // ============================================================
  //  与「应用箱」的桥接 + 备份 / 恢复 / 清空
  //
  //  WebView 里的网页碰不到手机的文件系统，所以这里通过 postMessage
  //  请应用箱帮忙，做完再把结果注入回 window.__hostResult()。
  // ============================================================

  var hostReqSeq = 0;
  var hostPending = {};

  function hostCall(payload) {
    return new Promise(function (resolve) {
      if (!window.ReactNativeWebView) {
        resolve({ ok: false, error: '当前不在王之宝库里运行，没法读写手机文件' });
        return;
      }
      var id = 'h' + (++hostReqSeq);
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

  function fileStamp() {
    var d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
         + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }

  function renderBackupInfo() {
    var l = load();
    var ds = l.map(function (r) { return r.date; }).sort();
    document.getElementById('backupInfo').innerHTML =
      '当前共 <b>' + l.length + '</b> 条记录<br>时间范围：'
      + (ds.length ? (ds[0] + ' ~ ' + ds[ds.length - 1]) : '暂无记录');
  }

  var pendingRestore = null;

  function doExport() {
    var list = load();
    if (!list.length) { toast('还没有记录，不用备份'); return; }

    var payload = {
      app: '王之宝库·账本',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: list.length,
      settings: { hideAmount: hideAmount },
      records: list
    };
    var name = '账本备份-' + fileStamp() + '.json';

    toast('正在导出…', 30000);
    hostCall({
      type: 'saveFile',
      name: name,
      content: JSON.stringify(payload, null, 2)
    }).then(function (res) {
      if (res && res.ok) {
        var msg = '已导出 <b>' + list.length + '</b> 条记录<br>保存到：'
                + (res.saved || []).join('、');
        if (res.canceled) msg += '<br>（你取消了文件夹选择，只留下 App 里那份）';
        if (res.error2) msg += '<br>存到你选的文件夹失败：' + res.error2;
        toast(msg, 9000);
      } else {
        toast('导出失败：' + ((res && res.error) || '未知原因'), 9000);
      }
    });
  }

  function doPickBackup() {
    toast('请选择备份文件…', 30000);
    hostCall({ type: 'pickTextFile' }).then(function (res) {
      if (!res || res.canceled) { toast('已取消'); return; }
      if (!res.ok) { toast('读取失败：' + (res.error || ''), 7000); return; }

      var data = null;
      try { data = JSON.parse(res.text); } catch (e) { data = null; }
      if (!data || !data.records || !data.records.length) {
        toast('这个文件里没有可恢复的记录');
        return;
      }

      pendingRestore = data.records;
      var btn = document.getElementById('btnImport');
      btn.setAttribute('data-ok', '1');
      btn.textContent = '确认恢复 ' + data.records.length + ' 条（覆盖现在的）';
      toast('读到了 <b>' + data.records.length + '</b> 条记录<br>再点一次「确认恢复」才会覆盖', 8000);
    });
  }

  function doRestore() {
    var recs = pendingRestore || [];
    var list = [];
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!r || !r.date || typeof r.amount !== 'number') continue;
      list.push(makeRecord(r));
    }
    sortList(list);
    save(list);

    pendingRestore = null;
    var btn = document.getElementById('btnImport');
    btn.removeAttribute('data-ok');
    btn.textContent = '从备份恢复';

    render();
    toast('已恢复 <b>' + list.length + '</b> 条记录');
  }

  document.getElementById('btnExport').onclick = doExport;

  document.getElementById('btnImport').onclick = function () {
    if (pendingRestore) { doRestore(); return; }
    doPickBackup();
  };

  document.getElementById('btnClear').onclick = function () {
    var b = this;
    if (b.getAttribute('data-ok') === '1') {
      save([]);
      b.removeAttribute('data-ok');
      b.textContent = '清空所有账目';
      render();
      toast('已清空全部账目');
      return;
    }
    b.setAttribute('data-ok', '1');
    b.textContent = '再点一次，确认清空全部';
    setTimeout(function () {
      if (b.getAttribute('data-ok') === '1') {
        b.removeAttribute('data-ok');
        b.textContent = '清空所有账目';
      }
    }, 4000);
  };

  // ---------- 启动 ----------
  renderFieldSelect();
  render();
</script>
</body>
</html>
`;
