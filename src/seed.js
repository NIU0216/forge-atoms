const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

const DEMO_EMAIL = 'demo@forgeatoms.local';
const DEMO_PASSWORD = 'demo1234';
const DEMO_NAME = 'Demo 用户';

/**
 * Create the demo account when missing. Safe to call on every boot.
 * @returns {{ created: boolean, email: string }}
 */
function ensureDemoUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);
  if (existing) {
    return { created: false, email: DEMO_EMAIL };
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
  ).run(id, DEMO_EMAIL, hash, DEMO_NAME);

  return { created: true, email: DEMO_EMAIL };
}

if (require.main === module) {
  const result = ensureDemoUser();
  if (result.created) {
    console.log('Seeded demo account:');
    console.log('  email:   ', DEMO_EMAIL);
    console.log('  password:', DEMO_PASSWORD);
  } else {
    console.log('Demo account already exists:', DEMO_EMAIL);
  }
}

module.exports = { ensureDemoUser, DEMO_EMAIL };
