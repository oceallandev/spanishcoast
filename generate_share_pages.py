#!/usr/bin/env python3
"""
Generate static share pages with per-item OpenGraph/Twitter meta tags.

Why:
- Social networks don't execute JS for link previews.
- Our main pages use query params/modals, so previews would otherwise be generic.

Outputs:
- share/listing/<REF>.html
- share/vehicle/<ID>.html
- share/blog/<POST_ID>.html

Run:
  python3 generate_share_pages.py
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode


ROOT = Path(__file__).resolve().parent


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return (
        text.replace("[amp,]", "&")
        .replace("[amp]", "&")
        .replace("[AMP,]", "&")
        .replace("[AMP]", "&")
        .replace("&amp,", "&")
    )


def _truncate(text: str, limit: int) -> str:
    t = re.sub(r"\s+", " ", _safe_text(text)).strip()
    if not t:
        return ""
    if len(t) <= limit:
        return t
    chunk = t[: max(0, int(limit))]
    if " " in chunk:
        chunk = chunk.rsplit(" ", 1)[0].strip()
    chunk = chunk.rstrip(" ,.;:")
    return chunk + "…"


def _detect_site_base() -> str:
    idx = ROOT / "index.html"
    if idx.exists():
        src = _read_text(idx)
        m = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', src, flags=re.IGNORECASE)
        if m:
            url = m.group(1).strip()
            url = url.rstrip("/")
            return url
    return "https://oceallandev.github.io/spanishcoast"


def _detect_version() -> str:
    sw = ROOT / "sw.js"
    if sw.exists():
        src = _read_text(sw)
        m = re.search(r"CACHE_NAME\s*=\s*'scp-cache-([^']+)'", src)
        if m:
            return m.group(1).strip()
    return "v1"


def _find_json_array(src: str, marker: str) -> List[Dict[str, Any]]:
    """
    Extract a JSON array literal that appears after a marker string.
    Assumes the array is JSON-compatible (double quotes, no JS expressions).
    """
    i = src.find(marker)
    if i < 0:
        return []

    j = src.find("[", i)
    if j < 0:
        return []

    depth = 0
    end = -1
    for k in range(j, len(src)):
        ch = src[k]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = k + 1
                break

    if end < 0:
        return []

    raw = src[j:end]
    # Defensive cleanup: strip trailing commas before closing braces/brackets.
    cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except Exception:
        return []
    return []


def _parse_window_array(path: Path, var_name: str) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    src = _read_text(path)
    # Support patterns:
    # - window.foo = [...]
    # - const items = [...]
    markers = [
        f"window.{var_name} =",
        f"const {var_name} =",
        f"const items =",
    ]
    for marker in markers:
        items = _find_json_array(src, marker)
        if items:
            return items
    return []


def _money_eur(amount: Any) -> str:
    try:
        n = float(amount)
    except Exception:
        return ""
    if not (n > 0):
        return ""
    if n >= 1_000_000:
        return f"€{n/1_000_000:.1f}M".replace(".0M", "M")
    return "€{:,.0f}".format(n).replace(",", ",")


def _built_area(item: Dict[str, Any]) -> Optional[int]:
    sa = item.get("surface_area")
    if isinstance(sa, dict):
        b = sa.get("built")
        try:
            n = int(float(b))
            return n if n > 0 else None
        except Exception:
            return None
    for k in ("built", "built_area", "area", "m2", "size"):
        try:
            n = int(float(item.get(k)))
            if n > 0:
                return n
        except Exception:
            pass
    return None


def _first_image(item: Dict[str, Any]) -> str:
    imgs = item.get("images")
    if isinstance(imgs, list) and imgs:
        for u in imgs:
            s = _safe_text(u)
            if s:
                return s
    for k in ("image", "img", "photo"):
        s = _safe_text(item.get(k))
        if s:
            return s
    return ""


def _weserv_og_image(url: str) -> str:
    u = _safe_text(url)
    if not u:
        return ""
    stripped = re.sub(r"^https?://", "", u, flags=re.IGNORECASE)
    qs = urlencode(
        {
            "url": stripped,
            "w": "1200",
            "h": "630",
            "fit": "cover",
            "q": "85",
            "output": "jpg",
        }
    )
    return f"https://images.weserv.nl/?{qs}"


def _write_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    prev = ""
    try:
        prev = path.read_text(encoding="utf-8")
    except Exception:
        prev = ""
    if prev == content:
        return
    path.write_text(content, encoding="utf-8")


def _escape_attr(text: str) -> str:
    return html.escape(_safe_text(text), quote=True)


def _share_page_shell(
    *,
    rel_prefix: str,
    version: str,
    title: str,
    description: str,
    canonical: str,
    og_title: str,
    og_description: str,
    og_image: str,
    body_html: str,
    og_type: str = "website",
) -> str:
    desc = _truncate(description or og_description, 200)
    og_desc = _truncate(og_description or description, 200)
    og_img = og_image or ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{_escape_attr(title)}</title>
  <meta name="description" content="{_escape_attr(desc)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="{_escape_attr(canonical)}">

  <meta property="og:type" content="{_escape_attr(og_type)}">
  <meta property="og:site_name" content="Spanish Coast Properties">
  <meta property="og:title" content="{_escape_attr(og_title)}">
  <meta property="og:description" content="{_escape_attr(og_desc)}">
  <meta property="og:url" content="{_escape_attr(canonical)}">
  <meta property="og:image" content="{_escape_attr(og_img)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{_escape_attr(og_title)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{_escape_attr(og_title)}">
  <meta name="twitter:description" content="{_escape_attr(og_desc)}">
  <meta name="twitter:image" content="{_escape_attr(og_img)}">

  <meta name="theme-color" content="#030712">
  <link rel="manifest" href="{rel_prefix}manifest.webmanifest?v={_escape_attr(version)}">
  <link rel="stylesheet" href="{rel_prefix}style.css?v={_escape_attr(version)}">
  <script defer src="{rel_prefix}i18n.js?v={_escape_attr(version)}"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="bg-mesh"></div>
  {body_html}
  <script defer src="{rel_prefix}site.js?v={_escape_attr(version)}"></script>
</body>
</html>
"""


