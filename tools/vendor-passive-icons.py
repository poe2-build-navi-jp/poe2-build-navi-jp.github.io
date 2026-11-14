"""Extract the pinned 0.5 passive art into one local, reusable sprite sheet.

Requires Pillow and zstandard. Normal site builds use the checked-in output.
Game artwork is copyright Grinding Gear Games; source correspondence is retained.
"""
import concurrent.futures
import gzip
import hashlib
import io
import json
import math
import re
import struct
import urllib.request
from pathlib import Path

import zstandard
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
COMMIT = "601768bd105869618c3d6581b883e5d7aeec91b2"
BASE = f"https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/{COMMIT}/src/TreeData/0_5/"
CACHE = ROOT / "tools/.passive-icon-cache"
DEST = ROOT / "images/poe2/passives"
TILE, COLUMNS = 64, 24


def sha(data):
    return hashlib.sha256(data).hexdigest()


def download(name):
    target = CACHE / name
    if not target.exists():
        request = urllib.request.Request(BASE + name, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=50) as response:
            target.write_bytes(response.read())
    return target.read_bytes()


def decode_array(packed):
    """DDS DX10 arrays store each layer's entire mip chain consecutively."""
    data = zstandard.ZstdDecompressor().decompress(packed)
    if data[:4] != b"DDS " or data[84:88] != b"DX10":
        raise ValueError("Expected a DDS DX10 array")
    height, width = struct.unpack_from("<II", data, 12)
    mip_count = struct.unpack_from("<I", data, 28)[0] or 1
    format_id, _, _, layers, _ = struct.unpack_from("<5I", data, 128)
    block_bytes = {71: 8, 72: 8, 98: 16, 99: 16}[format_id]
    stride = sum(max(1, (max(1, width >> m) + 3) // 4) * max(1, (max(1, height >> m) + 3) // 4) * block_bytes for m in range(mip_count))
    if len(data) != 148 + layers * stride:
        raise ValueError("Unexpected DDS layer length")
    header = bytearray(data[:148])
    struct.pack_into("<I", header, 140, 1)

    def layer(index):
        if not 1 <= index <= layers:
            raise ValueError("DDS layer outside source array")
        start = 148 + (index - 1) * stride
        return Image.open(io.BytesIO(bytes(header) + data[start:start + stride])).convert("RGBA")

    return layer


def main():
    CACHE.mkdir(exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    source_bytes = download("tree.json")
    source = json.loads(source_bytes)
    runtime_dir = ROOT / "assets/simulator-engine/v0.0.46"
    runtime = json.loads((runtime_dir / "runtime.json").read_text())
    packed = b"".join((runtime_dir / part["file"]).read_bytes() for part in runtime["data"]["parts"])
    if sha(packed) != runtime["data"]["sha256"]:
        raise ValueError("Runtime checksum mismatch")
    files = json.loads(gzip.decompress(packed))["files"]
    nodes = json.loads(files["base/passive_tree.json"])
    # Prefer active art. The disabled sheets have identical names and layers.
    coordinates = {key: (filename, value) for filename, entries in source["ddsCoords"].items() if not filename.startswith("skills-disabled") for key, value in entries.items()}
    records, icon_keys = {}, set()
    for node in nodes:
        original = source["nodes"][str(node["skill"])]
        plain_name = re.sub(r"\[([^\]|]+)\|([^\]]+)\]", r"\2", node["name"]).replace("[", "").replace("]", "")
        if original["stringId"] != node["id"] or (original["name"] != plain_name and node["kind"] != "ascendancy_start"):
            raise ValueError(f"Node identity mismatch: {node['skill']}")
        key = original.get("icon")
        if node["kind"] == "mastery":
            key = original["activeEffectImage"]
        elif not key and node["kind"] == "jewel_socket":
            key = original["nodeOverlay"]["unalloc"]
        if key not in coordinates:
            raise ValueError(f"No identified icon: {node['skill']}")
        icon_keys.add(key)
        records[str(node["skill"])] = {"name": node["name"], "kind": node["kind"], "sourceId": node["id"], "sourceName": original["name"], "key": key}

    ordered = sorted(icon_keys)
    filenames = sorted({coordinates[key][0] for key in ordered})
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        buffers = dict(zip(filenames, pool.map(download, filenames)))
    decoders = {name: decode_array(data) for name, data in buffers.items()}
    sheet = Image.new("RGBA", (COLUMNS * TILE, math.ceil(len(ordered) / COLUMNS) * TILE), (0, 0, 0, 0))
    icons = []
    for index, key in enumerate(ordered):
        filename, coordinate = coordinates[key]
        if isinstance(coordinate, int):
            layer, crop = coordinate, None
        else:
            x, y, width, height, layer = coordinate
            crop = (x, y, x + width, y + height)
        image = decoders[filename](layer)
        if crop:
            image = image.crop(crop)
        image.thumbnail((TILE, TILE), Image.Resampling.LANCZOS)
        x, y = index % COLUMNS * TILE, index // COLUMNS * TILE
        sheet.alpha_composite(image, (x + (TILE - image.width) // 2, y + (TILE - image.height) // 2))
        icons.append({"key": key, "x": x, "y": y, "sourceFile": filename, "sourceLayer": layer, "sourceCrop": list(crop) if crop else None})
    output = io.BytesIO()
    sheet.save(output, format="WEBP", quality=88, method=6)
    image_bytes = output.getvalue()
    image_name = f"passive-icons-{sha(image_bytes)[:12]}.webp"
    (DEST / image_name).write_bytes(image_bytes)
    indexes = {key: index for index, key in enumerate(ordered)}
    for record in records.values():
        record["icon"] = indexes[record.pop("key")]
    manifest = {
        "treeVersion": "0_5", "dataVersion": runtime["dataVersion"],
        "source": {"repository": "https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2", "commit": COMMIT, "baseUrl": BASE, "treeSha256": sha(source_bytes), "files": {filename: sha(buffers[filename]) for filename in filenames}},
        "copyright": "Game artwork © Grinding Gear Games.",
        "sheet": {"url": "/images/poe2/passives/" + image_name, "sha256": sha(image_bytes), "bytes": len(image_bytes), "width": sheet.width, "height": sheet.height, "tile": TILE},
        "icons": icons, "nodes": records,
    }
    (ROOT / "data/passive-icons.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Identified {len(records)} nodes; {len(icons)} icons; {len(image_bytes):,} bytes in one local sheet.")


if __name__ == "__main__":
    main()
