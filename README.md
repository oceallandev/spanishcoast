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
- `private/inmovilla/*.csv` and `private/inmovilla/*.sql` (PII, admin-only). These are **ignored by git**.

Supabase:
1. Run `supabase.sql` (creates admin-only CRM tables: `crm_contacts` + `crm_demands`).
2. Import the generated `private/inmovilla/crm_contacts.sql` and `private/inmovilla/crm_demands.sql` in the Supabase SQL editor.

Admin UI:
- `admin-crm.html` shows contacts + leads (admin only).
