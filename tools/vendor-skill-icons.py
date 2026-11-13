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

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            href = attrs.get("href", "")
            if re.fullmatch(r"(?:/(?:us|jp)/)?[A-Za-z0-9_'%-]+", href):
                slug = href.rsplit("/", 1)[-1]
                self.current = [slug, [], []]
        elif tag == "img" and self.current:
            src = attrs.get("src", "")
            if "/skillicons/" in src.lower():
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
names = json.loads((ROOT / "data/japanese-names.json").read_text())["names"]
entries = []
for kind in ["Skill_Gems", "Support_Gems"]:
    for slug, entry in parsed[("us", kind)].items():
        if not entry["names"] or not entry["sources"]:
            continue
        sources = [s for s in entry["sources"] if not re.search(r"(?:rolldodge|default|unknown)\.", s, re.I)]
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
        entries.append({"id": slug, "name": english, "names": aliases,
                        "support": kind == "Support_Gems", "src": f"/images/poe2/skills/{filename}",
                        "source": src, "reference": f"https://poe2db.tw/us/{slug}"})


for override in json.loads((ROOT / "data/skill-icon-overrides.json").read_text()):
    entries = [entry for entry in entries if entry["id"] != override["id"]]
    filename = re.sub(r"[^a-z0-9]+", "-", override["id"].lower()).strip("-") + ".webp"
    entries.append(override | {"support": False, "src": f"/images/poe2/skills/{filename}"})


entries = list({entry["id"]: entry for entry in reversed(entries)}.values())


def asset(entry):
    target = ROOT / entry["src"].lstrip("/")
    cached = ROOT / "tools/.skill-icon-cache" / target.name
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
catalog = {"checkedAt": "2026-11-13", "rights": "Game artwork © Grinding Gear Games; identification via PoE2DB.",
           "entries": sorted(verified, key=lambda e: e["id"])}
(ROOT / "data/skill-icons.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print(f"Saved {len(verified)} local icons", flush=True)
subprocess.run(["node", str(ROOT / "tools/pack-skill-icons.mjs")], cwd=ROOT, check=True)
