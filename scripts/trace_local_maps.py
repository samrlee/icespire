#!/usr/bin/env python3
"""Trace the official local maps into SVG geometry.

The sub-maps used to be drawn by hand, room by room, from a reading of the
official sheet — which meant every wall was an estimate and the layouts drifted
from the source. This traces them instead. It segments a scan into layers,
vectorises each one, and writes the paths out as generated TypeScript modules
that the site renders in the campaign's own palette.

Three kinds of sheet, three ways in:

  dungeon  a battle mat — bright floor against dark stone. Layers: the floor
           and the ink drawn inside it (walls, pillars, stairs, rubble).
  outdoor  a sheet that is all ground — a ranch, a hilltop, a camp. Layers:
           the structures the ink encloses, and the linework whole.
  town     the painted Phandalin sheet. Layers: roads, buildings, woods, water,
           and the ink that draws the buildings.

What ships is geometry, never the scan. Lettering is deliberately dropped on
the way through — the site draws its own labels.

Usage:
    pip install -r scripts/requirements.txt
    python3 scripts/trace_local_maps.py             # every map in the config
    python3 scripts/trace_local_maps.py phandalin   # just these slugs
    python3 scripts/trace_local_maps.py --preview   # also write tuning previews

Tuning a map: run with --preview, open scripts/previews/<slug>.png — traced
floor outlined in red, ink filled blue — and adjust that map's entry in
scripts/local-maps.json. `floorLow`/`floorHigh` are the hysteresis thresholds
on 0-255 luminance: a region is floor when it is above floorLow and connected
to a seed above floorHigh. Raise floorHigh when background texture leaks in;
lower floorLow when real floor is being clipped.
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure, morphology

warnings.filterwarnings("ignore", category=FutureWarning)

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "scripts" / "local-maps.json"
SOURCE_DIR = ROOT / "offical-assets" / "Maps"
OUT_DIR = ROOT / "src" / "components" / "map" / "submaps" / "traced"
PREVIEW_DIR = ROOT / "scripts" / "previews"

# The scan is resampled to this width before segmentation. Big enough that a
# wall is several pixels thick, small enough that the morphology is quick.
WORK_WIDTH = 1800

# Every official sheet in this set is drawn on a five-foot grid.
FEET_PER_SQUARE = 5


@dataclass
class MapConfig:
    slug: str
    source: str
    kind: str
    ignore: list[list[float]]
    margin: float
    floor_low: float
    floor_high: float
    ink: float
    min_floor_area: float  # as a fraction of the working image
    close: int
    open_: int
    simplify: float
    canvas: int
    town_ink: float
    road_lum: float
    road_green: float
    green_cut: float
    seal_gap: int
    detail_min: int
    seed_open: int
    glyph_area: int
    glyph_span: int
    grid_px: float | None
    pois: list[dict]

    @classmethod
    def from_json(cls, slug: str, raw: dict) -> "MapConfig":
        return cls(
            slug=slug,
            source=raw["source"],
            kind=raw.get("kind", "dungeon"),
            ignore=raw.get("ignore", []),
            margin=raw.get("margin", 0.0),
            floor_low=raw.get("floorLow", 146),
            floor_high=raw.get("floorHigh", 182),
            ink=raw.get("ink", 95),
            min_floor_area=raw.get("minFloorArea", 0.0004),
            close=raw.get("close", 5),
            open_=raw.get("open", 4),
            simplify=raw.get("simplify", 1.1),
            canvas=raw.get("canvas", 900),
            town_ink=raw.get("townInk", 66),
            road_lum=raw.get("roadLum", 126),
            road_green=raw.get("roadGreen", 12),
            green_cut=raw.get("greenCut", 13),
            seal_gap=raw.get("sealGap", 3),
            detail_min=raw.get("detailMin", 220),
            seed_open=raw.get("seedOpen", 5),
            glyph_area=raw.get("glyphArea", 220),
            glyph_span=raw.get("glyphSpan", 30),
            grid_px=raw.get("gridPx"),
            pois=raw.get("pois", []),
        )


def load_image(path: Path) -> tuple[Image.Image, float]:
    """Return the working-resolution image and the scale from source pixels."""
    im = Image.open(path).convert("RGB")
    scale = WORK_WIDTH / im.width
    work = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return work, scale


def floor_mask(lum: np.ndarray, cfg: MapConfig) -> np.ndarray:
    """Segment the walkable floor.

    The floors on these sheets are bright and near-neutral; the surrounding
    stone texture is darker and warmer, but its brightest patches overlap the
    dimmest floor. A single threshold therefore either drops floor or drags in
    background, so this uses hysteresis: seed on pixels that are unambiguously
    floor, then grow through anything merely floor-ish that touches a seed.

    Opening the seed also keeps the sheet's own lettering out: bright display
    type is a seed candidate on brightness alone, but no stroke in it is as
    wide as the narrowest corridor, so none of it survives the opening.
    """
    smooth = ndi.median_filter(lum, size=5)
    weak = smooth > cfg.floor_low
    seed = morphology.opening(smooth > cfg.floor_high, morphology.disk(cfg.seed_open))
    mask = ndi.binary_propagation(seed, mask=weak)

    # Bridge the ink lines drawn across the floor, then shave the texture
    # speckle the growth picked up along the way.
    mask = morphology.closing(mask, morphology.disk(cfg.close))
    mask = morphology.opening(mask, morphology.disk(cfg.open_))
    mask = ndi.binary_fill_holes(mask)

    min_area = int(cfg.min_floor_area * mask.size)
    mask = morphology.remove_small_objects(mask, min_area)
    mask = morphology.remove_small_holes(mask, min_area)
    return mask


def ink_mask(lum: np.ndarray, floor: np.ndarray, cfg: MapConfig) -> np.ndarray:
    """The dark linework inside the floor: walls, pillars, stairs, rubble.

    Room codes come through this threshold as readily as walls do, and the
    campaign draws its own labels, so they get dropped here: a glyph is a
    small blob that spans little in either direction, where every piece of
    structure on these sheets is either long or solid.
    """
    ink = (ndi.median_filter(lum, size=3) < cfg.ink) & morphology.erosion(
        floor, morphology.disk(1)
    )
    ink = morphology.opening(ink, morphology.disk(1))
    ink = morphology.remove_small_objects(ink, 20)

    labelled, count = ndi.label(ink)
    if count:
        keep = np.zeros(count + 1, dtype=bool)
        areas = ndi.sum_labels(ink, labelled, index=range(1, count + 1))
        for i, box in enumerate(ndi.find_objects(labelled), start=1):
            span = max(box[0].stop - box[0].start, box[1].stop - box[1].start)
            keep[i] = span >= cfg.glyph_span or areas[i - 1] >= cfg.glyph_area
        ink = keep[labelled]
    return ink


def drop_glyphs(mask: np.ndarray, cfg: MapConfig) -> np.ndarray:
    """Drop lettering: small blobs that span little in either direction.

    Every piece of structure on these sheets is either long or solid, so this
    takes the room codes and place names and leaves the map.
    """
    labelled, count = ndi.label(mask)
    if not count:
        return mask
    areas = ndi.sum_labels(mask, labelled, index=range(1, count + 1))
    keep = np.zeros(count + 1, dtype=bool)
    for i, box in enumerate(ndi.find_objects(labelled), start=1):
        span = max(box[0].stop - box[0].start, box[1].stop - box[1].start)
        keep[i] = span >= cfg.glyph_span or areas[i - 1] >= cfg.glyph_area
    return keep[labelled]


def town_layers(a: np.ndarray, cfg: MapConfig) -> dict[str, np.ndarray]:
    """Segment a painted overland sheet into the things a town is made of.

    Nothing here is bright-floor-against-dark-stone, so the dungeon pass is no
    use. This one reads the paint instead. Roads are pale and un-green where
    everything around them is grass. Buildings are roofs fenced in by ink:
    the artist outlines every one in near-black, well below anything in the
    paint, so sealing that ink and taking what it encloses finds them.
    """
    lum = a.mean(axis=2)
    green = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    blue = a[..., 2] - (a[..., 0] + a[..., 1]) / 2
    smooth = ndi.median_filter(lum, size=3)

    # Doors and arrow slits are drawn as breaks in a wall, and a wall with a
    # break in it encloses nothing. Closing the ink first bridges gaps up to
    # `sealGap` wide so a building still reads as a building.
    sealed = morphology.closing(smooth < cfg.town_ink, morphology.disk(cfg.seal_gap))
    enclosed = ndi.binary_fill_holes(sealed) & ~sealed
    enclosed = morphology.remove_small_objects(enclosed, 120)

    labelled, count = ndi.label(enclosed)
    keep = np.zeros(count + 1, dtype=bool)
    if count:
        areas = ndi.sum_labels(enclosed, labelled, index=range(1, count + 1))
        greens = ndi.median(green, labelled, index=range(1, count + 1))
        for i, box in enumerate(ndi.find_objects(labelled), start=1):
            h = box[0].stop - box[0].start
            w = box[1].stop - box[1].start
            keep[i] = (
                200 <= areas[i - 1] <= 40000
                and max(h, w) < 300
                and areas[i - 1] / (h * w) > 0.35
                and greens[i - 1] < cfg.green_cut + 7
            )
    buildings = keep[labelled]
    # A roof cut into pieces by its own ridge lines comes through as several
    # patches. Growing them a little and letting them close over the ink that
    # divides them puts each building back together, outline included.
    buildings = morphology.dilation(buildings, morphology.disk(2)) & (enclosed | sealed)
    buildings = ndi.binary_fill_holes(buildings)
    buildings = morphology.remove_small_objects(buildings, 300)

    roads = (lum > cfg.road_lum) & (green < cfg.road_green)
    roads = morphology.opening(roads, morphology.disk(3))
    roads = morphology.closing(roads, morphology.disk(6))
    roads = morphology.remove_small_objects(roads, 3000)
    roads = roads & ~buildings

    # Woodland reads as one shape rather than several thousand inked leaves.
    woods = ndi.median_filter(green, size=9) > cfg.green_cut + 6
    woods = woods & (ndi.median_filter(lum, size=9) < cfg.road_lum)
    woods = morphology.closing(woods, morphology.disk(4))
    woods = morphology.opening(woods, morphology.disk(3))
    woods = morphology.remove_small_objects(woods, 2500)
    woods = woods & ~(buildings | roads)

    water = (ndi.median_filter(blue, size=5) > 4) & (lum > 90)
    water = morphology.opening(water, morphology.disk(3))
    water = morphology.remove_small_objects(water, 900)

    # The linework worth keeping is the part that draws the buildings: their
    # outlines and roof ridges. The rest of the sheet's ink is contour
    # hatching and foliage, which the areas above already say better.
    ink = (smooth < cfg.town_ink) & morphology.dilation(buildings, morphology.disk(2))
    ink = morphology.remove_small_objects(ink, 40)
    ink = drop_glyphs(ink, cfg)

    if cfg.kind == "outdoor":
        # An outdoor sheet is all ground, so there is no road network to pull
        # out and no woodland worth separating from it. What carries the site
        # is its structures and the linework around them — walls, contours,
        # boulder fields — so the ink is kept whole rather than clipped to
        # the buildings.
        loose = morphology.remove_small_objects(smooth < cfg.town_ink, cfg.detail_min)
        return {"buildings": buildings, "ink": drop_glyphs(loose, cfg)}

    return {
        "woods": woods,
        "water": water,
        "roads": roads,
        "buildings": buildings,
        "ink": ink,
    }


def detect_grid_px(lum: np.ndarray, floor: np.ndarray) -> float | None:
    """Measure the five-foot grid pitch, in working pixels.

    Gives the maps a scale bar that is measured rather than guessed. Returns
    None when no convincing periodicity shows up, in which case the caller
    falls back to the config.
    """
    inner = morphology.erosion(floor, morphology.disk(6))
    if inner.sum() < 5000:
        return None
    rows = np.flatnonzero(inner.any(axis=1))
    cols = np.flatnonzero(inner.any(axis=0))
    patch = lum[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]
    weight = inner[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1].astype(np.float32)

    periods = []
    for axis in (0, 1):
        # Collapse along one axis, keeping only floor pixels, then look for the
        # repeating dip the grid rules leave behind.
        num = (patch * weight).sum(axis=axis)
        den = weight.sum(axis=axis)
        keep = den > 0.5 * den.max()
        if keep.sum() < 64:
            continue
        signal = np.where(keep, num / np.maximum(den, 1), np.nan)
        signal = signal[keep]
        signal = signal - ndi.uniform_filter1d(signal, size=31)
        signal = signal - signal.mean()
        corr = np.correlate(signal, signal, mode="full")[len(signal) - 1 :]
        corr /= corr[0] if corr[0] else 1
        lo, hi = 8, min(80, len(corr) - 1)
        if hi <= lo:
            continue
        peak = lo + int(np.argmax(corr[lo:hi]))
        if corr[peak] > 0.25:
            periods.append(float(peak))

    if not periods:
        return None
    return float(np.mean(periods))


def contours_to_paths(mask: np.ndarray, tolerance: float, transform) -> str:
    """Vectorise a binary mask into one SVG path (even-odd handles the holes)."""
    padded = np.pad(mask.astype(np.float32), 1)
    parts = []
    for contour in measure.find_contours(padded, 0.5):
        poly = measure.approximate_polygon(contour, tolerance=tolerance)
        if len(poly) < 4:
            continue
        pts = [transform(x - 1, y - 1) for y, x in poly]
        # find_contours closes its loops, so drop the repeated last point.
        if pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) < 3:
            continue
        head = f"M {pts[0][0]} {pts[0][1]}"
        rest = " ".join(f"L {x} {y}" for x, y in pts[1:])
        parts.append(f"{head} {rest} Z")
    return " ".join(parts)


def trace(cfg: MapConfig, preview: bool) -> dict:
    source = SOURCE_DIR / cfg.source
    if not source.exists():
        raise SystemExit(f"{cfg.slug}: missing source scan {source}")

    work, scale = load_image(source)
    a = np.asarray(work).astype(np.float32)
    lum = a.mean(axis=2)

    blanks = list(cfg.ignore)
    if cfg.margin:
        # The decorative border runs right around the sheet and is ink by any
        # threshold, so trim it off before anything looks at the paint.
        m = cfg.margin
        blanks += [[0, 0, 1, m], [0, 1 - m, 1, 1], [0, 0, m, 1], [1 - m, 0, 1, 1]]
    for x0f, y0f, x1f, y1f in blanks:
        # Sheet furniture — a title cartouche, a compass, a scale bar — given
        # in fractions of the sheet. Painted out in a grey that reads as none
        # of the things the passes below look for.
        a[
            round(y0f * a.shape[0]) : round(y1f * a.shape[0]),
            round(x0f * a.shape[1]) : round(x1f * a.shape[1]),
        ] = (110, 105, 110)
    lum = a.mean(axis=2)

    if cfg.kind in ("town", "outdoor"):
        layers = town_layers(a, cfg)
        floor = layers.get("roads", layers["buildings"])
        extent = layers["buildings"] | (
            layers["roads"] if "roads" in layers else layers["ink"]
        )
    else:
        floor = floor_mask(lum, cfg)
        if not floor.any():
            raise SystemExit(f"{cfg.slug}: no floor found — check floorLow/floorHigh")
        layers = {"floor": floor, "ink": ink_mask(lum, floor, cfg)}
        extent = floor

    # Crop to what was actually traced, so the sheet's empty margins and its
    # decorative border don't eat the canvas.
    rows = np.flatnonzero(extent.any(axis=1))
    cols = np.flatnonzero(extent.any(axis=0))
    pad = 12
    y0 = max(0, rows[0] - pad)
    y1 = min(extent.shape[0], rows[-1] + 1 + pad)
    x0 = max(0, cols[0] - pad)
    x1 = min(extent.shape[1], cols[-1] + 1 + pad)

    # Fit the crop into a canvas of the configured width, north up, no rotation.
    unit = cfg.canvas / (x1 - x0)
    width = cfg.canvas
    height = round((y1 - y0) * unit)

    def to_canvas(x: float, y: float) -> tuple[float, float]:
        """Working-image pixel -> canvas unit."""
        return (round((x - x0) * unit, 1), round((y - y0) * unit, 1))

    def crop_to_canvas(x: float, y: float) -> tuple[float, float]:
        """Cropped-image pixel -> canvas unit (the crop already did the shift)."""
        return (round(x * unit, 1), round(y * unit, 1))

    # How hard each layer is straightened. Ink is fine detail and keeps most
    # of its vertices; buildings are quadrilaterals and want their corners
    # sharpened rather than traced round.
    tolerances = {
        "ink": cfg.simplify * (1.2 if cfg.kind == "outdoor" else 0.6),
        "buildings": cfg.simplify * 2,
        "woods": cfg.simplify * 2.5,
        "roads": cfg.simplify * 1.4,
    }
    paths = {
        name: contours_to_paths(
            mask[y0:y1, x0:x1], tolerances.get(name, cfg.simplify), crop_to_canvas
        )
        for name, mask in layers.items()
    }

    # The battle-mat sheets carry a five-foot grid; the painted town sheet
    # does not. On an outdoor sheet the grid runs edge to edge rather than
    # only over the floor, so it is measured against the sheet itself.
    grid_px = cfg.grid_px
    measured = not cfg.grid_px
    if not grid_px and cfg.kind == "dungeon":
        grid_px = detect_grid_px(lum, floor)
    elif not grid_px and cfg.kind == "outdoor":
        inset = np.zeros_like(extent)
        my, mx = round(0.12 * inset.shape[0]), round(0.12 * inset.shape[1])
        inset[my:-my, mx:-mx] = True
        grid_px = detect_grid_px(lum, inset)

    def feet_for(pitch: float | None) -> float | None:
        return FEET_PER_SQUARE / (pitch * unit) if pitch else None

    # Points of interest are read off the sheet by eye, so they land close to
    # the room rather than exactly in it. Snapping each one to the nearest
    # traced structure takes that slack out.
    anchor = layers.get("floor")
    if anchor is None:
        anchor = layers["buildings"] | layers["ink"]
    anchor = anchor[y0:y1, x0:x1]
    snap_limit = 0.05 * (x1 - x0)
    if anchor.any():
        distance, nearest = ndi.distance_transform_edt(~anchor, return_indices=True)
    else:
        distance = nearest = None

    pois = []
    for poi in cfg.pois:
        # Config records points of interest in source-scan pixels, which is the
        # only coordinate space a person can read off the official sheet. `at`
        # is optional: an entry the sheet does not pin down keeps its place in
        # the key and simply goes unmarked on the map.
        entry = {
            "label": poi["label"],
            "note": poi.get("note"),
            "danger": bool(poi.get("danger")),
        }
        if poi.get("at"):
            px = poi["at"][0] * scale - x0
            py = poi["at"][1] * scale - y0
            if distance is not None and 0 <= py < anchor.shape[0] and 0 <= px < anchor.shape[1]:
                iy, ix = int(py), int(px)
                if 0 < distance[iy, ix] <= snap_limit:
                    py, px = nearest[0][iy, ix], nearest[1][iy, ix]
            entry["x"], entry["y"] = crop_to_canvas(px, py)
        pois.append(entry)

    if preview:
        PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
        vis = np.asarray(work).copy()
        if "buildings" in layers:
            vis[layers["buildings"]] = [40, 90, 230]
        if "roads" in layers:
            vis[layers["roads"]] = [250, 220, 80]
        if "ink" in layers:
            vis[layers["ink"]] = [40, 90, 220]
        vis[floor ^ morphology.erosion(floor, morphology.disk(2))] = [255, 40, 40]
        Image.fromarray(vis[y0:y1, x0:x1]).save(PREVIEW_DIR / f"{cfg.slug}.png")

    return {
        "width": width,
        "height": height,
        "paths": paths,
        "feetPerUnit": feet_for(grid_px),
        "gridPx": grid_px,
        "measured": measured,
        "feetFor": feet_for,
        "pois": pois,
        "kind": "town" if cfg.kind == "town" else "dungeon",
        # How much of the sheet the main layer claimed. A dungeon sheet that
        # claims most of it is really an outdoor sheet under the wrong pass.
        "coverage": float(floor.mean()),
        "source": cfg.source,
    }


def write_module(slug: str, data: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{slug}.ts"

    def ts(value) -> str:
        return json.dumps(value)

    poi_lines = ",\n".join(
        "    { "
        + ", ".join(
            filter(
                None,
                [
                    f"label: {ts(p['label'])}",
                    f"note: {ts(p['note'])}" if p["note"] else None,
                    "danger: true" if p["danger"] else None,
                    f"x: {p['x']}" if "x" in p else None,
                    f"y: {p['y']}" if "y" in p else None,
                ],
            )
        )
        + " }"
        for p in data["pois"]
    )

    feet = round(data["feetPerUnit"], 4) if data["feetPerUnit"] else None
    path_lines = "".join(
        f"  {name}:\n    {ts(d)},\n" for name, d in sorted(data["paths"].items()) if d
    )
    body = f"""// Generated by scripts/trace_local_maps.py — do not edit by hand.
