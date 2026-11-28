require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./lib/db');
const { PAGE_COPY, PAGE_GROUPS, segments, parsePolicy, aboutBlocks, parseGlossary, groupGlossary } = require('./lib/page-copy');
const { MOCK_POOLS } = require('./lib/seed');
const { REVIEWED, FAQ_TOPICS, CATEGORY_FAQS, PRODUCT_FAQS, GENERAL_FAQS, categoryHeading } = require('./lib/faq-copy');
const { fingerprint, CATEGORY_COPY, PRODUCT_COPY, PRODUCT_RENAMES, FAQ_EDITS, FAQ_TEXT_FIXES } = require('./lib/copy-polish');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: 10 * 60 * 1000,
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/media/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) && id > 0 ? db.get('SELECT mime, data FROM media WHERE id = ?', [id]) : null;
  if (!row || row.data == null) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(row.mime || 'application/octet-stream').send(Buffer.from(row.data));
});

const sessionStore = new session.MemoryStore();
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'still-room-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

function nzd(cents) {
  const n = Number(cents) || 0;
  return '$' + (n / 100).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dollarsToCents(value) {
  const n = Number(String(value == null ? '' : value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(name, ignoreId) {
  const base = slugify(name) || 'product';
  let candidate = base;
  let n = 1;
  while (n < 100) {
    const row = db.get('SELECT id FROM products WHERE slug = ?', [candidate]);
    if (!row || (ignoreId && Number(row.id) === Number(ignoreId))) return candidate;
    n += 1;
    candidate = base + '-' + n;
  }
  return base + '-' + Date.now().toString(36);
}

function settingsMap() {
  const rows = db.all('SELECT name, value FROM settings');
  const out = {};
  rows.forEach((row) => {
    out[row.name] = row.value;
  });
  return out;
}

function categories() {
  return db.all('SELECT * FROM categories ORDER BY sort_order, id');
}

function ensureCollectionLanguage() {
  const previous = {
    balms:
      'Intensive botanical moisture for dry, hard-working skin — hands, feet, elbows and knees. The story and target notes describe balms, and a soothing-balm description is drafted, but a finished formula, size and price are not in the range file yet. The card in this drawer is a starter to replace before selling.',
    'mist-sprays':
      'Magnesium body mists for an everyday comfort and recovery ritual — not a medical treatment. The range plan describes this product type. A finished formula is not recorded yet, so the card here is marked as a starter.',
    'room-mists':
      'Scent for the room, in the same quiet still-room spirit. The brand documents do not yet specify a finished room mist. This drawer is ready, with one starter card to replace when a formula exists.',
  };
  const next = {
    balms:
      'Intensive botanical moisture for dry, hard-working skin — hands, feet, elbows and knees. A finished formula is still being prepared, so this listing is a starter.',
    'mist-sprays':
      'Magnesium body mist for an everyday comfort ritual — not a medical treatment. A finished formula is still being prepared, so this listing is a starter.',
    'room-mists':
      'Scent for the room, in the same botanical range. A finished room mist is still being prepared. This listing is a starter until the formula is ready.',
  };
  let changed = false;
  Object.keys(previous).forEach((slug) => {
    const row = db.get('SELECT id, intro FROM categories WHERE slug = ?', [slug]);
    if (!row) return;
    const intro = String(row.intro || '');
    if (intro !== previous[slug] && !/still room|still-room/i.test(intro)) return;
    db.run('UPDATE categories SET intro = ? WHERE id = ?', [next[slug], row.id]);
    changed = true;
  });
  if (changed) db.save();
}

function ensureProductMockups() {
  const placeholders = new Set(['', '/images/brand/aurielle-label.png']);
  const rows = db.all(
    `SELECT p.id, p.name, p.image, c.slug AS category
     FROM products p JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.id`
  );
  const seen = {};
  let changed = false;
  rows.forEach((row) => {
    const current = String(row.image || '');
    if (current && !placeholders.has(current)) return;
    const category = /balm/i.test(row.name) ? 'balms' : row.category;
    const pool = MOCK_POOLS[category] || MOCK_POOLS['botanical-perfumes'];
    const index = seen[category] || 0;
    seen[category] = index + 1;
    db.run('UPDATE products SET image = ? WHERE id = ?', [pool[index % pool.length], row.id]);
    changed = true;
  });
  if (changed) db.save();
}

function stockOf(product) {
  if (!product || !Number(product.launched)) return 0;
  const n = Math.floor(Number(product.stock));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readStock(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cartLines(sessionCart) {
  const items = [];
  let subtotal = 0;
  const hidden = sessionCart && sessionCart.length ? hiddenCategoryIds() : new Set();
  for (const line of sessionCart || []) {
    const product = db.get('SELECT * FROM products WHERE id = ?', [line.id]);
    if (!product || !Number(product.launched) || hidden.has(Number(product.category_id))) continue;
    const qty = Math.min(99, Math.max(1, Math.floor(Number(line.qty) || 1)));
    const lineTotal = product.price_cents * qty;
    subtotal += lineTotal;
    items.push({ product, qty, lineTotal });
  }
  return { items, subtotal };
}

function tidySessionCart(session) {
  if (!session || !Array.isArray(session.cart)) return;
  const next = [];
  const hidden = session.cart.length ? hiddenCategoryIds() : new Set();
  session.cart.slice(0, 40).forEach((line) => {
    const id = Number(line && line.id);
    const qty = Math.min(99, Math.max(0, Math.floor(Number(line && line.qty) || 0)));
    if (!id || qty < 1) return;
    const row = db.get('SELECT id, launched, category_id FROM products WHERE id = ?', [id]);
    if (!row || !Number(row.launched) || hidden.has(Number(row.category_id))) return;
    next.push({ id, qty });
  });
  const prev = session.cart;
  const same = next.length === prev.length && next.every((line, index) => {
    return Number(prev[index].id) === line.id && Number(prev[index].qty) === line.qty;
  });
  if (!same) session.cart = next;
}

function sameSitePath(req, fallback) {
  const header = req.get('referer');
  if (!header) return fallback;
  try {
    const url = new URL(header);
    if (url.host !== req.get('host')) return fallback;
    if (!url.pathname.startsWith('/')) return fallback;
    return (url.pathname + url.search).slice(0, 200);
  } catch (err) {
    return fallback;
  }
}

function stockProblems(cart) {
  const problems = [];
  cart.items.forEach((item) => {
    const available = stockOf(item.product);
    if (item.qty <= available) return;
    problems.push(
      available < 1
        ? item.product.name + ' is out of stock.'
        : item.product.name + ' has only ' + available + ' left.'
    );
  });
  return problems;
}

function rememberOrderItems(orderId, cart) {
  if (!orderId) return;
  db.run('UPDATE orders SET items_json = ? WHERE id = ?', [
    JSON.stringify(cart.items.map((item) => ({ id: item.product.id, qty: item.qty }))),
    orderId,
  ]);
  db.save();
}

function takeStockForPaidOrder(orderId) {
  if (!orderId) return;
  const order = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order || order.stock_applied) return;
  let items = [];
  try {
    items = JSON.parse(order.items_json || '[]');
  } catch (err) {
    items = [];
  }
  items.forEach((line) => {
    const product = db.get('SELECT id, stock, launched FROM products WHERE id = ?', [Number(line.id)]);
    if (!product || !Number(product.launched)) return;
    const qty = Math.max(0, parseInt(line.qty, 10) || 0);
    const next = Math.max(0, readStock(product.stock) - qty);
    db.run('UPDATE products SET stock = ?, in_stock = ? WHERE id = ?', [next, next > 0 ? 1 : 0, product.id]);
  });
  db.run('UPDATE orders SET status = ?, stock_applied = 1 WHERE id = ?', ['paid', order.id]);
  db.save();
}

function stripeReady() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_') || key.startsWith('sk_live_');
}

const LOCAL_COLLECTION_ONLY = true;

const DELIVERY_COPY = {
  delivery_label: 'Delivery nationwide',
  shipping_prompt: 'Where to leave the parcel, a gate, or a dog in the yard.',
  lockbox_note: 'A lock box is available for local pickups.',
};

const STANDARDS_FIELDS = PAGE_GROUPS.standards;
const PICKUP_FIELDS = PAGE_GROUPS.pickup;

function deliveryCopy() {
  const settings = settingsMap();
  const copy = {};
  let changed = false;
  Object.keys(DELIVERY_COPY).forEach((name) => {
    const value = settings[name];
    if (value == null || String(value).trim() === '') {
      const existing = db.get('SELECT name FROM settings WHERE name = ?', [name]);
      if (existing) db.run('UPDATE settings SET value = ? WHERE name = ?', [DELIVERY_COPY[name], name]);
      else db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, DELIVERY_COPY[name]]);
      copy[name] = DELIVERY_COPY[name];
      changed = true;
    } else {
      copy[name] = value;
    }
  });
  if (changed) db.save();
  return copy;
}

function ensurePageCopy() {
  const settings = settingsMap();
  let changed = false;
  Object.keys(PAGE_COPY).forEach((name) => {
    const existing = db.get('SELECT name FROM settings WHERE name = ?', [name]);
    if (existing) return;
    const fallback = name === 'pickup_lead' ? settings.lockbox_note || PAGE_COPY.pickup_lead : PAGE_COPY[name];
    db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, fallback]);
    changed = true;
  });
  const returns = db.get('SELECT value FROM settings WHERE name = ?', ['returns_body']);
  const oldReturnLine =
    'Write to us at {{email}} with your name, the order details, and whether this is a fault or a change of mind.';
  if (returns && String(returns.value).includes(oldReturnLine)) {
    db.run('UPDATE settings SET value = ? WHERE name = ?', [
      String(returns.value).replace(oldReturnLine, 'Tell us your name, the order details, and whether this is a fault or a change of mind. Write to us at {{email}}.'),
      'returns_body',
    ]);
    changed = true;
  }
  const contact = db.get('SELECT value FROM settings WHERE name = ?', ['contact_email']);
  if (contact && !String(contact.value || '').trim()) {
    db.run('UPDATE settings SET value = ? WHERE name = ?', [PAGE_COPY.contact_email, 'contact_email']);
    changed = true;
  }
  if (changed) db.save();
  return settingsMap();
}

