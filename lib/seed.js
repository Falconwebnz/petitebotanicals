/**
 * Seed copy is taken from Jen's documents:
 * - PB MY STORY and HOMEPAGE blurb
 * - PB DONE IT NOW FINAL PERFUME RECIPES
 * - PB TARGET MARKET
 * Perfume formulas are the "final revised recipes" (drop counts).
 * Selling prices are the only dollar figures in that document's costing summary.
 * Aurielle's printed label is stored beside the recipe notes because the two differ.
 * Balm, magnesium spray and room mist cards are starters: the docs name the
 * first two as product types, and do not specify a finished room mist.
 */

function setting(db, name, value) {
  db.run('INSERT INTO settings (name, value) VALUES (?, ?)', [name, value]);
}

function category(db, row) {
  db.run(
    `INSERT INTO categories (slug, name, intro, hero_image, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [row.slug, row.name, row.intro, row.hero || '', row.sort]
  );
  return db.get('SELECT id FROM categories WHERE slug = ?', [row.slug]).id;
}

function product(db, row) {
  db.run(
    `INSERT INTO products (
      slug, category_id, name, price_cents, size, short_description, long_description,
      notes, ingredients, how_to_use, precautions, image, featured, in_stock, is_starter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.slug,
      row.categoryId,
      row.name,
      row.price,
      row.size,
      row.short,
      row.long,
      row.notes || '',
      row.ingredients || '',
      row.howTo || '',
      row.precautions || '',
      row.image || '',
      row.featured ? 1 : 0,
      row.inStock === 0 ? 0 : 1,
      row.starter ? 1 : 0,
    ]
  );
}

const perfumePrecaution =
  'External use only. Patch test first and discontinue if irritation occurs. Avoid the eye area.';

const organicLine =
  'The range notes state that all of these blends are made with 100% organic essential oils in organic golden jojoba oil.';

