const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Authenticated preview of generated HTML
router.get('/preview/:projectId/:variant/*?', requireAuth, (req, res) => {
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.projectId, req.user.id);
  if (!project) return res.status(404).send('Project not found');

  const variant = String(req.params.variant || 'A').toUpperCase();
  let filename = req.params[0] || 'index.html';
  if (!filename || filename === '/') filename = 'index.html';
  filename = filename.replace(/^\/+/, '');
  if (!filename.includes('.')) filename = 'index.html';

  const art = db
    .prepare('SELECT content, content_type FROM artifacts WHERE project_id = ? AND variant = ? AND filename = ?')
    .get(project.id, variant, filename);
  if (!art) return res.status(404).send('Artifact not found');

  res.setHeader('Content-Type', art.content_type || 'text/html; charset=utf-8');
  // Allow iframe same-origin
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.send(art.content);
});

module.exports = router;
