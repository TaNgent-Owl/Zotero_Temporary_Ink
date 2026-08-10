# Zotero Temporary Ink 插件开发规格书

## 0. 给 Codex 的总指令

请根据本文档从零开发一个可安装到 **Zotero 9.0.6 Desktop** 的插件。

插件暂定名称：

**Zotero Temporary Ink**

内部代号：

```
temporary-ink
```

建议插件 ID：

```
temporary-ink@local
```

本项目的首要目标不是制作新的 Zotero 批注系统，而是在 Zotero PDF Reader 上实现一个：

> 不创建批注、不修改 PDF、不保存内容、松开鼠标后自动消失的临时墨迹层。

它的用途是阅读辅助。

用户阅读 PDF 时喜欢按住鼠标在当前文字、公式、图表附近随手划线、画圈或框选，以获得即时视觉反馈，但这些动作不应该成为真正的 Zotero Annotation。

# 1. 开发原则

请严格遵循以下原则，优先级从高到低。

## 1.1 不修改 Zotero 数据

临时墨迹必须：

- 不创建 Zotero Annotation；
- 不修改 attachment；
- 不修改 PDF；
- 不写入 Zotero 数据库；
- 不进入 Undo / Redo 历史；
- 不参与 Zotero Sync；
- 不影响现有 PDF 批注；
- PDF 关闭后不存在任何残留。

这是一层纯视觉 Overlay。

## 1.2 优先使用 Zotero Reader 提供的扩展入口

优先使用：

```
Zotero.Reader.registerEventListener(...)
```

特别关注：

```
renderToolbar
```

等 Reader 生命周期事件。

不要通过轮询：

```
setInterval(...)
```

不停查找 Reader DOM。

不要全局 monkey patch Zotero 核心方法。

## 1.3 对 Zotero Reader 内部实现进行隔离

由于临时墨迹最终需要监听 PDF 阅读区域中的 Pointer Event，可能不可避免地需要访问 Reader 内部 document / iframe。

所有这类实现必须集中在：

```
ReaderAdapter
```

模块中。

业务代码不得散落：

```
reader._iframeWindow
querySelector(...)
iframe.contentWindow
```

之类的内部访问。

未来 Zotero 更新导致结构变化时，应当只需要修改 ReaderAdapter。

# 2. 开发前必须完成的源码调查

不要根据网上旧教程直接猜 Zotero Reader DOM。

在真正编写核心代码以前，先调查与 **Zotero 9.0.6** 尽可能接近的源码。

优先检查以下官方项目：

```
zotero/zotero
zotero/reader
zotero/make-it-red
```

重点搜索：

```
Zotero.Reader.registerEventListener
renderToolbar
_iframeWindow
reader
viewer
PDFViewer
iframe
pointerdown
mousedown
annotation
```

需要回答：

1. `renderToolbar` 回调目前提供哪些参数？
2. `reader` 对象如何取得实际 Reader window？
3. PDF Reader 内容位于哪个 document？
4. PDF 页面区域对应哪个 DOM 容器？
5. toolbar 与 viewer 是否处于同一 document？
6. PDF、EPUB、snapshot Reader 如何区分？
7. Reader 切换文件时原 document 是否销毁？
8. tab 关闭时插件应该如何释放 listener？

把调查结果记录到：

```
docs/zotero-reader-investigation.md
```

再开始实现。

如果源码与本文档假设冲突：

> 以 Zotero 9.0.6 实际行为为准。

但不得改变本文规定的用户交互目标。

# 3. 用户场景

用户正在阅读一篇 PDF。

例如看到：

```
The coherent transfer function is equal to the pupil function...
```

用户希望：

```
按住 Alt
+
按住鼠标左键
+
在这句话下面随手划一下
```

屏幕立即出现：

```
The coherent transfer function is equal to the pupil function...
                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

松开鼠标后：

```
墨迹保持短暂时间
↓
逐渐淡出
↓
彻底消失
```

整个过程中 Zotero 不产生任何 Annotation。

# 4. MVP 功能范围

第一版只实现两个工具：

```
Transient Pen
Transient Rectangle
```

分别译为：

```
临时画笔
临时框选
```

暂时不要实现：

- 箭头；
- 文本；
- OCR；
- 真正 PDF 批注；
- 云同步；
- 笔记导出；
- 多人协作；
- AI；
- 截图；
- 手写识别；
- 页级永久绘图。

保持插件足够小。

# 5. 核心交互

## 5.1 默认状态

插件安装后默认：

```
Temporary Ink = Enabled
```

但它不能拦截普通鼠标操作。

所以：

```
普通左键拖动
```

仍然属于 Zotero。

用户仍然可以：

- 选中文字；
- 点击链接；
- 使用 Zotero Annotation；
- 拖动；
- 点击页面。

插件只有在对应 modifier 被按住以后才介入。

# 6. 临时画笔

## 6.1 默认触发方式

Windows / Linux：

```
Alt + Left Mouse Drag
```

行为：

```
Alt 按下
↓
左键按下
↓
开始临时绘制
↓
mousemove / pointermove
↓
实时显示轨迹
↓
左键松开
↓
停止绘制
↓
等待 fadeDelay
↓
开始淡出
↓
删除 Stroke
```

默认参数：

```
线宽：3 px
颜色：#FF4D4F
不透明度：0.85

