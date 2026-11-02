"""
sync_maps.py
============
Processador e sincronizador universal de camadas geográficas (Shapes e Talhões)
para a Usina Pitangueiras - Safra 2026.

Detecta atualizações nos arquivos brutos de DashBoard/Maps/ (ex: PITANGUEIRAS.geojson, fields.mbtiles),
aplica simplificação topológica inteligente (Douglas-Peucker preservativo),
gera versão de ultra-alta performance em Leaflet Canvas (pitangueiras_shapes.geojson)
e atualiza o manifest.json para carregamento dinâmico instantâneo nos 17 dashboards.
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    from shapely.geometry import shape, mapping
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

MAPS_DIR = Path(__file__).resolve().parent
RAW_GEOJSON = MAPS_DIR / "PITANGUEIRAS.geojson"
OPT_GEOJSON = MAPS_DIR / "pitangueiras_shapes.geojson"
MANIFEST_FILE = MAPS_DIR / "manifest.json"
MBTILES_FILE = MAPS_DIR / "fields.mbtiles"

# Tolerância em graus para simplificação Douglas-Peucker (~3.5m na latitude da usina)
SIMPLIFY_TOLERANCE = 0.000035


def round_coordinates(coords, precision=5):
    """Arredonda recursivamente coordenadas para 5 casas decimais (~1.1m)."""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(float(coords[0]), precision), round(float(coords[1]), precision)]
    return [round_coordinates(c, precision) for c in coords]


def update_bbox(coords, bbox):
    """Atualiza o bounding box [min_lon, min_lat, max_lon, max_lat]."""
    if not coords:
        return bbox
    if isinstance(coords[0], (int, float)):
        lon, lat = coords[0], coords[1]
        bbox[0] = min(bbox[0], lon)
        bbox[1] = min(bbox[1], lat)
        bbox[2] = max(bbox[2], lon)
        bbox[3] = max(bbox[3], lat)
        return bbox
    for c in coords:
        update_bbox(c, bbox)
    return bbox


def count_coords(geometry) -> int:
    """Conta total de vértices em uma geometria."""
    if not geometry:
        return 0
    t = geometry.get("type", "")
    coords = geometry.get("coordinates", [])
    if t == "Polygon":
        return sum(len(ring) for ring in coords)
    elif t == "MultiPolygon":
        return sum(sum(len(ring) for ring in poly) for poly in coords)
    return 0


def process_maps(force=False) -> dict:
    """Verifica e reprocessa os mapas com simplificação de alta performance."""
    if not RAW_GEOJSON.is_file():
        print(f"[sync_maps] Arquivo de origem {RAW_GEOJSON.name} não encontrado.")
        return {"status": "error", "message": "Raw file not found"}

    raw_mtime = RAW_GEOJSON.stat().st_mtime
    needs_update = force or not OPT_GEOJSON.is_file() or not MANIFEST_FILE.is_file()

    if not needs_update and OPT_GEOJSON.is_file():
        opt_mtime = OPT_GEOJSON.stat().st_mtime
        if raw_mtime > opt_mtime:
            needs_update = True

    if not needs_update:
        print("[sync_maps] Mapas já estão atualizados. Lendo manifest...")
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    print(f"[sync_maps] Processando {RAW_GEOJSON.name} ({RAW_GEOJSON.stat().st_size / (1024*1024):.1f} MB)...")
    t0 = time.time()

    with open(RAW_GEOJSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    total_features = len(features)
    print(f"[sync_maps] Total de feições encontradas: {total_features}")

    raw_vertices = 0
    opt_vertices = 0
    bbox = [180.0, 90.0, -180.0, -90.0]
    farms_summary = {}

    for feat in features:
        geom = feat.get("geometry", {})
        if not geom:
            continue

        raw_vertices += count_coords(geom)

        # Simplificação topológica inteligente
        feat_bbox = None
        if HAS_SHAPELY:
            try:
                s_orig = shape(geom)
                s_simp = s_orig.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
                geom = mapping(s_simp)
                b = s_simp.bounds
                feat_bbox = [round(b[0], 5), round(b[1], 5), round(b[2], 5), round(b[3], 5)]
            except Exception:
                geom = feat.get("geometry", {})

        coords = geom.get("coordinates", [])
        if coords:
            geom["coordinates"] = round_coordinates(coords, 5)
            update_bbox(coords, bbox)

        opt_vertices += count_coords(geom)
        feat["geometry"] = geom
        if feat_bbox:
            feat["bbox"] = feat_bbox

        props = feat.get("properties", {})
        fazenda_cod = str(props.get("FAZENDA", "")).strip()
        nome_faz = str(props.get("NOME_FAZ", "")).strip() or fazenda_cod or "Sem Nome"
        try:
            talhao_val = int(float(props.get("TALHAO", 0)))
        except (ValueError, TypeError):
            talhao_val = 0
        try:
            area_val = round(float(props.get("AREA_TOTAL", 0.0)), 2)
        except (ValueError, TypeError):
            area_val = 0.0

        clean_props = {
            "fazenda": fazenda_cod,
            "nome_faz": nome_faz,
            "talhao": talhao_val,
            "area": area_val,
            "zona": int(props.get("ZONA", 0)) if props.get("ZONA") is not None else 0,
            "unidade": int(props.get("CD_UNIDADE", 0)) if props.get("CD_UNIDADE") is not None else 0,
        }
        feat["properties"] = clean_props

        if nome_faz not in farms_summary:
            farms_summary[nome_faz] = {"count": 0, "total_area": 0.0}
        farms_summary[nome_faz]["count"] += 1
        farms_summary[nome_faz]["total_area"] = round(farms_summary[nome_faz]["total_area"] + area_val, 2)

    # Grava o GeoJSON otimizado
    tmp_opt = OPT_GEOJSON.with_suffix(".tmp")
    with open(tmp_opt, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))

    # Substituição atômica ou fallback
    try:
        tmp_opt.replace(OPT_GEOJSON)
    except Exception:
        if OPT_GEOJSON.exists():
            OPT_GEOJSON.unlink()
        tmp_opt.rename(OPT_GEOJSON)

    center = [
        round((bbox[1] + bbox[3]) / 2.0, 5),
        round((bbox[0] + bbox[2]) / 2.0, 5)
    ]

    reduction_pct = round((1.0 - (opt_vertices / max(raw_vertices, 1))) * 100.0, 1)

    manifest = {
        "status": "ready",
        "last_updated": datetime.now().astimezone().isoformat(timespec="seconds"),
        "raw_source": RAW_GEOJSON.name,
        "raw_size_bytes": RAW_GEOJSON.stat().st_size,
        "raw_vertices": raw_vertices,
        "optimized_file": OPT_GEOJSON.name,
        "optimized_size_bytes": OPT_GEOJSON.stat().st_size,
        "optimized_vertices": opt_vertices,
        "vertices_reduction_pct": reduction_pct,
        "mbtiles_available": MBTILES_FILE.is_file(),
        "total_features": total_features,
        "bbox": bbox,
        "center": center,
        "total_farms": len(farms_summary),
        "total_area_ha": round(sum(f["total_area"] for f in farms_summary.values()), 2)
    }

    tmp_manifest = MANIFEST_FILE.with_suffix(".tmp")
    with open(tmp_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    try:
        tmp_manifest.replace(MANIFEST_FILE)
    except Exception:
        if MANIFEST_FILE.exists():
            MANIFEST_FILE.unlink()
        tmp_manifest.rename(MANIFEST_FILE)

    dt = time.time() - t0
    print(f"[sync_maps] Concluído em {dt:.2f}s! Arquivo otimizado: {manifest['optimized_size_bytes'] / (1024*1024):.2f} MB")
    print(f"[sync_maps] Redução de vértices: {raw_vertices} -> {opt_vertices} (-{reduction_pct}%). Total de talhões: {total_features} ({manifest['total_area_ha']} ha).")
    return manifest


if __name__ == "__main__":
    force_run = "--force" in sys.argv
    process_maps(force=force_run)
