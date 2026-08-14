# v0.2 构建计划（plan-builder-evaluator）

> 依据：docs/roadmap.md「v0.2 — 现有功能打磨」条目 1–5。
> 框架角色：主 agent = planner + evaluator；subagent A / B = 两个并行 builder。
> 分工（用户已确认）：A = 条目 1+2+3（工具栏/调色板/线宽）；B = 条目 4（角落徽标）；主 agent = 条目 5（文案统一）+ 最终评估。

## 1. 文件所有权（防冲突，硬约束）

| 文件 | 所有者 | 说明 |
|---|---|---|
| src/ui/toolbar.ts | A | 条目 1、2 集成 |
| src/ui/palette.ts（新建） | A | 调色板弹出面板 |
| src/ink/input-controller.ts | A | 数字键 1–6、[ ] 键 |
| src/config/constants.ts | A | PALETTE_COLORS 等常量 |
| src/config/preferences.ts | A | setPenColor / adjustPenWidth |
| locale/zh-CN/temporary-ink.ftl | A | 新增调色板文案 |
| locale/en-US/temporary-ink.ftl | A | 新增调色板文案 |
| tests/toolbar.test.ts、tests/input-controller.test.ts | A | 适配与新增用例 |
| tests/palette.test.ts（新建） | A | 调色板用例 |
| src/ui/badge.ts（新建） | B | 角落徽标组件 |
| src/reader/reader-controller.ts | B | 徽标接线 |
| tests/badge.test.ts（新建） | B | 徽标用例 |
| README.md、README.zh-CN.md、CHANGELOG.md、docs/roadmap.md、docs/manual-test.md、manifest.json、package.json | 主 agent | 条目 5 + 收尾 |

两个 builder 并行运行，各自文件不重叠。互相只读对方文件。

## 2. 交叉契约

- A 必须保持 src/ink/input-controller.ts 中 matchesModifier 与 resolveGestureTool 两个导出的纯函数签名不变（B 的徽标依赖它们判断手势）。
- A 不新增任何 pref 键：调色板写现有 penColor，线宽写现有 penWidth（PREF_KEYS），生效路径复用 addon.ts 已注册的 pref observer → registry.refreshSettings()。
- B 不修改 A 的文件；B 的徽标为纯显示，不得 preventDefault / stopPropagation 任何事件。
- 双方必须保持现有 54 个测试通过（tests/ 下其余文件不动）。

## 3. 条目规格（映射 roadmap 验收标准）

### 条目 1：模式可见的工具栏（A）
- 三种模式三套 SVG 图标：OFF = 现有「笔+淡出点」默认图标；PEN = 画笔；RECTANGLE = 矩形框。
- 用 createElementNS 构建，禁止 innerHTML；mode 更新时替换按钮内 SVG。
- 保留 .active 类（Zotero 原生 active 态）、aria-pressed、dataset.mode、tooltip（现有 l10n 双 id 逻辑）。
- 验收：点击切换图标立即变化；OFF 恢复默认样式；不残留重复按钮（现有守卫保留）。
- 更新 tests/toolbar.test.ts 中图标相关断言。

