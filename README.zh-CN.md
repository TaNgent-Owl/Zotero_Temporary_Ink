# Zotero Temporary Ink

[English](README.md) | **简体中文**

Temporary Ink 为 Zotero PDF 阅读器提供短暂显示的画笔和矩形覆盖层，适合阅读时指示、划线、圈选和框选内容。**本插件不会创建 Zotero 批注，不会修改 PDF 或附件，也不会参与同步。**

## 功能

- `Ctrl` + 鼠标左键拖动：临时画笔
- `Ctrl+Shift` + 鼠标左键拖动：临时矩形
- 工具栏按钮循环切换：关闭 → 画笔 → 框选 → 关闭
- 绘制新笔画时，已有可见笔画保持完整显示；最后一笔结束后，整组笔画统一停留 300 ms，再淡出 500 ms
- `Esc` 清除可见墨迹；滚动、缩放、旋转或调整窗口大小时清除位置可能失效的墨迹
- 支持 HiDPI 画布缩放，每个 PDF 阅读器独立管理
- 提供英文和简体中文偏好设置界面

## 截图

墨迹会在最后一笔结束约 800 ms 后完全消失。完成全部人工测试后，将补充 Zotero 9.0.6 的运行截图。

## 安装

1. 从 [v0.1.10 发布页面](https://github.com/TaNgent-Owl/Zotero_Temporary_Ink/releases/tag/v0.1.10) 下载 `zotero-temporary-ink-0.1.10.xpi`。
2. 在 Zotero 中打开 **工具 → 附加组件**。
3. 点击右上角齿轮按钮，选择 **从文件安装附加组件**，然后选择下载的 XPI。
4. 如果 Zotero 提示重启，请按提示操作。

插件支持 Zotero 9.0–9.0.x，并已在 Zotero 9.0.6 上验证。`v0.1.9` 是前一个稳定回退版本；`v0.1.10` 将多笔画改为最后一笔结束后统一淡出。

## 使用方法与快捷键

工具栏模式为“关闭”时，普通拖动仍用于选择 PDF 文字；需要临时绘制时按住 `Ctrl`。切换到“画笔”或“矩形”模式后，可以直接使用鼠标左键连续绘制。关闭模式下，`Ctrl` 强制使用画笔，`Ctrl+Shift` 强制使用矩形。

只有存在活动或可见墨迹时，插件才会接管 `Esc`。`Alt` 和 `Ctrl+Alt` 不会被插件占用，以避免与 Zotero 或 Windows 冲突。

## 偏好设置

在 **Zotero 设置 → 临时墨迹** 中可以配置：

- 启用或禁用插件
- 画笔颜色、宽度和不透明度
- 淡出前停留时间
- 淡出持续时间

设置通过 `Zotero.Prefs` 保存在 `extensions.temporary-ink.*` 下，不使用 `localStorage` 或 `sessionStorage`。

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

`npm run package` 会生成 `dist/zotero-temporary-ink-0.1.10.xpi`。`npm run dev` 会在源代码变化时重新构建。

Windows 开发扩展代理：

1. 在 Zotero 的 **帮助 → 故障排除信息 → 配置文件夹** 中打开当前配置目录。
2. 在其 `extensions` 目录下创建无扩展名的纯文本文件 `temporary-ink@local`。
3. 文件中只写入本仓库 `build` 目录的绝对路径，例如 `D:\PPs\Zotero_Temporary_Ink[plugin]\build`。
4. 运行 `npm run dev`，首次加载代理时重启 Zotero。修改插件后可禁用并重新启用插件，并在测试阅读器生命周期代码时重新打开 PDF 标签页。

删除该代理文件即可卸载开发版本。Zotero Reader 的私有接口依赖及固定版本证据记录在 [`docs/zotero-reader-investigation.md`](docs/zotero-reader-investigation.md)；相关访问必须集中在 `src/reader/reader-adapter.ts`。

## 已知限制

- 仅支持 PDF，当前版本以鼠标操作为主
- Zotero 分屏阅读时仅支持主视图
- 墨迹使用视口坐标，不是 PDF 页面坐标
- 绘制临时画笔或矩形时，手势经过的 PDF 内嵌文字仍可能同时被选中。此前抑制文字选择的实验会造成墨迹不显示或部分 PDF 无法打开，因此 v0.1.10 为保证稳定性保留 Zotero/PDF.js 原有的选择行为；这种文字选中不会创建批注，也不会修改 PDF。
- 滚动、缩放、旋转和调整窗口大小会主动清除墨迹
- 类型检查、30 项自动化测试、XPI 构建和安装包校验均已通过
- Zotero 9.0.6 实测确认：v0.1.10 可以安装，工具栏模式可以切换，画笔和矩形可通过工具栏及 Ctrl 快捷键使用，多笔画会统一淡出
- 注释数量、不同 Windows 缩放比例、多阅读器和反复开关插件的压力测试仍待完整验证
