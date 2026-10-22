const { parseIdea } = require('./ideaParser');

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateLanding(project, variant = 'A') {
  const parsed = parseIdea(project.idea, project.title);
  const c = parsed.colors;
  const isB = variant === 'B';

  // Variant A: classic hero + features + CTA
  // Variant B: split layout, bold typography, social proof cards
  const brand = escapeHtml(parsed.title);
  const tagline = escapeHtml(parsed.tagline);
  const cta = escapeHtml(parsed.cta);
  const audience = escapeHtml(parsed.audience);
  const features = parsed.features;

  if (isB) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="description" content="${tagline} — 面向${audience}"/>
<meta name="keywords" content="${parsed.keywords.map(escapeHtml).join(',')}"/>
<title>${brand} | ForgeAtoms 生成</title>
<style>
  :root { --bg:${c.bg}; --fg:${c.fg}; --accent:${c.accent}; --muted:${c.muted}; --card:${c.card}; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;min-height:100vh}
  .wrap{max-width:1100px;margin:0 auto;padding:2rem 1.25rem}
  nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:3rem}
  .logo{font-weight:800;letter-spacing:-.02em;font-size:1.15rem}
  .logo span{color:var(--accent)}
  .pill{border:1px solid color-mix(in srgb, var(--accent) 40%, transparent);color:var(--accent);padding:.35rem .75rem;border-radius:999px;font-size:.75rem}
  .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:2.5rem;align-items:center}
  @media(max-width:800px){.grid{grid-template-columns:1fr}}
  h1{font-size:clamp(2.2rem,5vw,3.4rem);line-height:1.1;letter-spacing:-.03em;margin-bottom:1rem}
  .lead{color:var(--muted);font-size:1.1rem;margin-bottom:1.75rem;max-width:36ch}
  .cta{display:inline-flex;gap:.5rem;align-items:center;background:var(--accent);color:#0a0a0a;font-weight:700;padding:.85rem 1.4rem;border-radius:.75rem;text-decoration:none;border:none;cursor:pointer;font-size:1rem}
  .cta:hover{filter:brightness(1.08)}
  .panel{background:linear-gradient(145deg,var(--card),color-mix(in srgb,var(--accent) 12%, var(--card)));border:1px solid color-mix(in srgb,var(--accent) 25%, transparent);border-radius:1.25rem;padding:1.5rem;min-height:280px;display:flex;flex-direction:column;justify-content:space-between}
  .stat{font-size:2rem;font-weight:800;color:var(--accent)}
  .stat-label{color:var(--muted);font-size:.85rem}
  .stats{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}
  section{margin-top:4rem}
  h2{font-size:1.5rem;margin-bottom:1.25rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
  .card{background:var(--card);border:1px solid color-mix(in srgb, var(--fg) 8%, transparent);border-radius:1rem;padding:1.25rem}
  .card h3{font-size:1.05rem;margin-bottom:.4rem}
  .card p{color:var(--muted);font-size:.92rem}
  .proof{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem}
  .avatar{width:40px;height:40px;border-radius:50%;background:var(--accent);display:grid;place-items:center;font-weight:800;color:#111}
  .quote{flex:1;min-width:220px;background:var(--card);border-radius:1rem;padding:1rem 1.25rem;border:1px solid color-mix(in srgb,var(--fg) 8%,transparent)}
  .quote p{color:var(--muted);font-size:.9rem}
  footer{margin-top:4rem;padding-top:1.5rem;border-top:1px solid color-mix(in srgb,var(--fg) 10%,transparent);color:var(--muted);font-size:.8rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
  a.muted{color:var(--muted)}
</style>
</head>
<body>
  <div class="wrap">
    <nav>
      <div class="logo">${brand} <span>·</span></div>
      <div class="pill">Variant B · 竞速版</div>
    </nav>
    <div class="grid">
      <div>
        <h1>${tagline}</h1>
        <p class="lead">专为 ${audience} 打造。由 ForgeAtoms 多智能体团队根据你的想法生成。</p>
        <a class="cta" href="#start">${cta} →</a>
        <div class="proof">
          <div class="quote">
            <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:.5rem">
              <div class="avatar">A</div>
              <strong>早期用户</strong>
            </div>
            <p>「从想法到可点可看的页面，只用了几分钟。」</p>
          </div>
        </div>
      </div>
      <div class="panel">
        <div>
          <div class="pill" style="display:inline-block;margin-bottom:1rem">实时洞察</div>
          <h2 style="font-size:1.25rem;margin:0 0 .5rem">为什么选择 ${brand}</h2>
          <p style="color:var(--muted);font-size:.95rem">${escapeHtml((project.idea || '').slice(0, 120))}${(project.idea || '').length > 120 ? '…' : ''}</p>
        </div>
        <div class="stats">
          <div><div class="stat">3×</div><div class="stat-label">迭代更快</div></div>
          <div><div class="stat">24/7</div><div class="stat-label">智能体在线</div></div>
        </div>
      </div>
    </div>
    <section id="start">
      <h2>核心能力</h2>
      <div class="cards">
        ${features.map((f) => `<div class="card"><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.desc)}</p></div>`).join('')}
      </div>
    </section>
    <section>
      <div class="panel" style="text-align:center;padding:2.5rem">
        <h2 style="margin-bottom:.75rem">准备好上线了吗？</h2>
        <p style="color:var(--muted);margin-bottom:1.25rem">这是 ForgeAtoms 为你生成的 B 版着陆页，可继续迭代或导出。</p>
        <a class="cta" href="#">${cta}</a>
      </div>
    </section>
    <footer>
      <span>Generated by ForgeAtoms · Variant B</span>
      <a class="muted" href="/about.html">关于此页面</a>
    </footer>
  </div>
</body>
</html>`;
  }

  // Variant A
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="description" content="${tagline} — 面向${audience}"/>
<meta name="keywords" content="${parsed.keywords.map(escapeHtml).join(',')}"/>
<meta property="og:title" content="${brand}"/>
<meta property="og:description" content="${tagline}"/>
<title>${brand} | ForgeAtoms</title>
<style>
  :root { --bg:${c.bg}; --fg:${c.fg}; --accent:${c.accent}; --muted:${c.muted}; --card:${c.card}; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg);line-height:1.65;min-height:100vh}
  .hero{padding:4rem 1.25rem 3rem;background:radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb,var(--accent) 28%, transparent), transparent)}
  .wrap{max-width:960px;margin:0 auto}
  nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:3.5rem}
  .logo{font-weight:800;font-size:1.2rem}
  .logo em{font-style:normal;color:var(--accent)}
  .badge{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);padding:.3rem .65rem;border-radius:999px}
  h1{font-size:clamp(2.4rem,6vw,3.6rem);letter-spacing:-.035em;line-height:1.08;margin-bottom:1rem;max-width:16ch}
  .sub{color:var(--muted);font-size:1.15rem;max-width:42ch;margin-bottom:2rem}
  .actions{display:flex;gap:.75rem;flex-wrap:wrap}
  .btn{background:var(--accent);color:#0a0a0a;font-weight:700;padding:.9rem 1.5rem;border-radius:.85rem;text-decoration:none;border:none;cursor:pointer;font-size:1rem}
  .btn.ghost{background:transparent;color:var(--fg);border:1px solid color-mix(in srgb,var(--fg) 20%,transparent)}
  .features{padding:2rem 1.25rem 4rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}
  .card{background:var(--card);border:1px solid color-mix(in srgb,var(--fg) 8%,transparent);border-radius:1.1rem;padding:1.4rem;transition:transform .15s ease,border-color .15s}
  .card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
  .icon{width:40px;height:40px;border-radius:.75rem;background:color-mix(in srgb,var(--accent) 18%,transparent);display:grid;place-items:center;margin-bottom:.9rem;font-size:1.1rem}
  .card h3{margin-bottom:.4rem;font-size:1.05rem}
  .card p{color:var(--muted);font-size:.92rem}
  .audience{margin:0 1.25rem 3rem;padding:1.5rem;border-radius:1rem;background:var(--card);border:1px dashed color-mix(in srgb,var(--accent) 35%,transparent)}
  .audience strong{color:var(--accent)}
  footer{padding:1.5rem 1.25rem;border-top:1px solid color-mix(in srgb,var(--fg) 10%,transparent);color:var(--muted);font-size:.8rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
  a.muted{color:var(--muted)}
</style>
</head>
<body>
  <header class="hero">
    <div class="wrap">
      <nav>
        <div class="logo">${brand}<em>.</em></div>
        <span class="badge">Variant A</span>
      </nav>
      <h1>${tagline}</h1>
      <p class="sub">${escapeHtml((project.idea || '用多智能体把想法变成可上线产品。').slice(0, 160))}</p>
      <div class="actions">
        <a class="btn" href="#features">${cta}</a>
        <a class="btn ghost" href="/about.html">了解更多</a>
      </div>
    </div>
  </header>
  <section class="features" id="features">
    <div class="wrap">
      <div class="grid">
        ${features
          .map(
            (f, i) =>
              `<article class="card"><div class="icon">${['✨', '⚡', '📊'][i] || '✦'}</div><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.desc)}</p></article>`
          )
          .join('')}
      </div>
    </div>
  </section>
  <div class="wrap">
    <div class="audience">目标用户：<strong>${audience}</strong> · 关键词：${parsed.keywords.slice(0, 5).map(escapeHtml).join(' · ') || '创新'}</div>
  </div>
  <footer class="wrap" style="max-width:960px;margin:0 auto">
    <span>Generated by ForgeAtoms · Variant A</span>
    <a class="muted" href="/about.html">关于此页面</a>
  </footer>
</body>
</html>`;
}

function generateAboutPage(project) {
  const parsed = parseIdea(project.idea, project.title);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>关于 · ${escapeHtml(parsed.title)}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0a0c;color:#f4f4f5;max-width:640px;margin:3rem auto;padding:0 1.25rem;line-height:1.7}
a{color:#a78bfa}
h1{font-size:1.75rem;margin-bottom:.5rem}
.meta{color:#a1a1aa;font-size:.9rem;margin-bottom:1.5rem}
pre{white-space:pre-wrap;background:#141418;padding:1rem;border-radius:.75rem;font-size:.9rem}
</style>
</head>
<body>
  <h1>${escapeHtml(parsed.title)}</h1>
  <p class="meta">由 ForgeAtoms 多智能体根据用户想法生成 · SEO 副页</p>
  <p>${escapeHtml(parsed.tagline)}</p>
  <h2 style="margin-top:1.5rem;font-size:1.1rem">原始想法</h2>
  <pre>${escapeHtml(project.idea)}</pre>
  <p style="margin-top:1.5rem"><a href="/">← 返回主页</a></p>
</body>
</html>`;
}

function generateReadme(project, variant) {
  const parsed = parseIdea(project.idea, project.title);
  return `# ${parsed.title}

> 由 ForgeAtoms 生成 · 选用版本 Variant ${variant}

## 简介
${parsed.tagline}

## 原始想法
${project.idea}

## 目标用户
${parsed.audience}

## 关键词
${parsed.keywords.join(', ') || 'N/A'}

## 文件说明
- \`index.html\` — 着陆页（Variant ${variant}）
- \`about.html\` — 关于 / SEO 副页
- \`README.md\` — 本说明

## 本地预览
用任意静态服务器打开 \`index.html\`，例如：

\`\`\`bash
npx serve .
\`\`\`

---
Generated by ForgeAtoms (AI 多智能体产品工坊)
`;
}

module.exports = { generateLanding, generateAboutPage, generateReadme, parseIdea: require('./ideaParser').parseIdea };
