"""Import identified equipment artwork. Normal builds use checked-in local sheets.

Game artwork belongs to Grinding Gear Games; PoE2DB supplies the item correspondence.
Source URLs and original/thumbnail hashes are retained for verification.
"""
import base64
import concurrent.futures
import gzip
import hashlib
import html
import json
import os
import re
import subprocess
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools/.equipment-icon-cache"
DEST = ROOT / "images/poe2/equipment/icons"
CACHE.mkdir(exist_ok=True)
DEST.mkdir(parents=True, exist_ok=True)


def download(url):
    key = hashlib.sha256(url.encode()).hexdigest()
    cached = CACHE / key
    if not cached.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=40) as response:
            data = response.read()
        cached.write_bytes(data)
    return cached.read_bytes()


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.current = None
        self.entries = {}
        self.skip_span = 0
        self.divs = []
        self.pending_image = None
        self.item_images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div":
            self.divs.append(attrs.get("class", "").split())
        if tag == "a":
            href = attrs.get("href", "").rstrip("#").rsplit("/", 1)[-1]
            self.current = [href, [], []] if re.fullmatch(r"[A-Za-z0-9_'%-]+", href) else None
            self.skip_span = 0
            if self.current and self.pending_image and "UniqueItem" in attrs.get("class", "").split():
                self.current[2].append(self.pending_image)
                self.pending_image = None
        elif tag == "span" and (self.skip_span or "uniqueTypeLine" in attrs.get("class", "").split()):
            self.skip_span += 1
        elif tag == "img":
            src = attrs.get("src", "")
            if "/2ditems/" in src.lower() or ("web.poecdn.com/protected/image/poe2/" in src and "/items/" in src):
                if any("itemboximage" in classes for classes in self.divs):
                    self.item_images.append(src)
                if self.current:
                    self.current[2].append(src)
                elif any("flex-shrink-0" in classes for classes in self.divs):
                    self.pending_image = src

    def handle_data(self, data):
        if self.current and not self.skip_span:
            self.current[1].append(data)

    def handle_endtag(self, tag):
        if tag == "div" and self.divs:
            self.divs.pop()
        if tag == "span" and self.skip_span:
            self.skip_span -= 1
        if tag != "a" or not self.current:
            return
        slug, parts, sources = self.current
        self.current = None
        entry = self.entries.setdefault(slug, {"names": [], "sources": []})
        name = "".join(parts).strip()
        if name and name not in entry["names"]:
            entry["names"].append(name)
        entry["sources"] = list(dict.fromkeys(entry["sources"] + sources))


def page(path):
    parser = Links()
    parser.feed(download("https://poe2db.tw/" + path).decode())
    return path, parser.entries


classes = ["Amulets", "Belts", "Body_Armours", "Boots", "Bows", "Bucklers", "Crossbows",
           "Foci", "Gloves", "Helmets", "One_Hand_Maces", "Quivers", "Rings", "Sceptres",
           "Shields", "Spears", "Staves", "Talismans", "Two_Hand_Maces", "Wands", "Quarterstaves"]
paths = ["us/Unique_item", "jp/Unique_item"] + ["us/" + kind for kind in classes]
print("Identifying equipment images from English and Japanese records…", flush=True)
with concurrent.futures.ThreadPoolExecutor(10) as pool:
    pages = dict(pool.map(page, paths))

runtime = ROOT / "assets/simulator-engine/v0.0.46"
manifest = json.loads((runtime / "runtime.json").read_text())
source = json.loads(gzip.decompress(b"".join((runtime / part["file"]).read_bytes() for part in manifest["data"]["parts"])))
uniques = json.loads(source["files"]["overlay/uniques.json"])["uniques"]
bases = json.loads((ROOT / "data/simulator-equipment.json").read_text())["bases"]
names = json.loads((ROOT / "data/simulator-localization.json").read_text())["names"]
entities = json.loads((ROOT / "data/core-entities.json").read_text())
aliases = {entry["englishName"]: [entry["name"], *entry.get("aliases", [])]
           for entry in entities if entry["kind"] == "equipment"}

by_name = {}
for path, records in pages.items():
    if path.startswith("jp/"):
        continue
    for slug, record in records.items():
        if not record["sources"]:
            continue
        for name in record["names"]:
            by_name.setdefault(name, (slug, record))

# Some engine items are drop-disabled and omitted from the current listing. Only
# accept their own item page and its inventory image, never a similar item's art.
def fallback(item):
    name = item["name"]
    slug = re.sub(r"['’]", "", name).replace(" ", "_")
    try:
        body = download("https://poe2db.tw/us/" + slug).decode()
        title = html.unescape(re.search(r"<title>(.*?)</title>", body, re.S)[1])
        parser = Links()
        parser.feed(body)
        if (title.startswith(name + " ") or title.startswith(slug + " ")) and parser.item_images:
            return name, (slug, {"sources": parser.item_images, "names": [name]})
    except Exception:
        pass
    return name, None


