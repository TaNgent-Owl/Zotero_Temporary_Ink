# Zotero Temporary Ink

[English](README.md) | **简体中文**

Temporary Ink 解决的是一个很小但常见的问题：读 PDF 时，有时只想临时圈一下、划一笔，并不想留下正式批注。用完以后，墨迹会自己消失。

插件不会把这些墨迹写进 Zotero 或 PDF，也不会修改附件或产生同步记录。

## 安装

1. 从[最新发布页面](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest)下载 `zotero-temporary-ink-0.1.10.xpi`。
2. 在 Zotero 中打开 **工具 → 附加组件**。
3. 点击右上角的齿轮，选择 **从文件安装附加组件**，然后选中下载好的 XPI。
4. 如果 Zotero 提示重启，按提示操作即可。

当前版本支持 Zotero 9.0–9.0.x，已在 Zotero 9.0.6 上测试。需要回退时，可以安装上一个稳定版本 v0.1.9。

## 怎么画

- 按住 `Ctrl`，再用鼠标左键拖动：画笔。
- 按住 `Ctrl+Shift`，再用鼠标左键拖动：矩形框。
- 点击阅读器工具栏上的按钮，可以在“关闭、画笔、框选”之间切换。切到画笔或框选后，直接按住左键拖动即可连续绘制。
- 按 `Esc` 会清除当前墨迹。没有墨迹时，插件不会拦截 `Esc`。

连续画出的几笔会被当作同一张草图。开始下一笔时，只要之前的墨迹还没有完全消失，它们就会恢复为完整显示，淡出计时也会暂停。最后一笔画完后，整组墨迹停留 300 ms，再用 500 ms 淡出。

需要正常选择 PDF 文字时，把工具栏模式留在“关闭”即可。插件不占用 `Alt` 和 `Ctrl+Alt`。

## 设置

打开 **Zotero 设置 → 临时墨迹**，可以调整画笔颜色、宽度、不透明度、停留时间和淡出时间，也可以在这里关闭插件。

设置由 `Zotero.Prefs` 保存，键名位于 `extensions.temporary-ink.*` 下。插件不使用浏览器本地存储。

## 截图

目前还没有运行截图。墨迹消失得很快，一张有用的截图需要同时拍到指针和正在绘制的笔画。完成剩余的人工检查后，会补一张经过 Zotero 9.0.6 验证的截图。

## 目前的不足

最明显的问题是文字选择。绘制临时画笔或矩形时，Zotero/PDF.js 仍可能顺手选中指针经过的 PDF 内嵌文字。我们试过拦截这类选择，但同一套拦截会让墨迹无法显示，甚至曾导致一个测试 PDF 打不开。因此 v0.1.10 暂时保留 Zotero 原来的文字选择行为。被选中的只是文字，不会生成批注，也不会修改 PDF。

其他限制比较简单：

- 目前只支持 PDF，经过测试的是鼠标操作。
- Zotero 分屏阅读时只处理主视图。
- 墨迹使用阅读器视口坐标，不是 PDF 页面坐标。
- 滚动、缩放、旋转或调整窗口大小会清除当前墨迹。
- 批注数量、Windows 缩放比例、多阅读器并行和反复开关插件的压力测试还没有全部完成。

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

`npm run package` 会把 XPI 写入 `dist/`。`npm run dev` 会监听 TypeScript 源码，并把未打包插件重新构建到 `build/`。

在 Windows 上使用扩展代理：

1. 在 Zotero 中打开 **帮助 → 故障排除信息 → 配置文件夹**。
2. 进入该配置目录的 `extensions` 文件夹，新建一个名为 `temporary-ink@local` 的纯文本文件，不要加扩展名。
3. 文件里只写一行：本仓库 `build` 目录的绝对路径，例如 `D:\PPs\Zotero_Temporary_Ink[plugin]\build`。
4. 运行 `npm run dev`，然后重启一次 Zotero。以后重新构建后，只需禁用再启用插件；如果改动涉及阅读器生命周期，请重新打开 PDF 标签页。

删除这个代理文件即可卸载开发版本。Zotero Reader 私有接口的调查记录在 [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md)，相关代码只能放在 `src/reader/reader-adapter.ts`。

## 已完成的验证

v0.1.10 已在 Zotero 9.0.6 中完成安装和绘制测试。工具栏模式、`Ctrl` 快捷键以及多笔画统一淡出都经过用户确认。TypeScript 类型检查、30 项自动化测试、构建和安装包校验也已通过。
