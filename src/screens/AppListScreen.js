// ============================================================
// AppListScreen.js —— 「应用」列表页（正式版）
//
// 数据来源已经换成真实的模块仓库（moduleStore），不再是假数据。
//
// 三块内容：
//   ① 标题栏      「应用」 + 右上角「+ 导入」
//   ② 工具栏      「N 个模块」 + 三个排序按钮
//   ③ 列表        一行一个模块；点一下打开，长按出菜单
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { File } from 'expo-file-system';

import { colors, radius, spacing } from '../theme';
import {
  addModule,
  ensureBuiltinModule,
  loadModules,
  markOpened,
  readModuleHtml,
  removeModule,
} from '../storage/moduleStore';
import { findBuiltin } from '../data/builtinModules';
import { SAMPLE_MODULE_HTML, SAMPLE_MODULE_NAME } from '../data/sampleModule';

const TOP_INSET =
  Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 44;

const SORTS = [
  { key: 'importedAt', label: '导入时间' },
  { key: 'lastOpenedAt', label: '最近打开' },
  { key: 'openCount', label: '打开次数' },
];

// 图标底色候选（按模块名做个简单哈希挑一个，保证同名永远同色）
const ICON_COLORS = [
  '#07C160', '#1677FF', '#FB7299', '#7C4DFF', '#FF7A45',
  '#00BFA5', '#F5576C', '#4C6EF5', '#12B7F5', '#FFB020',
];

function colorFor(name) {
  let h = 0;
  const s = String(name || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ICON_COLORS[h % ICON_COLORS.length];
}

function initialFor(name) {
  const s = String(name || '').trim();
  return s ? s[0] : '?';
}

// ------------------------------------------------------------
// 列表里的一行
// ------------------------------------------------------------
function ModuleRow({ item, onPress, onLongPress }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={400}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.icon, { backgroundColor: colorFor(item.name) }]}>
        <Text style={styles.iconText}>{initialFor(item.name)}</Text>
      </View>

      <View style={styles.rowMain}>
        <Text style={styles.appName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.appMeta} numberOfLines={1}>
          导入于 {item.importedAt}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.usage}>
          {item.openCount || 0}
          <Text style={styles.usageUnit}> 次</Text>
        </Text>
        <Text style={styles.usageLabel}>
          {item.lastOpenedAt ? `最近 ${item.lastOpenedAt}` : '还没打开过'}
        </Text>
      </View>
    </Pressable>
  );
}

// ------------------------------------------------------------
// 整个页面
// ------------------------------------------------------------
export default function AppListScreen({ onOpenModule, reloadToken }) {
  const [modules, setModules] = useState([]);
  const [sortKey, setSortKey] = useState('importedAt');

  // 从仓库重新读一遍（返回列表页时会因为 reloadToken 变化而重新读）
  const refresh = useCallback(() => {
    setModules(loadModules());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, reloadToken]);

  // 排序
  const data = useMemo(() => {
    const list = [...modules];
    if (sortKey === 'openCount') {
      list.sort((a, b) => (b.openCount || 0) - (a.openCount || 0));
    } else {
      // 日期字符串 'YYYY-MM-DD' 可以直接比较；空值排到最后
      list.sort((a, b) =>
        String(b[sortKey] || '').localeCompare(String(a[sortKey] || ''))
      );
    }
    return list;
  }, [modules, sortKey]);

  // 导入：弹出系统文件选择器 → 读内容 → 存进仓库
  const handleImport = useCallback(async () => {
    try {
      const res = await File.pickFileAsync({ mimeTypes: '*/*' });
      if (res.canceled || !res.result) return;

      const picked = res.result;
      const html = await picked.text();
      const name = String(picked.name || '').replace(/\.html?$/i, '') || '未命名模块';

      addModule(name, html);
      refresh();
      Alert.alert('导入成功', `「${name}」已经放进王之宝库了`);
    } catch (e) {
      Alert.alert('导入失败', String((e && e.message) || e));
    }
  }, [refresh]);

  // 载入内置示例
  const handleLoadSample = useCallback(() => {
    addModule(SAMPLE_MODULE_NAME, SAMPLE_MODULE_HTML);
    refresh();
  }, [refresh]);

  // 打开模块
  const handleOpen = useCallback(
    (item) => {
      // 内置模块：每次都直接用最新的打包代码，并顺手把磁盘上的文件同步成新版。
      // 因为 id 没变，模块的存储空间也没变，所以账目数据不会丢。
      const builtin = item.builtin ? findBuiltin(item.name) : null;

      let html;
      if (builtin) {
        ensureBuiltinModule(builtin.name, builtin.html);
        html = builtin.html;
      } else {
        html = readModuleHtml(item);
      }

      if (!html) {
        Alert.alert('打不开', '模块文件不见了，可能是被清理了');
        return;
      }

      markOpened(item.id);
      onOpenModule(item, html);
    },
    [onOpenModule]
  );

  // 长按菜单
  const handleLongPress = useCallback(
    (item) => {
      Alert.alert(item.name, '要做什么？', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            Alert.alert('确认删除', `「${item.name}」会被永久删除，数据也会一起没掉。`, [
              { text: '再想想', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: () => {
                  removeModule(item.id);
                  refresh();
                },
              },
            ]);
          },
        },
      ]);
    },
    [refresh]
  );

  return (
    <View style={styles.page}>
      {/* ① 标题栏 */}
      <View style={[styles.header, { paddingTop: TOP_INSET + spacing.md }]}>
        <Text style={styles.title}>王之宝库</Text>

        <Pressable
          onPress={handleImport}
          hitSlop={12}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <Text style={styles.addBtnText}>＋ 导入</Text>
        </Pressable>
      </View>

      {/* ② 工具栏 */}
      <View style={styles.toolbar}>
        <Text style={styles.count}>{data.length} 个模块</Text>

        <View style={styles.sorts}>
          {SORTS.map((s, i) => {
            const active = s.key === sortKey;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSortKey(s.key)}
                hitSlop={10}
                style={i > 0 ? styles.sortItemGap : null}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ③ 列表 / 空状态 */}
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>王之宝库还是空的</Text>
          <Text style={styles.emptyDesc}>
            点右上角「＋ 导入」，选一个 .html 文件放进来{'\n'}
            一个 HTML 文件就是一个模块
          </Text>
          <Pressable
            onPress={handleLoadSample}
            style={({ pressed }) => [styles.sampleBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.sampleBtnText}>先载入一个示例模块看看</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ModuleRow
              item={item}
              onPress={handleOpen}
              onLongPress={handleLongPress}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ------------------------------------------------------------
// 样式
// ------------------------------------------------------------
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ① 标题栏
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  addBtnPressed: {
    opacity: 0.8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ② 工具栏
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  count: {
    fontSize: 13,
    color: colors.subText,
  },
  sorts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortItemGap: {
    marginLeft: 18,
  },
  sortText: {
    fontSize: 13,
    color: colors.sortIdle,
  },
  sortTextActive: {
    color: colors.sortActive,
    fontWeight: '700',
  },

  // ③ 列表
  list: {
    flex: 1,
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: 30,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginLeft: 78,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: '#F7F8FA',
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
  },
  rowMain: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  appMeta: {
    marginTop: 5,
    fontSize: 12,
    color: colors.subText,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  usage: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  usageUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.subText,
  },
  usageLabel: {
    marginTop: 3,
    fontSize: 11,
    color: colors.subText,
  },

  // 空状态
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 54,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 21,
    color: colors.subText,
    textAlign: 'center',
  },
  sampleBtn: {
    marginTop: 26,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  sampleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
});
