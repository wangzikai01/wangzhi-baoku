// ============================================================
// ModuleViewerScreen.js —— 模块运行页
//
// 用一个内置浏览器（WebView）把模块的 HTML 跑起来。
//
// 【为什么要 baseUrl】
// 每个模块的地址伪装成 https://module-<id>.local/
// 这样每个模块就是一个独立的"域名"，它们各自的 localStorage
// 是互相隔离的 —— A 模块的数据 B 模块看不到，也不会互相覆盖。
// （localStorage 是按"域名"隔离的，只按路径分是不够的）
//
// 【宿主能力（模块 → 手机）】
// WebView 里的模块本身碰不到手机的文件系统，所以这里开了一组
// 通用接口：模块用 postMessage 发请求，这里做完再把结果注入回去。
//   {type:'saveFile',   name, content}  保存一个文本文件
//   {type:'pickTextFile'}               让用户选一个文本文件并读出来
// 结果通过 window.__hostResult({id, ok, ...}) 回到模块。
//
// 【关于"保存到手机"】
// Android 12 的沙盒不允许 App 直接往共享存储（比如 /sdcard/Download）
// 写文件（会报 Missing 'WRITE' permission），所以走两步：
//   ① 先写进 App 自己的私有目录 —— 这一步必定成功、瞬间完成
//   ② 再用系统的"文件夹选择器"(SAF)，让用户挑一个真实目录存一份，
//      默认定位到「下载」文件夹
// 这里刻意**不用系统分享面板**：分享面板会列出手机上所有能接收文件的
// App（包括 ChatGPT 之类），用户一不留神就跳到别的 App 去了。
// ============================================================

import React, { useCallback, useRef } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

import { colors, spacing } from '../theme';

const TOP_INSET =
  Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 44;

// 存一个文本文件到两个地方：App 私有目录 + 用户挑的文件夹
async function saveTextFile(name, content) {
  const out = { saved: [], uri: null, error: null, error2: null, canceled: false };

  // ① App 私有目录 —— 必定成功
  try {
    const dir = new Directory(Paths.document, 'backups');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, name);
    if (f.exists) f.delete();
    f.create();
    f.write(content);
    out.saved.push('App 私有目录 backups/');
    out.uri = f.uri;
  } catch (e) {
    out.error = String((e && e.message) || e);
  }

  // ② 系统文件夹选择器 —— 让用户挑个真实目录（默认「下载」）
  try {
    const SAF = LegacyFS.StorageAccessFramework;
    let startUri = null;
    try {
      if (SAF.getUriForDirectoryInRoot) {
        startUri = SAF.getUriForDirectoryInRoot('Download');
      }
    } catch (e) {
      startUri = null;
    }

    const perm = await SAF.requestDirectoryPermissionsAsync(startUri);
    if (!perm || !perm.granted) {
      out.canceled = true;
    } else {
      const uri = await SAF.createFileAsync(perm.directoryUri, name, 'application/json');
      await LegacyFS.writeAsStringAsync(uri, content);
      out.saved.push('你选择的文件夹');
      if (!out.uri) out.uri = uri;
    }
  } catch (e) {
    out.error2 = String((e && e.message) || e);
  }

  return out;
}

// 存一个二进制文件（base64 传进来）到两个地方：App 私有目录 + 用户挑的文件夹
// 综测记录导出 Word（.docx 其实是个 zip）要用这个
async function saveBinaryFile(name, base64, mime) {
  const out = { saved: [], uri: null, error: null, error2: null, canceled: false };

  // ① App 私有目录 —— 必定成功
  try {
    const dir = new Directory(Paths.document, 'backups');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, name);
    if (f.exists) f.delete();
    f.create();
    // 新 API 的 write 只写字符串，二进制要用 legacy 的 base64 方式写
    await LegacyFS.writeAsStringAsync(f.uri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    out.saved.push('App 私有目录 backups/');
    out.uri = f.uri;
  } catch (e) {
    out.error = String((e && e.message) || e);
  }

  // ② 系统文件夹选择器 —— 让用户挑个真实目录（默认「下载」）
  try {
    const SAF = LegacyFS.StorageAccessFramework;
    let startUri = null;
    try {
      if (SAF.getUriForDirectoryInRoot) {
        startUri = SAF.getUriForDirectoryInRoot('Download');
      }
    } catch (e) {
      startUri = null;
    }

    const perm = await SAF.requestDirectoryPermissionsAsync(startUri);
    if (!perm || !perm.granted) {
      out.canceled = true;
    } else {
      const uri = await SAF.createFileAsync(
        perm.directoryUri,
        name,
        mime || 'application/octet-stream'
      );
      await LegacyFS.writeAsStringAsync(uri, base64, {
        encoding: LegacyFS.EncodingType.Base64,
      });
      out.saved.push('你选择的文件夹');
      if (!out.uri) out.uri = uri;
    }
  } catch (e) {
    out.error2 = String((e && e.message) || e);
  }

  return out;
}