fadeDelay：300 ms
fadeDuration：500 ms
```

因此从 mouseup 到完全消失约：

```
800 ms
```

# 7. 临时矩形框

默认：

```
Alt + Shift + Left Mouse Drag
```

行为：

```
pointerdown
↓
记录起点
↓
pointermove
↓
实时显示矩形框
↓
pointerup
↓
保持 300 ms
↓
500 ms 淡出
↓
删除
```

默认：

```
border width：2 px
border style：solid
fill：非常低透明度
```

例如：

```
┌─────────────────────────┐
│                         │
│        当前关注区域      │
│                         │
└─────────────────────────┘
```

不要创建 Area Annotation。

# 8. Toolbar 模式

除了 modifier 快捷方式，再增加一个 Toolbar Button。

图标含义：

```
Temporary Ink
```

点击后切换：

```
OFF
↓
PEN
↓
RECTANGLE
↓
OFF
```

或者实现一个主按钮 + dropdown：

```
Temporary Ink
    ├─ Off
    ├─ Pen
    └─ Rectangle
```

如果实现成本明显更高，MVP 使用单按钮循环即可。

# 9. Toolbar 模式的行为

当：

```
mode = PEN
```

时：

```
Left Mouse Drag
```

直接画临时墨迹。

不需要 Alt。

当：

```
mode = RECTANGLE
```

时：

```
Left Mouse Drag
```

直接绘制临时框。

当：

```
mode = OFF
```

时：

普通鼠标行为完全交还 Zotero。

# 10. Modifier 临时调用优先级

即使：

```
mode = OFF
```

也允许：

```
Alt + Drag
```

临时使用 Pen。

以及：

```
Alt + Shift + Drag
```

临时使用 Rectangle。

所以插件有两种使用方式：

### 高频用户

直接打开 Toolbar Pen：

```
拖鼠标
拖鼠标
拖鼠标
```

### 偶尔使用

保持 OFF：

```
Alt + Drag
```

临时调用。

这两个模式必须共存。

# 11. Escape

按：

```
Esc
```

立即：

```
取消当前 Stroke
+
清除所有仍然可见的 transient overlays
```

如果当前没有绘制：

```
Esc
```

不得干扰 Zotero 已经存在的 Escape 行为。

因此：

> 只有当前插件存在 active drawing / visible temporary drawing 时，才消费 Escape。

# 12. Overlay 技术方案

首选：

```
HTMLCanvasElement
```

不要为每个点创建 DOM。

建议结构：

```
Reader
└── PDF viewport
    ├── Zotero content
    └── TemporaryInkCanvas
```

Canvas 特征：

```
position: absolute / fixed;
left: 0;
top: 0;
width: 100%;
height: 100%;
pointer-events: none;
z-index: appropriate;
```

Canvas 本身：

```
pointer-events: none
```

输入监听放在 Reader document / viewer container 上。

# 13. 为什么 Canvas 不直接接收鼠标

Canvas Overlay 只是：

```
视觉输出层
```

而不是：

```
输入层
```

这样可以最大程度避免覆盖：

- Zotero text layer；
- PDF link；
- annotation；
- popup；
- toolbar。

真正输入使用 capture listener：

```
target.addEventListener("pointerdown", handler, true)
target.addEventListener("pointermove", handler, true)
target.addEventListener("pointerup", handler, true)
target.addEventListener("pointercancel", handler, true)
```

但只有确认插件需要接管本次 pointer gesture 时：

```
event.preventDefault()
event.stopPropagation()
```

正常阅读状态绝对不要拦截。

# 14. Pointer Event

优先使用：

```
Pointer Events
```

不要同时维护：

```
mousedown
mousemove
mouseup

+

touchstart
touchmove
touchend
```

第一版重点支持：

```
pointerType === "mouse"
```

但代码架构不要人为阻止 pen。

以后可支持：

```
pointerType === "pen"
```

# 15. Pointer Capture

进入临时绘制状态以后，尽量使用：

```
setPointerCapture(event.pointerId)
```

或者选择 Zotero 9.0.6 Reader 环境中实际可靠的等效方案。

目的：

即使鼠标快速移动：

```
PDF page
→ page margin
→ viewport edge
```

也不要突然丢失 stroke。

结束后释放 capture。

同时正确处理：

```
pointerup
pointercancel
blur
visibility change
reader close
```

任何异常结束都必须：

```
drawing = false
```

不得留下永久“鼠标被插件劫持”的状态。

# 16. Canvas 坐标系统

MVP 的 Stroke 是：

```
viewport transient coordinate
```

不是：

```
PDF page coordinate
```

假设：

```
event.clientX
event.clientY
```

转换到 Canvas local coordinate：

```
x = clientX - canvasRect.left
y = clientY - canvasRect.top
```

# 17. HiDPI

必须正确处理：

```
devicePixelRatio
```

不能只写：

```
canvas.width = clientWidth
canvas.height = clientHeight
```

建议：

```
CSS Width  = viewportWidth
CSS Height = viewportHeight

