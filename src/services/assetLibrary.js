/**
 * Pixel asset library: load manifest, match by theme tags, compose posters with sharp.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { chatJson, hasApiKey } = require('./llm');

const ASSETS_ROOT = path.join(__dirname, '..', '..', 'data', 'assets');
const MANIFEST_PATH = path.join(ASSETS_ROOT, 'manifest.json');

let cachedManifest = null;

function loadManifest() {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

function absAsset(file) {
  return path.join(ASSETS_ROOT, file);
}

function heuristicKeywords(text) {
  const t = String(text || '');
  const keys = [];
  const pairs = [
    [/春晚|节日|年|庆祝|生日/, ['节日', '庆祝', '人物', '美食', '蛋糕']],
    [/农场|田|乡村|星露谷|农/, ['农场', '农夫', '田野', '树木', '户外']],
    [/森林|树|自然|户外/, ['森林', '树木', '自然', '绿', '户外']],
    [/花|花园|春天/, ['花', '花草', '春天', '粉']],
    [/水果|苹果|草莓|橙|葡萄/, ['水果', '甜', '健康']],
    [/美食|吃|餐|厨|咖啡|蛋糕|面包/, ['美食', '烘焙', '甜点', '厨房']],
    [/海|沙滩|夏/, ['沙滩', '海', '夏天', '蓝']],
    [/冬|雪/, ['冬天', '雪', '白']],
    [/夜|星|月/, ['夜晚', '星空', '月亮']],
    [/湖|水|渔|鱼/, ['湖', '水', '渔夫', '蓝']],
    [/市集|市场|买/, ['市集', '市场', '热闹']],
    [/家|屋|温馨/, ['小屋', '家', '温馨']],
    [/孩子|童/, ['小孩', '孩子']],
    [/魔法|巫/, ['女巫', '魔法']],
  ];
  for (const [re, tags] of pairs) {
    if (re.test(t)) keys.push(...tags);
  }
  // also split CJK / words
  const extras = t.match(/[\u4e00-\u9fff]{2,4}|[a-zA-Z]{3,}/g) || [];
  keys.push(...extras.slice(0, 12));
  if (!keys.length) keys.push('农场', '自然', '户外', '人物', '树木');
  return [...new Set(keys)];
}

/**
 * Extract theme via DeepSeek; fallback to heuristic.
 * @returns {{ keywords: string[], mood: string, elements: string[], title: string }}
 */
async function extractTheme(title, idea) {
  const fallback = {
    keywords: heuristicKeywords(`${title} ${idea}`),
    mood: 'cozy',
    elements: [],
    title: title || '像素海报',
  };
  if (!hasApiKey()) return fallback;
  try {
    const data = await chatJson({
      temperature: 0.3,
      system:
        '你是视觉策划。从用户主题提取像素拼贴所需元素。输出 JSON：{"title":"短标题","mood":"cozy|festive|calm|bright|night","keywords":["中英标签"],"elements":["人物/树木/花草/水果/美食/场景相关词"]}。keywords 8–14 个，便于匹配素材库 tags。',
      user: `标题：${title}\n需求：${idea}\n请输出 JSON。`,
    });
    return {
      title: data.title || fallback.title,
      mood: data.mood || 'cozy',
      keywords: Array.isArray(data.keywords) && data.keywords.length ? data.keywords : fallback.keywords,
      elements: Array.isArray(data.elements) ? data.elements : [],
    };
  } catch (e) {
    console.error('extractTheme LLM fallback:', e.message);
    return fallback;
  }
}

function scoreItem(item, needles) {
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());
  const name = String(item.name || '').toLowerCase();
  const id = String(item.id || '').toLowerCase();
  let score = 0;
  for (const n of needles) {
    const q = String(n).toLowerCase();
    if (!q) continue;
    if (tags.some((t) => t === q || t.includes(q) || q.includes(t))) score += 3;
    if (name.includes(q) || q.includes(name)) score += 2;
    if (id.includes(q)) score += 1;
  }
  // category boosts from needles
  const catHints = {
    characters: /人物|角色|farmer|人|孩|厨|渔|巫|商/,
    trees: /树|森林|木|oak|pine/,
    flora: /花|草|蘑菇|garden/,
    fruit: /水果|果|apple|甜/,
    food: /美食|餐|食|cake|面包|厨/,
    scenes: /场景|风景|农场|湖|海|夜|屋|市集/,
  };
  for (const [cat, re] of Object.entries(catHints)) {
    if (item.category === cat && needles.some((n) => re.test(String(n)))) score += 2;
  }
  return score;
}

/**
 * Pick 4–8 assets matching theme keywords; ensure category diversity.
 */
