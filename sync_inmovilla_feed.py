#!/usr/bin/env python3
"""
Inmovilla v2 XML feed → inmovilla-listings.js  (nightly sync).

Fetches the live Inmovilla property feed, converts every <propiedad> into the
JSON schema consumed by the SCP front-end, preserves stable SCP-xxxx references
via the existing ref allocator, and writes the public inmovilla-listings.js file.

Usage (local):
    python3 sync_inmovilla_feed.py

Usage (CI / GitHub Actions):
    python3 sync_inmovilla_feed.py --feed-url "$FEED_URL"

Requires only the Python 3 standard library (no pip install needed).
"""

import argparse
import json
import os
import re
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

# ──────────────────────────────────────────────────────────────────────────────
#  Constants
# ──────────────────────────────────────────────────────────────────────────────

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))

DEFAULT_FEED_URL = "https://procesos.apinmo.com/xml/v2/xUYPBBMw/10183-web.xml"
DEFAULT_OUT_JS = os.path.join(REPO_ROOT, "inmovilla-listings.js")
DEFAULT_REF_MAP = os.path.join(REPO_ROOT, "private", "inmovilla", "ref_map.json")

# Inmovilla language-number mapping for titulo/descrip fields:
#   1 = ES, 2 = EN, 3 = DE, 4 = FR, 7 = RU, 9 = SV, 17 = PL
LANG_EN = 2
LANG_ES = 1
LANG_SV = 9

# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _t(value: Any) -> str:
    """Safely cast to stripped string."""
    if value is None:
        return ""
    s = str(value).strip()
    # Inmovilla CDATA sometimes ends with a stray tilde
    while s.endswith("~"):
        s = s[:-1].rstrip()
    return s


def _get(el: Optional[ET.Element], tag: str) -> str:
    """Get text of a direct child element."""
    if el is None:
        return ""
    child = el.find(tag)
    if child is None:
        return ""
    return _t(child.text)


def _num(value: str) -> Optional[float]:
    v = _t(value).replace(",", ".")
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _int_val(value: str) -> int:
    n = _num(value)
    if n is None:
        return 0
    return int(n)


def _bool01(value: str) -> bool:
    return _int_val(value) > 0


def _title_case(value: str) -> str:
    s = _t(value)
    if not s:
        return ""
    if s == s.upper() or s == s.lower():
        return s.title()
    return s


def _listing_mode(action: str) -> str:
    a = _t(action).lower()
    if "alquil" in a:
        return "rent"
    if "traspas" in a or "cesi" in a:
        return "traspaso"
    return "sale"


def _rent_period(value: str) -> str:
    v = _t(value).upper()
    if v in ("DIA", "DÍA"):
        return "day"
    if v in ("SEMANA", "SEMANAS", "WEEK"):
        return "week"
    if v in ("NOCHE", "NOCHES", "NIGHT"):
        return "night"
    return "month"


# ──────────────────────────────────────────────────────────────────────────────
#  SCP Ref Allocator (reuse logic from import_inmovilla.py)
# ──────────────────────────────────────────────────────────────────────────────

