const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

const email = 'demo@forgeatoms.local';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.log('Demo account already exists:', email);
  process.exit(0);
}

const id = uuidv4();
const hash = bcrypt.hashSync('demo1234', 10);
db.prepare(
  'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
).run(id, email, hash, 'Demo 用户');

console.log('Seeded demo account:');
console.log('  email:    demo@forgeatoms.local');
console.log('  password: demo1234');