def _listing_body_html(
    *,
    rel_prefix: str,
    ref: str,
    headline: str,
    town: str,
    province: str,
    price: str,
    beds: int,
    baths: int,
    built: Optional[int],
    img: str,
    snippet: str,
    listing_url: str,
    brochure_url: str,
    reel_url: str,
    whatsapp_url: str,
) -> str:
    chips = []
    if beds or baths:
        chips.append(f"<div class=\"modal-spec-item\">🛏️ {beds} · 🛁 {baths}</div>")
    if built:
        chips.append(f"<div class=\"modal-spec-item\">📐 {built} m2</div>")
    if price:
        chips.append(f"<div class=\"modal-spec-item\">💶 {html.escape(price)}</div>")

    chip_html = "\n".join(chips) if chips else "<div class=\"muted\">Key details inside</div>"

    safe_img = _escape_attr(img or f"{rel_prefix}assets/placeholder.png")
    safe_headline = html.escape(headline)
    safe_loc = html.escape(", ".join([x for x in [town, province] if x]))
    safe_snippet = html.escape(snippet)

    return f"""
  <header class="main-header glass sticky">
    <div class="header-inner">
      <div class="header-left">
        <div class="logo">
          <a href="{rel_prefix}index.html" aria-label="Spanish Coast Properties Home">
            <img src="{rel_prefix}assets/header-logo.png?v=2" alt="Spanish Coast Properties" class="main-logo">
          </a>
        </div>
        <div class="brand-info">
          <span class="brand-name">Spanish Coast Properties</span>
        </div>
      </div>
      <div class="header-right">
        <a class="header-cta" href="{rel_prefix}account.html">Account</a>
      </div>
    </div>
  </header>

  <main class="site-main" id="site-main">
    <section class="page-section catalog-section active" aria-label="Listing share page">
      <div class="catalog-hero">
        <h2 style="margin-bottom:0.35rem">{safe_headline}</h2>
        <p class="muted" style="margin-top:0;">Ref: {html.escape(ref)} · {safe_loc}</p>
        <div class="service-tags" aria-label="Key details">
          <span class="tag">{html.escape(price or 'Price on request')}</span>
          <span class="tag">{html.escape(town or 'Costa Blanca South')}</span>
        </div>
        <div class="simple-cta" style="margin-top:1rem;">
          <a class="cta-button" href="{_escape_attr(listing_url)}">Open listing</a>
          <a class="cta-button cta-button--outline" href="{_escape_attr(brochure_url)}" target="_blank" rel="noopener">Brochure (PDF)</a>
          <a class="cta-button cta-button--outline" href="{_escape_attr(reel_url)}" target="_blank" rel="noopener">Reel (Video)</a>
          <a class="cta-button cta-button--outline" href="{_escape_attr(whatsapp_url)}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>

      <article class="catalog-card" style="max-width:980px; margin:0 auto;">
        <div class="catalog-content">
          <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:1.2rem; align-items:start;">
            <div class="glass panel" style="padding:0; overflow:hidden; border-radius:18px;">
              <img src="{safe_img}" alt="{_escape_attr(headline)}" style="width:100%; height:320px; object-fit:cover; display:block"
                loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='{rel_prefix}assets/placeholder.png'">
            </div>
            <div class="glass panel" style="padding:1.05rem; border-radius:18px;">
              <div class="modal-specs" style="margin:0;">
                {chip_html}
              </div>
              <div class="divider" style="margin:0.95rem 0;"></div>
              <div class="catalog-meta" style="line-height:1.75;">{safe_snippet}</div>
              <div class="muted" style="margin-top:0.75rem; font-weight:900;">
                Tip: use Brochure (PDF) for a clean print-to-PDF, or Reel (Video) for Instagram/TikTok.
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </main>
"""


