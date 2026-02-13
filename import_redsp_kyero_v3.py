#!/usr/bin/env python3
"""
Import a Kyero v3 XML feed (e.g. RedSp export) into the SCP static app.

Outputs (public):
- `newbuilds-listings.js` (merged into window.customPropertyData; loaded by properties/brochure pages)

Outputs (private, gitignored):
- `private/<source>/ref_map.json` (stable SCP ref allocation; NEVER COMMIT)
- `private/<source>/listing_ref_map.sql` (+ chunked SQL editor-safe parts)

Why:
- Keep original system refs private while showing SCP refs publicly.
- Allow privileged roles to see original refs via Supabase `listing_ref_map` (RLS-protected).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from import_inmovilla import (
    ScpRefAllocator,
    prefer_english_text,
    write_csv,
    write_sql_upsert,
    write_sql_upsert_chunks,
)


def _t(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""
    return str(value).strip()


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if tag else ""


def _child(parent: Optional[ET.Element], name: str) -> Optional[ET.Element]:
    if parent is None:
        return None
    for ch in list(parent):
        if _strip_ns(ch.tag) == name:
            return ch
    return None


def _child_text(parent: Optional[ET.Element], name: str) -> str:
    el = _child(parent, name)
    return _t(el.text if el is not None else "")


def _find(parent: Optional[ET.Element], path: str) -> Optional[ET.Element]:
    cur = parent
    for part in path.split("/"):
        cur = _child(cur, part)
        if cur is None:
            return None
    return cur


def _find_text(parent: Optional[ET.Element], path: str) -> str:
    el = _find(parent, path)
    return _t(el.text if el is not None else "")


def _pick_lang(block: Optional[ET.Element], prefer: List[str]) -> str:
    if block is None:
        return ""
    for lang in prefer:
        el = _child(block, lang)
        if el is not None:
            val = _t(el.text)
            if val:
                return val
    # fallback: first non-empty child text
    for ch in list(block):
        val = _t(ch.text)
        if val:
            return val
    return _t(block.text)


def _lang_text(block: Optional[ET.Element], lang: str) -> str:
    el = _child(block, lang)
    return _t(el.text if el is not None else "")


def _int(value: Any) -> int:
    s = _t(value)
    if not s:
        return 0
    s = re.sub(r"[^\d\-]+", "", s)
    try:
        return int(s)
    except Exception:
        return 0


def _float(value: Any) -> Optional[float]:
    s = _t(value)
    if not s:
        return None
    s = s.replace(",", ".")
    s = re.sub(r"[^0-9.\-]+", "", s)
    try:
        return float(s)
    except Exception:
        return None


def _parse_feed_dt(value: str) -> Optional[datetime]:
    s = _t(value)
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


def _unique_preserve_order(items: List[str]) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for it in items:
        v = _t(it)
        if not v:
            continue
        if v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def _image_urls(prop: ET.Element) -> List[str]:
    out: List[str] = []
    images_el = _child(prop, "images")
    if images_el is not None:
        # Kyero v3: <images><image ...><url>...</url></image>...</images>
        for img_el in list(images_el):
            if _strip_ns(img_el.tag) != "image":
                continue
            url = _find_text(img_el, "url")
            if url:
                out.append(url)
        # Some feeds may use <images><url>...</url></images>
        if not out:
            for ch in list(images_el):
                if _strip_ns(ch.tag) == "url":
                    u = _t(ch.text)
                    if u:
                        out.append(u)

    # Fallback: avoid pulling the multilingual <url> block.
    if not out:
        for ch in list(prop):
            if _strip_ns(ch.tag) == "photo":
                u = _t(ch.text)
                if u:
                    out.append(u)

    # Filter to likely image URLs (be permissive; some feeds omit extensions).
    cleaned: List[str] = []
    for u in out:
        u = _t(u)
        if not u:
            continue
        cleaned.append(u)
    return _unique_preserve_order(cleaned)


def parse_kyero_v3_properties(
    xml_path: str,
    *,
    allocator: ScpRefAllocator,
    source: str,
    force_new_build: bool = True,
    prefer_langs: Optional[List[str]] = None,
    auto_translate_spanish_to_english: bool = True,
) -> List[Dict[str, Any]]:
    prefer_langs = prefer_langs or ["en", "es"]
    out: List[Tuple[Optional[datetime], Dict[str, Any]]] = []

    for ev, el in ET.iterparse(xml_path, events=("end",)):
        if _strip_ns(el.tag) != "property":
            continue

        original_id = _child_text(el, "id") or _child_text(el, "ref") or ""
        original_ref = _child_text(el, "ref") or original_id or ""

        scp_ref = allocator.resolve(original_ref)
        allocator.record(original_ref, original_id)

        price = _int(_child_text(el, "price"))
        currency = _child_text(el, "currency") or "EUR"
        ptype = _child_text(el, "type") or "Property"
        town = _child_text(el, "town")
        province = _child_text(el, "province") or "Alicante"

        beds = _int(_child_text(el, "beds"))
        baths = _int(_child_text(el, "baths"))

        built = _int(_find_text(el, "surface_area/built"))
        plot = _int(_find_text(el, "surface_area/plot"))

        lat = _float(_find_text(el, "location/latitude"))
        lon = _float(_find_text(el, "location/longitude"))

        desc_block = _child(el, "desc")
        if desc_block is not None:
            desc = prefer_english_text(
                _lang_text(desc_block, "en"),
                _lang_text(desc_block, "es"),
                auto_translate_spanish_to_english=auto_translate_spanish_to_english,
            )
            if not desc:
                desc = _pick_lang(desc_block, prefer_langs)
        else:
            desc = ""
        desc = desc or "Property details coming soon."
        # Some Kyero/RedSp exports append a numeric supplier/account ID as a final line (e.g. "1073").
        # Strip it so it never leaks into the public UI.
        m = re.search(r"(?:&#13;|\r?\n)+\s*(\d{3,6})\s*$", desc)
        if m:
            try:
                n = int(m.group(1))
            except Exception:
                n = None
            if n is not None and n < 1900:
                desc = desc[: m.start()].strip()

        url_block = _child(el, "url")
        source_url = _pick_lang(url_block, prefer_langs) if url_block is not None else ""

        feats: List[str] = []
        features_el = _child(el, "features")
        if features_el is not None:
            for ch in list(features_el):
                if _strip_ns(ch.tag) != "feature":
                    continue
                v = _t(ch.text)
                if v:
                    feats.append(v)
        feats = _unique_preserve_order(feats)

        imgs = _image_urls(el)

        date_raw = _child_text(el, "date")
        dt = _parse_feed_dt(date_raw)

        # Kyero includes <new_build> but it is often inconsistent; for a dedicated new-build feed,
        # we intentionally force it true.
        new_build_value = True if force_new_build else (_child_text(el, "new_build") in ("1", "true", "yes"))

        item: Dict[str, Any] = {
            "id": f"{source}-{scp_ref}",
            "ref": scp_ref,
            "price": price,
            "currency": currency,
            "type": ptype,
            "town": town,
            "province": province,
            "beds": beds,
            "baths": baths,
            "surface_area": {"built": built, "plot": plot},
            "latitude": lat,
            "longitude": lon,
            "description": desc,
            "features": feats,
            "images": imgs,
            "source_url": source_url or None,
            "new_build": new_build_value,
            # Keep a lightweight trace for debugging (not used by the UI).
            "source": source,
        }

        out.append((dt, item))
        el.clear()

    # Deterministic output:
    # - Sort by feed date ascending so "Date added (newest)" (sourceIndex desc) shows newest first.
    # - Secondary sort: ref.
    out.sort(key=lambda pair: (pair[0] or datetime(1900, 1, 1), _t(pair[1].get("ref"))))

    # Dedupe by ref (keep last, i.e. newest in this ordering).
    dedup: Dict[str, Dict[str, Any]] = {}
    for _, item in out:
        dedup[_t(item.get("ref"))] = item

    return list(dedup.values())


def write_public_js(items: List[Dict[str, Any]], out_path: str, *, source_label: str) -> None:
    payload = json.dumps(items, ensure_ascii=False, indent=2)
    content = (
        f"/* Auto-generated from {source_label} (Kyero v3). DO NOT EDIT BY HAND. */\n"
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


def download_xml(url: str, out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with urllib.request.urlopen(url) as resp, open(out_path, "wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Import RedSp Kyero v3 feed (new builds) into the SCP app.")
    ap.add_argument("--xml", help="Path to the Kyero v3 XML feed file.")
    ap.add_argument("--url", help="Download the feed from this URL (writes under private/<source>/).")
    ap.add_argument("--source", default="redsp1", help="Short source name (used in ids + Supabase listing_ref_map).")
    ap.add_argument("--out-js", default="newbuilds-listings.js", help="Output JS file (public, committed).")
    ap.add_argument("--reset-ref-map", action="store_true", help="Re-assign new SCP refs (DANGEROUS).")
    ap.add_argument(
        "--no-auto-en-from-es",
        action="store_true",
        help="Do not auto-translate Spanish-only description fields to English during import.",
    )
    ap.add_argument(
        "--not-all-new-build",
        action="store_true",
        help="Do not force new_build=true for every listing (use Kyero <new_build> tag when present).",
    )
    args = ap.parse_args(argv)

    repo_root = os.path.dirname(os.path.abspath(__file__))
    source = re.sub(r"[^a-zA-Z0-9_-]+", "-", _t(args.source).lower()) or "redsp1"

    priv_dir = os.path.join(repo_root, "private", source)
    os.makedirs(priv_dir, exist_ok=True)

    xml_path = _t(args.xml)
    if not xml_path and args.url:
        xml_path = os.path.join(priv_dir, f"{source}-kyero-v3.xml")
        print(f"Downloading feed -> {xml_path}")
        download_xml(_t(args.url), xml_path)

    if not xml_path:
        print("ERROR: Provide --xml or --url.", file=sys.stderr)
        return 2
    if not os.path.exists(xml_path):
        print(f"ERROR: XML file not found: {xml_path}", file=sys.stderr)
        return 2

    allocator = ScpRefAllocator(
        os.path.join(priv_dir, "ref_map.json"),
        repo_root=repo_root,
        reset=bool(args.reset_ref_map),
    )

    print(f"Parsing Kyero v3 feed: {xml_path}")
    items = parse_kyero_v3_properties(
        xml_path,
        allocator=allocator,
        source=source,
        force_new_build=not bool(args.not_all_new_build),
        auto_translate_spanish_to_english=not bool(args.no_auto_en_from_es),
    )
    allocator.save()

    out_js = os.path.join(repo_root, _t(args.out_js))
    write_public_js(items, out_js, source_label=f"{source}")
    print(f"Listings: {len(items)} -> {out_js}")

    # Supabase listing_ref_map exports (private).
    rows = allocator.rows_for_supabase(source=source)
    rows.sort(key=lambda r: (_t(r.get("scp_ref")), _t(r.get("original_ref"))))

    ref_csv = os.path.join(priv_dir, "listing_ref_map.csv")
    ref_sql = os.path.join(priv_dir, "listing_ref_map.sql")
    chunks_dir = os.path.join(priv_dir, "sql_chunks")
    cols = ["scp_ref", "source", "original_ref", "original_id"]

    write_csv(rows, ref_csv, cols)
    write_sql_upsert(rows, ref_sql, table="listing_ref_map", conflict_cols=["scp_ref"], cols=cols)
    chunks = write_sql_upsert_chunks(
        rows,
        chunks_dir,
        "listing_ref_map",
        table="listing_ref_map",
        conflict_cols=["scp_ref"],
        cols=cols,
        max_rows=80,
    )

    print(f"Supabase mapping: {len(rows)} rows -> {ref_csv} (+ {ref_sql})")
    print(f"  SQL editor chunks: {len(chunks)} files -> {chunks_dir}/listing_ref_map.partXXX.sql")
    print("\nIMPORTANT: Do not commit anything under `private/`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
