#!/usr/bin/env python3
"""
Sync WooCommerce products into static files for GitHub Pages.

Why:
- Client-side WooCommerce APIs either need credentials (unsafe to ship to browsers) or depend on CORS.
- This script fetches products server-side (locally or via GitHub Actions) and writes:
  - shop-products.json
  - shop-products.js (window.shopProducts = [...])

Default source:
- WooCommerce Store API (public): /wp-json/wc/store/products
  This is enough for a showcase + "Open in shop" flow.

Optional:
- WooCommerce REST API (auth): /wp-json/wc/v3/products (requires consumer key/secret)
  Enable with --api=v3 and set env vars:
  WC_CONSUMER_KEY, WC_CONSUMER_SECRET
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _t(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()


def _strip_html(s: str) -> str:
    text = _t(s)
    if not text:
        return ""
    # Remove scripts/styles first.
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\\1>", " ", text)
    # Remove all tags.
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    # Collapse whitespace.
    text = re.sub(r"\\s+", " ", text).strip()
    return text


def _http_json(url: str, *, headers: Optional[Dict[str, str]] = None, timeout: int = 35) -> Any:
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = "utf-8"
        try:
            cs = resp.headers.get_content_charset()
            if cs:
                charset = cs
        except Exception:
            pass
        raw = resp.read()
        text = raw.decode(charset, errors="ignore")
        return json.loads(text)


def _price_major(price_raw: Any, minor_unit: int) -> Optional[float]:
    if price_raw is None:
        return None
    s = _t(price_raw)
    if not s:
        return None
    # Store API uses integer strings in minor units (e.g. "12999" for 129.99 with minor=2).
    try:
        n = int(float(s))
        return float(n) / float(10**minor_unit)
    except Exception:
        try:
            return float(s)
        except Exception:
            return None


def _norm_url(store_url: str) -> str:
    u = _t(store_url).rstrip("/")
    if not u:
        return ""
    if not (u.startswith("http://") or u.startswith("https://")):
        u = "https://" + u
    return u


def import_csv_products(csv_path: str, store_url: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Import WooCommerce Product Export CSV (WooCommerce > Products > Export).

    Notes:
    - Exports often include 1 row per variation. We keep only parent rows (variable + simple),
      but we compute a display price for variable products from their variations.
    - The export does not include permalinks/slugs by default. We create a fallback product URL
      using the ID: {store_url}/?p={id}. (WordPress typically redirects this to the canonical URL.)
    """

    def fnum(v: Any) -> Optional[float]:
        s = _t(v)
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None

    def split_csv_list(v: Any) -> List[str]:
        raw = _t(v)
        if not raw:
            return []
        # Woo export uses comma+space separation for these fields.
        return [part.strip() for part in raw.split(",") if part.strip()]

    def cats_from(v: Any) -> List[Dict[str, Any]]:
        # Keep as {name} objects to match the client UI shape.
        cats: List[Dict[str, Any]] = []
        for raw in split_csv_list(v):
            # WooCommerce sometimes uses "Parent > Child"; prefer the most specific name.
            name = raw.split(">")[-1].strip()
            if not name:
                continue
            cats.append({"id": None, "name": name, "slug": ""})
        return cats

    def imgs_from(v: Any) -> List[str]:
        return [u for u in split_csv_list(v) if u.startswith("http://") or u.startswith("https://")]

    def limit_text(s: str, max_len: int) -> str:
        t = _t(s)
        if not t:
            return ""
        if len(t) <= max_len:
            return t
        return t[: max(0, max_len - 1)].rstrip() + "…"

    base = _norm_url(store_url) if _t(store_url) else ""

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        r = csv.reader(f)
        header = next(r)

        def idx(name: str) -> Optional[int]:
            try:
                return header.index(name)
            except ValueError:
                return None

        i_id = idx("ID")
        i_type = idx("Type")
        i_sku = idx("SKU")
        i_name = idx("Name")
        i_short = idx("Short description")
        i_desc = idx("Description")
        i_sale = idx("Sale price")
        i_reg = idx("Regular price")
        i_cats = idx("Categories")
        i_tags = idx("Tags")
        i_imgs = idx("Images")
        i_parent = idx("Parent")
        i_old_date = idx("Meta: _wp_old_date")

        if i_id is None or i_type is None or i_name is None:
            raise ValueError("CSV missing required columns: ID/Type/Name")

        parents: Dict[int, List[str]] = {}
        variations: Dict[int, List[List[str]]] = defaultdict(list)

        for row in r:
            if not row:
                continue
            if len(row) < len(header):
                row = row + [""] * (len(header) - len(row))
            elif len(row) > len(header):
                row = row[: len(header)]

            raw_id = _t(row[i_id])
            if not raw_id:
                continue
            try:
                pid = int(float(raw_id))
            except Exception:
                continue

            t = _t(row[i_type]).strip().lower()
            if t == "variation":
                if i_parent is None:
                    continue
                raw_parent = _t(row[i_parent])
                if not raw_parent:
                    continue
                try:
                    parent_id = int(float(raw_parent))
                except Exception:
                    continue
                variations[parent_id].append(row)
                continue

            parents[pid] = row

    products: List[Dict[str, Any]] = []

    for pid, row in parents.items():
        t = _t(row[i_type]).strip().lower()
        if t not in ("variable", "simple", "external"):
            continue

        name = _t(row[i_name])
        if not name:
            continue

        sku = _t(row[i_sku]) if i_sku is not None else ""
        url = f"{base}/?p={pid}" if base else ""
        short_text = _strip_html(_t(row[i_short])) if i_short is not None else ""
        desc_text = _strip_html(_t(row[i_desc])) if i_desc is not None else ""
        short_text = limit_text(short_text, 320)
        desc_text = limit_text(desc_text, 1800)

        date_created = _t(row[i_old_date]) if i_old_date is not None else ""

        cats = cats_from(row[i_cats]) if i_cats is not None else []
        tags = []
        if i_tags is not None:
            for raw in split_csv_list(row[i_tags]):
                if not raw:
                    continue
                tags.append({"id": None, "name": raw, "slug": ""})

        images = imgs_from(row[i_imgs]) if i_imgs is not None else []

        price = fnum(row[i_sale]) if i_sale is not None else None
        regular = fnum(row[i_reg]) if i_reg is not None else None
        sale = price

        # For variable products, compute a display price from variations.
        price_min: Optional[float] = None
        price_max: Optional[float] = None
        on_sale = False
        if t == "variable":
            var_rows = variations.get(pid, [])
            eff_prices: List[float] = []
            sale_candidates: List[Tuple[float, float]] = []  # (sale, regular)

            for vr in var_rows:
                vr_reg = fnum(vr[i_reg]) if i_reg is not None else None
                vr_sale = fnum(vr[i_sale]) if i_sale is not None else None
                eff = vr_sale if (vr_sale is not None and vr_sale > 0) else vr_reg
                if eff is not None and eff > 0:
                    eff_prices.append(eff)
                if vr_sale is not None and vr_reg is not None and vr_sale > 0 and vr_reg > 0 and vr_sale < vr_reg:
                    sale_candidates.append((vr_sale, vr_reg))

            if eff_prices:
                price_min = min(eff_prices)
                price_max = max(eff_prices)
                price = price_min

            if sale_candidates:
                on_sale = True
                sale, regular = sorted(sale_candidates, key=lambda x: x[0])[0]
                price = sale
        else:
            if sale is not None and regular is not None and sale > 0 and regular > 0 and sale < regular:
                on_sale = True
            # When no sale price, prefer regular price as the display price.
            if price is None and regular is not None and regular > 0:
                price = regular

        products.append(
            {
                "id": pid,
                "sku": sku,
                "name": name,
                "slug": "",
                "url": url,
                "short_text": short_text,
                "desc_text": desc_text,
                "price": price,
                "regular_price": regular,
                "sale_price": sale,
                "currency": "EUR",
                "currency_symbol": "€",
                "on_sale": on_sale,
                "stock_status": None,
                "categories": cats,
                "tags": tags,
                "date_created": date_created,
                "type": t,
                "images": images,
                # Optional helpers (ignored by UI for now).
                "price_min": price_min,
                "price_max": price_max,
            }
        )

    meta = {"api": "csv", "store_url": base}
    return products, meta


