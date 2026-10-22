/**
 * Build PPTX from outline; optionally decorate with pixel collage + sprite icons.
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const DEFAULT_THEME = {
  bg: '1A0A0A',
  bgAlt: '2A1212',
  accent: 'C41E3A',
  accentSoft: 'E85D4C',
  gold: 'D4A017',
  fg: 'FFF8F0',
  muted: 'C9B8B0',
  card: '2E1616',
};

// Cozy farm palette when using pixel collage
const PIXEL_THEME = {
  bg: '2A3A28',
  bgAlt: '344834',
  accent: '6B8F3C',
  accentSoft: 'A8C878',
  gold: 'D4A017',
  fg: 'F6ECD0',
  muted: 'C8D4A8',
  card: '3A4A38',
};

function hex(c, fallback) {
  if (!c || typeof c !== 'string') return fallback;
  return c.replace(/^#/, '').toUpperCase();
}

function mergeTheme(design, preferPixel) {
  const t = { ...(preferPixel ? PIXEL_THEME : DEFAULT_THEME) };
  if (design && typeof design === 'object') {
    if (design.bg) t.bg = hex(design.bg, t.bg);
    if (design.bgAlt) t.bgAlt = hex(design.bgAlt, t.bgAlt);
    if (design.accent) t.accent = hex(design.accent, t.accent);
    if (design.accentSoft) t.accentSoft = hex(design.accentSoft, t.accentSoft);
    if (design.gold) t.gold = hex(design.gold, t.gold);
    if (design.fg) t.fg = hex(design.fg, t.fg);
    if (design.muted) t.muted = hex(design.muted, t.muted);
    if (design.card) t.card = hex(design.card, t.card);
  }
  return t;
}

/**
 * @param {object} outline
 * @param {object} design
 * @param {string} outPath
 * @param {object} [media] - { collagePath?, iconPaths?: string[] }
 */
