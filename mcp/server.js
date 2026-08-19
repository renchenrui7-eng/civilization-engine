#!/usr/bin/env node
/**
 * Civilization Engine MCP Server
 * 文明引擎 · 六大文明力场 九层推演 — MCP (Model Context Protocol) 服务
 *
 * 零依赖：纯 Node stdio JSON-RPC 2.0
 * 四刀能力内置：
 *   刀1 深度   —— 每层输出带因果链（L0驱动 → L1命题 → … → L7参数）与置信度
 *   刀2 实用   —— use_case / resource_level / goal 三类约束动态调整输出
 *   刀3 进化   —— 调用日志 usage_log.jsonl + 反馈回流 civ_feedback 工具
 *   刀4 连接   —— MCP 标准协议，任何支持 MCP 的大模型客户端可直接调用
 *
 * 运行: node server.js  （stdin/stdout, 换行分隔 JSON-RPC）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_NAME = 'civilization-engine';
const SERVER_VERSION = '1.0.0';
const LOG_DIR = __dirname;

// ---------- 引擎数据：六大文明力场 ----------
const FORCES = require('./forces_data.json');
const DIM_KEYS = ['light', 'comp', 'color', 'mat', 'rhythm'];
const LAYER_NAMES = ['L0 文明形成压力', 'L1 存在命题', 'L2 时间模型', 'L3 空间模型', 'L4 人我关系', 'L5 自然关系', 'L6 心理基调', 'L7 审美概率参数', 'L8 视觉执行参数'];

// ---------- 预设 ----------
const PRESETS = [
  { name: '宋式清雅茶', weights: { F01: 70, F06: 15, F05: 15 } },
  { name: '山野荒野茶', weights: { F05: 60, F01: 25, F06: 15 } },
  { name: '禅茶一味', weights: { F06: 55, F01: 35, F02: 10 } },
  { name: '现代东方茶饮', weights: { F01: 45, F04: 30, F03: 25 } },
  { name: '高端礼品茶', weights: { F02: 40, F01: 35, F06: 25 } },
  { name: '科技极简', weights: { F03: 70, F01: 15, F04: 15 } },
  { name: '先锋潮流', weights: { F04: 65, F03: 20, F01: 15 } },
  { name: '北欧自然有机', weights: { F05: 55, F03: 30, F01: 15 } },
  { name: '极简治愈', weights: { F06: 60, F05: 25, F01: 15 } },
  { name: '神圣高端', weights: { F02: 55, F01: 25, F03: 20 } },
];

// ---------- 约束系统（刀2 实用） ----------
const USE_CASES = {
  brand_visual: {
    label: '品牌视觉 / VI',
    promptPrefix: 'brand visual design, ',
    execHints: ['Logo/色彩/字体建议直接取 L7 色彩维度 Top1 与 L6 心理基调', '辅助图形取 L7 构图维度的疏密逻辑', '材质维度映射到包装工艺'],
  },
  space_design: {
    label: '空间设计',
    promptPrefix: 'interior and spatial design, ',
    execHints: ['L3 空间模型直接指导动线与分区', 'L7 光照维度映射为自然采光+人工布光方案', '材质维度映射为主材选择'],
  },
  product_photo: {
    label: '产品摄影',
    promptPrefix: 'professional product photography, ',
    execHints: ['L8 即拍摄参数基线（布光/对比/构图/机位/色调）', 'L7 光照 Top2 组合为双灯方案', '情绪维度写入氛围关键词'],
  },
  content_creation: {
    label: '内容创作 / 社媒',
    promptPrefix: 'social media content, ',
    execHints: ['L6 心理基调 = 文案语气与选题方向', 'L7 节奏维度指导内容排布节奏', '冲突感来自次主力场的差异'],
  },
};

const RESOURCE_LEVELS = {
  low: {
    label: '低预算（手机+自然光）',
    adjustments: ['以窗口自然光替代布光系统（对应 L7 光照主倾向）', '背景用纯色布/墙面替代场景搭建', '道具做减法：只保留 1 个材质代表物', '后期用免费工具（Snapseed/醒图）调 L7 色彩方向'],
  },
  medium: {
    label: '中预算（单灯+基础道具）',
    adjustments: ['单灯+柔光箱实现 L7 光照主倾向，反光板补阴影', '背景纸或简易置景', '道具按 L7 材质维度选 2-3 件', 'Lightroom 按色彩维度建立预设'],
  },
  high: {
    label: '高预算（完整执行）',
    adjustments: ['双灯+轮廓光完整还原 L7 光照组合', '按 L3 空间模型搭建场景', '材质按 L7 Top3 全量准备', 'Capture One 分组调色，输出多版本'],
  },
};

const GOALS = {
  conversion: { label: '转化优先', emphasis: '清晰度与卖点前置：主体占比提高，L7 构图向中心聚合，色彩降低干扰' },
  aesthetic: { label: '审美表达', emphasis: '氛围与留白前置：L7 构图向留白倾斜，光影层次优先于信息效率' },
  recognition: { label: '品牌认知/符号记忆', emphasis: '记忆点前置：从 L6 提炼 1 个可重复的符号性元素（色彩/构图母题），全渠道复用' },
};

// ---------- 引擎核心 ----------
function normalizeWeights(w) {
  const out = {};
  let sum = 0;
  for (const f of FORCES) {
    const v = Math.max(0, Number(w[f.id]) || 0);
    out[f.id] = v; sum += v;
  }
  if (sum <= 0) return null;
  for (const k of Object.keys(out)) out[k] = Math.round((out[k] / sum) * 1000) / 10;
  return out;
}

function getActive(weights) {
  return FORCES.map(f => ({ force: f, weight: weights[f.id] })).filter(x => x.weight > 0).sort((a, b) => b.weight - a.weight);
}

function blendL7(weights) {
  const result = {};
  for (const dim of DIM_KEYS) {
    const entries = [];
    for (const f of FORCES) {
      const w = weights[f.id];
      if (!w) continue;
      const d = f.L7[dim];
      entries.push({ text: d.d, score: Math.round(w * d.dp) / 100, source: f.name, sourceId: f.id, isVariant: false, weight: w });
      if (d.vp > 0) entries.push({ text: d.v, score: Math.round(w * d.vp) / 100, source: f.name, sourceId: f.id, isVariant: true, weight: w });
    }
    entries.sort((a, b) => b.score - a.score);
    result[dim] = entries.filter(e => e.score > 0).slice(0, 3);
  }
  return result;
}

/** 刀1 深度：为每个 L7 维度条目生成因果链 */
function chainFor(force, dim) {
  const dimName = { light: '光照', comp: '构图', color: '色彩', mat: '材质', rhythm: '节奏' }[dim];
  const op = force.operator.split('；').find(s => s.includes(dimName)) || force.operator.split('；')[0];
  return `L0(${force.L0[0]}等生存压力) → L1「${force.L1.slice(0, 18)}…」→ L2 ${force.L2.slice(0, 14)}… → L5 ${force.L5.slice(0, 14)}… → 算子: ${op}`;
}