def _vehicle_body_html(
    *,
    rel_prefix: str,
    vid: str,
    title: str,
    deal: str,
    category: str,
    location: str,
    price: str,
    img: str,
    snippet: str,
    listing_url: str,
    whatsapp_url: str,
) -> str:
    safe_img = _escape_attr(img or f"{rel_prefix}assets/placeholder.png")
    safe_title = html.escape(title)
    safe_loc = html.escape(location)
    safe_snippet = html.escape(snippet)

    return f"""
  <header class="main-header glass sticky">
    <div class="header-inner">
      <div class="header-left">
        <div class="logo">
          <a href="{rel_prefix}index.html" aria-label="Spanish Coast Properties Home">
            <img src="{rel_prefix}assets/header-logo.png?v=2" alt="Spanish Coast Properties" class="main-logo">
          </a>
        </div>
        <div class="brand-info">
          <span class="brand-name">Spanish Coast Properties</span>
        </div>
      </div>
      <div class="header-right">
        <a class="header-cta" href="{rel_prefix}vehicles.html">Vehicles</a>
      </div>
    </div>
  </header>

  <main class="site-main" id="site-main">
    <section class="page-section catalog-section active" aria-label="Vehicle share page">
      <div class="catalog-hero">
        <h2 style="margin-bottom:0.35rem">{safe_title}</h2>
        <p class="muted" style="margin-top:0;">{html.escape(deal)} · {html.escape(category)} · {html.escape(vid)}</p>
        <div class="service-tags">
          <span class="tag">{html.escape(price or 'Price on request')}</span>
          <span class="tag">{safe_loc or 'Costa Blanca South'}</span>
        </div>
        <div class="simple-cta" style="margin-top:1rem;">
          <a class="cta-button" href="{_escape_attr(listing_url)}">Open vehicle</a>
          <a class="cta-button cta-button--outline" href="{_escape_attr(whatsapp_url)}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>

      <article class="catalog-card" style="max-width:980px; margin:0 auto;">
        <div class="catalog-content">
          <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:1.2rem; align-items:start;">
            <div class="glass panel" style="padding:0; overflow:hidden; border-radius:18px;">
              <img src="{safe_img}" alt="{_escape_attr(title)}" style="width:100%; height:320px; object-fit:cover; display:block"
                loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='{rel_prefix}assets/placeholder.png'">
            </div>
            <div class="glass panel" style="padding:1.05rem; border-radius:18px;">
              <div class="modal-specs" style="margin:0;">
                <div class="modal-spec-item">💶 {html.escape(price or 'Price on request')}</div>
                <div class="modal-spec-item">📍 {safe_loc or 'Costa Blanca South'}</div>
                <div class="modal-spec-item">📌 {html.escape(deal)}</div>
              </div>
              <div class="divider" style="margin:0.95rem 0;"></div>
              <div class="catalog-meta" style="line-height:1.75;">{safe_snippet}</div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </main>
"""


