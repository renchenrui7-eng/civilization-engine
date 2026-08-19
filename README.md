# Civilization Engine · 文明引擎

> 把「文明如何看世界」转化为「可执行视觉参数」的九层推演引擎。
> 不是风格词典，而是带因果链的风格生成器。

**A causal-style engine that turns how civilizations see the world into executable visual parameters — 6 cultural force fields × 9 deduction layers, every output traceable to its "why".**

## 为什么不一样

市面上的风格工具给你配方：「茶品牌 → 低饱和 + 留白」。
文明引擎给你推导链：

```
大河农耕地理（生存压力）
  → 人如何在变化无常中达成恒久平衡（存在命题）
  → 循环绵延、有无相生（时间模型）
  → 天人一体（自然关系）
  → 算子：天人合一 → 光影柔和化、材质自然化
  → 漫射柔光 · 低饱和自然色系 · 原生温润材质（可执行参数）
```

**每个结论都有依据，每次混搭都可解释。**

## 三种形态

| 形态 | 入口 | 适合 |
|------|------|------|
| 🤖 **MCP Server** | `mcp/server.js`（零依赖 Node） | 让 AI 直接调用：WorkBuddy / Claude / 任何 MCP 客户端 |
| 🌐 **网页版** | `web/index.html`（零依赖单文件） | 人类直接使用，内置反馈器 |
| 📖 **知识库** | `mcp/forces_data.json` + `references/` | 二次开发 / 自建工具 |

## 快速开始

### MCP（以 WorkBuddy / Claude Desktop 为例）

在 MCP 配置中添加：

```json
{
  "mcpServers": {
    "civilization-engine": {
      "command": "node",
      "args": ["/你的路径/civilization-engine/mcp/server.js"]
    }
  }
}
```

然后直接对 AI 说：

> 「用平衡共生 70 + 生命循环 15 + 内观超越 15，帮我推演一个高山古树普洱茶品牌视觉方案，预算低，目标是品牌认知。」

AI 会自动调用 `civ_blend` 返回：九层推演（含因果链与置信度）、融合 Prompt、Why-Layer 解释、低预算降级执行清单。

### 网页版

直接双击打开 `web/index.html`。拖权重 → 输命题 → 运行引擎 → 底部「反馈」按钮提交使用数据（可导出 JSON 参与项目进化）。

## 六大文明力场

| ID | 力场 | 世界观内核 | 视觉倾向 |
|----|------|-----------|---------|
| F01 | 平衡共生 Balance-Symbiosis | 求衡、顺应、循环 | 柔光、留白、低饱和、自然材质 |
| F02 | 超越秩序 Transcendent-Order | 神圣、层级、永恒 | 对称、纯色、顶光、静态 |
| F03 | 认知解构 Cognitive-Deconstruction | 理性、解构、迭代 | 几何、硬光、冷调、规整 |
| F04 | 主体突破 Subjective-Breakthrough | 个体、突破、无限 | 撞色、动态、混搭、张力 |
| F05 | 生命循环 Life-Cycle | 生态、节律、共生 | 自然光、原生色、肌理、生长感 |
| F06 | 内观超越 Introspective-Transcendence | 苦难、内观、解脱 | 暗调、灰度、极简、空寂 |

每个力场含 6 个官方变体（如 F01 的「宋代清雅 / 唐代华美 / 日式侘寂 / 新中式极简」），通过概率通道（vp）参与混合。

## 概率混合算法

```
score(维度候选) = 力场权重 × 倾向概率(dp/100)
变体通道：score = 力场权重 × 变体概率(vp/100)
每维度取 Top3，按 score 排序，附置信度
```

不是非黑即白的规则，而是可调的概率分布——「宋式清雅 80% + 唐风浓烈 20%」这样细腻的配比也能表达。

## 目录结构

```
civilization-engine/
├── SKILL.md               # AI 技能定义（可直接装为 WorkBuddy Skill / Agent Skill）
├── README.md
├── LICENSE                # MIT
├── mcp/
│   ├── server.js          # MCP Server（零依赖，stdio JSON-RPC）
│   ├── forces_data.json   # 引擎全量数据（6力场×9层）
│   └── openapi.yaml       # OpenAPI Schema（供 GPTs/DeepSeek 等非 MCP 客户端）
├── web/
│   └── index.html         # 网页版（含反馈器）
└── references/
    └── engine-spec.md     # 引擎完整规格说明
```

## 进化路线

- **v1.0**（当前）：静态知识库 + MCP + 反馈数据采集
- **v1.x**：反馈数据回流校准 dp/vp 概率与预设权重
- **v2.0**（构想）：用户提交新案例 → 自动提取特征 → 社区共建力场变体

## 许可

MIT License — 详见 [LICENSE](LICENSE)

## 贡献

最有价值的贡献是**真实使用反馈**：用网页版跑一次真实项目，点底部「反馈」导出 JSON 提交 issue。