Backing Width  = viewportWidth  * DPR
Backing Height = viewportHeight * DPR
```

context 再：

```
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
```

或使用等价方案。

在 Windows 125%、150%、200% 缩放下，墨迹都应：

- 清晰；
- 不错位；
- 不变细；
- 不变粗。

# 18. Resize

监听 Reader viewport 尺寸变化。

优先：

```
ResizeObserver
```

尺寸变化后：

```
resize canvas
```

因为墨迹本来是 transient：

> resize 时允许直接清空所有已有墨迹。

不需要重建 Stroke。

# 19. Scroll

当用户滚动 PDF 时：

```
clearAllTemporaryInk()
```

这是刻意设计。

不要尝试让已经画好的临时墨迹：

```
跟随 PDF 页面滚动
```

原因：

墨迹只存在约 800 ms。

为如此短生命周期的视觉反馈维护 PDF 页面坐标没有必要，而且会显著增加：

- zoom；
- rotation；
- spread；
- page gap；
- continuous scroll

的复杂度。

# 20. Zoom

PDF zoom 改变时：

```
清除所有 temporary stroke
resize canvas
```

不需要把旧 stroke 映射到新 zoom。

# 21. Rotation

页面旋转：

```
clear
```

即可。

无需 coordinate transform。

# 22. 多页问题

一条 Stroke 可以跨：

```
PDF page A
↓
page gap
↓
PDF page B
```

因为它本质是 Reader viewport overlay。

这是允许的。

不要限制 Stroke 必须属于某一 PDF 页。

# 23. Viewer UI 排除区域

插件只应该响应：

```
PDF 内容阅读 viewport
```

不能响应：

- toolbar；
- sidebar；
- annotation pane；
- search box；
- popup；
- context menu；
- page thumbnails；
- tags；
- note editor。

ReaderAdapter 必须找到最准确的内容容器。

如果无法稳定找到具体 PDF viewport：

允许在 Reader document 级监听 Pointer Event，

但必须通过：

```
event.target
closest(...)
bounding rect
```

过滤 UI 区域。

# 24. 文本选择冲突

这是非常重要的验收项目。

OFF 模式：

```
普通 Drag
```

必须仍然能正常选择 PDF 文字。

例如：

```
The coherent transfer function...
     [正常拖选文字]
```

不能因为插件安装而失效。

只有：

```
Alt + Drag
```

时才禁止 text selection。

# 25. 原生 Zotero 工具冲突

需要测试 Zotero 原生：

```
Highlight
Underline
Note
Text
Area
Ink
Eraser
Pointer
Hand
```

插件 OFF 状态下不得破坏这些工具。

Toolbar 临时 Pen 开启时允许它优先接管左键。

但退出临时 Pen 后：

```
Zotero 原来的工具状态
```

应尽可能保持原样。

不要通过：

```
切换 Zotero 原生 annotation mode
```

来实现 Temporary Ink。

两者必须是独立系统。

# 26. Alt 键冲突

Windows 下需要实际验证：

```
Alt
```

是否会触发 Zotero 菜单栏或其他 Reader 行为。

如果 Zotero 9.0.6 下：

```
Alt + Left Drag
```

表现稳定：

保留 Alt 默认方案。

如果存在严重冲突：

ReaderAdapter / ShortcutManager 必须允许替换 modifier。

候选：

```
Ctrl + Alt
```

不要擅自硬编码改成 Shift，因为 Shift 在文本选择中有潜在语义。

最终 modifier 要通过 Preference 配置。

# 27. 画笔绘制算法

不要简单用大量：

```
lineTo()
```

直接连接所有 Pointer Event 点导致明显折线。

MVP 至少做简单平滑。

推荐保存：

```
type Point = {
    x: number;
    y: number;
    t: number;
};
```

可以使用：

```
quadratic midpoint smoothing
```

例如：

```
P0
P1
P2
```

通过中点 + quadratic curve 绘制。

不需要复杂：

- Bézier 拟合；
- Kalman filter；
- handwriting recognition。

目标只是鼠标拖动时视觉自然。

# 28. Point Sampling

不要无上限保存 pointermove。

可以：

```
最小距离阈值：约 1 px
```

距离太近的点忽略。

也可以使用：

```
requestAnimationFrame
```

合并频繁绘制。

目标：

普通 60–240 Hz 鼠标操作时保持顺滑。

# 29. 性能目标

测试环境目标：

```
1920×1080
2560×1440
Windows Display Scaling 100%–200%
```

持续快速划动：

```
10 秒
```

主观上不得明显：

- 掉帧；
- 卡 Reader；
- 滚动变慢；
- CPU 突然持续高占用。

插件 idle 时：

```
CPU overhead ≈ 0
```

不要持续 animation loop。

只有存在：

```
drawing
或
fading stroke
```

时才需要 redraw。

# 30. Stroke 生命周期

建议设计：

```
interface Stroke {
    id: number;
    type: "pen" | "rectangle";

    points?: Point[];

    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;

    createdAt: number;
    releasedAt?: number;

