const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('../db');
const { chat, chatJson, hasApiKey } = require('./llm');
const { buildPptx } = require('./pptxBuilder');
const { buildThemedCollage, absAsset } = require('./assetLibrary');

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

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function addMsg(projectId, agent, content, stepOrder) {
  insertMsg.run(uuidv4(), projectId, agent.key, agent.name, agent.role, content, stepOrder);
}

function relPathFor(projectId, variant, filename) {
  return path.join('projects', projectId, variant, filename);
}

async function runPptBuild(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return { ok: false, error: 'not_found' };

  if (!hasApiKey()) {
    addMsg(
      projectId,
      AGENTS[3],
      '无法生成 PPT：环境未配置 DEEPSEEK_API_KEY。请配置后重新构建。',
      1
    );
    updateStatus.run('draft', projectId);
    return { ok: false, error: 'missing_api_key' };
  }

  db.prepare('DELETE FROM agent_messages WHERE project_id = ?').run(projectId);
  updateStatus.run('researching', projectId);

  try {
    // 1) Iris — research brief
    const research = await chat({
      temperature: 0.6,
      system:
        '你是调研专家 Iris。用中文输出结构化调研简报（纯文本，可用条目），面向演示文稿内容策划。不要输出 JSON。',
      user: [
        `项目标题：${project.title}`,
        `用户需求：${project.idea}`,
        '',
        '请输出调研简报，覆盖：主题背景、关键时间线/节点、受众情绪、必讲知识点、可引用的文化记忆点、注意事项（事实与情感平衡）。控制在 600–900 字。',
      ].join('\n'),
    });
    addMsg(projectId, AGENTS[0], research, 1);
    updateStatus.run('building', projectId);

    // 2) Emma — slide outline JSON
    const outline = await chatJson({
      temperature: 0.55,
      system:
        '你是产品策划 Emma。根据调研简报设计中文 PPT 大纲。输出 JSON：{"title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"notes":"..."}]}。slides 数量 8–12。每页 3–6 条 bullets，简洁有画面感，适合口述。title/subtitle 用中文。',
      user: [
        `标题：${project.title}`,
        `需求：${project.idea}`,
        '',
        '调研简报：',
        research,
        '',
        '请生成完整大纲 JSON。回忆录类主题请覆盖起源、经典节目、名场面、时代意义与个人情怀等维度。',
      ].join('\n'),
    });

    if (!outline.slides || !Array.isArray(outline.slides) || outline.slides.length < 5) {
      throw new Error('大纲 slides 数量不足');
    }
    outline.title = outline.title || project.title;
    outline.subtitle = outline.subtitle || 'ForgeAtoms 生成';

    const outlineSummary = [
      `大纲已就绪：《${outline.title}》`,
      outline.subtitle ? `副标题：${outline.subtitle}` : '',
      `共 ${outline.slides.length} 页内容幻灯片：`,
      ...outline.slides.map((s, i) => `${i + 1}. ${s.title}（${(s.bullets || []).length} 要点）`),
    ]
      .filter(Boolean)
      .join('\n');
    addMsg(projectId, AGENTS[1], outlineSummary, 2);

    // 3) Bob — design direction
    let design;
    try {
      design = await chatJson({
        temperature: 0.4,
        system:
          '你是架构/设计 Bob。为 PPT 输出设计方向 JSON：{"bg":"#1A0A0A","bgAlt":"#2A1212","accent":"#C41E3A","accentSoft":"#E85D4C","gold":"#D4A017","fg":"#FFF8F0","muted":"#C9B8B0","card":"#2E1616","mood":"...","fonts":"Microsoft YaHei","notes":"..."}。春晚/节庆主题用深红+金色暗色喜庆风；其他主题可调整但仍保持深色专业。颜色必须是 #RRGGBB。',
        user: `主题：${outline.title}\n需求：${project.idea}\n请给出设计 JSON。`,
      });
    } catch {
      design = {
        bg: '#1A0A0A',
        accent: '#C41E3A',
        gold: '#D4A017',
        mood: 'festive-dark',
        notes: '默认春晚喜庆暗色主题',
      };
    }
    addMsg(
      projectId,
      AGENTS[2],
      [
        '设计方向已确定：',
        `• 情绪：${design.mood || '深色喜庆'}`,
        `• 主色：${design.accent || '#C41E3A'} / 点缀金：${design.gold || '#D4A017'}`,
        `• 背景：${design.bg || '#1A0A0A'}`,
        `• 字体：${design.fonts || 'Microsoft YaHei'}`,
        design.notes ? `• 说明：${design.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      3
    );

    // 4) Alex — pixel collage + pptx
    const variant = 'A';
    const absDir = path.join(DATA_DIR, 'projects', projectId, variant);
    fs.mkdirSync(absDir, { recursive: true });
    const pptxName = 'presentation.pptx';
    const absPptx = path.join(absDir, pptxName);
    const relPptx = relPathFor(projectId, variant, pptxName);
    const posterName = 'poster.png';
    const absPoster = path.join(absDir, posterName);
    const relPoster = relPathFor(projectId, variant, posterName);

    let collageMeta = { theme: null, assets: [] };
    try {
      collageMeta = await buildThemedCollage(
        outline.title || project.title,
        project.idea,
        absPoster,
        { width: 1280, height: 720 }
      );
      addMsg(
        projectId,
        AGENTS[2],
        [
          '像素素材拼贴已就绪（封面将使用）：',
          `情绪：${(collageMeta.theme && collageMeta.theme.mood) || 'cozy'}`,
          ...collageMeta.assets.map((a) => `• [${a.category}] ${a.name}`),
        ].join('\n'),
        3
      );
    } catch (collageErr) {
      console.error('PPT collage fallback:', collageErr.message);
    }

    const iconPaths = (collageMeta.assets || [])
      .filter((a) => a.category !== 'scenes')
      .slice(0, 6)
      .map((a) => absAsset(a.file));

    await buildPptx(outline, design, absPptx, {
      collagePath: fs.existsSync(absPoster) ? absPoster : null,
      iconPaths,
    });
    const stat = fs.statSync(absPptx);

    const outlineJson = JSON.stringify(outline, null, 2);
    const designJson = JSON.stringify(design, null, 2);
    const collageJson = JSON.stringify(
      {
        theme: collageMeta.theme,
        assets: (collageMeta.assets || []).map((a) => ({
          id: a.id,
          name: a.name,
          category: a.category,
        })),
      },
      null,
      2
    );
    fs.writeFileSync(path.join(absDir, 'outline.json'), outlineJson, 'utf8');
    fs.writeFileSync(path.join(absDir, 'design.json'), designJson, 'utf8');
    fs.writeFileSync(path.join(absDir, 'collage.json'), collageJson, 'utf8');

    const tx = db.transaction(() => {
      upsertArtifact.run(
        uuidv4(),
        projectId,
        variant,
        'outline.json',
        outlineJson,
        'application/json'
      );
      upsertArtifact.run(
        uuidv4(),
        projectId,
        variant,
        'design.json',
        designJson,
        'application/json'
      );
      upsertArtifact.run(
        uuidv4(),
        projectId,
        variant,
        'collage.json',
        collageJson,
        'application/json'
      );
      if (fs.existsSync(absPoster)) {
        upsertArtifact.run(
          uuidv4(),
          projectId,
          variant,
          posterName,
          `__FILE__:${relPoster}`,
          'image/png'
        );
      }
      upsertArtifact.run(
        uuidv4(),
        projectId,
        variant,
        pptxName,
        `__FILE__:${relPptx}`,
        PPTX_MIME
      );
    });
    tx();

    addMsg(
      projectId,
      AGENTS[3],
      [
        'PPT 工程交付完成 ✅（封面像素拼贴 + 内容页素材点缀）',
        ``,
        `文件：presentation.pptx（${Math.round(stat.size / 1024)} KB）`,
        fs.existsSync(absPoster) ? '附带：poster.png（素材拼贴封面）' : '',
        `内容页：${outline.slides.length} + 封面/封底`,
        `可在右侧预览大纲，或点击「下载 PPTX」获取完整演示文稿。`,
      ]
        .filter(Boolean)
        .join('\n'),
      4
    );

    db.prepare(
      `UPDATE projects SET status = 'ready', selected_variant = 'A', updated_at = datetime('now') WHERE id = ?`
    ).run(projectId);

    return { ok: true, path: absPptx, size: stat.size };
  } catch (err) {
    console.error('runPptBuild error', err && err.message ? err.message : err);
    addMsg(
      projectId,
      AGENTS[3],
      `PPT 构建失败：${err.message || String(err)}\n请稍后重试或检查 DeepSeek API 配额。`,
      99
    );
    updateStatus.run('draft', projectId);
    return { ok: false, error: String(err.message || err) };
  }
}

module.exports = { runPptBuild, AGENTS };
