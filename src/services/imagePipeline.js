const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');
const { hasApiKey } = require('./llm');
const { buildThemedCollage } = require('./assetLibrary');

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

function relPathFor(projectId, variant, filename) {
  return path.join('projects', projectId, variant, filename);
}

function previewHtml(project, posterUrl, theme, assets) {
  const names = (assets || []).map((a) => a.name).join(' · ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(project.title)} · 像素海报</title>
<style>
  html,body{margin:0;background:#1a2818;color:#f6ecd0;font-family:"Microsoft YaHei",sans-serif;}
  .wrap{max-width:960px;margin:0 auto;padding:24px;}
  h1{font-size:1.4rem;margin:0 0 .5rem;}
  .meta{color:#c8d4a8;font-size:.9rem;margin-bottom:1rem;}
  img{width:100%;height:auto;image-rendering:pixelated;border:4px solid #5a4030;border-radius:4px;background:#f6ecd0;}
  .tags{margin-top:1rem;font-size:.85rem;color:#a8b888;}
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(theme.title || project.title)}</h1>
  <p class="meta">情绪：${escapeHtml(theme.mood || 'cozy')} · 像素素材拼贴</p>
  <img src="${posterUrl}" alt="poster"/>
  <p class="tags">素材：${escapeHtml(names)}</p>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function runImageBuild(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { ok: false, error: 'not_found' };

  db.prepare('DELETE FROM agent_messages WHERE project_id = ?').run(projectId);
  updateStatus.run('researching', projectId);

  try {
    addMsg(
      projectId,
      AGENTS[0],
      hasApiKey()
        ? '正在理解主题元素，并从像素素材库检索人物 / 树木 / 花草 / 水果 / 美食 / 场景…'
        : '（无 API Key）使用启发式关键词匹配像素素材库…',
      1
    );
    updateStatus.run('building', projectId);

    const variant = 'A';
    const absDir = path.join(DATA_DIR, 'projects', projectId, variant);
    fs.mkdirSync(absDir, { recursive: true });
    const posterName = 'poster.png';
    const absPoster = path.join(absDir, posterName);
    const relPoster = relPathFor(projectId, variant, posterName);

    const { theme, assets } = await buildThemedCollage(project.title, project.idea, absPoster, {
      width: 1280,
      height: 720,
    });

    addMsg(
      projectId,
      AGENTS[1],
      [
        `主题解析：${theme.title}`,
        `情绪：${theme.mood}`,
        `关键词：${(theme.keywords || []).slice(0, 10).join('、')}`,
      ].join('\n'),
      2
    );
    addMsg(
      projectId,
      AGENTS[2],
      [
        '拼贴布局：羊皮纸面板 + 场景横幅 + 素材网格',
        `选用素材（${assets.length}）：`,
        ...assets.map((a) => `• [${a.category}] ${a.name}`),
      ].join('\n'),
      3
    );

    const indexHtml = previewHtml(project, posterName, theme, assets);
    fs.writeFileSync(path.join(absDir, 'index.html'), indexHtml, 'utf8');
    const meta = JSON.stringify({ theme, assets: assets.map((a) => ({ id: a.id, name: a.name, category: a.category })) }, null, 2);
    fs.writeFileSync(path.join(absDir, 'collage.json'), meta, 'utf8');

    const tx = db.transaction(() => {
      upsertArtifact.run(uuidv4(), projectId, variant, posterName, `__FILE__:${relPoster}`, 'image/png');
      upsertArtifact.run(uuidv4(), projectId, variant, 'index.html', indexHtml, 'text/html');
      upsertArtifact.run(uuidv4(), projectId, variant, 'collage.json', meta, 'application/json');
    });
    tx();

    const stat = fs.statSync(absPoster);
    addMsg(
      projectId,
      AGENTS[3],
      `像素海报已生成 ✅\n文件：poster.png（${Math.round(stat.size / 1024)} KB）\n可在预览区查看，或导出 ZIP。`,
      4
    );

    db.prepare(
      `UPDATE projects SET status = 'ready', selected_variant = 'A', updated_at = datetime('now') WHERE id = ?`
    ).run(projectId);

    return { ok: true, path: absPoster, size: stat.size };
  } catch (err) {
    console.error('runImageBuild error', err && err.message ? err.message : err);
    addMsg(projectId, AGENTS[3], `图片构建失败：${err.message || String(err)}`, 99);
    updateStatus.run('draft', projectId);
    return { ok: false, error: String(err.message || err) };
  }
}

module.exports = { runImageBuild, AGENTS };