    opacity: number;
}
```

状态：

```
DRAWING
↓
HOLDING
↓
FADING
↓
DELETED
```

# 31. 淡出

不要为每个 stroke 创建大量 CSS animation DOM。

Canvas 采用：

```
requestAnimationFrame
```

重绘。

透明度：

```
releasedAt
+
fadeDelay
```

以前：

```
opacity = 1
```

之后：

```
progress =
(now - fadeStart) / fadeDuration
```

最终：

```
opacity = 1 - ease(progress)
```

MVP 使用：

```
linear
```

即可。

如果视觉效果明显生硬，再使用：

```
ease-out
```

# 32. 多 Stroke

允许：

```
第一划
↓
未完全消失
↓
第二划
↓
第三划
```

同时存在。

每个 Stroke：

```
独立生命周期
```

例如：

```
Stroke A ███████▓▒░
Stroke B     ███████▓▒░
Stroke C          ███████▓▒░
```

不要每次新画就清空上一条。

# 33. Rectangle 绘制

Rectangle 不保存大量 points。

保存：

```
startX
startY

currentX
currentY
```

计算：

```
left   = min(startX, currentX)
top    = min(startY, currentY)
width  = abs(currentX - startX)
height = abs(currentY - startY)
```

绘制：

```
strokeRect
```

可增加：

```
fillRect
```

但默认 fill opacity 非常低，例如：

```
0.05–0.08
```

# 34. Cursor

插件正在 Pen 模式：

```
cursor: crosshair
```

或设计一个极小的笔尖 cursor。

MVP 使用：

```
crosshair
```

即可。

Rectangle 同样：

```
crosshair
```

Modifier 临时模式下：

只有 Alt 已按住时才切换 cursor。

松开 Alt 恢复。

不得永久修改 Reader cursor。

# 35. ReaderAdapter

建议接口：

```
interface ReaderAdapter {
    attach(reader: unknown, eventDoc: Document): ReaderContext | null;
}
```

返回：

```
interface ReaderContext {
    reader: unknown;

    window: Window;
    document: Document;

    viewerElement: HTMLElement;
    overlayHost: HTMLElement;

    isPDF: boolean;

    dispose(): void;
}
```

Adapter 负责所有 Zotero-specific knowledge。

# 36. 查找 Reader document 的策略

请根据 Zotero 9.0.6 实际源码决定最终实现。

允许类似以下分层策略：

```
Strategy A
官方 event 提供的 document 即所需 document

↓

Strategy B
reader 暴露 iframe window

↓

Strategy C
通过经过验证的 Reader DOM 找 viewer iframe
```

但是不要直接写：

```
reader._iframeWindow.document.querySelector(".whatever")
```

散落整个项目。

集中：

```
reader-adapter.ts
```

# 37. 不允许 brittle selector 泛滥

如果必须使用 CSS selector：

集中定义：

```
const SELECTORS = {
    ...
};
```

并给每个 selector 写注释：

```
// Verified against Zotero 9.0.6
```

ReaderAdapter attach 失败时：

```
Zotero.debug(...)
```

打印可读错误。

插件应该：

```
fail gracefully
```

而不是导致 Reader 报错。

# 38. PDF 限定

MVP：

```
只支持 PDF
```

对于：

- EPUB；
- snapshot；
- HTML；

不得报错。

直接：

```
return
```

或保持 Toolbar Button disabled。

未来如果结构天然兼容 EPUB，可以再扩展。

# 39. ReaderController

每一个打开的 PDF Reader：

```
一个 ReaderController
```

建议：

```
class ReaderController {
    context;
    canvas;
    renderer;
    inputController;
    state;

    init();
    destroy();

    setMode();
    clear();

    handlePointerDown();
    handlePointerMove();
    handlePointerUp();
}
```

# 40. 多 Reader 支持

用户可能：

```
Tab A → PDF 1
Tab B → PDF 2
```

插件不能只保存：

```
let currentReader
```

建议：

```
WeakMap<ReaderObject, ReaderController>
```

或等价结构。

每个 Reader：

```
独立 Canvas
独立 Stroke
独立 Event Listener
```

# 41. Idempotent Initialization

`renderToolbar` 等事件可能多次触发。

必须保证：

```
同一个 Reader
```

不会反复：

- 创建 Canvas；
- 注册 pointer listener；
- 创建 toolbar button。

例如：

```
if controller already exists
    reuse