### 条目 2：快捷调色板（A）
- constants.ts：PALETTE_COLORS = [#FF4D4F, #FA8C16, #FADB14, #52C41A, #1677FF, #722ED1]（首项 = DEFAULT_SETTINGS.penColor）。
- 新建 src/ui/palette.ts：PalettePopover（open(anchor)/close()/dispose()），6 个色块按钮，当前颜色高亮；点击色块 → Zotero.Prefs.set(PREF_KEYS.penColor, color, true)（值未变则跳过）并关闭；fixed 定位贴近按钮；Esc 或外部 pointerdown 关闭；挂到 event.doc.body。
- toolbar.ts：pointerdown 长按 500 ms（期间无位移）打开调色板；pointerup/pointerleave/pointercancel 取消计时；长按打开后抑制该次 click 不再 cycleMode；dispose 时关闭并移除 popup。
- input-controller.ts keydown：settings.enabled 且无 ctrl/alt/meta 且 target 非 input/textarea/contenteditable 时，Digit1–6（event.key "1".."6"）→ 写 penColor；不 consume 事件（不拦截 Zotero 快捷键）。
- locale 新增调色板文案（zh/en 同义）。
- 验收：换色后下一笔立即生效（复用 pref observer 实时路径）；色块高亮当前颜色；不拦截 Zotero 快捷键；选择只写插件 pref，不写任何 Zotero 库数据。

### 条目 3：快捷线宽调节（A）
- preferences.ts：adjustPenWidth(delta: number)：读 penWidth、±1、clamp 1–20、值未变跳过、写 pref。
- input-controller.ts keydown：同条目 2 条件，[ → -1、] → +1；不 consume 事件。
- 宽度数字显示由条目 4 徽标负责（B），A 不需要做 UI 显示。
- 验收：调节即时生效（pref observer 路径）；不影响 Zotero 原有按键行为。

### 条目 4：屏幕角落提示徽标（B）
- 新建 src/ui/badge.ts：CornerBadge：
  - show(tool: "pen" | "rectangle")：读 settings（penColor/penWidth），渲染「工具名 · N px」+ 颜色圆点；重置 1 s 自动隐藏计时器。
  - hide()；update()（可见时重渲）；dispose()（移除元素+清计时器，幂等）。
  - 元素：div，data-temporary-ink="badge"，position fixed，pointer-events: none，z-index 低于 canvas（如 2147482999），初始隐藏。
  - 工具名文案：优先尝试 viewer doc 的 l10n；不可用则按 Zotero.locale 选 zh/en 静态 fallback（画笔/Pen、框选/Rectangle），任何情况下不抛错。
- reader-controller.ts 接线（B 所有）：
  - init() 创建 badge 挂到 context.overlayHost。
  - context.window 上捕获监听（全部 passive、不消费）：keydown/keyup 维护修饰键状态 → OFF 模式下用 resolveGestureTool（import 自 ../ink/input-controller，纯函数）决定 show/hide；pointerdown/pointerup/pointercancel → mode !== off 且 primary+button 0 且位于 viewerElement 内时 show(mode)/hide。
  - 状态机：current = (mode !== off && pointerDown) ? mode : (mode === off ? resolveTool(修饰键) : null)；变化时 show/hide。
  - 视口变化/滚动清除路径追加 badge.hide()；refreshSettings() 里 badge.update()，enabled=false 时 hide；destroy() 里 badge.dispose()。
- 验收：OFF 模式按住修饰键出现；松键消失；约 1 s 自动消失；不拦截任何事件；无 DOM 残留。

### 条目 5：中英文文案统一（主 agent，评估阶段执行）
- 核对 zh/en FTL、README、偏好面板、tooltip 中「临时墨迹/画笔/框选/快捷键」术语一一对应；README 补充 v0.2 新交互说明；更新 manual-test、CHANGELOG、roadmap 状态；版本 bump 至 0.2.0。

## 4. 验证门（evaluator 执行）

1. npm run typecheck 零错误。
2. npm test 全部通过（现有 54 个 + 新增用例）。
3. npm run build 与 npm run verify:package 通过。
4. 逐条核对 roadmap 验收标准；不达标退回对应 builder 修复。

## 5. 沙箱提示

- npm run typecheck 为纯 tsc，可直接跑。
- npm test（vitest 派生 worker）与 npm run build（esbuild 原生二进制）在受限沙箱中可能 EPERM；builder 遇到即记录输出并跳过，由主 agent 评估阶段统一升级权限执行。

## 6. 进度记录

| 阶段 | 状态 |
|---|---|
| plan | ✅ 本文件 |
| builder A（条目 1+2+3，subagent fa816253） | ✅ 完成（交付报告已验收） |
| builder B（条目 4，subagent 34ccf886） | ✅ 完成（交付报告已验收） |
| evaluate | ✅ typecheck 0 错 / 80 测试全过 / XPI 构建+校验通过 |
| 条目 5 + 收尾 | ✅ locale 统一、README/CHANGELOG/roadmap/manual-test、版本 0.2.0 |
| 条目 5 预置（README×2、manual-test 用例 24–32） | ✅ 已落地 |
| evaluate + 条目 5 收尾 | 待 builder 返回 |

## 7. 条目 5 审计发现（待处理）

- zh-CN FTL：temporary-ink-mode-rectangle = 框选 与 temporary-ink-pref-modifier-rectangle = 矩形快捷键 混用 → 统一为「框选」（待 A 完成后修改）。
- README 双语「不占用 Alt / Ctrl+Alt」与 0.1.11 起修饰键可配置冲突 → 已改为默认值表述。
- README 测试数（37/48）与 CHANGELOG（54）不一致 → 待最终数字统一。
- zh-CN README「矩形框」→「框选」已统一。

## 8. 沙箱结论（实测）

- npm run typecheck ✅ 可运行。
- npm test ❌ spawn EPERM（tinypool fork worker 被命名管道策略拦截）；--pool=threads 同样失败于 vite optimizeSafeRealPathSync 内部 exec "net use"（config.js:2230，无环境变量短路）→ evaluate 阶段升级权限重试一次（需用户批准）。
- npm run build 预计同样 EPERM（esbuild 原生二进制）→ 同样升级权限执行。

## 8.5 等待策略与后备方案（决策线）

- 时间基准：第一回合 14:06→14:16（~11 min）零写入 → 14:16:39 interrupt + 状态询问重启新回合。
- 新回合 14:16:45 起算：若至 ~14:37（20 min）仍零文件写入，放弃 subagent 路线，主 agent 按 §3 规格直接实现条目 1–4（spec 已完备，可直接落地）。
- 收到任一 builder 完成通知 → 立即开始 evaluate，不再等待另一个（先验收已完成的）。

## 8.6 后备实现：文件级步骤（仅决策线触发后使用）

A 侧（条目 1+2+3）：
1. constants.ts：加 PALETTE_COLORS（6 色）与 PEN_WIDTH_STEP=1。
2. preferences.ts：加 setPenColor(color) / adjustPenWidth(delta)（读-夹取-变化即写）。
3. src/ui/palette.ts：新建 PalettePopover（open/close/dispose，6 色块，当前色高亮，Esc/外点关闭，挂 event.doc.body）。
4. toolbar.ts：update(mode) 内换 SVG（三套图标，createElementNS）；长按 500ms 开调色板+抑制 click；dispose 清理。
5. input-controller.ts keydown：Digit1–6 / [ / ]（无修饰键、非可编辑、enabled；不 consume）。
6. locale×2：调色板文案。
7. 测试：toolbar.test.ts 图标断言更新+长按用例；input-controller.test.ts 按键用例；palette.test.ts 新建。

B 侧（条目 4）：
1. src/ui/badge.ts：新建 CornerBadge（mount/show(tool)/hide/update/dispose；fixed、pointer-events:none、z-index 2147482999；1s 自动隐藏；文案 zh/en fallback）。
2. reader-controller.ts：init() 建 badge 挂 overlayHost；window 捕获 passive 监听（key/pointer 状态机：mode!==off&&pointerDown → mode；mode===off → resolveGestureTool(修饰键)）；Escape hide；视口/滚动 hide；refreshSettings update/hide；destroy dispose。
3. tests/badge.test.ts：新建（生命周期/计时器/无残留/内容/触发矩阵）。


- tests 引用 A 模块（toolbar/input-controller/constants）：input-controller、cursor-cache、pointer-capture-deferral、selection-block、toolbar、reader-registry（仅 DEFAULT_SETTINGS + type）。
- tests/reader-registry.test.ts 全程用 fake controller（controllerFactory 覆盖或 as unknown as ReaderController），真实 ReaderController 从不用裸 {dispose} context 构造 → B 的改动不会破坏它。
- tests/addon-toolbar.test.ts 走真实 addon+mountToolbar，其 Zotero mock：Prefs.get 返回 undefined（readSettings 需走 fallback）、无 locale、jsdom 无 document.l10n → A/B 的新代码必须容忍这些缺失且不抛错。
