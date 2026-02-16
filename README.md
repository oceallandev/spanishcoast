# Spanish Coast Properties A1

Static property app for Spanish Coast Properties.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Local Intel (Events, Fiestas, Holidays)

This repo includes a daily local-intel pipeline that pulls from iCal/RSS/manual sources and publishes:

- `events.html` (browse local events/fiestas/holidays)
- a "Local" blog type (15-day rolling daily digest posts)

Docs:
- `docs/local-intel.md`

## Publish on GitHub Pages

1. Push this repo to GitHub (public).
2. In GitHub repo settings, open `Pages`.
3. Source: `Deploy from a branch`.
4. Branch: `main` and folder `/ (root)`.
5. Save and wait for the Pages build.

Your app will be available at:

`https://<your-github-username>.github.io/<repo-name>/`

The app is responsive and works on mobile browsers.

## Localization (EN / ES / RO / SV)

The app includes a scalable localization system with:
- full base dictionaries for English and Spanish,
- curated Romanian/Swedish UI overrides,
- automatic completion of missing Romanian/Swedish keys with local browser cache.

See:
- `docs/i18n-localization.md`

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

Language normalization:
- If a listing has Spanish-only title/description, importer auto-translates it to English first (base content for all UI languages).
- Disable this behavior with: `--no-auto-en-from-es`

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

## Seed Legacy PropMLS Original Refs (MLSC...)

Older SCP refs (for example `SCP-1980`, `SCP-1675`) are mapped in `reference_map.csv`.
To make those original refs visible to privileged users in the app, generate a Supabase upsert:

```bash
python3 build_legacy_ref_map.py
```

This generates (gitignored):
- `private/legacy/listing_ref_map.sql`
- `private/legacy/sql_chunks/listing_ref_map.partXXX.sql`

Supabase:
1. Run `supabase.sql` if not already applied.
2. Import `private/legacy/listing_ref_map.sql` (or chunked files under `private/legacy/sql_chunks/`).

## Import New Builds / Developers XML (Kyero v3 / RedSp)

If you have a Kyero v3 XML export (for example from RedSp), you can import it as "new builds" listings:

```bash
python3 import_redsp_kyero_v3.py \
  --xml "/path/to/redsp1-kyero_v3.xml" \
  --source "redsp1"
```

This generates:
- `newbuilds-listings.js` (public, committed): new build listings merged into the Properties catalog (and brochure).
- `private/redsp1/ref_map.json` (private, gitignored): stable SCP ref allocator state.
- `private/redsp1/listing_ref_map.sql` (private, gitignored): Supabase upsert to map original refs -> SCP refs.

Language normalization:
- If RedSp/Kyero description is only in Spanish, importer auto-translates it to English first.
- Disable with: `--no-auto-en-from-es`

Supabase:
1. Run `supabase.sql` (creates `listing_ref_map` + RLS).
2. Import the generated `private/redsp1/listing_ref_map.sql` (or chunked SQL files under `private/redsp1/sql_chunks/`).

Note:
- New-build "Original ref" visibility depends on this RedSp map being imported in Supabase.

## Sync WooCommerce Shop Products (Smart Devices)

The app includes a shop page (`shop.html`) that renders products from a local file:
- `shop-products.js` (generated, committed)
- `shop-products.json` (generated, committed)

Generate/update locally:

```bash
python3 sync_woocommerce_products.py --store-url "https://your-woocommerce-site.com"
```

Import from a WooCommerce Product Export CSV:

```bash
python3 sync_woocommerce_products.py \
  --csv "/path/to/wc-product-export.csv" \
  --store-url "https://your-woocommerce-site.com"
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
