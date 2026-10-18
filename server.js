require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./lib/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'still-room-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// #region agent log
function agentLog(hypothesisId, location, message, data) {
  fetch('http://127.0.0.1:7878/ingest/9a85748d-e216-49b2-ae8f-dd4a6bd14968', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '44b7c5' },
    body: JSON.stringify({
      sessionId: '44b7c5',
      runId: 'post-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
app.use((req, res, next) => {
  const referer = req.get('referer') || '';
  const leavingAdmin = referer.includes('/admin') && !req.path.startsWith('/admin');
  if (req.method === 'POST' || leavingAdmin) {
    agentLog('A', 'server.js:request', 'incoming request', {
      method: req.method,
      path: req.path,
      referer,
      contentType: req.get('content-type') || '',
      hasAdmin: !!(req.session && req.session.admin),
      leavingAdmin,
    });
  }
  next();
});
// #endregion

function nzd(cents) {
  const n = Number(cents) || 0;
  return 'NZ$' + (n / 100).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  while (true) {
    const row = db.get('SELECT id FROM products WHERE slug = ?', [candidate]);
    if (!row || (ignoreId && Number(row.id) === Number(ignoreId))) return candidate;
    n += 1;
    candidate = base + '-' + n;
  }
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

function cartLines(sessionCart) {
  const items = [];
  let subtotal = 0;
  for (const line of sessionCart || []) {
    const product = db.get('SELECT * FROM products WHERE id = ?', [line.id]);
    if (!product) continue;
    const qty = Math.max(1, Number(line.qty) || 1);
    const lineTotal = product.price_cents * qty;
    subtotal += lineTotal;
    items.push({ product, qty, lineTotal });
  }
  return { items, subtotal };
}

function stripeReady() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_') || key.startsWith('sk_live_');
}

const DELIVERY_COPY = {
  delivery_label: 'Delivery nationwide',
  shipping_prompt: 'Where to leave the parcel, a gate, or a dog in the yard.',
  lockbox_note: 'A lock box is available for local pickups.',
};

const PAGE_COPY = {
  standards_aside: 'Small batches. External use. Patch test first.',
  standards_intro: 'Every product is built around three non-negotiables.',
  standards_point_1: 'Truly natural, non-toxic formulations',
  standards_point_2:
    'High-quality, well-documented ingredients (certified organic essential oils wherever possible, with IFRA/allergen statements and COA/GC-MS where available)',
  standards_point_3:
    'Gentle enough for sensitive skin (all citrus oils, including bergamot, are the safe, leave-on-friendly type)',
  standards_heading: 'What stays on the bench',
  standards_body:
    'There are no synthetic fragrances, no harsh preservatives and no unnecessary additives. Perfume oils use organic essential oils in organic jojoba. Everything is made in small batches in Canterbury, New Zealand, with a small local team when the bench is busy, and with careful attention to ingredient ratios and skin tolerance.\n\nFormulas are rested and checked before they leave the still room. These products are for external use. Patch test first. They are not a medical treatment.',
  pickup_aside: 'Local collection, or delivery nationwide.',
  pickup_lead: 'A lock box is available for local pickups.',
  pickup_body:
    'At checkout, choose local pickup. Leave the name on the parcel, or a time that suits. Delivery nationwide is still there when a parcel needs to travel.',
};

const STANDARDS_FIELDS = [
  'standards_aside',
  'standards_intro',
  'standards_point_1',
  'standards_point_2',
  'standards_point_3',
  'standards_heading',
  'standards_body',
];

const PICKUP_FIELDS = ['pickup_aside', 'pickup_lead', 'pickup_body'];

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

function readFulfilment(body) {
  const method = body && body.fulfilment === 'pickup' ? 'pickup' : 'delivery';
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
  const saved = opts.saved || { method: 'delivery', note: '' };
  const method = saved.method === 'pickup' ? 'pickup' : 'delivery';
  const note = saved.note || '';
  return {
    title: 'Checkout',
    cart,
    stripeReady: Object.prototype.hasOwnProperty.call(opts, 'stripeReady') ? opts.stripeReady : stripeReady(),
    stripeError: opts.stripeError || null,
    copy: deliveryCopy(),
    fulfilment: method,
    shippingNote: method === 'delivery' ? note : '',
    pickupNote: method === 'pickup' ? note : '',
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safe = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
      cb(null, Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + safe);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Use a JPG, PNG, WEBP or GIF image.'));
  },
});

app.use((req, res, next) => {
  const lines = cartLines(req.session.cart);
  res.locals.cartCount = lines.items.reduce((sum, item) => sum + item.qty, 0);
  res.locals.cartSubtotal = lines.subtotal;
  res.locals.categories = categories();
  res.locals.nzd = nzd;
  res.locals.path = req.path;
  res.locals.admin = !!req.session.admin;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.year = new Date().getFullYear();
  next();
});

function requireAdmin(req, res, next) {
  // #region agent log
  agentLog('A', 'server.js:requireAdmin', 'admin gate', {
    path: req.path,
    method: req.method,
    allowed: !!req.session.admin,
  });
  // #endregion
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
    image: file ? '/uploads/' + file.filename : existing ? existing.image : '',
    featured: body.featured ? 1 : 0,
    in_stock: body.in_stock ? 1 : 0,
    is_starter: body.is_starter ? 1 : 0,
  };
}

app.get('/', (req, res) => {
  const settings = settingsMap();
  const featured = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.featured = 1 ORDER BY p.id`
  );
  const cats = categories().map((cat) => {
    const count = db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [cat.id]);
    return Object.assign({}, cat, { count: count.n });
  });
  res.render('home', { title: 'The Still Room', settings, featured, cats });
});

app.get('/shop', (req, res) => {
  const settings = settingsMap();
  const products = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.id`
  );
  res.render('shop', { title: 'Shop', settings, products });
});

