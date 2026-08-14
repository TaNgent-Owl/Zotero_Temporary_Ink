# Zotero Temporary Ink (v0.1.13) 代码审计报告

> 审计日期：2026-08-14
> 审计对象：工作区 `master` @ `78dc395`（含未提交的 selection-block 修复批次）
> 文件命名约定：`docs/audit-<版本号>.md`，每次版本审计后新增一份，便于其他 session 检索。
> 审计方式：只读，未修改任何源文件。

---

## 1. 执行摘要

**审计范围**：`src/` 全部 16 个 TypeScript 源文件（约 66 KB）、`bootstrap.js`、`prefs.js`、`manifest.json`、`scripts/`（build/package/verify）、`preferences/`、`locale/`、全部 11 个测试文件（48 用例）、`docs/` 与 `DevDoc.md`。依赖（devDependencies）与构建产物（`build/`、`dist/`）不纳入源码审计，但打包链路做了实机验证。

**方法**：逐文件人工精读 + 类型系统验证（`tsc --noEmit`）+ 全量测试（Vitest 48 用例）+ 构建与 XPI 校验 + 针对 `any`/`@ts-ignore`/`eval`/`innerHTML`/泄漏模式的定向 grep。所有结论均来自实际阅读的代码并附 `file:line` 证据。

**发现统计**：

| 严重级 | 数量 |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| Info | 8 |

**总体结论**：这是一份质量明显高于同类 v0.1 早期插件代码的代码库。类型纪律严格（`src/` 零 `any`、零 `@ts-ignore`/`@ts-expect-error`、零 `eval`/`innerHTML`/全局存储），资源清理有体系化的 `DisposableStore`/`DisposableSlot` 支撑且 `destroy()` 全程幂等，私有 API 全部隔离在 `ReaderAdapter`，并且每一处对 Zotero 9.0.6 内部结构的依赖都有 pinned commit 级别的源码调查背书（`docs/zotero-reader-investigation.md`）。48 个自动化测试全部通过，覆盖了指针捕获延迟、文本选择抑制、Reader 关闭竞态、偏好面板 XHTML 解析镜像等高风险区域。未发现数据安全、注入、原型污染、内存泄漏（结构性）或未处理 Promise rejection 问题。核心风险集中在启动路径的异常隔离与少量性能/工程卫生事项，均可低成本修复。

---

## 2. 发现清单

### Medium

#### M1. `startup()` 缺少失败隔离：任一处异常会使整个插件被 Zotero 禁用（已确认）

**证据**：`src/addon.ts:33` 与 `src/addon.ts:43-48`：

```ts
this.preferencePaneID = await registerPreferencePane(rootURI);   // 无 try/catch
...
await Promise.all(this.adapter.getOpenReaders().map(async (reader) => {
  const controller = await this.registry.ensure(reader);
  ...
  const event = this.adapter.createExistingToolbarEvent(reader);
  if (event) this.handleRenderToolbar(event);
}));
```

`bootstrap.js:10-11` 直接透传：

```js
temporaryInkAddon = TemporaryInk.createAddon();
await temporaryInkAddon.startup(rootURI);
```

**影响**：`registerPreferencePane`（Zotero 对 XHTML 面板解析失败或资源缺失时可能 reject）、`createExistingToolbarEvent`（对异常 document 执行 `querySelector` 时可能抛出）以及 `handleRenderToolbar` 内部的任何同步异常，都会让 `startup()` 的 Promise reject。`bootstrap.js` 没有捕获，rejection 传导到 Zotero 的 bootstrap loader，结果是**插件启动失败被禁用**，而不是项目目标中反复强调的 "fail without breaking the Reader / fail gracefully"。虽然 `Registry.ensure` 内部有捕获、面板有回归测试，单点概率低，但启动期是"所有假设同时成立"的路径，失败后果是插件整体不可用。

**触发条件**：未来 Zotero 9.x 微调面板 API、`_readers` 数组中出现半销毁的 reader 对象、或 `preferences.xhtml` 打包损坏时。

**修复建议**（最小改动）：