function savePageFields(names, body) {
  names.forEach((name) => {
    const value = String(body[name] == null ? '' : body[name]).replace(/\u0000/g, '').trim();
    const existing = db.get('SELECT name FROM settings WHERE name = ?', [name]);
    if (existing) db.run('UPDATE settings SET value = ? WHERE name = ?', [value, name]);
    else db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, value]);
  });
  db.save();
}

function cleanNote(value) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, 500);
}

function patchSetting(name, pairs) {
  const row = db.get('SELECT value FROM settings WHERE name = ?', [name]);
  if (!row) return false;
  let next = String(row.value);
  let changed = false;
  pairs.forEach((pair) => {
    if (!pair[0] || !next.includes(pair[0])) return;
    next = next.split(pair[0]).join(pair[1]);
    changed = true;
  });
  if (!changed) return false;
  next = next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  db.run('UPDATE settings SET value = ? WHERE name = ?', [next, name]);
  return true;
}

function ensureLocalCollection() {
  let changed = false;
  changed = patchSetting('pickup_body', [
    [
      "At checkout, choose 'Local Pickup'. Once your order is ready, we will email you a collection code and pickup instructions.",
      'At checkout, leave a name for the lockbox. Once your order is ready, we email or text you the combination code.',
    ],
    [
      'Please leave the name for the parcel at checkout, or add a collection time that suits you.',
      'Leave the name for the collection at checkout, or add a time that suits you.',
    ],
    ['Nationwide delivery is still available when your parcel needs to travel.', ''],
    [
      'At checkout, choose local pickup. Leave the name on the parcel, or a time that suits. Delivery nationwide is still there when a parcel needs to travel.',
      'Collect from the studio lockbox in Rangiora. At checkout, leave a name for the lockbox. We email or text the combination code when the order is ready.',
    ],
  ]) || changed;
  changed = patchSetting('pickup_aside', [
    ['Local collection, or delivery nationwide.', 'Studio collection in Rangiora.'],
  ]) || changed;
  changed = patchSetting('terms_body', [
    [
      'Delivery and local pickup options are described on our Delivery & Pickup page and again at checkout.',
      'Click and collect from the studio lockbox is described on the Click & Collect page and again at checkout.',
    ],
    [
      'Delivery and local pickup are described on the [Delivery & Pick up](/pickup) page and again at checkout. Please give a delivery address we can reach, or the name and time that suit a local pickup. Risk in the goods passes to you when the parcel is delivered to the address you gave, or when you collect it.',
      'Click and collect from the studio lockbox is described on the [Click & Collect](/pickup) page and again at checkout. Leave the name for the lockbox, or a time that suits. Risk in the goods passes to you when you collect your order.',
    ],
    [
      'Please provide a delivery address we can reach, or the name and pickup time that suit a local pickup.',
      'Leave the name for the lockbox, or a time that suits.',
    ],
    [
      'Risk in the products passes to you when the parcel is delivered to the address you provided, or when you collect your order.',
      'Risk in the products passes to you when you collect your order.',
    ],
  ]) || changed;
  const terms = db.get('SELECT value FROM settings WHERE name = ?', ['terms_body']);
  if (terms) {
    const normalized = String(terms.value).replace(/\r\n/g, '\n');
    const next = normalized.replace(/^Delivery and pickup$/m, 'Collection');
    if (next !== normalized) {
      db.run('UPDATE settings SET value = ? WHERE name = ?', [next, 'terms_body']);
      changed = true;
    }
  }
  changed = patchSetting('privacy_body', [
    ['and delivery or pickup details', 'and collection details'],
    ['about delivery or pickup', 'about collection'],
    [
      'If you do not give us the details a courier or pickup requires, we may not be able to complete your order.',
      'If you do not give us a name for the lockbox, we may not be able to complete your order.',
    ],
    [
      'If you do not give us the details a courier or a pickup needs, we may not be able to complete the order.',
      'If you do not give us a name for the lockbox, we may not be able to complete the order.',
    ],
    [
      'Take, make, and deliver an order, or hold it for local pickup',
      'Take, make, and hold an order for studio collection',
    ],
    [
      'Take, make and deliver an order, or hold it for local pickup',
      'Take, make and hold an order for studio collection',
    ],
    ['A courier, when you choose delivery', ''],
  ]) || changed;
  changed = patchSetting('returns_body', [
    ['within 14 days of delivery or pickup', 'within 14 days of collection'],
    [' The original delivery charge is not refunded on a change of mind.', ''],
    ['The original delivery charge is not refunded on a change of mind.', ''],
    [
      'Delivery and pickup options are on the Delivery & Pick up page.',
      'Collection is on the Click & Collect page.',
    ],
    [
      'Delivery and pickup options are on the [Delivery & Pick up](/pickup) page.',
      'Collection is on the [Click & Collect](/pickup) page.',
    ],
  ]) || changed;
  const faqUpdates = [
    {
      id: 39,
      question: 'Where do you deliver, and do you offer local pick up?',
      nextQuestion: 'How do I collect my order?',
      answer:
        'Orders are click and collect from the studio lockbox in Rangiora. We email or text the combination code when your order is ready.\n\nThe arrangements are on [Click & Collect](/pickup).',
    },
    {
      id: 41,
      question: 'When will my order be ready or dispatched?',
      nextQuestion: 'When will my order be ready?',
      answer:
        'Because everything is made in small batches, orders are usually hand-poured and placed in the lockbox within 1 to 2 business days. We email or text the combination code when it is ready for collection.',
    },
    {
      id: 40,
      question: 'How does the Local Pickup lockbox work?',
      nextQuestion: 'How does the Local Pickup lockbox work?',
      answer:
        'To make collection completely contactless and flexible for your schedule, we use a secure on-site lockbox system:\n1. Place your order online. Every order is click and collect from the studio lockbox.\n2. Once your order is hand-blended and packed, we will send you a text or email confirming it is ready.\n3. Your message will include our collection address, a unique access code, and your assigned lockbox number.\n4. You can then swing by and collect your order whenever it suits you best—day or night.',
    },
    {
      id: 42,
      question: 'What happens if an item arrives damaged?',
      nextQuestion: 'What happens if an item is damaged?',
      answer:
        'If a product is damaged when you collect it, take a photo and contact us. We will arrange a replacement.',
    },
  ];
  faqUpdates.forEach((row) => {
    const current = db.get('SELECT id, question, answer FROM faqs WHERE id = ?', [row.id]);
    if (!current || current.question !== row.question || current.answer === row.answer) return;
    db.run('UPDATE faqs SET question = ?, answer = ? WHERE id = ?', [row.nextQuestion, row.answer, row.id]);
    changed = true;
  });
  if (changed) db.save();
}

function readFulfilment(body) {
  const method = LOCAL_COLLECTION_ONLY || (body && body.fulfilment === 'pickup') ? 'pickup' : 'delivery';
  let raw = '';
  if (body && body.note != null && body.shipping_note == null && body.pickup_note == null) {
    raw = body.note;
  } else if (method === 'pickup') {
    raw = body && body.pickup_note != null ? body.pickup_note : '';
  } else {
    raw = body && body.shipping_note != null ? body.shipping_note : '';
  }
  return { method, note: cleanNote(raw) };
}

function persistFulfilment(req) {
  const choice = readFulfilment(req.body);
  req.session.fulfilment = choice;
  const now = new Date().toISOString();
  const currentId = Number(req.session.draftOrderId) || 0;
  const existing = currentId ? db.get('SELECT id FROM orders WHERE id = ?', [currentId]) : null;
  if (existing) {
    db.run('UPDATE orders SET fulfilment = ?, note = ? WHERE id = ?', [choice.method, choice.note, existing.id]);
  } else {
    req.session.draftOrderId = db.run(
      'INSERT INTO orders (created_at, fulfilment, note, status) VALUES (?, ?, ?, ?)',
      [now, choice.method, choice.note, 'draft']
    );
  }
  db.save();
  return choice;
}

