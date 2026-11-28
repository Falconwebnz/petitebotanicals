/**
 * One FAQ record is the only copy of that answer.
 * Category rows can also appear on products in that category.
 * A product row with the same question replaces the shared answer on that product.
 * General rows use category_id 0 and a topic.
 * Answers are written from the published listings. They are not medical or superiority claims.
 */

const REVIEWED = '19 October 2026';

const FAQ_TOPICS = [
  { id: 'products', title: 'About our products' },
  { id: 'choosing', title: 'Choosing and caring for products' },
  { id: 'orders', title: 'Orders and collection' },
];

const CATEGORY_HEADINGS = {
  'botanical-perfumes': 'FAQs about our botanical perfumes',
  balms: 'FAQs about our balms & rubs',
  'mist-sprays': 'FAQs about our magnesium body mists',
  'room-mists': 'FAQs about our botanical room mists',
};

function categoryHeading(category) {
  return CATEGORY_HEADINGS[category.slug] || 'FAQs about ' + category.name;
}

const CATEGORY_FAQS = {
  'botanical-perfumes': [
    {
      on_product: 1,
      question: 'How should I apply a botanical perfume oil?',
      answer:
        'Roll onto clean, dry skin at your wrists, neck or pulse points. Allow the oil a moment to absorb before dressing.',
      evidence: 'Product pages say roll on pulse points.',
    },
    {
      on_product: 1,
      question: 'How noticeable is the scent, and how long might it last?',
      answer:
        'Our botanical perfume oils are designed to wear close to the skin rather than fill a room. The scent unfolds gradually with your skin’s warmth, becoming more personal and understated as it settles. Wear time varies with skin type, temperature, activity and the individual fragrance.',
      evidence: 'No wear-time test is recorded. Do not add hours.',
    },
    {
      on_product: 1,
      question: 'How can I choose a fragrance online without smelling it first?',
      answer:
        'Start with the scent family you naturally enjoy. Orange Rose & Cedar is bright, rosy and lightly woody; Golden Ylang is warm, floral and comforting; Night Solace is soft, herbal and evening-oriented; Latitude 44 is clean, woody and grounded. Each product page includes its key notes and location story to help you choose.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'What are your perfumes made with?',
      answer:
        'Our perfumes are made with pure essential oils, organic vitamin E and organic golden jojoba oil. They contain no synthetic fragrance. Each product’s full ingredient list is shown on its product page and label.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Are they suitable for sensitive skin?',
      answer:
        'Our perfumes are formulated with carefully considered essential-oil levels and no synthetic fragrance. However, essential oils can still cause sensitivity in some people. If you have reactive skin, patch test on a small area first and discontinue use if irritation occurs.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Are these perfumes safe to wear in the sun?',
      answer:
        'Our perfumes are made with pure essential oils in organic golden jojoba oil. Where bergamot is used, it is Bergamot FCF, a bergapten-free grade chosen to reduce the phototoxicity concern associated with conventional bergamot oil. As with any fragranced product, avoid applying immediately before prolonged sun exposure.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'How should I store my perfume oil?',
      answer:
        'Store your perfume oil upright, tightly closed and away from direct sunlight, heat and humidity. A cool, dark cupboard is ideal. Keep the roller cap securely closed between uses.',
      evidence: 'General oil storage. No expiry date invented.',
    },
    {
      on_product: 0,
      question: 'How long will an opened bottle last?',
      answer:
        'For best scent quality, use within 12 months of opening and store away from light and heat. Citrus-forward perfumes are best enjoyed sooner, as citrus notes can fade first.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Will the oil stain clothing?',
      answer:
        'Perfume oils can mark delicate fabrics. Allow the oil to absorb fully into your skin before dressing, and avoid applying it directly to silk or light-coloured clothing.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Do you offer returns if I don’t like the scent?',
      answer:
        'Because fragrance is personal, we recommend reading the scent notes and description carefully before ordering. If your perfume arrives damaged or incorrect, please contact us and we will make it right.\n\nThe full terms are on the [Returns Policy](/returns) page.',
      evidence: 'Check against the Returns Policy before publishing.',
    },
  ],
  balms: [
    {
      on_product: 0,
      question: 'What is the difference between a balm and a cream?',
      answer:
        'A balm is usually a firmer blend of oils and waxes. A cream is usually lighter and contains water.\n\nOur balms are the firmer kind. We do not sell them as creams.',
      evidence: 'Category description only. Finished wax lists are not on every balm.',
    },
    {
      on_product: 0,
      question: 'Which balm should I choose?',
      answer:
        'Choose by the job named on the product, such as feet and heels or hands after gardening. Read that product’s own description.\n\nWe do not rank one balm as right for every skin.',
      evidence: 'Do not recommend a balm whose ingredient list is still empty.',
    },
    {
      on_product: 1,
      question: 'What does the balm feel like on the skin?',
      answer:
        'A balm feels richer than a lotion and can take a moment to warm into the skin. The exact feel depends on that formula.\n\nIf the product page does not describe the texture, we have not confirmed it.',
      evidence: 'No shared texture test across balms.',
    },
    {
      on_product: 1,
      question: 'How much should I apply?',
      answer:
        'Use a small amount and warm it between your fingers before you spread it. More is not more useful.\n\nFollow the directions on that product page. If directions are not published yet, the formula is not ready to treat as finished.',
      evidence: 'Several balm listings have no how-to-use text.',
    },
    {
      on_product: 1,
      question: 'Does it contain beeswax, nut-derived ingredients or essential oils?',
      answer:
        'That depends on the balm. Read the ingredient list on that product page.\n\nWe do not give one answer for the whole category. If the ingredient list is not published, beeswax, nut oils and essential oils are not confirmed for that balm.',
      evidence: 'Do not infer beeswax. Dandelion starter says the list is not recorded.',
    },
    {
      on_product: 1,
      question: 'Can the texture change in warm or cold weather?',
      answer:
        'Yes. A balm can soften in warm weather and firm up in the cold. That is a change in texture.\n\nKeep the lid on. If the smell or colour has also changed, stop using it.',
      evidence: 'Ordinary balm behaviour. Not a stability test result.',
    },
    {
      on_product: 1,
      question: 'How should I store it?',
      answer:
        'Keep the lid on, out of direct sun, and away from heat. Do not leave a tin on a sunny windowsill or in a hot car.',
      evidence: 'Storage only. No shelf-life number.',
    },
  ],
  'mist-sprays': [
    {
      on_product: 0,
      question: 'What is a magnesium body mist?',
      answer:
        'A magnesium body mist is a lightweight, water-based body-care spray made with magnesium chloride. It is designed to be sprayed onto the skin, gently massaged in, and left to absorb.',
      evidence: 'Medsafe: do not imply a therapeutic purpose. No pain, sleep or deficiency claims.',
    },
    {
      on_product: 1,
      question: 'Is this a cosmetic body-care product or a magnesium supplement?',
      answer:
        'It is a cosmetic body-care product for external use only. It is not a magnesium supplement, medicine, or treatment for magnesium deficiency, and it is not intended to replace dietary magnesium or advice from a healthcare professional.',
      evidence: 'Keep this cosmetic. No therapeutic claims.',
    },
    {
      on_product: 1,
      question: 'What is the difference between the unscented and scented versions?',
      answer:
        'Pure is unscented and minimalist, with no added fragrance or essential oils. The scented versions use the same magnesium-chloride base, with carefully chosen botanical ingredients and certified organic essential oils where possible for a gentle scent experience.',
      evidence: 'Pure versus scented listings. Do not rank efficacy.',
    },
    {
      on_product: 0,
      question: 'Which scent should I choose?',
      answer:
        'Pure — for a simple, fragrance-free option.\n\nSweet Orange & Cucumber — bright, sunny and fresh.\n\nBergamot & Cedarwood — fresh bergamot with warm cedarwood and resinous frankincense.\n\nChamomile & Marjoram — soft, herbal and comforting; lovely for an evening wind-down.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'How do I apply it?',
      answer:
        'Shake gently before use. Spray onto clean, dry skin from around 15–20 cm away, then gently massage it in and allow it to dry before dressing. It can be used after showering, for underarm and body care, or layered beneath your favourite perfume.',
      evidence: 'Matches published spray directions.',
    },
    {
      on_product: 1,
      question: 'How many sprays should I use?',
      answer:
        'Start with 2–3 sprays per area, such as each underarm, or 4–6 sprays in total across the body. Massage gently into clean, dry skin and allow it to dry before dressing.\n\nYou can use more or less depending on personal preference and how your skin feels. If you are new to magnesium mists, begin with a small amount and build up gradually.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'What should I do if it stings or irritates my skin?',
      answer:
        'A mild tingling, warmth or brief stinging sensation can happen after applying a magnesium body mist, particularly on dry, sensitive or freshly shaved skin. This is usually a skin response to magnesium chloride and often settles as the mist dries.\n\nIf it stings:\n\nRinse the area with cool water.\n\nPat dry and apply your usual moisturiser if needed.\n\nNext time, use fewer sprays or apply it to a less sensitive area, such as the legs or feet.\n\nAvoid using it on broken, irritated, sunburned or freshly shaved skin.\n\nIf you are new to magnesium mists, patch test on a small area of intact skin and wait 24 hours before wider use.\n\nStop using the mist if you develop ongoing redness, itching, a rash, swelling, burning or discomfort. If irritation persists or worsens, seek advice from a healthcare professional.',
      evidence: 'Care notes say discontinue if irritation occurs. No healing claim.',
    },
    {
      on_product: 1,
      question: 'Can it leave a residue?',
      answer:
        'Yes. As the mist dries, magnesium chloride can leave a faint salty or slightly tacky mineral feeling on the skin. This is normal. If you prefer, rinse it off after 20–30 minutes or wipe the area with a damp cloth, then apply moisturiser if desired. Allow the mist to dry fully before dressing.',
      evidence: 'Do not repeat “zero sticky residue” as a guaranteed result.',
    },
    {
      on_product: 1,
      question: 'Will it stain clothing?',
      answer:
        'Allow the mist to dry completely before dressing. Like any water-based mineral spray, it may leave a faint mark on fabric if applied heavily or before it has dried.\n\nIf residue transfers to clothing, rinse the area with cool water as soon as possible. Avoid spraying directly onto clothing or jewellery.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Where can I use it?',
      answer:
        'Use it on areas such as arms, legs, shoulders, back or feet. It is also intended for underarm care. Avoid the face, eyes, lips, nostrils and other sensitive areas.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Can I use it as a deodorant?',
      answer:
        'It is formulated for underarm and body care, but it is not a deodorant and is not intended to prevent sweating or treat body odour. If you prefer, use it alongside your usual deodorant routine.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Can I use it with deodorant?',
      answer:
        'Yes. You can use your usual deodorant alongside the mist. If applying both to the underarms, allow the mist to dry fully first, then apply deodorant if needed.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Can I use it after shaving?',
      answer:
        'Avoid using it immediately after shaving, or on broken, irritated, sunburned or freshly exfoliated skin. These areas can be more sensitive to magnesium chloride and may sting.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Should I patch test first?',
      answer:
        'Yes. Before first use, spray a small amount onto a small area of intact skin, such as the inner forearm, and wait 24 hours. If there is no irritation, you can use it more widely.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Why are there ingredients other than magnesium chloride and water?',
      answer:
        'Some versions include small amounts of supporting ingredients to improve the feel, stability and scent experience:\n\nCaprylyl/capryl glucoside helps disperse oil-based botanical ingredients in the water-based mist.\n\nPropanediol helps the mist feel smoother and more comfortable on the skin.\n\nCucumber glycerite contributes a fresh botanical character and a softer skin feel.\n\nThese ingredients support the cosmetic formula; they do not turn the mist into a supplement.',
      evidence: 'Glossary names glucoside, propanediol and cucumber glycerite for the sprays.',
    },
    {
      on_product: 0,
      question: 'Are the essential oils certified organic?',
      answer:
        'We use certified organic essential oils where possible. Each product page shows the specific ingredients for that mist.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Is it safe during pregnancy or breastfeeding?',
      answer:
        'If you are pregnant or breastfeeding, please check with your midwife, doctor or pharmacist before using products containing essential oils.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Can I use it on children?',
      answer:
        'Our magnesium body mists are formulated for adult use. If you wish to use one on a child, please seek advice from a healthcare professional first.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'Can I use it before sun exposure?',
      answer:
        'Avoid applying citrus-containing mists immediately before intentional sun exposure, particularly if your skin is sensitive. The Sweet Orange & Cucumber and Bergamot & Cedarwood versions contain citrus essential oils.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'How should I store it?',
      answer:
        'Store upright, tightly closed, away from direct sunlight and heat. Shake gently before use if the mist has been standing for a while.',
      evidence: '',
    },
    {
      on_product: 1,
      question: 'How long will it last?',
      answer:
        'For best quality, use within 12 months of opening. Store the bottle upright, tightly closed, and away from direct sunlight and heat.\n\nBecause the formula contains water and botanical ingredients, keep the nozzle clean and avoid introducing water or other products into the bottle.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Is the bottle recyclable?',
      answer:
        'Yes. Once empty, please reuse or recycle the glass bottle. The spray nozzle and cap can be placed in general rubbish.',
      evidence: '',
    },
    {
      on_product: 0,
      question: 'Is it a medical treatment?',
      answer:
        'No. Petite Botanicals magnesium body mists are cosmetic body-care products for external use only. They are not intended to diagnose, treat, cure or prevent any medical condition.',
      evidence: '',
    },
  ],
  'room-mists': [
    {
      on_product: 0,
      question: 'Where should I use the mist?',
      answer:
        'These mists are for the air in a room. Shake gently and mist lightly into the space.\n\nThey are not body mists.',
      evidence: 'Published directions say mist into the air.',
    },
    {
      on_product: 1,
      question: 'Is it intended for the air, fabrics or both?',
      answer:
        'It is intended for the air. It is not a fabric freshener and not a stain treatment.',
      evidence: 'Directions say avoid furniture and delicate textiles.',
    },
    {
      on_product: 1,
      question: 'Can it mark furniture or textiles?',
      answer:
        'It can. Essential oils can mark polished wood, stone and some fabrics.\n\nDo not spray directly onto furniture, polished surfaces or delicate textiles. If you are unsure about a surface, do not spray it.',
      evidence: 'Matches the avoid-furniture direction. No “safe for fabrics” claim.',
    },
    {
      on_product: 1,
      question: 'How strong is the scent?',
      answer:
        'It is a room scent, so it should be noticeable in the space you sprayed. How strong it feels depends on the room, the airflow and how many sprays you use.\n\nWe do not publish a measured strength.',
      evidence: 'No diffusion test on file.',
    },
    {
      on_product: 1,
      question: 'How should I store it?',
      answer:
        'Keep the cap on, upright, away from heat, sun and flame.\n\nSome mists are labelled flammable. Read the care note on that product before you store it near a heat source.',
      evidence: 'Christmas tree mist care note says flammable vapour.',
    },
    {
      on_product: 1,
      question: 'What precautions apply around children and animals?',
      answer:
        'Keep the bottle out of reach of children and pets. Do not spray it toward a face, a pet, or a child’s bedding.\n\n“Natural” does not mean safe to breathe in any amount, or safe for every animal. The care note on the product page is the warning for that formula.',
      evidence: 'Care notes say keep away from children and pets. No blanket safety claim.',
    },
  ],
};

