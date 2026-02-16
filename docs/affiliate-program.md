# Affiliate Program (Recommend & Earn 10%)

This document defines the public affiliate referral program for Spanish Coast Properties (SCP), including tracking rules, operational workflow, and where the implementation lives in this repo.

## Summary

- Any user can enable an affiliate code and share SCP links (listings, services, buy/sell).
- If a referred client generates confirmed SCP revenue (fees), the affiliate earns 10% of that revenue.
- Earnings are recorded as revenue events and surfaced to the affiliate in `affiliate.html`.
- Payouts are made as cash or as goods/services (credit), subject to verification and local compliance requirements.

## Definitions

- Affiliate: the user who shares SCP links containing `?aff=CODE`.
- Referred client: a new customer who arrives via an affiliate code and later generates revenue for SCP.
- SCP revenue / fees: the amount SCP actually earns for the engagement (not the property price).

## Tracking And Attribution

- Tracking parameter: `aff` (example: `properties.html?aff=ABC123DEF4`).
- The site stores `aff` in browser storage (best-effort; 30 day retention).
- When the referred user signs in, the referral is claimed server-side via RPC (`affiliate_claim_referral`).
- Self-referrals are blocked (a user cannot refer themselves).

Notes:

- If browser storage is blocked, the site tries to propagate `aff` through navigation links (best-effort).
- If the client contacts SCP via email/WhatsApp, prefilled messages include the referral code when available.

## Commission Rules

- Rate: default 10% of SCP revenue (fees) from the referred client.
- Commission is calculated on SCP revenue, not property sale price.
- Refunds, chargebacks, taxes, or third-party costs may reduce eligible revenue.
- SCP may pause/ban affiliate accounts for fraud/abuse; banned/paused accounts should not earn.

## Payout Rules

- Payout preference is stored per affiliate: `cash` or `goods_services`.
- Events are typically marked:
  - `approved`: eligible for payout (after revenue confirmation).
  - `paid`: payout completed (records method/ref and sets `paid_at`).
  - `rejected`: invalid/fraud/refunded.

Operationally:

1. Admin creates an event when revenue is confirmed.
2. Admin marks it `paid` with payout method and reference.
3. Affiliate sees the event in their dashboard and can export CSV.

## UI

- Public affiliate dashboard: `affiliate.html`
  - Generates and displays the user's affiliate code and share links.
  - Allows setting payout preference and accepting terms.
  - Shows earnings from `affiliate_revenue_events`.
- Admin dashboard: `admin-affiliates.html`
  - Creates revenue events by affiliate code.
  - Updates event status/payout info.
  - Views and manages affiliate accounts (status + commission rate).

## Database (Supabase)

Schema is in `supabase.sql`:

- `public.affiliate_accounts`
  - one per user, contains code/status/rate/terms/payout settings.
- `public.affiliate_referrals`
  - one per referred user; binds user -> affiliate.
- `public.affiliate_revenue_events`
  - revenue + computed commission events; admin-only inserts/updates; affiliates can read their own.

RPC functions:

- `public.affiliate_get_or_create()`
- `public.affiliate_accept_terms(version text)`
- `public.affiliate_set_payout(preference text, note text)`
- `public.affiliate_claim_referral(code text)`
- `public.admin_affiliate_create_event(affiliate_code, amount_eur, source_type, source_ref, note, customer_email)`

Attribution columns (best-effort) added to:

- `public.shop_orders`
- `public.vehicle_submissions`
- `public.property_submissions`

On insert, triggers copy referral info into these rows when a referral exists.

## Deployment Checklist

1. Apply the updated `supabase.sql` in Supabase (Database -> SQL editor).
2. Ensure `config.js` is set for the production Supabase project.
3. Deploy the static site (GitHub Pages).
4. Test flows:
   - Affiliate enables code and copies a listing share link.
   - New user opens link, signs up, referral is claimed.
   - Admin creates a revenue event and marks it paid.
   - Affiliate sees the event and totals in `affiliate.html`.

