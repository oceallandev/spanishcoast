# Local Intel (Events, Fiestas, Holidays, Local Updates)

This repo can auto-publish local events and useful tourist/client info daily, without a backend.

## What It Does

- Pulls from public sources (RSS/Atom + iCal + manual JSON).
- Writes static data files:
  - `local-intel.json`
  - `local-intel.js` (`globalThis.SCP_LOCAL_INTEL = {...}`)
- Generates daily "Local" digest posts (EN + ES) for the last 15 days:
  - `local-intel-posts.json`
  - merged into the blog via `sync_blog_content.py --extra-posts ...`
- UI:
  - `blog.html` gets a new **Type: Local** filter (15-day daily digests)
  - `events.html` is a browseable "calendar-style" list (range filters)

## Key Files

- Sources config: `local-intel-sources.json`
- Manual seed events: `local-intel-manual.json`
- Sync script: `sync_local_intel.py`
- Blog merger support: `sync_blog_content.py` (`--extra-posts`)
- UI: `events.html`, `events.js`

## Adding Sources

Open `local-intel-sources.json` and add entries to `sources[]`.

Supported `type` values:

- `ical` (recommended for holidays/events): set `url` to a `.ics` file
- `rss`: set `url` to an RSS/Atom feed
- `manual`: set `path` to a JSON file (array of objects)

Common patterns:

- Town hall / tourism "agenda" calendars often provide `.ics` exports.
- Google Alerts can be used via RSS (Google Alerts UI lets you pick RSS; paste the RSS URL as a `rss` source).
- Google News RSS search is a decent fallback when there is no calendar feed.

## Google Alerts (RSS) Setup

1. Open Google Alerts and create an alert for what you want (example: `Torrevieja fiestas`, `Guardamar eventos`, `Orihuela Costa agenda`).
2. Click **Show options** and set **Deliver to**: `RSS`.
3. Create/Update the alert.
4. Copy the RSS feed URL from the RSS icon/link next to the alert.
5. Add it to `local-intel-sources.json` as a `rss` source.

Example entry:

```json
{
  "id": "alerts_es_torrevieja_fiestas",
  "label": "Google Alerts",
  "type": "rss",
  "kind": "update",
  "lang": "es",
  "url": "PASTE_GOOGLE_ALERTS_RSS_URL_HERE",
  "tags": ["Torrevieja", "Fiestas"],
  "maxItems": 25
}
```

Notes:

- Keep alerts narrow (one town + one intent). Broad alerts become spam fast.
- For client usefulness, prefer alerts that signal operational impact: `road closure`, `parking`, `festival program`, `fireworks`, `airport`, `strike`, `weather warning`.

## Town Hall / Tourism Calendars (iCal / ICS)

Best case is a subscription calendar (one `.ics` URL) from:

- Ayuntamiento (town hall) "Agenda / Eventos / Cultura"
- Tourism office pages
- Public Google Calendar embeds (if they provide a public iCal link)

How to find an ICS link:

1. On the agenda/events page, look for buttons/links like: `iCal`, `ICS`, `Add to calendar`, `Suscribirse`, `Exportar`, `Calendario`.
2. If the agenda is a Google Calendar embed: open the calendar in Google Calendar and look for **public iCal** / **secret address in iCal format**.
3. Paste the `.ics` URL into a source of `type: "ical"`.

Example entry:

```json
{
  "id": "ayuntamiento_torrevieja_agenda",
  "label": "Ayuntamiento: Agenda",
  "type": "ical",
  "kind": "event",
  "lang": "es",
  "url": "PASTE_PUBLIC_ICS_URL_HERE",
  "tags": ["Torrevieja", "Agenda"]
}
```

If there is no iCal:

- Try an official RSS feed (many WordPress sites expose RSS at `/feed/`, sometimes also category feeds).
- Use `manual` for the big, predictable fiestas (plus 1-2 “must know” local items per month).
- If you want full extraction from HTML-only agendas, plan a dedicated scraper per site (more brittle; needs per-site parsing rules).

## Where To Look (Costa Blanca South)

Good “first wave” targets (search each town for `agenda`, `eventos`, `cultura`, `turismo`, `ical`, `ics`, `suscribirse`, `calendario`):

- Torrevieja
- Orihuela / Orihuela Costa
- Guardamar del Segura
- Pilar de la Horadada
- Santa Pola
- Elche
- Alicante

If you want to expand beyond the strict area (day trips + client itineraries):

- Cartagena
- Murcia
- Valencia

## Practical Tip: Prefer Subscription Feeds

Some sites offer an “Add to calendar” link per event (single-event ICS). That does not scale well.
Prefer one calendar subscription (`.ics`) per organization/town, or one RSS feed for the whole agenda.

## Manual Items (Curated)

Use `local-intel-manual.json` for curated items that should always be present (major fiestas, peak travel weeks, recurring closures).

Minimal manual item:

```json
{
  "title": "Hogueras de San Juan (Alicante, peak days)",
  "start": "2026-06-20",
  "end": "2026-06-24",
  "allDay": true,
  "location": "Alicante",
  "summary": "Expect fireworks, street events, and traffic restrictions. Confirm the official schedule locally.",
  "url": "OPTIONAL_SOURCE_URL",
  "tags": ["San Juan", "Alicante", "Fiesta"]
}
```

Manual rules:

- `start`/`end` accept `YYYY-MM-DD` (all-day) or full ISO datetimes.
- For all-day manual items, `end` is treated as **inclusive** (more human-friendly).

## Source Quality Checklist

- Prefer official calendars over news/trends when possible.
- Always set `lang` correctly (use separate sources per language).
- Use `maxItems` on RSS sources to cap noise.
- Keep `kind` consistent:
  - `holiday`: public holidays
  - `fiesta`: fiestas / local celebrations
  - `event`: scheduled events
  - `update`: local updates/advisories/news items (often RSS)

## Verifying New Sources

After adding sources:

1. Run `python3 sync_local_intel.py ...` and check for `WARN:` lines.
2. Inspect `local-intel.json` and confirm your items appear with `kind`, `lang`, and `startAt`.
3. Run `python3 sync_blog_content.py ... --extra-posts local-intel-posts.json` and confirm `kind: "local"` posts exist in `blog-posts.json`.

## Source Fields

Each source supports:

- `id` (required): stable identifier
- `label`: display name for source links
- `type`: `ical` | `rss` | `manual`
- `kind`: `event` | `fiesta` | `holiday` | `update` | `advisory` | `news` (controls pill + filtering)
- `lang`: `en` or `es` (used for language filtering)
- `url` (for `ical`/`rss`) or `path` (for `manual`)
- `tags`: array of strings
- `maxItems` (RSS only): cap items per feed

## Running Locally

```bash
python3 sync_local_intel.py \
  --sources local-intel-sources.json \
  --out-js local-intel.js \
  --out-json local-intel.json \
  --out-extra-posts local-intel-posts.json \
  --days-past 15 \
  --days-future 365 \
  --digest-backfill 15
```

Then:

```bash
python3 sync_blog_content.py \
  --sources blog-sources.json \
  --out-js blog-posts.js \
  --out-json blog-posts.json \
  --extra-posts local-intel-posts.json
```

## Daily Automation

`.github/workflows/sync-blog.yml` runs daily and commits updated outputs:

- `local-intel.js`, `local-intel.json`, `local-intel-posts.json`
- `blog-posts.js`, `blog-posts.json`
- `share/blog/*` (share/OG pages for posts, including "Local" digests)
