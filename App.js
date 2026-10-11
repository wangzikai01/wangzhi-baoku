// ============================================================
// App.js —— App 入口 / 极简路由
//
// 现在只有两个页面：
//   ① 应用列表（默认）
//   ② 模块运行页（点了某个模块之后）
//
// 用一个 state 变量 opened 来决定显示哪个 —— 这就是最小可用的"路由"。
// 页面再多（比如加上设置页、关于页）就应该换成 expo-router 了。
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import AppListScreen from './src/screens/AppListScreen';
import ModuleViewerScreen from './src/screens/ModuleViewerScreen';
import { BUILTIN_MODULES } from './src/data/builtinModules';
import { ensureBuiltinModule } from './src/storage/moduleStore';

export default function App() {
  // null 表示在列表页；有值表示正在看某个模块
  const [opened, setOpened] = useState(null);
  // 从模块返回时 +1，用来通知列表页重新读一遍数据（打开次数变了）
  const [reloadToken, setReloadToken] = useState(0);

  // 启动时把内置模块写进仓库。
  // 已经存在的话只覆盖代码，id 和统计数据都保留 —— 所以改了代码账目也不会丢。
  useEffect(() => {
    BUILTIN_MODULES.forEach((m) => ensureBuiltinModule(m.name, m.html));
    setReloadToken((t) => t + 1);
  }, []);

  const handleOpen = useCallback((module, html) => {
    setOpened({ module, html });
  }, []);

  const handleClose = useCallback(() => {
    setOpened(null);
    setReloadToken((t) => t + 1);
  }, []);

  // 安卓的物理返回键：正在看模块时，按返回 = 回到列表；否则交给系统处理
  useEffect(() => {
    if (!opened) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [opened, handleClose]);

  return (
    <>
      {opened ? (
        <ModuleViewerScreen
          module={opened.module}
          html={opened.html}
          onClose={handleClose}
        />
      ) : (
        <AppListScreen onOpenModule={handleOpen} reloadToken={reloadToken} />
      )}

      <StatusBar style="light" />
    </>
  );
}
