const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { seed } = require('./seed');

const dbFile = path.join(__dirname, '..', 'data', 'still-room.sqlite');
let db;

function save() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const bytes = db.export();
  fs.writeFileSync(dbFile, Buffer.from(bytes));
  // #region agent log
  fetch('http://127.0.0.1:7878/ingest/9a85748d-e216-49b2-ae8f-dd4a6bd14968', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '44b7c5' },
    body: JSON.stringify({
      sessionId: '44b7c5',
      runId: 'post-fix',
      hypothesisId: 'D',
      location: 'db.js:save',
      message: 'database file written',
      data: { bytes: bytes.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const row = get('SELECT last_insert_rowid() AS id');
  return row ? row.id : null;
}

function migrate() {
  db.run(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      intro TEXT,
      hero_image TEXT,
      sort_order INTEGER
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      size TEXT,
      short_description TEXT,
      long_description TEXT,
      notes TEXT,
      ingredients TEXT,
      how_to_use TEXT,
      precautions TEXT,
      image TEXT,
      featured INTEGER DEFAULT 0,
      in_stock INTEGER DEFAULT 1,
      is_starter INTEGER DEFAULT 0
    );
    CREATE TABLE settings (
      name TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT
    );
    CREATE TABLE faqs (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
  save();
}

function ensureOrders() {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      fulfilment TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      stripe_session_id TEXT
    );
  `);
  save();
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFile)) {
    db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
  } else {
    db = new SQL.Database();
    migrate();
    const password = process.env.ADMIN_PASSWORD || 'stillroom-dev';
    const username = process.env.ADMIN_USER || 'admin';
    seed({ run, get, all }, bcrypt.hashSync(password, 10), username);
    save();
  }
  ensureSchema();
  ensureOrders();
  const mist = get("SELECT id, name FROM categories WHERE slug = 'mist-sprays'");
  if (mist && mist.name === 'Mist Sprays') {
    run('UPDATE categories SET name = ? WHERE id = ?', ['Magnesium Body Sprays', mist.id]);
    save();
  }
  return api;
}

const api = {
  all,
  get,
  run,
  save,
  init,
};

module.exports = api;
