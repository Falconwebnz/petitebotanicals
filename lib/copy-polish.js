const crypto = require('crypto');

// A field is only replaced while it still holds the copy that was live when this
// polish was written (matched by fingerprint), so later edits in the desk are kept.
function fingerprint(text) {
  const letters = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return letters ? crypto.createHash('sha1').update(letters).digest('hex').slice(0, 16) : '';
}

function withoutGlossaryPrompt(text) {
  const original = String(text || '');
  if (!original.includes('Read the glossary for more details')) return original;
  return original
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]*Read the glossary for more details\.?/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MIST_HOW_TO = `Shake gently before use. Mist lightly onto clean, dry skin and massage gently until absorbed. Let it dry before dressing.

Suitable for the body and underarms. For external use only.

If you’re new to magnesium mists, start with a small amount on the soles of your feet and use more as your skin adjusts. Use daily or as needed.`;

const MIST_PRECAUTIONS = `For external use only. Avoid contact with the eyes; if contact occurs, rinse thoroughly with clean water.

Do not apply to broken, irritated, infected or freshly shaved skin.

A temporary cooling or tingling sensation may occur, especially on sensitive skin. Before first use, patch test: apply a small amount to a small area of skin and wait 24 hours. If redness, itching, burning, swelling or irritation occurs, stop using the product.

If you have a reaction, stop using the product and let us know. Please include your order and batch numbers if you have them.

Keep out of reach of children and pets. Store in a cool, dry place away from direct sunlight.`;

const ROOM_HOW_TO = `For room use only. Shake gently, then mist 3–5 times into the air for a light, subtle fragrance.

Use in a well-ventilated space. Don’t spray towards your face, eyes, skin, food or pets.

Avoid spraying directly onto furniture, polished or painted surfaces, electronics or delicate fabrics. If using it near fabric, test a small hidden area first and let it dry.

Keep away from open flames, candles, heaters and other sources of heat or ignition.`;

const ROOM_PRECAUTIONS = `For room use only. Do not swallow. Avoid contact with the eyes, skin and mucous membranes; if contact occurs, rinse thoroughly with clean water.

Don’t spray towards the face, eyes or mouth. Avoid using it around pets, particularly in small or poorly ventilated spaces.

Avoid spraying directly onto furniture, polished or painted surfaces, electronics, timber, leather, silk or other delicate fabrics. If using it near fabric, test a small hidden area first and let it dry completely.

Use in a well-ventilated space and avoid breathing in the mist directly.

Contains alcohol and may be flammable. Keep away from open flames, sparks, candles, heaters and other sources of heat or ignition.

Keep out of reach of children and pets. Store in a cool, dry place away from direct sunlight and heat.

If irritation or another reaction occurs, stop using the product, and seek medical advice if symptoms are severe or persistent.`;

const RUB_HOW_TO = `Massage a small amount into clean, unbroken skin on the feet, legs, shoulders, hands or anywhere that feels tired or overworked. Use it after a shower, before bed, or whenever you want a slower moment of care.

For very dry areas such as heels and cuticles, follow with our Foot Balm.`;

const RUB_PRECAUTIONS = `For external use only. Avoid contact with the eyes; if contact occurs, rinse thoroughly with clean water.

Do not apply to broken, irritated, infected or freshly shaved skin.

A temporary cooling or tingling sensation may occur, especially on sensitive skin. Before first use, apply a small amount to a small area of skin and wait 24 hours. If redness, itching, burning, swelling or irritation occurs, stop using the product.

Keep the jar closed when not in use. Use clean, dry hands or a spatula, and don’t let water get into the jar.

Keep out of reach of children and pets. Store in a cool, dry place away from direct sunlight.`;

const ROOM_INGREDIENTS_LEAD = 'A simple blend of alcohol, distilled water and essential oils, brought together with a gentle plant-derived emulsifier.';

