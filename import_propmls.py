#!/usr/bin/env python3
"""
PropMLS (Legacy) XML Importer.
Ported from sync_xml.pl.

Maintains backward compatibility with `reference_map.csv` (legacy format)
but integrates with the new sync automation.
"""

import argparse
import csv
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

def _t(value: Any) -> str:
    if value is None: return ""
    return str(value).strip()

def _num(value: Any) -> float:
    s = _t(value).replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0

def _int(value: Any) -> int:
    return int(_num(value))

def _clean_xml_content(text: str) -> str:
    if not text:
        return ""
    s = text
    # Remove CDATA wrappers
    s = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", s, flags=re.DOTALL)
    # Remove tags
    s = re.sub(r"<[^>]+>", "", s)
    # Normalize excessive whitespace
    s = re.sub(r"\s+", " ", s).strip()
    # Escape quotes for JS? No, json.dumps handles that.
    # The Perl script manually escaped JSON, but we use json.dumps.
    return s

def _get_text(el: ET.Element, tag: str) -> str:
    child = el.find(tag)
    return _clean_xml_content(child.text) if child is not None else ""

# ------------------------------------------------------------------------------
# Legacy Reference Map
# ------------------------------------------------------------------------------

class LegacyRefMap:
    """Handles reference_map.csv logic from sync_xml.pl"""
    def __init__(self, map_path: str):
        self.map_path = map_path
        self.ref_map: Dict[str, str] = {}
        self.next_scp_id = 1000
        self._load()

    def _load(self):
        if not os.path.exists(self.map_path):
            return
        try:
            with open(self.map_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None) # Skip header
                for row in reader:
                    if len(row) < 2: continue
                    orig, scp = row[0], row[1]
                    if orig and scp:
                        self.ref_map[orig] = scp
                        m = re.match(r"SCP-(\d+)", scp)
                        if m:
                            val = int(m.group(1))
                            if val >= self.next_scp_id:
                                self.next_scp_id = val + 1
        except Exception as e:
            print(f"Warning: Failed to load {self.map_path}: {e}")

    def get_scp_ref(self, original_ref: str) -> str:
        if not original_ref:
            return ""
        if original_ref in self.ref_map:
            return self.ref_map[original_ref]
        
        new_ref = f"SCP-{self.next_scp_id}"
        self.next_scp_id += 1
        self.ref_map[original_ref] = new_ref
        return new_ref

    def save(self):
        os.makedirs(os.path.dirname(self.map_path), exist_ok=True)
        with open(self.map_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["OriginalRef", "SCPRef"])
            for orig in sorted(self.ref_map.keys()):
                writer.writerow([orig, self.ref_map[orig]])

    def rows_for_supabase(self, source: str = "propmls") -> List[Dict[str, Any]]:
        rows = []
        for orig, scp in self.ref_map.items():
            rows.append({
                "scp_ref": scp,
                "source": source,
                "original_ref": orig,
                "original_id": None
            })
        return rows

# ------------------------------------------------------------------------------
# Parser
# ------------------------------------------------------------------------------

def parse_propmls_xml(xml_path: str, ref_map: LegacyRefMap, source_label: str = "propmls") -> List[Dict[str, Any]]:
    properties = []
    if not os.path.exists(xml_path):
        print(f"Warning: XML file not found: {xml_path}")
        return []

    print(f"Parsing {xml_path} ({source_label})...")
    
    # Use iterparse for memory efficiency (though PropMLS isn't huge)
    for event, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag != "property":
            continue
        
        p = elem
        original_id = _get_text(p, "id")
        original_ref = _get_text(p, "ref") or original_id
        
        if not original_ref:
            elem.clear()
            continue

        scp_ref = ref_map.get_scp_ref(original_ref)
        
        # Basic fields
        price = _num(_get_text(p, "price"))
        currency = _get_text(p, "currency")
        ptype = _get_text(p, "type")
        town = _get_text(p, "town")
        province = _get_text(p, "province")
        
        beds = _int(_get_text(p, "beds"))
        baths = _int(_get_text(p, "baths"))
        
        # Surface
        built = 0
        plot = 0
        sa = p.find("surface_area")
        if sa is not None:
            built = _int(_get_text(sa, "built"))
            plot = _int(_get_text(sa, "plot"))
        
        # Location
        lat = 0.0
        lon = 0.0
        loc = p.find("location")
        if loc is not None:
            lat = _num(_get_text(loc, "latitude"))
            lon = _num(_get_text(loc, "longitude"))
        else:
            lat = _num(_get_text(p, "latitude"))
            lon = _num(_get_text(p, "longitude"))
        
        # Description (En fallback)
        desc = ""
        desc_el = p.find("desc")
        if desc_el is not None:
            en = _get_text(desc_el, "en")
            # If <en> exists, use it. Else use full text of node (fallback)
            desc = en if en else _clean_xml_content(ET.tostring(desc_el, encoding="unicode", method="text"))
        
        # Features
        features = []
        for f in p.findall("feature"):
            val = _clean_xml_content(f.text)
            if val: features.append(val)
            
        # Images
        images = []
        imgs_el = p.find("images")
        if imgs_el is not None:
            # Check for <url> inside <images>
            for url in imgs_el.findall("url"):
                u = _clean_xml_content(url.text)
                if u: images.append(u)
        
        # Fallback: check <photo>
        for photo in p.findall("photo"):
            u = _clean_xml_content(photo.text)
            if u: images.append(u)
            
        # Ensure we don't have dupes
        images = list(dict.fromkeys(images))

        item = {
            "id": str(original_id), # Legacy format kept original ID
            "ref": scp_ref,
            "price": int(price),
            "currency": currency,
            "type": ptype,
            "town": town,
            "province": province,
            "beds": beds,
            "baths": baths,
            "surface_area": { "built": built, "plot": plot },
            "latitude": lat if lat != 0 else None,
            "longitude": lon if lon != 0 else None,
            "description": desc,
            "features": features,
            "images": images
        }
        
        # Clean None values for existing schema compatibility (optional)
        if item["latitude"] is None: del item["latitude"]
        if item["longitude"] is None: del item["longitude"]

        properties.append(item)
        elem.clear()
        
    return properties

def write_data_js(properties: List[Dict[str, Any]], out_path: str):
    print(f"Generating {out_path} with {len(properties)} properties...")
    
    # We construct the JS file manually to match the exact format of sync_xml.pl if needed,
    # or just use JSON.dump. sync_xml.pl output was a simple array.
    
    payload = json.dumps(properties, ensure_ascii=False, indent=2)
    content = f"const propertyData = {payload};\n"
    
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)

def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Detailed PropMLS/Legacy Importer")
    ap.add_argument("--xmls", nargs="+", help="List of XML files to parse", default=["sample.xml", "kyero_feed.xml"])
    ap.add_argument("--out-js", default="data.js", help="Output JS file")
    ap.add_argument("--map-csv", default="reference_map.csv", help="Legacy CSV map")
    ap.add_argument("--supabase-out", help="Optional: output SQL for Supabase")
    args = ap.parse_args(argv)

    repo_root = os.path.dirname(os.path.abspath(__file__))
    map_path = os.path.join(repo_root, args.map_csv)
    ref_map = LegacyRefMap(map_path)

    all_props = []
    for xml_file in args.xmls:
        fp = os.path.join(repo_root, xml_file)
        if os.path.exists(fp):
            all_props.extend(parse_propmls_xml(fp, ref_map))
        else:
            print(f"Skipping missing file: {fp}")

    out_js = os.path.join(repo_root, args.out_js)
    write_data_js(all_props, out_js)
    
    ref_map.save()
    print("Done.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