class ScpRefAllocator:
    """Allocate stable SCP-xxxx references for source refs."""

    def __init__(self, map_path: str, *, repo_root: Optional[str] = None):
        self.map_path = map_path
        self.repo_root = repo_root or REPO_ROOT
        self.state: Dict[str, Any] = {"version": 1, "next_number": 0, "map": {}, "meta": {}}
        self._load()
        if not isinstance(self.state.get("next_number"), int) or self.state["next_number"] <= 0:
            self.state["next_number"] = self._scan_max() + 1

    def _load(self) -> None:
        try:
            with open(self.map_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict) and isinstance(raw.get("map"), dict):
                self.state.update(raw)
        except Exception:
            pass

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.map_path), exist_ok=True)
        with open(self.map_path, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    def _scan_max(self) -> int:
        rx = re.compile(r"\bSCP-(\d{3,6})\b")
        max_num = 0
        for fn in ("data.js", "inmovilla-listings.js", "newbuilds-listings.js",
                    "businesses-data.js", "vehicles-data.js"):
            fp = os.path.join(self.repo_root, fn)
            if not os.path.exists(fp):
                continue
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    for m in rx.finditer(f.read()):
                        n = int(m.group(1))
                        if n > max_num:
                            max_num = n
            except Exception:
                pass
        # Also check existing map
        mapping = self.state.get("map") or {}
        for v in mapping.values():
            m2 = re.match(r"^SCP-(\d+)$", _t(v))
            if m2:
                n = int(m2.group(1))
                if n > max_num:
                    max_num = n
        return max_num

    def resolve(self, original_ref: str) -> str:
        mapping = self.state.setdefault("map", {})
        key = _t(original_ref).upper() or "UNKNOWN"
        existing = _t(mapping.get(key))
        if existing:
            return existing
        n = self.state.get("next_number") or (self._scan_max() + 1)
        scp_ref = f"SCP-{n}"
        mapping[key] = scp_ref
        self.state["next_number"] = n + 1
        return scp_ref

    def record(self, original_ref: str, original_id: str) -> None:
        key = _t(original_ref).upper() or "UNKNOWN"
        meta = self.state.setdefault("meta", {})
        row = meta.setdefault(key, {})
        oid = _t(original_id)
        if oid:
            row["original_id"] = oid


# ──────────────────────────────────────────────────────────────────────────────
#  Fetch & Parse
# ──────────────────────────────────────────────────────────────────────────────

class _RedirectHandler(urllib.request.HTTPRedirectHandler):
    """Handle 308 Permanent Redirect (not handled by default in older Python)."""
    def http_error_308(self, req, fp, code, msg, headers):
        return self.http_error_302(req, fp, code, msg, headers)


def fetch_feed(url: str, *, retries: int = 3, timeout: float = 60) -> str:
    """Download XML feed to a temp file, return the path."""
    opener = urllib.request.build_opener(_RedirectHandler)
    for attempt in range(1, retries + 1):
        try:
            print(f"  Fetching feed (attempt {attempt}/{retries})…")
            req = urllib.request.Request(url, headers={"User-Agent": "SCP-FeedSync/1.0"})
            with opener.open(req, timeout=timeout) as resp:
                data = resp.read()
            fd, path = tempfile.mkstemp(suffix=".xml")
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            print(f"  Downloaded {len(data):,} bytes → {path}")
            return path
        except Exception as exc:
            print(f"  Attempt {attempt} failed: {exc}")
            if attempt < retries:
                time.sleep(5 * attempt)
    raise RuntimeError(f"Failed to fetch feed after {retries} attempts: {url}")


def _collect_images(prop: ET.Element) -> List[str]:
    """Collect all foto1…foto50 from the property element."""
    images: List[str] = []
    for i in range(1, 51):
        url = _get(prop, f"foto{i}")
        if url and url.startswith("http"):
            images.append(url)
    return list(dict.fromkeys(images))  # dedupe preserving order


def _pick_description(prop: ET.Element) -> str:
    """Pick best title + description, preferring English."""
    title_en = _get(prop, f"titulo{LANG_EN}")
    title_es = _get(prop, f"titulo{LANG_ES}")
    desc_en = _get(prop, f"descrip{LANG_EN}")
    desc_es = _get(prop, f"descrip{LANG_ES}")

    title = title_en or title_es
    desc = desc_en or desc_es

    # Clean line-break tildes that Inmovilla uses
    if desc:
        desc = re.sub(r"~+", "\n", desc).strip()
        desc = re.sub(r"\n{3,}", "\n\n", desc)
    if title:
        title = re.sub(r"~+", " ", title).strip()

    if not desc:
        return title or ""
    if title and title.lower() not in desc[:120].lower():
        return f"{title}\n\n{desc}"
    return desc


def _extract_features(prop: ET.Element) -> List[str]:
    """Build the features array from property flags."""
    features: List[str] = []

    dist_mar = _int_val(_get(prop, "distmar"))
    if dist_mar > 0:
        features.append(f"Beach: {dist_mar} Meters")

    if _bool01(_get(prop, "piscina_prop")):
        features.append("Private pool")
    elif _bool01(_get(prop, "piscina_com")):
        features.append("Communal pool")

    if _bool01(_get(prop, "vistasalmar")):
        features.append("Sea view")

    if _bool01(_get(prop, "ascensor")):
        features.append("Elevator")
    if _bool01(_get(prop, "balcon")):
        features.append("Balcony")
    if _bool01(_get(prop, "terraza")) or _int_val(_get(prop, "m_terraza")) > 0:
        features.append("Terrace")
    if _bool01(_get(prop, "solarium")):
        features.append("Solarium")
    if _bool01(_get(prop, "jardin")):
        features.append("Garden")
    if _bool01(_get(prop, "trastero")):
        features.append("Storage room")
    if _bool01(_get(prop, "alarmarobo")) or _bool01(_get(prop, "alarma")):
        features.append("Alarm")

    plazas = _int_val(_get(prop, "nplazasparking"))
    if _bool01(_get(prop, "parking")) or _bool01(_get(prop, "plaza_gara")) or plazas > 0:
        features.append("Parking")

    if _bool01(_get(prop, "calefaccion")):
        features.append("Heating")
    if _bool01(_get(prop, "aire_con")) or _bool01(_get(prop, "airecentral")):
        features.append("Air conditioning")

    ori = _t(_get(prop, "orientacion"))
    if ori:
        features.append(f"Orientation: {ori}")

    if _bool01(_get(prop, "muebles")):
        features.append("Furnished")

    return features


def parse_feed(xml_path: str, allocator: ScpRefAllocator) -> List[Dict[str, Any]]:
    """Parse v2 Inmovilla XML feed into the public listing schema."""
    out: List[Dict[str, Any]] = []

    for _ev, el in ET.iterparse(xml_path, events=("end",)):
        if el.tag != "propiedad":
            continue

        inmovilla_id = _get(el, "id")
        original_ref = _get(el, "ref") or inmovilla_id
        if not inmovilla_id:
            el.clear()
            continue

        ref = allocator.resolve(original_ref)
        allocator.record(original_ref, inmovilla_id)

        action = _get(el, "accion")
        mode = _listing_mode(action)

        sale_price = _num(_get(el, "precioinmo")) or 0.0
        rent_price = _num(_get(el, "precioalq")) or 0.0
        price = sale_price if mode in ("sale", "traspaso") else rent_price

        ptype = _title_case(_get(el, "tipo_ofer")) or "Property"
        town = _title_case(_get(el, "ciudad"))
        province = _title_case(_get(el, "provincia"))

        beds_single = _int_val(_get(el, "habitaciones"))
        beds_double = _int_val(_get(el, "habdobles"))
        beds = beds_single + beds_double
        baths = _int_val(_get(el, "banyos"))

        built = _int_val(_get(el, "m_cons")) or _int_val(_get(el, "m_uties"))
        plot = _int_val(_get(el, "m_parcela"))

        lat = _num(_get(el, "latitud"))
        lon = _num(_get(el, "altitud"))  # yes, altitud = longitude in Inmovilla

        description = _pick_description(el)
        features = _extract_features(el)
        images = _collect_images(el)

        destacado = _int_val(_get(el, "destacado"))

        obj: Dict[str, Any] = {
            "id": f"imv-{_t(ref)}",
            "ref": _t(ref),
            "price": int(round(price)) if price and price > 0 else 0,
            "currency": "EUR",
            "type": ptype,
            "town": town,
            "province": province,
            "beds": beds,
            "baths": baths,
            "surface_area": {"built": built, "plot": plot},
            "description": description,
            "features": features,
            "images": images,
            "listing_mode": mode,
        }

        if lat is not None and lat != 0:
            obj["latitude"] = float(lat)
        if lon is not None and lon != 0:
            obj["longitude"] = float(lon)

        if mode == "rent" and rent_price and rent_price > 0:
            obj["rent_price"] = int(round(rent_price))
            obj["rent_period"] = _rent_period(_get(el, "tipomensual"))

        if destacado > 0:
            obj["featured"] = True

        out.append(obj)
        el.clear()

    return out


# ──────────────────────────────────────────────────────────────────────────────
#  Write output
# ──────────────────────────────────────────────────────────────────────────────

def write_public_js(properties: List[Dict[str, Any]], out_path: str) -> None:
    """Write the inmovilla-listings.js IIFE wrapper."""
    payload = json.dumps(properties, ensure_ascii=False, indent=2)
    content = (
        "/* Auto-generated from Inmovilla XML feed. DO NOT EDIT BY HAND. */\n"
        "(function () {\n"
        "  const list = Array.isArray(window.customPropertyData) ? window.customPropertyData : [];\n"
        "  const seen = new Set(list.map((p) => p && p.id).filter(Boolean));\n"
        f"  const items = {payload};\n"
        "  items.forEach((p) => {\n"
        "    if (!p || !p.id) return;\n"
        "    if (seen.has(p.id)) return;\n"
        "    seen.add(p.id);\n"
        "    list.push(p);\n"
        "  });\n"
        "  window.customPropertyData = list;\n"
        "})();\n"
    )
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)


