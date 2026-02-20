
import json
import os
import urllib.request
import urllib.error

# Config
SUPABASE_URL = "https://sxgxbswxajtoxcsbxchk.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Z3hic3d4YWp0b3hjc2J4Y2hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU4MTI3NywiZXhwIjoyMDg2MTU3Mjc3fQ.BezpCCDlcmc-L5txJjD8waZe9pJIuvnxWhO_tDPU5E4"

def upsert_reference_map(rows):
    if not rows:
        print("No rows to upsert.")
        return

    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    # Send all at once (batch)
    try:
        data_json = json.dumps(rows).encode("utf-8")
        req = urllib.request.Request(url, data=data_json, headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            print(f"Upsert Response Code: {resp.status}")
            print(f"Upserted {len(rows)} rows.")
    except urllib.error.HTTPError as e:
        print(f"Upsert Failed: {e.code} - {e.reason}")
        try: print(e.read().decode()) 
        except: pass
    except Exception as e:
        print(f"Upsert Error: {e}")

# Construct row manually from JSON data
# STS-5378: SCP-3771, original_id: 0311-2226
row = {
    "scp_ref": "SCP-3771",
    "original_ref": "STS-5378",
    "original_id": "0311-2226",
    "source": "summertime",
    "updated_at": "2026-02-18T12:00:00Z" # Force date
}

print("Testing Upsert for SCP-3771...")
upsert_reference_map([row])
