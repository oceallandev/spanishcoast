#!/usr/bin/env python3
"""
Master Feed Sync Script.
Orchestrates the synchronization of:
1. Inmovilla
2. Redsp (N/SP)
3. Summertime (STS)
4. PropMLS (Legacy)

Runs twice daily via GitHub Actions (or local cron).
"""

import os
import sys
import json
import logging
import urllib.request
import urllib.error
import tempfile
from typing import List, Dict, Any, Optional

# Import local modules
# Ensure current directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import sync_inmovilla_feed
    import import_redsp_kyero_v3
    import import_propmls
    from import_inmovilla import ScpRefAllocator
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("feed_sync")

# Secrets / Config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://sxgxbswxajtoxcsbxchk.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") # MUST be Service Role Key for upserts

# Defaults from existing workflows/history
DEFAULT_INMOVILLA = "https://procesos.apinmo.com/xml/v2/xUYPBBMw/10183-web.xml"
DEFAULT_REDSP = "https://xml.redsp.net/files/1073/40410pmq94m/redsp1-redsp_v4.xml"
DEFAULT_PROPMLS = "https://www.propmls.com/property-export/24"

# Env Vars override defaults
INMOVILLA_URL = os.environ.get("FEED_URL_INMOVILLA", DEFAULT_INMOVILLA)
REDSP_URL = os.environ.get("FEED_URL_REDSP", DEFAULT_REDSP)
PROPMLS_URL = os.environ.get("FEED_URL_PROPMLS", DEFAULT_PROPMLS)
SUMMERTIME_URL = os.environ.get("FEED_URL_SUMMERTIME") # No default known yet

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------------------
# Supabase Client
# ------------------------------------------------------------------------------

def upsert_reference_map(rows: List[Dict[str, Any]]):
    """
    Upsert rows to `listing_ref_map` table via Supabase REST API.
    Bypasses RLS if using Service Key.
    """
    if not rows:
        return
    
    if not SUPABASE_KEY:
        logger.warning("SKIP Supabase sync: SUPABASE_SERVICE_KEY not set.")
        return

    endpoint = f"{SUPABASE_URL}/rest/v1/listing_ref_map"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    CHUNK_SIZE = 1000
    total = len(rows)
    
    for i in range(0, total, CHUNK_SIZE):
        chunk = rows[i:i+CHUNK_SIZE]
        try:
            req = urllib.request.Request(endpoint, data=json.dumps(chunk).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req) as resp:
                if resp.status not in (200, 201, 204):
                    logger.error(f"Supabase error: {resp.status} - {resp.read().decode()}")
                else:
                    logger.info(f"  Upserted batch {i}-{min(i+CHUNK_SIZE, total)}/{total}")
        except urllib.error.HTTPError as e:
            logger.error(f"Supabase HTTP Error: {e.code} - {e.read().decode()}")
        except Exception as e:
            logger.error(f"Supabase Sync Error: {e}")

# ------------------------------------------------------------------------------
# Feed Processors
# ------------------------------------------------------------------------------

def process_inmovilla():
    logger.info("--- Syncing Inmovilla ---")
    url = INMOVILLA_URL
    if not url: return

    try:
        xml_path = sync_inmovilla_feed.fetch_feed(url)
    except Exception as e:
        logger.error(f"Failed to fetch Inmovilla: {e}")
        return

    # Use default ref map path from module
    allocator = ScpRefAllocator(sync_inmovilla_feed.DEFAULT_REF_MAP, repo_root=REPO_ROOT)
    
    try:
        properties = sync_inmovilla_feed.parse_feed(xml_path, allocator)
        js_path = sync_inmovilla_feed.DEFAULT_OUT_JS
        sync_inmovilla_feed.write_public_js(properties, js_path)
        allocator.save()
        logger.info(f"Generated {js_path} ({len(properties)} items)")

        rows = allocator.rows_for_supabase(source="inmovilla")
        upsert_reference_map(rows)
    except Exception as e:
        logger.error(f"Error processing Inmovilla: {e}")
    finally:
        if os.path.exists(xml_path): os.remove(xml_path)

def process_redsp_variant(source: str, url: str, out_js: str):
    logger.info(f"--- Syncing {source} ---")
    if not url:
        logger.warning(f"Skipping {source}: URL not set.")
        return

    try:
        xml_path = sync_inmovilla_feed.fetch_feed(url)
    except Exception as e:
        logger.error(f"Failed to fetch {source}: {e}")
        return

    priv_dir = os.path.join(REPO_ROOT, "private", source)
    os.makedirs(priv_dir, exist_ok=True)
    map_path = os.path.join(priv_dir, "ref_map.json")
    
    allocator = ScpRefAllocator(map_path, repo_root=REPO_ROOT)
    
    try:
        spec = import_redsp_kyero_v3.detect_feed_spec(xml_path)
        if spec == "redsp_v4":
            items = import_redsp_kyero_v3.parse_redsp_v4_properties(
                xml_path, allocator=allocator, source=source
            )
            label = f"{source} (RedSp v4)"
        else:
            items = import_redsp_kyero_v3.parse_kyero_v3_properties(
                xml_path, allocator=allocator, source=source
            )
            label = f"{source} (Kyero v3)"

        js_out_path = os.path.join(REPO_ROOT, out_js)
        import_redsp_kyero_v3.write_public_js(items, js_out_path, source_label=label)
        allocator.save()
        logger.info(f"Generated {js_out_path} ({len(items)} items)")

        rows = allocator.rows_for_supabase(source=source)
        upsert_reference_map(rows)
    except Exception as e:
        logger.error(f"Error processing {source}: {e}")
    finally:
        if os.path.exists(xml_path): os.remove(xml_path)

def process_propmls():
    logger.info("--- Syncing PropMLS ---")
    
    xml_files = []
    temp_files = []
    
    # 1. Fetch
    if PROPMLS_URL:
        try:
            path = sync_inmovilla_feed.fetch_feed(PROPMLS_URL)
            xml_files.append(path)
            temp_files.append(path)
        except Exception as e:
            logger.error(f"Failed to fetch PropMLS: {e}")
    
    # Add local fallback
    for f in ["sample.xml", "kyero_feed.xml"]:
        fp = os.path.join(REPO_ROOT, f)
        if os.path.exists(fp):
            xml_files.append(fp)
            
    if not xml_files:
        logger.warning("No PropMLS/Legacy XML files found.")
        return

    try:
        map_csv = os.path.join(REPO_ROOT, "reference_map.csv")
        ref_map = import_propmls.LegacyRefMap(map_csv)
        
        all_props = []
        for xp in xml_files:
            all_props.extend(import_propmls.parse_propmls_xml(xp, ref_map))
            
        out_js = os.path.join(REPO_ROOT, "data.js")
        import_propmls.write_data_js(all_props, out_js)
        ref_map.save()
        logger.info(f"Generated {out_js} ({len(all_props)} items)")
        
        rows = ref_map.rows_for_supabase(source="propmls")
        logger.info(f"Upserting {len(rows)} PropMLS mappings...")
        upsert_reference_map(rows)
    except Exception as e:
        logger.error(f"Error processing PropMLS: {e}")
    finally:
        for tmp in temp_files:
            if os.path.exists(tmp): os.remove(tmp)

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

def main():
    logger.info("Starting Feed Sync...")
    
    process_inmovilla()
    process_redsp_variant(source="redsp1", url=REDSP_URL, out_js="newbuilds-listings.js")
    process_redsp_variant(source="summertime", url=SUMMERTIME_URL, out_js="summertime-listings.js")
    process_propmls()

    logger.info("Sync Complete.")

if __name__ == "__main__":
    main()