def _blog_body_html(
    *,
    rel_prefix: str,
    title: str,
    date_text: str,
    kind: str,
    excerpt: str,
    sections: List[Dict[str, Any]],
    sources: List[Dict[str, Any]],
    cta: str,
    open_url: str,
) -> str:
    safe_title = html.escape(title)
    safe_date = html.escape(date_text)
    pill = "Trends" if kind == "trend" else ("Local" if kind == "local" else "News")

    def render_sections() -> str:
        out: List[str] = []
        for sec in sections[:18]:
            st = _safe_text(sec.get("type"))
            if st == "h":
                out.append(f'<h3 class="blog-post-h">{html.escape(_safe_text(sec.get("text")))}</h3>')
            elif st == "p":
                out.append(f'<p class="blog-post-p">{html.escape(_safe_text(sec.get("text")))}</p>')
            elif st == "ul":
                items = sec.get("items")
                if isinstance(items, list) and items:
                    lis = "".join(f"<li>{html.escape(_safe_text(x))}</li>" for x in items[:12] if _safe_text(x))
                    out.append(f'<ul class="blog-post-ul">{lis}</ul>')
        return "\n".join(out)

    def render_sources() -> str:
        rows = []
        for s in sources[:8]:
            name = _safe_text(s.get("name") or s.get("url"))
            url = _safe_text(s.get("url"))
            if not url:
                continue
            rows.append(f'<li><a href="{_escape_attr(url)}" target="_blank" rel="noopener noreferrer">{html.escape(name)}</a></li>')
        if not rows:
            return ""
        return f"""
          <h3 class="blog-post-h">Sources</h3>
          <ul class="blog-post-ul">
            {''.join(rows)}
          </ul>
        """

    sec_html = render_sections()
    src_html = render_sources()
    safe_excerpt = html.escape(excerpt)
    safe_cta = html.escape(cta)

    return f"""
  <header class="main-header glass sticky">
    <div class="header-inner">
      <div class="header-left">
        <div class="logo">
          <a href="{rel_prefix}index.html" aria-label="Spanish Coast Properties Home">
            <img src="{rel_prefix}assets/header-logo.png?v=2" alt="Spanish Coast Properties" class="main-logo">
          </a>
        </div>
        <div class="brand-info">
          <span class="brand-name">Spanish Coast Properties</span>
        </div>
      </div>
      <div class="header-right">
        <a class="header-cta" href="{rel_prefix}blog.html">Blog</a>
      </div>
    </div>
  </header>

  <main class="site-main" id="site-main">
    <section class="page-section catalog-section active" aria-label="Blog post">
      <article class="glass panel blog-post" style="max-width:980px; margin:1.25rem auto; padding:1.5rem 1.5rem 1.8rem;">
        <div class="blog-post-top">
          <span class="blog-pill {html.escape(kind)}">{html.escape(pill)}</span>
          <div class="blog-post-date">{safe_date}</div>
        </div>
        <h1 class="blog-post-title">{safe_title}</h1>
        <p class="blog-post-excerpt">{safe_excerpt}</p>
        {sec_html}
        {src_html}
        <div class="blog-post-footer" style="margin-top:1.35rem;">
          <div class="blog-post-cta">{safe_cta}</div>
          <div class="blog-post-actions">
            <a class="view-toggle-btn" href="{_escape_attr(open_url)}">Open in app</a>
          </div>
        </div>
      </article>
    </section>
  </main>
"""


