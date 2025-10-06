<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/14sjHxmSf8e6r10ODiBHmreB_jlcedxWB

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Demo data & local storage

The dashboard boots with a lightweight, fictional dataset that lives in `lib/data.ts`. It keeps
the UI useful without touching any private data. Everything you change is stored in the browser’s
localStorage, so refreshes are safe. When Supabase is disabled, the Settings page shows that the app
is running from “Browser storage” or the bundled “Demo dataset”.

## Supabase (Optional)

To persist data in Supabase instead of localStorage:

- Add to `.env.local`:

  ```
  VITE_SUPABASE_URL=your-project-url
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

- Install the client: `npm i @supabase/supabase-js`

- Choose a schema and run it in the Supabase SQL editor:
  - Option A — Quick, plug-and-play (matches current app shapes): `supabase/option_a_quick_schema.sql`
  - Option B — Normalized (better for analytics & concurrency): `supabase/option_b_normalized.sql`

When Supabase env vars are set, the app loads initial data from Supabase and mirrors CRUD actions to the corresponding tables (best‑effort). Without them, it uses localStorage with seed data.

Tip: From Settings → “Sync to Supabase” you can push all current local rows to your Supabase tables once you’ve created them.

The Settings page also surfaces the current data source and whether the Supabase client is active so
you can confirm which path the app is using at runtime.

## Normalized Mode (Option B)

For multi‑user concurrency and analytics, enable the normalized schema. The app auto‑detects it and adapts reads/writes accordingly.

- Create the schema: run `supabase/option_b_normalized.sql` in Supabase → SQL Editor.
- Ensure env vars are set in `.env.local` (see above), then restart `npm run dev`.

What changes in normalized mode

- DB‑managed IDs: The app stores Postgres UUIDs as the canonical `id` for all rows.
- DB‑managed display IDs: The app uses `display_id` (identity sequence) from the DB instead of local counters.
- Normalized tables: Orders are split across `orders` and `order_items`; product tiers are in `product_tiers`.
- Automatic mapping: The app maps normalized rows to the UI’s shapes:
  - products + product_tiers → `{ id, name, type, stock, costPerUnit, increment, tiers[] }`
  - orders + order_items → `{ id, clientId, date, items[], total, status, amountPaid, fees, discount, paymentMethods }`
- Writes remain simple from the UI perspective:
  - Creating/editing a product updates `products` and replaces rows in `product_tiers`.
  - Creating/editing an order updates `orders` and replaces rows in `order_items`.
  - Deleting an order cascades to `order_items`.

Notes and limitations

- Inventory math: The UI still adjusts `products.stock` and `last_ordered` client‑side (same as before). You can add DB triggers later if you prefer server‑side enforcement.
- Backfill counters: Local display‑ID counters are ignored when Supabase is enabled and normalized; DB assigns `display_id`.
- The Settings → “Sync to Supabase” button supports the flat (Option A) schema only. Migrating existing local/Option‑A data to normalized requires a one‑time migration script (see below).

Optional: Triggers for inventory integrity

Add triggers to adjust `products.stock` and weighted `cost_per_unit` on `order_items`/`inventory_movements` changes if you’d like the DB to enforce these invariants. The DDL file documents the relevant tables; triggers are not required for the app to work.

Migrating from Option A or local data (overview)

If you already have data in localStorage or Option‑A tables and want to move to the normalized schema:

- Export current data from Settings → Export Data.
- Write a small script using `@supabase/supabase-js` that:
  1) Inserts clients/products into normalized tables and records an ID map.
  2) Inserts orders into `orders` using mapped client IDs.
  3) Inserts items into `order_items` using mapped product/order IDs (set `line_price` to item `price` and derive `unit_price = price/quantity`).
  4) Inserts expenses and logs.

This preserves referential integrity with new UUIDs. If you want, open an issue and we can provide a tailored migration script for your dataset.
