import argparse
import hashlib
import html
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.error import URLError, HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


USER_AGENT = "SpanishCoastPropertiesBlogSync/1.0 (+https://oceallandev.github.io/spanishcoast/)"


def _now_utc_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _fold(s: str) -> str:
    s = str(s or "")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower()


def _strip_html(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(str(s))
    s = re.sub(r"<script\\b[^>]*>.*?</script>", " ", s, flags=re.IGNORECASE | re.DOTALL)
    s = re.sub(r"<style\\b[^>]*>.*?</style>", " ", s, flags=re.IGNORECASE | re.DOTALL)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\\s+", " ", s).strip()
    return s


def _safe_text(s: str) -> str:
    s = _strip_html(s)
    s = re.sub(r"\\s+", " ", s).strip()
    return s


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


def _slugify(s: str) -> str:
    s = _fold(s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    s = re.sub(r"-{2,}", "-", s)
    return s or "post"


def _iter_tag(root, tag_name: str):
    for el in root.iter():
        t = el.tag or ""
        if t == tag_name or t.endswith("}" + tag_name):
            yield el


def _find_child_text(el, tag_name: str) -> str:
    for child in el:
        t = child.tag or ""
        if t == tag_name or t.endswith("}" + tag_name):
            return child.text or ""
    return ""


def _parse_date(s: str):
    s = (s or "").strip()
    if not s:
        return None
    # RSS pubDate
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc)
    except Exception:
        pass
    # Atom updated/published iso
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _fetch(url: str, timeout: int = 18) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _parse_rss_or_atom(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    tag = (root.tag or "").lower()
    is_atom = tag.endswith("feed") or tag.endswith("}feed")

    items = []

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
            published_at = _parse_date(date_raw)
            summary = _safe_text(_find_child_text(entry, "summary") or _find_child_text(entry, "content"))
            items.append(
                {
                    "title": title,
                    "link": link,
                    "published_at": published_at,
                    "summary": summary,
                    "raw": entry,
                }
            )
    else:
        for item in _iter_tag(root, "item"):
            title = _safe_text(_find_child_text(item, "title"))
            link = _safe_text(_find_child_text(item, "link"))
            date_raw = _find_child_text(item, "pubDate") or _find_child_text(item, "date") or _find_child_text(item, "published")
            published_at = _parse_date(date_raw)
            summary = _safe_text(_find_child_text(item, "description"))
            items.append(
                {
                    "title": title,
                    "link": link,
                    "published_at": published_at,
                    "summary": summary,
                    "raw": item,
                }
            )

    return items


def _looks_relevant(text: str, lang: str) -> bool:
    # Keep this conservative to avoid spammy, off-topic posts from broad trends.
    folded = _fold(text)

    tokens = set(re.findall(r"[a-z0-9]+", folded))

    phrases = [
        "costa blanca",
        "costa del sol",
        "real estate",
        "property market",
        "new build",
        "obra nueva",
        "interest rate",
        "mortgage rate",
        "holiday rental",
        "licencia apertura",
        "licencia de apertura",
    ]

    words = [
        # Places
        "alicante",
        "torrevieja",
        "orihuela",
        "guardamar",
        "benidorm",
        "valencia",
        "murcia",
        "spain",
        "espana",
        # Property
        "property",
        "housing",
        "realty",
        "inmobiliaria",
        "inmobiliario",
        "inmobili",
        "vivienda",
        "casa",
        "piso",
        "apartamento",
        "villa",
        # Business/licences
        "business",
        "negocio",
        "traspaso",
        "commercial",
        "licence",
        "license",
        "licencia",
        "apertura",
        "permiso",
        "permits",
        # Money/rentals
        "mortgage",
        "hipoteca",
        "euribor",
        "rent",
        "rental",
        "alquiler",
        "arrendamiento",
        # Travel
        "tourism",
        "turismo",
        "airport",
        "aeropuerto",
        "flight",
        "vuelo",
        "hotel",
        # Vehicles
        "car",
        "coche",
        "vehicle",
        "vehiculo",
        "boat",
        "barco",
        "nautica",
    ]

    if any(p in folded for p in phrases):
        return True

    return any(w in tokens for w in words)


def _classify(headline: str, lang: str):
    folded = _fold(headline)
    tokens = set(re.findall(r"[a-z0-9]+", folded))

    def has_phrase(s: str) -> bool:
        return s in folded

    def has_word(w: str) -> bool:
        return w in tokens

    if (
        has_word("mortgage")
        or has_word("euribor")
        or has_word("hipoteca")
        or has_phrase("interest rate")
        or has_phrase("tipo de interes")
        or has_phrase("tipo de interes")
        or has_word("banco")
        or has_word("loan")
    ):
        return "mortgage"
    if (
        has_word("tourism")
        or has_word("turismo")
        or has_word("airport")
        or has_word("aeropuerto")
        or has_word("flight")
        or has_word("vuelo")
        or has_word("airline")
        or has_word("hotel")
    ):
        return "tourism"
    if (
        has_word("licence")
        or has_word("license")
        or has_word("licencia")
        or has_word("apertura")
        or has_word("permiso")
        or has_word("urbanismo")
        or has_word("planning")
    ):
        return "licences"
    if (
        has_phrase("new build")
        or has_phrase("obra nueva")
        or has_word("development")
        or has_word("promoter")
        or has_word("construction")
        or has_word("construccion")
    ):
        return "newbuild"
    if (
        has_word("traspaso")
        or has_word("business")
        or has_word("negocio")
        or has_word("commercial")
        or has_word("restaurant")
        or has_word("bar")
        or has_word("shop")
    ):
        return "business"
    if (
        has_word("car")
        or has_word("coche")
        or has_word("vehicle")
        or has_word("vehiculo")
        or has_word("boat")
        or has_word("barco")
    ):
        return "vehicles"
    return "market"


def _content_for_category(category: str, lang: str):
    # Short, original templates. No article text copying.
    if lang == "es":
        why_h = "Por qué importa"
        next_h = "Qué hacer ahora"
        if category == "mortgage":
            why = [
                "Las condiciones de financiación cambian lo que la gente puede permitirse y la velocidad de las operaciones.",
                "La preaprobación reduce riesgos y te permite actuar rápido cuando aparece la vivienda correcta."
            ]
            nxt = [
                "Si vas a comprar: define presupuesto real (entrada + gastos) y confirma opciones de hipoteca antes de reservar.",
                "Si vas a vender: prepara documentación y una presentación impecable para atraer compradores solventes."
            ]
            tags = ["Hipotecas", "Financiación"]
        elif category == "tourism":
            why = [
                "Turismo y vuelos suelen influir en la demanda de alquiler vacacional y en negocios con traspaso.",
                "Cambios en temporada alta pueden afectar precios, ocupación y rentabilidad."
            ]
            nxt = [
                "Si buscas inversión: revisa normativa local y calcula escenarios conservadores (ocupación y costes).",
                "Si quieres operar un negocio: asegúrate de licencias y permisos antes de firmar."
            ]
            tags = ["Turismo", "Alquiler"]
        elif category == "licences":
            why = [
                "Una licencia correcta es la diferencia entre abrir sin problemas o tener retrasos y sanciones.",
                "Los requisitos varían según actividad, local y normativa municipal."
            ]
            nxt = [
                "Si compras un negocio: verifica licencias, contratos y si la actividad esta regularizada.",
                "Si necesitas ayuda: colaboramos con arquitectos para gestionar licencias de apertura y cambios."
            ]
            tags = ["Licencias", "Negocios"]
        elif category == "newbuild":
            why = [
                "Obra nueva puede cambiar la oferta en zonas concretas y afectar precios por barrio.",
                "Plazos de entrega, calidades y garantías son clave para comparar desarrollos."
            ]
            nxt = [
                "Pide una lista corta por zona, presupuesto y fechas de entrega.",
                "Confirma que el precio incluye IVA, extras y costes de compra."
            ]
            tags = ["Obra nueva", "Desarrollos"]
        elif category == "business":
            why = [
                "En traspasos, lo importante es la claridad: que se incluye, que se transfiere y que obligaciones quedan.",
                "Licencias, contratos y proveedores determinan si el negocio puede operar desde el día 1."
            ]
            nxt = [
                "Revisa el contrato de arrendamiento y la situación de licencias antes de reservar.",
                "Si quieres, te ayudamos a filtrar oportunidades y coordinar el proceso."
            ]
            tags = ["Negocios", "Traspaso"]
        elif category == "vehicles":
            why = [
                "En vehículos, la documentación y el estado real mandan más que el precio anunciado.",
                "Una entrega clara evita sorpresas (ITV, seguro, historial, titularidad)."
            ]
            nxt = [
                "Define uso y presupuesto, y pide hasta 3 cotizaciones si quieres vender.",
                "Comprueba documentación antes de cerrar."
            ]
            tags = ["Vehículos", "Coches/Barcos"]
        else:
            why = [
                "Las noticias del mercado suelen reflejar cambios en demanda, oferta y negociación.",
                "Lo que pasa en España impacta distinto según zona: Costa Blanca Sur es muy local."
            ]
            nxt = [
                "Si compras: compara por precio, m2, distancia a playa y gastos de comunidad.",
                "Si vendes: prepara fotos y documentación para acelerar visitas y ofertas."
            ]
            tags = ["Mercado", "Costa Blanca"]

        return why_h, why, next_h, nxt, tags

    # English
    why_h = "Why it matters"
    next_h = "What to do next"

    if category == "mortgage":
        why = [
            "Financing conditions change affordability and how quickly buyers can move.",
            "Pre-approval reduces risk and helps you act fast when the right listing appears."
        ]
        nxt = [
            "If you are buying: confirm your real budget (deposit + costs) and financing options before reserving.",
            "If you are selling: prepare paperwork and presentation so qualified buyers can commit quickly."
        ]
        tags = ["Mortgage", "Finance"]
    elif category == "tourism":
        why = [
            "Tourism and flight capacity often feed into holiday-rental demand and business turnover.",
            "Seasonal shifts can affect pricing, occupancy, and the numbers behind an investment."
        ]
        nxt = [
            "If investing: validate local rules and model conservative occupancy and costs.",
            "If buying a business: verify licences and operational requirements before signing."
        ]
        tags = ["Tourism", "Rentals"]
    elif category == "licences":
        why = [
            "Correct licensing is the difference between opening smoothly and facing delays or fines.",
            "Requirements vary by activity, premises, and local council rules."
        ]
        nxt = [
            "If buying a business: verify licences and contract details before committing.",
            "If you need help: we coordinate with architects on apertura/activity licences and changes."
        ]
        tags = ["Licences", "Business"]
    elif category == "newbuild":
        why = [
            "New-build supply can affect pricing locally (street by street), not just “the market”.",
            "Delivery timelines, specs, and warranties matter more than glossy renders."
        ]
        nxt = [
            "Ask for a shortlist by area, budget, and delivery window.",
            "Confirm what is included (VAT, extras, and purchase costs)."
        ]
        tags = ["New Builds", "Developments"]
    elif category == "business":
        why = [
            "In Spain, business transfers succeed on clarity: what is included, what transfers, and what stays.",
            "Licences, lease terms, and suppliers determine if you can operate from day one."
        ]
        nxt = [
            "Check the lease and licences before paying deposits or signing.",
            "If you want, we can screen opportunities and coordinate the steps."
        ]
        tags = ["Business", "Traspaso"]
    elif category == "vehicles":
        why = [
            "For vehicles, paperwork and real condition matter more than the advertised price.",
            "A clean handover avoids surprises (ITV, insurance, ownership, history)."
        ]
        nxt = [
            "Define your use case and budget, and ask for up to 3 quotations if you are selling.",
            "Verify documents before finalising."
        ]
        tags = ["Vehicles", "Cars/Boats"]
    else:
        why = [
            "Market headlines often hint at demand, supply, or negotiation shifts.",
            "What happens nationally plays out differently locally: Costa Blanca South is very micro-market driven."
        ]
        nxt = [
            "If buying: compare by price, sqm, beach distance, and community fees.",
            "If selling: clean photos and paperwork usually beat small price tweaks for speed."
        ]
        tags = ["Market", "Costa Blanca"]

    return why_h, why, next_h, nxt, tags


def _make_id(published_at: datetime, title: str, source_id: str, link: str) -> str:
    day = (published_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    slug = _slugify(title)[:60]
    h = hashlib.sha1(((link or "") + "|" + title + "|" + source_id).encode("utf-8")).hexdigest()[:8]
    return f"{day}-{slug}-{h}"


def _news_post_from_item(item: dict, source: dict):
    lang = (source.get("lang") or "en").strip().lower()
    title_raw = _safe_text(item.get("title") or "")
    link = _safe_text(item.get("link") or "")
    summary = _safe_text(item.get("summary") or "")
    published_at_dt = item.get("published_at") or datetime.now(timezone.utc)
    published_at = published_at_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    # Google News titles often look like: "Headline - Source"
    source_name = source.get("label") or ""
    headline = title_raw
    if " - " in title_raw:
        parts = title_raw.rsplit(" - ", 1)
        if len(parts) == 2 and len(parts[0]) > 8:
            headline = parts[0].strip()
            source_name = parts[1].strip() or source_name

    category = _classify(headline, lang)
    why_h, why_items, next_h, next_items, cat_tags = _content_for_category(category, lang)

    tags = []
    tags.extend(source.get("tags") or [])
    tags.extend(cat_tags or [])
    # De-dupe while keeping order
    seen = set()
    tags = [t for t in tags if (t and (t not in seen) and not seen.add(t))]

    excerpt = summary
    if not excerpt:
        excerpt = headline
    excerpt = _truncate(excerpt, 220)

    post_id = _make_id(published_at_dt, headline, source.get("id") or "news", link)

    intro = ""
    if lang == "es":
        intro = "Resumen breve basado en un titular público. Aquí tienes lo más útil para Costa Blanca Sur."
    else:
        intro = "A short, practical take based on a public headline, focused on Costa Blanca South."

    cta = ""
    if lang == "es":
        cta = "¿Quieres una lista corta? Spanish Coast Properties puede filtrar opciones y enviarte un catálogo limpio según tu presupuesto y zona."
    else:
        cta = "Want a shortlist? Spanish Coast Properties can filter options and send a clean catalog based on your budget and area."

    sources = []
    if link:
        sources.append({"name": source_name or "Source", "url": link})

    return {
        "id": post_id,
        "kind": "news",
        "lang": lang,
        "publishedAt": published_at,
        "title": headline,
        "excerpt": excerpt,
        "tags": tags,
        "sections": [
            {"type": "p", "text": intro},
            {"type": "h", "text": why_h},
            {"type": "ul", "items": why_items},
            {"type": "h", "text": next_h},
            {"type": "ul", "items": next_items},
        ],
        "sources": sources,
        "cta": cta,
    }


def _trend_post_from_item(item: dict, source: dict):
    lang = (source.get("lang") or "en").strip().lower()
    title = _safe_text(item.get("title") or "")
    link = _safe_text(item.get("link") or "")
    published_at_dt = item.get("published_at") or datetime.now(timezone.utc)
    published_at = published_at_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    # Google Trends extra fields
    approx = ""
    news_items = []
    raw = item.get("raw")
    if raw is not None:
        for child in raw.iter():
            tag = child.tag or ""
            if tag.endswith("approx_traffic"):
                approx = _safe_text(child.text or "")
            if tag.endswith("news_item"):
                title_el = None
                url_el = None
                src_el = None
                for c2 in child:
                    t2 = c2.tag or ""
                    if t2.endswith("news_item_title"):
                        title_el = c2
                    elif t2.endswith("news_item_url"):
                        url_el = c2
                    elif t2.endswith("news_item_source"):
                        src_el = c2
                ni_title = _safe_text(title_el.text if title_el is not None else "")
                ni_url = _safe_text(url_el.text if url_el is not None else "")
                ni_src = _safe_text(src_el.text if src_el is not None else "")
                if ni_title and ni_url:
                    news_items.append({"name": ni_src or ni_title, "url": ni_url, "title": ni_title})

    if not _looks_relevant(title, lang):
        return None

    category = _classify(title, lang)
    why_h, why_items, next_h, next_items, cat_tags = _content_for_category(category, lang)

    tags = []
    tags.extend(source.get("tags") or [])
    tags.extend(cat_tags or [])
    seen = set()
    tags = [t for t in tags if (t and (t not in seen) and not seen.add(t))]

    traffic_line = ""
    if approx:
        if lang == "es":
            traffic_line = f"Tendencia (aprox.): {approx} búsquedas."
        else:
            traffic_line = f"Trend volume (approx.): {approx} searches."

    intro = ""
    if lang == "es":
        intro = f"Tendencia del día: {title}. {traffic_line}".strip()
    else:
        intro = f"Trending today: {title}. {traffic_line}".strip()

    cta = ""
    if lang == "es":
        cta = "Si esta tendencia se relaciona con tu plan (comprar, invertir o abrir un negocio), Spanish Coast Properties puede ayudarte con una estrategia clara y una lista corta."
    else:
        cta = "If this trend overlaps with your plan (buying, investing, or opening a business), Spanish Coast Properties can help with a clear plan and a shortlist."

    sources = []
    if link:
        sources.append({"name": source.get("label") or "Google Trends", "url": link})
    for ni in news_items[:3]:
        sources.append({"name": ni.get("title") or ni.get("name") or "Related", "url": ni.get("url")})

    post_id = _make_id(published_at_dt, title, source.get("id") or "trend", link)

    sections = [
        {"type": "p", "text": intro},
        {"type": "h", "text": why_h},
        {"type": "ul", "items": why_items},
        {"type": "h", "text": next_h},
        {"type": "ul", "items": next_items},
    ]

    return {
        "id": post_id,
        "kind": "trend",
        "lang": lang,
        "publishedAt": published_at,
        "title": title,
        "excerpt": _truncate(traffic_line or title, 220),
        "tags": tags,
        "sections": sections,
        "sources": sources,
        "cta": cta,
    }


def load_existing(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"updatedAt": "", "posts": []}


def load_extra_posts(path: str) -> list:
    """
    Load additional post objects from a JSON file.

    Accepted shapes:
    - [{"id": "...", ...}, ...]
    - {"posts": [{"id": "...", ...}, ...]}
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        return []

    posts = None
    if isinstance(raw, dict):
        posts = raw.get("posts")
    elif isinstance(raw, list):
        posts = raw

    if not isinstance(posts, list):
        return []
    return [p for p in posts if isinstance(p, dict)]


def write_outputs(out_js: str, out_json: str, data: dict):
    json_text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False)
    with open(out_json, "w", encoding="utf-8") as f:
        f.write(json_text)
        f.write("\n")

    with open(out_js, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated content. Do not edit by hand. */\n")
        f.write("globalThis.SCP_BLOG = ")
        f.write(json_text)
        f.write(";\n")


def _post_source_name(post: dict) -> str:
    if not isinstance(post, dict):
        return ""
    sources = post.get("sources")
    if not isinstance(sources, list) or not sources:
        return ""
    first = sources[0] if isinstance(sources[0], dict) else {}
    return _safe_text(first.get("name") or "")


def _post_source_host(post: dict) -> str:
    if not isinstance(post, dict):
        return ""
    sources = post.get("sources")
    if not isinstance(sources, list) or not sources:
        return ""
    first = sources[0] if isinstance(sources[0], dict) else {}
    raw = _safe_text(first.get("url") or "")
    if not raw:
        return ""
    try:
        host = (urlsplit(raw).hostname or "").lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _post_quality_score(post: dict) -> int:
    if not isinstance(post, dict):
        return 0
    sections = post.get("sections")
    tags = post.get("tags")
    sources = post.get("sources")
    excerpt = _safe_text(post.get("excerpt") or "")
    cta = _safe_text(post.get("cta") or "")
    return (
        (len(sections) if isinstance(sections, list) else 0) * 30
        + (len(sources) if isinstance(sources, list) else 0) * 10
        + (len(tags) if isinstance(tags, list) else 0) * 4
        + len(excerpt)
        + len(cta)
    )


def _post_dedupe_signature(post: dict) -> str:
    if not isinstance(post, dict):
        return ""
    title = _slugify(_safe_text(post.get("title") or ""))
    if not title:
        return ""
    kind = _slugify(_safe_text(post.get("kind") or "news"))
    lang = _slugify(_safe_text(post.get("lang") or ""))
    source = _slugify(_post_source_name(post) or _post_source_host(post) or "")
    day = _safe_text(post.get("publishedAt") or "")[:10]
    return "|".join([kind, lang, title, source, day])


def _dedupe_posts(posts: list) -> list:
    if not isinstance(posts, list) or not posts:
        return []
    best_by_key = {}
    order = []
    seen_ids = set()

    for p in posts:
        if not isinstance(p, dict):
            continue
        post_id = _safe_text(p.get("id") or "")
        if post_id:
            if post_id in seen_ids:
                continue
            seen_ids.add(post_id)

        key = _post_dedupe_signature(p)
        if not key:
            key = f"fallback|{post_id}|{_slugify(_safe_text(p.get('title') or ''))}|{_safe_text(p.get('publishedAt') or '')[:10]}"

        existing = best_by_key.get(key)
        if existing is None:
            best_by_key[key] = p
            order.append(key)
            continue

        if _post_quality_score(p) > _post_quality_score(existing):
            best_by_key[key] = p

    return [best_by_key[k] for k in order if k in best_by_key]


def main():
    ap = argparse.ArgumentParser(description="Sync blog content from RSS + Google Trends into static files.")
    ap.add_argument("--sources", default="blog-sources.json", help="Path to blog-sources.json")
    ap.add_argument("--out-js", default="blog-posts.js", help="Output JS file (globalThis.SCP_BLOG = ...)")
    ap.add_argument("--out-json", default="blog-posts.json", help="Output JSON file")
    ap.add_argument("--max-posts", type=int, default=80, help="Max posts to keep (across all languages)")
    ap.add_argument("--max-per-feed", type=int, default=10, help="Max items to pull per feed")
    ap.add_argument(
        "--extra-posts",
        action="append",
        default=[],
        help="Path to JSON file containing extra post objects (array or {posts:[...]}). Can be passed multiple times.",
    )
    args = ap.parse_args()

    try:
        with open(args.sources, "r", encoding="utf-8") as f:
            sources = json.load(f) or {}
    except Exception as e:
        print(f"ERROR: Could not read sources file: {e}", file=sys.stderr)
        return 2

    existing = load_existing(args.out_json)
    existing_posts = existing.get("posts") if isinstance(existing, dict) else []
    if not isinstance(existing_posts, list):
        existing_posts = []

    by_id = {}
    for p in existing_posts:
        if isinstance(p, dict) and p.get("id"):
            by_id[str(p["id"])] = p

    # Merge in extra posts first (they can still be overwritten later by feed sync).
    for extra_path in (args.extra_posts or []):
        for p in load_extra_posts(str(extra_path)):
            if isinstance(p, dict) and p.get("id"):
                by_id[str(p["id"])] = p

    new_posts = []

    def sync_feed(feed: dict, kind: str):
        url = feed.get("url") or ""
        if not url:
            return
        try:
            xml = _fetch(url)
            items = _parse_rss_or_atom(xml)
        except (HTTPError, URLError, ET.ParseError) as e:
            print(f"WARN: Failed fetching/parsing {url}: {e}", file=sys.stderr)
            return
        except Exception as e:
            print(f"WARN: Unexpected error {url}: {type(e).__name__}: {e}", file=sys.stderr)
            return

        count = 0
        for item in items:
            if count >= args.max_per_feed:
                break

            if not isinstance(item, dict):
                continue
            title = _safe_text(item.get("title") or "")
            if not title:
                continue

            # Keep trends conservative; news feeds are already pre-filtered by query.
            if kind == "trend":
                post = _trend_post_from_item(item, feed)
                if not post:
                    continue
            else:
                post = _news_post_from_item(item, feed)

            if not post or not post.get("id"):
                continue

            # Overwrite existing entries so improvements to templates/logic apply immediately.
            by_id[post["id"]] = post
            new_posts.append(post)
            count += 1

    for feed in sources.get("news", []) or []:
        if isinstance(feed, dict):
            sync_feed(feed, "news")

    for feed in sources.get("trends", []) or []:
        if isinstance(feed, dict):
            sync_feed(feed, "trend")

    # Merge + keep most recent.
    merged = []
    for p in by_id.values():
        if not isinstance(p, dict):
            continue
        if not p.get("id") or not p.get("title"):
            continue
        if p.get("kind") == "trend":
            # Defensive: avoid false positives if relevance rules change over time.
            try:
                if not _looks_relevant(str(p.get("title") or ""), str(p.get("lang") or "")):
                    continue
            except Exception:
                continue
        merged.append(p)
    merged.sort(key=lambda p: str(p.get("publishedAt") or ""), reverse=True)

    merged = _dedupe_posts(merged)
    merged = merged[: max(1, int(args.max_posts))]

    out = {
        "updatedAt": _now_utc_iso(),
        "posts": merged,
    }

    write_outputs(args.out_js, args.out_json, out)

    print(f"OK: wrote {args.out_js} and {args.out_json} with {len(merged)} posts (new={len(new_posts)}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