# ──────────────────────────────────────────────────────────────────────────────
#  Main
# ──────────────────────────────────────────────────────────────────────────────

def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Sync Inmovilla v2 XML feed → inmovilla-listings.js")
    ap.add_argument("--feed-url", default=DEFAULT_FEED_URL, help="Inmovilla v2 feed URL")
    ap.add_argument("--out-js", default=DEFAULT_OUT_JS, help="Output JS path")
    ap.add_argument("--ref-map", default=DEFAULT_REF_MAP, help="SCP ref-map JSON path")
    ap.add_argument("--xml-file", default=None, help="Use a local XML file instead of fetching")
    args = ap.parse_args(argv)

    print("=" * 60)
    print("Inmovilla Feed Sync")
    print("=" * 60)

    # 1. Fetch (or use local file)
    if args.xml_file:
        xml_path = args.xml_file
        print(f"  Using local XML: {xml_path}")
    else:
        xml_path = fetch_feed(args.feed_url)

    # 2. Load ref allocator
    allocator = ScpRefAllocator(args.ref_map, repo_root=REPO_ROOT)

    # 3. Parse
    print("  Parsing properties…")
    properties = parse_feed(xml_path, allocator)
    print(f"  Parsed {len(properties)} properties")

    # 4. Write output
    write_public_js(properties, args.out_js)
    allocator.save()
    print(f"  Written → {args.out_js}")

    # 5. Clean up temp file
    if not args.xml_file and os.path.exists(xml_path):
        try:
            os.remove(xml_path)
        except Exception:
            pass

    # 6. Summary
    towns = {}
    for p in properties:
        t = p.get("town") or "Unknown"
        towns[t] = towns.get(t, 0) + 1
    top_towns = sorted(towns.items(), key=lambda x: x[1], reverse=True)[:10]

    print(f"\n  Summary:")
    print(f"    Total properties: {len(properties)}")
    print(f"    Top towns:")
    for town, count in top_towns:
        print(f"      {town}: {count}")

    sale = sum(1 for p in properties if p.get("listing_mode") == "sale")
    rent = sum(1 for p in properties if p.get("listing_mode") == "rent")
    featured = sum(1 for p in properties if p.get("featured"))
    print(f"    Sale: {sale}, Rent: {rent}, Featured: {featured}")
    print("=" * 60)
    print("Done ✓")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