async function buildPptx(outline, design, outPath, media = {}) {
  const hasCollage = media.collagePath && fs.existsSync(media.collagePath);
  const icons = (media.iconPaths || []).filter((p) => p && fs.existsSync(p));
  const theme = mergeTheme(design, hasCollage);
  const title = outline.title || '演示文稿';
  const subtitle = outline.subtitle || '';
  const slides = Array.isArray(outline.slides) ? outline.slides : [];

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5
  pres.author = 'ForgeAtoms';
  pres.title = title;
  pres.subject = subtitle || title;

  // ---- Title slide ----
  {
    const s = pres.addSlide();
    if (hasCollage) {
      s.addImage({ path: media.collagePath, x: 0, y: 0, w: 13.3, h: 7.5 });
      // readable text band
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y: 5.4, w: 12.3, h: 1.6,
        fill: { color: '1A2818', transparency: 25 },
      });
      s.addText(title, {
        x: 0.7, y: 5.5, w: 11.9, h: 0.7,
        fontSize: 28, fontFace: 'Microsoft YaHei',
        color: theme.fg, bold: true, margin: 0,
      });
      s.addText(subtitle || '像素素材拼贴 · ForgeAtoms', {
        x: 0.7, y: 6.25, w: 11.9, h: 0.4,
        fontSize: 14, fontFace: 'Microsoft YaHei',
        color: theme.muted, margin: 0,
      });
    } else {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 13.3, h: 7.5,
        fill: { color: theme.bg },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 0.18, h: 7.5,
        fill: { color: theme.accent },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.9, y: 3.55, w: 2.2, h: 0.06,
        fill: { color: theme.gold },
      });
      s.addText(title, {
        x: 0.9, y: 2.2, w: 11.2, h: 1.2,
        fontSize: 40, fontFace: 'Microsoft YaHei',
        color: theme.fg, bold: true, margin: 0,
      });
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.9, y: 3.75, w: 11.2, h: 0.7,
          fontSize: 18, fontFace: 'Microsoft YaHei',
          color: theme.muted, margin: 0,
        });
      }
      s.addText('ForgeAtoms · DeepSeek 多智能体生成', {
        x: 0.9, y: 6.7, w: 11, h: 0.35,
        fontSize: 12, fontFace: 'Microsoft YaHei',
        color: theme.accentSoft, margin: 0,
      });
    }
  }

  // ---- Content slides ----
  slides.forEach((slide, idx) => {
    const s = pres.addSlide();
    const useAlt = idx % 2 === 1;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 13.3, h: 7.5,
      fill: { color: useAlt ? theme.bgAlt : theme.bg },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 13.3, h: 0.12,
      fill: { color: theme.accent },
    });

    const slideTitle = slide.title || `第 ${idx + 1} 页`;
    const hasIcon = icons.length > 0;
    const textW = hasIcon ? 10.2 : 11.8;

    s.addText(slideTitle, {
      x: 0.7, y: 0.45, w: textW, h: 0.7,
      fontSize: 28, fontFace: 'Microsoft YaHei',
      color: theme.fg, bold: true, margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.2, w: 1.5, h: 0.05,
      fill: { color: theme.gold },
    });

    if (hasIcon) {
      const icon = icons[idx % icons.length];
      try {
        s.addImage({ path: icon, x: 11.2, y: 0.35, w: 1.5, h: 1.5 });
      } catch (_) { /* ignore */ }
    }

    const bullets = Array.isArray(slide.bullets) ? slide.bullets.filter(Boolean) : [];
    if (bullets.length) {
      const items = bullets.map((b) => ({
        text: String(b),
        options: {
          bullet: { type: 'bullet' },
          breakLine: true,
          color: theme.fg,
          fontSize: bullets.length > 7 ? 15 : 17,
          fontFace: 'Microsoft YaHei',
          paraSpaceAfter: 10,
        },
      }));
      s.addText(items, {
        x: 0.7, y: 1.55, w: textW, h: 5.0,
        valign: 'top',
        color: theme.fg,
      });
    } else if (slide.body) {
      s.addText(String(slide.body), {
        x: 0.7, y: 1.55, w: textW, h: 5.0,
        fontSize: 16, fontFace: 'Microsoft YaHei',
        color: theme.muted, valign: 'top',
      });
    }

    // corner sprite sprinkle on some slides
    if (icons.length > 1 && idx % 2 === 0) {
      const corner = icons[(idx + 1) % icons.length];
      try {
        s.addImage({ path: corner, x: 11.5, y: 5.6, w: 1.2, h: 1.2 });
      } catch (_) {}
    }

    s.addText(`${idx + 1} / ${slides.length}`, {
      x: 11.5, y: 7.05, w: 1.4, h: 0.3,
      fontSize: 11, fontFace: 'Microsoft YaHei',
      color: theme.muted, align: 'right', margin: 0,
    });
    const footerLabel = String(title).slice(0, 20);
    s.addText(footerLabel, {
      x: 0.7, y: 7.05, w: 8, h: 0.3,
      fontSize: 11, fontFace: 'Microsoft YaHei',
      color: theme.accentSoft, margin: 0,
    });

    if (slide.notes) {
      s.addNotes(String(slide.notes));
    }
  });

  // Closing slide
  {
    const s = pres.addSlide();
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 13.3, h: 7.5,
      fill: { color: theme.bg },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.18, h: 7.5,
      fill: { color: theme.gold },
    });
    s.addText('谢谢观看', {
      x: 0.9, y: 2.6, w: 11.2, h: 0.9,
      fontSize: 42, fontFace: 'Microsoft YaHei',
      color: theme.fg, bold: true, margin: 0,
    });
    s.addText(hasCollage ? '像素世界 · 愿记忆常新' : '愿记忆常新 · 岁岁年年', {
      x: 0.9, y: 3.6, w: 11.2, h: 0.5,
      fontSize: 18, fontFace: 'Microsoft YaHei',
      color: theme.muted, margin: 0,
    });
    if (icons[0]) {
      try {
        s.addImage({ path: icons[0], x: 11.2, y: 5.5, w: 1.4, h: 1.4 });
      } catch (_) {}
    }
    s.addText('Generated by ForgeAtoms + DeepSeek', {
      x: 0.9, y: 6.7, w: 11, h: 0.35,
      fontSize: 12, fontFace: 'Microsoft YaHei',
      color: theme.accentSoft, margin: 0,
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await pres.writeFile({ fileName: outPath });

  try {
    const { execFileSync } = require('child_process');
    execFileSync('office', ['validate', outPath, '--repair', '-o', outPath], {
      stdio: 'ignore',
      timeout: 60000,
    });
  } catch (_) {
    /* office CLI optional */
  }

  return outPath;
}

module.exports = { buildPptx, DEFAULT_THEME, PIXEL_THEME, mergeTheme };
