# 我的第一个 App —— 项目说明

> 这是整个 App 开发的**第 1 步**：搭好项目骨架，让一个空白页面出现在手机上。
> 目的是打通「电脑写代码 → 手机立刻看到效果」这条通道，而不是做功能。

---

## 一、这个项目用的是什么技术

**Expo + React Native**。一句话解释：

- **React Native**：用 JavaScript 写代码，编译成真正的安卓原生 App（不是网页套壳）
- **Expo**：React Native 的"全家桶 + 保姆工具"，帮你把环境配置、打包、调试这些麻烦事全包了

选它的原因：一套代码同时支持安卓和苹果；改代码后手机上**秒级刷新**，不用每次重新安装。

---

## 二、目录结构（哪些重要，哪些不用管）

```
my-first-app/
├── App.js              ★ 最重要！App 的入口，屏幕上显示什么由它决定
├── index.js            启动文件，把 App.js 注册成 App 的根组件（不用改）
├── app.json            ★ App 的"身份证"：名字、图标、版本号、安卓包名
├── package.json        ★ 项目清单：装了哪些包、有哪些命令
├── package-lock.json   依赖的精确版本锁定（自动生成，不用手改）
├── assets/             图片素材：图标、启动图
│   ├── icon.png                      App 图标（桌面上的样子）
│   ├── splash-icon.png               启动页图标（点开 App 时第一眼看到的）
│   ├── adaptive-icon-*.png           安卓自适应图标（三种前景/背景/单色）
│   ├── android-icon-*.png            同上
│   └── favicon.png                   网页版用的图标
├── .gitignore          Git 忽略清单（node_modules 等不上传）
└── node_modules/       ⚠️ 所有依赖包的源码，460+ 个文件夹，**不用看也不要动**
```

**你现在只需要关心两个文件：`App.js` 和 `app.json`。**

---

## 三、用到了哪些包（一共 4 个直接依赖）

| 包名 | 版本 | 作用 | 类比 |
|---|---|---|---|
| **expo** | ~57.0.25 | 核心框架，提供开发服务器、打包、各种系统能力 | 房子的地基和管线 |
| **react** | 19.2.3 | UI 框架本身，负责"数据变了界面怎么跟着变" | 房子的结构 |
| **react-native** | 0.86.3 | 把 React 的界面变成真正的安卓/苹果原生控件 | 砖头水泥 |
| **expo-status-bar** | ~57.0.1 | 控制手机顶部状态栏（时间/电量那条）的颜色 | 窗帘 |

`npm install` 时实际装进 `node_modules` 的是 **464 个包**——因为上面这 4 个包自己又依赖了很多别的包。这是前端开发的常态，不用担心。

**在 App.js 里我们实际用到了：**

```js
import { StatusBar } from 'expo-status-bar';          // 状态栏
import { StyleSheet, Text, View } from 'react-native';  // 三个基础积木
```

- `View` = 容器，相当于网页的 `<div>`
- `Text` = 文字，相当于网页的 `<p>`
- `StyleSheet` = 写样式，相当于 CSS（但属性名用驼峰式，数值不写单位）

---

## 四、手机上要装什么

**Expo Go** —— 一个"播放器"。它本身不是我们的 App，而是负责加载我们在电脑上写的代码。

| 项目 | 说明 |
|---|---|
| 去哪下 | https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.apk |
| 为什么是这个版本 | 我们的项目是 Expo SDK 57，**Expo Go 的大版本必须和它对应**，下 58.x 会打不开 |
| 备用下载 | 官方链接在国内可能很慢，可搜索 "Expo Go 57.0.9 APK"（APKPure / APKMirror） |
| 华为能装吗 | 能。华为没有 Google 服务不影响，Expo Go 不需要谷歌服务 |

> ⚠️ 首次启动 Expo Go 时，如果系统提示"纯净模式拦截 / 未经华为安全检测"，选择**"继续安装"**即可。

**电脑上什么都不用再装** —— Node.js、Git、VS Code、Java 你都已经有了。

---

## 五、每次开发的标准操作（这是你以后每天要做的事）

打开 PowerShell，执行：

```powershell
cd E:\code\my-first-app
npx expo start
```

然后手机打开 Expo Go → 选择 **"Enter URL manually"**（手动输入地址）→ 输入：

```
exp://192.168.43.79:8081
```

