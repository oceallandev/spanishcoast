#!/usr/bin/env python3
"""
Build a Supabase listing_ref_map seed from legacy SCP mapping CSV.

Input CSV formats supported:
- OriginalRef,SCPRef
- scp_ref,original_ref (or similar naming variants)

Outputs under --out-private-dir:
- listing_ref_map.csv
- listing_ref_map.sql
- sql_chunks/listing_ref_map.partXXX.sql
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from typing import Any, Dict, Iterable, List


def _t(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _clean_ref(value: str) -> str:
    s = _t(value)
    s = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", s, flags=re.IGNORECASE)
    return s.strip()


def _read_rows(path: str, default_source: str) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    with open(path, "r", encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.DictReader(f)
        headers = [h.strip() for h in (reader.fieldnames or [])]
        if not headers:
            raise ValueError(f"No CSV headers found in {path}")

        def pick(row: Dict[str, str], names: Iterable[str]) -> str:
            for n in names:
                if n in row and _t(row[n]):
                    return row[n]
            return ""

        for row in reader:
            if not isinstance(row, dict):
                continue
            original_ref = _clean_ref(
                pick(
                    row,
                    (
                        "OriginalRef",
                        "original_ref",
                        "originalRef",
                        "ref_original",
                        "source_ref",
                    ),
                )
            )
            scp_ref = _clean_ref(
                pick(
                    row,
                    (
                        "SCPRef",
                        "scp_ref",
                        "scpRef",
                        "ref_scp",
                        "new_ref",
                    ),
                )
            ).upper()

            if not original_ref or not scp_ref:
                continue
            if not re.match(r"^SCP-\d{3,6}$", scp_ref):
                continue
            out.append(
                {
                    "scp_ref": scp_ref,
                    "source": default_source,
                    "original_ref": original_ref,
                    "original_id": "",
                }
            )

    # Keep last occurrence for a SCP ref, then sort by SCP number.
    by_scp: Dict[str, Dict[str, str]] = {}
    for row in out:
        by_scp[row["scp_ref"]] = row
    rows = list(by_scp.values())
    rows.sort(key=lambda r: int(r["scp_ref"].split("-")[1]))
    return rows


def write_csv(rows: List[Dict[str, Any]], out_path: str, fieldnames: List[str]) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def write_sql_upsert(
    rows: List[Dict[str, Any]],
    out_path: str,
    *,
    table: str,
    conflict_cols: List[str],
    cols: List[str],
) -> None:
    if not rows:
        return

    def q(v: Any) -> str:
        if v is None:
            return "null"
        s = _t(v)
        if s == "":
            return "null"
        s = s.replace("'", "''")
        return f"'{s}'"

    values = []
    for r in rows:
        values.append("(" + ", ".join(q(r.get(c)) for c in cols) + ")")

    conflict = ", ".join(conflict_cols)
    set_cols = [c for c in cols if c not in conflict_cols]
    update = ", ".join([f"{c} = excluded.{c}" for c in set_cols])

    sql = (
        f"insert into public.{table} ({', '.join(cols)})\n"
        f"values\n  " + ",\n  ".join(values) + "\n"
        f"on conflict ({conflict}) do update set {update};\n"
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
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
    max_rows: int = 250,
    max_chars: int = 45000,
) -> List[str]:
    if not rows:
        return []

    os.makedirs(out_dir, exist_ok=True)

    def q(v: Any) -> str:
        if v is None:
            return "null"
        s = _t(v)
        if s == "":
            return "null"
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="reference_map.csv", help="Legacy SCP map CSV path")
    ap.add_argument("--source", default="propmls", help="Source label stored in listing_ref_map.source")
    ap.add_argument("--out-private-dir", default="private/legacy", help="Output directory (gitignored)")
    ap.add_argument("--chunk-size", type=int, default=250, help="Rows per SQL chunk")
    args = ap.parse_args()

    rows = _read_rows(args.csv, args.source)
    if not rows:
        raise SystemExit("No valid rows found in legacy map CSV.")

    fields = ["scp_ref", "source", "original_ref", "original_id"]
    out_dir = args.out_private_dir
    out_csv = os.path.join(out_dir, "listing_ref_map.csv")
    out_sql = os.path.join(out_dir, "listing_ref_map.sql")
    out_chunks = os.path.join(out_dir, "sql_chunks")

    write_csv(rows, out_csv, fields)
    write_sql_upsert(
        rows,
        out_sql,
        table="listing_ref_map",
        conflict_cols=["scp_ref"],
        cols=fields,
    )
    chunk_paths = write_sql_upsert_chunks(
        rows,
        out_chunks,
        "listing_ref_map",
        table="listing_ref_map",
        conflict_cols=["scp_ref"],
        cols=fields,
        max_rows=max(1, int(args.chunk_size)),
    )

    print(f"Rows: {len(rows)}")
    print(f"CSV: {out_csv}")
    print(f"SQL: {out_sql}")
    print(f"Chunks: {len(chunk_paths)} -> {out_chunks}/listing_ref_map.partXXX.sql")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