const CATEGORY_COPY = {
  'botanical-perfumes': {
    was: ['fae6a40117c8b935'],
    intro: `Personal. Subtle. Botanical.

Petite Botanicals perfumes are blended by hand in small batches in Canterbury, New Zealand. Each one is inspired by the changing light, ancient stone and quiet places of the South Island, and is anchored to a set of map coordinates: a reminder of the place and moment behind it.

They are gentle perfume oils made with pure botanical extracts, organic essential oils where possible, organic vitamin E and organic golden jojoba. They never contain synthetic fragrance.

Unlike a loud alcohol-based spray, a perfume oil wears close to the body and unfolds slowly with the warmth of your skin. Plant oils don’t evaporate into thin air; they stay on the skin as an intimate scent that changes gently through the day.

The full ingredient list for each perfume is on its product page and label.

# Discover the collection
Start with the scent family you already enjoy: the bright, rosy warmth of Orange Rose & Cedar, the soft herbal calm of Night Solace, or the crisp bergamot, dry cedarwood and deep patchouli of Latitude 44.

Each product page shares the key notes and the story of its place, so you can choose the perfume that suits your day, your mood or the moment.

# How to wear your roll-on
Apply to your pulse points: wrists, the sides of the neck, inner elbows and just behind the ears. Your body warmth helps the scent unfold.

Press, don’t rub. After applying to your wrists, press them gently together. Rubbing creates friction and heat, which makes the delicate citrus opening fade faster.

For a softer scent, roll a little into your palms and smooth it lightly through the ends of your hair.

# Precautions
We use carefully measured levels of essential oils and no synthetic fragrance. Essential oils can still cause sensitivity in some people, so patch test on a small area before first use, and stop using the perfume if irritation occurs.

Perfume oils can mark fabric. Let the oil absorb before dressing, and avoid direct contact with silk or light-coloured clothing.

To keep your perfume at its best:
- Store it upright with the cap tightly closed, away from direct sunlight and humidity.
- A cool, dark drawer or your bag is ideal. Avoid the bathroom.
- Don’t refrigerate it. The natural jojoba wax can solidify in the cold.`,
  },
  balms: {
    was: ['198040559328ff16'],
    intro: `Small-batch balms and rubs for lips, hands and body, made in Canterbury with no synthetic fragrance.

# Lip balms
Pure Lip Balm keeps it simple: no colour, no flavour and no scent.

Rosy Beet and Ruby Beet lip balms are also unflavoured and unscented, with a tint from organic beetroot powder. Rosy Beet gives a light, sheer colour; Ruby Beet is deeper, if you like a little more.

# Balms for body and hands
Foot Balm is a rich, water-free hemp seed balm with rose geranium, peppermint and a little ylang ylang. Use it on dry feet, hands, elbows and knees.

Gardener’s Balm and our unscented Soothing Balm are all-rounders for everyday skin care. Rub a little in wherever skin feels dry or tight.

# Magnesium rubs
Our magnesium rubs are smooth, rich creams for massaging into feet, legs, shoulders and hands.

Lavender Evening Magnesium Rub has a quiet evening scent of lavender, Atlas cedarwood and vetiver.

Night Solace Magnesium Rub has a very subtle, barely-there botanical scent.

Rosemary & Frankincense Magnesium Rub adds peppermint and copaiba for a fresher, herbal scent.

Fragrance-Free Magnesium Rub is unscented, for anyone who would rather skip the scent.

# How they’re made
Every balm and rub is made in small batches in Canterbury from well-documented ingredients, organic where we can, with no synthetic fragrance.

They come in glass jars. When yours is empty, please reuse or recycle it.

# Precautions
For external use only. Keep away from the eyes, and stop using the product if your skin becomes irritated. Keep out of reach of children and pets.

These are cosmetic body-care products, not medical treatments.`,
  },
  'mist-sprays': {
    was: ['12ce20759c537cad'],
    intro: `Our magnesium body mists come in glass bottles and are made for underarms and everyday body care. There are four scents, from fragrance-free Pure to a soft evening blend of chamomile and marjoram.

Light, quick and easy to apply, a mist suits a simple everyday moment. For something richer and slower, more like a massage, try one of our magnesium rubs.

# Choose your scent
- Pure: unscented and minimal, for anyone who prefers no scent at all.
- Sweet Orange & Copaiba: bright, sunny and fresh.
- Bergamot & Cedarwood: fresh bergamot, warm cedarwood and the soft, resinous depth of frankincense.
- Chamomile & Marjoram: a soft, calming blend for winding down in the evening.

# How to use
Spray a light layer onto clean, dry skin and let it absorb before dressing.

# Precautions
For external use only. This is a cosmetic product, not a medical treatment.

If applied heavily, or if you dress before it’s dry, the mist may leave a faint mark on fabric. Rinsing with cool water usually removes it. Spray your skin, not your clothes or jewellery.

# Any other questions?
Our FAQs below cover underarms, shaving, that tell-tale tingle, storage and what’s inside.`,
  },
  'room-mists': {
    was: ['4aa0cd053fbd48db'],
    intro: `Our room mists are botanical sprays that freshen the air and bring a gentle scent to your home.

There are two blends for now: one warm and spiced, one fresh and quietly calming. Both are made in small batches in Canterbury, scented only with essential oils, with no synthetic fragrance.

# Our standards
Made in small batches in Canterbury from well-documented ingredients.

Each mist comes in a blue or green glass bottle. When it’s empty, please reuse or recycle the bottle. The spray nozzle and cap go in general rubbish.

# How to use
Shake gently before use. Mist 3–4 times towards the centre of the room, away from your face, and let the fine mist settle.

Use in a well-ventilated space, and don’t spray directly onto delicate surfaces, fabrics, skin or pets.

# Precautions
For room use only. Keep out of reach of children and pets.

This is a home fragrance product, not a medical treatment.`,
  },
};

