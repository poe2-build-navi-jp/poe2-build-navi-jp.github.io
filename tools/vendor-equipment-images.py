"""Import identified game inventory art. Normal builds use the checked-in catalog.

Artwork is copyright Grinding Gear Games. PoE2DB's exact item rows identify
the artwork; no generated illustrations or inferred replacement icons are used.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import sys
import time
import unicodedata
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from lxml import html
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools/.equipment-image-cache"
DEST = ROOT / "images/poe2/equipment"
CACHE.mkdir(exist_ok=True)
DEST.mkdir(parents=True, exist_ok=True)
PAGES = ["Amulets", "Belts", "Body_Armours", "Boots", "Bows", "Bucklers",
         "Crossbows", "Foci", "Gloves", "Helmets", "One_Hand_Maces", "Quivers",
         "Rings", "Sceptres", "Shields", "Spears", "Staves", "Talismans",
         "Two_Hand_Maces", "Wands", "Quarterstaves", "Unique_item"]

def key(value):
    return unicodedata.normalize("NFKC", value).replace("’", "'").casefold().strip()

def get(url, suffix):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + suffix)
    if path.exists() and "--refresh" not in sys.argv:
        return path.read_bytes()
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(request, timeout=35).read()
            path.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def discover(pair):
    locale, page = pair
    url = f"https://poe2db.tw/{locale}/{page}"
    document = html.fromstring(get(url, ".html"))
    records = []
    for row in document.xpath('//div[contains(@class,"d-flex")][div[contains(@class,"flex-shrink-0")]]'):
        pictures = row.xpath('./div[contains(@class,"flex-shrink-0")]//img')
        content = row.xpath('./div[contains(@class,"flex-grow-1")]')
        if not pictures or not content:
            continue
        source = pictures[0].get("src", "")
        if "/2ditems/" not in source.casefold() and not source.startswith("https://web.poecdn.com/protected/image/poe2/"):
            continue
        links = content[0].xpath('.//a[contains(@class,"UniqueItem")]')
        unique = bool(links)
        if not unique:
            links = content[0].xpath('./a[contains(@class,"whiteitem")]')
        if not links:
            continue
        name = content[0].xpath('.//span[contains(@class,"uniqueName")]') if unique else []
        name = name[0].text_content().strip() if name else links[0].text_content().strip()
        slug = links[0].get("href", "").rsplit("/", 1)[-1]
        if not re.fullmatch(r"[A-Za-z0-9_%'.,-]+", slug):
            continue
        base = content[0].xpath('.//span[contains(@class,"uniqueTypeLine")]')
        records.append({"id": slug, "name": name,
                        "baseNames": [base[0].text_content().strip()] if base else [],
                        "kind": "unique" if unique else "base", "source": source,
                        "reference": f"https://poe2db.tw/us/{slug}"})
    return pair, records

pairs = [("us", page) for page in PAGES] + [("jp", "Unique_item")]
with concurrent.futures.ThreadPoolExecutor(6) as pool:
    pages = dict(pool.map(discover, pairs))
print(f"Read {len(pages)} item catalogs", flush=True)
japanese = {entry["id"]: entry["name"] for entry in pages[("jp", "Unique_item")]}
bases = json.loads((ROOT / "data/simulator-equipment.json").read_text())["bases"]
wanted = {key(base["name"]): base for base in bases}
translations = json.loads((ROOT / "data/japanese-names.json").read_text())["names"]
entries = {}
for (locale, page), records in pages.items():
    if locale != "us":
        continue
    for record in records:
        if record["kind"] == "base" and key(record["name"]) not in wanted:
            continue
        aliases = [record["name"], japanese.get(record["id"])]
        if key(record["name"]) in wanted:
            base = wanted[key(record["name"])]
            aliases.append(base["label"])
            record["engineBaseIds"] = [base["id"]]
        for english, translation in translations.items():
            if key(english) == key(record["name"]):
                aliases.append(translation["ja"])
        record["names"] = list(dict.fromkeys(name for name in aliases if name))
        entries[record["id"]] = record

overrides = ROOT / "data/equipment-image-overrides.json"
if overrides.exists():
    for entry in json.loads(overrides.read_text()):
        entries[entry["id"]] = entry
records = sorted(entries.values(), key=lambda entry: entry["id"])
runtime_names = json.loads((ROOT / "data/simulator-localization.json").read_text())["names"]
for entry in records:
    if entry["name"] in runtime_names:
        entry["names"] = list(dict.fromkeys(entry["names"] + [runtime_names[entry["name"]]]))
identified = {key(entry["name"]) for entry in records if entry["kind"] == "base"}
missing = [base["name"] for base in bases if key(base["name"]) not in identified]
print(f"Identified {len(records)} item records; {len(bases)-len(missing)}/{len(bases)} editable bases. Missing: {missing}", flush=True)
(CACHE / "discovered.json").write_text(json.dumps(records, ensure_ascii=False, indent=2))
if "--discover" in sys.argv:
    sys.exit(0)

def asset(source):
    data = get(source, ".image")
    original = {}
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        width, height = image.size
        if image.format == "PNG":
            original = {"sourceFormat": "png", "sourceSha256": hashlib.sha256(data).hexdigest()}
            output = io.BytesIO()
            image.save(output, format="WEBP", lossless=True, exact=True)
            data = output.getvalue()
        elif image.format != "WEBP":
            raise ValueError(f"Unexpected source image: {source}")
    return source, {"bytes": data, "width": width, "height": height,
                    "sha256": hashlib.sha256(data).hexdigest(), **original}

sources = sorted({entry["source"] for entry in records})
with concurrent.futures.ThreadPoolExecutor(16) as pool:
    assets = dict(pool.map(asset, sources))
print(f"Verified {len(assets)} original inventory images", flush=True)

# SVG views keep the original WebP bytes. Dedup identical art across item variants.
import base64
sheets, sheet, size = [], [], 0
for sha, image in {image["sha256"]: image for image in assets.values()}.items():
    # Equipment pages show a few different items at once. One image per cached
    # resource avoids downloading an entire sheet for a single mobile thumbnail.
    if sheet:
        sheets.append(sheet)
        sheet, size = [], 0
    sheet.append((sha, image))
    size += len(image["bytes"])
if sheet:
    sheets.append(sheet)
locations = {}
for index, sheet in enumerate(sheets):
    filename = f"items-{index:02}.svg"
    svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="192" viewBox="0 0 128 192">'
    for i, (sha, image) in enumerate(sheet):
        payload = base64.b64encode(image["bytes"]).decode()
        svg += f'<view id="item-{i}" viewBox="0 {i*192} 128 192"/><image x="0" y="{i*192}" width="128" height="192" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/webp;base64,{payload}"/>'
        locations[sha] = f"/images/poe2/equipment/{filename}#item-{i}"
    (DEST / filename).write_text(svg + '</svg>\n')
for entry in records:
    image = assets[entry["source"]]
    entry.update({field: value for field, value in image.items() if field != "bytes"})
    entry["src"] = locations[image["sha256"]]
catalog = {"checkedAt": datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(),
           "rights": "Game artwork © Grinding Gear Games. Exact inventory art identified via PoE2DB.",
           "entries": records}
(ROOT / "data/equipment-images.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print(f"Saved {len(records)} item records in {len(sheets)} image sheets", flush=True)
