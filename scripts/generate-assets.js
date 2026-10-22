#!/usr/bin/env node
/**
 * Generate Stardew-like pixel asset library (programmatic sprites).
 * Raw 16x16 / 32x32 grids → nearest-neighbor upscale to 128px PNGs + manifest.json
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', 'data', 'assets');
const DISPLAY = 128;

const C = {
  _: null, // transparent
  // greens / browns / cream / sky (farm cozy)
  g1: [52, 120, 58],
  g2: [74, 158, 72],
  g3: [120, 196, 98],
  g4: [168, 220, 130],
  br: [92, 58, 36],
  br2: [140, 92, 52],
  br3: [180, 130, 78],
  cr: [246, 236, 206],
  cr2: [232, 214, 170],
  sk: [140, 198, 230],
  sk2: [186, 220, 242],
  ye: [240, 196, 64],
  or: [230, 130, 56],
  rd: [196, 64, 64],
  pk: [232, 150, 170],
  bl: [70, 110, 180],
  pu: [140, 90, 170],
  wh: [255, 252, 245],
  bk: [40, 32, 28],
  gy: [160, 150, 140],
  water: [70, 140, 190],
  soil: [110, 78, 48],
};

function hex(rgb) {
  if (!rgb) return null;
  return rgb;
}

/** Expand compact string rows: each char maps via palette key length 1-2 */
function paint(rows, palette, size) {
  const w = size;
  const h = rows.length;
  const buf = Buffer.alloc(w * h * 4, 0);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      const col = palette[ch];
      if (!col) continue;
      const i = (y * w + x) * 4;
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = 255;
    }
  }
  return { buf, w, h };
}

async function saveSprite(relPath, rows, palette, logical = 16) {
  const { buf, w, h } = paint(rows, palette, logical);
  const out = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .resize(DISPLAY, DISPLAY, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(out);
  return relPath;
}

/** Fill a solid rect into a larger canvas grid (array of strings mutable via 2d) */
function blank(n, fill = '.') {
  return Array.from({ length: n }, () => fill.repeat(n).split(''));
}
function setPx(grid, x, y, ch) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = ch;
}
function fillRect(grid, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(grid, x, y, ch);
}
function toRows(grid) {
  return grid.map((r) => r.join(''));
}

const items = [];

function add(id, category, name, tags, file) {
  items.push({ id, category, tags, file, name });
}

