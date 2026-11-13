"""Refresh local game icons and their exact name correspondence from PoE2DB.

Game artwork belongs to Grinding Gear Games. This is a data import, not generated art.
Run manually when updating the catalog; normal site builds use the checked-in files.
"""
import concurrent.futures
import hashlib
import json
import re
import time
import subprocess
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "images/poe2/skills"
DEST.mkdir(parents=True, exist_ok=True)


def download(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1)


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.current = None
        self.entries = {}
        self.notable_image = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            href = attrs.get("href", attrs.get("xlink:href", "")).rstrip("#")
            if re.fullmatch(r"(?:/(?:us|jp)/)?[A-Za-z0-9_'%-]+", href):
                slug = href.rsplit("/", 1)[-1]
                self.current = [slug, [], []]
                if self.notable_image:
                    self.current[2].append(self.notable_image)
                    self.notable_image = None
        elif tag == "image" and "circle-image" in attrs.get("class", ""):
            source = attrs.get("xlink:href", "")
            self.notable_image = source if "/passives/DiscipleoftheDjinn/" in source else None
        elif tag == "img" and self.current:
            src = attrs.get("src", "")
            if "/skillicons/" in src.lower() or "/gems/new/newsupport/lineage/" in src.lower():
                self.current[2].append(src)

    def handle_data(self, data):
        if self.current:
            self.current[1].append(data)

    def handle_endtag(self, tag):
        if tag != "a" or not self.current:
            return
        slug, parts, sources = self.current
        self.current = None
        entry = self.entries.setdefault(slug, {"names": [], "sources": []})
        name = "".join(parts).strip()
        if name and name not in entry["names"]:
            entry["names"].append(name)
        for src in sources:
            if src not in entry["sources"]:
                entry["sources"].append(src)


pages = [(locale, kind) for locale in ["us", "jp"] for kind in ["Skill_Gems", "Support_Gems"]]


def page(pair):
    locale, kind = pair
    parser = Links()
    parser.feed(download(f"https://poe2db.tw/{locale}/{kind}").decode())
    return pair, parser.entries


parsed = dict(concurrent.futures.ThreadPoolExecutor(4).map(page, pages))
panels = {}
for locale in ["us", "jp"]:
    parser = Links()
    parser.feed(download(f"https://poe2db.tw/{locale}/Kelaris_Deception").decode())
    panels[locale] = parser.entries
names = json.loads((ROOT / "data/japanese-names.json").read_text())["names"]
catalog_path = ROOT / "data/skill-icons.json"
previous = {entry["id"]: entry for entry in json.loads(catalog_path.read_text())["entries"]} if catalog_path.exists() else {}
entries = []
for kind in ["Skill_Gems", "Support_Gems"]:
    for slug, entry in parsed[("us", kind)].items():
        if not entry["names"] or not entry["sources"]:
            continue
        sources = [s for s in entry["sources"] if not re.search(r"(?:rolldodge|default|unknown)\.", s, re.I)]
        granting = []
        if not sources and kind == "Skill_Gems":
            granting = [source for source in panels["us"].get(slug, {}).get("sources", []) if "/passives/DiscipleoftheDjinn/" in source]
            sources = granting
        if not sources:
            continue  # A shared placeholder is not the corresponding skill's artwork.
        src = next((s for s in sources if "/4k/" in s.lower()), sources[0])
        english = entry["names"][0]
        japanese = parsed[("jp", kind)].get(slug, {}).get("names", [])
        aliases = list(dict.fromkeys(entry["names"] + japanese + [
            value["ja"] for key, value in names.items()
            if key == english or value.get("ref", "").rsplit("/", 1)[-1] == slug
        ]))
        filename = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-") + ".webp"
        candidate = {"id": slug, "name": english, "names": aliases,
                        "support": kind == "Support_Gems", "src": f"/images/poe2/skills/{filename}",
                        "source": src, "reference": f"https://poe2db.tw/us/{slug}"}
        if granting:
            candidate["note"] = "The identically named ascendancy notable grants this command. Use its own icon instead of the listing's shared Roll Dodge placeholder."
        entries.append(candidate)


for override in json.loads((ROOT / "data/skill-icon-overrides.json").read_text()):
    entries = [entry for entry in entries if entry["id"] != override["id"]]
    filename = re.sub(r"[^a-z0-9]+", "-", override["id"].lower()).strip("-") + ".webp"
    entries.append(override | {"support": False, "src": f"/images/poe2/skills/{filename}"})


entries = list({entry["id"]: entry for entry in reversed(entries)}.values())


def asset(entry):
    target = ROOT / entry["src"].lstrip("/")
    old = previous.get(entry["id"])
    if old and old["source"] == entry["source"] and (ROOT / old["src"].lstrip("/").split("#")[0]).exists():
        return entry | {"src": old["src"], "sha256": old["sha256"]}
    cache_key = hashlib.sha256(entry["source"].encode()).hexdigest()[:16]
    cached = ROOT / "tools/.skill-icon-cache" / (cache_key + ".webp")
    data = target.read_bytes() if target.exists() else cached.read_bytes() if cached.exists() else download(entry["source"])
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError(f"Not a WebP image: {entry['source']}")
    if not target.exists():
        target.write_bytes(data)
    return entry | {"sha256": hashlib.sha256(data).hexdigest()}


print(f"Fetching {len(entries)} matched skill/support icons", flush=True)
verified = []
with concurrent.futures.ThreadPoolExecutor(24) as pool:
    for i, entry in enumerate(pool.map(asset, entries), 1):
        verified.append(entry)
        if i % 100 == 0:
            print(f"Verified {i}/{len(entries)} icons", flush=True)
catalog = {"checkedAt": datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(), "rights": "Game artwork © Grinding Gear Games; identification via PoE2DB.",
           "entries": sorted(verified, key=lambda e: e["id"])}
(ROOT / "data/skill-icons.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print(f"Saved {len(verified)} local icons", flush=True)
subprocess.run(["node", str(ROOT / "tools/pack-skill-icons.mjs")], cwd=ROOT, check=True)
