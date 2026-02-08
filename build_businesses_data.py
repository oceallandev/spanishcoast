#!/usr/bin/env python3
"""
Build a lightweight businesses dataset for businesses.html without loading the full properties app.

Input:  data.js   (const propertyData = [ ... ];)
Output: businesses-data.js (window.businessListings = [...];)
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA_JS = ROOT / "data.js"
OUT_JS = ROOT / "businesses-data.js"


TRASPASO_RE = re.compile(
    r"\b(?:traspaso|business transfer|se traspasa|leasehold|goodwill)\b",
    re.IGNORECASE,
)

BUSINESS_SALE_RE = re.compile(
    r"\b(?:business for sale|operating business|thriving business|loyal customer base|freehold restaurant)\b"
    r"|\b(?:restaurant|bar|cafe|caf\u00e9|salon|shop)\s+(?:for sale)\b"
    r"|\b(?:language school)\b.*\bfor sale\b",
    re.IGNORECASE,
)

TORREVIEJA_COORDS = (37.978, -0.683)
MAX_DISTANCE_FROM_TORREVIEJA_KM = 100
DISPLAY_BOUNDS = {
    "minLat": 37.84,
    "maxLat": 38.13,
    "minLon": -0.8,
    "maxLon": -0.6,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math

    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def in_display_area(item: dict) -> bool:
    try:
        lat = float(item.get("latitude"))
        lon = float(item.get("longitude"))
    except Exception:
        return False

    if not (DISPLAY_BOUNDS["minLat"] <= lat <= DISPLAY_BOUNDS["maxLat"]):
        return False
    if not (DISPLAY_BOUNDS["minLon"] <= lon <= DISPLAY_BOUNDS["maxLon"]):
        return False

    km = haversine_km(lat, lon, TORREVIEJA_COORDS[0], TORREVIEJA_COORDS[1])
    return km <= MAX_DISTANCE_FROM_TORREVIEJA_KM


def extract_json_array(js_text: str) -> str:
    start = js_text.find("[")
    end = js_text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Could not locate JSON array in data.js")
    return js_text[start : end + 1]


def normalize_text(value: str) -> str:
    s = html.unescape(value or "")
    # Drop tags and collapse whitespace.
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("\r", " ").replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def guess_title(desc_norm: str, fallback_type: str) -> str:
    low = desc_norm.lower()
    if "language school" in low:
        return "Language School"
    if "pizzeria" in low or re.search(r"\bpizza\b", low):
        return "Pizzeria"
    if "restaurant" in low:
        return "Restaurant"
    if "peluquer" in low or "hairdresser" in low or "hairdresser's" in low:
        return "Hair Salon (Peluqueria)"
    if "salon" in low or "beauty" in low or "manicure" in low or "pedicure" in low or "barber" in low:
        return "Beauty Salon"
    if re.search(r"\bbar\b", low):
        return "Bar"
    if "cafe" in low or "café" in low:
        return "Cafe"
    if "bakery" in low or "panader" in low:
        return "Bakery"
    if "supermarket" in low:
        return "Supermarket"
    if "shop" in low or "store" in low:
        return "Shop"
    if "hotel" in low or "hostel" in low:
        return "Hotel / Hostel"
    if "gym" in low or "fitness" in low:
        return "Gym / Fitness"
    if "clinic" in low or "dental" in low:
        return "Clinic"
    if "office" in low:
        return "Office"
    if "commercial" in (fallback_type or "").lower():
        return "Business Opportunity"
    return "Business"


def classify_kind(desc_norm: str) -> str:
    return "traspaso" if TRASPASO_RE.search(desc_norm or "") else "business"


def is_business_listing(item: dict) -> bool:
    desc = normalize_text(str(item.get("description", "") or ""))
    low = desc.lower()
    # Exclude plain rentals of premises unless they are explicitly a traspaso transfer.
    if "for rent" in low and not TRASPASO_RE.search(desc):
        return False

    if TRASPASO_RE.search(desc):
        return True

    if BUSINESS_SALE_RE.search(desc):
        return True

    return False


def main() -> None:
    js_text = DATA_JS.read_text(encoding="utf-8")
    array_text = extract_json_array(js_text)
    data = json.loads(array_text)

    out = []
    seen = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        if not in_display_area(item):
            continue
        if not is_business_listing(item):
            continue

        ref = str(item.get("ref", "") or "").strip()
        if not ref:
            continue
        if ref in seen:
            continue
        seen.add(ref)

        desc_norm = normalize_text(str(item.get("description", "") or ""))
        kind = classify_kind(desc_norm)
        title = guess_title(desc_norm, str(item.get("type", "") or ""))

        town = str(item.get("town", "") or "Costa Blanca South").strip()
        province = str(item.get("province", "") or "Alicante").strip()
        price = item.get("price", None)
        currency = str(item.get("currency", "") or "EUR").strip()
        images = item.get("images", []) or []
        hero = images[0] if isinstance(images, list) and images else ""
        lat = item.get("latitude", None)
        lon = item.get("longitude", None)

        out.append(
            {
                "id": str(item.get("id", "") or ref),
                "ref": ref,
                "kind": kind,  # "business" | "traspaso"
                "title": title,
                "businessType": title,
                "town": town,
                "province": province,
                "price": price,
                "currency": currency,
                "image": hero,
                "description": desc_norm[:420],
                "latitude": lat,
                "longitude": lon,
            }
        )

    payload = json.dumps(out, ensure_ascii=True, separators=(",", ":"))
    banner = (
        "// Generated by build_businesses_data.py. Do not edit by hand.\n"
        f"// Listings: {len(out)}\n"
        "window.businessListings = "
    )
    OUT_JS.write_text(banner + payload + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