async function genCharacters() {
  const specs = [
    {
      id: 'char_farmer_m',
      name: '农夫',
      tags: ['人物', '农夫', 'farmer', '男', '农场', '角色'],
      draw: (g) => {
        // hat
        fillRect(g, 5, 2, 10, 3, 'h');
        fillRect(g, 4, 3, 11, 3, 'h');
        // head
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        // body shirt
        fillRect(g, 5, 8, 10, 11, 'b');
        // arms
        fillRect(g, 3, 8, 4, 11, 's');
        fillRect(g, 11, 8, 12, 11, 's');
        // pants
        fillRect(g, 5, 12, 7, 14, 'p');
        fillRect(g, 8, 12, 10, 14, 'p');
        // boots
        fillRect(g, 5, 15, 7, 15, 'o');
        fillRect(g, 8, 15, 10, 15, 'o');
      },
      pal: { h: C.br2, s: C.cr2, e: C.bk, b: C.bl, p: C.br, o: C.br },
    },
    {
      id: 'char_farmer_f',
      name: '农妇',
      tags: ['人物', '农妇', 'farmer', '女', '农场', '角色'],
      draw: (g) => {
        fillRect(g, 5, 1, 10, 3, 'hair');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 12, 'd');
        fillRect(g, 3, 8, 4, 10, 's');
        fillRect(g, 11, 8, 12, 10, 's');
        fillRect(g, 5, 13, 7, 14, 's');
        fillRect(g, 8, 13, 10, 14, 's');
        fillRect(g, 5, 15, 7, 15, 'o');
        fillRect(g, 8, 15, 10, 15, 'o');
      },
      pal: { hair: C.ye, s: C.cr2, e: C.bk, d: C.pk, o: C.br },
    },
    {
      id: 'char_kid',
      name: '小孩',
      tags: ['人物', '小孩', 'child', '孩子', '角色'],
      draw: (g) => {
        fillRect(g, 6, 3, 9, 5, 's');
        setPx(g, 7, 4, 'e');
        setPx(g, 8, 4, 'e');
        fillRect(g, 6, 6, 9, 9, 'b');
        fillRect(g, 5, 6, 5, 8, 's');
        fillRect(g, 10, 6, 10, 8, 's');
        fillRect(g, 6, 10, 7, 12, 'p');
        fillRect(g, 8, 10, 9, 12, 'p');
        fillRect(g, 6, 13, 7, 13, 'o');
        fillRect(g, 8, 13, 9, 13, 'o');
      },
      pal: { s: C.cr2, e: C.bk, b: C.ye, p: C.bl, o: C.br },
    },
    {
      id: 'char_merchant',
      name: '商人',
      tags: ['人物', '商人', 'merchant', 'NPC', '角色'],
      draw: (g) => {
        fillRect(g, 5, 2, 10, 3, 'hat');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 12, 'c');
        fillRect(g, 4, 9, 4, 11, 's');
        fillRect(g, 11, 9, 11, 11, 's');
        fillRect(g, 5, 13, 7, 14, 'p');
        fillRect(g, 8, 13, 10, 14, 'p');
        fillRect(g, 5, 15, 10, 15, 'o');
      },
      pal: { hat: C.pu, s: C.cr2, e: C.bk, c: C.or, p: C.br, o: C.bk },
    },
    {
      id: 'char_fisher',
      name: '渔夫',
      tags: ['人物', '渔夫', 'fisher', '钓鱼', '水', '角色'],
      draw: (g) => {
        fillRect(g, 4, 2, 11, 3, 'hat');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 11, 'b');
        fillRect(g, 12, 6, 12, 12, 'rod');
        fillRect(g, 5, 12, 7, 14, 'p');
        fillRect(g, 8, 12, 10, 14, 'p');
        fillRect(g, 5, 15, 10, 15, 'o');
      },
      pal: { hat: C.g2, s: C.cr2, e: C.bk, b: C.water, rod: C.br, p: C.br2, o: C.br },
    },
    {
      id: 'char_witch',
      name: '女巫',
      tags: ['人物', '女巫', 'witch', '魔法', '角色', '节日'],
      draw: (g) => {
        fillRect(g, 7, 0, 8, 1, 'hat');
        fillRect(g, 5, 2, 10, 3, 'hat');
        fillRect(g, 4, 3, 11, 3, 'hat');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 14, 'r');
        fillRect(g, 4, 8, 4, 11, 's');
        fillRect(g, 11, 8, 11, 11, 's');
        fillRect(g, 5, 15, 10, 15, 'o');
      },
      pal: { hat: C.pu, s: C.cr2, e: C.rd, r: C.pu, o: C.bk },
    },
    {
      id: 'char_chef',
      name: '厨师',
      tags: ['人物', '厨师', 'chef', '美食', '厨房', '角色'],
      draw: (g) => {
        fillRect(g, 5, 1, 10, 3, 'hat');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 12, 'w');
        setPx(g, 7, 9, 'rd');
        setPx(g, 8, 9, 'rd');
        fillRect(g, 5, 13, 7, 14, 'p');
        fillRect(g, 8, 13, 10, 14, 'p');
        fillRect(g, 5, 15, 10, 15, 'o');
      },
      pal: { hat: C.wh, s: C.cr2, e: C.bk, w: C.wh, rd: C.rd, p: C.bk, o: C.br },
    },
    {
      id: 'char_miner',
      name: '矿工',
      tags: ['人物', '矿工', 'miner', '洞穴', '角色'],
      draw: (g) => {
        fillRect(g, 5, 2, 10, 3, 'hat');
        setPx(g, 7, 2, 'ye');
        fillRect(g, 5, 4, 10, 7, 's');
        setPx(g, 6, 5, 'e');
        setPx(g, 9, 5, 'e');
        fillRect(g, 5, 8, 10, 11, 'b');
        fillRect(g, 5, 12, 7, 14, 'p');
        fillRect(g, 8, 12, 10, 14, 'p');
        fillRect(g, 5, 15, 10, 15, 'o');
      },
      pal: { hat: C.ye, ye: C.ye, s: C.cr2, e: C.bk, b: C.gy, p: C.br, o: C.bk },
    },
  ];

  for (const s of specs) {
    const g = blank(16);
    s.draw(g);
    const file = `characters/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, 16);
    add(s.id, 'characters', s.name, s.tags, file);
  }
}

async function genTrees() {
  const specs = [
    {
      id: 'tree_oak_01',
      name: '橡树',
      tags: ['树木', '橡树', 'oak', '森林', '自然', '户外', '绿'],
      draw: (g) => {
        fillRect(g, 7, 10, 8, 15, 't');
        fillRect(g, 3, 3, 12, 9, 'l');
        fillRect(g, 5, 1, 10, 3, 'l');
        fillRect(g, 4, 5, 5, 6, 'l2');
        fillRect(g, 10, 4, 11, 5, 'l2');
      },
      pal: { t: C.br, l: C.g2, l2: C.g3 },
    },
    {
      id: 'tree_pine_01',
      name: '松树',
      tags: ['树木', '松树', 'pine', '森林', '自然', '冬天', '绿'],
      draw: (g) => {
        fillRect(g, 7, 12, 8, 15, 't');
        fillRect(g, 6, 9, 9, 11, 'l');
        fillRect(g, 5, 6, 10, 8, 'l');
        fillRect(g, 4, 3, 11, 5, 'l');
        fillRect(g, 6, 1, 9, 2, 'l2');
      },
      pal: { t: C.br, l: C.g1, l2: C.g2 },
    },
    {
      id: 'tree_apple_01',
      name: '苹果树',
      tags: ['树木', '苹果树', '果树', '水果', '自然', '农场'],
      draw: (g) => {
        fillRect(g, 7, 11, 8, 15, 't');
        fillRect(g, 3, 3, 12, 10, 'l');
        setPx(g, 5, 5, 'a');
        setPx(g, 9, 6, 'a');
        setPx(g, 7, 8, 'a');
        setPx(g, 11, 5, 'a');
      },
      pal: { t: C.br, l: C.g3, a: C.rd },
    },
    {
      id: 'tree_cherry_01',
      name: '樱花树',
      tags: ['树木', '樱花', 'cherry', '春天', '粉', '自然', '节日'],
      draw: (g) => {
        fillRect(g, 7, 11, 8, 15, 't');
        fillRect(g, 3, 2, 12, 10, 'p');
        fillRect(g, 5, 1, 10, 2, 'p2');
        setPx(g, 4, 5, 'w');
        setPx(g, 10, 4, 'w');
        setPx(g, 8, 7, 'w');
      },
      pal: { t: C.br, p: C.pk, p2: C.wh, w: C.wh },
    },
    {
      id: 'tree_palm_01',
      name: '椰子树',
      tags: ['树木', '椰子', 'palm', '海滩', '夏天', '自然'],
      draw: (g) => {
        fillRect(g, 7, 6, 8, 15, 't');
        fillRect(g, 2, 3, 5, 4, 'l');
        fillRect(g, 10, 3, 13, 4, 'l');
        fillRect(g, 5, 1, 10, 3, 'l2');
        setPx(g, 6, 5, 'c');
        setPx(g, 9, 5, 'c');
      },
      pal: { t: C.br2, l: C.g2, l2: C.g3, c: C.br3 },
    },
    {
      id: 'tree_willow_01',
      name: '柳树',
      tags: ['树木', '柳树', 'willow', '水边', '自然', '绿'],
      draw: (g) => {
        fillRect(g, 7, 8, 8, 15, 't');
        fillRect(g, 2, 2, 13, 7, 'l');
        for (let x = 2; x <= 13; x += 2) fillRect(g, x, 8, x, 12, 'l2');
      },
      pal: { t: C.br, l: C.g3, l2: C.g4 },
    },
    {
      id: 'tree_dead_01',
      name: '枯树',
      tags: ['树木', '枯树', '秋天', '冬天', '自然', '棕'],
      draw: (g) => {
        fillRect(g, 7, 8, 8, 15, 't');
        fillRect(g, 4, 4, 5, 7, 't');
        fillRect(g, 10, 3, 11, 7, 't');
        fillRect(g, 6, 2, 9, 4, 't');
      },
      pal: { t: C.br },
    },
    {
      id: 'tree_maple_01',
      name: '枫树',
      tags: ['树木', '枫树', 'maple', '秋天', '红', '自然'],
      draw: (g) => {
        fillRect(g, 7, 11, 8, 15, 't');
        fillRect(g, 3, 3, 12, 10, 'l');
        fillRect(g, 5, 1, 10, 3, 'l2');
      },
      pal: { t: C.br, l: C.or, l2: C.rd },
    },
  ];
  for (const s of specs) {
    const g = blank(16);
    s.draw(g);
    const file = `trees/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, 16);
    add(s.id, 'trees', s.name, s.tags, file);
  }
}