app.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = '%' + q.replace(/[%_]/g, '') + '%';
  const products = q
    ? db.all(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.name LIKE ? OR p.short_description LIKE ? OR p.notes LIKE ?
         ORDER BY p.name`,
        [like, like, like]
      )
    : [];
  res.render('search', { title: 'Search', q, products });
});

app.get('/category/:slug', (req, res) => {
  const category = db.get('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
  if (!category) return res.status(404).render('missing', { title: 'Not found' });
  const products = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? ORDER BY p.is_starter, p.id`,
    [category.id]
  );
  const faqs = db.all(
    'SELECT * FROM faqs WHERE category_id = ? ORDER BY sort_order, id',
    [category.id]
  );
  res.render('category', { title: category.name, category, products, faqs });
});

app.get('/product/:slug', (req, res) => {
  const product = db.get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ?`,
    [req.params.slug]
  );
  if (!product) return res.status(404).render('missing', { title: 'Not found' });
  const related = db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = ? AND p.id != ? ORDER BY p.id LIMIT 3`,
    [product.category_id, product.id]
  );
  res.render('product', { title: product.name, product, related });
});

app.get('/about', (req, res) => {
  res.render('about', { title: 'My story' });
});

app.get('/standards', (req, res) => {
  res.render('standards', { title: 'Our Standards', settings: ensurePageCopy() });
});

app.get('/pickup', (req, res) => {
  res.render('pickup', { title: 'Local pick up Box', settings: ensurePageCopy() });
});

app.post('/cart/add', (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.body.id)]);
  if (!product || !product.in_stock) {
    req.session.flash = 'That bottle is not available to add just now.';
    return res.redirect(req.get('referer') || '/shop');
  }
  const qty = Math.max(1, Math.min(12, parseInt(req.body.qty, 10) || 1));
  const cart = req.session.cart || [];
  const existing = cart.find((line) => Number(line.id) === Number(product.id));
  if (existing) existing.qty = Math.min(12, existing.qty + qty);
  else cart.push({ id: product.id, qty });
  req.session.cart = cart;
  req.session.flash = product.name + ' is in the basket.';
  res.redirect('/cart');
});

app.post('/cart/update', (req, res) => {
  const id = Number(req.body.id);
  const qty = Math.max(0, Math.min(12, parseInt(req.body.qty, 10) || 0));
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
  const saved = persistFulfilment(req);
  if (!stripeReady()) {
    return res.status(400).render('checkout', checkoutLocals(cart, {
      saved,
      stripeReady: false,
      stripeError: null,
    }));
  }
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const origin = process.env.PUBLIC_URL || req.protocol + '://' + req.get('host');
    const session = await stripe.checkout.sessions.create({
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
      shipping_address_collection: { allowed_countries: ['NZ'] },
      metadata: {
        fulfilment: saved.method,
        fulfilment_note: saved.note,
        order_id: String(req.session.draftOrderId || ''),
      },
      success_url: origin + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/checkout/cancel',
    });
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
        req.session.cart = [];
        if (req.session.draftOrderId) {
          db.run('UPDATE orders SET status = ? WHERE id = ?', ['paid', req.session.draftOrderId]);
          db.save();
        }
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
  res.render('admin/login', { title: 'Still-room desk', error: null });
});