def _format_date_short(iso: str) -> str:
    s = _safe_text(iso)
    if not s:
        return ""
    # Keep it stable and language-neutral for share pages.
    try:
        # fromisoformat doesn't accept Z; normalize.
        s2 = s.replace("Z", "+00:00")
        from datetime import datetime

        dt = datetime.fromisoformat(s2)
        return dt.strftime("%d %b %Y")
    except Exception:
        return s[:10]


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate static share pages for listings/vehicles/blog posts.")
    ap.add_argument("--out-dir", default="share", help="Output folder (relative to repo root)")
    args = ap.parse_args()

    site_base = _detect_site_base()
    version = _detect_version()
    out_dir = ROOT / str(args.out_dir)

    # Load listing sources.
    base_property_items: List[Dict[str, Any]] = []
    data_js = ROOT / "data.js"
    if data_js.exists():
        base_property_items.extend(_parse_window_array(data_js, "propertyData"))

    inmovilla_items = _parse_window_array(ROOT / "inmovilla-listings.js", "items")
    newbuild_items = _parse_window_array(ROOT / "newbuilds-listings.js", "items")
    property_items: List[Dict[str, Any]] = base_property_items + inmovilla_items + newbuild_items

    business_items = _parse_window_array(ROOT / "businesses-data.js", "businessListings")
    vehicle_items = _parse_window_array(ROOT / "vehicles-data.js", "vehicleListings")

    # Cross-source classification helpers (refs may exist in more than one file).
    business_by_ref: Dict[str, Dict[str, Any]] = {}
    for b in business_items:
        r = _safe_text(b.get("ref")).strip().upper()
        if r:
            business_by_ref[r] = b

    business_ref_set = set(business_by_ref.keys())
    newbuild_ref_set = set(_safe_text(x.get("ref")).strip().upper() for x in newbuild_items if _safe_text(x.get("ref")))

    # Blog posts (optional).
    blog_posts = []
    blog_json = ROOT / "blog-posts.json"
    if blog_json.exists():
        try:
            raw = json.loads(_read_text(blog_json))
            posts = raw.get("posts") if isinstance(raw, dict) else None
            if isinstance(posts, list):
                blog_posts = [p for p in posts if isinstance(p, dict) and _safe_text(p.get("id"))]
        except Exception:
            blog_posts = []

    # Merge/dedupe listings by ref.
    by_ref: Dict[str, Dict[str, Any]] = {}

    def consider(item: Dict[str, Any]) -> None:
        ref = _safe_text(item.get("ref"))
        if not ref:
            return
        prev = by_ref.get(ref)
        if not prev:
            by_ref[ref] = item
            return
        # Prefer the one with more images/description.
        prev_score = len(prev.get("images") or []) + len(_safe_text(prev.get("description"))) // 50
        next_score = len(item.get("images") or []) + len(_safe_text(item.get("description"))) // 50
        if next_score >= prev_score:
            by_ref[ref] = item

    for it in property_items:
        consider(it)
    for it in business_items:
        consider(it)

    # Write listing share pages.
    for ref, it in sorted(by_ref.items(), key=lambda kv: kv[0]):
        ref_upper = _safe_text(ref).strip().upper()
        biz_item = business_by_ref.get(ref_upper)
        town = _safe_text(it.get("town") or "Costa Blanca South")
        province = _safe_text(it.get("province") or "Alicante")
        kind = _safe_text((biz_item or {}).get("kind") or it.get("kind"))
        biz_type = _safe_text((biz_item or {}).get("businessType") or (biz_item or {}).get("title") or it.get("businessType") or it.get("title"))
        p_type = _safe_text(it.get("type") or "Listing")
        headline_type = biz_type if biz_type else p_type
        if kind.lower() == "traspaso":
            headline_type = f"{headline_type} (Traspaso)"

        headline = f"{headline_type} in {town}, {province}".strip()
        price = _money_eur(it.get("price"))
        beds = int(float(it.get("beds") or 0) or 0)
        baths = int(float(it.get("baths") or 0) or 0)
        built = _built_area(it)
        img_raw = _first_image(it)
        og_img = (
            _weserv_og_image(img_raw)
            or _weserv_og_image(f"{site_base}/assets/placeholder.png")
            or f"{site_base}/assets/header-logo.png"
        )

        snippet = _truncate(it.get("description") or "", 240) or "Browse photos, brochure PDF, and request a viewing."

        share_path = f"share/listing/{ref}.html"
        canonical = f"{site_base}/{share_path}"
        source = _safe_text(it.get("source")).lower()
        is_new_build = ref_upper in newbuild_ref_set or bool(it.get("new_build")) or (source.startswith("redsp") and ref_upper.startswith("SCP-"))
        is_business = ref_upper in business_ref_set or bool(it.get("businessType")) or kind.lower() in ("business", "traspaso")

        if is_new_build:
            listing_url = f"{site_base}/new-builds.html?ref={ref}"
        else:
            # properties.html is the universal deep-link entry that opens the full detail modal.
            listing_url = f"{site_base}/properties.html?ref={ref}"
        brochure_url = f"{site_base}/brochure.html?ref={ref}"
        reel_url = f"{site_base}/reel.html?ref={ref}"
        wa_text = _truncate(f"{headline}\n{price or ''}\nRef: {ref}\n{canonical}", 900)
        whatsapp_url = f"https://wa.me/?{urlencode({'text': wa_text})}"

        og_title = f"{price} · {headline}" if price else headline
        spec_bits = []
        if beds or baths:
            spec_bits.append(f"{beds} bed · {baths} bath")
        if built:
            spec_bits.append(f"{built} m2")
        if ref:
            spec_bits.append(ref)
        og_desc = " · ".join([b for b in spec_bits if b]).strip()
        if og_desc:
            og_desc = f"{og_desc}. {snippet}"
        else:
            og_desc = snippet

        body = _listing_body_html(
            rel_prefix="../../",
            ref=ref,
            headline=headline_type,
            town=town,
            province=province,
            price=price,
            beds=beds,
            baths=baths,
            built=built,
            img=img_raw,
            snippet=snippet,
            listing_url=listing_url,
            brochure_url=brochure_url,
            reel_url=reel_url,
            whatsapp_url=whatsapp_url,
        )

        html_text = _share_page_shell(
            rel_prefix="../../",
            version=version,
            title=f"{og_title} | Spanish Coast Properties",
            description=og_desc,
            canonical=canonical,
            og_title=og_title,
            og_description=og_desc,
            og_image=og_img,
            body_html=body,
            og_type="website",
        )
        _write_if_changed(out_dir / "listing" / f"{ref}.html", html_text)

    # Vehicles.
    for it in vehicle_items:
        vid = _safe_text(it.get("id"))
        if not vid:
            continue
        title = _safe_text(it.get("title") or "Vehicle")
        deal = _safe_text(it.get("deal") or "offer").capitalize()
        category = "Boat" if _safe_text(it.get("category")).lower() == "boat" else "Car"
        location = _safe_text(it.get("location") or "Costa Blanca South")

        price = ""
        try:
            n = float(it.get("price") or 0)
            if n > 0:
                cur = _safe_text(it.get("currency") or "EUR")
                if cur == "EUR":
                    price = _money_eur(n)
                else:
                    price = f"{n:.0f} {cur}"
                period = _safe_text(it.get("pricePeriod"))
                if period:
                    price = f"{price}/{period}"
        except Exception:
            price = ""

        img_raw = _first_image(it)
        og_img = (
            _weserv_og_image(img_raw)
            or _weserv_og_image(f"{site_base}/assets/placeholder.png")
            or f"{site_base}/assets/header-logo.png"
        )
        snippet = _truncate(it.get("description") or "", 240) or "Request details and we will respond fast."

        share_path = f"share/vehicle/{vid}.html"
        canonical = f"{site_base}/{share_path}"
        listing_url = f"{site_base}/vehicles.html?id={vid}"
        wa_text = _truncate(f"{title}\n{price or ''}\n{location}\n{canonical}", 900)
        whatsapp_url = f"https://wa.me/?{urlencode({'text': wa_text})}"

        og_title = f"{price} · {title}" if price else title
        og_desc = _truncate(f"{deal} · {category} · {location}. {snippet}", 200)

        body = _vehicle_body_html(
            rel_prefix="../../",
            vid=vid,
            title=title,
            deal=deal,
            category=category,
            location=location,
            price=price,
            img=img_raw,
            snippet=snippet,
            listing_url=listing_url,
            whatsapp_url=whatsapp_url,
        )

        html_text = _share_page_shell(
            rel_prefix="../../",
            version=version,
            title=f"{og_title} | Spanish Coast Properties",
            description=og_desc,
            canonical=canonical,
            og_title=og_title,
            og_description=og_desc,
            og_image=og_img,
            body_html=body,
            og_type="website",
        )
        _write_if_changed(out_dir / "vehicle" / f"{vid}.html", html_text)

    # Blog posts.
    for p in blog_posts:
        pid = _safe_text(p.get("id"))
        if not pid:
            continue
        kind = _safe_text(p.get("kind") or "news")
        title = _safe_text(p.get("title") or "Post")
        excerpt = _truncate(p.get("excerpt") or "", 240) or _truncate(title, 240)
        date_text = _format_date_short(_safe_text(p.get("publishedAt")))

        share_path = f"share/blog/{pid}.html"
        canonical = f"{site_base}/{share_path}"
        open_url = f"{site_base}/blog.html?id={pid}"
        og_img = _weserv_og_image(f"{site_base}/assets/placeholder.png") or f"{site_base}/assets/header-logo.png"

        og_title = title
        og_desc = _truncate(excerpt, 200)
        body = _blog_body_html(
            rel_prefix="../../",
            title=title,
            date_text=date_text,
            kind=kind,
            excerpt=excerpt,
            sections=p.get("sections") if isinstance(p.get("sections"), list) else [],
            sources=p.get("sources") if isinstance(p.get("sources"), list) else [],
            cta=_safe_text(p.get("cta") or ""),
            open_url=open_url,
        )

        html_text = _share_page_shell(
            rel_prefix="../../",
            version=version,
            title=f"{og_title} | Spanish Coast Properties",
            description=og_desc,
            canonical=canonical,
            og_title=og_title,
            og_description=og_desc,
            og_image=og_img,
            body_html=body,
            og_type="article",
        )
        _write_if_changed(out_dir / "blog" / f"{pid}.html", html_text)

    print(
        f"OK: share pages generated. listings={len(by_ref)} vehicles={len(vehicle_items)} blog={len(blog_posts)} -> {out_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
