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
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
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
    ap.add_argument("--out-json", default="shop-products.json", help="Output JSON file")
    ap.add_argument("--out-js", default="shop-products.js", help="Output JS file")
    args = ap.parse_args(argv)

    store_url = _t(args.store_url)
    if not store_url:
        print("WC_STORE_URL is missing. Provide --store-url or set WC_STORE_URL env var.", file=sys.stderr)
        return 2

    raw: List[Dict[str, Any]]
    meta: Dict[str, Any]

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