app.post('/admin/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('admin/login', {
      title: 'Still-room desk',
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
      in_stock: 1,
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
        notes, ingredients, how_to_use, precautions, image, featured, in_stock, is_starter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        fields.is_starter,
      ]
    );
    db.save();
    req.session.flash = 'Product saved.';
    res.redirect('/admin/products/' + id + '/edit');
  });
});

app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
  const product = db.get('SELECT * FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!product) return res.status(404).render('missing', { title: 'Not found' });
  res.render('admin/product-form', {
    title: 'Edit ' + product.name,
    product,
    action: '/admin/products/' + product.id,
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
        how_to_use = ?, precautions = ?, image = ?, featured = ?, in_stock = ?, is_starter = ?
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
        fields.is_starter,
        id,
      ]
    );
    db.save();
    const stored = db.get('SELECT name, short_description FROM products WHERE id = ?', [id]);
    // #region agent log
    agentLog('B', 'server.js:product-save', 'product save result', {
      id,
      bodyName: fields.name,
      bodyShort: fields.short_description.slice(0, 80),
      storedName: stored && stored.name,
      storedShort: stored && String(stored.short_description || '').slice(0, 80),
      redirect: '/admin/products/' + id + '/edit',
    });
    // #endregion
    req.session.flash = 'Product updated.';
    res.redirect('/admin/products/' + id + '/edit');
  });
});

app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
  db.save();
  req.session.flash = 'Product removed from the still room.';
  res.redirect('/admin/products');
});

function faqsFor(categoryId) {
  return db.all('SELECT * FROM faqs WHERE category_id = ? ORDER BY sort_order, id', [categoryId]);
}

app.get('/admin/categories', requireAdmin, (req, res) => {
  const cats = categories().map((cat) => Object.assign({}, cat, { faqs: faqsFor(cat.id) }));
  res.render('admin/categories', { title: 'Drawers', cats });
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
    const hero = req.file ? '/uploads/' + req.file.filename : existing.hero_image;
    db.run('UPDATE categories SET intro = ?, hero_image = ? WHERE id = ?', [
      String(req.body.intro || '').trim(),
      hero,
      id,
    ]);
    db.save();
    const stored = db.get('SELECT intro FROM categories WHERE id = ?', [id]);
    // #region agent log
    agentLog('B', 'server.js:category-save', 'category save result', {
      id,
      bodyIntro: String(req.body.intro || '').trim().slice(0, 80),
      storedIntro: stored && String(stored.intro || '').slice(0, 80),
      bodyKeys: Object.keys(req.body || {}),
      redirect: '/admin/categories',
    });
    // #endregion
    req.session.flash = existing.name + ' updated.';
    res.redirect('/admin/categories');
  });
});

app.post('/admin/categories/:id/faqs', requireAdmin, (req, res) => {
  const category = db.get('SELECT * FROM categories WHERE id = ?', [Number(req.params.id)]);
  if (!category) return res.redirect('/admin/categories');
  const question = String(req.body.question || '').trim();
  const answer = String(req.body.answer || '').trim();
  if (!question || !answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect('/admin/categories');
  }
  const max = db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM faqs WHERE category_id = ?', [category.id]);
  db.run('INSERT INTO faqs (category_id, question, answer, sort_order) VALUES (?, ?, ?, ?)', [
    category.id,
    question,
    answer,
    Number(max.m) + 1,
  ]);
  db.save();
  req.session.flash = 'Question added to ' + category.name + '.';
  res.redirect('/admin/categories');
});

app.post('/admin/faqs/:id', requireAdmin, (req, res) => {
  const faq = db.get('SELECT * FROM faqs WHERE id = ?', [Number(req.params.id)]);
  if (!faq) return res.redirect('/admin/categories');
  const question = String(req.body.question || '').trim();
  const answer = String(req.body.answer || '').trim();
  if (!question || !answer) {
    req.session.flash = 'A question needs both a question and an answer.';
    return res.redirect('/admin/categories');
  }
  db.run('UPDATE faqs SET question = ?, answer = ? WHERE id = ?', [question, answer, faq.id]);
  db.save();
  const stored = db.get('SELECT question FROM faqs WHERE id = ?', [faq.id]);
  // #region agent log
  agentLog('B', 'server.js:faq-save', 'faq save result', {
    id: faq.id,
    bodyQuestion: question.slice(0, 80),
    storedQuestion: stored && String(stored.question || '').slice(0, 80),
    redirect: '/admin/categories',
  });
  // #endregion
  req.session.flash = 'Question updated.';
  res.redirect('/admin/categories');
});