function checkoutLocals(cart, opts) {
  opts = opts || {};
  const saved = opts.saved || { method: LOCAL_COLLECTION_ONLY ? 'pickup' : 'delivery', note: '' };
  const method = LOCAL_COLLECTION_ONLY || saved.method === 'pickup' ? 'pickup' : 'delivery';
  const note = saved.note || '';
  return {
    title: 'Checkout',
    cart,
    stripeReady: Object.prototype.hasOwnProperty.call(opts, 'stripeReady') ? opts.stripeReady : stripeReady(),
    stripeError: opts.stripeError || null,
    copy: deliveryCopy(),
    localCollection: LOCAL_COLLECTION_ONLY,
    fulfilment: method,
    shippingNote: method === 'delivery' ? note : '',
    pickupNote: method === 'pickup' ? note : '',
  };
}

// Render's disk is wiped on every deploy and restart, so uploads live in the database.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Use a JPG, PNG, WEBP or GIF image.'));
  },
});

function storeUpload(file) {
  if (!file || !file.buffer || !file.buffer.length) return '';
  const id = db.run('INSERT INTO media (mime, data, created_at) VALUES (?, ?, ?)', [
    file.mimetype,
    new Uint8Array(file.buffer),
    new Date().toISOString(),
  ]);
  db.save();
  return id ? '/media/' + id : '';
}

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

function liveImage(src) {
  const value = String(src || '');
  if (!value.startsWith('/uploads/')) return value;
  return fs.existsSync(path.join(UPLOADS_DIR, path.basename(value))) ? value : '';
}

const MENU_SAMPLES = {
  'botanical-perfumes': '/images/mockups/perfume-dropper.jpg',
  balms: '/images/mockups/balm-green.jpg',
  'mist-sprays': '/images/mockups/magnesium-spray.jpg',
  'room-mists': '/images/mockups/room-mist.jpg',
};

function menuImageFor(cat, settings) {
  const saved = liveImage(settings && settings['menu_image_' + cat.slug]);
  return saved || MENU_SAMPLES[cat.slug] || '/images/brand/meadow.jpg';
}

const COMING_SOON_DEFAULTS = ['botanical-perfumes'];

function ensureComingSoon() {
  let changed = false;
  COMING_SOON_DEFAULTS.forEach((slug) => {
    const name = 'coming_soon_' + slug;
    if (db.get('SELECT name FROM settings WHERE name = ?', [name])) return;
    db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, '1']);
    changed = true;
  });
  if (changed) db.save();
}

function isComingSoon(cat, settings) {
  if (!cat) return false;
  return String((settings || settingsMap())['coming_soon_' + cat.slug] || '') === '1';
}

function hiddenCategoryIds(settings) {
  const s = settings || settingsMap();
  return new Set(categories().filter((cat) => isComingSoon(cat, s)).map((cat) => Number(cat.id)));
}

function shopName(name) {
  return String(name || '').replace(/\s*\(starter\)\s*/gi, ' ').trim();
}

function onSale(rows, settings) {
  const hidden = hiddenCategoryIds(settings);
  return rows.filter((row) => !hidden.has(Number(row.category_id)));
}

