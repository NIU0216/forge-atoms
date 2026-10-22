const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');
const { parseIdea } = require('./ideaParser');
const { generateLanding, generateAboutPage } = require('./pageGenerator');
const { chat, chatJson, hasApiKey } = require('./llm');
const { runPptBuild } = require('./pptPipeline');
const { runGameBuild } = require('./gamePipeline');
const { runMultimodalBuild } = require('./multimodalPipeline');
const { runImageBuild } = require('./imagePipeline');
const { detectDeliverable } = require('./deliverable');

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

const running = new Set();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildMessages(parsed, project) {
  return [
    {
      agent: AGENTS[0],
      content: [
        `已完成对「${parsed.title}」的快速调研。`,
        ``,
        `• 品类判断：${parsed.category}`,
        `• 语气风格：${parsed.tone}`,
        `• 目标用户：${parsed.audience}`,
        `• 关键词：${parsed.keywords.slice(0, 6).join('、') || '（从描述中提炼中）'}`,
        ``,
        `竞品机会：差异化卖点可落在「${parsed.features[0].title}」，避免纯功能堆砌。`,
      ].join('\n'),
    },
    {
      agent: AGENTS[1],
      content: [
        `产品方案已对齐：`,
        ``,
        `1. 价值主张：${parsed.tagline}`,
        `2. 首屏 CTA：${parsed.cta}`,
        `3. 核心能力（MVP）：`,
        ...parsed.features.map((f, i) => `   ${i + 1}) ${f.title} — ${f.desc}`),
        ``,
        `建议首发形态：单页着陆 + 关于页，先验证转化再扩功能。`,
      ].join('\n'),
    },
    {
      agent: AGENTS[2],
      content: [
        `架构草案：`,
        ``,
        `• 前端：静态 HTML/CSS（可导出 ZIP），预览由 ForgeAtoms 托管`,
        `• 结构：index.html（主着陆）+ about.html（SEO / 关于）`,
        `• 设计系统：${parsed.tone} 色板，强调色驱动 CTA`,
        `• 数据：项目元数据与产物持久化在 SQLite / 文件系统`,
        ``,
        `后续可接真实后端 API 与用户体系；当前 Demo 聚焦「想法 → 可预览页面」。`,
      ].join('\n'),
    },
    {
      agent: AGENTS[3],
      content: [
        `工程交付完成 ✅`,
        ``,
        `已生成着陆页 Variant A，并写入项目产物目录。`,
        `预览已就绪，可在右侧查看；也可启动「竞速生成」产出 A/B 两版对比，或导出 ZIP。`,
        ``,
        `原始想法摘要：${(project.idea || '').slice(0, 100)}${(project.idea || '').length > 100 ? '…' : ''}`,
      ].join('\n'),
    },
  ];
}

function writeArtifactsToDisk(projectId, variant, files) {
  const dir = path.join(DATA_DIR, 'projects', projectId, variant);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    if (String(f.content).startsWith('__FILE__:')) continue;
    fs.writeFileSync(path.join(dir, f.filename), f.content, 'utf8');
  }
}

function saveArtifacts(projectId, variant, files) {
  const tx = db.transaction(() => {
    for (const f of files) {
      upsertArtifact.run(uuidv4(), projectId, variant, f.filename, f.content, f.content_type || 'text/html');
    }
  });
  tx();
  writeArtifactsToDisk(projectId, variant, files);
}

/**
 * Try DeepSeek to enrich copy for web landing; fall back to heuristic parseIdea.
 */
async function enrichWebWithLlm(project) {
  if (!hasApiKey()) return null;
  try {
    const data = await chatJson({
      temperature: 0.6,
      system:
        '你是产品文案专家。根据用户想法输出着陆页文案 JSON：{"title":"...","tagline":"...","cta":"...","audience":"...","features":[{"title":"...","desc":"..."},{"title":"...","desc":"..."},{"title":"...","desc":"..."}],"keywords":["..."]}',
      user: `标题：${project.title}\n想法：${project.idea}\n请用中文输出 JSON。`,
    });
    return data;
  } catch (e) {
    console.error('enrichWebWithLlm fallback:', e.message);
    return null;
  }
}