async function genFlora() {
  const specs = [
    {
      id: 'flora_tulip',
      name: '郁金香',
      tags: ['花草', '郁金香', '花', '春天', '粉', '花园'],
      draw: (g) => {
        fillRect(g, 7, 8, 8, 15, 'st');
        fillRect(g, 6, 3, 9, 7, 'f');
        fillRect(g, 5, 4, 5, 6, 'f');
        fillRect(g, 10, 4, 10, 6, 'f');
      },
      pal: { st: C.g2, f: C.pk },
    },
    {
      id: 'flora_sunflower',
      name: '向日葵',
      tags: ['花草', '向日葵', '花', '夏天', '黄', '阳光'],
      draw: (g) => {
        fillRect(g, 7, 9, 8, 15, 'st');
        fillRect(g, 5, 3, 10, 8, 'p');
        fillRect(g, 6, 4, 9, 7, 'c');
      },
      pal: { st: C.g2, p: C.ye, c: C.br2 },
    },
    {
      id: 'flora_rose',
      name: '玫瑰',
      tags: ['花草', '玫瑰', '花', '红', '爱情', '礼物'],
      draw: (g) => {
        fillRect(g, 7, 8, 8, 15, 'st');
        fillRect(g, 5, 3, 10, 7, 'f');
        setPx(g, 7, 5, 'd');
        setPx(g, 8, 5, 'd');
        setPx(g, 5, 10, 'l');
        setPx(g, 10, 11, 'l');
      },
      pal: { st: C.g1, f: C.rd, d: C.pk, l: C.g3 },
    },
    {
      id: 'flora_lavender',
      name: '薰衣草',
      tags: ['花草', '薰衣草', '紫', '田野', '放松'],
      draw: (g) => {
        fillRect(g, 7, 6, 8, 15, 'st');
        fillRect(g, 6, 2, 9, 6, 'f');
        fillRect(g, 5, 3, 5, 5, 'f');
        fillRect(g, 10, 3, 10, 5, 'f');
      },
      pal: { st: C.g2, f: C.pu },
    },
    {
      id: 'flora_grass_tuft',
      name: '草丛',
      tags: ['花草', '草', 'grass', '自然', '户外', '绿'],
      draw: (g) => {
        for (let i = 0; i < 6; i++) {
          const x = 3 + i * 2;
          fillRect(g, x, 8 + (i % 3), x, 15, i % 2 ? 'a' : 'b');
        }
      },
      pal: { a: C.g2, b: C.g3 },
    },
    {
      id: 'flora_mushroom',
      name: '蘑菇',
      tags: ['花草', '蘑菇', '森林', '食物', '红'],
      draw: (g) => {
        fillRect(g, 6, 8, 9, 14, 'st');
        fillRect(g, 3, 4, 12, 8, 'cap');
        fillRect(g, 5, 3, 10, 3, 'cap');
        setPx(g, 5, 5, 'd');
        setPx(g, 9, 6, 'd');
        setPx(g, 7, 5, 'd');
      },
      pal: { st: C.cr, cap: C.rd, d: C.wh },
    },
    {
      id: 'flora_fern',
      name: '蕨类',
      tags: ['花草', '蕨', 'fern', '森林', '绿', '自然'],
      draw: (g) => {
        fillRect(g, 7, 4, 8, 15, 'st');
        for (let y = 4; y < 14; y += 2) {
          fillRect(g, 3, y, 6, y, 'l');
          fillRect(g, 9, y + 1, 12, y + 1, 'l');
        }
      },
      pal: { st: C.g1, l: C.g3 },
    },
    {
      id: 'flora_daisy',
      name: '雏菊',
      tags: ['花草', '雏菊', 'daisy', '白', '春天', '花'],
      draw: (g) => {
        fillRect(g, 7, 8, 8, 15, 'st');
        fillRect(g, 5, 3, 10, 8, 'p');
        fillRect(g, 6, 4, 9, 7, 'c');
      },
      pal: { st: C.g2, p: C.wh, c: C.ye },
    },
  ];
  for (const s of specs) {
    const g = blank(16);
    s.draw(g);
    const file = `flora/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, 16);
    add(s.id, 'flora', s.name, s.tags, file);
  }
}

async function genFruit() {
  const specs = [
    {
      id: 'fruit_apple',
      name: '苹果',
      tags: ['水果', '苹果', 'apple', '红', '健康', '零食'],
      draw: (g) => {
        fillRect(g, 4, 5, 11, 12, 'a');
        fillRect(g, 5, 4, 10, 4, 'a');
        fillRect(g, 5, 13, 10, 13, 'a');
        fillRect(g, 7, 2, 8, 4, 'st');
        setPx(g, 9, 3, 'l');
        setPx(g, 6, 7, 'h');
      },
      pal: { a: C.rd, st: C.br, l: C.g3, h: C.wh },
    },
    {
      id: 'fruit_orange',
      name: '橙子',
      tags: ['水果', '橙子', 'orange', '橙', '维生素', '零食'],
      draw: (g) => {
        fillRect(g, 4, 5, 11, 12, 'o');
        fillRect(g, 5, 4, 10, 4, 'o');
        fillRect(g, 5, 13, 10, 13, 'o');
        fillRect(g, 7, 3, 8, 4, 'st');
        setPx(g, 6, 7, 'h');
      },
      pal: { o: C.or, st: C.g2, h: C.ye },
    },
    {
      id: 'fruit_grape',
      name: '葡萄',
      tags: ['水果', '葡萄', 'grape', '紫', '甜', '酒'],
      draw: (g) => {
        fillRect(g, 7, 2, 8, 4, 'st');
        const pts = [
          [5, 5],
          [7, 5],
          [9, 5],
          [4, 7],
          [6, 7],
          [8, 7],
          [10, 7],
          [5, 9],
          [7, 9],
          [9, 9],
          [6, 11],
          [8, 11],
        ];
        for (const [x, y] of pts) fillRect(g, x, y, x + 1, y + 1, 'g');
      },
      pal: { st: C.g1, g: C.pu },
    },
    {
      id: 'fruit_strawberry',
      name: '草莓',
      tags: ['水果', '草莓', 'strawberry', '红', '甜', '夏天'],
      draw: (g) => {
        fillRect(g, 5, 5, 10, 12, 'b');
        fillRect(g, 6, 4, 9, 4, 'b');
        fillRect(g, 6, 13, 9, 13, 'b');
        fillRect(g, 5, 2, 10, 3, 'l');
        setPx(g, 6, 7, 'd');
        setPx(g, 8, 8, 'd');
        setPx(g, 7, 10, 'd');
      },
      pal: { b: C.rd, l: C.g3, d: C.ye },
    },
    {
      id: 'fruit_watermelon',
      name: '西瓜',
      tags: ['水果', '西瓜', 'watermelon', '夏天', '绿', '清凉'],
      draw: (g) => {
        fillRect(g, 3, 6, 12, 12, 'g');
        fillRect(g, 4, 5, 11, 5, 'g');
        fillRect(g, 4, 13, 11, 13, 'g');
        fillRect(g, 5, 7, 10, 11, 'r');
        setPx(g, 7, 9, 's');
        setPx(g, 8, 8, 's');
      },
      pal: { g: C.g1, r: C.rd, s: C.bk },
    },
    {
      id: 'fruit_banana',
      name: '香蕉',
      tags: ['水果', '香蕉', 'banana', '黄', '热带', '零食'],
      draw: (g) => {
        for (let i = 0; i < 8; i++) {
          fillRect(g, 4 + Math.floor(i / 2), 4 + i, 7 + Math.floor(i / 2), 5 + i, 'y');
        }
        fillRect(g, 10, 3, 11, 4, 'st');
      },
      pal: { y: C.ye, st: C.br },
    },
    {
      id: 'fruit_peach',
      name: '桃子',
      tags: ['水果', '桃子', 'peach', '粉', '夏天', '甜'],
      draw: (g) => {
        fillRect(g, 4, 5, 11, 12, 'p');
        fillRect(g, 5, 4, 10, 4, 'p');
        fillRect(g, 5, 13, 10, 13, 'p');
        fillRect(g, 7, 2, 8, 3, 'st');
        setPx(g, 9, 3, 'l');
        setPx(g, 6, 7, 'h');
      },
      pal: { p: C.pk, st: C.br, l: C.g3, h: C.wh },
    },
    {
      id: 'fruit_blueberry',
      name: '蓝莓',
      tags: ['水果', '蓝莓', 'blueberry', '蓝', '浆果', '健康'],
      draw: (g) => {
        const pts = [
          [5, 6],
          [8, 5],
          [11, 6],
          [4, 9],
          [7, 8],
          [10, 9],
          [6, 11],
          [9, 11],
        ];
        for (const [x, y] of pts) fillRect(g, x, y, x + 2, y + 2, 'b');
      },
      pal: { b: C.bl },
    },
  ];
  for (const s of specs) {
    const g = blank(16);
    s.draw(g);
    const file = `fruit/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, 16);
    add(s.id, 'fruit', s.name, s.tags, file);
  }
}