app.post('/admin/faqs/:id/delete', requireAdmin, (req, res) => {
  db.run('DELETE FROM faqs WHERE id = ?', [Number(req.params.id)]);
  db.save();
  req.session.flash = 'Question removed.';
  res.redirect('/admin/categories');
});

app.post('/admin/faqs/:id/move', requireAdmin, (req, res) => {
  const faq = db.get('SELECT * FROM faqs WHERE id = ?', [Number(req.params.id)]);
  if (!faq) return res.redirect('/admin/categories');
  const siblings = db.all('SELECT id FROM faqs WHERE category_id = ? ORDER BY sort_order, id', [faq.category_id]);
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
  res.redirect('/admin/categories');
});

app.get('/admin/homepage', requireAdmin, (req, res) => {
  deliveryCopy();
  res.render('admin/homepage', { title: 'Homepage', settings: settingsMap() });
});

app.post('/admin/homepage', requireAdmin, (req, res) => {
  upload.single('hero_image')(req, res, (err) => {
    if (err) {
      // #region agent log
      agentLog('B', 'server.js:homepage-save', 'homepage save rejected', {
        multerError: String(err.message || err),
        redirect: '/admin/homepage',
      });
      // #endregion
      req.session.flash = err.message;
      return res.redirect('/admin/homepage');
    }
    const current = settingsMap();
    const next = {
      hero_kicker: String(req.body.hero_kicker || '').trim(),
      hero_headline: String(req.body.hero_headline || '').trim(),
      hero_subhead: String(req.body.hero_subhead || '').trim(),
      story_teaser: String(req.body.story_teaser || '').trim(),
      shop_intro: String(req.body.shop_intro || '').trim(),
      delivery_label: String(req.body.delivery_label || '').trim() || current.delivery_label || DELIVERY_COPY.delivery_label,
      shipping_prompt: String(req.body.shipping_prompt || '').trim() || current.shipping_prompt || DELIVERY_COPY.shipping_prompt,
      lockbox_note: String(req.body.lockbox_note || '').trim() || current.lockbox_note || DELIVERY_COPY.lockbox_note,
      hero_image: req.file ? '/uploads/' + req.file.filename : current.hero_image || '',
    };
    Object.keys(next).forEach((name) => {
      const existing = db.get('SELECT name FROM settings WHERE name = ?', [name]);
      if (existing) db.run('UPDATE settings SET value = ? WHERE name = ?', [next[name], name]);
      else db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, next[name]]);
    });
    db.save();
    const stored = settingsMap();
    // #region agent log
    agentLog('C', 'server.js:homepage-save', 'homepage save result', {
      bodyKeys: Object.keys(req.body || {}),
      bodyKicker: next.hero_kicker.slice(0, 80),
      storedKicker: String(stored.hero_kicker || '').slice(0, 80),
      bodyHeadline: next.hero_headline.slice(0, 80),
      storedHeadline: String(stored.hero_headline || '').slice(0, 80),
      multerError: err ? String(err.message || err) : '',
      redirect: '/admin/homepage',
    });
    // #endregion
    req.session.flash = 'Homepage words saved.';
    res.redirect('/admin/homepage');
  });
});

app.get('/admin/pages', requireAdmin, (req, res) => {
  res.render('admin/pages', { title: 'Pages', settings: ensurePageCopy() });
});

app.post('/admin/pages/standards', requireAdmin, (req, res) => {
  savePageFields(STANDARDS_FIELDS, req.body);
  const stored = settingsMap();
  // #region agent log
  agentLog('C', 'server.js:standards-save', 'standards page save', {
    bodyIntro: String(req.body.standards_intro || '').trim().slice(0, 80),
    storedIntro: String(stored.standards_intro || '').slice(0, 80),
    redirect: '/admin/pages',
  });
  // #endregion
  req.session.flash = 'Our Standards saved.';
  res.redirect('/admin/pages');
});

app.post('/admin/pages/pickup', requireAdmin, (req, res) => {
  savePageFields(PICKUP_FIELDS, req.body);
  const stored = settingsMap();
  // #region agent log
  agentLog('C', 'server.js:pickup-save', 'pickup page save', {
    bodyLead: String(req.body.pickup_lead || '').trim().slice(0, 80),
    storedLead: String(stored.pickup_lead || '').slice(0, 80),
    redirect: '/admin/pages',
  });
  // #endregion
  req.session.flash = 'Local pick up Box saved.';
  res.redirect('/admin/pages');
});

app.use((req, res) => {
  res.status(404).render('missing', { title: 'Not found' });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Petite Botanicals still room at http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
