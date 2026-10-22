const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const ROOT = path.resolve(__dirname, '..', '..');

const ALLOW_EXT = new Set([
  '.js', '.ejs', '.css', '.json', '.md', '.html', '.txt', '.sh', '.svg',
]);
const BLOCK_NAMES = new Set([
  '.env', '.env.local', '.env.production', 'package-lock.json',
]);
const BLOCK_DIRS = new Set([
  'node_modules', '.git', 'data',
]);

function isInsideRoot(p) {
  const resolved = path.resolve(p);
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep);
}

function isBlocked(rel) {
  const parts = rel.split(/[/\\]/).filter(Boolean);
  if (parts.some((p) => BLOCK_DIRS.has(p))) return true;
  if (parts.some((p) => p.startsWith('.env'))) return true;
  const base = parts[parts.length - 1] || '';
  if (BLOCK_NAMES.has(base)) return true;
  if (base.endsWith('.db') || base.endsWith('.pptx') || base.endsWith('.png') || base.endsWith('.zip')) return true;
  return false;
}

function redact(text) {
  let s = String(text);
  // Never show real secrets if somehow present
  s = s.replace(/sk-[a-zA-Z0-9]{10,}/g, '[REDACTED_KEY]');
  s = s.replace(/(Bearer\s+)[A-Za-z0-9._\-]{12,}/gi, '$1[REDACTED_TOKEN]');
  s = s.replace(/(DEEPSEEK_API_KEY\s*[=:]\s*)(["']?)[^"'\\s]+\\2/gi, '$1$2[REDACTED]$2');
  s = s.replace(/(api[_-]?key\s*[=:]\s*)(["']?)(?!process\.env)[^"'\\s]{8,}\2/gi, '$1$2[REDACTED]$2');
  s = s.replace(/(Authorization["']?\s*:\s*["']Bearer\s+)[^"']+/gi, '$1[REDACTED]');
  return s;
}

function listTree(dir, relBase = '') {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.gitignore') continue;
    const rel = relBase ? relBase + '/' + ent.name : ent.name;
    if (isBlocked(rel)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push({ type: 'dir', path: rel, name: ent.name });
      out.push(...listTree(full, rel));
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (!ALLOW_EXT.has(ext)) continue;
      out.push({ type: 'file', path: rel, name: ent.name });
    }
  }
  return out;
}

router.get('/source', (req, res) => {
  const tree = listTree(ROOT).filter((x) => x.type === 'file');
  const groups = {};
  for (const f of tree) {
    const top = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
    if (!groups[top]) groups[top] = [];
    groups[top].push(f);
  }
  res.renderPage('source', {
    title: '源代码',
    tree,
    groups,
    file: null,
    content: null,
    notice: '只读浏览；API Key 仅存在于服务器环境变量，不会出现在源码页。',
  });
});

router.get('/source/view', (req, res) => {
  const rel = String(req.query.f || '').replace(/\\/g, '/');
  if (!rel || rel.includes('..') || path.isAbsolute(rel) || isBlocked(rel)) {
    return res.status(400).renderPage('error', { code: 400, message: '非法路径', title: '错误' });
  }
  const full = path.resolve(ROOT, rel);
  if (!isInsideRoot(full) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).renderPage('error', { code: 404, message: '文件不存在', title: '404' });
  }
  const ext = path.extname(full).toLowerCase();
  if (!ALLOW_EXT.has(ext)) {
    return res.status(403).renderPage('error', { code: 403, message: '该类型不可浏览', title: '禁止' });
  }
  let raw = fs.readFileSync(full, 'utf8');
  // Cap size for browser
  if (raw.length > 400000) raw = raw.slice(0, 400000) + '\n\n/* … truncated … */\n';
  const content = redact(raw);
  const tree = listTree(ROOT).filter((x) => x.type === 'file');
  const groups = {};
  for (const f of tree) {
    const top = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
    if (!groups[top]) groups[top] = [];
    groups[top].push(f);
  }
  res.renderPage('source', {
    title: rel,
    tree,
    groups,
    file: rel,
    content,
    notice: '已自动脱敏疑似密钥；DEEPSEEK_API_KEY 不会写入仓库或本页。',
  });
});

router.get('/source/raw', (req, res) => {
  const rel = String(req.query.f || '').replace(/\\/g, '/');
  if (!rel || rel.includes('..') || path.isAbsolute(rel) || isBlocked(rel)) {
    return res.status(400).type('text').send('bad path');
  }
  const full = path.resolve(ROOT, rel);
  if (!isInsideRoot(full) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return res.status(404).type('text').send('not found');
  }
  const ext = path.extname(full).toLowerCase();
  if (!ALLOW_EXT.has(ext)) return res.status(403).type('text').send('forbidden');
  let raw = fs.readFileSync(full, 'utf8');
  res.type('text/plain; charset=utf-8').send(redact(raw));
});

module.exports = router;