> 这个 IP 是**你电脑当前的局域网地址**，换网络后会变。每次运行 `npx expo start` 后，
> 终端里会打印 `exp://xxx.xxx.xxx.xxx:8081`，照着那个输就行。

**前提条件：手机和电脑必须在同一个 Wi-Fi 下。** 现在电脑的 IP 是 `192.168.43.79`，
这个网段通常是"手机开热点给电脑用"，如果是这种接法，手机本身就能连到电脑，没问题。

之后只要我改了 `App.js`，手机上会自动刷新，**不需要重新扫码**。

停止服务器：在终端里按 `Ctrl + C`。

---

## 六、出问题了怎么排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 手机一直转圈连不上 | 不在同一个 Wi-Fi | 让手机和电脑连同一个路由器 |
| 手机一直转圈连不上 | Windows 防火墙拦了 | 首次运行时会弹窗"是否允许 Node.js 访问网络"，勾选**专用网络**并允许；如果当时点了取消，去「Windows 安全中心 → 防火墙和网络保护 → 允许应用通过防火墙」里把 Node.js 勾上 |
| 提示 "Project is incompatible with this version of Expo Go" | Expo Go 版本不对 | 卸载，重装 **57.0.9** 这个版本 |
| 手机上白屏 / 红屏报错 | 代码有错 | 把红屏上的文字截图发我 |
| 终端报端口被占用 | 8081 被占 | 在 `npx expo start` 后面加 `--port 8082` |
| 改了代码手机没反应 | 自动刷新没生效 | 在 Expo Go 里摇一摇手机 → 点 Reload |

---

## 七、下一步

1. **你先把这个空白页面在手机上跑出来** —— 跑通了，说明整条链路都通了，后面就只是堆功能
2. 然后告诉我想做的 App 具体是什么（记录什么内容）
3. 我会先写一份「功能清单 + 页面清单」给你确认，再开始一个功能一个功能地写

**注意**：现在这个阶段，App 只在"连着电脑"的时候能跑。等项目做完了，
我们会把它打包成一个真正的 `.apk` 安装包，装进手机后就能脱开电脑独立运行。

---

## 八、用 MuMu 模拟器调试（日常开发首选）

比真机方便：不用数据线、不用拷文件、装应用直接一条 adb 命令、还能随时截图。

**环境信息（本机实测）**

| 项目 | 值 |
|---|---|
| 模拟器 | MuMu Player 12 |
| 安装目录 | `D:\soft\MuMuPlayer` |
| 安卓版本 | Android 12（API 32） |
| CPU 架构 | x86_64（同时支持 arm64-v8a 转译） |
| 自带 adb | `D:\soft\MuMuPlayer\nx_main\adb.exe` |
| adb 端口 | `127.0.0.1:16384`（另外 5555 / 7555 / emulator-5554 是同一台机器） |

**首次准备（已完成，换电脑才需要重做）**

```powershell
$adb = "D:\soft\MuMuPlayer\nx_main\adb.exe"
& $adb connect 127.0.0.1:16384
& $adb -s 127.0.0.1:16384 install -r -g "E:\code\Expo-Go-57.0.9.apk"
```

**每次开发的固定三步**

```powershell
$adb  = "D:\soft\MuMuPlayer\nx_main\adb.exe"
$dev  = "127.0.0.1:16384"

# ① 启动开发服务器（另开一个终端，保持运行）
#    cd E:\code\my-first-app ; npx expo start

# ② 让模拟器能访问电脑的 8081 端口（关键！）
& $adb connect $dev
& $adb -s $dev reverse tcp:8081 tcp:8081

# ③ 直接在模拟器里打开我们的项目
& $adb -s $dev shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

**随手截图**

```powershell
& $adb -s $dev shell screencap -p /sdcard/s.png
& $adb -s $dev pull /sdcard/s.png "D:\s.png"
```

**这里有个必踩的坑**

> 模拟器里的 `127.0.0.1` 指的是**模拟器自己**，不是你的电脑。
> 所以必须先用 `adb reverse tcp:8081 tcp:8081` 把端口打通，
> 否则 Expo Go 永远连不上，只会一直转圈。
> （另一个办法是直接用电脑的局域网 IP，比如 `exp://192.168.43.79:8081`，但这个 IP 换网络就会变。）

**另外**：adb 守护进程有时会被重启，如果报 `device not found`，重新执行一次 `& $adb connect $dev` 即可。
