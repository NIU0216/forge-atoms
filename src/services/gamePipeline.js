const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');
const { chat, chatJson, hasApiKey } = require('./llm');
const { buildGameHtml, detectGameKind } = require('./gameTemplates');

const AGENTS = [
  { key: 'iris', name: 'Iris', role: '调研', emoji: '🔍' },
  { key: 'emma', name: 'Emma', role: '产品', emoji: '🧭' },
  { key: 'bob', name: 'Bob', role: '架构', emoji: '🏗️' },
  { key: 'alex', name: 'Alex', role: '工程', emoji: '⚙️' },
];

const insertMsg = db.prepare(`
  INSERT INTO agent_messages (id, project_id, agent_key, agent_name, agent_role, content, step_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateStatus = db.prepare(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`);
const upsertArtifact = db.prepare(`
  INSERT INTO artifacts (id, project_id, variant, filename, content, content_type)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(project_id, variant, filename) DO UPDATE SET content = excluded.content, content_type = excluded.content_type
`);

function addMsg(projectId, agent, content, stepOrder) {
  insertMsg.run(uuidv4(), projectId, agent.key, agent.name, agent.role, content, stepOrder);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const KIND_LABEL = { '2048': '2048', snake: '贪吃蛇', tetris: '俄罗斯方块' };

function defaultTheme(kind, project) {
  const label = KIND_LABEL[kind] || kind;
  const palettes = {
    '2048': { bg: '#1a1a2e', accent: '#e94560', panel: '#16213e', text: '#eaeaea' },
    snake: { bg: '#0b132b', accent: '#5bc0be', panel: '#1c2541', text: '#f0f4f8' },
    tetris: { bg: '#111827', accent: '#60a5fa', panel: '#1f2937', text: '#f3f4f6' },
  };
  const p = palettes[kind] || palettes['2048'];
  return {
    title: project.title || label,
    subtitle: `可玩的 HTML5 ${label}`,
    flavor: (project.idea || '').slice(0, 80),
    ...p,
  };
}

async function enrichTheme(project, kind) {
  const base = defaultTheme(kind, project);
  if (!hasApiKey()) return base;
  try {
    const data = await chatJson({
      temperature: 0.7,
      system:
        '你是游戏主题设计师。为浏览器小游戏输出 JSON：{"title":"游戏标题","subtitle":"一句话副标题","flavor":"氛围短句","bg":"#rrggbb","accent":"#rrggbb","panel":"#rrggbb","text":"#rrggbb"}。颜色需深色背景可读。只用中文文案。',
      user: `游戏类型：${KIND_LABEL[kind] || kind}\n项目标题：${project.title}\n用户想法：${project.idea}\n请输出主题 JSON。`,
    });
    return {
      title: data.title || base.title,
      subtitle: data.subtitle || base.subtitle,
      flavor: data.flavor || base.flavor,
      bg: /^#[0-9a-fA-F]{6}$/.test(data.bg) ? data.bg : base.bg,
      accent: /^#[0-9a-fA-F]{6}$/.test(data.accent) ? data.accent : base.accent,
      panel: /^#[0-9a-fA-F]{6}$/.test(data.panel) ? data.panel : base.panel,
      text: /^#[0-9a-fA-F]{6}$/.test(data.text) ? data.text : base.text,
    };
  } catch (e) {
    console.error('game theme LLM fallback:', e.message);
    return base;
  }
}

function saveArtifacts(projectId, variant, files) {
  const dir = path.join(DATA_DIR, 'projects', projectId, variant);
  fs.mkdirSync(dir, { recursive: true });
  const tx = db.transaction(() => {
    for (const f of files) {
      upsertArtifact.run(uuidv4(), projectId, variant, f.filename, f.content, f.content_type || 'text/html');
      if (!String(f.content).startsWith('__FILE__:')) {
        fs.writeFileSync(path.join(dir, f.filename), f.content, 'utf8');
      }
    }
  });
  tx();
}

async function runGameBuild(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { ok: false, error: 'not_found' };

  db.prepare('DELETE FROM agent_messages WHERE project_id = ?').run(projectId);
  updateStatus.run('researching', projectId);

  const kind = detectGameKind(project.title, project.idea);
  const label = KIND_LABEL[kind] || kind;

  let research = [
    `已识别交付物为「可玩浏览器小游戏」。`,
    ``,
    `• 游戏类型：${label}`,
    `• 交互：键盘方向键 + 触屏滑动`,
    `• 工程策略：核心玩法使用本地可信模板，保证可玩；主题皮肤可接 DeepSeek 润色`,
    `• 原始想法：${(project.idea || '').slice(0, 160)}`,
  ].join('\n');

  if (hasApiKey()) {
    try {
      research = await chat({
        temperature: 0.5,
        system: '你是调研专家 Iris。用中文简短说明该小游戏的受众、玩法卖点与皮肤方向（纯文本，200字内）。',
        user: `标题：${project.title}\n想法：${project.idea}\n判定游戏类型：${label}`,
      });
    } catch (e) {
      console.error('game iris fallback:', e.message);
    }
  }
  addMsg(projectId, AGENTS[0], research, 1);
  updateStatus.run('building', projectId);
  await sleep(300);

  const theme = await enrichTheme(project, kind);

  addMsg(
    projectId,
    AGENTS[1],
    [
      `产品方案：`,
      `• 主玩法：${label}`,
      `• 标题：${theme.title}`,
      `• 副标题：${theme.subtitle}`,
      `• 氛围：${theme.flavor || '—'}`,
      `• 目标：单页即可游玩，含分数与重新开始`,
    ].join('\n'),
    2
  );

  addMsg(
    projectId,
    AGENTS[2],
    [
      `架构：`,
      `• 单文件 HTML5（Canvas / DOM）`,
      `• 输入：键盘 + touch swipe`,
      `• 产物：Variant A / index.html，可 iframe 预览与 ZIP 导出`,
      `• 主题色：bg ${theme.bg} / accent ${theme.accent}`,
    ].join('\n'),
    3
  );

  const html = buildGameHtml(kind, theme);
  const meta = JSON.stringify({ kind, theme, engine: 'local-template' }, null, 2);

  saveArtifacts(projectId, 'A', [
    { filename: 'index.html', content: html, content_type: 'text/html; charset=utf-8' },
    { filename: 'game.json', content: meta, content_type: 'application/json' },
  ]);

  addMsg(
    projectId,
    AGENTS[3],
    [
      `工程交付完成 ✅`,
      ``,
      `已生成可玩 ${label}（${html.length} 字节 HTML）。`,
      `请在右侧预览中点击游戏区域后用方向键游玩；也可导出 ZIP。`,
      `竞速 A/B 对小游戏不适用（玩法模板固定，皮肤已注入）。`,
    ].join('\n'),
    4
  );

  db.prepare(
    `UPDATE projects SET status = 'ready', selected_variant = 'A', updated_at = datetime('now') WHERE id = ?`
  ).run(projectId);

  return { ok: true, kind };
}

module.exports = { runGameBuild };