function buildPrompt(active, blend, prop, useCase) {
  const dominant = active[0];
  const l8 = dominant.force.L8;
  const tones = active.filter(a => a.weight >= 5).map(a => a.force.L6);
  const uc = USE_CASES[useCase] || USE_CASES.brand_visual;
  let p = `${uc.promptPrefix}${prop}, `;
  p += `${blend.light[0].text}, ${blend.comp[0].text}, ${blend.color[0].text}, ${blend.mat[0].text}, `;
  p += `${l8.light}, ${l8.contrast}, ${l8.comp}, ${l8.angle}, ${l8.color}, ${l8.material}, `;
  p += `mood: ${tones.join(', ')}, ${l8.mood}`;
  if (active.length > 1) p += `, blended with ${active.slice(1).map(a => `${a.force.name}(${a.weight}%)`).join(' + ')}`;
  return p;
}

function civBlend(params) {
  let rawW = params.weights || {};
  if (rawW.weights && typeof rawW.weights === 'object') rawW = rawW.weights; // 兼容客户端按嵌套 schema 传参
  const weights = normalizeWeights(rawW);
  if (!weights) return { error: 'weights 无效：至少一个力场权重大于 0（如 {F01:70, F05:15, F06:15}）' };
  const prop = params.proposition || '未指定命题';
  const useCase = USE_CASES[params.use_case] ? params.use_case : 'brand_visual';
  const resLevel = RESOURCE_LEVELS[params.resource_level] ? params.resource_level : 'medium';
  const goal = GOALS[params.goal] ? params.goal : 'aesthetic';

  const active = getActive(weights);
  const dominant = active[0];
  const blend = blendL7(weights);

  // ---- 九层推演（刀1：每层带 why 因果链）----
  const layers = [];
  layers.push({
    layer: 'L0', name: LAYER_NAMES[0], dominant: dominant.force.name,
    content: dominant.force.L0,
    why: `由地理/资源/社会结构五类生存压力共同塑造「${dominant.force.name}」的底层驱动力`,
  });
  for (let li = 1; li <= 6; li++) {
    const key = 'L' + li;
    layers.push({
      layer: key, name: LAYER_NAMES[li], dominant: dominant.force.name,
      content: dominant.force[key],
      modifiers: active.slice(1).filter(a => a.weight >= 15).map(a => `${a.force.name}(${a.weight}%)修饰: ${a.force[key].slice(0, 24)}…`),
      why: li === 1 ? '生存压力(L0)直接催生的存在命题' : `由 L${li - 1} 推导而来：${LAYER_NAMES[li - 1]} → ${LAYER_NAMES[li]}`,
    });
  }
  const l7Detail = {};
  for (const dim of DIM_KEYS) {
    l7Detail[dim] = blend[dim].map(e => ({
      text: e.text, score: e.score, source: e.source, isVariant: e.isVariant,
      confidence: Math.min(99, Math.round(e.score * 100)),
      chain: chainFor(FORCES.find(f => f.name === e.source), dim),
    }));
  }
  layers.push({ layer: 'L7', name: LAYER_NAMES[7], dominant: dominant.force.name, dimensions: l7Detail, why: '概率混合算法：score = 力场权重 × (倾向概率dp/100)，Top3 保留，变体按 vp 概率进入' });
  layers.push({
    layer: 'L8', name: LAYER_NAMES[8], dominant: dominant.force.name,
    content: dominant.force.L8,
    why: '主导力场 L7 参数直接映射为可执行视觉基线',
  });

  // ---- Why Layer（主导逻辑解释）----
  const whyLayer = {
    dominant: `${dominant.force.name} ${dominant.weight}%`,
    structure: active.slice(1).map(a => `${a.force.name} ${a.weight}% — ${a.weight >= 15 ? '修饰' : '点缀'}`),
    variantHint: dominant.force.variantMod,
    operators: active.map(a => `${a.force.name}: ${a.force.operator}`),
  };

  // ---- 约束调整（刀2）----
  const constraints = {
    use_case: USE_CASES[useCase].label, execHints: USE_CASES[useCase].execHints,
    resource_level: RESOURCE_LEVELS[resLevel].label, adjustments: RESOURCE_LEVELS[resLevel].adjustments,
    goal: GOALS[goal].label, emphasis: GOALS[goal].emphasis,
  };

  const prompt = buildPrompt(active, blend, prop, useCase);
  const overallConfidence = Math.round(active.slice(0, 2).reduce((s, a) => s + a.weight, 0));

  return {
    engine: `Civilization Engine v${SERVER_VERSION}`,
    proposition: prop,
    weights, use_case: useCase, resource_level: resLevel, goal,
    nine_layers: layers,
    prompt,
    why_layer: whyLayer,
    constraints,
    confidence: { overall: overallConfidence, note: '前两大主力场合计权重，越高输出越稳定；低于 60 建议明确主导力场' },
  };
}