def fetch_store_api_products(store_url: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    base = _norm_url(store_url)
    if not base:
        raise ValueError("Missing --store-url")

    per_page = 100
    page = 1
    out: List[Dict[str, Any]] = []

    while True:
        url = f"{base}/wp-json/wc/store/products?per_page={per_page}&page={page}"
        data = _http_json(url, headers={"User-Agent": "SCP-ShopSync/1.0"})
        items = data if isinstance(data, list) else []
        if not items:
            break
        out.extend(items)
        page += 1
        # Stop when a short page arrives.
        if len(items) < per_page:
            break

    meta = {"api": "store", "store_url": base}
    return out, meta


def fetch_v3_products(store_url: str, consumer_key: str, consumer_secret: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    base = _norm_url(store_url)
    if not base:
        raise ValueError("Missing --store-url")
    if not consumer_key or not consumer_secret:
        raise ValueError("Missing WC_CONSUMER_KEY/WC_CONSUMER_SECRET for --api=v3")

    per_page = 100
    page = 1
    out: List[Dict[str, Any]] = []

    while True:
        qs = urllib.parse.urlencode({"per_page": per_page, "page": page, "status": "publish"})
        url = f"{base}/wp-json/wc/v3/products?{qs}"
        password_mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
        password_mgr.add_password(None, url, consumer_key, consumer_secret)
        handler = urllib.request.HTTPBasicAuthHandler(password_mgr)
        opener = urllib.request.build_opener(handler)
        req = urllib.request.Request(url, headers={"User-Agent": "SCP-ShopSync/1.0"}, method="GET")
        with opener.open(req, timeout=35) as resp:
            raw = resp.read()
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        items = data if isinstance(data, list) else []
        if not items:
            break
        out.extend(items)
        page += 1
        if len(items) < per_page:
            break

    meta = {"api": "v3", "store_url": base}
    return out, meta


def map_store_product(p: Dict[str, Any]) -> Dict[str, Any]:
    prices = p.get("prices") if isinstance(p.get("prices"), dict) else {}
    minor = 2
    try:
        minor = int(prices.get("currency_minor_unit") or 2)
    except Exception:
        minor = 2

    currency = _t(prices.get("currency_code")) or "EUR"
    symbol = _t(prices.get("currency_symbol")) or ("€" if currency == "EUR" else "")

    price = _price_major(prices.get("price"), minor)
    regular = _price_major(prices.get("regular_price"), minor)
    sale = _price_major(prices.get("sale_price"), minor)

    images: List[str] = []
    for img in p.get("images") if isinstance(p.get("images"), list) else []:
        if not isinstance(img, dict):
            continue
        src = _t(img.get("src") or img.get("url"))
        if src:
            images.append(src)

    cats = []
    for c in p.get("categories") if isinstance(p.get("categories"), list) else []:
        if not isinstance(c, dict):
            continue
        name = _t(c.get("name"))
        slug = _t(c.get("slug"))
        if not (name or slug):
            continue
        cats.append({"id": c.get("id"), "name": name, "slug": slug})

    tags = []
    for t in p.get("tags") if isinstance(p.get("tags"), list) else []:
        if not isinstance(t, dict):
            continue
        name = _t(t.get("name"))
        slug = _t(t.get("slug"))
        if not (name or slug):
            continue
        tags.append({"id": t.get("id"), "name": name, "slug": slug})

    on_sale = bool(p.get("on_sale")) if "on_sale" in p else (sale is not None and regular is not None and sale < regular)
    stock_status = _t(p.get("stock_status"))
    if not stock_status:
        # Store API often includes is_in_stock boolean.
        if p.get("is_in_stock") is True:
            stock_status = "instock"
        elif p.get("is_in_stock") is False:
            stock_status = "outofstock"

    return {
        "id": p.get("id"),
        "sku": _t(p.get("sku")),
        "name": _t(p.get("name")),
        "slug": _t(p.get("slug")),
        "url": _t(p.get("permalink") or p.get("link")),
        "short_text": _strip_html(_t(p.get("short_description"))),
        "desc_text": _strip_html(_t(p.get("description"))),
        "price": price,
        "regular_price": regular,
        "sale_price": sale,
        "currency": currency,
        "currency_symbol": symbol,
        "on_sale": on_sale,
        "stock_status": stock_status or None,
        "categories": cats,
        "tags": tags,
        "date_created": _t(p.get("date_created") or p.get("date_created_gmt") or p.get("date_modified") or p.get("date_modified_gmt")),
        "type": _t(p.get("type")),
        "images": images,
    }


def map_v3_product(p: Dict[str, Any]) -> Dict[str, Any]:
    # v3 uses decimal strings for prices; currency isn't included per item.
    def fnum(v: Any) -> Optional[float]:
        s = _t(v)
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None

    images = []
    for img in p.get("images") if isinstance(p.get("images"), list) else []:
        if not isinstance(img, dict):
            continue
        src = _t(img.get("src"))
        if src:
            images.append(src)

    cats = []
    for c in p.get("categories") if isinstance(p.get("categories"), list) else []:
        if not isinstance(c, dict):
            continue
        name = _t(c.get("name"))
        slug = _t(c.get("slug"))
        if not (name or slug):
            continue
        cats.append({"id": c.get("id"), "name": name, "slug": slug})

    tags = []
    for t in p.get("tags") if isinstance(p.get("tags"), list) else []:
        if not isinstance(t, dict):
            continue
        name = _t(t.get("name"))
        slug = _t(t.get("slug"))
        if not (name or slug):
            continue
        tags.append({"id": t.get("id"), "name": name, "slug": slug})

    on_sale = bool(p.get("on_sale"))

    return {
        "id": p.get("id"),
        "sku": _t(p.get("sku")),
        "name": _t(p.get("name")),
        "slug": _t(p.get("slug")),
        "url": _t(p.get("permalink")),
        "short_text": _strip_html(_t(p.get("short_description"))),
        "desc_text": _strip_html(_t(p.get("description"))),
        "price": fnum(p.get("price")),
        "regular_price": fnum(p.get("regular_price")),
        "sale_price": fnum(p.get("sale_price")),
        "currency": "EUR",
        "currency_symbol": "€",
        "on_sale": on_sale,
        "stock_status": _t(p.get("stock_status")) or None,
        "categories": cats,
        "tags": tags,
        "date_created": _t(p.get("date_created") or p.get("date_modified")),
        "type": _t(p.get("type")),
        "images": images,
    }


def write_outputs(products: List[Dict[str, Any]], meta: Dict[str, Any], out_json: str, out_js: str) -> None:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    meta = dict(meta or {})
    meta["generated_at"] = generated_at
    meta.setdefault("source", "woocommerce")

    payload = {
        "meta": meta,
        "products": products,
    }

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    js = (
        "/* Auto-generated from WooCommerce. DO NOT EDIT BY HAND. */\n"
        "(function () {\n"
        f"  window.shopProducts = {json.dumps(products, ensure_ascii=False, indent=2)};\n"
        f"  window.shopProductsMeta = {json.dumps(meta, ensure_ascii=False, indent=2)};\n"
        "})();\n"
    )
    with open(out_js, "w", encoding="utf-8") as f:
        f.write(js)


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--store-url", required=False, default=os.environ.get("WC_STORE_URL", ""), help="WooCommerce site base URL")
    ap.add_argument("--api", choices=["store", "v3"], default=os.environ.get("WC_API", "store"), help="API to use")
    ap.add_argument("--csv", default=os.environ.get("WC_CSV", ""), help="WooCommerce product export CSV path (optional)")
    ap.add_argument("--out-json", default="shop-products.json", help="Output JSON file")
    ap.add_argument("--out-js", default="shop-products.js", help="Output JS file")
    args = ap.parse_args(argv)

    store_url = _t(args.store_url)
    csv_path = _t(args.csv)
    if not store_url and not csv_path:
        print("WC_STORE_URL is missing. Provide --store-url (or set WC_STORE_URL), or use --csv for a local export.", file=sys.stderr)
        return 2

    raw: List[Dict[str, Any]]
    meta: Dict[str, Any]

    if csv_path:
        mapped, meta = import_csv_products(csv_path, store_url)
    else:
        if args.api == "v3":
            ck = _t(os.environ.get("WC_CONSUMER_KEY"))
            cs = _t(os.environ.get("WC_CONSUMER_SECRET"))
            raw, meta = fetch_v3_products(store_url, ck, cs)
            mapped = [map_v3_product(p) for p in raw if isinstance(p, dict)]
        else:
            raw, meta = fetch_store_api_products(store_url)
            mapped = [map_store_product(p) for p in raw if isinstance(p, dict)]

    # Keep only valid products with a name.
    mapped = [p for p in mapped if _t(p.get("name"))]

    write_outputs(mapped, meta, args.out_json, args.out_js)
    print(f"Synced {len(mapped)} products -> {args.out_js} (+ {args.out_json})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
