# Civilization Engine · 引擎规格说明 v1.0

本文档是文明引擎的完整技术规格，供二次开发与贡献者参考。

## 1. 设计哲学

美学风格的表层配方（"茶品牌用低饱和"）是**结论**，本引擎补全的是**推导过程**：

```
生存压力（地理/资源/社会结构）
  决定 存在命题（文明要回答的根本问题）
  决定 时间模型 / 空间模型 / 人我关系 / 自然关系（四维世界观）
  沉淀 心理基调（情绪底色）
  投影 审美概率参数（光照/构图/色彩/材质/节奏的概率分布）
  落地 视觉执行参数（可直接执行的基线）
```

关键立场：**风格是概率分布，不是确定规则**。每个力场在同一维度上有主倾向（dp，默认 80-90）与变体倾向（vp，默认 10-20），如 F01 平衡共生的主倾向是柔光，但有 20% 概率通道通向敦煌/唐风的高对比硬光。

## 2. 数据模型（forces_data.json）

每个力场对象：

```json
{
  "id": "F01",
  "name": "平衡共生力场",
  "nameEn": "Balance-Symbiosis",
  "color": "#f0883e",
  "L0": ["大河农耕地理", "资源稳定且依赖天时", "..."],   // 5 条生存压力
  "L1": "存在命题（一句话）",
  "L2": "时间模型",
  "L3": "空间模型",
  "L4": "人我关系",
  "L5": "自然关系",
  "L6": "心理基调（形容词串）",
  "L7": {                                               // 审美概率参数
    "light":  { "d": "主倾向描述", "dp": 80, "v": "变体描述", "vp": 20 },
    "comp":   { ... }, "color": { ... },
    "mat":    { ... }, "rhythm": { ... }
  },
  "L8": { "light": "...", "contrast": "...", "comp": "...", "angle": "...", "color": "...", "material": "...", "mood": "..." },
  "variants": ["宋代清雅", "唐代华美", "..."],           // 6 个变体
  "variantMod": "变体调整说明",
  "operator": "世界观→视觉的转换算子（分号分隔）"
}
```

## 3. 混合算法

```
输入：weights {F01..F06}（自动归一化到 100）
对每个维度 dim ∈ {light, comp, color, mat, rhythm}:
  candidates = []
  对每个权重 > 0 的力场 f:
    candidates += { text: f.L7[dim].d, score: w_f × dp/100, source: f, isVariant: false }
    candidates += { text: f.L7[dim].v, score: w_f × vp/100, source: f, isVariant: true }
  result[dim] = sort(candidates, score desc).filter(score>0).take(3)
```

置信度 = min(99, score × 100)。

## 4. 约束系统

三类约束在九层推演之后叠加，动态调整输出：

- **use_case**（使用场景）：brand_visual / space_design / product_photo / content_creation — 决定 Prompt 前缀与 L7→执行建议的映射
- **resource_level**（资源约束）：low / medium / high — 输出对应预算的降级/完整执行清单
- **goal**（目标）：conversion / aesthetic / recognition — 调整构图/色彩/符号化策略的侧重

## 5. 因果链（Why-Layer）

每个输出附带两类可追溯依据：

1. **层间链**：L(n) 由 L(n-1) 推导（引擎按层固定）
2. **参数链**：每个 L7 维度条目追溯 `L0 压力 → L1 命题 → L2 时间 → L5 自然 → 算子 → 维度指令`，其中算子来自该力场的 `operator` 字段中与该维度相关的分句

## 6. MCP 协议实现

- 传输：stdio，换行分隔 JSON-RPC 2.0
- 握手：`initialize` → 返回 protocolVersion / capabilities.tools / serverInfo
- 工具：`civ_blend` / `civ_forces` / `civ_presets` / `civ_feedback`
- 所有 `tools/call` 返回 `content: [{type:'text', text: JSON.stringify(result)}]`
- 零依赖：纯 Node 标准库（fs / path / readline）

## 7. 进化数据流

```
网页版反馈器 ──localStorage──> 导出 JSON ──┐
MCP civ_feedback ──> feedback_log.jsonl ───┼──> 版本迭代时校准 dp/vp、预设权重、新增变体
MCP 调用日志 ────> usage_log.jsonl ────────┘
```

校准原则（v1.x 待实现）：`新dp = 旧dp × 0.7 + 实际使用高分率 × 0.3`，每版本以 CHANGELOG 记录。

## 8. 已验证的压力测试

三文明差异化测试（中国茶 / 日本建筑 / 美国科技）6/6 维度输出显著差异 —— 详见发布说明。
