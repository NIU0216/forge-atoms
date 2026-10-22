const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { db, DATA_DIR } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { runBuild, runRace, isRunning } = require('../services/agentPipeline');
const { generateReadme } = require('../services/pageGenerator');
const { detectDeliverable } = require('../services/deliverable');

const router = express.Router();
router.use(requireAuth);

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function resolveArtifactPath(projectId, variant, filename, content) {
  if (content && String(content).startsWith('__FILE__:')) {
    const rel = String(content).slice('__FILE__:'.length);
    return path.join(DATA_DIR, rel);
  }
  return path.join(DATA_DIR, 'projects', projectId, variant, filename);
}

router.get('/dashboard', (req, res) => {
  const projects = db
    .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.id);
  res.renderPage('dashboard', { projects });
});

router.get('/projects/new', (req, res) => {
  res.renderPage('project-new', { error: null, form: {} });
});

router.post('/projects', (req, res) => {
  const title = String(req.body.title || '').trim();
  const idea = String(req.body.idea || '').trim();
  const deliverableChoice = String(req.body.deliverable || 'auto').trim();
  if (!title || !idea) {
    return res.status(400).renderPage('project-new', {
      error: '请填写标题和想法描述',
      form: { title, idea, deliverable: deliverableChoice },
    });
  }
  const deliverable = detectDeliverable(title, idea, deliverableChoice);
  const id = uuidv4();
  db.prepare(
    'INSERT INTO projects (id, user_id, title, idea, status, deliverable) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id, title, idea, 'draft', deliverable);
  res.redirect(`/projects/${id}`);
});

router.get('/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).renderPage('error', { code: 404, message: '项目不存在' });

  const messages = db
    .prepare('SELECT * FROM agent_messages WHERE project_id = ? ORDER BY step_order ASC, created_at ASC')
    .all(project.id);
  const variants = db
    .prepare(`SELECT DISTINCT variant FROM artifacts WHERE project_id = ? ORDER BY variant`)
    .all(project.id)
    .map((r) => r.variant);
  const hasB = variants.includes('B');

  let outline = null;
  const outlineArt = db
    .prepare(`SELECT content FROM artifacts WHERE project_id = ? AND variant = ? AND filename = 'outline.json'`)
    .get(project.id, project.selected_variant || 'A');
  if (outlineArt) {
    try {
      outline = JSON.parse(outlineArt.content);
    } catch (_) {
      outline = null;
    }
  }

  const hasPptx = !!db
    .prepare(
      `SELECT id FROM artifacts WHERE project_id = ? AND filename = 'presentation.pptx' LIMIT 1`
    )
    .get(project.id);
  const hasPoster = !!db
    .prepare(
      `SELECT id FROM artifacts WHERE project_id = ? AND filename = 'poster.png' LIMIT 1`
    )
    .get(project.id);

  res.renderPage('project', {
    project,
    messages,
    variants,
    hasB,
    running: isRunning(project.id),
    outline,
    hasPptx,
    hasPoster,
  });
});

router.post('/projects/:id/build', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'not_found' });
  runBuild(project.id);
  if (req.accepts('html') && !req.xhr && req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect(`/projects/${project.id}`);
  }
  res.json({ ok: true, status: 'started' });
});

router.post('/projects/:id/race', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'not_found' });
  const resultPromise = runRace(project.id);
  // don't await long; race returns quickly for ppt disable
  resultPromise.catch(() => {});
  res.json({ ok: true, status: 'started' });
});

router.post('/projects/:id/select-variant', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'not_found' });
  const variant = String(req.body.variant || 'A').toUpperCase();
  if (!['A', 'B'].includes(variant)) return res.status(400).json({ error: 'invalid_variant' });
  const art = db.prepare('SELECT id FROM artifacts WHERE project_id = ? AND variant = ? LIMIT 1').get(project.id, variant);
  if (!art) return res.status(400).json({ error: 'variant_missing' });
  db.prepare(`UPDATE projects SET selected_variant = ?, updated_at = datetime('now') WHERE id = ?`).run(variant, project.id);
  res.json({ ok: true, selected_variant: variant });
});

router.get('/projects/:id/status', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'not_found' });
  const messages = db
    .prepare('SELECT id, agent_key, agent_name, agent_role, content, step_order, created_at FROM agent_messages WHERE project_id = ? ORDER BY step_order ASC')
    .all(project.id);
  const variants = db
    .prepare(`SELECT DISTINCT variant FROM artifacts WHERE project_id = ?`)
    .all(project.id)
    .map((r) => r.variant);

  let outline = null;
  const outlineArt = db
    .prepare(`SELECT content FROM artifacts WHERE project_id = ? AND filename = 'outline.json' ORDER BY created_at DESC LIMIT 1`)
    .get(project.id);
  if (outlineArt) {
    try {
      outline = JSON.parse(outlineArt.content);
    } catch (_) {}
  }
  const hasPptx = !!db
    .prepare(`SELECT id FROM artifacts WHERE project_id = ? AND filename = 'presentation.pptx' LIMIT 1`)
    .get(project.id);
  const hasPoster = !!db
    .prepare(`SELECT id FROM artifacts WHERE project_id = ? AND filename = 'poster.png' LIMIT 1`)
    .get(project.id);

  res.json({
    id: project.id,
    status: project.status,
    selected_variant: project.selected_variant,
    deliverable: project.deliverable || 'web',
    running: isRunning(project.id),
    messages,
    variants,
    outline,
    hasPptx,
    hasPoster,
  });
});

