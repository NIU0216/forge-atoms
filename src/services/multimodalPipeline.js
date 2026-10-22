const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');

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

const FALLBACK_TITLE = '多模态模型API额度用尽，请及时充值';
const FALLBACK_HELP =
  '当前 Demo 支持网站 / PPT / 小游戏；视频与音频生成需充值多模态额度后再试。';

function addMsg(projectId, agent, content, stepOrder) {
  insertMsg.run(uuidv4(), projectId, agent.key, agent.name, agent.role, content, stepOrder);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildBlockedHtml(project) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>额度不足 · ForgeAtoms</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    background:linear-gradient(160deg,#1a0a0a,#2a1212 40%,#0f0f14);color:#f5e6e6;}
  .card{max-width:440px;margin:24px;padding:28px 26px;border-radius:18px;
    background:rgba(40,16,16,.92);border:1px solid rgba(255,120,120,.35);
    box-shadow:0 20px 60px rgba(0,0,0,.45);text-align:center;}
  .icon{font-size:2.4rem;margin-bottom:10px}
  h1{margin:0 0 12px;font-size:1.25rem;line-height:1.45;color:#ffb4b4}
  p{margin:0 0 10px;opacity:.88;line-height:1.55;font-size:.95rem}
  .meta{margin-top:16px;font-size:.78rem;opacity:.55}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">🎬🔇</div>
    <h1>${FALLBACK_TITLE}</h1>
    <p>${FALLBACK_HELP}</p>
    <p class="meta">请求：${String(project.title || '').replace(/</g,'&lt;')} — 未调用任何视频/音频 API</p>
  </div>
</body>
</html>`;
}

async function runMultimodalBuild(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { ok: false, error: 'not_found' };

  // Do NOT call any video/audio APIs.
  db.prepare('DELETE FROM agent_messages WHERE project_id = ?').run(projectId);
  updateStatus.run('researching', projectId);
  await sleep(250);

  addMsg(
    projectId,
    AGENTS[0],
    `需求识别为「视频 / 音频」多模态生成。\n原始想法：${(project.idea || '').slice(0, 200)}\n正在检查多模态模型额度…`,
    1
  );
  updateStatus.run('building', projectId);
  await sleep(350);

  addMsg(
    projectId,
    AGENTS[1],
    `产品侧：视频/音频成片不在当前 Demo 免费能力内。建议改做网站着陆页、PPT 或可玩小游戏。`,
    2
  );
  addMsg(
    projectId,
    AGENTS[2],
    `架构侧：未发起任何视频/音频 API 调用。写入额度不足兜底页 blocked.html / index.html。`,
    3
  );

  const html = buildBlockedHtml(project);
  const dir = path.join(DATA_DIR, 'projects', projectId, 'A');
  fs.mkdirSync(dir, { recursive: true });

  const files = [
    { filename: 'blocked.html', content: html, content_type: 'text/html; charset=utf-8' },
    { filename: 'index.html', content: html, content_type: 'text/html; charset=utf-8' },
    {
      filename: 'status.json',
      content: JSON.stringify(
        { blocked: true, reason: 'multimodal_quota_exhausted', message: FALLBACK_TITLE, help: FALLBACK_HELP },
        null,
        2
      ),
      content_type: 'application/json',
    },
  ];

  const tx = db.transaction(() => {
    for (const f of files) {
      upsertArtifact.run(uuidv4(), projectId, 'A', f.filename, f.content, f.content_type);
      fs.writeFileSync(path.join(dir, f.filename), f.content, 'utf8');
    }
  });
  tx();

  addMsg(
    projectId,
    AGENTS[3],
    `${FALLBACK_TITLE}\n${FALLBACK_HELP}`,
    4
  );

  db.prepare(
    `UPDATE projects SET status = 'ready', selected_variant = 'A', updated_at = datetime('now') WHERE id = ?`
  ).run(projectId);

  return { ok: true, blocked: true };
}

module.exports = { runMultimodalBuild, FALLBACK_TITLE, FALLBACK_HELP };
