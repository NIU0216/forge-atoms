/**
 * Offline heuristic parser for user ideas — no API key required.
 */
function parseIdea(idea, title) {
  const text = `${title || ''} ${idea || ''}`.trim();
  const lower = text.toLowerCase();

  const keywords = extractKeywords(text);
  const tone = detectTone(lower);
  const category = detectCategory(lower);
  const cta = pickCta(category, tone);
  const colors = paletteFor(category, tone);
  const features = inventFeatures(keywords, category, idea);
  const tagline = inventTagline(title, keywords, category);
  const audience = inventAudience(category, keywords);

  return {
    title: title || keywords.slice(0, 2).join(' ') || '新项目',
    keywords,
    tone,
    category,
    cta,
    colors,
    features,
    tagline,
    audience,
    raw: idea || '',
  };
}

function extractKeywords(text) {
  const stop = new Set([
    '的', '了', '和', '是', '在', '我', '有', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'with', 'is', 'are', 'be', 'this', 'that', 'we', 'our', 'you', 'your', 'app', 'apps', 'want', 'need', 'build', 'make', 'create',
    '一个', '可以', '帮助', '用户', '平台', '产品', '网站', '应用', '系统', '功能', '主要', '通过', '进行', '以及', '或者', '能够',
  ]);
  const tokens = text
    .replace(/[^\p{L}\p{N}\s+-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t.toLowerCase()));
  const freq = {};
  for (const t of tokens) {
    const k = t.toLowerCase();
    freq[k] = (freq[k] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 8)
    .map(([w]) => w);
}

function detectTone(lower) {
  if (/奢|高端|premium|luxury|elegant|精致/.test(lower)) return 'premium';
  if (/趣味|游戏|fun|play|可爱|轻松/.test(lower)) return 'playful';
  if (/企业|b2b|saas|效率|专业|enterprise|workflow/.test(lower)) return 'professional';
  if (/健康|医疗|安心|safe|care|疗愈/.test(lower)) return 'calm';
  if (/极客|开发|api|开源|tech|code|hack/.test(lower)) return 'tech';
  return 'modern';
}

function detectCategory(lower) {
  if (/电商|shop|store|买|卖|商城|零售/.test(lower)) return 'ecommerce';
  if (/教育|课程|学习|learn|course|培训/.test(lower)) return 'education';
  if (/社交|社区|交友|social|community|聊天/.test(lower)) return 'social';
  if (/健身|运动|饮食|health|fitness|营养/.test(lower)) return 'health';
  if (/金融|理财|支付|fintech|bank|投资/.test(lower)) return 'finance';
  if (/旅行|旅游|酒店|travel|trip|机票/.test(lower)) return 'travel';
  if (/工具|效率|saas|生产力|项目管理|crm/.test(lower)) return 'saas';
  if (/内容|博客|媒体|newsletter|blog|媒体/.test(lower)) return 'content';
  return 'startup';
}

function pickCta(category, tone) {
  const map = {
    ecommerce: '立即选购',
    education: '免费试听',
    social: '加入社区',
    health: '开始改变',
    finance: '免费开户',
    travel: '探索目的地',
    saas: '免费试用',
    content: '订阅更新',
    startup: '立即开始',
  };
  if (tone === 'premium') return '预约体验';
  return map[category] || '立即开始';
}

function paletteFor(category, tone) {
  const palettes = {
    premium: { bg: '#0b0b0f', fg: '#f5f0e8', accent: '#c9a227', muted: '#8a8578', card: '#16161c' },
    playful: { bg: '#0f1221', fg: '#f7f8ff', accent: '#ff6bcb', muted: '#9aa3c7', card: '#1a1f3a' },
    professional: { bg: '#0b1220', fg: '#e8eef8', accent: '#3b82f6', muted: '#8ba0bf', card: '#121a2b' },
    calm: { bg: '#0c1412', fg: '#e8f5f1', accent: '#34d399', muted: '#86a89c', card: '#121c19' },
    tech: { bg: '#05080f', fg: '#d7ffe8', accent: '#22d3ee', muted: '#6b8f99', card: '#0c121c' },
    modern: { bg: '#0a0a0c', fg: '#f4f4f5', accent: '#a78bfa', muted: '#a1a1aa', card: '#141418' },
  };
  if (category === 'ecommerce') return { bg: '#0c0a09', fg: '#fafaf9', accent: '#f97316', muted: '#a8a29e', card: '#1c1917' };
  if (category === 'finance') return { bg: '#020617', fg: '#f8fafc', accent: '#10b981', muted: '#94a3b8', card: '#0f172a' };
  return palettes[tone] || palettes.modern;
}

function inventFeatures(keywords, category, idea) {
  const base = [
    { title: '智能洞察', desc: `基于「${keywords[0] || '你的场景'}」自动提炼关键信号，减少手动整理。` },
    { title: '一键协作', desc: '团队成员实时同步进度，减少来回沟通成本。' },
    { title: '数据驱动', desc: '内置仪表盘，让每一次决策都有据可依。' },
  ];
  if (category === 'ecommerce') {
    return [
      { title: '商品智能推荐', desc: '根据浏览与偏好动态排序，提高转化。' },
      { title: '一键下单结算', desc: '精简结账流程，降低弃购率。' },
      { title: '库存与物流同步', desc: '订单状态实时可见，售后更省心。' },
    ];
  }
  if (category === 'saas') {
    return [
      { title: '工作流自动化', desc: '把重复任务交给规则引擎，释放人力。' },
      { title: '权限与审计', desc: '企业级角色控制，操作可追溯。' },
      { title: '开放集成', desc: 'Webhook / API，轻松接入现有系统。' },
    ];
  }
  if (category === 'education') {
    return [
      { title: '路径化学习', desc: '按目标自动生成学习路径与里程碑。' },
      { title: '练习与反馈', desc: '即时测评，薄弱点一目了然。' },
      { title: '社群督学', desc: '同伴打卡与导师答疑，提升完课率。' },
    ];
  }
  // sprinkle keywords into descriptions
  if (keywords[1]) base[1].desc = `围绕「${keywords[1]}」组织协作，让跨角色对齐更轻松。`;
  if (idea && idea.length > 40) {
    base[2].desc = `从你的想法出发：${idea.slice(0, 48).replace(/\s+/g, ' ')}…`;
  }
  return base;
}

function inventTagline(title, keywords, category) {
  const k = keywords[0] || title || '想法';
  const templates = {
    ecommerce: `把「${k}」变成人人愿买的好物体验`,
    education: `用更好的方式学会「${k}」`,
    social: `连接关心「${k}」的人`,
    health: `让「${k}」成为可持续的日常`,
    finance: `更聪明地管理「${k}」`,
    travel: `下一站，从「${k}」开始`,
    saas: `为「${k}」打造的现代化工作台`,
    content: `关于「${k}」的深度内容，值得订阅`,
    startup: `从想法到产品：重新定义「${k}」`,
  };
  return templates[category] || templates.startup;
}

function inventAudience(category, keywords) {
  const map = {
    ecommerce: '追求品质与效率的网购用户',
    education: '希望系统提升技能的终身学习者',
    social: '渴望真实连接的兴趣社群成员',
    health: '想改善生活方式的都市人群',
    finance: '注重稳健增长的个人与小微企业',
    travel: '热爱探索的自由行旅客',
    saas: '需要提效的中小团队与创业者',
    content: '对深度内容有饥渴的读者',
    startup: keywords[0] ? `关心「${keywords[0]}」的早期用户` : '早期尝鲜用户',
  };
  return map[category] || map.startup;
}

module.exports = { parseIdea };