function looseText(text) {
  return String(text || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

function faqScopeRows(scope, question) {
  if (scope.general) {
    return db.all('SELECT * FROM faqs WHERE category_id = 0 AND product_id IS NULL AND question = ?', [question]);
  }
  if (scope.category) {
    const cat = db.get('SELECT id FROM categories WHERE slug = ?', [scope.category]);
    return cat ? db.all('SELECT * FROM faqs WHERE category_id = ? AND product_id IS NULL AND question = ?', [cat.id, question]) : [];
  }
  // Matched on the answer text, because a product question can be copied to several products.
  return db.all('SELECT * FROM faqs WHERE product_id IS NOT NULL AND question = ?', [question]);
}

function ensureCopyPolish() {
  let changed = false;
  const mists = db.get('SELECT id, name, about_title FROM categories WHERE slug = ?', ['mist-sprays']);
  if (mists && mists.name === 'Magnesium Body Mist') {
    db.run('UPDATE categories SET name = ? WHERE id = ?', ['Magnesium Body Mists', mists.id]);
    changed = true;
  }
  if (mists && mists.about_title === 'About our Magnesium Body Mist') {
    db.run('UPDATE categories SET about_title = ? WHERE id = ?', ['About our Magnesium Body Mists', mists.id]);
    changed = true;
  }
  Object.keys(CATEGORY_COPY).forEach((slug) => {
    const row = db.get('SELECT id, intro FROM categories WHERE slug = ?', [slug]);
    if (!row || String(row.intro || '').trim() === CATEGORY_COPY[slug].intro.trim()) return;
    if (!CATEGORY_COPY[slug].was.includes(fingerprint(row.intro))) return;
    db.run('UPDATE categories SET intro = ? WHERE id = ?', [CATEGORY_COPY[slug].intro, row.id]);
    changed = true;
  });
  Object.keys(PRODUCT_COPY).forEach((slug) => {
    const row = db.get('SELECT * FROM products WHERE slug = ?', [slug]);
    if (!row) return;
    Object.keys(PRODUCT_COPY[slug]).forEach((field) => {
      const spec = PRODUCT_COPY[slug][field];
      if (String(row[field] || '').trim() === spec.text.trim()) return;
      if (fingerprint(row[field]) !== spec.was) return;
      db.run('UPDATE products SET ' + field + ' = ? WHERE id = ?', [spec.text, row.id]);
      changed = true;
    });
  });
  PRODUCT_RENAMES.forEach((rename) => {
    const row = db.get('SELECT id, ' + rename.field + ' AS value FROM products WHERE slug = ?', [rename.slug]);
    if (!row || row.value !== rename.from) return;
    db.run('UPDATE products SET ' + rename.field + ' = ? WHERE id = ?', [rename.to, row.id]);
    changed = true;
  });
  FAQ_EDITS.forEach((edit) => {
    faqScopeRows(edit.scope, edit.question).forEach((faq) => {
      if (!looseText(faq.answer).includes(looseText(edit.has))) return;
      if (edit.remove) {
        db.run('DELETE FROM faqs WHERE id = ?', [faq.id]);
      } else {
        const answer = edit.answer || (edit.find ? String(faq.answer).split(edit.find).join(edit.replace) : faq.answer);
        db.run('UPDATE faqs SET question = ?, answer = ? WHERE id = ?', [edit.nextQuestion || faq.question, answer, faq.id]);
      }
      changed = true;
    });
  });
  db.all('SELECT id, question, answer FROM faqs').forEach((faq) => {
    let question = String(faq.question || '');
    let answer = String(faq.answer || '');
    FAQ_TEXT_FIXES.forEach(([from, to]) => {
      question = question.split(from).join(to);
      answer = answer.split(from).join(to);
    });
    if (question === faq.question && answer === faq.answer) return;
    db.run('UPDATE faqs SET question = ?, answer = ? WHERE id = ?', [question, answer, faq.id]);
    changed = true;
  });
  if (changed) db.save();
}

app.use((req, res, next) => {
  tidySessionCart(req.session);
  const lines = cartLines(req.session.cart);
  res.locals.cartCount = lines.items.reduce((sum, item) => sum + item.qty, 0);
  res.locals.cartSubtotal = lines.subtotal;
  res.locals.categories = categories();
  res.locals.settings = settingsMap();
  res.locals.menuImageFor = menuImageFor;
  res.locals.liveImage = liveImage;
  res.locals.isComingSoon = (cat) => isComingSoon(cat, res.locals.settings);
  res.locals.nzd = nzd;
  res.locals.path = req.path;
  res.locals.admin = !!req.session.admin;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.year = new Date().getFullYear();
  res.locals.segments = segments;
  res.locals.contentBlocks = (raw) => parsePolicy(raw || '').blocks;
  res.locals.textBlocks = aboutBlocks;
  res.locals.shopName = shopName;
  res.locals.origin = req.protocol + '://' + req.get('host');
  res.locals.description = 'Petite Botanicals. Small-batch botanical perfume oils, balms and mists made in Canterbury, New Zealand.';
  res.locals.canonical = res.locals.origin + (req.path === '/search' ? '/search' : req.path);
  res.locals.jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
  next();
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

function productFields(body, file, existing) {
  return {
    name: String(body.name || '').trim(),
    category_id: Number(body.category_id),
    price_cents: dollarsToCents(body.price),
    size: String(body.size || '').trim(),
    short_description: String(body.short_description || '').trim(),
    long_description: String(body.long_description || '').trim(),
    notes: String(body.notes || '').trim(),
    ingredients: String(body.ingredients || '').trim(),
    how_to_use: String(body.how_to_use || '').trim(),
    precautions: String(body.precautions || '').trim(),
    image: file ? storeUpload(file) : existing ? existing.image : '',
    featured: body.featured ? 1 : 0,
    stock: readStock(body.stock),
    launched: existing && Number(existing.launched) ? 1 : 0,
    in_stock: existing && Number(existing.launched) && readStock(body.stock) > 0 ? 1 : 0,
    is_starter: body.is_starter ? 1 : 0,
  };
}

const COLLECTION_VIDEOS = {
  'botanical-perfumes': '/videos/perfumes.mp4',
  balms: '/videos/balms.mp4',
  'mist-sprays': '/videos/sprays.mp4',
  'room-mists': '/videos/room-mist.mp4',
};

const HOME_COLLECTION_ORDER = ['balms', 'botanical-perfumes', 'room-mists', 'mist-sprays'];

const HOME_COLLECTION_LINES = {
  balms: 'Small-batch balms for hands, body and everyday skin care.',
  'botanical-perfumes': 'Hand-blended botanical perfume oils, made in Canterbury.',
  'room-mists': 'Botanical sprays for a gentle scent at home.',
  'mist-sprays': 'Magnesium mists for underarms and everyday body care.',
};

app.get('/', (req, res) => {
  const settings = settingsMap();
  const featured = onSale(db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.featured = 1 AND p.launched = 1 ORDER BY c.sort_order, p.id`
  ), settings);
  const cats = categories().map((cat) => {
    const count = db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND launched = 1', [cat.id]);
    const video = COLLECTION_VIDEOS[cat.slug] || '';
    const comingSoon = isComingSoon(cat, settings);
    return Object.assign({}, cat, {
      count: count.n,
      video,
      videoType: video.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
      line: comingSoon ? 'Coming soon.' : HOME_COLLECTION_LINES[cat.slug] || '',
      comingSoon,
    });
  });
  cats.sort((a, b) => {
    const ai = HOME_COLLECTION_ORDER.indexOf(a.slug);
    const bi = HOME_COLLECTION_ORDER.indexOf(b.slug);
    return (ai < 0 ? HOME_COLLECTION_ORDER.length : ai) - (bi < 0 ? HOME_COLLECTION_ORDER.length : bi);
  });
  const testimonials = db.all('SELECT * FROM testimonials WHERE published = 1 ORDER BY sort_order, id');
  res.render('home', { title: 'Home', settings, featured, cats, testimonials });
});

app.get('/shop', (req, res) => {
  const settings = settingsMap();
  const products = onSale(db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.launched = 1
     ORDER BY c.sort_order, p.id`
  ), settings);
  res.render('shop', { title: 'Shop', settings, products });
});

function searchSnippet(text, q) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const at = clean.toLowerCase().indexOf(String(q || '').toLowerCase());
  if (at < 0) return clean.slice(0, 180);
  const start = Math.max(0, at - 48);
  const slice = clean.slice(start, start + 180);
  return (start ? '…' : '') + slice + (start + 180 < clean.length ? '…' : '');
}

function productMatch(product, q) {
  const needle = q.toLowerCase();
  const fields = [
    ['the name', product.name],
    ['the description', product.short_description],
    ['the ingredients', product.ingredients],
    ['the notes', product.notes],
    ['how to use', product.how_to_use],
    ['the precautions', product.precautions],
    ['the description', product.long_description],
    ['the size', product.size],
    ['the collection', product.category_name],
  ];
  const hit = fields.find((pair) => String(pair[1] || '').toLowerCase().includes(needle));
  return hit ? hit[0] : '';
}

app.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  const products = q
    ? onSale(db.all(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.launched = 1 AND (
            p.name LIKE ? OR p.short_description LIKE ? OR p.long_description LIKE ?
            OR p.notes LIKE ? OR p.ingredients LIKE ? OR p.how_to_use LIKE ?
            OR p.precautions LIKE ? OR p.size LIKE ? OR c.name LIKE ?)
         ORDER BY CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, p.name`,
        [like, like, like, like, like, like, like, like, like, like]
      )).map((product) => Object.assign(product, { match: productMatch(product, q) }))
    : [];
  const needle = q.toLowerCase();
  const terms = q
    ? parseGlossary(ensurePageCopy().glossary_entries)
        .map((entry) => {
          const term = entry.term.toLowerCase();
          const inci = entry.inci.toLowerCase();
          const body = entry.body.toLowerCase();
          let where = '';
          if (term.includes(needle)) where = 'heading';
          else if (inci.includes(needle)) where = 'inci';
          else if (body.includes(needle)) where = 'body';
          if (!where) return null;
          return Object.assign({}, entry, { where, snippet: searchSnippet(entry.body || entry.inci, q) });
        })
        .filter(Boolean)
        .sort((a, b) => {
          const rank = { heading: 0, inci: 1, body: 2 };
          return rank[a.where] - rank[b.where] || a.term.localeCompare(b.term);
        })
    : [];
  res.render('search', {
    title: q ? 'Search · ' + q : 'Search',
    q,
    products,
    terms,
    description: q
      ? 'Search Petite Botanicals for “' + q + '” across products, ingredients, and the glossary.'
      : 'Search Petite Botanicals products, ingredient names, and the glossary.',
  });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /search\n\nSitemap: ' +
      req.protocol + '://' + req.get('host') + '/sitemap.xml\n'
  );
});

app.get('/sitemap.xml', (req, res) => {
  const origin = req.protocol + '://' + req.get('host');
  const paths = ['/', '/shop', '/about', '/contact', '/standards', '/glossary', '/faq', '/pickup', '/returns', '/privacy', '/terms'];
  categories().forEach((cat) => paths.push('/category/' + cat.slug));
  onSale(db.all('SELECT slug, category_id FROM products WHERE launched = 1 ORDER BY id')).forEach((product) => paths.push('/product/' + product.slug));
  const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ].concat(paths.map((path) => '  <url><loc>' + xml(origin + path) + '</loc></url>')).concat(['</urlset>']).join('\n');
  res.type('application/xml').send(body);
});

app.get('/category/:slug', (req, res) => {
  const category = db.get('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
  if (!category) return res.status(404).render('missing', { title: 'Not found', status: 404 });
  const products = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.launched = 1 ORDER BY p.is_starter, p.id`,
    [category.id]
  );
  const faqs = db.all(
    'SELECT * FROM faqs WHERE category_id = ? AND product_id IS NULL ORDER BY sort_order, id',
    [category.id]
  );
  const comingSoon = isComingSoon(category);
  res.render('category', {
    title: category.name,
    category,
    comingSoon,
    products: comingSoon ? [] : products,
    faqs: comingSoon ? [] : faqs,
    aboutBlocks: comingSoon ? [] : aboutBlocks(category.intro),
    faqHeading: categoryHeading(category),
  });
});

app.get('/product/:slug', (req, res) => {
  const product = db.get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ?`,
    [req.params.slug]
  );
  if (!product || !Number(product.launched)) return res.status(404).render('missing', { title: 'Not found', status: 404 });
  if (hiddenCategoryIds().has(Number(product.category_id))) return res.redirect('/category/' + product.category_slug);
  const related = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.id != ? AND p.launched = 1 ORDER BY p.id LIMIT 3`,
    [product.category_id, product.id]
  );
  const description = [product.name, product.category_name, product.short_description, product.ingredients]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  res.render('product', { title: shopName(product.name), product, related, faqs: faqsForProduct(product), description });
});

app.get('/faq', (req, res) => {
  const groups = FAQ_TOPICS.map((topic) => ({
    id: topic.id,
    title: topic.title,
    faqs: db.all(
      'SELECT * FROM faqs WHERE category_id = 0 AND topic = ? AND product_id IS NULL ORDER BY sort_order, id',
      [topic.id]
    ),
  }));
  res.render('faq', { title: 'FAQs', groups });
});

app.get('/about', (req, res) => {
  const settings = ensurePageCopy();
  res.render('about', {
    title: settings.story_headline || 'Our Story',
    settings,
    blocks: parsePolicy(settings.story_body, settings.contact_email).blocks,
  });
});

app.get('/standards', (req, res) => {
  res.render('standards', { title: 'Our Standards', settings: ensurePageCopy() });
});

app.get('/pickup', (req, res) => {
  res.render('pickup', { title: 'Click & Collect', settings: ensurePageCopy() });
});

const CONTACT_TOPICS = ['An order', 'A product or scent', 'Local collection', 'A testimonial', 'Something else'];
const TESTIMONIAL_TOPIC = 'A testimonial';
const contactHits = new Map();

function contactInbox() {
  const settings = ensurePageCopy();
  const saved = String(settings.contact_email || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved)) return saved;
  return PAGE_COPY.contact_email;
}

function blankNote() {
  return { name: '', email: '', topic: '', message: '', permit: false, showTown: false, town: '', product: '' };
}

function testimonialProducts() {
  return onSale(db.all(
    `SELECT p.name, p.category_id
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.launched = 1
     ORDER BY c.sort_order, p.name`
  )).map((row) => shopName(row.name)).filter(Boolean);
}

