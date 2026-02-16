#!/usr/bin/env python3
"""
Sync local intel (events, fiestas, holidays, local updates) into static files.

Outputs:
- local-intel.json
- local-intel.js  (globalThis.SCP_LOCAL_INTEL = {...})
- local-intel-posts.json (extra blog posts for sync_blog_content.py --extra-posts)

Why:
- Keep the website static (GitHub Pages), but still update daily via GitHub Actions.
- Use public sources (iCal/RSS/manual) and generate an always-on "Local" digest for clients/tourists.

Config:
  local-intel-sources.json
  {
    "timezone": "Europe/Madrid",
    "areaLabel": "Costa Blanca South",
    "sources": [
      {
        "id": "spain_holidays_en",
        "label": "Google Calendar: Spain Holidays",
        "type": "ical",
        "kind": "holiday",
        "lang": "en",
        "url": "https://.../basic.ics",
        "tags": ["Spain", "Holiday"]
      },
      {
        "id": "manual_fiestas",
        "label": "Manual: Fiestas",
        "type": "manual",
        "kind": "fiesta",
        "lang": "en",
        "path": "local-intel-manual.json",
        "tags": ["Fiestas"]
      }
    ]
  }
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

try:
    from zoneinfo import ZoneInfo  # py3.9+
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore


USER_AGENT = "SpanishCoastPropertiesLocalIntel/1.0 (+https://oceallandev.github.io/spanishcoast/)"


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _t(v: Any) -> str:
    return str(v or "").strip()


def _fold(s: str) -> str:
    s = _t(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower()


def _slugify(s: str) -> str:
    s = _fold(s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s or "item"


def _strip_html(s: str) -> str:
    text = _t(s)
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<script\\b[^>]*>.*?</script>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style\\b[^>]*>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text


def _safe_text(s: Any) -> str:
    return re.sub(r"\\s+", " ", _strip_html(s)).strip()


def _truncate(s: str, limit: int) -> str:
    s = _safe_text(s)
    if not s:
        return ""
    if len(s) <= limit:
        return s
    chunk = s[: max(0, int(limit))]
    soft = chunk.rsplit(" ", 1)[0].strip() if " " in chunk else chunk
    if len(soft) < int(limit) * 0.6:
        soft = chunk.strip()
    soft = soft.rstrip(" ,.;:")
    return soft + "…"


def _fetch(url: str, *, timeout: int = 20) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/calendar, application/ics, application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _parse_rss_date(s: str) -> Optional[datetime]:
    s = _t(s)
    if not s:
        return None
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc)
    except Exception:
        pass
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _iter_tag(root: ET.Element, tag_name: str) -> Iterable[ET.Element]:
    for el in root.iter():
        t = el.tag or ""
        if t == tag_name or t.endswith("}" + tag_name):
            yield el


def _find_child_text(el: ET.Element, tag_name: str) -> str:
    for child in el:
        t = child.tag or ""
        if t == tag_name or t.endswith("}" + tag_name):
            return child.text or ""
    return ""


def _parse_rss_or_atom(xml_bytes: bytes) -> List[Dict[str, Any]]:
    root = ET.fromstring(xml_bytes)
    tag = (root.tag or "").lower()
    is_atom = tag.endswith("feed") or tag.endswith("}feed")

    items: List[Dict[str, Any]] = []
    if is_atom:
        for entry in _iter_tag(root, "entry"):
            title = _safe_text(_find_child_text(entry, "title"))

            link = ""
            for child in entry:
                t = child.tag or ""
                if not (t == "link" or t.endswith("}link")):
                    continue
                href = (child.attrib or {}).get("href", "") or ""
                rel = (child.attrib or {}).get("rel", "") or ""
                if rel in ("", "alternate"):
                    link = href
                    break
                if not link:
                    link = href

            date_raw = _find_child_text(entry, "published") or _find_child_text(entry, "updated")
            published_at = _parse_rss_date(date_raw)
            summary = _safe_text(_find_child_text(entry, "summary") or _find_child_text(entry, "content"))
            items.append({"title": title, "link": link, "published_at": published_at, "summary": summary, "raw": entry})
    else:
        for item in _iter_tag(root, "item"):
            title = _safe_text(_find_child_text(item, "title"))
            link = _safe_text(_find_child_text(item, "link"))
            date_raw = (
                _find_child_text(item, "pubDate")
                or _find_child_text(item, "date")
                or _find_child_text(item, "published")
            )
            published_at = _parse_rss_date(date_raw)
            summary = _safe_text(_find_child_text(item, "description"))
            items.append({"title": title, "link": link, "published_at": published_at, "summary": summary, "raw": item})

    return items


def _ical_unescape(value: str) -> str:
    # RFC 5545 escaping: \\n, \\, \\;, \\, etc.
    s = _t(value)
    if not s:
        return ""
    s = s.replace("\\\\", "\\")
    s = s.replace("\\n", "\n").replace("\\N", "\n")
    s = s.replace("\\,", ",").replace("\\;", ";")
    return s.strip()


def _unfold_ical_lines(text: str) -> List[str]:
    raw = _t(text).replace("\r\n", "\n").replace("\r", "\n")
    if not raw:
        return []
    out: List[str] = []
    for line in raw.split("\n"):
        if not line:
            continue
        if line.startswith((" ", "\t")) and out:
            out[-1] = out[-1] + line.lstrip()
        else:
            out.append(line.strip("\n"))
    return out


def _parse_ical_prop(line: str) -> Tuple[str, Dict[str, str], str]:
    # NAME;PARAM=V;PARAM2=V:VALUE
    if ":" not in line:
        return "", {}, ""
    left, value = line.split(":", 1)
    left = _t(left)
    value = value or ""
    if not left:
        return "", {}, value
    parts = left.split(";")
    name = _t(parts[0]).upper()
    params: Dict[str, str] = {}
    for p in parts[1:]:
        p = _t(p)
        if not p or "=" not in p:
            continue
        k, v = p.split("=", 1)
        params[_t(k).upper()] = _t(v).strip('"')
    return name, params, value


def _parse_ical_dt(value: str, params: Dict[str, str], default_tz: str) -> Tuple[Optional[datetime], bool]:
    v = _t(value)
    if not v:
        return None, False
    is_date = params.get("VALUE", "").upper() == "DATE" or bool(re.fullmatch(r"\\d{8}", v))
    tzid = _t(params.get("TZID") or "") or default_tz

    def tz_or_utc() -> timezone:
        if ZoneInfo and tzid:
            try:
                return ZoneInfo(tzid)  # type: ignore[arg-type]
            except Exception:
                return timezone.utc
        return timezone.utc

    if is_date:
        try:
            y, m, d = int(v[0:4]), int(v[4:6]), int(v[6:8])
            dt = datetime(y, m, d, tzinfo=tz_or_utc())
            return dt.astimezone(timezone.utc), True
        except Exception:
            return None, True

    # Date-time
    try:
        if v.endswith("Z"):
            dt = datetime.strptime(v, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            return dt, False
        # Some calendars use no seconds.
        if re.fullmatch(r"\\d{8}T\\d{6}", v):
            naive = datetime.strptime(v, "%Y%m%dT%H%M%S")
        elif re.fullmatch(r"\\d{8}T\\d{4}", v):
            naive = datetime.strptime(v, "%Y%m%dT%H%M")
        else:
            return None, False
        tz = tz_or_utc()
        return naive.replace(tzinfo=tz).astimezone(timezone.utc), False
    except Exception:
        return None, False


@dataclass
class IcalEvent:
    summary: str = ""
    description: str = ""
    location: str = ""
    url: str = ""
    uid: str = ""
    categories: List[str] = None  # type: ignore[assignment]
    dtstart_utc: Optional[datetime] = None
    dtend_utc: Optional[datetime] = None
    all_day: bool = False


def _parse_ical_events(ics_text: str, default_tz: str) -> List[IcalEvent]:
    lines = _unfold_ical_lines(ics_text)
    events: List[IcalEvent] = []
    cur: Optional[IcalEvent] = None

    for line in lines:
        upper = _t(line).upper()
        if upper == "BEGIN:VEVENT":
            cur = IcalEvent(categories=[])
            continue
        if upper == "END:VEVENT":
            if cur and cur.dtstart_utc and cur.summary:
                events.append(cur)
            cur = None
            continue
        if cur is None:
            continue

        name, params, value = _parse_ical_prop(line)
        if not name:
            continue

        if name == "SUMMARY":
            cur.summary = _safe_text(_ical_unescape(value))
        elif name == "DESCRIPTION":
            cur.description = _safe_text(_ical_unescape(value))
        elif name == "LOCATION":
            cur.location = _safe_text(_ical_unescape(value))
        elif name == "URL":
            cur.url = _safe_text(_ical_unescape(value))
        elif name == "UID":
            cur.uid = _safe_text(_ical_unescape(value))
        elif name == "CATEGORIES":
            cats = _safe_text(_ical_unescape(value))
            if cats:
                cur.categories.extend([_safe_text(x) for x in cats.split(",") if _safe_text(x)])
        elif name == "DTSTART":
            dt, all_day = _parse_ical_dt(value, params, default_tz)
            cur.dtstart_utc = dt
            cur.all_day = bool(all_day)
        elif name == "DTEND":
            dt, _all_day = _parse_ical_dt(value, params, default_tz)
            cur.dtend_utc = dt

    return events


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _make_id(at_utc: datetime, title: str, source_id: str, stable_key: str) -> str:
    day = at_utc.strftime("%Y-%m-%d")
    slug = _slugify(title)[:60]
    h = hashlib.sha1((stable_key + "|" + title + "|" + source_id).encode("utf-8")).hexdigest()[:8]
    return f"{day}-{slug}-{h}"


def _parse_iso_utc(iso: str) -> Optional[datetime]:
    s = _t(iso)
    if not s:
        return None
    try:
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def load_existing(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
            return raw if isinstance(raw, dict) else {"updatedAt": "", "items": []}
    except Exception:
        return {"updatedAt": "", "items": []}


def write_outputs(out_js: str, out_json: str, data: Dict[str, Any]) -> None:
    json_text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False)
    with open(out_json, "w", encoding="utf-8") as f:
        f.write(json_text)
        f.write("\n")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated content. Do not edit by hand. */\n")
        f.write("globalThis.SCP_LOCAL_INTEL = ")
        f.write(json_text)
        f.write(";\n")


def _dedupe_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not items:
        return []
    best: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    def score(it: Dict[str, Any]) -> int:
        return (
            len(_safe_text(it.get("summary") or "")) // 20
            + (10 if _safe_text(it.get("location") or "") else 0)
            + (6 if isinstance(it.get("tags"), list) and it.get("tags") else 0)
            + (6 if isinstance(it.get("sources"), list) and it.get("sources") else 0)
            + (4 if _safe_text(it.get("endAt") or "") else 0)
        )

    def signature(it: Dict[str, Any]) -> str:
        kind = _slugify(_safe_text(it.get("kind") or "event"))
        lang = _slugify(_safe_text(it.get("lang") or ""))
        title = _slugify(_safe_text(it.get("title") or ""))
        start_day = _safe_text(it.get("startAt") or "")[:10]
        loc = _slugify(_safe_text(it.get("location") or ""))
        return "|".join([kind, lang, title, start_day, loc])

    for it in items:
        if not isinstance(it, dict):
            continue
        item_id = _safe_text(it.get("id") or "")
        if not item_id or not _safe_text(it.get("title") or "") or not _safe_text(it.get("startAt") or ""):
            continue
        sig = signature(it) or f"fallback|{item_id}"
        prev = best.get(sig)
        if prev is None:
            best[sig] = it
            order.append(sig)
            continue
        if score(it) > score(prev):
            best[sig] = it

    return [best[s] for s in order if s in best]


def _unique_sources(items: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen = set()
    for it in items:
        srcs = it.get("sources")
        if not isinstance(srcs, list):
            continue
        for s in srcs:
            if not isinstance(s, dict):
                continue
            url = _safe_text(s.get("url") or "")
            name = _safe_text(s.get("name") or url or "")
            if not url:
                continue
            key = (url or "").lower()
            if key in seen:
                continue
            seen.add(key)
            out.append({"name": name or url, "url": url})
            if len(out) >= int(limit):
                return out
    return out


def _digest_post_for_day(
    *,
    day_local: date,
    tz_name: str,
    area_label: str,
    lang: str,
    items: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    tz = ZoneInfo(tz_name) if ZoneInfo else timezone.utc
    start_local = datetime.combine(day_local, time(0, 0), tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    window_end_local = start_local + timedelta(days=14)

    def in_range(it: Dict[str, Any], *, start: datetime, end: datetime) -> bool:
        dt = _parse_iso_utc(_safe_text(it.get("startAt") or ""))
        if not dt:
            return False
        local = dt.astimezone(tz)
        return start <= local < end

    def lang_pick(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        desired = [x for x in candidates if _safe_text(x.get("lang") or "") == lang]
        if desired:
            return desired
        # Fallback to anything if the requested language isn't available.
        return candidates

    upcoming_all = [x for x in items if _safe_text(x.get("kind") or "") in ("holiday", "fiesta", "event") and in_range(x, start=start_local, end=window_end_local)]
    updates_all = [x for x in items if _safe_text(x.get("kind") or "") in ("update", "advisory", "news") and in_range(x, start=start_local - timedelta(days=3), end=end_local)]

    upcoming = lang_pick(upcoming_all)
    updates = lang_pick(updates_all)

    # Only generate a digest if we have something sourced to show.
    if not upcoming and not updates:
        return None

    upcoming_sorted = sorted(upcoming, key=lambda x: _safe_text(x.get("startAt") or ""))
    updates_sorted = sorted(updates, key=lambda x: _safe_text(x.get("startAt") or ""), reverse=True)

    def fmt_line(it: Dict[str, Any]) -> str:
        dt = _parse_iso_utc(_safe_text(it.get("startAt") or ""))
        if not dt:
            return _safe_text(it.get("title") or "")
        local = dt.astimezone(tz)
        d = local.strftime("%d %b")
        loc = _safe_text(it.get("location") or "")
        title = _safe_text(it.get("title") or "")
        bits = [f"{d}: {title}".strip()]
        if loc:
            bits.append(loc)
        return " · ".join([b for b in bits if b])

    day_iso = day_local.isoformat()
    pid = f"{day_iso}-local-digest-{lang}"
    pub_local = datetime.combine(day_local, time(7, 0), tzinfo=tz).astimezone(timezone.utc)

    if lang == "es":
        title = f"{area_label}: eventos y fiestas ({day_iso})"
        intro = "Resumen local diario basado en calendarios publicos y fuentes enlazadas. Confirma horarios y ubicaciones en la fuente."
        upcoming_h = "Proximos 14 dias"
        updates_h = "Avisos recientes"
        tips_h = "Consejos rapidos"
        tips = [
            "En festivos es comun que bancos y oficinas tengan horario reducido o cierren.",
            "En fiestas grandes puede haber cortes de calles, mas trafico y parking limitado.",
            "Para planes de visita, pide un itinerario corto por zona y tiempos reales."
        ]
        cta = "Si vienes de visita o estas planificando una compra, Spanish Coast Properties puede ayudarte con un plan claro, zonas y opciones."
        tags = ["Local", "Eventos", "Fiestas"]
    else:
        title = f"{area_label}: events & fiestas ({day_iso})"
        intro = "Daily local digest based on public calendars and linked sources. Always confirm times and locations via the source."
        upcoming_h = "Next 14 days"
        updates_h = "Recent local updates"
        tips_h = "Quick tips"
        tips = [
            "On public holidays, banks and offices often run reduced hours or close.",
            "Big fiestas can mean road closures, extra traffic, and limited parking.",
            "If you are visiting to view properties, ask for a short itinerary by area and realistic travel times."
        ]
        cta = "If you are visiting or planning a purchase, Spanish Coast Properties can help with a clear plan, areas, and a shortlist."
        tags = ["Local", "Events", "Fiestas"]

    sections: List[Dict[str, Any]] = [{"type": "p", "text": intro}]

    if upcoming_sorted:
        sections.append({"type": "h", "text": upcoming_h})
        sections.append({"type": "ul", "items": [fmt_line(x) for x in upcoming_sorted[:12] if _safe_text(x.get("title") or "")]})

    if updates_sorted:
        sections.append({"type": "h", "text": updates_h})
        sections.append({"type": "ul", "items": [fmt_line(x) for x in updates_sorted[:8] if _safe_text(x.get("title") or "")]})

    sections.append({"type": "h", "text": tips_h})
    sections.append({"type": "ul", "items": tips})

    sources = _unique_sources(upcoming_sorted + updates_sorted, limit=10)

    return {
        "id": pid,
        "kind": "local",
        "lang": lang,
        "publishedAt": _iso(pub_local),
        "title": title,
        "excerpt": _truncate(intro, 220),
        "tags": tags,
        "sections": sections,
        "sources": sources,
        "cta": cta,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync local intel from iCal/RSS/manual sources into static files.")
    ap.add_argument("--sources", default="local-intel-sources.json", help="Path to local-intel-sources.json")
    ap.add_argument("--out-js", default="local-intel.js", help="Output JS file (globalThis.SCP_LOCAL_INTEL = ...)")
    ap.add_argument("--out-json", default="local-intel.json", help="Output JSON file")
    ap.add_argument("--out-extra-posts", default="local-intel-posts.json", help="Output JSON file for extra blog posts")
    ap.add_argument("--days-past", type=int, default=15, help="Keep items from the last N days")
    ap.add_argument("--days-future", type=int, default=365, help="Keep items up to N days into the future")
    ap.add_argument("--digest-backfill", type=int, default=15, help="Generate daily digests for the last N days (per language)")
    ap.add_argument("--max-items", type=int, default=900, help="Max items to keep")
    ap.add_argument("--timeout", type=int, default=20, help="HTTP timeout seconds")
    args = ap.parse_args()

    try:
        with open(args.sources, "r", encoding="utf-8") as f:
            cfg = json.load(f) or {}
    except Exception as e:
        print(f"ERROR: Could not read sources file: {e}", file=sys.stderr)
        return 2

    tz_name = _t(cfg.get("timezone") or "Europe/Madrid")
    area_label = _safe_text(cfg.get("areaLabel") or "Costa Blanca South") or "Costa Blanca South"

    tz = timezone.utc
    if ZoneInfo:
        try:
            tz = ZoneInfo(tz_name)  # type: ignore[assignment,arg-type]
        except Exception:
            tz = timezone.utc

    existing = load_existing(args.out_json)
    existing_items = existing.get("items") if isinstance(existing, dict) else []
    if not isinstance(existing_items, list):
        existing_items = []

    by_id: Dict[str, Dict[str, Any]] = {}
    for it in existing_items:
        if isinstance(it, dict) and _safe_text(it.get("id")):
            by_id[_safe_text(it.get("id"))] = it

    sources = cfg.get("sources") or []
    if not isinstance(sources, list):
        sources = []

    new_items: List[Dict[str, Any]] = []

    def tags_from_source(src: Dict[str, Any]) -> List[str]:
        tags = src.get("tags")
        if not isinstance(tags, list):
            return []
        out = []
        seen = set()
        for t2 in tags:
            txt = _safe_text(t2)
            if not txt or txt in seen:
                continue
            seen.add(txt)
            out.append(txt)
        return out

    def add_item(it: Dict[str, Any]) -> None:
        item_id = _safe_text(it.get("id") or "")
        if not item_id:
            return
        by_id[item_id] = it
        new_items.append(it)

    for src in sources:
        if not isinstance(src, dict):
            continue
        src_id = _t(src.get("id") or "")
        src_label = _safe_text(src.get("label") or src_id or "Source") or "Source"
        src_type = _t(src.get("type") or "").lower()
        kind = _t(src.get("kind") or "event").lower() or "event"
        lang = _t(src.get("lang") or "en").lower() or "en"
        base_tags = tags_from_source(src)

        if src_type == "manual":
            path = _t(src.get("path") or "")
            if not path:
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
            except Exception as e:
                print(f"WARN: Failed reading manual source {path}: {e}", file=sys.stderr)
                continue
            if not isinstance(raw, list):
                continue
            for ev in raw:
                if not isinstance(ev, dict):
                    continue
                title = _safe_text(ev.get("title") or "")
                if not title:
                    continue
                start_raw = _t(ev.get("start") or ev.get("startAt") or "")
                end_raw = _t(ev.get("end") or ev.get("endAt") or "")
                start_dt = _parse_iso_utc(start_raw)
                end_dt = _parse_iso_utc(end_raw)
                all_day = bool(ev.get("allDay")) if "allDay" in ev else True

                def parse_date_only(s: str) -> Optional[datetime]:
                    s = _t(s)
                    if not s:
                        return None
                    if re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", s):
                        try:
                            y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
                            return datetime(y, m, d, tzinfo=tz).astimezone(timezone.utc)
                        except Exception:
                            return None
                    return None

                if start_dt is None:
                    start_dt = parse_date_only(start_raw)
                if start_dt is None:
                    continue
                if end_dt is None:
                    end_dt = parse_date_only(end_raw)
                    if end_dt is not None and all_day:
                        # Manual end dates are treated as inclusive (more human-friendly).
                        end_dt = (end_dt.astimezone(tz) + timedelta(days=1)).astimezone(timezone.utc)
                if end_dt is None and all_day:
                    end_dt = (start_dt.astimezone(tz) + timedelta(days=1)).astimezone(timezone.utc)

                url = _safe_text(ev.get("url") or "")
                summary = _safe_text(ev.get("summary") or ev.get("description") or "")
                location = _safe_text(ev.get("location") or "")
                tags = []
                tags.extend(base_tags)
                ev_tags = ev.get("tags")
                if isinstance(ev_tags, list):
                    tags.extend([_safe_text(x) for x in ev_tags if _safe_text(x)])
                seen = set()
                tags = [x for x in tags if x and (x not in seen) and not seen.add(x)]

                stable_key = _safe_text(ev.get("uid") or url or title)
                item_id = _make_id(start_dt, title, src_id or kind, stable_key)
                sources_out = []
                if url:
                    sources_out.append({"name": src_label, "url": url})
                add_item(
                    {
                        "id": item_id,
                        "kind": kind,
                        "lang": lang,
                        "startAt": _iso(start_dt),
                        "endAt": _iso(end_dt) if end_dt else "",
                        "allDay": bool(all_day),
                        "title": title,
                        "summary": _truncate(summary, 320),
                        "location": location,
                        "tags": tags,
                        "sources": sources_out,
                    }
                )
            continue

        url = _t(src.get("url") or "")
        if not url:
            continue

        if src_type == "ical":
            try:
                raw = _fetch(url, timeout=int(args.timeout))
                text = raw.decode("utf-8", errors="replace")
                evs = _parse_ical_events(text, tz_name)
            except (HTTPError, URLError) as e:
                print(f"WARN: Failed fetching iCal {url}: {e}", file=sys.stderr)
                continue
            except Exception as e:
                print(f"WARN: Unexpected iCal error {url}: {type(e).__name__}: {e}", file=sys.stderr)
                continue

            for ev in evs:
                start_dt = ev.dtstart_utc
                if not start_dt:
                    continue
                title = _safe_text(ev.summary or "")
                if not title:
                    continue
                end_dt = ev.dtend_utc
                stable_key = _safe_text(ev.uid or ev.url or title)
                item_id = _make_id(start_dt, title, src_id or kind, stable_key)

                tags = []
                tags.extend(base_tags)
                tags.extend([_safe_text(x) for x in (ev.categories or []) if _safe_text(x)])
                seen = set()
                tags = [x for x in tags if x and (x not in seen) and not seen.add(x)]

                sources_out = []
                link = _safe_text(ev.url or "")
                if not link:
                    link = url
                if link:
                    sources_out.append({"name": src_label, "url": link})

                add_item(
                    {
                        "id": item_id,
                        "kind": kind,
                        "lang": lang,
                        "startAt": _iso(start_dt),
                        "endAt": _iso(end_dt) if end_dt else "",
                        "allDay": bool(ev.all_day),
                        "title": title,
                        "summary": _truncate(ev.description or "", 320),
                        "location": _safe_text(ev.location or ""),
                        "tags": tags,
                        "sources": sources_out,
                    }
                )
            continue

        if src_type == "rss":
            try:
                xml = _fetch(url, timeout=int(args.timeout))
                items = _parse_rss_or_atom(xml)
            except (HTTPError, URLError, ET.ParseError) as e:
                print(f"WARN: Failed fetching/parsing RSS {url}: {e}", file=sys.stderr)
                continue
            except Exception as e:
                print(f"WARN: Unexpected RSS error {url}: {type(e).__name__}: {e}", file=sys.stderr)
                continue

            max_per = int(src.get("maxItems") or 40)
            count = 0
            for it in items:
                if count >= max_per:
                    break
                if not isinstance(it, dict):
                    continue
                title = _safe_text(it.get("title") or "")
                if not title:
                    continue
                dt = it.get("published_at") or datetime.now(timezone.utc)
                if not isinstance(dt, datetime):
                    dt = datetime.now(timezone.utc)
                dt = dt.astimezone(timezone.utc)
                link = _safe_text(it.get("link") or "")
                summary = _safe_text(it.get("summary") or "")
                stable_key = link or title
                item_id = _make_id(dt, title, src_id or kind, stable_key)

                tags = list(base_tags)
                seen = set()
                tags = [x for x in tags if x and (x not in seen) and not seen.add(x)]

                sources_out = []
                if link:
                    sources_out.append({"name": src_label, "url": link})

                add_item(
                    {
                        "id": item_id,
                        "kind": kind or "update",
                        "lang": lang,
                        "startAt": _iso(dt),
                        "endAt": "",
                        "allDay": False,
                        "title": title,
                        "summary": _truncate(summary or title, 320),
                        "location": "",
                        "tags": tags,
                        "sources": sources_out,
                    }
                )
                count += 1
            continue

    # Filter to rolling window (local time).
    now_local = datetime.now(timezone.utc).astimezone(tz)
    start_bound_local = datetime.combine(now_local.date() - timedelta(days=int(args.days_past)), time(0, 0), tzinfo=tz)
    end_bound_local = datetime.combine(now_local.date() + timedelta(days=int(args.days_future) + 1), time(0, 0), tzinfo=tz)
    start_bound_utc = start_bound_local.astimezone(timezone.utc)
    end_bound_utc = end_bound_local.astimezone(timezone.utc)

    merged: List[Dict[str, Any]] = []
    for it in by_id.values():
        if not isinstance(it, dict):
            continue
        dt = _parse_iso_utc(_safe_text(it.get("startAt") or ""))
        if not dt:
            continue
        if dt < start_bound_utc or dt >= end_bound_utc:
            continue
        merged.append(it)

    merged = _dedupe_items(merged)

    # Sort oldest -> newest for calendar-like browsing; the UI can reverse as needed.
    merged.sort(key=lambda it: _safe_text(it.get("startAt") or ""))
    merged = merged[: max(1, int(args.max_items))]

    out = {"updatedAt": _now_utc_iso(), "items": merged}
    write_outputs(args.out_js, args.out_json, out)

    # Generate extra blog posts (daily digests).
    digests: List[Dict[str, Any]] = []
    backfill = max(0, int(args.digest_backfill))
    for i in range(backfill):
        d_local = (now_local.date() - timedelta(days=i))
        for lang in ("en", "es"):
            post = _digest_post_for_day(
                day_local=d_local,
                tz_name=tz_name,
                area_label=area_label,
                lang=lang,
                items=merged,
            )
            if post:
                digests.append(post)

    extra = {"updatedAt": _now_utc_iso(), "posts": digests}
    with open(args.out_extra_posts, "w", encoding="utf-8") as f:
        f.write(json.dumps(extra, ensure_ascii=False, indent=2))
        f.write("\n")

    print(
        f"OK: wrote {args.out_js} and {args.out_json} with {len(merged)} items (new={len(new_items)}), plus {args.out_extra_posts} with {len(digests)} digest posts."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