async function runWebBuild(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { ok: false, error: 'not_found' };

  db.prepare('DELETE FROM agent_messages WHERE project_id = ?').run(projectId);
  updateStatus.run('researching', projectId);

  let usedLlm = false;
  let llmCopy = null;
  if (hasApiKey()) {
    try {
      const research = await chat({
        temperature: 0.5,
        system: '你是调研专家 Iris。用中文输出简短产品调研（纯文本条目），200–400 字。',
        user: `标题：${project.title}\n想法：${project.idea}`,
      });
      insertMsg.run(uuidv4(), projectId, AGENTS[0].key, AGENTS[0].name, AGENTS[0].role, research, 1);
      updateStatus.run('building', projectId);
      llmCopy = await enrichWebWithLlm(project);
      usedLlm = true;
    } catch (e) {
      console.error('LLM web path falling back to heuristic:', e.message);
      usedLlm = false;
    }
  }

  const parsed = parseIdea(project.idea, project.title);
  if (llmCopy) {
    if (llmCopy.tagline) parsed.tagline = llmCopy.tagline;
    if (llmCopy.cta) parsed.cta = llmCopy.cta;
    if (llmCopy.audience) parsed.audience = llmCopy.audience;
    if (Array.isArray(llmCopy.features) && llmCopy.features.length) {
      parsed.features = llmCopy.features.slice(0, 6).map((f) => ({
        title: f.title || '能力',
        desc: f.desc || '',
      }));
    }
    if (Array.isArray(llmCopy.keywords)) parsed.keywords = llmCopy.keywords;
  }

  // Patch project for generators that call parseIdea internally via title/idea
  // We inject by temporarily wrapping — generators use parseIdea(project.idea, project.title).
  // So write a brief product note into messages and still use generateLanding with enriched fields
  // via a shadow: store enriched JSON artifact and regenerate using custom path.
  // Simplest: monkey-patch by appending structured hint into idea for parseIdea keywords,
  // OR generate HTML ourselves. For reliability, call generateLanding then do string replace on tagline if needed.
  // Better: pass enriched via mutating a temp idea isn't great. We'll generate with parseIdea then
  // if llmCopy, rebuild using pageGenerator's escape by writing custom landing through generateLanding
  // after stuffing features into a synthetic idea string.

  if (!usedLlm || !llmCopy) {
    const steps = buildMessages(parsed, project);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // skip iris if we already inserted research? only when usedLlm false
      if (i === 1) updateStatus.run('building', projectId);
      await sleep(400 + i * 200);
      insertMsg.run(
        uuidv4(),
        projectId,
        step.agent.key,
        step.agent.name,
        step.agent.role,
        step.content,
        i + 1
      );
    }
  } else {
    insertMsg.run(
      uuidv4(),
      projectId,
      AGENTS[1].key,
      AGENTS[1].name,
      AGENTS[1].role,
      [
        '产品方案（DeepSeek）：',
        `价值主张：${parsed.tagline}`,
        `CTA：${parsed.cta}`,
        `受众：${parsed.audience}`,
        ...parsed.features.map((f, i) => `${i + 1}) ${f.title} — ${f.desc}`),
      ].join('\n'),
      2
    );
    insertMsg.run(
      uuidv4(),
      projectId,
      AGENTS[2].key,
      AGENTS[2].name,
      AGENTS[2].role,
      '架构：静态 HTML/CSS 着陆页 + 关于页，产物落盘 SQLite/文件系统，可由 ForgeAtoms 预览与 ZIP 导出。',
      3
    );
  }

  // Feed enriched copy into generator by overriding title/idea lightly
  const projectForGen = {
    ...project,
    title: llmCopy?.title || project.title,
    idea: [
      project.idea,
      parsed.tagline ? `标语：${parsed.tagline}` : '',
      parsed.cta ? `行动号召：${parsed.cta}` : '',
      parsed.audience ? `受众：${parsed.audience}` : '',
      ...parsed.features.map((f) => `${f.title}：${f.desc}`),
    ]
      .filter(Boolean)
      .join('\n'),
  };

  const indexA = generateLanding(projectForGen, 'A');
  const about = generateAboutPage(projectForGen);
  saveArtifacts(projectId, 'A', [
    { filename: 'index.html', content: indexA, content_type: 'text/html' },
    { filename: 'about.html', content: about, content_type: 'text/html' },
  ]);

  if (usedLlm) {
    insertMsg.run(
      uuidv4(),
      projectId,
      AGENTS[3].key,
      AGENTS[3].name,
      AGENTS[3].role,
      '工程交付完成 ✅（DeepSeek 文案 + 着陆页生成）。可预览、竞速 A/B 或导出 ZIP。',
      4
    );
  }

  db.prepare(
    `UPDATE projects SET status = 'ready', selected_variant = 'A', updated_at = datetime('now') WHERE id = ?`
  ).run(projectId);
  return { ok: true };
}