router.get('/projects/:id/download-pptx', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).send('Not found');
  const variant = String(req.query.variant || project.selected_variant || 'A').toUpperCase();
  const art = db
    .prepare(
      `SELECT filename, content, content_type FROM artifacts WHERE project_id = ? AND variant = ? AND filename = 'presentation.pptx'`
    )
    .get(project.id, variant);
  if (!art) return res.status(404).send('PPTX not found');

  const filePath = resolveArtifactPath(project.id, variant, art.filename, art.content);
  if (!fs.existsSync(filePath)) return res.status(404).send('PPTX file missing on disk');

  const asciiName = `forgeatoms-${project.id.slice(0, 8)}.pptx`;
  const utf8Name = encodeURIComponent((project.title || 'presentation').replace(/[/\\?%*:|"<>]/g, '_') + '.pptx');
  res.setHeader('Content-Type', PPTX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);
  fs.createReadStream(filePath).pipe(res);
});


router.get('/projects/:id/download-poster', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).send('Not found');
  const variant = String(req.query.variant || project.selected_variant || 'A').toUpperCase();
  const art = db
    .prepare(
      `SELECT filename, content, content_type FROM artifacts WHERE project_id = ? AND variant = ? AND filename = 'poster.png'`
    )
    .get(project.id, variant);
  if (!art) return res.status(404).send('Poster not found');

  const filePath = resolveArtifactPath(project.id, variant, art.filename, art.content);
  if (!fs.existsSync(filePath)) return res.status(404).send('Poster file missing on disk');

  res.setHeader('Content-Type', 'image/png');
  if (req.query.inline) {
    res.setHeader('Content-Disposition', 'inline; filename="poster.png"');
  } else {
    const asciiName = `forgeatoms-${project.id.slice(0, 8)}-poster.png`;
    const utf8Name = encodeURIComponent((project.title || 'poster').replace(/[/\\?%*:|"<>]/g, '_') + '-poster.png');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);
  }
  fs.createReadStream(filePath).pipe(res);
});

router.get('/projects/:id/export', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).send('Not found');
  const variant = String(req.query.variant || project.selected_variant || 'A').toUpperCase();
  const arts = db
    .prepare('SELECT filename, content, content_type FROM artifacts WHERE project_id = ? AND variant = ?')
    .all(project.id, variant);
  if (!arts.length) return res.status(404).send('No artifacts for this variant');

  const asciiName = 'forgeatoms-' + (project.id || 'project').slice(0, 8) + '-variant-' + variant + '.zip';
  const utf8Name = encodeURIComponent((project.title || 'project').replace(/[/\\?%*:|"<>]/g, '_') + '-variant-' + variant + '.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error(err);
    try {
      res.status(500).end();
    } catch (_) {}
  });
  archive.pipe(res);

  for (const a of arts) {
    if (String(a.content).startsWith('__FILE__:')) {
      const fp = resolveArtifactPath(project.id, variant, a.filename, a.content);
      if (fs.existsSync(fp)) archive.file(fp, { name: a.filename });
    } else {
      archive.append(a.content, { name: a.filename });
    }
  }

  const deliv = project.deliverable || 'web';
  if (deliv === 'ppt') {
    archive.append(
      [
        `# ${project.title}`,
        '',
        '由 ForgeAtoms + DeepSeek 多智能体生成的 PPT 交付包。',
        '',
        '- `presentation.pptx` — 可下载打开的 PowerPoint',
        '- `poster.png` — 像素素材拼贴封面',
        '- `outline.json` — 幻灯片大纲',
        '- `design.json` — 设计方向',
        '- `collage.json` — 素材选用清单',
        '',
        `想法：${project.idea}`,
      ].join('\n'),
      { name: 'README.md' }
    );
  } else if (deliv === 'game') {
    archive.append(
      [
        `# ${project.title}`,
        '',
        'ForgeAtoms 生成的可玩 HTML5 小游戏。',
        '',
        '- `index.html` — 打开即可游玩（键盘 / 触屏）',
        '- `game.json` — 游戏类型与主题元数据',
        '',
        '用浏览器直接打开 index.html，或 `npx serve .`。',
        '',
        `想法：${project.idea}`,
      ].join('\n'),
      { name: 'README.md' }
    );
  } else if (deliv === 'image') {
    archive.append(
      [
        `# ${project.title}`,
        '',
        'ForgeAtoms 像素素材拼贴海报。',
        '',
        '- `poster.png` — 主题拼贴图',
        '- `index.html` — 预览页',
        '- `collage.json` — 选用素材清单',
        '',
        `想法：${project.idea}`,
      ].join('\n'),
      { name: 'README.md' }
    );
  } else if (deliv === 'multimodal') {
    archive.append(
      [
        `# ${project.title}`,
        '',
        '多模态模型API额度用尽，请及时充值',
        '',
        '当前 Demo 支持网站 / PPT / 小游戏；视频与音频生成需充值多模态额度后再试。',
        '',
        '- `blocked.html` / `index.html` — 额度不足说明页',
        '',
        `想法：${project.idea}`,
      ].join('\n'),
      { name: 'README.md' }
    );
  } else {
    archive.append(generateReadme(project, variant), { name: 'README.md' });
  }
  archive.finalize();
});

router.post('/projects/:id/delete', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).redirect('/dashboard');
  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
  res.redirect('/dashboard');
});

module.exports = router;