// ---------- 进化：日志与反馈（刀3） ----------
function appendLog(file, obj) {
  try { fs.appendFileSync(path.join(LOG_DIR, file), JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'); } catch (e) { /* 静默 */ }
}

// ---------- MCP 协议 ----------
const TOOLS = [
  {
    name: 'civ_blend',
    description: '文明引擎九层推演：输入六大文明力场权重 + 创作命题，输出九层推演结果（含因果链与置信度）、融合 Prompt、Why-Layer 解释、约束条件下的执行建议。适用于品牌视觉/空间设计/产品摄影/内容创作的风格推演与生成。',
    inputSchema: {
      type: 'object',
      properties: {
        weights: { type: 'object', description: '力场权重，如 {"F01":70,"F05":15,"F06":15}。F01平衡共生 F02超越秩序 F03认知解构 F04主体突破 F05生命循环 F06内观超越。自动归一化。' },
        proposition: { type: 'string', description: '创作命题，如"高山古树普洱茶品牌视觉"' },
        use_case: { type: 'string', enum: ['brand_visual', 'space_design', 'product_photo', 'content_creation'], description: '使用场景（默认 brand_visual）' },
        resource_level: { type: 'string', enum: ['low', 'medium', 'high'], description: '资源约束（默认 medium）' },
        goal: { type: 'string', enum: ['conversion', 'aesthetic', 'recognition'], description: '目标（默认 aesthetic）' },
      },
      required: ['weights'],
    },
  },
  {
    name: 'civ_forces',
    description: '查询六大文明力场知识库：任一力场的九层完整定义（L0生存压力→L8视觉参数）、变体与算子。不传 force_id 返回全部六力场概览。',
    inputSchema: {
      type: 'object',
      properties: {
        force_id: { type: 'string', enum: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06'] },
        layer: { type: 'string', enum: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'], description: '只看某一层（可选）' },
      },
    },
  },
  {
    name: 'civ_presets',
    description: '查询内置风格预设（宋式清雅茶/科技极简/先锋潮流等），返回可直接用于 civ_blend 的权重组合。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'civ_feedback',
    description: '反馈回流：用户对推演结果的评分与建议会被记录，用于驱动引擎权重与知识库的下一版进化。',
    inputSchema: {
      type: 'object',
      properties: {
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string', description: '具体反馈：哪里有用/哪里不准/缺什么' },
        context: { type: 'string', description: '当时的输入场景（可选）' },
      },
      required: ['rating'],
    },
  },
];

function callTool(name, args) {
  if (name === 'civ_blend') {
    const r = civBlend(args || {});
    appendLog('usage_log.jsonl', { tool: name, weights: (args || {}).weights, proposition: (args || {}).proposition, ok: !r.error });
    return r;
  }
  if (name === 'civ_forces') {
    const a = args || {};
    let list = FORCES;
    if (a.force_id) list = FORCES.filter(f => f.id === a.force_id);
    if (list.length === 1 && a.layer) {
      return { force: list[0].name, layer: a.layer, content: list[0][a.layer] };
    }
    return {
      forces: list.map(f => ({
        id: f.id, name: f.name, nameEn: f.nameEn,
        L1: f.L1, L6: f.L6, variants: f.variants, operator: f.operator,
        ...(a.layer ? { [a.layer]: f[a.layer] } : {}),
      })),
    };
  }
  if (name === 'civ_presets') return { presets: PRESETS, hint: 'weights 可直接传入 civ_blend' };
  if (name === 'civ_feedback') {
    const a = args || {};
    appendLog('feedback_log.jsonl', { rating: a.rating, comment: a.comment || '', context: a.context || '' });
    return { ok: true, message: '反馈已记录，感谢！这些数据将驱动引擎下一版进化。' };
  }
  return { error: `未知工具: ${name}` };
}

// ---------- stdio 主循环 ----------
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, terminal: false });

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { return; }
  const { id, method, params } = msg;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: (params && params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    });
  } else if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    // 通知无需响应
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  } else if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    let result;
    try { result = callTool(name, args); } catch (e) { result = { error: String(e && e.message || e) }; }
    send({
      jsonrpc: '2.0', id,
      result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
    });
  } else if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
});

rl.on('close', () => process.exit(0));