function readContact(body) {
  const name = String(body.name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  const email = String(body.email || '').replace(/\s+/g, '').trim().slice(0, 120);
  const topic = CONTACT_TOPICS.includes(body.topic) ? body.topic : '';
  const message = String(body.message || '').trim().slice(0, 1500);
  const permit = body.permit === 'on' || body.permit === 'yes';
  const showTown = body.show_town === 'on' || body.show_town === 'yes';
  const town = String(body.town || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  const offered = testimonialProducts();
  const chosen = String(body.product || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  const product = offered.includes(chosen) ? chosen : '';
  const testimonial = topic === TESTIMONIAL_TOPIC;
  const errors = {};
  if (name.length < 2) errors.name = 'Please add your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please add an email we can reply to.';
  if (!topic) errors.topic = 'Choose what the note is about.';
  if (message.length < 8) {
    errors.message = testimonial ? 'Write the words you’d like us to show.' : 'Write a short note so we know how to help.';
  } else if (testimonial && message.length > 600) {
    errors.message = 'Keep a homepage note to 600 characters.';
  }
  if (testimonial && !permit) errors.permit = 'Tick this if you’re happy for us to show your words and your name.';
  if (testimonial && showTown && town.length < 2) errors.town = 'Add the town you’d like us to show.';
  if (testimonial && chosen && !product) errors.product = 'Choose a product from the list.';
  return { name, email, topic, message, permit, showTown, town, product, errors, honey: String(body.company || '').trim() };
}

function saveTestimonialDraft(note) {
  const max = db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM testimonials');
  db.run(
    'INSERT INTO testimonials (quote, name, detail, product, rating, published, sort_order, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)',
    [note.message.slice(0, 600), note.name, note.showTown ? note.town : '', note.product || '', Number(max.m) + 1, new Date().toISOString()]
  );
  db.save();
}

function contactMailto(note, inbox) {
  const lines = ['Name: ' + note.name, 'Email: ' + note.email, 'About: ' + note.topic];
  if (note.product) lines.push('Product: ' + note.product);
  if (note.showTown && note.town) lines.push('Town: ' + note.town);
  lines.push('', note.message);
  const body = lines.join('\n');
  return (
    'mailto:' +
    inbox +
    '?subject=' +
    encodeURIComponent('Petite Botanicals — ' + note.topic) +
    '&body=' +
    encodeURIComponent(body)
  );
}

function tooManyNotes(ip) {
  const now = Date.now();
  const recent = (contactHits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  contactHits.set(ip, recent);
  return recent.length >= 5;
}

function rememberNote(ip) {
  const now = Date.now();
  const recent = contactHits.get(ip) || [];
  recent.push(now);
  contactHits.set(ip, recent);
}

function renderContact(res, extras) {
  res.render(
    'contact',
    Object.assign(
      {
        title: 'Contact',
        description: 'Write to Petite Botanicals in Canterbury. Questions about an order, a scent, or local pickup.',
        inbox: contactInbox(),
        topics: CONTACT_TOPICS,
        sent: false,
        testimonialSent: false,
        sendFailed: false,
        limited: false,
        note: blankNote(),
        products: testimonialProducts(),
        errors: {},
        mailto: '',
      },
      extras
    )
  );
}

async function deliverContact(note, inbox, origin) {
  const response = await fetch('https://formsubmit.co/ajax/' + inbox, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: origin,
      Referer: origin + '/contact',
    },
    body: JSON.stringify({
      name: note.name,
      email: note.email,
      _replyto: note.email,
      _subject: 'Petite Botanicals — ' + note.topic,
      _template: 'table',
      _captcha: 'false',
      topic: note.topic,
      message: note.message,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  const message = String(data.message || '');
  return data.success === true || String(data.success) === 'true' || /activat/i.test(message);
}

app.get('/contact', (req, res) => {
  renderContact(res, { sent: req.query.sent === '1', testimonialSent: req.query.note === 'testimonial' });
});

app.post('/contact', async (req, res) => {
  const note = readContact(req.body || {});
  const inbox = contactInbox();
  if (note.honey) return res.redirect('/contact?sent=1');
  if (Object.keys(note.errors).length) return renderContact(res, { note, errors: note.errors });
  if (tooManyNotes(req.ip)) {
    return renderContact(res, { note, limited: true, mailto: contactMailto(note, inbox) });
  }
  rememberNote(req.ip);
  const testimonial = note.topic === TESTIMONIAL_TOPIC;
  if (testimonial) saveTestimonialDraft(note);
  const thanks = testimonial ? '/contact?sent=1&note=testimonial' : '/contact?sent=1';
  try {
    if (await deliverContact(note, inbox, req.protocol + '://' + req.get('host'))) return res.redirect(thanks);
  } catch (err) {
    /* The mail handoff failed. The page offers the same note in the visitor's email app. */
  }
  if (testimonial) return res.redirect(thanks);
  renderContact(res, { note, sendFailed: true, mailto: contactMailto(note, inbox) });
});

app.get('/glossary', (req, res) => {
  const settings = ensurePageCopy();
  const entries = parseGlossary(settings.glossary_entries);
  const description = ('Ingredient glossary for Petite Botanicals. ' + entries.map((entry) => entry.term).join(', ') + '.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  res.render('glossary', {
    title: 'Glossary',
    settings,
    groups: groupGlossary(entries),
    entries,
    description,
  });
});

function policyPage(kind) {
  const settings = ensurePageCopy();
  const pages = {
    terms: {
      title: 'Terms of Use',
      eyebrow: 'Policies',
      updatedKey: 'terms_updated',
      introKey: 'terms_intro',
      bodyKey: 'terms_body',
    },
    privacy: {
      title: 'Privacy',
      eyebrow: 'Policies',
      updatedKey: 'privacy_updated',
      introKey: 'privacy_intro',
      bodyKey: 'privacy_body',
    },
    returns: {
      title: 'Returns Policy',
      eyebrow: 'Policies',
      updatedKey: 'returns_updated',
      introKey: 'returns_intro',
      bodyKey: 'returns_body',
    },
  };
  const spec = pages[kind];
  const email = settings.contact_email;
  const parsed = parsePolicy(settings[spec.bodyKey], email);
  return {
    title: spec.title,
    page: {
      title: spec.title,
      eyebrow: spec.eyebrow,
      updated: settings[spec.updatedKey] || '',
    },
    introParts: segments(settings[spec.introKey] || '', email),
    blocks: parsed.blocks,
    toc: parsed.toc,
  };
}

app.get('/terms', (req, res) => {
  res.render('policy', policyPage('terms'));
});

app.get('/privacy', (req, res) => {
  res.render('policy', policyPage('privacy'));
});

app.get('/returns', (req, res) => {
  res.render('policy', policyPage('returns'));
});

app.post('/cart/add', (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.body.id)]);
  if (!product || !Number(product.launched) || hiddenCategoryIds().has(Number(product.category_id))) {
    req.session.flash = 'That piece is not on the shop.';
    return res.redirect(sameSitePath(req, '/shop'));
  }
  const available = stockOf(product);
  if (available < 1) {
    req.session.flash = 'That piece is out of stock.';
    return res.redirect(sameSitePath(req, '/shop'));
  }
  const requested = Math.min(99, Math.max(1, parseInt(req.body.qty, 10) || 1));
  const qty = Math.min(available, requested);
  const cart = req.session.cart || [];
  const existing = cart.find((line) => Number(line.id) === Number(product.id));
  const limited = 'Only ' + available + ' of ' + shopName(product.name) + ' is in stock. The basket has that amount.';
  if (existing) {
    const next = existing.qty + qty;
    existing.qty = Math.min(99, available, next);
    req.session.flash = next > available ? limited : shopName(product.name) + ' is in the basket.';
  } else {
    cart.push({ id: product.id, qty });
    req.session.flash = requested > available ? limited : shopName(product.name) + ' is in the basket.';
  }
  req.session.cart = cart;
  res.redirect('/cart');
});

app.post('/cart/update', (req, res) => {
  const id = Number(req.body.id);
  const product = db.get('SELECT * FROM products WHERE id = ?', [id]);
  const available = stockOf(product);
  let qty = Math.min(99, Math.max(0, parseInt(req.body.qty, 10) || 0));
  if (qty > available) {
    qty = available;
    req.session.flash = available < 1
      ? (product ? product.name : 'That piece') + ' is out of stock and was taken out of the basket.'
      : 'Only ' + available + ' of ' + product.name + ' is in stock.';
  }
  const cart = (req.session.cart || []).filter((line) => Number(line.id) !== id);
  if (qty > 0) cart.push({ id, qty });
  req.session.cart = cart;
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  const id = Number(req.body.id);
  req.session.cart = (req.session.cart || []).filter((line) => Number(line.id) !== id);
  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  const cart = cartLines(req.session.cart);
  res.render('cart', {
    title: 'Basket',
    cart,
    stockProblems: stockProblems(cart),
    stripeReady: stripeReady(),
    copy: deliveryCopy(),
  });
});

app.get('/checkout', (req, res) => {
  const cart = cartLines(req.session.cart);
  res.render('checkout', checkoutLocals(cart, { saved: req.session.fulfilment }));
});

app.post('/checkout/note', (req, res) => {
  if (!cartLines(req.session.cart).items.length) {
    return res.status(400).json({ ok: false });
  }
  const saved = persistFulfilment(req);
  if (String(req.get('accept') || '').includes('application/json')) {
    return res.json({ ok: true, fulfilment: saved.method });
  }
  res.redirect('/checkout');
});

app.post('/checkout', async (req, res) => {
  const cart = cartLines(req.session.cart);
  if (!cart.items.length) return res.redirect('/cart');
  const problems = stockProblems(cart);
  if (problems.length) {
    req.session.flash = problems.join(' ');
    return res.redirect('/cart');
  }
  const saved = persistFulfilment(req);
  rememberOrderItems(req.session.draftOrderId, cart);
  if (!stripeReady()) {
    return res.status(400).render('checkout', checkoutLocals(cart, {
      saved,
      stripeReady: false,
      stripeError: null,
    }));
  }
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const origin = publicUrl || req.protocol + '://' + req.get('host');
    const sessionParams = {
      mode: 'payment',
      currency: 'nzd',
      line_items: cart.items.map((item) => ({
        quantity: item.qty,
        price_data: {
          currency: 'nzd',
          unit_amount: item.product.price_cents,
          product_data: {
            name: item.product.name + (item.product.size ? ' · ' + item.product.size : ''),
          },
        },
      })),
      metadata: {
        fulfilment: saved.method,
        fulfilment_note: saved.note,
        order_id: String(req.session.draftOrderId || ''),
      },
      success_url: origin + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/checkout/cancel',
    };
    if (!LOCAL_COLLECTION_ONLY) {
      sessionParams.shipping_address_collection = { allowed_countries: ['NZ'] };
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (req.session.draftOrderId) {
      db.run('UPDATE orders SET status = ?, stripe_session_id = ? WHERE id = ?', [
        'checkout',
        session.id,
        req.session.draftOrderId,
      ]);
      db.save();
    }
    return res.redirect(303, session.url);
  } catch (err) {
    const rejected = /api[_ ]?key|Invalid API Key|No such API key/i.test(err.message || '');
    return res.status(502).render('checkout', checkoutLocals(cart, {
      saved,
      stripeReady: true,
      stripeError: rejected
        ? 'Stripe rejected the secret key. Use a test key (it starts with sk_test_) in STRIPE_SECRET_KEY.'
        : 'Stripe could not open a test checkout. The basket is still here.',
    }));
  }
});

app.get('/checkout/success', async (req, res) => {
  let paid = false;
  if (req.query.session_id && stripeReady()) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
      paid = session.payment_status === 'paid' || session.status === 'complete';
      if (paid) {
        let orderId = Number(req.session.draftOrderId) || 0;
        if (!orderId) {
          const row = db.get('SELECT id FROM orders WHERE stripe_session_id = ?', [session.id]);
          if (row) orderId = row.id;
        }
        takeStockForPaidOrder(orderId);
        req.session.cart = [];
        delete req.session.draftOrderId;
        delete req.session.fulfilment;
      }
    } catch (err) {
      paid = false;
    }
  }
  res.render('success', { title: 'Order received', paid });
});

