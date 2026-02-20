
import json
import os
import urllib.request
import urllib.error

# Config - User must set these or we use defaults
SUPABASE_URL = "https://sxgxbswxajtoxcsbxchk.supabase.co"
ANON_KEY = "sb_publishable_bvfkfs8DE75sUtgh18SZkg_UnD7jhnK" # From config.js
# Hardcoded Service Key from context for diagnosis
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Z3hic3d4YWp0b3hjc2J4Y2hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU4MTI3NywiZXhwIjoyMDg2MTU3Mjc3fQ.BezpCCDlcmc-L5txJjD8waZe9pJIuvnxWhO_tDPU5E4"

def check_url(url, key, name):
    print(f"--- Read {name} ---")
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
             data = json.load(resp)
             print(f"Success. Rows: {len(data) if isinstance(data, list) else data}")
             if isinstance(data, list) and data:
                 print(json.dumps(data[0], indent=2))
    except urllib.error.HTTPError as e:
        print(f"Failed {name}: {e.code} - {e.reason}")
        try: print(e.read().decode()) 
        except: pass

def main():
    print("Diagnosing Supabase Data...")

    # Inmovilla (SCP-2771)
    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map?scp_ref=eq.SCP-2771&select=*"
    check_url(url, SUPABASE_KEY, "SCP-2771 (Inmovilla) - Service Key")

    # Redsp (SCP-3066)
    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map?scp_ref=eq.SCP-3066&select=*"
    check_url(url, SUPABASE_KEY, "SCP-3066 (Redsp) - Service Key")

    # PropMLS (SCP-1000)
    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map?scp_ref=eq.SCP-1000&select=*"
    check_url(url, SUPABASE_KEY, "SCP-1000 (PropMLS) - Service Key")

    # Summertime (SCP-3771)
    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map?scp_ref=eq.SCP-3771&select=*"
    check_url(url, SUPABASE_KEY, "SCP-3771 (Summertime) - Service Key")

    print("\n--- Checking Anon Key Access (RLS) ---")
    # Check if Anon key can read one of them
    url = f"{SUPABASE_URL}/rest/v1/listing_ref_map?scp_ref=eq.SCP-3771&select=*"
    check_url(url, ANON_KEY, "SCP-3771 (Anon Key)")

if __name__ == "__main__":
    main()
