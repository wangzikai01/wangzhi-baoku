// ============================================================
// moduleStore.js —— 模块存储层（应用箱的"仓库"）
//
// 存放在哪：App 的私有目录（documentDirectory）
//   <私有目录>/modules-index.json   模块清单（谁、什么时候导入的、打开过几次）
//   <私有目录>/modules/<id>.html    每个模块的代码本体
//
// 为什么放私有目录：卸载 App 才会清空，用户可以随便清缓存，模块不会丢。
//
// 【重要】expo-file-system 在 SDK 54 换过 API。
//   新 API（本文件用的）：Paths / File / Directory，方法是同步的
//   旧 API 已经移到 'expo-file-system/legacy'
// ============================================================

import { Directory, File, Paths } from 'expo-file-system';

const INDEX_FILE_NAME = 'modules-index.json';
const MODULES_DIR_NAME = 'modules';

// ------------------------------------------------------------
// 基础工具
// ------------------------------------------------------------

// 模块目录（不存在就建一个）
function getModulesDir() {
  const dir = new Directory(Paths.document, MODULES_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

// 清单文件对象（不一定存在）
function getIndexFile() {
  return new File(Paths.document, INDEX_FILE_NAME);
}

// 生成形如 2026-02-20 的日期字符串
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 生成唯一 id
function genId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ------------------------------------------------------------
// 读 / 写清单
// ------------------------------------------------------------

// 读取全部模块记录。返回数组，最新的在最前面。
export function loadModules() {
  const file = getIndexFile();
  if (!file.exists) return [];
  try {
    const list = JSON.parse(file.textSync());
    return Array.isArray(list) ? list : [];
  } catch (e) {
    // 清单损坏时不崩溃，当作空的处理
    return [];
  }
}

// 保存清单（内部函数）
function saveModules(list) {
  const file = getIndexFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(list, null, 2));
}

// ------------------------------------------------------------
// 对外功能
// ------------------------------------------------------------

// 导入一个模块：把 HTML 内容存成文件，并在清单里加一条记录
// 返回新建的记录
export function addModule(name, html) {
  const id = genId();
  const fileName = `${id}.html`;

  // 1. 写代码文件
  const dir = getModulesDir();
  const file = new File(dir, fileName);
  if (!file.exists) file.create();
  file.write(html);

  // 2. 写清单记录
  const record = {
    id,
    name: name || '未命名模块',
    fileName,
    importedAt: todayString(), // 导入时间 = 安装时间
    openCount: 0,
    lastOpenedAt: null,
    size: file.size || 0,
  };
  const list = loadModules();
  list.unshift(record);
  saveModules(list);

  return record;
}

// 读取某个模块的 HTML 源码
export function readModuleHtml(record) {
  const file = new File(getModulesDir(), record.fileName);
  if (!file.exists) return '';
  return file.textSync();
}

// 记录"打开了一次"
export function markOpened(id) {
  const list = loadModules().map((m) =>
    m.id === id
      ? { ...m, openCount: (m.openCount || 0) + 1, lastOpenedAt: todayString() }
      : m
  );
  saveModules(list);
  return list;
}

// 删除模块（同时删掉文件）
export function removeModule(id) {
  const list = loadModules();
  const target = list.find((m) => m.id === id);
  if (target) {
    const file = new File(getModulesDir(), target.fileName);
    if (file.exists) file.delete();
  }
  const next = list.filter((m) => m.id !== id);
  saveModules(next);
  return next;
}

// 重命名
export function renameModule(id, name) {
  const next = loadModules().map((m) => (m.id === id ? { ...m, name } : m));
  saveModules(next);
  return next;
}

// ------------------------------------------------------------
// 内置模块（第一方模块，跟着 App 一起发布）
//
// 和"用户导入的模块"的区别：
//   · 已存在 → 只覆盖 HTML 文件，**id 不变**
//     id 不变 → 假域名不变 → localStorage 不变 → 数据一条不丢
//   · 不存在 → 新建
// 这样开发者改完代码，用户手机上立刻是新版本，而账目还在。
//
// 【skipSync】如果模块记录里有 skipSync=true，说明用户手动更新过，
//   这里就不再覆盖 —— 避免下次启动把用户的更新冲掉。
// ------------------------------------------------------------
export function ensureBuiltinModule(name, html) {
  const list = loadModules();
  const existing = list.find((m) => m.builtin && m.name === name);
  const dir = getModulesDir();

  if (existing) {
    // 如果用户手动更新过（skipSync），就不要用 bundled 版本覆盖
    if (existing.skipSync) return existing;

    const file = new File(dir, existing.fileName);
    if (!file.exists) file.create();
    file.write(html);
    const next = list.map((m) =>
      m.id === existing.id ? { ...m, size: file.size || 0 } : m
    );
    saveModules(next);
    return existing;
  }

  const id = genId();
  const fileName = `${id}.html`;
  const file = new File(dir, fileName);
  if (!file.exists) file.create();
  file.write(html);

  const record = {
    id,
    name,
    fileName,
    importedAt: todayString(),
    openCount: 0,
    lastOpenedAt: null,
    size: file.size || 0,
    builtin: true,
  };
  list.unshift(record);
  saveModules(list);
  return record;
}

// 更新某个模块的 HTML 内容（用于从 GitHub 拉取最新版本）
// 会设置 skipSync=true，防止下次启动时被 bundled 版本覆盖
export function updateModuleHtml(id, html) {
  const list = loadModules();
  const target = list.find((m) => m.id === id);
  if (!target) return { ok: false, error: '模块不存在' };

  const dir = getModulesDir();
  const file = new File(dir, target.fileName);
  if (!file.exists) file.create();
  file.write(html);

  const next = list.map((m) =>
    m.id === id
      ? { ...m, size: file.size || 0, skipSync: true, updatedAt: todayString() }
      : m
  );
  saveModules(next);
  return { ok: true, size: file.size || 0 };
}
