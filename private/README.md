# Private Exports (Do Not Commit)

This folder is for locally-generated private exports (contacts/leads) that contain PII.

- Contents are ignored by git via `.gitignore`.
- Keep your Inmovilla XML exports and any generated CSV/SQL for Supabase imports here if needed.
- Legacy mapping exports can also be generated here (for example `private/legacy/listing_ref_map.sql` via `build_legacy_ref_map.py`).
