#!/usr/bin/env python3
"""
Build a lightweight vehicles dataset for vehicles.html without loading the heavy property app.

Partners can contribute XML feeds (or JSON) placed in:
  - feeds/vehicles/*.xml (cars)
  - feeds/boats/*.xml (boats)

Config (providers + feed globs):
  vehicles-providers.json

Output:
  vehicles-data.js
    - window.vehicleProviders = [...]
    - window.vehicleListings  = [...]
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
PROVIDERS_JSON = ROOT / "vehicles-providers.json"
OUT_JS = ROOT / "vehicles-data.js"


def to_text(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return str(v)


def norm(v: Any) -> str:
    return to_text(v).strip()


def first_text(el: ET.Element, tag_names: Iterable[str]) -> str:
    for name in tag_names:
        node = el.find(name)
        if node is not None and node.text:
            s = node.text.strip()
            if s:
                return s
    return ""


def find_any_text(el: ET.Element, tag_names: Iterable[str]) -> str:
    # tag_names can include ".//tag" or plain tag names.
    for name in tag_names:
        node = el.find(name) if name.startswith(".") else el.find(f".//{name}")
        if node is not None and node.text:
            s = node.text.strip()
            if s:
                return s
    return ""


def find_any_attr(el: ET.Element, attr_names: Iterable[str]) -> str:
    for name in attr_names:
        v = el.get(name)
        if v:
            return v.strip()
    return ""


def parse_float(v: Any) -> Optional[float]:
    s = norm(v).replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except Exception:
        return None


def parse_int(v: Any) -> Optional[int]:
    s = norm(v)
    if not s:
        return None
    s = re.sub(r"[^\d\-]", "", s)
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None


def parse_price(v: Any) -> Optional[float]:
    s = norm(v)
    if not s:
        return None
    s = s.replace("\u20ac", "").replace("EUR", "").strip()
    s = s.replace(".", "").replace(",", ".")
    s = re.sub(r"[^\d\.]", "", s)
    if not s:
        return None
    try:
        return float(s)
    except Exception:
        return None


def extract_images(el: ET.Element) -> List[str]:
    images: List[str] = []
    # Common patterns: <images><image>url</image>...</images>, <photo>, <picture>
    for tag in ["image", "img", "photo", "picture", "url"]:
        for node in el.findall(f".//{tag}"):
            if node is not None and node.text:
                u = node.text.strip()
                if u and u not in images:
                    images.append(u)
    return images


def guess_deal(text_blob: str) -> str:
    low = (text_blob or "").lower()
    if any(k in low for k in ["rent", "rental", "for rent", "per day", "/day", "daily"]):
        return "rent"
    if any(k in low for k in ["sale", "for sale", "sell", "venta", "se vende"]):
        return "sale"
    return "any"


def guess_category(feed_category: str, text_blob: str) -> str:
    if feed_category in ("car", "boat"):
        return feed_category
    low = (text_blob or "").lower()
    if any(k in low for k in ["boat", "yacht", "rib", "catamaran", "sail"]):
        return "boat"
    return "car"


def load_xml_items(path: Path) -> List[ET.Element]:
    try:
        root = ET.fromstring(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        # try bytes parser
        root = ET.parse(str(path)).getroot()

    # Try multiple likely item node names.
    candidates = []
    for name in ["vehicle", "car", "boat", "listing", "item", "ad", "offer", "entry"]:
        found = root.findall(f".//{name}")
        if found:
            candidates.append((len(found), found))
    if candidates:
        candidates.sort(key=lambda t: t[0], reverse=True)
        return list(candidates[0][1])

    # Fallback: if root itself looks like an item list, take its children.
    return list(root)


def load_json_items(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in ["items", "listings", "vehicles", "results", "data"]:
            if isinstance(data.get(key), list):
                return [x for x in data[key] if isinstance(x, dict)]
    return []


def vehicle_from_xml_item(item: ET.Element, provider_id: str, provider_name: str, feed_category: str) -> Dict[str, Any]:
    title = find_any_text(item, ["title", "name", "headline"]) or "Vehicle"
    desc = find_any_text(item, ["description", "desc", "body", "details"])
    brand = find_any_text(item, ["brand", "make", "manufacturer"])
    model = find_any_text(item, ["model"])
    year = parse_int(find_any_text(item, ["year", "registration_year"]))
    ref = find_any_text(item, ["ref", "reference", "id", "code"]) or find_any_attr(item, ["id", "ref"])

    location = find_any_text(item, ["town", "city", "location", "pickup", "area"])
    lat = parse_float(find_any_text(item, ["latitude", "lat"]) or find_any_attr(item, ["lat", "latitude"]))
    lon = parse_float(find_any_text(item, ["longitude", "lon", "lng"]) or find_any_attr(item, ["lon", "lng", "longitude"]))

    currency = (find_any_text(item, ["currency"]) or "EUR").strip().upper()
    price = parse_price(find_any_text(item, ["price", "sale_price", "rent", "rental_price"]))
    price_period = find_any_text(item, ["price_period", "period", "rent_period"]).lower().strip()
    if price_period not in ("day", "week", "month", "year", ""):
        price_period = ""

    images = extract_images(item)
    deal = guess_deal(" ".join([title, desc, find_any_text(item, ["deal", "status", "type"])]))
    category = guess_category(feed_category, " ".join([title, desc, brand, model]))

    if brand and model and (title == "Vehicle" or title.strip().lower() in ("car", "boat")):
        title = f"{brand} {model}".strip()

    listing_id = norm(ref) or f"{provider_id}:{hash((title, location, price, lat, lon))}"

    return {
        "id": listing_id,
        "providerId": provider_id,
        "providerName": provider_name,
        "category": category,  # car | boat
        "deal": deal,          # rent | sale | any
        "title": title,
        "brand": brand,
        "model": model,
        "year": year,
        "price": price,
        "currency": currency,
        "pricePeriod": price_period,
        "location": location,
        "latitude": lat,
        "longitude": lon,
        "images": images,
        "description": desc[:800] if desc else ""
    }


def vehicle_from_json_item(item: Dict[str, Any], provider_id: str, provider_name: str, feed_category: str) -> Dict[str, Any]:
    title = norm(item.get("title") or item.get("name") or "Vehicle")
    desc = norm(item.get("description") or item.get("desc") or "")
    brand = norm(item.get("brand") or item.get("make") or "")
    model = norm(item.get("model") or "")
    year = parse_int(item.get("year"))
    ref = norm(item.get("ref") or item.get("id") or item.get("code") or "")

    location = norm(item.get("location") or item.get("town") or item.get("city") or "")
    lat = parse_float(item.get("latitude") or item.get("lat"))
    lon = parse_float(item.get("longitude") or item.get("lon") or item.get("lng"))

    currency = norm(item.get("currency") or "EUR").upper()
    price = item.get("price")
    if not isinstance(price, (int, float)):
        price = parse_price(price)
    price_period = norm(item.get("pricePeriod") or item.get("period") or "").lower()

    images_raw = item.get("images") or item.get("photos") or []
    images: List[str] = []
    if isinstance(images_raw, list):
        for u in images_raw:
            u = norm(u)
            if u and u not in images:
                images.append(u)
    elif isinstance(images_raw, str):
        for u in re.split(r"[,\n]+", images_raw):
            u = norm(u)
            if u and u not in images:
                images.append(u)

    deal = norm(item.get("deal") or item.get("status") or "")
    if deal not in ("rent", "sale"):
        deal = guess_deal(" ".join([title, desc, deal]))

    category = norm(item.get("category") or item.get("type") or "")
    category = guess_category(feed_category, category + " " + title + " " + desc)

    listing_id = ref or f"{provider_id}:{hash((title, location, price, lat, lon))}"

    return {
        "id": listing_id,
        "providerId": provider_id,
        "providerName": provider_name,
        "category": category,
        "deal": deal,
        "title": title,
        "brand": brand,
        "model": model,
        "year": year,
        "price": price,
        "currency": currency,
        "pricePeriod": price_period,
        "location": location,
        "latitude": lat,
        "longitude": lon,
        "images": images,
        "description": desc[:800] if desc else ""
    }


def main() -> None:
    cfg = json.loads(PROVIDERS_JSON.read_text(encoding="utf-8"))
    providers = cfg.get("providers") if isinstance(cfg, dict) else []
    if not isinstance(providers, list):
        providers = []

    out_providers = []
    out_listings: List[Dict[str, Any]] = []
    seen_ids = set()

    for p in providers:
        if not isinstance(p, dict):
            continue
        pid = norm(p.get("id"))
        name = norm(p.get("name")) or pid
        if not pid:
            continue
        out_providers.append(
            {
                "id": pid,
                "name": name,
                "logo": norm(p.get("logo")),
                "phone": norm(p.get("phone")),
                "email": norm(p.get("email")),
                "website": norm(p.get("website")),
            }
        )

        feeds = p.get("feeds") or []
        if not isinstance(feeds, list):
            continue

        for feed in feeds:
            if not isinstance(feed, dict):
                continue
            category = norm(feed.get("category") or "car").lower()
            paths = feed.get("paths") or []
            if isinstance(paths, str):
                paths = [paths]
            if not isinstance(paths, list):
                continue

            feed_files: List[Path] = []
            for pat in paths:
                pat = norm(pat)
                if not pat:
                    continue
                feed_files.extend(ROOT.glob(pat))

            for fp in sorted(set(feed_files)):
                if not fp.is_file():
                    continue
                try:
                    mtime_ms = int(fp.stat().st_mtime * 1000)
                except Exception:
                    mtime_ms = 0
                if fp.suffix.lower() == ".json":
                    items = load_json_items(fp)
                    for it in items:
                        listing = vehicle_from_json_item(it, pid, name, category)
                        listing.setdefault("dateAdded", mtime_ms)
                        lid = norm(listing.get("id"))
                        if not lid or lid in seen_ids:
                            continue
                        seen_ids.add(lid)
                        out_listings.append(listing)
                else:
                    items = load_xml_items(fp)
                    for it in items:
                        listing = vehicle_from_xml_item(it, pid, name, category)
                        listing.setdefault("dateAdded", mtime_ms)
                        lid = norm(listing.get("id"))
                        if not lid or lid in seen_ids:
                            continue
                        seen_ids.add(lid)
                        out_listings.append(listing)

    payload_providers = json.dumps(out_providers, ensure_ascii=True, separators=(",", ":"))
    payload_listings = json.dumps(out_listings, ensure_ascii=True, separators=(",", ":"))

    banner = (
        "// Generated by build_vehicles_data.py. Do not edit by hand.\n"
        f"// Providers: {len(out_providers)} | Listings: {len(out_listings)}\n"
    )
    OUT_JS.write_text(
        banner
        + "window.vehicleProviders = "
        + payload_providers
        + ";\nwindow.vehicleListings = "
        + payload_listings
        + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