with concurrent.futures.ThreadPoolExecutor(8) as pool:
    for name, match in pool.map(fallback, [item for item in uniques if item["name"] not in by_name]):
        if match:
            by_name[name] = match

# The engine retains the old combined name. Its default generated item explicitly
# selects variant 6 (Lightning), now named Guiding Palm of the Mind. Other pasted
# variants are resolved by their granted Purity skill in the browser matcher.
by_name["Guiding Palm"] = by_name["Guiding Palm of the Mind"]
grand_slug, grand_record = by_name["Grand Spectrum"]
grand_page = Links()
grand_page.feed(download("https://poe2db.tw/us/" + grand_slug).decode())

entries, missing = [], []
for kind, items in [("unique", uniques), ("base", bases)]:
    for item_index, item in enumerate(items):
        name = item["name"]
        match = by_name.get(name)
        if not match:
            missing.append({"kind": kind, "name": name})
            continue
        slug, record = match
        japanese = pages["jp/Unique_item"].get(slug, {}).get("names", []) if kind == "unique" and name != "Guiding Palm" else []
        verified_names = list(dict.fromkeys([name, *japanese, names.get(name, ""), item.get("label", ""), *aliases.get(name, [])]))
        image_source = record["sources"][0]
        if name == "Grand Spectrum":
            image_source = next(src for src in grand_page.item_images if "GrandSpectrum_" + item["base"] + "." in src)
        entries.append({"id": kind + ":" + (item["id"].rsplit("/", 1)[-1] if kind == "base" else name + ":" + item["base"]), "name": name,
                        "names": [value for value in verified_names if value], "kind": kind,
                        **({"baseId": item["id"]} if kind == "base" else {"uniqueId": item_index, "itemBase": item["base"]}),
                        **({"note": "Legacy combined engine entry; unique draft selects variant 6, Lightning. Its artwork is the current Guiding Palm of the Mind. Pasted Fire/Cold variants resolve to their own family artwork."} if name == "Guiding Palm" else {}),
                        "source": image_source, "reference": "https://poe2db.tw/us/" + slug})


def asset(entry):
    data = download(entry["source"])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    else:
        raise ValueError("Not an image: " + entry["source"])
    original_sha = hashlib.sha256(data).hexdigest()
    # Display thumbnails preserve transparency and aspect ratio. Keep the source
    # hash separately; normal page views must not download full inventory renders.
    thumbnail = subprocess.run(["convert", "-", "-thumbnail", "96x96>", "-quality", "86", "-define", "webp:alpha-quality=100", "webp:-"],
                               input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout
    return entry | {"sourceSha256": original_sha, "sourceFormat": mime.split("/")[1],
                    "sha256": hashlib.sha256(thumbnail).hexdigest()}, "image/webp", thumbnail


print(f"Fetching {len(entries)} identified equipment images; {len(missing)} unresolved records", flush=True)
with concurrent.futures.ThreadPoolExecutor(16) as pool:
    assets = list(pool.map(asset, entries))

# Dedupe identical artwork, retaining independent item IDs and aliases.
images = {}
for entry, mime, data in assets:
    images.setdefault(entry["sha256"], (mime, data))
locations = {}
image_list = list(images.items())
for offset in range(0, len(image_list), 16):
    sheet = f"equipment-{offset // 16:02d}.svg"
    svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="96" height="96" viewBox="0 0 96 96">'
    for i, (sha, (mime, data)) in enumerate(image_list[offset:offset + 16]):
        fragment = f"item-{i}"
        svg += f'<view id="{fragment}" viewBox="0 {i * 96} 96 96"/><image x="0" y="{i * 96}" width="96" height="96" preserveAspectRatio="xMidYMid meet" xlink:href="data:{mime};base64,{base64.b64encode(data).decode()}"/>'
        locations[sha] = "/images/poe2/equipment/icons/" + sheet + "#" + fragment
    (DEST / sheet).write_text(svg + "</svg>\n")

catalog = {"checkedAt": os.environ.get("EQUIPMENT_ICON_DATE", datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat()),
           "rights": "Game artwork © Grinding Gear Games; identification via PoE2DB.",
           "entries": [entry | {"src": locations[entry["sha256"]]} for entry, _, _ in assets],
           "unresolved": missing}
(ROOT / "data/equipment-icons.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"entries": len(assets), "uniqueArtwork": len(images), "unresolved": missing}, ensure_ascii=False), flush=True)