```

必要时给 DOM 标记：

```
data-temporary-ink
```

# 42. Cleanup

这是核心要求。

插件：

```
disable
uninstall
reader close
Zotero shutdown
```

时必须清理：

- Canvas；
- Pointer listener；
- Keyboard listener；
- ResizeObserver；
- scroll listener；
- requestAnimationFrame；
- timeout；
- toolbar UI；
- ReaderController reference；
- cursor modification；
- CSS；
- Preferences hooks（如需要）。

不得产生 memory leak。

# 43. bootstrap.js

按照 Zotero 当前 bootstrapped plugin 方式实现生命周期。

至少：

```
startup(...)
shutdown(...)
install(...)
uninstall(...)
```

以及必要的：

```
onMainWindowLoad(...)
onMainWindowUnload(...)
```

Reader event listener 在：

```
startup
```

注册。

在：

```
shutdown
```

完整清理。

# 44. manifest.json

使用适合 Zotero 9 的 manifest。

目标兼容：

```
strict_min_version: 9.0
strict_max_version: 9.0.*
```

因为当前明确测试：

```
Zotero 9.0.6
```

不要宣称：

```
9.1
10
```

兼容，除非实际测试。

插件 metadata 写清楚：

```
name
version
description
author
id
```

初始：

```
version = 0.1.0
```

# 45. Preferences

MVP 需要一个简单 Preference Pane。

可配置：

## General

```
Enable Temporary Ink
```

默认：

```
true
```

## Pen

```
Color
Width
Opacity
```

默认：

```
#FF4D4F
3 px
0.85
```

## Timing

```
Fade delay
Fade duration
```

默认：

```
300 ms
500 ms
```

## Interaction

```
Temporary modifier
```

默认：

```
Alt
```

如果配置 modifier UI 工作量过大：

0.1.0 可以暂时只做 Alt，

但内部代码必须预留：

```
ShortcutConfig
```

不要在 PointerHandler 里到处硬编码：

```
event.altKey
```

# 46. Preference 存储

使用：

```
Zotero.Prefs
```

和 Zotero 插件默认 preference 机制。

不要使用：

```
localStorage
sessionStorage
```

Preference key 统一命名：

```
extensions.temporary-ink.enabled
extensions.temporary-ink.penColor
extensions.temporary-ink.penWidth
extensions.temporary-ink.penOpacity
extensions.temporary-ink.fadeDelay
extensions.temporary-ink.fadeDuration
extensions.temporary-ink.modifier
```

# 47. Localization

至少提供：

```
zh-CN
en-US
```

使用 Fluent。

例如：

```
temporary-ink-toolbar-title
temporary-ink-mode-off
temporary-ink-mode-pen
temporary-ink-mode-rectangle
temporary-ink-pref-enable
temporary-ink-pref-pen-color
temporary-ink-pref-pen-width
temporary-ink-pref-fade-delay
temporary-ink-pref-fade-duration
```

所有 key：

```
temporary-ink-
```

开头，避免污染全局 namespace。

# 48. 推荐项目结构

根据最终工具链可适当调整，但建议：

```
zotero-temporary-ink/
│
├─ manifest.json
├─ bootstrap.js
├─ prefs.js
│
├─ src/
│  ├─ addon.ts
│  │
│  ├─ reader/
│  │  ├─ reader-adapter.ts
│  │  ├─ reader-controller.ts
│  │  └─ reader-registry.ts
│  │
│  ├─ ink/
│  │  ├─ ink-model.ts
│  │  ├─ ink-renderer.ts
│  │  ├─ input-controller.ts
│  │  └─ geometry.ts
│  │
│  ├─ ui/
│  │  ├─ toolbar.ts
│  │  └─ preferences.ts
│  │
│  ├─ config/
│  │  ├─ preferences.ts
│  │  └─ constants.ts
│  │
│  └─ utils/
│     ├─ disposable.ts
│     └─ logger.ts
│
├─ locale/
│  ├─ en-US/
│  │  └─ temporary-ink.ftl
│  └─ zh-CN/
│     └─ temporary-ink.ftl
│
├─ preferences/
│  ├─ preferences.xhtml
│  └─ preferences.css
│
├─ assets/
│  └─ temporary-ink.svg
│
├─ docs/
│  ├─ zotero-reader-investigation.md
│  ├─ architecture.md
│  └─ manual-test.md
│
├─ tests/
│  ├─ geometry.test.ts
│  └─ stroke-lifecycle.test.ts
│
├─ package.json
├─ tsconfig.json
└─ README.md
```

如果采用现有成熟 Zotero 插件模板导致目录不同：

允许调整。

但是：

```
ReaderAdapter
Renderer
InputController
```

的职责必须保持分离。

# 49. Renderer 与 Input 分离

禁止写成一个 1000 行：

```
reader.js
```

输入：

```
InputController
```

负责：

- modifier；
- pointer；
- gesture 状态。

模型：

```
InkModel
```

负责：

- stroke；
- lifecycle；
- timing。

输出：

```
InkRenderer
```

负责：

- Canvas；
- DPR；
- draw；
- fade。

Zotero 适配：

```
ReaderAdapter
```

负责：

- Reader DOM；
- lifecycle；
- viewer 定位。

# 50. Toolbar UI 与 Drawing Engine 解耦

Toolbar 只调用：

```
controller.setMode("off")
controller.setMode("pen")
controller.setMode("rectangle")
```

不要让 Drawing Engine 知道：

```
Zotero toolbar button
```

的 DOM 结构。

# 51. 调试日志

统一：

```
Logger.debug(...)
Logger.warn(...)
Logger.error(...)
```

最终映射：

```
Zotero.debug(...)
```

开发模式可打印：

```
[TemporaryInk] Reader attached
[TemporaryInk] Canvas mounted
[TemporaryInk] Gesture start: pen
[TemporaryInk] Reader destroyed
```

默认不要在每个：

```
pointermove
```

打印日志。

否则严重影响性能。

# 52. 第一阶段：Reader Probe

先不要立刻实现绘画。

首先做最小 Probe：

```
打开 PDF
↓
renderToolbar 回调触发
↓
识别 reader
↓
找到 PDF viewport
↓
向 viewport 插入一个测试 overlay
↓
2 秒后删除
```

测试 overlay：

```
半透明红色边框
```

不要覆盖整页红色背景。

成功条件：

```
PDF 内容区域出现测试边框
toolbar / sidebar 没有被覆盖
```

把这一阶段单独 commit：

```
feat: probe Zotero 9 reader viewport
```

# 53. 第二阶段：Pointer Probe

不要立即做 Stroke。

实现：

```
Alt + pointerdown
Alt + pointermove
pointerup
```

只在 debug log 中打印：

```
start x y
move x y
end x y
```

验证：

```
普通 drag
```

仍然正常选择文字。

只有：

```
Alt + drag
```

被插件捕获。

commit：

```
feat: capture temporary pointer gesture
```

# 54. 第三阶段：Canvas Pen

加入：

```
Canvas
Stroke model
Renderer
```

暂时不要 fade。

做到：

```
Alt + drag
↓
出现红色线
↓
mouseup
↓
保留
```

再验证：

- DPR；
- resize；
- multiple readers。

commit：

```
feat: render transient pen strokes
```

# 55. 第四阶段：Fade

实现：

```
delay
fade
remove
```

确认：

```
mouseup 后约 800 ms 完全消失
```

且：

```
InkModel
```

里已经删除 Stroke 对象。

不能只是 canvas 看不见但数组无限增长。

commit：

```
feat: fade and dispose temporary strokes
```

# 56. 第五阶段：Rectangle

增加：

```
Alt + Shift + Drag
```

commit：

```
feat: add temporary rectangle tool
```

# 57. 第六阶段：Toolbar

使用当前 Zotero Reader 支持的扩展方式加入 toolbar control。

优先使用：

```
renderToolbar
```

提供的 append / DOM injection 能力。

不要找到 Zotero toolbar DOM 后用非常脆弱的：

```
children[7]
```

之类操作。

实现：

```
OFF
PEN
RECTANGLE
```

commit：

```
feat: add reader toolbar controls
```

# 58. 第七阶段：Preferences

增加：

```
颜色
宽度
opacity
fade delay
fade duration
```

commit：

```
feat: add temporary ink preferences
```

# 59. 第八阶段：Cleanup Hardening

重点故意测试：

```
打开 PDF
关闭 PDF