function matchAssets(theme, { min = 4, max = 8 } = {}) {
  const manifest = loadManifest();
  const needles = [
    ...(theme.keywords || []),
    ...(theme.elements || []),
    theme.mood,
    theme.title,
  ].filter(Boolean);

  const scored = manifest.items
    .map((it) => ({ it, score: scoreItem(it, needles) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const usedCats = new Set();
  // first pass: prefer diversity
  for (const { it, score } of scored) {
    if (picked.length >= max) break;
    if (score <= 0 && picked.length >= min) continue;
    if (usedCats.has(it.category) && picked.length < min) {
      // still allow if we need more later
    }
    if (usedCats.has(it.category) && picked.filter((p) => p.category === it.category).length >= 2) {
      continue;
    }
    if (score > 0 || picked.length < min) {
      picked.push(it);
      usedCats.add(it.category);
    }
  }
  // fill from top if short
  if (picked.length < min) {
    for (const { it } of scored) {
      if (picked.length >= min) break;
      if (!picked.find((p) => p.id === it.id)) picked.push(it);
    }
  }
  // always try include one scene if available
  if (!picked.some((p) => p.category === 'scenes')) {
    const scene = scored.find((s) => s.it.category === 'scenes');
    if (scene) {
      if (picked.length >= max) picked.pop();
      picked.unshift(scene.it);
    }
  }
  return picked.slice(0, max);
}

const MOOD_BG = {
  cozy: { top: '#B8D4E8', bottom: '#C8E0A8', panel: '#F6ECD0', ink: '#3A2A1C' },
  festive: { top: '#E8C8A0', bottom: '#E07060', panel: '#FFF0D8', ink: '#4A1810' },
  calm: { top: '#A8C8E0', bottom: '#90B8A0', panel: '#F0F4E8', ink: '#243828' },
  bright: { top: '#FFE8A0', bottom: '#A8D878', panel: '#FFF8E8', ink: '#3A3010' },
  night: { top: '#2A3050', bottom: '#1A2038', panel: '#3A4060', ink: '#F0E8D0' },
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compose a tidy parchment poster with matched sprites.
 * @returns {Promise<{ outPath: string, assets: object[], theme: object }>}
 */
async function composePoster(theme, assets, outPath, opts = {}) {
  const width = opts.width || 1280;
  const height = opts.height || 720;
  const mood = MOOD_BG[theme.mood] || MOOD_BG.cozy;
  const title = theme.title || 'ForgeAtoms';

  const margin = 48;
  const panelX = margin;
  const panelY = margin;
  const panelW = width - margin * 2;
  const panelH = height - margin * 2;

  // Background gradient via SVG
  const bgSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${mood.top}"/>
          <stop offset="100%" stop-color="${mood.bottom}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="8" fill="${mood.panel}" stroke="#5A4030" stroke-width="6"/>
      <rect x="${panelX + 10}" y="${panelY + 10}" width="${panelW - 20}" height="${panelH - 20}" fill="none" stroke="#C4A882" stroke-width="3"/>
    </svg>`
  );

  const composites = [{ input: await sharp(bgSvg).png().toBuffer(), left: 0, top: 0 }];

  // Place scene as soft banner if present
  const scenes = assets.filter((a) => a.category === 'scenes');
  const sprites = assets.filter((a) => a.category !== 'scenes');
  let yCursor = panelY + 100;

  if (scenes[0]) {
    const sceneBuf = await sharp(absAsset(scenes[0].file))
      .resize(Math.min(320, panelW - 80), Math.min(180, panelH / 3), {
        kernel: sharp.kernel.nearest,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const meta = await sharp(sceneBuf).metadata();
    composites.push({
      input: sceneBuf,
      left: Math.round(panelX + (panelW - meta.width) / 2),
      top: panelY + 88,
    });
    yCursor = panelY + 88 + (meta.height || 160) + 24;
  }

  // Title overlay
  const titleSvg = Buffer.from(
    `<svg width="${panelW - 40}" height="80" xmlns="http://www.w3.org/2000/svg">
      <style>
        .t { font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 42px; font-weight: 700; fill: ${mood.ink}; }
        .s { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 18px; fill: ${mood.ink}; opacity: 0.7; }
      </style>
      <text x="50%" y="40" text-anchor="middle" class="t">${escapeXml(String(title).slice(0, 28))}</text>
      <text x="50%" y="68" text-anchor="middle" class="s">ForgeAtoms · 像素素材拼贴</text>
    </svg>`
  );
  composites.push({
    input: await sharp(titleSvg).png().toBuffer(),
    left: panelX + 20,
    top: panelY + 20,
  });

  // Grid of sprites
  const cell = 112;
  const gap = 28;
  const usable = sprites.slice(0, 8);
  const cols = Math.min(4, Math.max(2, usable.length));
  const rows = Math.ceil(usable.length / cols);
  const gridW = cols * cell + (cols - 1) * gap;
  const startX = Math.round(panelX + (panelW - gridW) / 2);
  let startY = Math.max(yCursor, panelY + 200);
  const maxStart = panelY + panelH - rows * cell - 40;
  if (startY > maxStart) startY = Math.max(panelY + 160, maxStart);

  for (let i = 0; i < usable.length; i++) {
    const a = usable[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const spr = await sharp(absAsset(a.file))
      .resize(cell, cell, {
        kernel: sharp.kernel.nearest,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({
      input: spr,
      left: startX + col * (cell + gap),
      top: startY + row * (cell + gap),
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 184, g: 212, b: 232, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  return { outPath, assets, theme };
}

/**
 * High-level: theme extract → match → compose.
 */
async function buildThemedCollage(title, idea, outPath, opts) {
  const theme = await extractTheme(title, idea);
  const assets = matchAssets(theme, { min: 4, max: 8 });
  await composePoster(theme, assets, outPath, opts);
  return { theme, assets, outPath };
}

module.exports = {
  ASSETS_ROOT,
  loadManifest,
  extractTheme,
  matchAssets,
  composePoster,
  buildThemedCollage,
  absAsset,
  heuristicKeywords,
};
