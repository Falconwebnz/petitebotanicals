# Petite Botanicals

A small-batch shop for Petite Botanicals, Canterbury, New Zealand. The storefront follows the structure of the Glowing Beauty `home-05` template (hero, category entrances, product rail, trust points, maker’s story, footer) and is restyled in cream paper, botanical green, and gold hairlines.

The original Glowing template is left untouched. This app lives in `petite-botanicals` and copies only the Bootstrap, Slick and theme assets it needs.

## Run

Requires Node.js 18 or newer.

```powershell
cd petite-botanicals
copy .env.example .env
npm install
npm start
```

Open http://localhost:3000

The SQLite database is created on first start at `data/still-room.sqlite` and seeded from the brand documents. Delete that file and restart to seed again. Uploaded images live in `public/uploads`.

## Shop desk

http://localhost:3000/admin

Dev login, from `.env.example` only:

- Name: `admin`
- Password: `stillroom-dev`

Change `ADMIN_USER` and `ADMIN_PASSWORD` in `.env` before the first run if you want different credentials. The password is hashed in the database. Later changes to `.env` do not reset an existing desk login — delete `data/still-room.sqlite` to reseed.

From the desk you can:

- Add and edit products (name, one of the four categories, NZD price, size, descriptions, notes, ingredients, how to use, precautions, image, featured, in stock, starter flag)
- Edit the intro and hero image of the four fixed categories
- Edit the homepage kicker, headline, subhead, story teaser, shop intro and hero image

## Stripe

Set test keys in `.env`. Do not commit real keys, and do not use a live key or a real card.

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Currency is NZD. Checkout creates a Stripe Checkout Session. Success and cancel pages are `/checkout/success` and `/checkout/cancel`.

If `STRIPE_SECRET_KEY` is missing, the basket still works and checkout explains that Stripe test keys are required. Nothing is charged.

## What is seeded

Finished perfume oils, from the final revised recipes, with selling prices from the costing summary in the same document:

- Aurielle, 10 ml, NZ$15
- Ember, 10 ml, NZ$15
- Night Solace, 10 ml, NZ$15
- Latitude 44, 10 ml, NZ$18

Aurielle keeps both the printed label (ingredients, allergens, precautions, certified organic) and the recipe notes, because they differ.

Balms and mist sprays are named in the story and target notes but have no finished formula. Room mists are not specified. Those three categories contain one clearly marked starter card each, with a placeholder price, so they can be replaced in the desk.