async function runBuild(projectId) {
  if (running.has(projectId)) return { ok: false, error: 'already_running' };
  running.add(projectId);
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return { ok: false, error: 'not_found' };

    let deliverable = project.deliverable || 'web';
    if (!deliverable || deliverable === 'auto') {
      deliverable = detectDeliverable(project.title, project.idea, 'auto');
      db.prepare(`UPDATE projects SET deliverable = ? WHERE id = ?`).run(deliverable, projectId);
    }

    if (deliverable === 'multimodal') {
      return await runMultimodalBuild(projectId);
    }
    if (deliverable === 'game') {
      return await runGameBuild(projectId);
    }
    if (deliverable === 'ppt') {
      return await runPptBuild(projectId);
    }
    if (deliverable === 'image') {
      return await runImageBuild(projectId);
    }
    return await runWebBuild(projectId);
  } catch (err) {
    console.error('runBuild error', err && err.message ? err.message : err);
    updateStatus.run('draft', projectId);
    return { ok: false, error: String(err.message || err) };
  } finally {
    running.delete(projectId);
  }
}

async function runRace(projectId) {
  if (running.has(projectId)) return { ok: false, error: 'already_running' };
  running.add(projectId);
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return { ok: false, error: 'not_found' };
    if (project.status !== 'ready') return { ok: false, error: 'not_ready' };

    const deliv = project.deliverable || 'web';
    if (deliv === 'ppt' || deliv === 'game' || deliv === 'multimodal' || deliv === 'image') {
      const tip =
        deliv === 'ppt'
          ? 'PPT 交付物暂不支持竞速 A/B。如需另一风格，请修改想法描述后「重新构建」。'
          : deliv === 'game'
            ? '小游戏暂不支持竞速 A/B（玩法模板固定）。可修改主题描述后重新构建以换皮肤。'
            : deliv === 'image'
              ? '像素海报暂不支持竞速 A/B。可修改主题后重新构建以换素材拼贴。'
              : '视频/音频项目无竞速对比。请充值多模态额度，或改做网站 / PPT / 小游戏。';
      insertMsg.run(uuidv4(), projectId, 'emma', 'Emma', '产品', tip, 110);
      return { ok: false, error: 'race_disabled_for_' + deliv };
    }

    updateStatus.run('building', projectId);
    insertMsg.run(
      uuidv4(),
      projectId,
      'alex',
      'Alex',
      '工程',
      '竞速模式启动：正在并行生成 Variant A（经典英雄区）与 Variant B（分割布局 + 社交证明）两套着陆设计…',
      100
    );
    await sleep(600);

    const about = generateAboutPage(project);
    const indexA = generateLanding(project, 'A');
    const indexB = generateLanding(project, 'B');

    saveArtifacts(projectId, 'A', [
      { filename: 'index.html', content: indexA, content_type: 'text/html' },
      { filename: 'about.html', content: about, content_type: 'text/html' },
    ]);
    saveArtifacts(projectId, 'B', [
      { filename: 'index.html', content: indexB, content_type: 'text/html' },
      { filename: 'about.html', content: about, content_type: 'text/html' },
    ]);

    insertMsg.run(
      uuidv4(),
      projectId,
      'emma',
      'Emma',
      '产品',
      'A/B 两版已就绪。左侧为 Variant A（聚焦清晰 CTA），右侧为 Variant B（更强叙事与信任背书）。请并排对比后点「选用此版本」。',
      101
    );

    db.prepare(`UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?`).run(projectId);
    return { ok: true };
  } catch (err) {
    console.error('runRace error', err);
    updateStatus.run('ready', projectId);
    return { ok: false, error: String(err.message || err) };
  } finally {
    running.delete(projectId);
  }
}

function isRunning(projectId) {
  return running.has(projectId);
}

module.exports = { runBuild, runRace, isRunning, AGENTS };
