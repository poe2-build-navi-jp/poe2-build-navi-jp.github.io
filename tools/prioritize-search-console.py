"""PoE2 SEO triage. Python 3, standard library only.

In Search Console, select the PoE2 property, Search type Web and last 28
days. Export CSV and extract Pages.csv (Japanese: ページ.csv). Run:
    python tools/prioritize-search-console.py /path/to/Pages.csv

The output is a shortlist, not an SEO forecast. Thresholds are editorial
defaults, not Google benchmarks. For each shortlisted URL, filter that exact
page in Search Console and inspect Queries before editing. Do not join
separately exported page and query totals. After an edit, log the date and
compare clicks, impressions, CTR and average position after 28 days.
Keep exports outside this public repository.
"""
import argparse
import csv
from pathlib import Path
from urllib.parse import urlsplit

HOST = 'poe2-build-navi-jp.github.io'
ALIASES = [
    ('Top pages', '上位のページ', 'ページ', 'Page'),
    ('Clicks', 'クリック数'),
    ('Impressions', '表示回数'),
    ('CTR', 'クリック率'),
    ('Position', '掲載順位', '平均掲載順位'),
]


def shortlist(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        headers = {name.strip(): name for name in reader.fieldnames or []}
        keys = [next((headers[a] for a in aliases if a in headers), None)
                for aliases in ALIASES]
        if None in keys:
            raise ValueError('ページ別CSVを指定してください。必要列: ページ、クリック数、表示回数、CTR、掲載順位')
        candidates = []
        eligible_pages = 0
        for row in reader:
            url, clicks, impressions, ctr, pos = (row[k].strip() for k in keys)
            page = urlsplit(url)
            if page.scheme != 'https' or page.hostname != HOST:
                continue
            eligible_pages += 1
            clicks, impressions = (int(x.replace(',', '')) for x in (clicks, impressions))
            if impressions < 50:
                continue
            position = float(pos)
            rate = 100 * clicks / impressions
            if 1 <= position <= 10 and rate < 2:
                action = 'タイトル・冒頭と実際の検索語の一致を確認'
                group = 0
            elif 10 < position <= 30:
                action = '検索語に対する回答・比較・内部リンクを補う'
                group = 1
            else:
                continue
            candidates.append((group, -impressions, position, url, clicks, rate, action))
    if not eligible_pages:
        raise ValueError('PoE2ビルドナビのURLが見つかりません。プロパティを確認してください。')
    return sorted(candidates)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('pages_csv', type=Path)
    args = parser.parse_args()
    try:
        rows = shortlist(args.pages_csv)
    except (OSError, ValueError, AttributeError) as exc:
        parser.error(str(exc))
    if not rows:
        print('基準を満たす候補はありません（50表示以上・平均順位30位以内）。')
    for _, impressions, position, url, clicks, ctr, action in rows:
        print(f'{-impressions}表示 / {clicks}クリック / CTR {ctr:.2f}% / 平均{position:g}位')
        print(f'  {url}\n  {action}')


if __name__ == '__main__':
    main()