// Traced from offical-assets/Maps/{data["source"]}; re-run the script to update.
import type {{ TracedMap }} from './types';

const map: TracedMap = {{
  kind: {ts(data["kind"])},
  width: {data["width"]},
  height: {data["height"]},
  feetPerUnit: {feet if feet else "null"},
  pois: [
{poi_lines}
  ],
{path_lines}}};

export default map;
"""
    path.write_text(body)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*", help="map slugs to trace (default: all)")
    parser.add_argument("--preview", action="store_true", help="write tuning previews")
    args = parser.parse_args()

    config = json.loads(CONFIG.read_text())
    slugs = args.slugs or list(config)
    unknown = [s for s in slugs if s not in config]
    if unknown:
        raise SystemExit(f"unknown slug(s): {', '.join(unknown)}")

    traced = {}
    for slug in slugs:
        cfg = MapConfig.from_json(slug, config[slug])
        traced[slug] = (cfg, trace(cfg, args.preview))

    # Every sheet in this set is drawn at the same grid pitch, so the sheets
    # check each other: a measurement that disagrees with the rest of the run
    # has locked onto a harmonic, and takes the consensus pitch instead.
    pitches = [d["gridPx"] for _, d in traced.values() if d["gridPx"] and d["measured"]]
    consensus = float(np.median(pitches)) if len(pitches) >= 3 else None

    for slug, (cfg, data) in traced.items():
        note = ""
        if consensus and data["measured"] and data["gridPx"]:
            if abs(data["gridPx"] - consensus) / consensus > 0.2:
                data["feetPerUnit"] = data["feetFor"](consensus)
                note = "  (grid from consensus)"
        write_module(slug, data)

        scale = (
            f"{1 / data['feetPerUnit']:.1f} units/ft" if data["feetPerUnit"] else "no grid"
        )
        sizes = "  ".join(
            f"{name} {len(d) // 1024}kb" for name, d in sorted(data["paths"].items())
        )
        print(
            f"{slug:26s} {cfg.kind:8s} {data['width']}x{data['height']}  "
            f"{sizes}  {scale}  cover {data['coverage']:.0%}{note}"
        )


if __name__ == "__main__":
    sys.exit(main())