app.get('/checkout/cancel', (req, res) => {
  const cart = cartLines(req.session.cart);
  res.render('cancel', { title: 'Checkout cancelled', cart });
});

app.get('/admin/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Shop desk', error: null });
});

app.post('/admin/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('admin/login', {
      title: 'Shop desk',
      error: 'Those desk details are not recognised.',
    });
  }
  req.session.admin = { id: user.id, username: user.username };
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  delete req.session.admin;
  res.redirect('/');
});

app.get('/admin', requireAdmin, (req, res) => {
  const counts = {
    products: db.get('SELECT COUNT(*) AS n FROM products').n,
    featured: db.get('SELECT COUNT(*) AS n FROM products WHERE featured = 1').n,
    starters: db.get('SELECT COUNT(*) AS n FROM products WHERE is_starter = 1').n,
    outOfStock: db.get('SELECT COUNT(*) AS n FROM products WHERE launched = 1 AND stock < 1').n,
    readyToLaunch: db.get('SELECT COUNT(*) AS n FROM products WHERE launched = 0 AND stock > 0').n,
    notes: db.get('SELECT COUNT(*) AS n FROM testimonials WHERE published = 1').n,
  };
  res.render('admin/dashboard', { title: 'Desk', counts });
});

app.get('/admin/products', requireAdmin, (req, res) => {
  const products = db.all(
    `SELECT p.*, c.name AS category_name FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.name`
  );
  res.render('admin/products', { title: 'Products', products });
});

app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('admin/product-form', {
    title: 'New product',
    product: {
      name: '',
      category_id: categories()[0] ? categories()[0].id : '',
      price_cents: 0,
      size: '',
      short_description: '',
      long_description: '',
      notes: '',
      ingredients: '',
      how_to_use: '',
      precautions: '',
      image: '',
      featured: 0,
      in_stock: 0,
      stock: 0,
      launched: 0,
      is_starter: 0,
    },
    action: '/admin/products',
  });
});

