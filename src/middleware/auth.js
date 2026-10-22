function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.accepts('html')) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  return res.status(401).json({ error: 'unauthorized' });
}

function attachUser(req, res, next) {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    const { db } = require('../db');
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

module.exports = { requireAuth, attachUser };
