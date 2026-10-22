const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const ejs = require('ejs');
const fs = require('fs');

require('./db'); // init schema

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const previewRoutes = require('./routes/preview');
const sourceRoutes = require('./routes/source');

const PORT = Number(process.env.PORT || 3847);
const VIEWS = path.join(__dirname, 'views');
const app = express();

app.set('view engine', 'ejs');
app.set('views', VIEWS);

function renderFile(view, data) {
  const file = path.join(VIEWS, view.endsWith('.ejs') ? view : view + '.ejs');
  const tpl = fs.readFileSync(file, 'utf8');
  return ejs.render(tpl, data, { filename: file, async: false });
}

app.use((req, res, next) => {
  res.renderPage = (view, options = {}) => {
    try {
      const locals = {
        ...res.locals,
        ...options,
        currentUser: res.locals.currentUser,
      };
      const body = renderFile(view, locals);
      const page = renderFile('layout', { ...locals, body, title: options.title });
      res.send(page);
    } catch (err) {
      next(err);
    }
  };
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    name: 'forgeatoms.sid',
    secret: process.env.SESSION_SECRET || 'forge-atoms-demo-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(attachUser);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '..', 'data', 'assets')));

app.get('/', (req, res) => res.renderPage('home', { title: '首页' }));

app.get('/assets-library', (req, res) => {
  const { loadManifest } = require('./services/assetLibrary');
  const manifest = loadManifest();
  const cat = String(req.query.cat || 'all');
  const labels = {
    characters: '人物',
    trees: '树木',
    flora: '花草',
    fruit: '水果',
    food: '美食',
    scenes: '场景',
  };
  const counts = {};
  for (const it of manifest.items) counts[it.category] = (counts[it.category] || 0) + 1;
  const categories = Object.keys(labels).map((key) => ({
    key,
    label: labels[key],
    count: counts[key] || 0,
  }));
  const items =
    cat && cat !== 'all'
      ? manifest.items.filter((it) => it.category === cat)
      : manifest.items;
  res.renderPage('assets-library', {
    title: '素材库',
    items,
    categories,
    category: cat,
    total: manifest.items.length,
  });
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'forge-atoms', port: PORT }));

app.use(sourceRoutes);

app.use(authRoutes);
app.use(projectRoutes);
app.use(previewRoutes);

app.use((req, res) => res.status(404).renderPage('error', { code: 404, message: '页面不存在', title: '404' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).renderPage('error', { code: 500, message: '服务器错误', title: '错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ForgeAtoms listening on http://0.0.0.0:${PORT}`);
});