export default function ModuleViewerScreen({ module, html, onClose }) {
  const webRef = useRef(null);

  // 把结果送回模块里的 JS
  const reply = useCallback((payload) => {
    const js =
      'window.__hostResult && window.__hostResult(' +
      JSON.stringify(payload) +
      '); true;';
    webRef.current?.injectJavaScript(js);
  }, []);

  const handleMessage = useCallback(
    async (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch (e) {
        return;
      }
      if (!msg || !msg.type) return;

      // 保存文件
      if (msg.type === 'saveFile') {
        let r;
        try {
          r = await saveTextFile(msg.name || 'backup.json', msg.content || '');
        } catch (e) {
          reply({ id: msg.id, ok: false, error: String((e && e.message) || e) });
          return;
        }
        console.log('[host] 保存结果:', JSON.stringify(r.saved), r.error2 || '');
        reply({
          id: msg.id,
          ok: r.saved.length > 0,
          saved: r.saved,
          canceled: r.canceled,
          error: r.error,
          error2: r.error2,
        });
        return;
      }

      // 保存二进制文件（base64 传进来）
      if (msg.type === 'saveBinaryFile') {
        let r;
        try {
          r = await saveBinaryFile(msg.name || 'file.bin', msg.base64 || '', msg.mime || '');
        } catch (e) {
          reply({ id: msg.id, ok: false, error: String((e && e.message) || e) });
          return;
        }
        console.log('[host] 保存二进制:', JSON.stringify(r.saved), r.error2 || '');
        reply({
          id: msg.id,
          ok: r.saved.length > 0,
          saved: r.saved,
          canceled: r.canceled,
          error: r.error,
          error2: r.error2,
        });
        return;
      }

      // 申请相机权限 —— 综测记录的"拍照"要用。
      // 注意：react-native-webview 是在 onShowFileChooser 里同步检查这个权限的，
      // 没授权就只打一行日志、静默失败。所以必须**提前**申请好。
      if (msg.type === 'requestCamera') {
        if (Platform.OS !== 'android') {
          reply({ id: msg.id, ok: true, granted: true });
          return;
        }
        try {
          const r = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: '要用一下相机',
              message:
                '「拍照」需要相机权限。不允许也没关系，你还是可以从相册选图片。',
              buttonPositive: '允许',
              buttonNegative: '不用了',
            }
          );
          reply({
            id: msg.id,
            ok: true,
            granted: r === PermissionsAndroid.RESULTS.GRANTED,
            state: r,
          });
        } catch (e) {
          reply({ id: msg.id, ok: false, error: String((e && e.message) || e) });
        }
        return;
      }

      // 选一个文本文件并读回来
      if (msg.type === 'pickTextFile') {
        try {
          const res = await File.pickFileAsync({ mimeTypes: '*/*' });
          if (res.canceled || !res.result) {
            reply({ id: msg.id, ok: false, canceled: true });
            return;
          }
          const text = await res.result.text();
          reply({
            id: msg.id,
            ok: true,
            name: res.result.name,
            text: text,
          });
        } catch (e) {
          reply({ id: msg.id, ok: false, error: String((e && e.message) || e) });
        }
        return;
      }
    },
    [reply]
  );

  return (
    <View style={styles.page}>
      {/* 顶部返回栏。
          这里刻意不显示模块名 —— 因为模块内容自己顶部就有横栏和标题，
          再显示一遍名字会重复、浪费一行屏幕。 */}
      <View style={[styles.bar, { paddingTop: TOP_INSET + spacing.sm }]}>
        <Pressable onPress={onClose} hitSlop={14} style={styles.side}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
      </View>

      {/* 模块本体 */}
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{
          html,
          baseUrl: `https://module-${module.id}.local/`,
        }}
        domStorageEnabled
        javaScriptEnabled
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        // 打开 WebView 的远程调试端口。
        // 打开后电脑上可以连 Chrome 调试协议，直接查模块的 DOM、点元素、读数据 ——
        // 这是开发/调试模块时最有用的一个开关。
        // 但正式版（release）必须关掉：那等于给任何拿到手机的人开了个后门。
        webviewDebuggingEnabled={__DEV__}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  side: {
    minWidth: 64,
  },
  back: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
  },
  web: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