app.post('/admin/products', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      req.session.flash = err.message;
      return res.redirect('/admin/products/new');
    }
    const fields = productFields(req.body, req.file, null);
    if (!fields.name || !fields.category_id) {
      req.session.flash = 'A product needs a name and a drawer.';
      return res.redirect('/admin/products/new');
    }
    const slug = uniqueSlug(fields.name);
    const id = db.run(
      `INSERT INTO products (
        slug, category_id, name, price_cents, size, short_description, long_description,
        notes, ingredients, how_to_use, precautions, image, featured, in_stock, stock, launched, is_starter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        fields.category_id,
        fields.name,
        fields.price_cents,
        fields.size,
        fields.short_description,
        fields.long_description,
        fields.notes,
        fields.ingredients,
        fields.how_to_use,
        fields.precautions,
        fields.image,
        fields.featured,
        fields.in_stock,
        fields.stock,
        fields.launched,
        fields.is_starter,
      ]
    );
    db.save();
    req.session.flash = 'Product saved. Launch it when this stock should appear on the shop.';
    res.redirect('/admin/products/' + id + '/edit');
  });
});

app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!product) return res.status(404).render('missing', { title: 'Not found', status: 404 });
  res.render('admin/product-form', {
    title: 'Edit ' + product.name,
    product,
    action: '/admin/products/' + product.id,
    faqs: db.all('SELECT * FROM faqs WHERE product_id = ? ORDER BY sort_order, id', [product.id]),
  });
});

app.post('/admin/products/:id', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    const id = Number(req.params.id);
    const existing = db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.redirect('/admin/products');
    if (err) {
      req.session.flash = err.message;
      return res.redirect('/admin/products/' + id + '/edit');
    }
    const fields = productFields(req.body, req.file, existing);
    if (!fields.name || !fields.category_id) {
      req.session.flash = 'A product needs a name and a drawer.';
      return res.redirect('/admin/products/' + id + '/edit');
    }
    const slug = uniqueSlug(fields.name, id);
    db.run(
      `UPDATE products SET
        slug = ?, category_id = ?, name = ?, price_cents = ?, size = ?,
        short_description = ?, long_description = ?, notes = ?, ingredients = ?,
        how_to_use = ?, precautions = ?, image = ?, featured = ?, in_stock = ?, stock = ?, launched = ?, is_starter = ?
       WHERE id = ?`,
      [
        slug,
        fields.category_id,
        fields.name,
        fields.price_cents,
        fields.size,
        fields.short_description,
        fields.long_description,
        fields.notes,
        fields.ingredients,
        fields.how_to_use,
        fields.precautions,
        fields.image,
        fields.featured,
        fields.in_stock,
        fields.stock,
        fields.launched,
        fields.is_starter,
        id,
      ]
    );
    db.save();
    req.session.flash = 'Product updated.';
    res.redirect('/admin/products/' + id + '/edit');
  });
});

app.post('/admin/products/:id/launch', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const product = db.get('SELECT id, name, stock FROM products WHERE id = ?', [id]);
  if (!product) return res.redirect('/admin/products');
  const stock = readStock(product.stock);
  db.run('UPDATE products SET launched = 1, in_stock = ? WHERE id = ?', [stock > 0 ? 1 : 0, id]);
  db.save();
  req.session.flash = stock > 0
    ? product.name + ' is on the shop, In-Stock.'
    : product.name + ' is on the shop and shows OUT OF STOCK until stock on hand is above 0.';
  const referer = String(req.get('referer') || '');
  res.redirect(referer.includes('/edit') ? '/admin/products/' + id + '/edit' : '/admin/products');
});

app.post('/admin/products/:id/unlaunch', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const product = db.get('SELECT id, name, stock FROM products WHERE id = ?', [id]);
  if (!product) return res.redirect('/admin/products');
  db.run('UPDATE products SET launched = 0, in_stock = 0 WHERE id = ?', [id]);
  db.save();
  req.session.flash = product.name + ' is back in the desk. Stock on hand is unchanged, and it is off the shop until you launch it again.';
  const referer = String(req.get('referer') || '');
  res.redirect(referer.includes('/edit') ? '/admin/products/' + id + '/edit' : '/admin/products');
});

app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
  db.save();
  req.session.flash = 'Product removed.';
  res.redirect('/admin/products');
});

function faqsFor(categoryId) {
  return db.all(
    'SELECT * FROM faqs WHERE category_id = ? AND product_id IS NULL ORDER BY sort_order, id',
    [categoryId]
  );
}

function faqsForProduct(product) {
  const shared = db.all(
    'SELECT * FROM faqs WHERE category_id = ? AND product_id IS NULL AND on_product = 1 ORDER BY sort_order, id',
    [product.category_id]
  );
  const specific = db.all('SELECT * FROM faqs WHERE product_id = ? ORDER BY sort_order, id', [product.id]);
  const replaced = new Set(specific.map((row) => String(row.question || '').trim().toLowerCase()));
  const merged = [];
  shared.forEach((row) => {
    if (!replaced.has(String(row.question || '').trim().toLowerCase())) merged.push(row);
  });
  return merged.concat(specific);
}

function faqSiblings(faq) {
  if (faq.product_id) {
    return db.all('SELECT id FROM faqs WHERE product_id = ? ORDER BY sort_order, id', [faq.product_id]);
  }
  if (!Number(faq.category_id)) {
    return db.all(
      'SELECT id FROM faqs WHERE category_id = 0 AND topic = ? AND product_id IS NULL ORDER BY sort_order, id',
      [faq.topic || '']
    );
  }
  return db.all(
    'SELECT id FROM faqs WHERE category_id = ? AND product_id IS NULL ORDER BY sort_order, id',
    [faq.category_id]
  );
}

function safeAdminPath(value, fallback) {
  const path = String(value || '').trim();
  if (/^\/admin\/[a-z0-9\-/#]+$/i.test(path)) return path;
  return fallback;
}

function faqReturn(faq, body) {
  const fallback = faq.product_id
    ? '/admin/products/' + faq.product_id + '/edit#questions'
    : '/admin/faqs#' + (faq.product_id ? 'product-' + faq.product_id : !Number(faq.category_id) ? faq.topic || 'products' : 'cat-' + faq.category_id);
  return safeAdminPath(body && body.return_to, fallback);
}

function readFaqFields(body) {
  return {
    question: String(body.question || '').trim(),
    answer: String(body.answer || '').trim(),
    on_product: body.on_product ? 1 : 0,
    reviewed_on: String(body.reviewed_on || '').trim(),
    evidence: String(body.evidence || '').trim(),
    topic: String(body.topic || '').trim(),
  };
}

function ensureFaqs() {
  const count = db.get('SELECT COUNT(*) AS n FROM faqs');
  if (count && count.n > 0) return;
  categories().forEach((category) => {
    const rows = CATEGORY_FAQS[category.slug] || [];
    rows.forEach((row, index) => {
      db.run(
        'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
        [category.id, row.question, row.answer, index, row.on_product ? 1 : 0, REVIEWED, row.evidence || '']
      );
    });
  });
  FAQ_TOPICS.forEach((topic) => {
    (GENERAL_FAQS[topic.id] || []).forEach((row, index) => {
      db.run(
        'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (0, NULL, ?, ?, ?, ?, 0, ?, ?)',
        [topic.id, row.question, row.answer, index, REVIEWED, row.evidence || '']
      );
    });
  });
  PRODUCT_FAQS.forEach((row) => {
    const product = db.get('SELECT id, category_id FROM products WHERE slug = ?', [row.slug]);
    if (!product) return;
    db.run(
      'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (?, ?, NULL, ?, ?, 0, 0, ?, ?)',
      [product.category_id, product.id, row.question, row.answer, REVIEWED, row.evidence || '']
    );
  });
  db.save();
}

app.get('/admin/categories', requireAdmin, (req, res) => {
  const cats = categories().map((cat) => Object.assign({}, cat, { faqs: faqsFor(cat.id) }));
  res.render('admin/categories', { title: 'Categories', cats });
});

app.post('/admin/categories/:id', requireAdmin, (req, res) => {
  upload.single('hero_image')(req, res, (err) => {
    const id = Number(req.params.id);
    const existing = db.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.redirect('/admin/categories');
    if (err) {
      req.session.flash = err.message;
      return res.redirect('/admin/categories');
    }
    const hero = req.file ? storeUpload(req.file) : existing.hero_image;
    db.run('UPDATE categories SET about_title = ?, intro = ?, hero_image = ? WHERE id = ?', [
      String(req.body.about_title || '').trim(),
      String(req.body.intro || '').trim(),
      hero,
      id,
    ]);
    const soonName = 'coming_soon_' + existing.slug;
    const soonValue = req.body.coming_soon ? '1' : '0';
    if (db.get('SELECT name FROM settings WHERE name = ?', [soonName])) {
      db.run('UPDATE settings SET value = ? WHERE name = ?', [soonValue, soonName]);
    } else {
      db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [soonName, soonValue]);
    }
    db.save();
    req.session.flash = existing.name + ' updated.';
    res.redirect('/admin/categories');
  });
});

app.post('/admin/categories/:id/faqs', requireAdmin, (req, res) => {
  const category = db.get('SELECT * FROM categories WHERE id = ?', [Number(req.params.id)]);
  if (!category) return res.redirect('/admin/categories');
  const fields = readFaqFields(req.body);
  const question = fields.question;
  const answer = fields.answer;
  if (!question || !answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#cat-' + category.id));
  }
  const max = db.get(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM faqs WHERE category_id = ? AND product_id IS NULL',
    [category.id]
  );
  db.run(
    'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    [category.id, fields.question, fields.answer, Number(max.m) + 1, fields.on_product, fields.reviewed_on, fields.evidence]
  );
  db.save();
  req.session.flash = 'Question added to ' + category.name + '.';
  res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#cat-' + category.id));
});

app.post('/admin/faqs/:id', requireAdmin, (req, res) => {
  const faq = db.get('SELECT * FROM faqs WHERE id = ?', [Number(req.params.id)]);
  if (!faq) return res.redirect('/admin/categories');
  const fields = readFaqFields(req.body);
  if (!fields.question || !fields.answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect(faqReturn(faq, req.body));
  }
  const topic = fields.topic || faq.topic || '';
  db.run(
    'UPDATE faqs SET question = ?, answer = ?, on_product = ?, reviewed_on = ?, evidence = ?, topic = ? WHERE id = ?',
    [fields.question, fields.answer, faq.product_id ? 0 : fields.on_product, fields.reviewed_on, fields.evidence, topic, faq.id]
  );
  db.save();
  req.session.flash = 'Question updated.';
  res.redirect(faqReturn(faq, req.body));
});

app.post('/admin/faqs/:id/delete', requireAdmin, (req, res) => {
  const faq = db.get('SELECT * FROM faqs WHERE id = ?', [Number(req.params.id)]);
  db.run('DELETE FROM faqs WHERE id = ?', [Number(req.params.id)]);
  db.save();
  req.session.flash = 'Question removed.';
  res.redirect(faq ? faqReturn(faq, req.body) : '/admin/faqs');
});

app.post('/admin/faqs/:id/move', requireAdmin, (req, res) => {
  const faq = db.get('SELECT * FROM faqs WHERE id = ?', [Number(req.params.id)]);
  if (!faq) return res.redirect('/admin/categories');
  const siblings = faqSiblings(faq);
  const index = siblings.findIndex((row) => Number(row.id) === Number(faq.id));
  const next = req.body.direction === 'up' ? index - 1 : index + 1;
  if (index >= 0 && next >= 0 && next < siblings.length) {
    const swapped = siblings.slice();
    const hold = swapped[index];
    swapped[index] = swapped[next];
    swapped[next] = hold;
    swapped.forEach((row, i) => db.run('UPDATE faqs SET sort_order = ? WHERE id = ?', [i, row.id]));
    db.save();
  }
  res.redirect(faqReturn(faq, req.body));
});

app.get('/admin/faqs', requireAdmin, (req, res) => {
  const groups = FAQ_TOPICS.map((topic) => ({
    id: topic.id,
    title: topic.title,
    faqs: db.all(
      'SELECT * FROM faqs WHERE category_id = 0 AND topic = ? AND product_id IS NULL ORDER BY sort_order, id',
      [topic.id]
    ),
  }));
  const cats = categories().map((cat) => Object.assign({}, cat, { faqs: faqsFor(cat.id) }));
  const products = db.all(
    `SELECT p.id, p.name, c.name AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.name`
  ).map((product) => Object.assign({}, product, {
    faqs: db.all('SELECT * FROM faqs WHERE product_id = ? ORDER BY sort_order, id', [product.id]),
  }));
  res.render('admin/faqs', { title: 'FAQs', groups, cats, products });
});

app.post('/admin/faqs', requireAdmin, (req, res) => {
  const fields = readFaqFields(req.body);
  const topic = FAQ_TOPICS.some((item) => item.id === fields.topic) ? fields.topic : 'products';
  if (!fields.question || !fields.answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#' + topic));
  }
  const max = db.get(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM faqs WHERE category_id = 0 AND topic = ? AND product_id IS NULL',
    [topic]
  );
  db.run(
    'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (0, NULL, ?, ?, ?, ?, 0, ?, ?)',
    [topic, fields.question, fields.answer, Number(max.m) + 1, fields.reviewed_on, fields.evidence]
  );
  db.save();
  req.session.flash = 'Question added.';
  res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#' + topic));
});

app.post('/admin/products/:id/faqs', requireAdmin, (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!product) return res.redirect('/admin/products');
  const fields = readFaqFields(req.body);
  if (!fields.question || !fields.answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#product-' + product.id));
  }
  const max = db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM faqs WHERE product_id = ?', [product.id]);
  db.run(
    'INSERT INTO faqs (category_id, product_id, topic, question, answer, sort_order, on_product, reviewed_on, evidence) VALUES (?, ?, NULL, ?, ?, ?, 0, ?, ?)',
    [product.category_id, product.id, fields.question, fields.answer, Number(max.m) + 1, fields.reviewed_on, fields.evidence]
  );
  db.save();
  req.session.flash = 'Question added for this product.';
  res.redirect(safeAdminPath(req.body.return_to, '/admin/faqs#product-' + product.id));
});

app.get('/admin/homepage', requireAdmin, (req, res) => {
  deliveryCopy();
  res.render('admin/homepage', { title: 'Homepage', settings: settingsMap() });
});

app.post('/admin/homepage', requireAdmin, (req, res) => {
  const fileFields = [{ name: 'hero_image', maxCount: 1 }].concat(
    categories().map((cat) => ({ name: 'menu_image_' + cat.slug, maxCount: 1 }))
  );
  upload.fields(fileFields)(req, res, (err) => {
    if (err) {
      req.session.flash = err.message;
      return res.redirect('/admin/homepage');
    }
    const current = settingsMap();
    const files = req.files || {};
    const heroFile = files.hero_image && files.hero_image[0];
    const next = {
      hero_kicker: String(req.body.hero_kicker || '').trim(),
      hero_headline: String(req.body.hero_headline || '').trim(),
      hero_subhead: String(req.body.hero_subhead || '').trim(),
      story_teaser: String(req.body.story_teaser || '').trim(),
      shop_intro: String(req.body.shop_intro || '').trim(),
      delivery_label: String(req.body.delivery_label || '').trim() || current.delivery_label || DELIVERY_COPY.delivery_label,
      shipping_prompt: String(req.body.shipping_prompt || '').trim() || current.shipping_prompt || DELIVERY_COPY.shipping_prompt,
      lockbox_note: String(req.body.lockbox_note || '').trim() || current.lockbox_note || DELIVERY_COPY.lockbox_note,
      hero_image: heroFile ? storeUpload(heroFile) : current.hero_image || '',
    };
    categories().forEach((cat) => {
      const field = 'menu_image_' + cat.slug;
      const file = files[field] && files[field][0];
      next[field] = file ? storeUpload(file) : current[field] || '';
    });
    Object.keys(next).forEach((name) => {
      const existing = db.get('SELECT name FROM settings WHERE name = ?', [name]);
      if (existing) db.run('UPDATE settings SET value = ? WHERE name = ?', [next[name], name]);
      else db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, next[name]]);
    });
    db.save();
    req.session.flash = 'Homepage words saved.';
    res.redirect('/admin/homepage');
  });
});

function readTestimonial(body) {
  return {
    quote: String(body.quote || '').replace(/\u0000/g, '').trim().slice(0, 600),
    name: String(body.name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80),
    detail: String(body.detail || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80),
    product: String(body.product || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80),
    published: body.published ? 1 : 0,
  };
}

function allTestimonials() {
  return db.all('SELECT * FROM testimonials ORDER BY sort_order, id');
}

app.get('/admin/testimonials', requireAdmin, (req, res) => {
  res.render('admin/testimonials', { title: 'Loved by Customers', testimonials: allTestimonials() });
});

app.post('/admin/testimonials', requireAdmin, (req, res) => {
  const fields = readTestimonial(req.body);
  if (!fields.quote || !fields.name) {
    req.session.flash = 'A testimonial needs the customer’s words and a name.';
    return res.redirect('/admin/testimonials#new');
  }
  const max = db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM testimonials');
  db.run(
    'INSERT INTO testimonials (quote, name, detail, product, rating, published, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    [fields.quote, fields.name, fields.detail, fields.product, fields.published, Number(max.m) + 1, new Date().toISOString()]
  );
  db.save();
  req.session.flash = fields.published ? 'Testimonial added to the homepage.' : 'Testimonial saved as a draft.';
  res.redirect('/admin/testimonials');
});

app.post('/admin/testimonials/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const fields = readTestimonial(req.body);
  if (!fields.quote || !fields.name) {
    req.session.flash = 'A testimonial needs the customer’s words and a name.';
    return res.redirect('/admin/testimonials#t-' + id);
  }
  db.run('UPDATE testimonials SET quote = ?, name = ?, detail = ?, product = ?, published = ? WHERE id = ?', [
    fields.quote, fields.name, fields.detail, fields.product, fields.published, id,
  ]);
  db.save();
  req.session.flash = 'Testimonial updated.';
  res.redirect('/admin/testimonials#t-' + id);
});

app.post('/admin/testimonials/:id/delete', requireAdmin, (req, res) => {
  db.run('DELETE FROM testimonials WHERE id = ?', [Number(req.params.id)]);
  db.save();
  req.session.flash = 'Testimonial removed.';
  res.redirect('/admin/testimonials');
});

app.post('/admin/testimonials/:id/move', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const rows = allTestimonials();
  const index = rows.findIndex((row) => Number(row.id) === id);
  const next = req.body.direction === 'up' ? index - 1 : index + 1;
  if (index >= 0 && next >= 0 && next < rows.length) {
    const hold = rows[index];
    rows[index] = rows[next];
    rows[next] = hold;
    rows.forEach((row, i) => db.run('UPDATE testimonials SET sort_order = ? WHERE id = ?', [i, row.id]));
    db.save();
  }
  res.redirect('/admin/testimonials#t-' + id);
});

app.get('/admin/pages', requireAdmin, (req, res) => {
  res.render('admin/pages', { title: 'Pages', settings: ensurePageCopy() });
});

app.post('/admin/pages/story', requireAdmin, (req, res) => {
  savePageFields(PAGE_GROUPS.story, req.body);
  req.session.flash = 'Our Story saved.';
  res.redirect('/admin/pages#edit-story');
});

app.post('/admin/pages/standards', requireAdmin, (req, res) => {
  savePageFields(STANDARDS_FIELDS, req.body);
  req.session.flash = 'Our Standards saved.';
  res.redirect('/admin/pages');
});

app.post('/admin/pages/pickup', requireAdmin, (req, res) => {
  savePageFields(PICKUP_FIELDS, req.body);
  req.session.flash = 'Delivery & Pick up saved.';
  res.redirect('/admin/pages');
});

app.post('/admin/pages/contact', requireAdmin, (req, res) => {
  const email = String(req.body.contact_email || '').replace(/\s+/g, '').slice(0, 120);
  savePageFields(PAGE_GROUPS.contact, { contact_email: email });
  req.session.flash = 'Contact email saved.';
  res.redirect('/admin/pages');
});

app.post('/admin/pages/glossary', requireAdmin, (req, res) => {
  savePageFields(PAGE_GROUPS.glossary, req.body);
  req.session.flash = 'Glossary saved.';
  res.redirect('/admin/pages#edit-glossary');
});

app.post('/admin/pages/terms', requireAdmin, (req, res) => {
  savePageFields(PAGE_GROUPS.terms, req.body);
  req.session.flash = 'Terms of Use saved.';
  res.redirect('/admin/pages#edit-terms');
});

app.post('/admin/pages/privacy', requireAdmin, (req, res) => {
  savePageFields(PAGE_GROUPS.privacy, req.body);
  req.session.flash = 'Privacy saved.';
  res.redirect('/admin/pages#edit-privacy');
});

app.post('/admin/pages/returns', requireAdmin, (req, res) => {
  savePageFields(PAGE_GROUPS.returns, req.body);
  req.session.flash = 'Returns Policy saved.';
  res.redirect('/admin/pages#edit-returns');
});

app.use((req, res) => {
  res.status(404).render('missing', { title: 'Not found', status: 404 });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.locals.categories = res.locals.categories || [];
  res.locals.cartCount = res.locals.cartCount || 0;
  res.locals.path = res.locals.path || req.path || '/';
  res.locals.year = res.locals.year || new Date().getFullYear();
  res.locals.description = res.locals.description || 'Petite Botanicals.';
  res.locals.canonical = res.locals.canonical || '/';
  res.locals.settings = res.locals.settings || {};
  res.locals.admin = !!res.locals.admin;
  res.locals.flash = res.locals.flash || null;
  res.locals.menuImageFor = res.locals.menuImageFor || function () { return '/images/brand/logo.png'; };
  res.locals.liveImage = res.locals.liveImage || liveImage;
  res.locals.isComingSoon = res.locals.isComingSoon || function () { return false; };
  res.locals.shopName = res.locals.shopName || shopName;
  res.locals.textBlocks = res.locals.textBlocks || aboutBlocks;
  res.status(500).render('missing', { title: 'Something went wrong', status: 500 }, function (renderErr, html) {
    if (renderErr) return res.status(500).type('text').send('Something went wrong.');
    res.send(html);
  });
});

db.init()
  .then(() => {
    ensureCollectionLanguage();
    ensureProductMockups();
    ensureFaqs();
    ensureLocalCollection();
    ensureComingSoon();
    ensureCopyPolish();
    app.listen(PORT, '0.0.0.0', () => {
      const pruneTimer = setInterval(function pruneSessions() {
        const now = Date.now();
        Object.keys(sessionStore.sessions || {}).forEach((sid) => {
          let sess;
          try { sess = JSON.parse(sessionStore.sessions[sid]); } catch (err) {
            delete sessionStore.sessions[sid];
            return;
          }
          const expires = sess && sess.cookie && sess.cookie.expires;
          if (expires && new Date(expires).getTime() <= now) delete sessionStore.sessions[sid];
        });
      }, 15 * 60 * 1000);
      if (pruneTimer.unref) pruneTimer.unref();
      console.log('Petite Botanicals at ' + (publicUrl || 'http://localhost:' + PORT));
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