打开 PDF
切 Tab

打开两个 PDF
关闭其中一个

Disable plugin
Enable plugin

关闭 Zotero
重新启动
```

检查：

- console error；
- duplicate listener；
- duplicate canvas；
- memory leak；
- cursor stuck；
- pointer capture stuck。

commit：

```
fix: harden reader lifecycle cleanup
```

# 60. 手动验收测试

建立：

```
docs/manual-test.md
```

至少包含以下测试。

## Test 01：普通文字选择

条件：

```
Temporary Ink OFF
```

操作：

```
普通 Left Drag 选择 PDF 文字
```

结果：

```
PASS：Zotero 正常选择文字
```

## Test 02：临时 Pen

```
Alt + Left Drag
```

预期：

```
实时显示轨迹
mouseup 后短暂保持
随后淡出
不产生 annotation
```

## Test 03：Rectangle

```
Alt + Shift + Left Drag
```

预期：

```
实时 Rectangle
mouseup 后淡出
```

## Test 04：多 Stroke

连续画：

```
A
B
C
```

预期：

```
同时短暂显示
分别独立 fade
```

## Test 05：快速鼠标

非常快速：

```
左右来回拖动
```

预期：

```
不中断
不出现明显巨大折线
```

## Test 06：移出页面

开始：

```
Alt + Drag
```

然后指针移出 PDF 页面区域再松开。

预期：

```
gesture 能结束
不进入 stuck state
```

## Test 07：Esc

画完之后立即：

```
Esc
```

预期：

```
全部墨迹立即清除
```

## Test 08：Scroll

墨迹尚未消失时滚轮。

预期：

```
立即 clear
PDF 正常滚动
```

## Test 09：Zoom

墨迹存在时改变 zoom。

预期：

```
clear
canvas resize
无错位残影
```

## Test 10：Windows Scaling

分别测试：

```
100%
125%
150%
200%
```

预期：

```
鼠标位置和墨迹位置一致
线条清晰
```

## Test 11：多个 Reader

打开：

```
PDF A
PDF B
```

分别绘制。

预期：

```
互不干扰
```

## Test 12：关闭 Reader

墨迹正在 fade 时关闭 PDF。

预期：

```
无异常
无残留 timer
无 console error
```

## Test 13：禁用插件

打开 PDF 后在 Add-ons 中 Disable Temporary Ink。

预期：

```
Canvas 消失
listener 被移除
PDF 无需重启 Zotero 即恢复正常
```

## Test 14：重新启用

Enable。

预期：

```
不重启即可重新工作
不创建两个 Canvas
```

## Test 15：Zotero Annotation

分别测试 Zotero 自带：

```
Highlight
Underline
Area
Ink
Eraser
Hand
```

插件 OFF：

```
全部正常
```

# 61. Annotation 零污染验证

开发结束必须专门验证：

使用 Temporary Ink：

```
画 100 次
```

之后检查：

```
左侧 Annotation 数量
```

前后完全一致。

关闭 PDF 再打开：

```
Temporary Ink 全部消失
```

同步状态：

```
不因为 Temporary Ink 发生任何 annotation sync
```

# 62. DOM 零残留验证

打开关闭同一个 PDF：

```
20 次
```

确认不存在：

```
20 个 overlay
20 个 toolbar button
20 套 listener
```

DOM 中同一 Reader 最多：

```
1 个 Temporary Ink Canvas
1 套 Temporary Ink controls
```

# 63. Memory Leak 基本测试

重复：

```
打开 PDF
绘制
关闭 PDF
```

至少：

```
20 次
```

观察：

```
ReaderController registry
```

不应不断增长。

如果使用：

```
WeakMap
```

确保除此之外没有其他 strong reference 阻止 GC。

# 64. 错误处理

如果 ReaderAdapter 识别失败：

不得：

```
throw → Zotero Reader broken
```

而应该：

```
log warning
disable Temporary Ink for that reader
```

例如：

```
[TemporaryInk] Unable to locate PDF viewer in Zotero 9.0.6
```

其他 Zotero 功能继续工作。

# 65. 安全边界

绝对不要：

```
修改 Zotero 安装目录核心文件
patch zotero.jar
修改官方 reader source
覆盖 Zotero 自带 CSS 文件
修改 zotero.sqlite
修改 PDF
```

整个功能必须通过：

```
普通 Zotero Plugin
```

实现。

最终输出：

```
.xpi
```

用户通过 Zotero Add-ons 安装。

# 66. Build

提供：

```
npm install
npm run build
npm run package
```

最终：

```
dist/zotero-temporary-ink-0.1.0.xpi
```

如果所选 Zotero plugin template 已有标准：

```
build
release
```

命令，可以遵循模板，但 README 必须明确。

# 67. Development Install

README 给出：

### 方案 A

直接构建：

```
.xpi
```

然后：

```
Zotero
→ Tools
→ Add-ons
→ Install Add-on From File
```

### 方案 B

开发时使用 extension proxy。

说明如何：

```
从 source directory 加载插件
```

不要要求每改一次代码就重新手动打包 XPI。

# 68. 开发环境

主要目标：

```
OS: Windows 11
Zotero: 9.0.6
```

开发时充分利用：

```
Zotero.debug
JS console
Mozilla/Zotero developer tools（如果当前构建可用）
```

需要检查 DOM 时：

优先实际 Inspect。

不要根据截图猜 selector。

# 69. Git

初始化 Git repository。

使用小 commit。

推荐：

```
chore: initialize Zotero plugin project

