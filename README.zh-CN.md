# Zotero Temporary Ink

[English](README.md) | **简体中文**

Temporary Ink 为 Zotero 9 的 PDF 阅读器加了一层临时墨迹：画一条线、圈一个词或者框住一段话，笔迹会在画完之后很快自动淡出。它面向的场景很明确——只想在 PDF 里指一下，而不想留下任何正式批注。

插件不会向 Zotero 或 PDF 写回任何内容：不创建批注、不修改附件、不产生同步记录。

## 安装

1. 从[最新发布页面](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/latest)下载 `zotero-temporary-ink-0.1.10.xpi`。
2. 在 Zotero 中打开 **工具 → 附加组件**。
3. 点击右上角的齿轮，选择 **从文件安装附加组件**，然后选中下载好的 XPI。
4. 如果 Zotero 提示重启，按提示操作即可。

当前版本面向 Zotero 9.0–9.0.x，已在 9.0.6 上验证。需要回退时，可以安装上一个稳定版本 v0.1.9。

## 怎么画

- 按住 `Ctrl` 再用鼠标左键拖动：画笔。
- 按住 `Ctrl+Shift` 拖动：矩形框。
- 点击阅读器工具栏按钮，可以在“关闭、画笔、框选”之间循环切换。切到画笔或框选后，直接按住左键拖动即可连续绘制。
- 按 `Esc` 清除当前墨迹；没有墨迹时，插件不会拦截 `Esc`。

画得比较近的几笔会被归为同一张草图。开始下一笔时，只要之前的墨迹还没完全消失，就会恢复为完整显示，并暂停淡出计时。最后一笔画完后，整张草图停留 300 ms，再在 500 ms 内淡出。

需要 Zotero 正常的文字选择行为时，把工具栏模式留在“关闭”。插件不占用 `Alt` 和 `Ctrl+Alt`。

## 设置

打开 **Zotero 设置 → 临时墨迹**，可以调整画笔颜色、宽度、不透明度、停留时间和淡出时长，也可以在这里彻底关闭插件。

设置通过 `Zotero.Prefs` 保存在 `extensions.temporary-ink.*` 下，插件不使用浏览器本地存储。

## 目前的不足

最明显的问题是文字选择：绘制时，Zotero/PDF.js 仍可能顺手选中指针经过的 PDF 内嵌文字。我们试过拦截这类选择，但同一套拦截会让墨迹无法渲染，甚至有一次导致测试 PDF 打不开。因此 v0.1.10 保留 Zotero 原有的选择行为。被选中的只是文字，不会生成批注，也不会修改 PDF。

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

删除这个代理文件即可卸载开发版本。用到的 Zotero Reader 私有接口记录在 [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md)，相关代码只能放在 `src/reader/reader-adapter.ts`。

## 验证状态

v0.1.10 的 XPI 已在 Zotero 9.0.6 中完成安装和绘制测试。工具栏模式、`Ctrl` 快捷键以及多笔画统一淡出都经过用户确认。TypeScript 类型检查、全部 30 项自动化测试、构建和安装包校验也已通过。