async function genFood() {
  const specs = [
    {
      id: 'food_bread',
      name: '面包',
      tags: ['美食', '面包', 'bread', '早餐', '烘焙', '小麦'],
      draw: (g) => {
        fillRect(g, 3, 7, 12, 12, 'b');
        fillRect(g, 4, 5, 11, 6, 'b');
        fillRect(g, 5, 4, 10, 4, 'c');
        setPx(g, 6, 8, 'l');
        setPx(g, 9, 9, 'l');
      },
      pal: { b: C.br3, c: C.cr, l: C.br },
    },
    {
      id: 'food_pie',
      name: '馅饼',
      tags: ['美食', '馅饼', 'pie', '甜点', '烘焙', '节日'],
      draw: (g) => {
        fillRect(g, 3, 8, 12, 13, 'cr');
        fillRect(g, 4, 5, 11, 8, 'f');
        fillRect(g, 5, 4, 10, 4, 'cr');
        setPx(g, 7, 6, 'd');
        setPx(g, 8, 7, 'd');
      },
      pal: { cr: C.br3, f: C.or, d: C.ye },
    },
    {
      id: 'food_soup',
      name: '汤',
      tags: ['美食', '汤', 'soup', '热', '晚餐', '舒适'],
      draw: (g) => {
        fillRect(g, 4, 7, 11, 13, 'bowl');
        fillRect(g, 3, 8, 3, 11, 'bowl');
        fillRect(g, 12, 8, 12, 11, 'bowl');
        fillRect(g, 5, 6, 10, 8, 'liq');
        setPx(g, 6, 7, 'v');
        setPx(g, 9, 7, 'v');
      },
      pal: { bowl: C.cr2, liq: C.or, v: C.g3 },
    },
    {
      id: 'food_fish_dish',
      name: '烤鱼',
      tags: ['美食', '鱼', 'fish', '海鲜', '晚餐'],
      draw: (g) => {
        fillRect(g, 4, 6, 11, 10, 'f');
        fillRect(g, 11, 7, 13, 9, 't');
        setPx(g, 6, 7, 'e');
        fillRect(g, 3, 11, 12, 13, 'pl');
      },
      pal: { f: C.gy, t: C.gy, e: C.bk, pl: C.wh },
    },
    {
      id: 'food_salad',
      name: '沙拉',
      tags: ['美食', '沙拉', 'salad', '健康', '蔬菜', '绿'],
      draw: (g) => {
        fillRect(g, 4, 8, 11, 13, 'bowl');
        fillRect(g, 5, 5, 10, 8, 'g');
        setPx(g, 6, 6, 't');
        setPx(g, 9, 7, 't');
        setPx(g, 7, 5, 'y');
      },
      pal: { bowl: C.wh, g: C.g3, t: C.rd, y: C.ye },
    },
    {
      id: 'food_cake',
      name: '蛋糕',
      tags: ['美食', '蛋糕', 'cake', '甜点', '庆祝', '生日', '节日'],
      draw: (g) => {
        fillRect(g, 4, 8, 11, 13, 'c');
        fillRect(g, 5, 5, 10, 7, 'f');
        fillRect(g, 6, 3, 7, 4, 'cd');
        fillRect(g, 9, 3, 10, 4, 'cd');
        setPx(g, 6, 2, 'fl');
        setPx(g, 9, 2, 'fl');
      },
      pal: { c: C.cr2, f: C.pk, cd: C.wh, fl: C.ye },
    },
    {
      id: 'food_coffee',
      name: '咖啡',
      tags: ['美食', '咖啡', 'coffee', '热饮', '早晨', '提神'],
      draw: (g) => {
        fillRect(g, 5, 6, 10, 13, 'm');
        fillRect(g, 11, 8, 12, 11, 'm');
        fillRect(g, 6, 5, 9, 6, 'liq');
        setPx(g, 7, 3, 's');
        setPx(g, 8, 2, 's');
      },
      pal: { m: C.wh, liq: C.br, s: C.gy },
    },
    {
      id: 'food_rice_bowl',
      name: '饭碗',
      tags: ['美食', '米饭', 'rice', '中餐', '主食', '碗'],
      draw: (g) => {
        fillRect(g, 4, 9, 11, 13, 'bowl');
        fillRect(g, 5, 6, 10, 9, 'r');
        setPx(g, 7, 7, 'g');
        setPx(g, 8, 8, 'g');
      },
      pal: { bowl: C.bl, r: C.wh, g: C.g3 },
    },
  ];
  for (const s of specs) {
    const g = blank(16);
    s.draw(g);
    const file = `food/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, 16);
    add(s.id, 'food', s.name, s.tags, file);
  }
}

async function genScenes() {
  // 32x32 scenes for richer backdrops
  const specs = [
    {
      id: 'scene_farm_morning',
      name: '晨曦农场',
      tags: ['场景', '农场', '早晨', '田野', '户外', '天空', 'farm'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 14, 'sk');
        fillRect(g, 0, 15, 31, 31, 'gr');
        fillRect(g, 22, 4, 26, 8, 'sun');
        fillRect(g, 4, 18, 8, 28, 'barn');
        fillRect(g, 5, 16, 7, 17, 'roof');
        fillRect(g, 12, 22, 28, 24, 'path');
      },
      pal: { sk: C.sk2, gr: C.g3, sun: C.ye, barn: C.rd, roof: C.br, path: C.br3 },
      size: 32,
    },
    {
      id: 'scene_forest_path',
      name: '林间小径',
      tags: ['场景', '森林', '小路', '自然', '绿', '户外', 'forest'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 31, 'gr');
        fillRect(g, 12, 0, 19, 31, 'path');
        fillRect(g, 2, 4, 6, 18, 't');
        fillRect(g, 24, 8, 28, 22, 't');
        fillRect(g, 1, 2, 7, 8, 'l');
        fillRect(g, 23, 4, 29, 12, 'l');
      },
      pal: { gr: C.g2, path: C.br3, t: C.br, l: C.g1 },
      size: 32,
    },
    {
      id: 'scene_lake',
      name: '湖畔',
      tags: ['场景', '湖', '水', '湖畔', '自然', '蓝', '平静'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 12, 'sk');
        fillRect(g, 0, 13, 31, 18, 'gr');
        fillRect(g, 0, 19, 31, 31, 'w');
        fillRect(g, 4, 8, 6, 16, 't');
        fillRect(g, 3, 4, 7, 9, 'l');
      },
      pal: { sk: C.sk, gr: C.g3, w: C.water, t: C.br, l: C.g2 },
      size: 32,
    },
    {
      id: 'scene_cottage',
      name: '乡村小屋',
      tags: ['场景', '小屋', '家', '乡村', '房子', '温馨', 'cottage'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 16, 'sk');
        fillRect(g, 0, 17, 31, 31, 'gr');
        fillRect(g, 8, 12, 22, 24, 'wall');
        fillRect(g, 7, 8, 23, 12, 'roof');
        fillRect(g, 12, 16, 15, 20, 'win');
        fillRect(g, 17, 18, 20, 24, 'door');
      },
      pal: { sk: C.sk2, gr: C.g3, wall: C.cr2, roof: C.br, win: C.sk, door: C.br2 },
      size: 32,
    },
    {
      id: 'scene_market',
      name: '市集',
      tags: ['场景', '市集', '市场', '摊位', '热闹', '食物', 'market'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 14, 'sk');
        fillRect(g, 0, 15, 31, 31, 'gr');
        fillRect(g, 3, 10, 12, 22, 'stall');
        fillRect(g, 3, 8, 12, 10, 'awning');
        fillRect(g, 18, 10, 28, 22, 'stall2');
        fillRect(g, 18, 8, 28, 10, 'awning2');
        fillRect(g, 5, 18, 10, 20, 'fruit');
      },
      pal: {
        sk: C.sk,
        gr: C.br3,
        stall: C.cr,
        awning: C.rd,
        stall2: C.cr2,
        awning2: C.bl,
        fruit: C.or,
      },
      size: 32,
    },
    {
      id: 'scene_night_sky',
      name: '星空夜晚',
      tags: ['场景', '夜晚', '星空', '月亮', '安静', 'night'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 22, 'sky');
        fillRect(g, 0, 23, 31, 31, 'gr');
        fillRect(g, 22, 4, 26, 8, 'moon');
        setPx(g, 5, 3, 'st');
        setPx(g, 12, 6, 'st');
        setPx(g, 18, 2, 'st');
        setPx(g, 8, 10, 'st');
        setPx(g, 28, 12, 'st');
      },
      pal: { sky: [30, 40, 70], gr: C.g1, moon: C.cr, st: C.ye },
      size: 32,
    },
    {
      id: 'scene_beach',
      name: '沙滩',
      tags: ['场景', '沙滩', '海', '夏天', '假期', '蓝', 'beach'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 12, 'sk');
        fillRect(g, 0, 13, 31, 20, 'sea');
        fillRect(g, 0, 21, 31, 31, 'sand');
        fillRect(g, 4, 10, 5, 20, 'palm');
        fillRect(g, 2, 8, 7, 10, 'leaf');
      },
      pal: { sk: C.sk2, sea: C.water, sand: C.cr2, palm: C.br2, leaf: C.g2 },
      size: 32,
    },
    {
      id: 'scene_snow_farm',
      name: '雪中农场',
      tags: ['场景', '冬天', '雪', '农场', '白', '节日', 'winter'],
      draw: (g) => {
        fillRect(g, 0, 0, 31, 14, 'sk');
        fillRect(g, 0, 15, 31, 31, 'snow');
        fillRect(g, 20, 6, 24, 10, 'sun');
        fillRect(g, 6, 12, 14, 24, 'barn');
        fillRect(g, 5, 9, 15, 12, 'roof');
        setPx(g, 3, 5, 'fl');
        setPx(g, 18, 4, 'fl');
        setPx(g, 28, 8, 'fl');
      },
      pal: { sk: [180, 200, 220], snow: C.wh, sun: C.ye, barn: C.rd, roof: C.br, fl: C.wh },
      size: 32,
    },
  ];
  for (const s of specs) {
    const n = s.size || 32;
    const g = blank(n);
    s.draw(g);
    const file = `scenes/${s.id}.png`;
    await saveSprite(file, toRows(g), s.pal, n);
    add(s.id, 'scenes', s.name, s.tags, file);
  }
}

async function main() {
  await genCharacters();
  await genTrees();
  await genFlora();
  await genFruit();
  await genFood();
  await genScenes();

  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    display_size: DISPLAY,
    items,
  };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const byCat = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] || 0) + 1;
  console.log('Generated assets:', items.length, byCat);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