docs: document Zotero 9 reader architecture

feat: probe Zotero reader viewport

feat: capture temporary pointer gestures

feat: render temporary pen strokes

feat: fade temporary strokes

feat: add temporary rectangle

feat: add reader toolbar control

feat: add preferences

fix: harden lifecycle cleanup

docs: add installation and test guide
```

不要等所有功能完成后一个：

```
initial commit
```

塞全部代码。

# 70. README

最终 README 至少包含：

```
What is Temporary Ink?
Features
Screenshots
Installation
Usage
Shortcuts
Preferences
Supported Zotero versions
Development
Build
Known limitations
```

明确：

```
Temporary Ink does not create Zotero annotations.
```

# 71. Known Limitations 第一版可以接受

0.1.0 可以接受：

```
只支持 PDF
只重点支持 Mouse
墨迹滚动时立即消失
墨迹 resize 时立即消失
墨迹 zoom 时立即消失
不跟随 PDF 页坐标
```

这些不是 bug。

它们属于设计选择。

# 72. MVP 不要过度工程化

以下内容先不要做：

```
GPU WebGL renderer
OffscreenCanvas Worker
PDF coordinate transform
stroke persistence
pressure curve editor
custom SVG editor
advanced gesture recognizer
theme marketplace
cloud sync
```

核心代码应尽量：

```
小
清晰
易维护
```

# 73. 可选 v0.2 功能

MVP 稳定以后才能考虑。

## 73.1 Laser Pointer

增加：

```
Laser
```

它不是整条 stroke 一起 fade，而是：

```
鼠标当前位置亮
尾迹不断消失
```

例如：

```
──────────────▓▒░
              ●
```

生命周期基于：

```
每一个 path segment 的 age
```

效果类似 PPT 激光笔。

# 74. Laser Trail 推荐参数

未来：

```
trail lifetime: 400–800 ms
head radius: 4–6 px
tail width: 2–4 px
```

但 v0.1 不实现。

# 75. 可选 v0.2：Circle / Ellipse

```
Alt + Ctrl + Drag
```

画 ellipse。

不要放入 MVP。

# 76. 可选 v0.2：Hold-to-focus

允许：

```
按住某 modifier
```

期间临时 Pen 激活。

modifier 松开：

```
即使鼠标尚未松开
```

也结束当前 gesture。

需要实际使用反馈后再决定。

# 77. 可选 v0.2：Stylus

若：

```
pointerType === "pen"
```

可让笔直接使用 Temporary Ink。

例如：

```
Pen hover / barrel button
```

但要避免破坏 Zotero 原生 Ink Annotation。

# 78. 可选 v0.2：Pressure

支持：

```
event.pressure
```

映射线宽。

例如：

```
width =
baseWidth *
(0.5 + pressure)
```

Mouse 不使用。

# 79. 可选 v0.2：快捷清屏

可以增加：

```
Alt + Esc
```

清除 Temporary Ink。

但因为当前墨迹寿命很短，优先级低。

# 80. 最重要的架构边界

请始终记住：

```
Zotero
        │
        │ Reader lifecycle
        ▼
