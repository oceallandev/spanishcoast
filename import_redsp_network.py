#!/usr/bin/env python3
"""
Generate public Network profiles from a RedSp v4 (or Kyero v3) new-build feed.

Why:
- RedSp feeds do not include direct developer contact details.
- We still want to showcase developments publicly (with a "Request control" claim CTA),
  so developers/agencies can claim and provide verified contact info and updates.

Outputs (public, committed):
- `network-redsp.js` (window.scpNetworkDataRedsp)

Inputs (private, gitignored):
- `private/<source>/<source>-feed.xml` when using --url (same convention as import_redsp_kyero_v3.py)

Private exports for Supabase (admin-only, do not commit):
- `private/<source>/network_ref_map.json` (stable SCP ref allocation state; NEVER COMMIT)
- `private/<source>/network_profile_ref_map.sql` (+ chunked SQL editor-safe parts)
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


def _t(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""
    return str(value).strip()


def _title_case(value: str) -> str:
    s = re.sub(r"\s+", " ", _t(value)).strip()
    if not s:
        return ""
    norm = s.lower()
    if norm in ("townhouse", "town house"):
        return "Town House"
    if norm in ("newbuild", "new build"):
        return "New Build"
    if norm in ("plot", "land", "parcel"):
        return "Land"
    return " ".join(w[:1].upper() + w[1:].lower() if w else "" for w in s.split(" ")).strip()


def _pluralize(value: str) -> str:
    s = _t(value)
    if not s:
        return ""
    # naive pluralization for UI labels only
    if s.endswith("s"):
        return s
    if s.endswith("y") and len(s) > 2 and s[-2].lower() not in "aeiou":
        return s[:-1] + "ies"
    return s + "s"


def _slugify(value: str) -> str:
    s = _t(value).lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def _clean_desc(value: str) -> str:
    desc = _t(value)
    if not desc:
        return ""

    # Decode HTML entities such as "&#13;" and "&nbsp;".
    # Note: some feeds double-encode, so we also handle leftover literals below.
    try:
        desc = html.unescape(desc)
    except Exception:
        pass

    # Handle leftover literals when double-encoded.
    desc = desc.replace("&#13;", "\n").replace("&#10;", "\n")

    # Normalize basic HTML formatting into plain text.
    desc = re.sub(r"<br\s*/?>", "\n", desc, flags=re.IGNORECASE)
    desc = re.sub(r"</p\s*>", "\n\n", desc, flags=re.IGNORECASE)
    desc = re.sub(r"<p\b[^>]*>", "", desc, flags=re.IGNORECASE)
    desc = re.sub(r"</li\s*>", "\n", desc, flags=re.IGNORECASE)
    desc = re.sub(r"<li\b[^>]*>", "- ", desc, flags=re.IGNORECASE)
    desc = re.sub(r"<[^>]+>", " ", desc)

    # Normalize newlines + whitespace.
    desc = desc.replace("\r\n", "\n").replace("\r", "\n")
    desc = desc.replace("\u00a0", " ")
    desc = re.sub(r"[ \t]*\n[ \t]*", "\n", desc)
    desc = re.sub(r"\n{3,}", "\n\n", desc)
    desc = re.sub(r"[ \t]{2,}", " ", desc)
    desc = desc.strip()

    # Some exports append a numeric supplier/account ID as a final line (e.g. "1073").
    m = re.search(r"(?:\n)+\s*(\d{3,6})\s*$", desc)
    if m:
        try:
            n = int(m.group(1))
        except Exception:
            n = None
        if n is not None and n < 1900:
            desc = desc[: m.start()].strip()

    return desc


def _first_sentence(value: str, max_len: int = 240) -> str:
    s = re.sub(r"\s+", " ", _t(value)).strip()
    if not s:
        return ""
    # Split on a period followed by space, or line breaks.
    parts = re.split(r"(?:\.\s+|\r?\n+|&#13;)+", s)

    first = ""
    for p in parts:
        cand = _t(p)
        if cand:
            first = cand
            break
    if not first:
        first = s
    if len(first) > max_len:
        return first[: max_len - 1].rstrip() + "…"
    return first


def _cmp_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _t(value).lower()).strip()


def _strip_leading_duplicate(desc: str, heading: str) -> str:
    d = _t(desc)
    if not d:
        return ""
    h = _t(heading)
    if not h:
        return d
    hk = _cmp_key(h)
    if not hk:
        return d

    parts = [p.strip() for p in re.split(r"\n{2,}", d) if _t(p)]
    if parts and _cmp_key(parts[0]) == hk:
        return "\n\n".join(parts[1:]).strip()
    return d


def _truncate_text(value: str, max_len: int = 1400) -> str:
    s = _t(value)
    if not s:
        return ""
    if len(s) <= max_len:
        return s

    cut = s[: max_len - 1].rstrip()
    window = 280
    best = -1
    best_sep = ""
    for sep in ("\n\n", "\n", ". ", "! ", "? "):
        idx = cut.rfind(sep)
        if idx >= max(0, len(cut) - window) and idx > best:
            best = idx
            best_sep = sep
    if best >= 0:
        if best_sep in (". ", "! ", "? "):
            cut = cut[: best + 1].rstrip()
        else:
            cut = cut[:best].rstrip()
    else:
        sp = cut.rfind(" ")
        if sp >= max(0, len(cut) - 120):
            cut = cut[:sp].rstrip()
    return cut + "…"


def _pick_lang(el: Optional[ET.Element], prefer: Tuple[str, ...]) -> str:
    if el is None:
        return ""
    for code in prefer:
        ch = el.find(code)
        if ch is not None:
            v = _t(ch.text)
            if v:
                return v
    # fallback: first non-empty
    for ch in list(el):
        v = _t(ch.text)
        if v:
            return v
    return _t(el.text)


def _first_image_url(prop: ET.Element) -> str:
    images_el = prop.find("images")
    if images_el is None:
        return ""
    for img_el in list(images_el):
        if img_el.tag != "image":
            continue
        url_el = img_el.find("url")
        if url_el is None:
            continue
        u = _t(url_el.text)
        if u:
            return u
    return ""


def _office_id_from_property_id(value: str) -> str:
    # RedSp v4: <id>2917-115-10-115</id> where second segment seems to be an office/group id.
    parts = _t(value).split("-")
    if len(parts) >= 2 and parts[1].isdigit():
        return parts[1]
    return ""


def download_xml(url: str, out_path: str) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
    with open(out_path, "wb") as f:
        f.write(raw)


def write_csv(rows: List[Dict[str, Any]], out_path: str, fieldnames: List[str]) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def write_sql_upsert(rows: List[Dict[str, Any]], out_path: str, table: str, conflict_cols: List[str], cols: List[str]) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    def q(v: Any) -> str:
        if v is None:
            return "null"
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, (dict, list)):
            s = json.dumps(v, ensure_ascii=False)
            s = s.replace("'", "''")
            return f"'{s}'::jsonb"
        s = str(v)
        s = s.replace("'", "''")
        return f"'{s}'"

    values_sql = []
    for r in rows:
        values_sql.append("(" + ", ".join(q(r.get(c)) for c in cols) + ")")

    conflict = ", ".join(conflict_cols)
    set_cols = [c for c in cols if c not in conflict_cols]
    update = ", ".join([f"{c} = excluded.{c}" for c in set_cols])

    sql = (
        f"insert into public.{table} ({', '.join(cols)})\n"
        f"values\n  " + ",\n  ".join(values_sql) + "\n"
        f"on conflict ({conflict}) do update set {update};\n"
    )
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(sql)


def write_sql_upsert_chunks(
    rows: List[Dict[str, Any]],
    out_dir: str,
    file_prefix: str,
    *,
    table: str,
    conflict_cols: List[str],
    cols: List[str],
    max_rows: int = 80,
    max_chars: int = 160_000,
) -> List[str]:
    """
    Supabase SQL editor has a query size limit; large single INSERT statements often fail.
    This writes multiple smaller upserts that are safe to paste/run one-by-one.
    """
    os.makedirs(out_dir, exist_ok=True)

    def q(v: Any) -> str:
        if v is None:
            return "null"
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, (dict, list)):
            s = json.dumps(v, ensure_ascii=False)
            s = s.replace("'", "''")
            return f"'{s}'::jsonb"
        s = str(v)
        s = s.replace("'", "''")
        return f"'{s}'"

    conflict = ", ".join(conflict_cols)
    set_cols = [c for c in cols if c not in conflict_cols]
    update = ", ".join([f"{c} = excluded.{c}" for c in set_cols])

    prefix = f"insert into public.{table} ({', '.join(cols)})\nvalues\n  "
    suffix = f"\non conflict ({conflict}) do update set {update};\n"

    paths: List[str] = []
    chunk_idx = 1
    buf: List[str] = []
    buf_len = len(prefix) + len(suffix)

    def flush() -> None:
        nonlocal chunk_idx, buf, buf_len
        if not buf:
            return
        out_path = os.path.join(out_dir, f"{file_prefix}.part{chunk_idx:03}.sql")
        body = ",\n  ".join(buf)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(prefix + body + suffix)
        paths.append(out_path)
        chunk_idx += 1
        buf = []
        buf_len = len(prefix) + len(suffix)

    for r in rows:
        values = "(" + ", ".join(q(r.get(c)) for c in cols) + ")"
        extra = len(values) + (len(",\n  ") if buf else 0)
        if buf and (len(buf) >= max_rows or (buf_len + extra) > max_chars):
            flush()
        buf.append(values)
        buf_len += extra

    flush()
    return paths


class ScpNetworkRefAllocator:
    """
    Allocate stable "SCP-<Type>-NNNN" references for Network profiles.

    The mapping is stored locally under `private/` (gitignored) so the public site never ships
    provider/source references. A SQL upsert export is also generated so admins can import it
    into Supabase (behind RLS) and reveal source refs on demand.
    """

    def __init__(self, map_path: str, *, repo_root: Optional[str] = None, reset: bool = False, pad: int = 4):
        self.map_path = map_path
        self.repo_root = repo_root or os.path.dirname(os.path.abspath(__file__))
        self.pad = int(pad) if int(pad) > 0 else 4
        self.state: Dict[str, Any] = {"version": 1, "next_numbers": {}, "map": {}, "meta": {}}
        if not reset:
            self._load()

        self.prefix_by_kind = {
            "agency": "SCP-Age",
            "agent": "SCP-Age",
            "developer": "SCP-Dev",
            "development": "SCP-Dev",
            "collaborator": "SCP-Col",
        }
        self._ensure_next_numbers()

    def _load(self) -> None:
        try:
            with open(self.map_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict) and isinstance(raw.get("map"), dict):
                self.state.update(raw)
        except Exception:
            return

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.map_path), exist_ok=True)
        with open(self.map_path, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)

    def _scan_max_numbers(self) -> Dict[str, int]:
        # Scan committed/public JS to avoid collisions.
        rx = re.compile(r"\b(SCP-(?:Age|Dev|Col))-(\d{3,6})\b", flags=re.IGNORECASE)
        max_by: Dict[str, int] = {"SCP-Age": 0, "SCP-Dev": 0, "SCP-Col": 0}

        canon = {"scp-age": "SCP-Age", "scp-dev": "SCP-Dev", "scp-col": "SCP-Col"}

        candidates = [
            os.path.join(self.repo_root, "network-data.js"),
            os.path.join(self.repo_root, "network-redsp.js"),
        ]

        for fp in candidates:
            if not os.path.exists(fp):
                continue
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except Exception:
                continue
            for m in rx.finditer(text):
                pref_raw = _t(m.group(1)).lower()
                pref = canon.get(pref_raw, "")
                if not pref:
                    continue
                try:
                    n = int(m.group(2))
                except Exception:
                    continue
                if n > max_by.get(pref, 0):
                    max_by[pref] = n

        return max_by

    def _max_allocated_numbers(self) -> Dict[str, int]:
        rx = re.compile(r"^(SCP-(?:Age|Dev|Col))-(\d{3,6})$", flags=re.IGNORECASE)
        max_by: Dict[str, int] = {"SCP-Age": 0, "SCP-Dev": 0, "SCP-Col": 0}
        canon = {"scp-age": "SCP-Age", "scp-dev": "SCP-Dev", "scp-col": "SCP-Col"}
        mapping = self.state.get("map") or {}
        if not isinstance(mapping, dict):
            return max_by
        for v in mapping.values():
            m = rx.match(_t(v))
            if not m:
                continue
            pref = canon.get(_t(m.group(1)).lower(), "")
            if not pref:
                continue
            try:
                n = int(m.group(2))
            except Exception:
                continue
            if n > max_by.get(pref, 0):
                max_by[pref] = n
        return max_by

    def _ensure_next_numbers(self) -> None:
        next_numbers = self.state.get("next_numbers")
        if not isinstance(next_numbers, dict):
            next_numbers = {}
            self.state["next_numbers"] = next_numbers

        scanned = self._scan_max_numbers()
        allocated = self._max_allocated_numbers()

        for pref in ("SCP-Age", "SCP-Dev", "SCP-Col"):
            cur = next_numbers.get(pref)
            try:
                cur_n = int(cur)
            except Exception:
                cur_n = 0
            base_next = max(scanned.get(pref, 0) + 1, allocated.get(pref, 0) + 1, 1)
            next_numbers[pref] = max(cur_n, base_next)

    def _key(self, source: str, kind: str, original_ref: str) -> str:
        src = _t(source).lower() or "source"
        k = _t(kind).lower() or "unknown"
        ref = _t(original_ref).upper() or "UNKNOWN"
        return f"{src}|{k}|{ref}"

    def resolve(self, source: str, kind: str, original_ref: str) -> str:
        mapping = self.state.get("map")
        if not isinstance(mapping, dict):
            mapping = {}
            self.state["map"] = mapping

        k = self._key(source, kind, original_ref)
        existing = _t(mapping.get(k))
        if existing:
            return existing

        prefix = self.prefix_by_kind.get(_t(kind).lower(), "SCP-Ref")
        next_numbers = self.state.get("next_numbers") or {}
        try:
            n = int(next_numbers.get(prefix) or 0)
        except Exception:
            n = 0
        if n <= 0:
            self._ensure_next_numbers()
            try:
                n = int((self.state.get("next_numbers") or {}).get(prefix) or 1)
            except Exception:
                n = 1

        scp_ref = f"{prefix}-{n:0{self.pad}d}"
        mapping[k] = scp_ref
        (self.state.get("next_numbers") or {})[prefix] = n + 1
        return scp_ref

    def record(self, source: str, kind: str, original_ref: str, original_id: str) -> None:
        meta = self.state.get("meta")
        if not isinstance(meta, dict):
            meta = {}
            self.state["meta"] = meta
        k = self._key(source, kind, original_ref)
        row = meta.get(k)
        if not isinstance(row, dict):
            row = {}
            meta[k] = row
        oid = _t(original_id)
        if oid:
            row["original_id"] = oid

    def rows_for_supabase(self) -> List[Dict[str, Any]]:
        mapping = self.state.get("map")
        if not isinstance(mapping, dict):
            return []
        meta = self.state.get("meta")
        meta = meta if isinstance(meta, dict) else {}

        rows: List[Dict[str, Any]] = []
        for key, scp_ref in mapping.items():
            parts = _t(key).split("|", 2)
            if len(parts) != 3:
                continue
            source, kind, original_ref = parts
            m = meta.get(key)
            original_id = None
            if isinstance(m, dict):
                original_id = _t(m.get("original_id")) or None
            rows.append(
                {
                    "scp_ref": _t(scp_ref),
                    "kind": _t(kind),
                    "source": _t(source),
                    "original_ref": _t(original_ref),
                    "original_id": original_id,
                }
            )
        return rows


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Generate Network profiles from RedSp v4 feed.")
    ap.add_argument("--xml", help="Path to the XML feed file.")
    ap.add_argument("--url", help="Download the feed from this URL (writes under private/<source>/).")
    ap.add_argument("--source", default="redsp1", help="Short source name (used in ids).")
    ap.add_argument("--out-js", default="network-redsp.js", help="Output JS file (public, committed).")
    ap.add_argument("--reset-ref-map", action="store_true", help="Re-assign new SCP refs (DANGEROUS).")
    ap.add_argument(
        "--costa",
        action="append",
        default=[],
        help="Only include properties where <costa> matches (repeatable). Default: Costa Blanca South (+ Inland).",
    )
    args = ap.parse_args(argv)

    repo_root = os.path.dirname(os.path.abspath(__file__))
    source = re.sub(r"[^a-zA-Z0-9_-]+", "-", _t(args.source).lower()) or "redsp1"

    priv_dir = os.path.join(repo_root, "private", source)
    os.makedirs(priv_dir, exist_ok=True)

    xml_path = _t(args.xml)
    if not xml_path and args.url:
        xml_path = os.path.join(priv_dir, f"{source}-feed.xml")
        print(f"Downloading feed -> {xml_path}")
        download_xml(_t(args.url), xml_path)

    if not xml_path:
        print("ERROR: Provide --xml or --url.", file=sys.stderr)
        return 2
    if not os.path.exists(xml_path):
        print(f"ERROR: XML file not found: {xml_path}", file=sys.stderr)
        return 2

    allocator = ScpNetworkRefAllocator(
        os.path.join(priv_dir, "network_ref_map.json"),
        repo_root=repo_root,
        reset=bool(args.reset_ref_map),
    )

    allowed_costas = set(_t(c) for c in (args.costa or []) if _t(c))
    if not allowed_costas:
        allowed_costas = {"Costa Blanca South", "Costa Blanca South - Inland"}

    # Aggregation per development_ref.
    devm_counts: Dict[str, int] = defaultdict(int)
    devm_towns: Dict[str, Counter] = defaultdict(Counter)
    devm_provs: Dict[str, Counter] = defaultdict(Counter)
    devm_costas: Dict[str, Counter] = defaultdict(Counter)
    devm_types: Dict[str, Counter] = defaultdict(Counter)
    devm_offices: Dict[str, Counter] = defaultdict(Counter)
    devm_title: Dict[str, str] = {}
    devm_desc: Dict[str, str] = {}
    devm_hero: Dict[str, str] = {}

    # Aggregation per office id (acts as a placeholder "developer" bucket).
    office_counts: Counter = Counter()
    office_towns: Dict[str, Counter] = defaultdict(Counter)
    office_costas: Dict[str, Counter] = defaultdict(Counter)

    seen_props = 0
    kept_props = 0

    for ev, prop in ET.iterparse(xml_path, events=("end",)):
        if prop.tag != "property":
            continue
        seen_props += 1

        costa = _t(prop.findtext("costa"))
        if costa not in allowed_costas:
            prop.clear()
            continue

        devref = _t(prop.findtext("development_ref"))
        if not devref:
            prop.clear()
            continue

        kept_props += 1

        pid = _t(prop.findtext("id"))
        office = _office_id_from_property_id(pid)
        if office:
            office_counts[office] += 1
            office_costas[office][costa] += 1

        town = _t(prop.findtext("address/town") or prop.findtext("town"))
        province = _t(prop.findtext("address/province") or prop.findtext("province") or "Alicante")
        ptype = _title_case(_t(prop.findtext("type") or "Property")) or "Property"

        if town and office:
            office_towns[office][town] += 1

        devm_counts[devref] += 1
        if town:
            devm_towns[devref][town] += 1
        if province:
            devm_provs[devref][province] += 1
        if costa:
            devm_costas[devref][costa] += 1
        if ptype:
            devm_types[devref][ptype] += 1
        if office:
            devm_offices[devref][office] += 1

        if devref not in devm_hero:
            hero = _first_image_url(prop)
            if hero:
                devm_hero[devref] = hero

        if devref not in devm_title:
            title_el = prop.find("title")
            devm_title[devref] = _t(_pick_lang(title_el, ("en", "es")))

        if devref not in devm_desc:
            desc_el = prop.find("desc")
            devm_desc[devref] = _clean_desc(_pick_lang(desc_el, ("en", "es")))

        prop.clear()

    now = datetime.utcnow().strftime("%Y-%m-%d")

    # Shared SCP contact (until a profile is claimed and updated by admin).
    scp_contacts = {
        "phone": "+34624867866",
        "whatsapp": "+34624867866",
        "email": "info@spanishcoastproperties.com",
        "website": "https://www.spanishcoastproperties.com",
    }

    developers: List[Dict[str, Any]] = []
    agents: List[Dict[str, Any]] = []

    office_to_dev_id: Dict[str, str] = {}

    # Developers are placeholder buckets keyed by office id (the feed does not provide actual developer identities).
    for office, n in sorted(office_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        top_town = office_towns[office].most_common(1)[0][0] if office_towns[office] else "Costa Blanca South"
        dev_ref = allocator.resolve(source, "developer", office)
        allocator.record(source, "developer", office, f"office:{office}")
        dev_slug = dev_ref.lower()
        dev_id = f"dev_{dev_slug}"
        office_to_dev_id[office] = dev_id
        dev_name = f"New Build Partner ({top_town})"
        dev_headline = "New build developments supplied via our partner network."
        developers.append(
            {
                "id": dev_id,
                "ref": dev_ref,
                "slug": dev_slug,
                "name": dev_name,
                "headline": dev_headline,
                "location": {"town": top_town, "province": "Alicante", "costa": "Costa Blanca South"},
                "languages": ["en", "es", "ro", "sv"],
                "service_areas": ["Costa Blanca South"],
                "tags": ["New builds", "Developments"],
                "logo_url": "assets/placeholder.png",
                "contacts": scp_contacts,
                "verified": False,
                "claimable": True,
                "bio": (
                    "This is an auto-created placeholder profile for imported developments. "
                    "Use “Request control” to claim this profile and provide verified contact info."
                ),
            }
        )

        # One agent (sales desk) per developer bucket.
        agent_ref = allocator.resolve(source, "agent", office)
        allocator.record(source, "agent", office, f"office:{office} | role:sales")
        agent_slug = agent_ref.lower()
        agents.append(
            {
                "id": f"agent_{agent_slug}",
                "ref": agent_ref,
                "slug": agent_slug,
                "name": f"Sales desk ({top_town})",
                "headline": "Enquiries and viewing coordination for these developments.",
                "location": {"town": top_town, "province": "Alicante", "costa": "Costa Blanca South"},
                "languages": ["en", "es", "ro", "sv"],
                "service_areas": ["Costa Blanca South"],
                "tags": ["New builds", "Viewings"],
                "photo_url": "assets/placeholder.png",
                "contacts": scp_contacts,
                "agency_id": None,
                "developer_id": dev_id,
                "verified": False,
                "claimable": True,
                "bio": (
                    "Auto-created contact profile for imported developments. "
                    "Claim this profile to replace placeholder contact details."
                ),
            }
        )

    developments: List[Dict[str, Any]] = []
    for devref in sorted(devm_counts.keys(), key=lambda r: (_t(r).lower())):
        n = devm_counts[devref]
        town = devm_towns[devref].most_common(1)[0][0] if devm_towns[devref] else ""
        prov = devm_provs[devref].most_common(1)[0][0] if devm_provs[devref] else "Alicante"
        costa = devm_costas[devref].most_common(1)[0][0] if devm_costas[devref] else "Costa Blanca South"
        ptype = devm_types[devref].most_common(1)[0][0] if devm_types[devref] else "Property"
        office = devm_offices[devref].most_common(1)[0][0] if devm_offices[devref] else ""

        type_label = _pluralize(ptype) if ptype and _t(ptype).lower() not in ("property", "properties") else "Homes"
        name = f"{town} {type_label}" if town else "New build homes"
        title_clean = _clean_desc(devm_title.get(devref, ""))
        headline = _first_sentence(title_clean, max_len=180) or "New build development."

        bio_clean = _clean_desc(devm_desc.get(devref, "") or "")
        bio_clean = _strip_leading_duplicate(bio_clean, title_clean or headline)
        bio = _truncate_text(bio_clean, max_len=1600) or "Development details coming soon."
        hero = devm_hero.get(devref, "") or "assets/placeholder.png"

        tags = [ptype, "New build"]
        tags = [t for t in (_title_case(x) for x in tags) if t]
        tags = list(dict.fromkeys(tags))[:10]

        devm_ref = allocator.resolve(source, "development", devref)
        allocator.record(source, "development", devref, f"office:{office}" if office else "")
        devm_slug = devm_ref.lower()
        dev_id = office_to_dev_id.get(office) if office else None

        developments.append(
            {
                "id": f"devm_{devm_slug}",
                "ref": devm_ref,
                "slug": devm_slug,
                "name": name,
                "headline": headline,
                "location": {"town": town or "Costa Blanca South", "province": prov, "costa": costa},
                "developer_id": dev_id,
                "tags": tags,
                "hero_url": hero,
                "contacts": scp_contacts,
                "verified": False,
                "claimable": True,
                "bio": bio,
                "stats": {"listings": n},
            }
        )

    payload: Dict[str, Any] = {
        "version": now,
        "agencies": [],
        "agents": agents,
        "developers": developers,
        "developments": developments,
        "collaborators": [],
        "meta": {
            "seen_properties": seen_props,
            "kept_properties": kept_props,
            "allowed_costas": sorted(list(allowed_costas)),
            "unique_developments": len(developments),
            "generated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
    }

    out_js_path = os.path.join(repo_root, _t(args.out_js))
    js = (
        "/* Auto-generated from a new-build feed. DO NOT EDIT BY HAND. */\n"
        "(function () {\n"
        "  window.scpNetworkDataRedsp = "
        + json.dumps(payload, ensure_ascii=True, indent=2)
        + ";\n"
        "})();\n"
    )
    with open(out_js_path, "w", encoding="utf-8") as f:
        f.write(js)

    allocator.save()

    # Supabase network_profile_ref_map exports (private).
    rows = allocator.rows_for_supabase()
    rows.sort(key=lambda r: (_t(r.get("kind")), _t(r.get("scp_ref"))))

    ref_csv = os.path.join(priv_dir, "network_profile_ref_map.csv")
    ref_sql = os.path.join(priv_dir, "network_profile_ref_map.sql")
    chunks_dir = os.path.join(priv_dir, "sql_chunks")
    cols = ["scp_ref", "kind", "source", "original_ref", "original_id"]

    write_csv(rows, ref_csv, cols)
    write_sql_upsert(rows, ref_sql, table="network_profile_ref_map", conflict_cols=["scp_ref"], cols=cols)
    chunks = write_sql_upsert_chunks(
        rows,
        chunks_dir,
        "network_profile_ref_map",
        table="network_profile_ref_map",
        conflict_cols=["scp_ref"],
        cols=cols,
        max_rows=120,
    )

    print(f"Properties scanned: {seen_props} (kept: {kept_props})")
    print(f"Developments: {len(developments)}")
    print(f"Developers (office buckets): {len(developers)}")
    print(f"Agents: {len(agents)}")
    print(f"Wrote: {out_js_path}")
    print(f"Supabase mapping: {len(rows)} rows -> {ref_csv} (+ {ref_sql})")
    print(f"  SQL editor chunks: {len(chunks)} files -> {chunks_dir}/network_profile_ref_map.partXXX.sql")
    print("\nIMPORTANT: Do not commit anything under `private/`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