const PRODUCT_COPY = {
  'pure-fragrance-free': {
    short_description: {
      was: '828acad12cfeeb46',
      text: 'A simple, understated mist for underarms and body care: magnesium chloride, propanediol and cucumber extract in a light, fast-drying formula.',
    },
    long_description: {
      was: '888961eeaf18e2d0',
      text: `A quiet, understated everyday mist.

Pure is our simplest magnesium body mist: fragrance-free, lightweight and made for the moments when you want clean, comfortable skin without added scent.

Magnesium chloride and plant-derived propanediol give a light, fast-drying finish, while cucumber extract adds a fresh, clean feel. With no essential oils or fragrance, it layers easily under your favourite perfume, or simply stands on its own.

Use it after a shower, after exercise, or whenever you want a quiet moment of body care.

A little goes a long way.

# Scent
Fragrance-free.

# Feel
Lightweight, fast-drying and non-sticky.

# Best for
A minimal everyday body mist, or anyone who prefers no fragrance.

# Pairs well with
One of our magnesium rubs, for a richer, slower application.`,
    },
    ingredients: {
      was: '6ed7b300fcc15a8c',
      text: `Aqua, Magnesium Chloride, Propanediol, Glycerin*, Cucumis Sativus Fruit Extract*.

*Certified organic ingredient.`,
    },
    how_to_use: { was: '4f3b9fef70d64716', text: MIST_HOW_TO },
    precautions: { was: '85e58d5d566c2c02', text: MIST_PRECAUTIONS },
  },
  'sweet-orange-copaiba': {
    short_description: {
      was: 'b4aebb55b2cfb828',
      text: 'A bright, sunny lift for everyday body care: sweet orange, copaiba and cucumber in a light, fresh magnesium mist.',
    },
    long_description: {
      was: '3c5ed6fe62d575f2',
      text: `A bright, sunny everyday lift.

Sweet orange opens with a cheerful brightness, softened by the gentle, resinous warmth of copaiba. Underneath, cucumber extract adds a cool, clean finish that keeps the blend fresh rather than sweet.

This is a mist for starting the day: after a shower, before getting dressed, or as a light refresher on a warm afternoon. It’s bright without being sharp, fresh without feeling cold, and light without feeling sticky.

Magnesium chloride and plant-derived propanediol make a weightless mist that absorbs easily and leaves skin feeling comfortable and refreshed.

A little goes a long way.

# Feel
Fresh, lightweight and non-sticky.

# Best for
Morning showers, warm days and everyday freshness.

# Pairs well with
Any of our magnesium rubs, for a richer, slower application.`,
    },
    ingredients: {
      was: 'e0cd2d651f6df4b5',
      text: `Aqua, Magnesium Chloride, Propanediol, Caprylyl/Capryl Glucoside, Citrus Aurantium Dulcis Peel Oil*, Glycerin, Copaifera Officinalis Resin Oil*, Cucumis Sativus Fruit Extract, Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*, +Limonene, +Beta-Caryophyllene.

*Certified organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: { was: '5d4ff843744dbd72', text: MIST_HOW_TO },
    precautions: { was: '85e58d5d566c2c02', text: MIST_PRECAUTIONS },
  },
  'bergamot-cedarwood': {
    short_description: {
      was: 'dbecc83b592763e0',
      text: 'A light, uplifting magnesium mist. Bergamot, cedarwood and frankincense bring a quiet, considered freshness to daily body care.',
    },
    long_description: {
      was: '0851bec524d555a4',
      text: `A quiet, considered freshness.

Bergamot opens with a bright, gently citrus lift, softened by the warm, dry character of cedarwood. Frankincense sits quietly in the background, adding a soft, resinous depth that keeps the blend grounded rather than sharp.

This is a mist for steady, everyday moments: after a shower, before getting dressed, or whenever you want a clean scent that doesn’t ask for attention. It’s fresh without being cold, woody without feeling heavy, and quietly uplifting rather than sweet.

Magnesium chloride, plant-derived propanediol and cucumber extract make a lightweight mist that absorbs easily and leaves skin feeling refreshed and comfortable.

A little goes a long way.

# Scent
Fresh bergamot, warm cedarwood and the soft, resinous depth of frankincense.

# Feel
Lightweight, fast-drying and non-sticky.

# Best for
Everyday freshness, steady mornings and quiet moments.

# Pairs well with
Our magnesium rubs, for a richer, slower application.`,
    },
    ingredients: {
      was: '9aabb67cf2965698',
      text: `Aqua, Magnesium Chloride, Propanediol, Glycerin, Cucumis Sativus Fruit Extract, Caprylyl/Capryl Glucoside, Citrus Aurantium Bergamia Peel Oil*, Boswellia Carterii Oil*, Cedrus Atlantica Wood Oil*, Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*, +Limonene, +Linalool.

*Certified organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: { was: 'cce71a256d2bd194', text: MIST_HOW_TO },
    precautions: { was: '1c0d2006537a2dbe', text: MIST_PRECAUTIONS },
  },
  'chamomile-marjoram': {
    short_description: {
      was: '76b990dca3906083',
      text: 'A soft, comforting close to the day. Roman chamomile, sweet marjoram and bergamot FCF in a light, herbal-floral mist. Lavender-free.',
    },
    long_description: {
      was: '5e622c1a368739f1',
      text: `A soft, comforting close to the day.

Roman chamomile opens with a quiet floral softness, warmed by sweet marjoram and lifted by a little bergamot. Together they make a warm herbal-citrus scent that feels calm without being heavy.

This is a mist for slowing down: after an evening shower, before bed, or whenever the day calls for a gentler pace. It’s soft without being sweet and herbal without being sharp.

Magnesium chloride, plant-derived propanediol and cucumber extract make a lightweight mist that absorbs easily and leaves skin feeling refreshed and comfortable.

A little goes a long way.

# Scent
Soft chamomile and marjoram, with a gentle lift of bergamot.

# Feel
Lightweight, fast-drying and non-sticky.

# Best for
Quieter, slower moments: after a shower, before bed, or whenever you want a gentler pace.

# Pairs well with
Our Lavender Evening Magnesium Rub, for a richer, slower application.`,
    },
    ingredients: {
      was: 'a81ea46feac8eb72',
      text: `Aqua, Magnesium Chloride, Propanediol, Glycerin*, Cucumis Sativus Fruit Extract*, Caprylyl/Capryl Glucoside, Citrus Aurantium Bergamia Peel Oil*, Anthemis Nobilis Flower Oil*, Origanum Majorana Leaf Oil*, Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*, +Limonene, +Linalool, +Geraniol.

*Certified organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: { was: 'cce71a256d2bd194', text: MIST_HOW_TO },
    precautions: { was: '1c0d2006537a2dbe', text: MIST_PRECAUTIONS },
  },
  'spiced-orange': {
    notes: { was: '325967ce511203c6', text: 'Glass bottle.' },
    short_description: {
      was: '428e935b6f9f9b7b',
      text: 'A light, welcoming botanical mist for the home, with sweet orange, clove, cinnamon and Himalayan cedarwood.',
    },
    long_description: {
      was: '9e3dd789125faee9',
      text: `A warm blend of sweet orange, clove and cinnamon on a soft base of Himalayan cedarwood. Mist lightly into the air for a warm, welcoming atmosphere.

# Where to use it
Bedrooms, bathrooms, living areas and entryways; wardrobes, cupboards and drawers; cars and other small spaces. It’s also lovely before guests arrive or after cooking.`,
    },
    ingredients: {
      was: '9e833b45d3270087',
      text: `${ROOM_INGREDIENTS_LEAD}

Alcohol, distilled water, caprylyl/capryl glucoside and essential oils of sweet orange, cedarwood, clove bud and cinnamon leaf.`,
    },
    how_to_use: { was: 'fd503e963a787655', text: ROOM_HOW_TO },
    precautions: { was: '8b43e70d1753c501', text: ROOM_PRECAUTIONS },
  },
  'frostpine-lavender': {
    notes: { was: '325967ce511203c6', text: 'Glass bottle.' },
    short_description: {
      was: '2c9d9800dc9cdcc3',
      text: 'Bring the quiet clarity of a high-country forest into your home: fresh pine, cedarwood, peppermint and soft lavender in a crisp botanical mist.',
    },
    long_description: {
      was: 'adefad45b4c6cbb9',
      text: `A crisp, quietly calming scent for the home.

Fresh pine opens with a clean, forest-like brightness, warmed by cedarwood and lifted by a breath of peppermint. Soft lavender sits underneath, adding a calm, familiar softness that keeps the blend balanced rather than sharp.

This is a scent for clearing the air: a quiet morning, an open window, a freshly made bed, or the simple pleasure of coming home to a calm space. It’s fresh without being cold, woody without being heavy, and botanical rather than synthetic.

A little goes a long way.

# Where to use it
Bedrooms, bathrooms, living areas and entryways. It’s also lovely in wardrobes, drawers, cars and other small spaces, before guests arrive or after cooking.

For wardrobes, cupboards, drawers and cars, mist lightly into the air rather than directly onto clothing, upholstery, timber or painted surfaces. Let the space air briefly before closing it.`,
    },
    ingredients: {
      was: '972c9c278be544b1',
      text: `${ROOM_INGREDIENTS_LEAD}

Alcohol, distilled water, caprylyl/capryl glucoside and essential oils of pine, cedarwood, peppermint and lavender.`,
    },
    how_to_use: { was: 'fd503e963a787655', text: ROOM_HOW_TO },
    precautions: { was: '8b43e70d1753c501', text: ROOM_PRECAUTIONS },
  },
  'gardeners-balm-rosemary-cedar': {
    short_description: {
      was: '38dfccffa3d448e2',
      text: 'A rich, water-free balm with a fresh, herbal, woody scent. It melts into dry, rough skin to soften and nourish.',
    },
    long_description: {
      was: '35b712e4d9306d82',
      text: `A rich, water-free balm for hard-working hands, with a fresh, green scent of rosemary, lavender and cedarwood.

It’s made with organic unrefined shea butter, organic cold-pressed hemp seed oil and organic golden jojoba oil. Hemp seed oil and jojoba help soften and condition, while shea butter and beeswax form a rich, protective layer that helps reduce moisture loss.

# Why you’ll love it
- Hemp-led formula: cold-pressed hemp seed oil is the hero oil.
- Rich but simple: shea butter, jojoba and beeswax, and nothing unnecessary.
- Water-free, so no preservative is needed.
- A protective finish that helps soften rough skin and reduce moisture loss.
- Made in small batches in Canterbury, New Zealand.`,
    },
    ingredients: {
      was: '2419444b9a91d28d',
      text: `Butyrospermum Parkii (Shea) Butter*, Cannabis Sativa (Hemp) Seed Oil*, Simmondsia Chinensis (Jojoba) Seed Oil*, Cera Flava (Beeswax), Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*, Rosmarinus Officinalis (Rosemary) Leaf Oil*, Lavandula Angustifolia (Lavender) Oil*, Cedrus Atlantica Bark Oil*, +Limonene, +Linalool, +Geraniol, +Citral.

*Certified organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: {
      was: '5e7f1bf6a1f74e74',
      text: 'Patch test first. Massage a small amount into clean, dry skin after gardening, or whenever your hands feel dry. It also suits elbows, knees and feet.',
    },
    precautions: {
      was: 'b0b48a4dddc3347d',
      text: `For external use only. Do not use on broken or irritated skin, and avoid the eye area. Stop using it if irritation occurs. Keep out of reach of children and pets.

Keep water out of the jar: use clean, dry hands or a spatula. Store in a cool, dry place away from sunlight.`,
    },
  },
  'fragrance-free-magnesium-rub': {
    long_description: {
      was: 'c2f19fa998602ccb',
      text: `A rich magnesium rub for feet, legs, shoulders, hands and arms. It’s higher in magnesium chloride than our Lavender Evening Magnesium Rub.

It uses the same rich, high-strength magnesium base as our Rosemary & Copaiba Magnesium Rub, made without essential oils or added fragrance.

A smooth, cushioned cream for feet after standing, legs after walking, shoulders after carrying, or hands after working. Made with shea butter, coconut oil, castor oil and beeswax, it melts into the skin with the warmth of your hands.

Massage a small amount into clean, unbroken skin and let the rich texture absorb.

A little goes a long way.

# A note on colour
Natural variation may occur, from ivory to soft beige or blush.

# Mist or rub?
Choose one of our magnesium body mists for a light, quick and easy application. Choose this Fragrance-Free Magnesium Rub, or our Rosemary & Copaiba Magnesium Rub, for a richer, slower way to use magnesium.`,
    },
    ingredients: {
      was: 'b9a6d97986242147',
      text: `Magnesium Chloride, Aqua (Water), Butyrospermum Parkii (Shea) Butter*, Cera Flava (Beeswax), Cocos Nucifera (Coconut) Oil*, Ricinus Communis (Castor) Seed Oil*, Maranta Arundinacea (Arrowroot) Root Powder*, Benzyl Alcohol, Dehydroacetic Acid, Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*.

*Organic ingredient.`,
    },
    how_to_use: { was: '560770fc2b13fee9', text: RUB_HOW_TO },
    precautions: { was: '5897664e6ae8dc74', text: RUB_PRECAUTIONS },
  },
  'lavender-evening-magnesium-rub': {
    notes: { was: 'eaa929d3fb40e732', text: 'Lavender, Atlas cedarwood and vetiver in a smooth magnesium cream.' },
    short_description: {
      was: 'da0e802957141d6e',
      text: 'A smooth, massageable magnesium cream with a quiet evening scent of lavender, Atlas cedarwood and vetiver.',
    },
    long_description: {
      was: '779b67aa354c090a',
      text: `A smooth, massageable cream for feet, legs, shoulders, hands and arms.

This is a rub for a slower, more deliberate moment of care: feet after standing, legs after walking, shoulders after carrying, or hands after working. Lavender, Atlas cedarwood and vetiver give it a quiet, restful evening scent.

Massage a small amount into clean, unbroken skin and let the rich texture melt in with the warmth of your hands.

A little goes a long way.`,
    },
    ingredients: {
      was: 'd21f59906adc3d85',
      text: `Magnesium Chloride, Aqua (Water), Butyrospermum Parkii (Shea) Butter*, Cera Flava (Beeswax), Cocos Nucifera (Coconut) Oil*, Maranta Arundinacea (Arrowroot) Root Powder*, Lavandula Angustifolia (Lavender) Oil*, Ricinus Communis (Castor) Seed Oil*, Benzyl Alcohol, Dehydroacetic Acid, Cedrus Atlantica (Atlas Cedarwood) Bark Oil*, Chrysopogon Zizanioides (Vetiver) Root Oil*, Tocopherol*, Helianthus Annuus (Sunflower) Seed Oil*, +Linalool, +Limonene, +Geraniol, +Coumarin.

*Organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: { was: '560770fc2b13fee9', text: RUB_HOW_TO },
    precautions: { was: '5897664e6ae8dc74', text: RUB_PRECAUTIONS },
  },
  'night-solace-magnesium-rub': {
    notes: { was: '4066a3f11d2fd9a4', text: 'Blue glass jar.' },
    short_description: {
      was: 'cf45cf7e92747311',
      text: 'A smooth, massageable cream for feet, legs, shoulders, hands and arms, with a very subtle, barely-there botanical scent.',
    },
    long_description: {
      was: 'a4ab174d9d444a33',
      text: `A smooth, massageable cream for feet, legs, shoulders, hands and arms.

This is a rub for a slower, more deliberate moment of care: feet after standing, legs after walking, shoulders after carrying, hands after working, or at bedtime. Its very subtle, barely-there botanical scent makes it a quiet choice if you prefer minimal fragrance.

A little goes a long way.`,
    },
    ingredients: {
      was: 'e42469dfe44c292a',
      text: `Magnesium Chloride, Aqua, Butyrospermum Parkii (Shea) Butter*, Cera Flava, Cocos Nucifera Oil*, Maranta Arundinacea Root Powder*, Lavandula Angustifolia Oil*, Ricinus Communis Seed Oil*, Benzyl Alcohol, Dehydroacetic Acid, Cedrus Atlantica Bark Oil*, Chrysopogon Zizanioides Root Oil*, Tocopherol*, Helianthus Annuus Seed Oil*, +Linalool, +Limonene, +Geraniol, +Coumarin.

*Organic ingredient.
+Naturally occurring in essential oils.`,
    },
    how_to_use: {
      was: '11d4f4e80e6823a6',
      text: 'Massage a small amount into clean, unbroken skin on the feet, legs, shoulders, hands or anywhere that feels tired or overworked. Use it after a shower, before bed, or whenever you want a slower moment of care.',
    },
    precautions: {
      was: '3fbca6b7746834e3',
      text: `For external use only. Avoid contact with the eyes; if contact occurs, rinse thoroughly with clean water.

Do not apply to broken, irritated, infected or freshly shaved skin.

A temporary cooling or tingling sensation may occur, especially on sensitive skin. Before first use, apply a small amount to a small area of skin and wait 24 hours. If redness, itching, burning, swelling or irritation occurs, stop using the product.

If you have a reaction, stop using the product, and seek medical advice if symptoms are severe or persistent. Please contact us with your order number, batch number and photos if possible.

Keep out of reach of children and pets. Store in a cool, dry place away from direct sunlight. Use clean, dry hands or a small spatula.`,
    },
  },
};

const PRODUCT_RENAMES = [
  { slug: 'gardeners-balm-rosemary-cedar', field: 'name', from: "Gardener's Balm - Rosemary & Cedar", to: "Gardener's Balm – Rosemary & Cedar" },
  { slug: 'bergamot-cedarwood', field: 'size', from: '100ml', to: '100 ml' },
  { slug: 'frostpine-lavender', field: 'size', from: '100ml', to: '100 ml' },
];

// scope: { category } for collection FAQs, { product: true } for questions written for a
// product, { general: true } for the FAQs page. `has` must appear in the current answer.
const FAQ_EDITS = [
  {
    scope: { product: true },
    question: 'Can I use it under my arms?',
    has: 'helping to neutralise underarm odour without reducing sweating',
    remove: true,
  },
  {
    scope: { product: 'pure-fragrance-free' },
    question: 'How is this different from the magnesium mists?',
    has: 'This rub is a richer',
    remove: true,
  },
  {
    scope: { product: 'pure-fragrance-free' },
    question: 'How should I store it?',
    has: 'into the pottle',
    remove: true,
  },
  {
    scope: { product: 'gardeners-balm-rosemary-cedar' },
    question: 'Does it contain beeswax, nut-derived ingredients or essential oils?',
    has: 'petitgrain',
    answer:
      'It contains beeswax, shea butter (from the shea nut) and the essential oils of rosemary, lavender and cedarwood. It doesn’t contain nut oils, but it’s made in a small workspace, so we can’t guarantee it’s free from traces of other ingredients.\n\nPlease check the full ingredient list if you have allergies or sensitivities.',
  },
  {
    scope: { product: 'gardeners-balm-rosemary-cedar' },
    question: 'Can I use it on hands and cuticles?',
    has: 'formulated with dry feet in mind',
    answer: 'Yes. It’s made for dry, hard-working hands, and it also suits knuckles, cuticles, elbows, knees and feet.',
  },
  {
    scope: { category: 'balms' },
    question: 'What is the difference between a balm and magnesium rub?',
    has: 'water-free blend of oils',
    nextQuestion: 'What is the difference between a balm and a magnesium rub?',
  },
  {
    scope: { general: true },
    question: 'How can I ask a question before ordering?',
    has: 'Yes! If you are unsure',
    answer:
      'If you’re unsure which scent to choose, need help with ingredients or want to double-check pickup details, send us a note through our [Contact](/contact) page or email petitebotanicalsnz@gmail.com.',
  },
  {
    scope: { general: true },
    question: 'What is your returns policy?',
    has: 'under \'Policies\'',
    answer:
      'Because our products are personal care items blended by hand, we can’t accept returns or exchanges if you simply change your mind about a scent or product. Please read the product descriptions carefully to choose the blend that suits you best.\n\nFor more information, see our [Returns Policy](/returns).',
  },
  {
    scope: { general: true },
    question: 'Can I use your products on children?',
    has: 'Please seek advice from a healthcare professional first.',
    answer: 'Our products are formulated for adults. If you would like to use one on a child, please ask a healthcare professional first.',
  },
  {
    scope: { general: true },
    question: 'Are all your ingredients organic?',
    has: 'We prioritize organic sourcing',
    find: 'We prioritize organic sourcing',
    replace: 'We prioritise organic sourcing',
  },
];

// Applied to every FAQ question and answer.
const FAQ_TEXT_FIXES = [
  ['magnesium body mist are', 'magnesium body mists are'],
  ['The gin/alcohol base makes the mist flammable.', 'The alcohol in the gin base makes the mist flammable.'],
  ['Read the care note on this page before you use it.', 'Read the precautions on this page before you use it.'],
  ['Read the care note on that product before you store it near a heat source.', 'Read the precautions for that product before you store it near a heat source.'],
  ['The care note on the product page is the warning for that formula.', 'The precautions on the product page are the warning for that formula.'],
  ['Read the ingredient list and the care note before you order', 'Read the ingredient list and the precautions before you order'],
  ['On the product page, in the care section.', 'On the product page, under Precautions.'],
  ['the directions or the care note.', 'the directions or the precautions.'],
];

module.exports = {
  fingerprint,
  withoutGlossaryPrompt,
  CATEGORY_COPY,
  PRODUCT_COPY,
  PRODUCT_RENAMES,
  FAQ_EDITS,
  FAQ_TEXT_FIXES,
};