┌────────────────────┐
│    ReaderAdapter   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  ReaderController  │
└──────┬───────┬─────┘
       │       │
       ▼       ▼
 Input       InkModel
Controller      │
                ▼
           InkRenderer
                │
                ▼
              Canvas
```

Zotero 内部结构变化：

```
只影响 ReaderAdapter
```

Canvas 绘制算法变化：

```
只影响 InkRenderer
```

快捷键变化：

```
只影响 InputController / config
```

Toolbar 变化：

```
只影响 UI
```

不要让这些职责互相污染。

# 81. 最终验收标准

插件只有在满足以下条件时才能称为：

```
v0.1.0
```

### A

Zotero 9.0.6 能正常安装。

### B

打开 PDF 不报错。

### C

普通鼠标选择 PDF 文字不受影响。

### D

```
Alt + Left Drag
```

产生实时临时画笔。

### E

```
Alt + Shift + Left Drag
```

产生实时临时矩形。

### F

mouseup 后：

```
约 800 ms
```

自动完全消失。

### G

整个过程：

```
0 个 Zotero Annotation
```

### H

滚动 / zoom / resize：

```
不会产生位置错误的残影。
```

### I

关闭 Reader：

```
全部资源释放。
```

### J

Disable 插件：

```
无需重启 Zotero
```

Reader 恢复原状。

### K

Windows：

```
100%
125%
150%
200%
```

显示缩放下坐标正确。

### L

两个 PDF Reader 同时打开：

```
互不干扰。
```

### M

能够生成：

```
.xpi
```

并通过：

```
Install Add-on From File
```

安装。

# 82. 如果实现遇到 Reader API 问题

不要立即使用更暴力的 hack。

依次：

```
1. 检查 Zotero 9.0.6 zotero source

2. 检查 zotero/reader source

3. 检查官方 sample plugin

4. 检查 Zotero.Reader event implementation

5. Inspect 实际运行 DOM

6. 在 ReaderAdapter 中实现最小 fallback

7. 写下为什么必须依赖该 internal API
```

把所有这种兼容性决定记录：

```
docs/zotero-reader-investigation.md
```

例如：

```
## Viewer document access

Zotero version:
9.0.6

Method:
...

Public API:
No suitable public method was found.

Internal dependency:
...

Reason:
...

Fallback:
...

Risk:
medium
```

# 83. 不要为了“看起来完成”而伪造实现

如果某一步无法确定：

例如：

```
不知道 Zotero 9.0.6 Viewer DOM
```

不要编造：

```
#viewerContainer
.pdfViewer
```

然后声称完成。

应该：

```
检查源码
+
检查运行时 DOM
```

得到证据以后再实现。

# 84. Codex 工作方式

从现在开始按以下顺序执行：

```
STEP 1
检查当前目录。

STEP 2
初始化 Git repository（如果尚未初始化）。

STEP 3
研究 Zotero 9.0.6 Plugin + Reader 架构。

STEP 4
创建：
docs/zotero-reader-investigation.md

STEP 5
给出基于实际源码确认后的实现方案。

STEP 6
开始 Reader Probe。

STEP 7
逐阶段实现。

STEP 8
每阶段运行可执行的检查。

STEP 9
持续更新 manual-test.md。

STEP 10
构建最终 .xpi。

STEP 11
检查 git diff / git status。

STEP 12
输出最终报告。
```

除非确实遇到必须由用户决定的产品行为，否则：

> 不要频繁停下来询问用户确认。

对于实现细节：

> 自行调查、自行选择最稳健方案并继续执行。

# 85. 最终报告格式

完成开发后输出：

```
## 完成情况

## 项目结构

## 实际采用的 Zotero Reader 接入方案

## 是否使用内部 Zotero API
- 是 / 否
- 如果是，具体是什么
- 为什么无法避免
- 潜在兼容性风险

## 功能
- Pen
- Rectangle
- Fade
- Toolbar
- Preferences

## 测试结果

## 未完成项目

## Known Issues

## 构建方法

## XPI 输出路径

## Git 状态

## 下一步建议
```

最后特别回答：

```
1. Zotero 9.0.6 是否已经实际验证？
2. 普通 PDF 文本选择是否受影响？
3. 是否产生任何 Zotero annotation？
4. 是否修改 PDF？
5. 是否依赖 reader._iframeWindow 或其他内部 API？
6. 插件 Disable 后是否可以完整清理？
```

# 86. 产品本质

开发过程中不要把这个项目逐渐做成一个：

```
Annotation Enhancement Plugin
```

它不是。

它的产品定义始终只有一句话：

> 在 Zotero 阅读 PDF 时，让用户能够像拿着笔在纸上指指画画一样获得即时视觉反馈，但不给文档留下任何痕迹。

首要评价标准不是功能数量，而是：

```
即时
自然
顺滑
零污染
不妨碍阅读
```

如果一个功能使插件变复杂，却不能明显改善以上五点：

> 不要加入 MVP。