function seed(db, passwordHash, username) {
  db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);

  setting(
    db,
    'hero_kicker',
    'The Still Room · Canterbury'
  );
  setting(
    db,
    'hero_headline',
    'Small-batch, made in Canterbury.'
  );
  setting(
    db,
    'hero_subhead',
    'Natural perfume oils, magnesium sprays and balms for sensitive skin and daily use. Truly natural, with no synthetic fragrance.'
  );
  setting(
    db,
    'story_teaser',
    `Kia ora, I’m Jen. Petite Botanicals is my small natural skincare and perfume brand, based in Canterbury, New Zealand.

I have very fair, sensitive skin, so I’ve always been careful about what I use on my body. As a parent, I’ve become even more mindful about the chemicals we’re routinely exposed to in everyday products. When I started looking for magnesium sprays, perfumes and balms that were truly natural, well documented and gentle enough for daily use, I kept hitting compromises — so I decided to formulate my own.

Every product is built around three non-negotiables: truly natural, non-toxic formulations; high-quality, well-documented ingredients (including certified organic essential oils where possible); and formulas gentle enough for sensitive skin (all citrus oils, including bergamot, are the safe, leave-on-friendly type). Everything is made in small batches in Canterbury, with no synthetic fragrances, harsh preservatives or unnecessary additives.

I keep pricing accessible so these products can be used daily, not saved for special occasions — investing in quality ingredients and transparency, not fancy packaging or big marketing budgets.`
  );
  setting(db, 'hero_image', '/images/brand/meadow.jpg');
  setting(
    db,
    'shop_intro',
    'Small-batch magnesium sprays, natural perfume oils and balms, made in Canterbury for sensitive skin and daily use. All products are truly natural, non-toxic and formulated with high-quality, well-documented ingredients.'
  );
  setting(db, 'delivery_label', 'Delivery nationwide');
  setting(
    db,
    'shipping_prompt',
    'Where to leave the parcel, a gate, or a dog in the yard.'
  );
  setting(db, 'lockbox_note', 'A lock box is available for local pickups.');
  setting(db, 'standards_aside', 'Small batches. External use. Patch test first.');
  setting(db, 'standards_intro', 'Every product is built around three non-negotiables.');
  setting(db, 'standards_point_1', 'Truly natural, non-toxic formulations');
  setting(
    db,
    'standards_point_2',
    'High-quality, well-documented ingredients (certified organic essential oils wherever possible, with IFRA/allergen statements and COA/GC-MS where available)'
  );
  setting(
    db,
    'standards_point_3',
    'Gentle enough for sensitive skin (all citrus oils, including bergamot, are the safe, leave-on-friendly type)'
  );
  setting(db, 'standards_heading', 'What stays on the bench');
  setting(
    db,
    'standards_body',
    'There are no synthetic fragrances, no harsh preservatives and no unnecessary additives. Perfume oils use organic essential oils in organic jojoba. Everything is made in small batches in Canterbury, New Zealand, with a small local team when the bench is busy, and with careful attention to ingredient ratios and skin tolerance.\n\nFormulas are rested and checked before they leave the still room. These products are for external use. Patch test first. They are not a medical treatment.'
  );
  setting(db, 'pickup_aside', 'Local collection, or delivery nationwide.');
  setting(db, 'pickup_lead', 'A lock box is available for local pickups.');
  setting(
    db,
    'pickup_body',
    'At checkout, choose local pickup. Leave the name on the parcel, or a time that suits. Delivery nationwide is still there when a parcel needs to travel.'
  );

  const perfumes = category(db, {
    slug: 'botanical-perfumes',
    name: 'Botanical Perfumes',
    sort: 1,
    hero: '/images/brand/meadow.jpg',
    intro:
      'Alcohol-free perfume oils in 10 ml roll-ons. Personal, skin-close scent for daily wear, blended from organic essential oils in organic golden jojoba and made in small batches in Canterbury. The finished range is Aurielle, Ember, Night Solace and Latitude 44.',
  });

  const balms = category(db, {
    slug: 'balms',
    name: 'Balms',
    sort: 2,
    hero: '',
    intro:
      'Intensive botanical moisture for dry, hard-working skin — hands, feet, elbows and knees. The story and target notes describe balms, and a soothing-balm description is drafted, but a finished formula, size and price are not in the range file yet. The card in this drawer is a starter for Jen to replace.',
  });

  const mists = category(db, {
    slug: 'mist-sprays',
    name: 'Magnesium Body Sprays',
    sort: 3,
    hero: '',
    intro:
      'Magnesium body sprays for an everyday comfort and recovery ritual — not a medical treatment. The range plan describes this product type. A finished formula is not recorded yet, so the card here is marked as a starter.',
  });

  category(db, {
    slug: 'room-mists',
    name: 'Room Mists',
    sort: 4,
    hero: '',
    intro:
      'Scent for the room, in the same quiet still-room spirit. The brand documents do not yet specify a finished room mist. This drawer is ready, with one starter card to replace when a formula exists.',
  });

  const roomId = db.get('SELECT id FROM categories WHERE slug = ?', ['room-mists']).id;

  product(db, {
    slug: 'aurielle',
    categoryId: perfumes,
    name: 'Aurielle',
    price: 1500,
    size: '10 ml roll-on',
    featured: 1,
    image: '/images/brand/aurielle-label.png',
    short:
      'Warm citrus for her. A bright, feminine citrus that glows rather than zings. Easy to wear, perfect for daytime.',
    notes: 'Label: bright citrus floral. Range notes: mandarin, ylang ylang and cedarwood.',
    ingredients: `As printed on the Aurielle label:

Simmondsia Chinensis (Jojoba) Seed Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Pelargonium Roseum Leaf Oil, Cymbopogon Martinii Oil, Cedrus Atlantica Bark Oil, Vetiveria Zizanoides Root Oil, Rosa Alba Flower Extract.

Contains naturally occurring: Limonene, Linalool, Geraniol, Citronellol, Benzyl Benzoate, Citral, Farnesol.

*Certified Organic`,
    howTo: 'Roll on pulse points.',
    precautions: `Patch test first, discontinue if irritation occurs. Avoid sunlight on treated skin, and eye area. Not for children or near pets. Avoid if breastfeeding, pregnant or under medical care. External use only.

As printed on the label: in NZ, 123 King St, Rangiora. Batch number is blank on the label artwork. Rinse and recycle the glass bottle. Dispose of the cap/roller in the rubbish.`,
    long: `A bright, feminine citrus that glows rather than zings. Mandarin, ylang ylang and cedarwood in organic jojoba. Easy to wear, perfect for daytime. The label calls it a bright citrus floral botanical perfume, 10 ml, made in New Zealand.

Still-room formula from the final revised recipe: mandarin 11 drops, ylang ylang 9 drops, cedarwood 5 drops (25 drops total), topped with organic golden jojoba to 10 ml.

The printed bottle lists a different botanical declaration (orange, geranium, palmarosa, cedarwood, vetiver and rose, in jojoba). Both are shown on this card so the shop stays faithful to the label and to the range notes. Edit this listing in the still-room desk if one should replace the other.

${organicLine} The selling price recorded in the range costing summary is NZ$15.`,
  });

  product(db, {
    slug: 'ember',
    categoryId: perfumes,
    name: 'Ember',
    price: 1500,
    size: '10 ml roll-on',
    featured: 1,
    short:
      'Glowing floral warmth. A warmer, deeper sister to Aurielle — cozy and comforting, for evening or cooler weather.',
    notes: 'Ylang ylang, bergamot FCF and patchouli.',
    ingredients:
      'Organic golden jojoba oil, with organic essential oils of ylang ylang, bergamot FCF and patchouli. ' + organicLine,
    howTo: 'Roll on pulse points. Made for evening or cooler weather.',
    precautions:
      perfumePrecaution +
      ' Bergamot in this blend is bergamot FCF, the leave-on-friendly type noted in the brand standards.',
    long: `A warmer, deeper sister to Aurielle. Ylang ylang, bergamot FCF and patchouli in organic jojoba. Cozy and comforting, ideal for evening or cooler weather.

Still-room formula: ylang ylang 11 drops, bergamot FCF 8 drops, patchouli 6 drops (25 drops total), topped with organic golden jojoba to 10 ml.

${organicLine} The selling price recorded in the range costing summary is NZ$15.`,
  });

  product(db, {
    slug: 'night-solace',
    categoryId: perfumes,
    name: 'Night Solace',
    price: 1500,
    size: '10 ml roll-on',
    featured: 1,
    short:
      'A soft evening perfume oil of lavender, Roman chamomile, sweet orange and vetiver. A wind-down scent, not a sleep aid.',
    notes: 'Lavender, Roman chamomile, sweet orange and vetiver.',
    ingredients:
      'Organic golden jojoba oil, with organic essential oils of lavender, Roman chamomile, sweet orange and vetiver. ' +
      organicLine,
    howTo:
      'Roll on pulse points in the evening, as part of a wind-down ritual — for example after an unscented magnesium oil. This is a calming evening scent, not a sleep aid.',
    precautions: perfumePrecaution,
    long: `A soft, soothing aroma for your wind-down ritual. Lavender, Roman chamomile, sweet orange and vetiver in organic jojoba.

The range notes are explicit: describe it as a calming evening scent for a wind-down ritual, not as a medical sleep aid. Vetiver is there so it wears as a perfume oil rather than a simple herbal spray.

Still-room formula: lavender 9 drops, Roman chamomile 6 drops, sweet orange 7 drops, vetiver 3 drops (25 drops total), topped with organic golden jojoba to 10 ml.

${organicLine} The selling price recorded in the range costing summary is NZ$15.`,
  });

  product(db, {
    slug: 'latitude-44',
    categoryId: perfumes,
    name: 'Latitude 44',
    price: 1800,
    size: '10 ml roll-on',
    featured: 1,
    short:
      'Creamy woody perfume. Sandalwood, cedarwood, patchouli and bergamot FCF — grounded, calm, and the unisex woody scent in the range.',
    notes: 'Sandalwood, cedarwood, patchouli and bergamot FCF.',
    ingredients:
      'Organic golden jojoba oil, with organic essential oils of sandalwood, cedarwood, patchouli and bergamot FCF. ' +
      organicLine,
    howTo: 'Roll on pulse points. A skin-close woody perfume for daily wear.',
    precautions:
      perfumePrecaution +
      ' Bergamot in this blend is bergamot FCF, the leave-on-friendly type noted in the brand standards.',
    long: `Creamy woody perfume. Sandalwood, cedarwood, patchouli and a little bergamot FCF in organic golden jojoba. The range notes describe it as grounded and calm, and as the unisex woody scent — including for people who want a more traditionally masculine woody profile.

Still-room formula: sandalwood 9 drops, cedarwood 8 drops, patchouli 5 drops, bergamot FCF 3 drops (25 drops total), topped with organic golden jojoba to 10 ml.

${organicLine} The selling price recorded in the range costing summary is NZ$18.`,
  });

  product(db, {
    slug: 'soothing-balm',
    categoryId: balms,
    name: 'Soothing Balm (starter)',
    price: 1600,
    size: 'Size not set',
    starter: 1,
    featured: 0,
    short:
      'Starter listing. A simple botanical balm is planned for dry, hard-working skin. No finished formula is in the range notes yet.',
    notes: 'Draft only — replace before selling.',
    ingredients:
      'Not recorded yet. Add the finished ingredient list in the still-room desk before this is offered for sale. Do not assume certified organic until the formula says so.',
    howTo: 'Not recorded yet.',
    precautions: 'External use only. This starter is not a finished product and is not a medical treatment.',
    long: `A simple, natural balm drafted for sensitive skin: small batches in Canterbury, high-quality well-documented ingredients, and no synthetic fragrances, harsh preservatives or unnecessary additives. The target notes describe it as intensive botanical moisture for dry areas — hands, feet, elbows and knees — including for people whose hands work hard.

This card is a starter. The documents name the balm and give that description, but they do not include a finished formula, size or selling price. The NZ$16 price is a placeholder so the drawer can be edited. Replace this listing before selling.`,
  });

  product(db, {
    slug: 'magnesium-body-spray',
    categoryId: mists,
    name: 'Magnesium Body Spray (starter)',
    price: 1800,
    size: 'Size not set',
    starter: 1,
    short:
      'Starter listing. A daily magnesium spray for an everyday comfort ritual — not a medical treatment. Formula not yet recorded.',
    notes: 'Draft only — replace before selling.',
    ingredients:
      'Not recorded yet. Add the finished ingredient list in the still-room desk before this is offered for sale.',
    howTo:
      'Not recorded yet. The range notes frame this as a skin-applied, non-oral magnesium option for a comfort and recovery ritual, including evening wind-down. It is not a medical treatment.',
    precautions:
      'External use only. This starter is not a finished product. It is positioned as a comfort ritual, not a treatment for any condition.',
    long: `A simple, daily-use magnesium spray drafted for sensitive skin. Made, when finished, in small batches in Canterbury with high-quality, well-documented ingredients and no synthetic fragrances, harsh preservatives or unnecessary additives.

Positioning from the target notes: an everyday comfort and recovery ritual, not a medical treatment. People may use it after exercise or as part of an evening wind-down. No concentration, scent or bottle size is specified in the documents.

This card is a starter. The NZ$18 price is a placeholder. Replace the listing before selling.`,
  });

  product(db, {
    slug: 'room-mist-starter',
    categoryId: roomId,
    name: 'Room Mist (starter)',
    price: 1600,
    size: 'Size not set',
    starter: 1,
    short:
      'Starter listing. The brand documents do not yet describe a finished room mist. Replace this card before selling.',
    notes: 'No scent recorded yet.',
    ingredients:
      'Not recorded. Do not claim certified organic, or any specific oils, until a formula is written.',
    howTo: 'Not recorded yet. A room mist would be for the room, not for skin.',
    precautions: 'This is a placeholder card, not a finished product.',
    long: `Room mists are one of the four shop drawers. Jen’s story, target notes and perfume recipes do not specify a finished room mist — no name, botanical blend, size or price.

This starter keeps the drawer open. The NZ$16 price is a placeholder. Write the real mist in the still-room desk, then remove the starter flag.`,
  });
}

module.exports = { seed };
