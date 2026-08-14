# Zotero Temporary Ink

[English](README.md) | **简体中文**

Temporary Ink 为 Zotero 9 的 PDF 阅读器加了一层临时墨迹：画一条线、圈一个词或者框住一段话，笔迹会在画完之后很快自动淡出。它面向的场景很明确——只想在 PDF 里指一下，而不想留下任何正式批注。

插件不会向 Zotero 或 PDF 写回任何内容：不创建批注、不修改附件、不产生同步记录。

## 安装

1. 从[最新发布页面](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest)下载 `zotero-temporary-ink-0.2.0.xpi`。
2. 在 Zotero 中打开 **工具 → 附加组件**。
3. 点击右上角的齿轮，选择 **从文件安装附加组件**，然后选中下载好的 XPI。
4. 如果 Zotero 提示重启，按提示操作即可。

当前版本面向 Zotero 9.0–9.0.x，已在 9.0.6 上验证。需要回退时，可以安装上一个稳定版本 v0.1.13。

## 怎么画

- 按住 `Ctrl` 再用鼠标左键拖动：画笔。
- 按住 `Ctrl+Shift` 拖动：框选。
- 点击阅读器工具栏按钮，可以在“关闭、画笔、框选”之间循环切换。切到画笔或框选后，直接按住左键拖动即可连续绘制。
- 按 `Esc` 清除当前墨迹；没有墨迹时，插件不会拦截 `Esc`。
- 工具栏图标会随当前模式变化（关闭 / 画笔 / 框选），悬停 tooltip 显示当前模式。
- 长按工具栏按钮打开快捷调色板：六个预设颜色，点一下立即切换画笔颜色。调色板会高亮当前颜色，按 `Esc` 或点击空白处关闭，只写插件自身偏好，不写任何 Zotero 数据。
- 数字键 `1`–`6` 在六个预设颜色间切换，`[` / `]` 每按一次将线宽减小 / 增大 1 px（1–20）。两者都只在没有按住修饰键、焦点不在输入框时生效，不影响 Zotero 原有按键。
- 在“关闭”模式下按住绘制修饰键，或在画笔 / 框选模式下开始拖动时，阅读器角落会出现一个小徽标，显示当前工具、颜色点和线宽；松键或约 1 秒后自动消失，且不拦截任何输入。

画得比较近的几笔会被归为同一张草图。开始下一笔时，只要之前的墨迹还没完全消失，就会恢复为完整显示，并暂停淡出计时。最后一笔画完后，整张草图停留 300 ms，再在 500 ms 内淡出。

需要 Zotero 正常的文字选择行为时，把工具栏模式留在“关闭”。画笔和框选快捷键默认是 `Ctrl` 和 `Ctrl+Shift`，可以在偏好面板中改为 `Alt` 或 `Ctrl+Alt`。

## 设置

打开 **Zotero 设置 → 临时墨迹**，可以调整画笔颜色、宽度、不透明度、停留时间和淡出时长，也可以在这里彻底关闭插件。

设置通过 `Zotero.Prefs` 保存在 `extensions.temporary-ink.*` 下，插件不使用浏览器本地存储。

## 目前的不足

绘制时指针下方的 PDF 文字选中已大幅抑制。插件把指针捕获推迟到兼容性 `mousedown` 派发决策之后，让 `preventDefault()` 能抑制该事件；手势期间还会用局部 `user-select: none` 样式表、取消 `selectstart`、并在 `selectionchange` 时清除程序化选择作为兜底，手势一结束就立刻恢复。个别情况下仍可能出现少量残留选择，但它无害——不会生成批注，也不会修改 PDF。需要 Zotero 正常的文字选择行为时，把工具栏模式留在“关闭”。整个过程不拦截鼠标事件，因此不会影响墨迹渲染，也不会影响 PDF 打开。

其他限制：

- 只支持 PDF；经过完整测试的是鼠标输入。
- Zotero 分屏阅读时只处理主视图。
- 墨迹使用阅读器视口坐标，而非 PDF 页面坐标。
- 滚动、缩放、旋转或调整窗口大小会清除当前墨迹。
- 批注数量、Windows 缩放、多个阅读器并行、反复开关插件等压力测试还没有全部完成。

## 开发与构建

需要 Node.js 22.13 或更高版本。

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package
npm run verify:package
```

`npm run package` 会把 XPI 写入 `dist/`。`npm run dev` 监听 TypeScript 源码，并把未打包插件重新构建到 `build/`。

在 Windows 上使用扩展代理：

1. 在 Zotero 中打开 **帮助 → 故障排除信息 → 配置文件夹**。
2. 进入配置目录的 `extensions` 文件夹，新建一个名为 `temporary-ink@local` 的纯文本文件，不要加扩展名。
3. 文件里只写一行：本仓库 `build` 目录的绝对路径，例如 `D:\PPs\Zotero_Temporary_Ink[plugin]\build`。
4. 运行 `npm run dev`，然后重启一次 Zotero。之后再重新构建，只需禁用再启用插件；如果改动涉及阅读器生命周期，请重新打开 PDF 标签页。

删除这个代理文件即可卸载开发版本。用到的 Zotero Reader 私有接口记录在 [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md)，相关代码只能放在 `src/reader/reader-adapter.ts`。功能规划见 [`docs/roadmap.md`](docs/roadmap.md)。

## 验证状态

v0.2.0 新增了随模式变化的工具栏图标、快捷调色板（长按或数字键 `1`–`6`）、`[` / `]` 线宽调节和角落提示徽标，用法见上文。v0.1.13 的 XPI 已在 Zotero 9.0.6 中完成安装和绘制测试，工具栏模式、`Ctrl` 快捷键以及多笔画统一淡出都经过用户确认。TypeScript 类型检查和全部 80 项自动化测试通过；v0.2 的手动检查见 `docs/manual-test.md` 第 24–32 项。
