# Spanish Coast Properties A1

Static property app for Spanish Coast Properties.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Publish on GitHub Pages

1. Push this repo to GitHub (public).
2. In GitHub repo settings, open `Pages`.
3. Source: `Deploy from a branch`.
4. Branch: `main` and folder `/ (root)`.
5. Save and wait for the Pages build.

Your app will be available at:

`https://<your-github-username>.github.io/<repo-name>/`

The app is responsive and works on mobile browsers.

## Import Inmovilla XML (Properties + Contacts/Leads)

This repo includes an importer for Inmovilla exports:

```bash
python3 import_inmovilla.py \
  --properties-xml "/path/to/listado.xml" \
  --contacts-xml "/path/to/listado (2).xml" \
  --demands-xml "/path/to/listado (1).xml"
```

Outputs:
- `inmovilla-listings.js` (public listings) loaded by `properties.html` and `brochure.html`.
- `private/inmovilla/listing_ref_map.sql` (original refs mapping for privileged users, **never public**). Ignored by git.
- `private/inmovilla/*.csv` and `private/inmovilla/*.sql` (PII, admin-only). These are **ignored by git**.

Supabase:
1. Run `supabase.sql` (creates auth tables + admin-only CRM + `listing_ref_map`).
2. Import the generated:
   - `private/inmovilla/listing_ref_map.sql` (maps Inmovilla refs -> SCP refs; visible only to privileged roles via RLS)
   - `private/inmovilla/crm_contacts.csv` and `private/inmovilla/crm_demands.csv` (recommended: Table Editor -> Import data)
   - If you must use the SQL editor: use the smaller chunked files under `private/inmovilla/sql_chunks/` (e.g. `crm_contacts.part001.sql`).

Admin UI:
- `admin-crm.html` shows contacts + leads (admin only).

Tip:
- If you need to re-assign all SCP refs for the Inmovilla feed, run the importer once with `--reset-ref-map`.

## Sync WooCommerce Shop Products (Smart Devices)

The app includes a shop page (`shop.html`) that renders products from a local file:
- `shop-products.js` (generated, committed)
- `shop-products.json` (generated, committed)

Generate/update locally:

```bash
python3 sync_woocommerce_products.py --store-url "https://your-woocommerce-site.com"
```

Automatic sync (recommended):
1. In GitHub repo settings:
   - `Settings -> Secrets and variables -> Actions -> Variables`
   - Add variable `WC_STORE_URL` (example: `https://spanishcoastproperties.com`)
2. (Optional) If you want to use the authenticated API:
   - Set variable `WC_API=v3`
   - Add secrets `WC_CONSUMER_KEY` and `WC_CONSUMER_SECRET`
3. Enable the workflow: `.github/workflows/sync-woocommerce-products.yml`

Notes:
- Store API (`WC_API=store`, default) is public and works for a showcase + "Open in shop" flow.
- Do not put WooCommerce API keys in `config.js` (that file is public).