```ts
// addon.ts
try {
  this.preferencePaneID = await registerPreferencePane(rootURI);
}
catch (error) {
  Logger.error(error);          // 面板失败不应杀死整个插件
  this.preferencePaneID = null;
}
// open-reader 回放同样包一层 try/catch，单 reader 失败仅记录日志
```

同时建议在 `bootstrap.js` 的 `startup` 中兜底 `try { await temporaryInkAddon.startup(rootURI); } catch (error) { Zotero.debug(...); }`，作为最后防线。

**参考**：[Zotero 7+ bootstrapped extension 生命周期](https://www.zotero.org/support/dev/zotero_7_for_developers)。

---

### Low

#### L1. OFF 模式（默认模式）下每次 `pointermove` 触发 8 次 `Zotero.Prefs.get`（已确认）

**证据**：`src/ink/input-controller.ts:126-130`：

```ts
private readonly onPointerMove = (event: PointerEvent): void => {
  if (event.pointerId !== this.pointerID || !this.gestureTool) {
    if (this.modeProvider() === "off") this.updateCursor(event);   // 每次悬停移动都执行
    return;
  }
```

`updateCursor`（`input-controller.ts:205-217`）调用 `this.settingsProvider()`，即 `readSettings()`（`src/config/preferences.ts:24-39`），后者执行 8 次 `Zotero.Prefs.get`。OFF 是**默认模式**，因此默认状态下鼠标在阅读器上悬停移动时，每次 `pointermove`（125–240 Hz）都会穿过 XPCOM 读取全部 8 个偏好。

**影响**：高频路径上的无谓开销（约 1000–1900 次 `Zotero.Prefs.get`/秒），与 DevDoc §29 的 "idle CPU ≈ 0" 目标相悖；`pointerdown` 时另有 16 次读取（`input-controller.ts:97` + `resolveTool` 内部再取一次 settings）。不会造成功能故障。

**触发条件**：默认配置（OFF 模式）下在 PDF 阅读区移动鼠标。

**修复建议**：光标只依赖"修饰键状态是否变化"，用缓存短路：

```ts
// 缓存上次 (ctrl, alt, shift) 三元组；状态未变时直接 return，完全不读 prefs
private lastModifierBits = "";
private updateCursor(event?: ...) {
  const bits = event ? `${event.ctrlKey}|${event.altKey}|${event.shiftKey}` : null;
  if (bits !== null && bits === this.lastModifierBits) return;
  if (bits !== null) this.lastModifierBits = bits;
  ...
}
```

或由 `ReaderRegistry.refreshSettings()`（已有 pref observer）把最新 `InkSettings` 推给各 controller 缓存，`updateCursor` 只读缓存。

#### L2. "启用插件无需重启"路径先 `await registry.ensure()` 再挂工具栏，阻塞启动至多约 10.5 秒/Reader（已确认）

**证据**：`src/addon.ts:43-48`（见 M1 摘录）与 `src/reader/reader-adapter.ts:60`：

```ts
private readonly readinessRetryDelays: readonly number[] = [0, 250, 750, 1500, 3000, 5000],
```

**影响**：`startup()` 会等待**每个**已打开 PDF Reader 的 attach 完成（6 档退避合计 10.5 s 才 fail-closed）。而 `handleRenderToolbar` 的设计恰恰是"同步 append + 异步 bind"（`addon.ts:80-102`），这里的 `await` 既阻塞了 `startup()` 返回，也让已打开 Reader 的工具栏按钮出现时间被推迟到 attach 完成之后——await 的结果只用于一个 null 检查（`if (!this.active || !controller) return;`），没有其他用途。附带问题：`createExistingToolbarEvent` 在该 await 之后才执行，意味着若 attach 期间 Reader 状态变化，合成事件可能已过时。

**触发条件**：在已打开 PDF 的情况下禁用→启用插件；或 Zotero 会话恢复时存在慢初始化（大 PDF/慢磁盘）的 Reader。

**修复建议**：把合成事件与挂载提前到 `ensure` 之前（`handleRenderToolbar` 内部本来就会处理 controller 为 null 时 dispose 按钮）：

```ts
await Promise.all(this.adapter.getOpenReaders().map((reader) => {
  const event = this.adapter.createExistingToolbarEvent(reader);
  if (event) this.handleRenderToolbar(event);   // 同步挂载，异步绑定
}));
```

（若希望保留"viewer 永远不可用时干脆不显示按钮"的行为，可让 `handleRenderToolbar` 的 `.then` 分支继续兜底 dispose，语义不变。）

#### L3. `handleRenderToolbar` 未包 try/catch：同步异常会传导进 Zotero 的 renderToolbar 派发（疑似）

**证据**：`src/addon.ts:69-104`。该 handler 通过 `Zotero.Reader.registerEventListener("renderToolbar", this.handleRenderToolbar, PLUGIN_ID)` 注册（`addon.ts:29`），由 Zotero 在工具栏渲染回调中同步调用。内部 `mountToolbar`（`src/ui/toolbar.ts:79-161`）执行 `createElementNS`、`event.append(button)`（宿主实现的闭包）等操作，任何一步抛出都会进入 Zotero 的调用栈。

**影响**：一旦抛出，可能中断 Zotero 自身的工具栏渲染循环，违背 AGENTS.md 的 "fail without breaking the Reader"。当前代码对 reader 类型、doc 有效性都有前置防御（`addon.ts:71-74`、`reader-adapter.ts:73-81`），`mountToolbar` 的重复挂载也有守卫，实际触发概率低，故定级 Low 且标注"疑似"。

**修复建议**：handler 体包一层 `try { ... } catch (error) { Logger.error(error); }`，与仓库已有的 fail-closed 风格一致。

---

### Info

#### I1. `ReaderAdapter.attach` 的 `_eventDocument` 参数完全未使用（已确认）

`src/reader/reader-adapter.ts:100-104`：参数命名为 `_eventDocument` 且函数体内从未引用。DevDoc §36 的 Strategy A（"官方 event 提供的 document 即所需 document"）未实现。当前实现依赖 Strategy B（`_internalReader._primaryView._iframeWindow`）。这本身不是缺陷（Strategy B 有 9.0.6 源码背书），但建议在参数注释中说明其保留原因，或从接口中移除，避免未来维护者误以为 event.doc 参与了定位。

#### I2. 偏好键名在三处文件重复维护，无一致性校验（已确认）

同一组 `extensions.temporary-ink.*` 键分别硬编码于：

- `src/config/preferences.ts:3-12`（`PREF_KEYS`）
- `prefs.js:1-8`
- `preferences/preferences.js:9-18`

目前三处一致，但 v0.2 路线图（调色板、线宽快捷调节）将新增偏好项，届时需同步改 3 个文件 + `InkSettings` + `DEFAULT_SETTINGS` + XHTML + 两份 FTL，漂移风险高。建议增加一个测试：解析 `prefs.js` 与 `preferences.js` 中的键集合并与 `PREF_KEYS` 断言相等。

#### I3. tsconfig 可进一步收紧（已确认）

`tsconfig.json`：`strict: true` 已开，但缺 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns`；`skipLibCheck: true` 掩盖了 `src/types/zotero.d.ts` 与 `@types/*` 的检查；`"types": ["vitest/globals"]` 使 `@types/node` 不作为全局类型注入。例如 `src/ink/ink-model.ts:81` 的 `stroke.points[stroke.points.length - 1]` 依赖"points 恒非空"的隐含不变式，`noUncheckedIndexedAccess` 会强制显式收窄。建议在 v0.2 迭代中逐步开启，避免一次性引入大量报错。

#### I4. `InkRenderer` 无直接单元测试（已确认）

测试中的 `InkRenderer` 均为 `as unknown as InkRenderer` 的 fake（`tests/input-controller.test.ts:83` 等）。真实的 `resize()`/DPR 变换/`onFrame` 淡出循环/唤醒定时器路径没有自动化覆盖（jsdom 无 Canvas 2D 上下文，需 mock `getContext`）。其生命周期间接被 input-controller 测试覆盖。建议 v0.2 为 `InkRenderer` 补一个 `getContext` mock 级的单测，覆盖 `invalidate`→`onFrame`→`wakeTimer`→`destroy` 全链。

#### I5. 笔画时间戳混用 `event.timeStamp` 与 `performance.now()`（疑似）

`src/ink/input-controller.ts:119,139` 用 `event.timeStamp` 作为 `Point.t`，而 `releaseActive` 与淡出计算用 `this.window.performance.now()`（`input-controller.ts:153`、`ink-model.ts:117-121`）。在 Firefox/Zotero 9 中两者同属 DOMHighResTimeStamp、共享同一 time origin，数值可比，当前行为正确；但这属于隐式假设，一旦宿主（或未来测试环境）改变 timeStamp 语义，症状将是"墨迹永不淡出"而非报错，排查成本高。建议 `pointFromClient` 内统一改用 `performance.now()` 或显式注释该假设。

#### I6. `manifest.json` 的 `update_url` 是占位符（已确认）

`manifest.json:14`：`"update_url": "https://example.invalid/zotero-temporary-ink/updates.json"`。该字段是 Zotero 9 安装的硬性要求（缺失会被拒装，见 `docs/zotero-reader-investigation.md:25` 与手动测试记录），`.invalid` 顶级域作为本地版占位是合理且有意的；但公开发布前必须替换为真实 HTTPS 更新服务器，否则用户无法获得更新。

#### I7. 工作区存在未提交的修复批次，版本号与 CHANGELOG 状态不一致（已确认）

`git status` 显示 `src/ink/input-controller.ts`、`CHANGELOG.md`、README、docs 均有未提交修改，另有 `tests/pointer-capture-deferral.test.ts`、`tests/selection-block.test.ts`、`docs/roadmap.md` 未跟踪。CHANGELOG "Unreleased" 段落描述的"选择抑制修复"已在当前源码与 48 个测试中生效，但 `package.json` 与 `manifest.json` 版本仍为 0.1.13。发布前需要完成 commit + version bump。

#### I8. 两处"有据可查的已接受风险"（已确认，非缺陷）

- **renderToolbar 监听器不主动注销**（`src/addon.ts:63-66`）：因 Zotero 9.0.6 `unregisterEventListener` 存在反向过滤 bug，代码有意不调用它，依赖 Zotero 插件 shutdown observer 按 PLUGIN_ID 清理，并以 `this.active` 守卫兜底。依据见 `docs/zotero-reader-investigation.md:21-23`。
- **绘制期间仍有少量残余文本选择**：指针捕获延迟方案 + 四层抑制（CSS `!important`、`selectstart`、`selectionchange`、捕获延迟）只能"大幅减少"而无法根除 Zotero 程序化选择路径的泄漏，已在 `docs/zotero-reader-investigation.md:51-62` 明确记录并被用户接受。这两处风险依赖 Zotero 内部行为，升级 Zotero 9.x 时应首先回归验证。

---

## 3. 修复优先级清单（按风险收益比排序）

| 优先级 | 事项 | 对应发现 | 工作量 |
|---|---|---|---|
| P0 | `startup()` 失败隔离：pane 注册与 open-reader 回放各自 try/catch，bootstrap 兜底 catch | M1 | ~10 行 |
| P1 | 启动路径删除冗余 `await registry.ensure`，同步合成事件即挂载 | L2 | ~6 行 |
| P2 | `updateCursor` 用修饰键状态缓存短路，消除指针移动路径的 8×Prefs.get | L1 | ~8 行 |
| P3 | `handleRenderToolbar` 包裹 try/catch | L3 | ~4 行 |
| P4 | 发布前：提交未提交批次、bump 版本至 0.1.14、补 CHANGELOG | I7 | 流程性 |
| P5 | v0.2 迭代：开启 `noUncheckedIndexedAccess` 等开关（I3）、偏好键一致性测试（I2）、InkRenderer 单测（I4）、`Point.t` 时钟统一（I5） | I1-I5 | 随 v0.2 排期 |

## 4. 验证清单（实际执行的命令与结果）

| 命令 | 结果 |
|---|---|
| `npm run typecheck`（`tsc --noEmit`） | ✅ 通过，零错误 |
| `npm test`（`vitest run`） | ⚠️ 首次运行因审计环境沙箱限制 `spawn EPERM`（tinypool fork 子进程被 Windows 命名管道策略拦截）；升级权限重试后 **✅ 11 个文件 48/48 通过**（3.05 s） |
| `npx vitest run --pool=threads` | ❌ 仍为 EPERM（Vite `optimizeSafeRealPathSync` 内 exec node 所致）——属审计环境限制，非项目缺陷 |
| `npm run build` | ⚠️ 沙箱内 `spawn EPERM`（esbuild 派生原生二进制）；升级权限重试后 ✅ `build/addon.js` 44.6 kb |
| `npm run verify:package` | ✅ `Verified dist/zotero-temporary-ink-0.1.13.xpi (10 files)`，禁止 API 扫描、源码泄漏检查、生命周期钩子检查全部通过 |
| grep `@ts-ignore\|@ts-expect-error\|\bany\b\|as never\|as unknown`（src/） | ✅ 零命中 |
| grep `innerHTML\|eval(\|new Function\|localStorage\|setInterval\|document.write`（src/） | ✅ 零命中 |
| grep `TODO\|FIXME\|HACK\|console\.`（src/） | ✅ 零命中 |
| `git status --porcelain` | 6 个已修改 + 3 个未跟踪文件（见 I7） |

**依赖安全说明**：`package.json` 无运行时 `dependencies`（XPI 由 esbuild 全量打包，不携带 node_modules 代码），devDependencies 仅用于构建与测试，本次未执行 `npm audit`（可按需补充）。

## 5. 做得好的地方

- **类型纪律**：`strict` 全开、`Zotero.Prefs.get` 返回 `unknown` 且全部显式收窄、`src/` 无 `any`/类型断言滥用/`@ts-ignore`——在"必须触碰宿主私有对象"的插件语境下殊为难得。
- **清理不变量**：`DisposableStore`（逆序释放 + 异常吞掉保证 best-effort）、`DisposableSlot`、`destroy()` 全链幂等；`InputController.finishGesture()` 是 pointerup/pointercancel/Escape/blur/refresh/destroy 的单一出口，配 4 个专门测试验证。
- **私有 API 隔离**：`_iframeWindow`、`_internalReader._primaryView._iframeWindow`、`.toolbar .end .custom-sections` 等 Zotero 9.0.6 内部结构全部收敛在 `ReaderAdapter`（`src/reader/reader-adapter.ts`），符合 AGENTS.md 边界，且每条 selector 都有 pinned commit 注释背书。
- **宿主假设工程化**：自研 `CancellationController` 规避 bootstrap 作用域无 DOM 全局的问题；版本号打散 `addon.js?v=` 缓存；对 Zotero `unregisterEventListener` 反向 bug 的规避有源码级证据。
- **性能意识**：渲染按需驱动（仅绘制/淡出时 rAF，hold 期单一定时器休眠）、1px 最小距离采样、`pointer-events: none` 画布、无高频日志——与 DevDoc §29 目标一致（L1 是仅存的偏离点）。
- **测试策略**：48 个用例覆盖了最易翻车的区域——指针捕获延迟时序（4 用例）、选择抑制全出口（7 用例）、Registry 的 shutdown 竞态（"attach 在 shutdown 后才 resolve"）、面板 XHTML 用镜像 Zotero 解析器验证、bootstrap 版本 bust。
- **打包卫生**：`verify:package` 同时做结构校验（缺文件/源码泄漏/chrome.manifest）与行为校验（禁止持久化 API 字符串扫描、生命周期钩子存在性、HTTPS update_url）。
- **文档质量**：`docs/zotero-reader-investigation.md` 记录源码调查结论与来源链接，`docs/manual-test.md` 含 23 行可复现清单与历史缺陷回溯，`docs/roadmap.md` 明确了 v0.2/v0.3 边界。

**总体评价**：当前代码库处于可发布质量，无 Critical/High 级问题；建议在 v0.2 开发前落地 P0–P3 四项小改动，并将 I 类工程卫生项并入 v0.2 迭代计划。
