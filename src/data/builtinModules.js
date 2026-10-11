// ============================================================
// builtinModules.js —— 内置模块登记表
//
// 以后每做一个"第一方模块"（跟着 App 一起发、需要反复迭代的那种），
// 就在这里登记一条。App 启动时会把它们写进模块仓库；
// 每次打开时会用最新代码覆盖，但 id 不变，所以数据不会丢。
//
// 用户自己导入的模块不在这里，那些是完全独立的。
// ============================================================

import { LEDGER_HTML, LEDGER_MODULE_NAME } from './ledgerModule';
import { SUDOKU_HTML, SUDOKU_MODULE_NAME } from './sudokuModule';
import { MINESWEEPER_HTML, MINESWEEPER_MODULE_NAME } from './minesweeperModule';
import { POETRY_HTML, POETRY_MODULE_NAME } from './poetryModule';
import { EXAM_HTML, EXAM_MODULE_NAME } from './examModule';
import { ZONGCE_HTML, ZONGCE_MODULE_NAME } from './zongceModule';

export const BUILTIN_MODULES = [
  { name: LEDGER_MODULE_NAME, html: LEDGER_HTML },
  { name: SUDOKU_MODULE_NAME, html: SUDOKU_HTML },
  { name: MINESWEEPER_MODULE_NAME, html: MINESWEEPER_HTML },
  { name: POETRY_MODULE_NAME, html: POETRY_HTML },
  { name: EXAM_MODULE_NAME, html: EXAM_HTML },
  { name: ZONGCE_MODULE_NAME, html: ZONGCE_HTML },
];

export function findBuiltin(name) {
  for (let i = 0; i < BUILTIN_MODULES.length; i++) {
    if (BUILTIN_MODULES[i].name === name) return BUILTIN_MODULES[i];
  }
  return null;
}
