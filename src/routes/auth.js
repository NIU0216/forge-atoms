const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.renderPage('register', { error: null, form: {} });
});

router.post('/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim() || email.split('@')[0];

  if (!email || !password) {
    return res.status(400).render('register', { error: '请填写邮箱和密码', form: { email, name } });
  }
  if (password.length < 6) {
    return res.status(400).render('register', { error: '密码至少 6 位', form: { email, name } });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.status(400).render('register', { error: '该邮箱已注册，请直接登录', form: { email, name } });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, hash, name);
  req.session.userId = id;
  res.redirect('/dashboard');
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.renderPage('login', { error: null, form: {}, next: req.query.next || '/dashboard' });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nextUrl = String(req.body.next || '/dashboard');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('login', { error: '邮箱或密码错误', form: { email }, next: nextUrl });
  }
  req.session.userId = user.id;
  res.redirect(nextUrl.startsWith('/') ? nextUrl : '/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
