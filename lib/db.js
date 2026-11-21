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
      stock INTEGER NOT NULL DEFAULT 0,
      launched INTEGER NOT NULL DEFAULT 0,
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
  const hadFaqs = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'faqs'").length > 0;
  db.run(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
  const cols = all('PRAGMA table_info(faqs)').map((col) => col.name);
  let changed = !hadFaqs;
  const extra = [
    ['product_id', 'INTEGER'],
    ['topic', 'TEXT'],
    ['on_product', 'INTEGER NOT NULL DEFAULT 0'],
    ['reviewed_on', 'TEXT'],
    ['evidence', 'TEXT'],
  ];
  extra.forEach(([name, type]) => {
    if (!cols.includes(name)) {
      db.run('ALTER TABLE faqs ADD COLUMN ' + name + ' ' + type);
      changed = true;
    }
  });
  if (changed) save();
}

function ensureOrders() {
  const hadOrders = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'").length > 0;
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
  const cols = all('PRAGMA table_info(orders)').map((col) => col.name);
  let changed = !hadOrders;
  if (!cols.includes('items_json')) {
    db.run('ALTER TABLE orders ADD COLUMN items_json TEXT');
    changed = true;
  }
  if (!cols.includes('stock_applied')) {
    db.run('ALTER TABLE orders ADD COLUMN stock_applied INTEGER NOT NULL DEFAULT 0');
    changed = true;
  }
  if (changed) save();
}

function ensureStock() {
  const cols = all('PRAGMA table_info(products)').map((col) => col.name);
  let changed = false;
  if (!cols.includes('stock')) {
    db.run('ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0');
    db.run('UPDATE products SET stock = 1 WHERE in_stock = 1');
    changed = true;
  }
  const withLaunch = all('PRAGMA table_info(products)').map((col) => col.name);
  if (!withLaunch.includes('launched')) {
    db.run('ALTER TABLE products ADD COLUMN launched INTEGER NOT NULL DEFAULT 0');
    db.run('UPDATE products SET launched = 1 WHERE stock > 0');
    changed = true;
  }
  db.run('UPDATE products SET in_stock = CASE WHEN launched = 1 AND stock > 0 THEN 1 ELSE 0 END');
  if (db.getRowsModified()) changed = true;
  if (changed) save();
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
  ensureStock();
  ensureAboutTitles();
  renameMagnesiumBodyMists();
  renameBalmsAndRubs();
  renameBotanicalRoomMists();
  tidyShopIntro();
  return api;
}

function tidyShopIntro() {
  const row = get("SELECT value FROM settings WHERE name = 'shop_intro'");
  if (!row || row.value == null) return;
  const next = String(row.value)
    .replace(/^Small-batch botanical skincare\s*&\s*fragrance,\s*made in Canterbury\.\s*/i, '')
    .trim();
  if (next === String(row.value).trim()) return;
  run('UPDATE settings SET value = ? WHERE name = ?', [next, 'shop_intro']);
  save();
}

function ensureAboutTitles() {
  const cols = all('PRAGMA table_info(categories)').map((col) => col.name);
  if (!cols.includes('about_title')) db.run('ALTER TABLE categories ADD COLUMN about_title TEXT');
  const titles = {
    'botanical-perfumes': 'About our Perfumes',
    balms: 'About our Balms & Rubs',
    'mist-sprays': 'About our Magnesium Body Mist',
    'room-mists': 'About our Botanical Room Mists',
  };
  let changed = !cols.includes('about_title');
  Object.keys(titles).forEach((slug) => {
    const row = get('SELECT id, about_title FROM categories WHERE slug = ?', [slug]);
    if (!row || String(row.about_title || '').trim()) return;
    run('UPDATE categories SET about_title = ? WHERE id = ?', [titles[slug], row.id]);
    changed = true;
  });
  if (changed) save();
}

function renameBotanicalRoomMists() {
  const row = get('SELECT id, name, about_title FROM categories WHERE slug = ?', ['room-mists']);
  if (!row) return;
  let changed = false;
  if (row.name === 'Room Mists') {
    run('UPDATE categories SET name = ? WHERE id = ?', ['Botanical Room Mists', row.id]);
    changed = true;
  }
  if (row.about_title === 'About our Room Mists') {
    run('UPDATE categories SET about_title = ? WHERE id = ?', ['About our Botanical Room Mists', row.id]);
    changed = true;
  }
  if (changed) save();
}

function renameBalmsAndRubs() {
  const row = get('SELECT id, name, about_title FROM categories WHERE slug = ?', ['balms']);
  if (!row) return;
  let changed = false;
  if (row.name === 'Balms') {
    run('UPDATE categories SET name = ? WHERE id = ?', ['Balms & Rubs', row.id]);
    changed = true;
  }
  if (row.about_title === 'About our Balms') {
    run('UPDATE categories SET about_title = ? WHERE id = ?', ['About our Balms & Rubs', row.id]);
    changed = true;
  }
  if (changed) save();
}

function renameMagnesiumBodyMists() {
  const pairs = [
    ['Magnesium Body Mists', 'Magnesium Body Mist'],
    ['magnesium body mists', 'magnesium body mist'],
    ['Magnesium Body Sprays', 'Magnesium Body Mist'],
    ['magnesium body sprays', 'magnesium body mist'],
    ['Magnesium Body Spray', 'Magnesium Body Mist'],
    ['magnesium body spray', 'magnesium body mist'],
    ['magnesium sprays', 'magnesium mists'],
    ['Magnesium sprays', 'Magnesium mists'],
    ['magnesium spray', 'magnesium mist'],
    ['Magnesium spray', 'Magnesium mist'],
    ['The unscented spray is the magnesium mist', 'The unscented mist is the magnesium mist'],
    ['a cosmetic spray for skin', 'a cosmetic mist for skin'],
    ['Mist Sprays', 'Magnesium Body Mist'],
    ['They are not body sprays.', 'They are not body mists.'],
    ['Opened balms, sprays and perfume oils', 'Opened balms, mists and perfume oils'],
  ];
  const fields = [
    ['categories', 'name', 'id'],
    ['categories', 'intro', 'id'],
    ['products', 'name', 'id'],
    ['products', 'short_description', 'id'],
    ['products', 'long_description', 'id'],
    ['products', 'how_to_use', 'id'],
    ['products', 'notes', 'id'],
    ['products', 'ingredients', 'id'],
    ['products', 'precautions', 'id'],
    ['settings', 'value', 'name'],
    ['faqs', 'question', 'id'],
    ['faqs', 'answer', 'id'],
    ['faqs', 'evidence', 'id'],
  ];
  let changed = false;
  fields.forEach(([table, column, key]) => {
    all('SELECT ' + key + ' AS rowkey, ' + column + ' AS value FROM ' + table).forEach((row) => {
      if (row.value == null) return;
      let next = String(row.value);
      pairs.forEach(([from, to]) => {
        if (next.includes(from)) next = next.split(from).join(to);
      });
      if (next !== String(row.value)) {
        run('UPDATE ' + table + ' SET ' + column + ' = ? WHERE ' + key + ' = ?', [next, row.rowkey]);
        changed = true;
      }
    });
  });
  if (changed) save();
}

const api = {
  all,
  get,
  run,
  save,
  init,
};

module.exports = api;