const PRODUCT_FAQS = [
  {
    slug: 'fake-tree-fix-christmas-tree-room-mist',
    question: 'What precautions apply around children and animals?',
    answer:
      'This mist is labelled as a flammable vapour. Keep it away from flame and heat, and out of reach of children and pets.\n\nDo not spray it toward a face, a pet or bedding. Natural ingredients do not make a flammable mist safe to misuse. Read the care note on this page before you use it.',
    evidence: 'Overrides the shared room-mist precaution on this product only. Care note already says flammable vapour.',
  },
];

const GENERAL_FAQS = {
  products: [
    {
      question: 'Where are Petite Botanicals products made?',
      answer:
        'In small batches in Canterbury, New Zealand.\n\n[Our Standards](/standards) explains how the range is made.',
      evidence: 'Standards and about copy. No factory address beyond Canterbury.',
    },
    {
      question: 'What do you mean by “natural”?',
      answer:
        'We mean formulas built from botanical and mineral ingredients, without synthetic fragrance.\n\n“Natural” is not a safety claim, and it does not mean a product suits every person. The ingredient list on the product page is the precise account.',
      evidence: 'Do not use chemical-free. Standards say no synthetic fragrance.',
    },
    {
      question: 'Are all your ingredients organic?',
      answer:
        'Not every ingredient is certified organic. A certified ingredient is also not the same thing as a certified finished product.\n\nWhere a product page names an ingredient as certified organic, that claim applies to that ingredient. If the page does not say certified, do not assume that it is.',
      evidence: 'Commerce Commission: identify which part is organic. Listings are not consistent enough for a house-wide organic claim.',
    },
    {
      question: 'Do you use synthetic fragrance?',
      answer:
        'No. Scent comes from essential oils.\n\nA product without essential oils, such as an unscented magnesium mist, is unscented. It is not filled with a synthetic perfume instead.',
      evidence: 'Standards: no synthetic fragrance.',
    },
    {
      question: 'Why do some products contain preservatives or other functional ingredients?',
      answer:
        'An oil perfume does not need a water-based preservative. A water-based spray can include ingredients that help oils disperse and that keep the mist even.\n\nThose ingredients are named on the product page and in the [Glossary](/glossary). We would rather name them than hide them behind a purity slogan.',
      evidence: 'Glossary explains spray functionals. Do not claim the whole range is preservative-free.',
    },
    {
      question: 'Where can I find the full ingredient list?',
      answer:
        'On each product page, under Botanicals.\n\nIf a listing says the ingredient list is not recorded yet, that product is not ready to be read as a finished formula.',
      evidence: 'Some balm and spray listings are still empty or marked starter.',
    },
    {
      question: 'Are all products vegan?',
      answer:
        'We do not claim the whole range is vegan. Check the ingredient list for the product you want.\n\nIf an animal ingredient such as beeswax is used, it will be named there. If the list is missing, vegan status is not confirmed.',
      evidence: 'Beeswax is not confirmed or denied across balms. No house vegan claim.',
    },
  ],
  choosing: [
    {
      question: 'How do I choose a product if I have ingredient sensitivities?',
      answer:
        'Read the ingredient list and the care note before you order, and patch test any new product on a small area of skin.\n\nIf you already react to a named oil or mineral, do not buy that product to find out. Ask us first if a listing is unclear.',
      evidence: 'Patch test is on the standards and product care notes.',
    },
    {
      question: 'Where can I find product-specific cautions?',
      answer:
        'On the product page, in the care section. Questions further down the page add context.\n\nThey do not replace the ingredient list, the directions or the care note.',
      evidence: 'FAQs are supplementary. Baymard: do not hide essential warnings in FAQs only.',
    },
    {
      question: 'How do I read the best-before or after-opening information?',
      answer:
        'Use the date printed on the bottle or carton. Batches differ, so we do not repeat one date here.\n\nIf a bottle has no date, ask us before you rely on one.',
      evidence: 'No single best-before is stored in the shop.',
    },
    {
      question: 'How should I store my products?',
      answer:
        'Keep the cap on, out of direct sun, and away from heat. Balms change texture with temperature.\n\nSome room mists are flammable, so keep those away from flame. The product page has the storage note for that item.',
      evidence: 'See category storage answers. No new conditions.',
    },
  ],
  orders: [
    {
      question: 'How do I collect my order?',
      answer:
        'Orders are collected from a lockbox on the property in Rangiora. At checkout, give us the mobile number you want us to text. The padlock code is the last four digits of that number.\n\nWe text you when the order is in the lockbox, and where to collect it.\n\nThe arrangements are on [Click & Collect](/pickup).',
      evidence: 'Click and collect only. Nationwide shipping is switched off on the shop.',
    },
    {
      question: 'When will my order be ready?',
      answer:
        'Because everything is made in small batches, orders are usually placed in the lockbox within 1 to 2 business days. We text you when it is ready. The padlock code is the last four digits of the mobile number you gave at checkout.',
      evidence: 'Studio collection. No courier dispatch while nationwide shipping is off.',
    },
    {
      question: 'What happens if an item arrives damaged?',
      answer:
        'Tell us. If goods are not of acceptable quality, the Consumer Guarantees Act 1993 still applies.\n\nThe steps are on the [Returns Policy](/returns).',
      evidence: 'Link the policy. Do not rewrite the CGA remedies here.',
    },
    {
      question: 'What is your returns policy?',
      answer: 'The policy is written in full on the [Returns Policy](/returns) page. That page is the policy. This answer only points to it.',
      evidence: 'Do not duplicate returns terms.',
    },
    {
      question: 'How can I ask a question before ordering?',
      answer:
        'Read the product page, the [Glossary](/glossary) and these questions first.\n\nIf you still need to know something about a formula, write to us before you pay. The contact details are on the [Privacy](/privacy) page.',
      evidence: 'Contact email may still be empty. Privacy page explains how to write.',
    },
  ],
};

module.exports = {
  REVIEWED,
  FAQ_TOPICS,
  CATEGORY_FAQS,
  PRODUCT_FAQS,
  GENERAL_FAQS,
  categoryHeading,
};
