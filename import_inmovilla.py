#!/usr/bin/env python3
"""
Inmovilla XML importer for Spanish Coast Properties.

Goals:
- Map Inmovilla properties into the existing public listing structure used by `data.js`.
- Extract contacts + demands into admin-only Supabase tables (never ship PII to the public site).

This script is intended to be run locally. It does NOT upload anything; it only generates files.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import xml.etree.ElementTree as ET


def _t(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    return s.strip()


def _get(datos: Optional[ET.Element], tag: str) -> str:
    if datos is None:
        return ""
    el = datos.find(tag)
    return _t(el.text if el is not None else "")


def _num(value: str) -> Optional[float]:
    s = _t(value)
    if not s:
        return None
    # Inmovilla tends to use "." for decimals, but be defensive.
    s = s.replace("\u00a0", " ")
    s = s.replace(" ", "")
    # If there are both separators, prefer last as decimal separator.
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    else:
        # Single separator case.
        if "," in s:
            s = s.replace(".", "").replace(",", ".")
    try:
        n = float(s)
    except Exception:
        return None
    if not (n == n):  # NaN
        return None
    return n


def _int(value: str) -> int:
    n = _num(value)
    if n is None:
        return 0
    try:
        return int(round(n))
    except Exception:
        return 0


def _bool01(value: str) -> bool:
    s = _t(value).lower()
    return s in ("1", "true", "t", "yes", "si", "sí", "on")


def _title_case(value: str) -> str:
    s = _t(value)
    if not s:
        return ""
    # Keep acronyms like "ALC" or postal codes intact.
    if s.isupper():
        s = s.lower()
    out = " ".join(w.capitalize() if len(w) > 2 else w for w in re.split(r"\s+", s))
    return out.strip()


def _parse_es_datetime(value: str) -> Optional[str]:
    """
    Parse dates like '03/02/2023 09:53:09' into ISO8601 (UTC assumed).
    Inmovilla exports don't include timezone; we store as UTC to keep consistent.
    """
    s = _t(value)
    if not s:
        return None
    # Ignore placeholder invalid dates.
    if "-0001" in s or "/0" in s or "0/0" in s:
        return None
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            # Treat as local time in Spain; store as naive UTC to avoid surprises.
            # If you want Europe/Madrid offsets, do it in Supabase by converting on display.
            dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    return None


def _pick_lang(datos: Optional[ET.Element], base: str, prefer: List[int]) -> str:
    """
    Inmovilla uses fields like ofertas_descrip1 (ES), ofertas_descrip2 (EN), etc.
    We try preferred suffixes first, then any non-empty.
    """
    if datos is None:
        return ""
    for idx in prefer:
        v = _get(datos, f"{base}{idx}")
        if v:
            return v
    # Fallback: scan a few known ranges.
    for idx in range(1, 33):
        v = _get(datos, f"{base}{idx}")
        if v:
            return v
    return ""


def _listing_mode(action: str) -> str:
    a = _t(action).lower()
    if "alquil" in a:
        return "rent"
    if "traspas" in a or "cesi" in a:
        return "traspaso"
    return "sale"


def _rent_period(value: str) -> str:
    v = _t(value).upper()
    if v in ("DIA", "DÍA"):
        return "day"
    if v in ("SEMANA", "SEMANAS", "WEEK"):
        return "week"
    if v in ("NOCHE", "NOCHEs", "NIGHT"):
        return "night"
    return "month"


class ScpRefAllocator:
    """
    Allocate stable SCP-xxxx references for source refs (e.g. Inmovilla offers_ref).

    The mapping is stored locally under `private/` (gitignored) so the public site never ships the
    original ref. A SQL upsert export is also generated so admins can import it into Supabase
    (behind RLS) and let privileged users see the original ref in the UI.
    """

    def __init__(
        self,
        map_path: str,
        *,
        repo_root: Optional[str] = None,
        start_at: Optional[int] = None,
        reset: bool = False,
    ):
        self.map_path = map_path
        self.repo_root = repo_root or os.path.dirname(os.path.abspath(__file__))
        self.state: Dict[str, Any] = {"version": 1, "next_number": 0, "map": {}, "meta": {}}
        if not reset:
            self._load()

        if not isinstance(self.state.get("next_number"), int) or self.state.get("next_number", 0) <= 0:
            base_next = (start_at or 0) if (start_at and start_at > 0) else (self._scan_max_scp_number() + 1)
            base_next = max(base_next, self._max_allocated_number() + 1)
            self.state["next_number"] = int(base_next)

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

    def _scan_max_scp_number(self) -> int:
        rx = re.compile(r"\bSCP-(\d{3,6})\b")
        max_num = 0

        candidates = [
            os.path.join(self.repo_root, "data.js"),
            os.path.join(self.repo_root, "custom-listings.js"),
            os.path.join(self.repo_root, "businesses-data.js"),
            os.path.join(self.repo_root, "vehicles-data.js"),
            os.path.join(self.repo_root, "reference_map.csv"),
        ]

        def scan_file(fp: str) -> None:
            nonlocal max_num
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                for m in rx.finditer(text):
                    try:
                        n = int(m.group(1))
                    except Exception:
                        continue
                    if n > max_num:
                        max_num = n
            except Exception:
                return

        for fp in candidates:
            if os.path.exists(fp) and os.path.basename(fp) != "inmovilla-listings.js":
                scan_file(fp)

        if max_num <= 0:
            for root, dirs, files in os.walk(self.repo_root):
                dirs[:] = [d for d in dirs if d not in (".git", "private")]
                for fn in files:
                    if fn == "inmovilla-listings.js":
                        continue
                    if not (fn.endswith(".js") or fn.endswith(".csv")):
                        continue
                    scan_file(os.path.join(root, fn))

        return max_num

    def _max_allocated_number(self) -> int:
        rx = re.compile(r"^SCP-(\d{3,6})$")
        max_num = 0
        mapping = self.state.get("map") or {}
        if not isinstance(mapping, dict):
            return 0
        for v in mapping.values():
            m = rx.match(_t(v))
            if not m:
                continue
            try:
                n = int(m.group(1))
            except Exception:
                continue
            if n > max_num:
                max_num = n
        return max_num

    def resolve(self, original_ref: str) -> str:
        mapping = self.state.get("map")
        if not isinstance(mapping, dict):
            mapping = {}
            self.state["map"] = mapping

        key = _t(original_ref).upper()
        if not key:
            key = "UNKNOWN"

        existing = _t(mapping.get(key))
        if existing:
            return existing

        n = int(self.state.get("next_number") or 0)
        if n <= 0:
            n = self._scan_max_scp_number() + 1
        scp_ref = f"SCP-{n}"
        mapping[key] = scp_ref
        self.state["next_number"] = n + 1
        return scp_ref

    def record(self, original_ref: str, original_id: str) -> None:
        key = _t(original_ref).upper()
        if not key:
            key = "UNKNOWN"
        meta = self.state.get("meta")
        if not isinstance(meta, dict):
            meta = {}
            self.state["meta"] = meta
        row = meta.get(key)
        if not isinstance(row, dict):
            row = {}
            meta[key] = row
        oid = _t(original_id)
        if oid:
            row["original_id"] = oid

    def rows_for_supabase(self, source: str = "inmovilla") -> List[Dict[str, Any]]:
        mapping = self.state.get("map")
        if not isinstance(mapping, dict):
            return []
        rows: List[Dict[str, Any]] = []
        meta = self.state.get("meta")
        meta = meta if isinstance(meta, dict) else {}
        for original_ref, scp_ref in mapping.items():
            original_id = None
            m = meta.get(original_ref)
            if isinstance(m, dict):
                original_id = _t(m.get("original_id")) or None
            rows.append(
                {
                    "scp_ref": _t(scp_ref),
                    "source": source,
                    "original_ref": _t(original_ref),
                    "original_id": original_id,
                }
            )
        return rows


def parse_inmovilla_properties(xml_path: str, allocator: Optional[ScpRefAllocator] = None) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    prop_count = 0

    for ev, el in ET.iterparse(xml_path, events=("end",)):
        if el.tag != "propiedad":
            continue
        prop_count += 1
        datos = el.find("datos")

        inmovilla_id = _get(datos, "ofertas_cod_ofer") or _get(datos, "id")
        original_ref = _get(datos, "ofertas_ref") or _get(datos, "ofertas_referenciacol") or inmovilla_id
        # Public ref shown to clients. If allocator is provided, we remap to SCP-xxxx and keep the original ref private.
        ref = allocator.resolve(original_ref) if allocator else original_ref
        if allocator:
            allocator.record(original_ref, inmovilla_id)
        action = _get(datos, "accionoferta_accion")
        mode = _listing_mode(action)

        sale_price = _num(_get(datos, "ofertas_precioinmo")) or _num(_get(datos, "ofertas_precio")) or 0.0
        rent_price = _num(_get(datos, "ofertas_precioalq")) or 0.0
        price = sale_price if mode in ("sale", "traspaso") else 0.0

        ptype = _get(datos, "tipo_tipo_ofer") or _get(datos, "tipo_tipo") or "Property"
        town = _title_case(_get(datos, "ciudad_ciudad") or _get(datos, "campos_adicionales_libreta_catastral_localidad"))
        province = _title_case(_get(datos, "provincias_provincia") or _get(datos, "clientes_provincia"))

        beds = _int(_get(datos, "totalhab")) or _int(_get(datos, "ofertas_habitaciones")) or _int(_get(datos, "ofertas_habdobles"))
        baths = _int(_get(datos, "ofertas_banyos"))

        built = _int(_get(datos, "ofertas_m_cons")) or _int(_get(datos, "ofertas_m_uties"))
        plot = _int(_get(datos, "ofertas_m_parcela"))

        # Inmovilla exports coordinates as:
        # - ofertas_latitud: latitude
        # - ofertas_altitud: longitude (yes, the name is confusing)
        lat = _num(_get(datos, "ofertas_latitud"))
        lon = _num(_get(datos, "ofertas_altitud")) or _num(_get(datos, "ofertas_longitud"))

        title = _pick_lang(datos, "ofertas_titulo", prefer=[2, 1])
        desc = _pick_lang(datos, "ofertas_descrip", prefer=[2, 1])

        # Public description: keep it clean and readable.
        description = desc or ""
        if title and description and title.lower() not in description[:80].lower():
            description = f"{title}\n\n{description}"

        features: List[str] = []
        dist_mar = _int(_get(datos, "ofertas_distmar"))
        if dist_mar > 0:
            features.append(f"Beach: {dist_mar} Meters")

        if _bool01(_get(datos, "ofertas_piscina_prop")):
            features.append("Private pool")
        elif _bool01(_get(datos, "ofertas_piscina_com")):
            features.append("Communal pool")

        if _bool01(_get(datos, "ofertas_vistasalmar")):
            features.append("Sea view")
        else:
            vistas = _t(_get(datos, "tipovistas_vistas")).lower()
            if "mar" in vistas or "playa" in vistas:
                features.append("Sea view")

        if _bool01(_get(datos, "ofertas_ascensor")):
            features.append("Elevator")
        if _bool01(_get(datos, "ofertas_balcon")):
            features.append("Balcony")
        if _bool01(_get(datos, "ofertas_terraza")) or _int(_get(datos, "ofertas_m_terraza")) > 0:
            features.append("Terrace")
        if _bool01(_get(datos, "ofertas_solarium")):
            features.append("Solarium")
        if _bool01(_get(datos, "ofertas_jardin")):
            features.append("Garden")
        if _bool01(_get(datos, "ofertas_trastero")):
            features.append("Storage room")
        if _bool01(_get(datos, "ofertas_alarmarobo")):
            features.append("Alarm")

        parking = _t(_get(datos, "parking")).upper()
        plazas = _int(_get(datos, "ofertas_nplazasparking"))
        if (parking and parking != "SIN_PARKING") or plazas > 0:
            features.append("Parking")

        calef = _t(_get(datos, "tipocalefaccion_txtcalefaccion"))
        if calef:
            features.append(f"Heating: {calef}")
        ori = _t(_get(datos, "tipoori_orientacion"))
        if ori:
            features.append(f"Orientation: {ori}")

        furnished = _get(datos, "ofertas_muebles")
        if _bool01(furnished):
            features.append("Furnished")

        # Images
        images: List[str] = []
        # Inmovilla exports photos as repeated <fotos> blocks (one <fotoX> per block),
        # so we must iterate all of them (not just the first).
        for fotos in el.findall("fotos"):
            for c in list(fotos):
                u = _t(c.text)
                if u:
                    images.append(u)
        # Dedupe
        images = list(dict.fromkeys(images))

        obj: Dict[str, Any] = {
            # Avoid shipping source refs in the public payload; keep IDs derived from SCP refs.
            "id": f"imv-{_t(ref)}",
            "ref": _t(ref),
            "price": int(round(price)) if price and price > 0 else 0,
            "currency": "EUR",
            "type": _t(ptype) or "Property",
            "town": town or "",
            "province": province or "",
            "beds": int(beds) if beds else 0,
            "baths": int(baths) if baths else 0,
            "surface_area": {"built": int(built) if built else 0, "plot": int(plot) if plot else 0},
            "latitude": float(lat) if lat is not None else None,
            "longitude": float(lon) if lon is not None else None,
            "description": description,
            "features": features,
            "images": images,
            # App-level hints:
            "listing_mode": mode,
        }

        if mode == "rent" and rent_price and rent_price > 0:
            obj["rent_price"] = int(round(rent_price))
            obj["rent_period"] = _rent_period(_get(datos, "ofertas_tipomensual"))

        # Avoid nulls for lat/lon to keep existing code paths simple.
        if obj["latitude"] is None:
            obj.pop("latitude", None)
        if obj["longitude"] is None:
            obj.pop("longitude", None)

        out.append(obj)
        el.clear()

    return out


def parse_inmovilla_contacts(xml_path: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    for ev, el in ET.iterparse(xml_path, events=("end",)):
        if el.tag != "propiedad":
            continue
        datos = el.find("datos")

        code = _get(datos, "clientes_cod_cli")
        if not code:
            el.clear()
            continue

        first = _get(datos, "clientes_nombre")
        last = _get(datos, "clientes_apellidos")
        email = _get(datos, "clientes_email")
        phone1 = _get(datos, "clientes_telefono1")
        phone2 = _get(datos, "clientes_telefono2")
        phone3 = _get(datos, "clientes_telefono3")
        locality = _get(datos, "clientes_localidad")
        province = _get(datos, "clientes_provincia")
        nationality = _get(datos, "clientes_nacionalidad")
        client_type = _get(datos, "tipo_cliente")
        notes = _get(datos, "tablaObserCli_observacion") or _get(datos, "tablaAvisoImpCli_msjaviso")
        created = _parse_es_datetime(_get(datos, "clientes_altacliente"))
        updated = _parse_es_datetime(_get(datos, "clientes_fechaactua"))

        raw: Dict[str, Any] = {c.tag: _t(c.text) for c in list(datos)} if datos is not None else {}

        out.append(
            {
                "source": "inmovilla",
                "external_client_code": code,
                "email": email or None,
                "first_name": first or None,
                "last_name": last or None,
                "phone1": phone1 or None,
                "phone2": phone2 or None,
                "phone3": phone3 or None,
                "locality": locality or None,
                "province": province or None,
                "nationality": nationality or None,
                "client_type": client_type or None,
                "notes": notes or None,
                "source_created_at": created,
                "source_updated_at": updated,
                "raw": raw,
            }
        )

        el.clear()

    # Dedupe by (source, external_client_code)
    uniq: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in out:
        k = (row.get("source") or "inmovilla", row.get("external_client_code") or "")
        if not k[1]:
            continue
        uniq[k] = row
    return list(uniq.values())


def parse_inmovilla_demands(xml_path: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    for ev, el in ET.iterparse(xml_path, events=("end",)):
        if el.tag != "propiedad":
            continue
        datos = el.find("datos")

        code = _get(datos, "clientes_cod_cli")
        num = _get(datos, "demandas_numdemanda")
        if not code and not num:
            el.clear()
            continue

        title = _get(datos, "demandas_titulodem")
        # Sale/rent preference based on which range fields are set.
        sale_min = _num(_get(datos, "demandas_ventadesde"))
        sale_max = _num(_get(datos, "demandas_ventahasta"))
        rent_min = _num(_get(datos, "demandas_alquilerdesde"))
        rent_max = _num(_get(datos, "demandas_alquilerhasta"))
        operation = "sale" if (sale_min or sale_max) else "rent" if (rent_min or rent_max) else ""

        price_min = sale_min or rent_min
        price_max = sale_max or rent_max

        beds_min = _int(_get(datos, "demandas_habitacionmin"))
        baths_min = _int(_get(datos, "demandas_banosmin")) or _int(_get(datos, "demandas_aseosmin"))

        types = _get(datos, "demandas_lista_tipos")
        zones = _get(datos, "demandas_lista_zonas")

        want_terrace = _bool01(_get(datos, "demandas_terraza"))
        want_pool = _bool01(_get(datos, "demandas_piscina"))
        want_garage = _bool01(_get(datos, "demandas_garaje"))
        want_lift = _bool01(_get(datos, "demandas_ascensor"))

        created = _parse_es_datetime(_get(datos, "demandas_fecha"))
        updated = _parse_es_datetime(_get(datos, "demandas_fechaact"))
        notes = _get(datos, "tablaObserDem_observacion") or _get(datos, "tablaInteres_observacion") or _get(
            datos, "tablaAvisoImp_msjaviso"
        )

        raw: Dict[str, Any] = {c.tag: _t(c.text) for c in list(datos)} if datos is not None else {}

        out.append(
            {
                "source": "inmovilla",
                "external_client_code": code or None,
                "external_demand_number": num or None,
                "title": title or None,
                "operation": operation or None,
                "price_min": int(round(price_min)) if price_min else None,
                "price_max": int(round(price_max)) if price_max else None,
                "beds_min": beds_min or None,
                "baths_min": baths_min or None,
                "types": types or None,
                "zones": zones or None,
                "want_terrace": want_terrace,
                "want_pool": want_pool,
                "want_garage": want_garage,
                "want_lift": want_lift,
                "notes": notes or None,
                "source_created_at": created,
                "source_updated_at": updated,
                "raw": raw,
            }
        )

        el.clear()

    # Dedupe by (source, client_code, demand_number)
    uniq: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for row in out:
        k = (
            row.get("source") or "inmovilla",
            _t(row.get("external_client_code")),
            _t(row.get("external_demand_number")),
        )
        uniq[k] = row
    return list(uniq.values())


def write_public_js(properties: List[Dict[str, Any]], out_path: str) -> None:
    payload = json.dumps(properties, ensure_ascii=False, indent=2)
    content = (
        "/* Auto-generated from Inmovilla XML export. DO NOT EDIT BY HAND. */\n"
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


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--properties-xml", required=True, help="Path to Inmovilla properties XML (ofertas_*)")
    ap.add_argument("--contacts-xml", required=False, help="Path to Inmovilla contacts XML (clientes_*)")
    ap.add_argument("--demands-xml", required=False, help="Path to Inmovilla demands/leads XML (demandas_*)")

    ap.add_argument("--out-public-js", default="inmovilla-listings.js", help="Public JS output for listings")
    ap.add_argument("--out-private-dir", default="private/inmovilla", help="Output dir for private contacts/leads exports")
    ap.add_argument("--no-private", action="store_true", help="Skip generating private exports (contacts/leads)")
    ap.add_argument("--reset-ref-map", action="store_true", help="Reset local SCP ref map (will reassign refs)")

    args = ap.parse_args(argv)

    priv_dir = args.out_private_dir

    # Allocate SCP refs and keep source refs private.
    ref_map_path = os.path.join(priv_dir, "ref_map.json")
    allocator = ScpRefAllocator(ref_map_path, reset=bool(args.reset_ref_map))

    props = parse_inmovilla_properties(args.properties_xml, allocator=allocator)
    write_public_js(props, args.out_public_js)
    allocator.save()

    print(f"Properties: {len(props)} -> {args.out_public_js}")

    # Export ref mapping for Supabase (admin-only table behind RLS).
    ref_rows = allocator.rows_for_supabase(source="inmovilla")
    if ref_rows:
        ref_fields = ["scp_ref", "source", "original_ref", "original_id"]
        ref_csv = os.path.join(priv_dir, "listing_ref_map.csv")
        ref_sql = os.path.join(priv_dir, "listing_ref_map.sql")
        write_csv(ref_rows, ref_csv, ref_fields)
        write_sql_upsert(
            ref_rows,
            ref_sql,
            table="listing_ref_map",
            conflict_cols=["scp_ref"],
            cols=ref_fields,
        )
        print(f"Ref map: {len(ref_rows)} -> {ref_csv} (+ {ref_sql})")

    if args.no_private:
        return 0

    if args.contacts_xml:
        contacts = parse_inmovilla_contacts(args.contacts_xml)
        contacts_csv = os.path.join(priv_dir, "crm_contacts.csv")
        contacts_sql = os.path.join(priv_dir, "crm_contacts.sql")
        contacts_fields = [
            "source",
            "external_client_code",
            "email",
            "first_name",
            "last_name",
            "phone1",
            "phone2",
            "phone3",
            "locality",
            "province",
            "nationality",
            "client_type",
            "notes",
            "source_created_at",
            "source_updated_at",
            "raw",
        ]
        write_csv(contacts, contacts_csv, contacts_fields)
        write_sql_upsert(
            contacts,
            contacts_sql,
            table="crm_contacts",
            conflict_cols=["source", "external_client_code"],
            cols=contacts_fields,
        )
        print(f"Contacts: {len(contacts)} -> {contacts_csv} (+ {contacts_sql})")

    if args.demands_xml:
        demands = parse_inmovilla_demands(args.demands_xml)
        demands_csv = os.path.join(priv_dir, "crm_demands.csv")
        demands_sql = os.path.join(priv_dir, "crm_demands.sql")
        demands_fields = [
            "source",
            "external_client_code",
            "external_demand_number",
            "title",
            "operation",
            "price_min",
            "price_max",
            "beds_min",
            "baths_min",
            "types",
            "zones",
            "want_terrace",
            "want_pool",
            "want_garage",
            "want_lift",
            "notes",
            "source_created_at",
            "source_updated_at",
            "raw",
        ]
        write_csv(demands, demands_csv, demands_fields)
        write_sql_upsert(
            demands,
            demands_sql,
            table="crm_demands",
            conflict_cols=["source", "external_client_code", "external_demand_number"],
            cols=demands_fields,
        )
        print(f"Demands: {len(demands)} -> {demands_csv} (+ {demands_sql})")

    print("\nIMPORTANT: Do not commit anything under `private/` (contains PII and private mappings).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
