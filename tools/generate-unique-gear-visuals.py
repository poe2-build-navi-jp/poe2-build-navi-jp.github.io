"""Render exact editorial diagrams; icons represent effects, not game item artwork.

Requires Pillow and a Japanese font. Run from any directory with Python 3.
Set POE2_DIAGRAM_FONT to override the Noto Sans CJK JP font path.
"""
from pathlib import Path
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images/poe2/guides'
OUT.mkdir(parents=True, exist_ok=True)
FONT = os.environ.get('POE2_DIAGRAM_FONT', '/root/.local/share/fonts/NotoSansCJKjp-Regular.otf')
BG, INK, MUTED = '#f6f2e9', '#172d39', '#40545d'
COLORS = ['#145f76', '#794b19', '#476333', '#6c466d', '#145f76']

def font(size):
    return ImageFont.truetype(FONT, size)

def label(d, xy, text, size=48, color=INK):
    d.text(xy, text, font=font(size), fill=color, anchor='lt')

def base(title, subtitle, height):
    im = Image.new('RGB', (1200, height), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((48, 40, 1152, 198), radius=24, fill=INK)
    label(d, (82, 70), title, 68, '#ffffff')
    label(d, (84, 155), subtitle, 31, '#e6ded0')
    return im, d

def icon(d, kind, x, y, c):
    """Simple editorial symbols, intentionally unlike actual unique item sprites."""
    d.rounded_rectangle((x, y, x+132, y+132), radius=25, fill=c)
    white = '#ffffff'
    if kind == 'wind':
        for i in range(3):
            d.arc((x+22+i*8, y+22+i*27, x+108-i*8, y+70+i*22), 175, 355, fill=white, width=8)
    elif kind == 'skeleton':
        d.rounded_rectangle((x+35, y+26, x+97, y+91), radius=22, fill=white)
        d.ellipse((x+44,y+45,x+60,y+62), fill=c)
        d.ellipse((x+73,y+45,x+89,y+62), fill=c)
        d.rectangle((x+51,y+86,x+82,y+106), fill=white)
        for a in range(55, 82, 9): d.line((x+a,y+90,x+a,y+105),fill=c,width=3)
    elif kind == 'shield':
        d.polygon([(x+66,y+23),(x+104,y+40),(x+99,y+82),(x+66,y+112),(x+33,y+82),(x+28,y+40)], fill=white)
        d.line((x+46,y+62,x+59,y+77,x+86,y+48),fill=c,width=9)
    elif kind == 'ring':
        d.ellipse((x+32,y+48,x+100,y+112),outline=white,width=10)
        d.polygon([(x+66,y+21),(x+88,y+41),(x+66,y+59),(x+44,y+41)],fill=white)
    elif kind == 'weapon':
        d.line((x+34,y+104,x+98,y+27),fill=white,width=10)
        d.polygon([(x+84,y+28),(x+110,y+15),(x+104,y+45)],fill=white)
        d.line((x+28,y+80,x+57,y+104),fill=white,width=8)
    else:
        d.arc((x+27,y+25,x+110,y+109), 20, 315, fill=white, width=10)
        d.polygon([(x+108,y+64),(x+101,y+35),(x+82,y+59)],fill=white)

def footer(d, y, text):
    d.line((64,y,1136,y),fill='#c7bfae',width=2)
    label(d,(74,y+20),text,34,MUTED)
    label(d,(74,y+67),'POE2ビルドナビ  /  0.5.5掲載原典の比較',30,MUTED)

def save(im, slug):
    im.save(OUT / f'{slug}.webp', 'WEBP', quality=90, method=6)
    small = im.resize((720, round(im.height*720/1200)), Image.Resampling.LANCZOS)
    small.save(OUT / f'{slug}-720.webp', 'WEBP', quality=90, method=6)
    print(slug, im.size)

im,d=base('PoE2 装備は「目的」で選ぶ','高価なユニークを、全ビルドの最強とは決めない',1430)
cards=[
    ('loop','周回を速くしたい','ヘッドハンター','レア敵を倒して強化を得る','ボス単独戦とは分けて考える'),
    ('wind','ツイスターを強化したい','テイミング','複数の元素地面を使う構成','指輪交換で失う効果も確認'),
    ('skeleton','アンデッドを増やしたい','ウルルの骨','アンデッド生成スキルが対象','全ミニオンへの効果ではない'),
    ('shield','防御を整えたい','まずレア装備も比較','耐性・ライフ・ESを先に確認','ユニーク交換で不足を作らない'),
]
for n,(kind,title,name,line1,line2) in enumerate(cards):
    y=232+n*264;c=COLORS[n]
    d.rounded_rectangle((48,y,1152,y+244),radius=20,fill='#ffffff',outline='#c7bfae',width=2)
    icon(d,kind,78,y+54,c)
    label(d,(242,y+23),title,50,c)
    label(d,(242,y+88),name,56)
    label(d,(242,y+158),line1,44,MUTED)
    label(d,(242,y+207),line2,34,MUTED)
footer(d,1314,'効果の模式図。採用条件・英語名・根拠は本文で確認。')
save(im,'poe2-unique-gear-purpose-comparison')

im,d=base('PoE2 ユニーク購入前の5確認','装備できることと、ビルドが成立することは別',1380)
steps=[
    ('原典の構成','同じ作者・育成段階か？','別の完成形を部分的に混ぜない'),
    ('現物の条件','要求Lv・能力値・強化状態','通常品と変種を区別する'),
    ('必要な効果','欲しいModとロールがあるか','同じ名前でも効果を確認'),
    ('交換後の防御','耐性・ライフ／ES・Spirit','マナ維持と武器セットも確認'),
    ('今の装備と比較','まず1部位だけ比較する','レア装備を優先する場合もある'),
]
for n,(title,line1,line2) in enumerate(steps):
    y=226+n*205;c=COLORS[n]
    d.rounded_rectangle((48,y,1152,y+181),radius=20,fill='#ffffff',outline='#c7bfae',width=2)
    d.ellipse((80,y+40,180,y+140),fill=c)
    label(d,(108,y+59),str(n+1),65,'#ffffff')
    label(d,(216,y+22),title,53,c)
    label(d,(216,y+90),line1,47)
    label(d,(216,y+148),line2,32,MUTED)
footer(d,1260,'購入前に比較 → 交換後に再確認 → 現在Lvの育成へ')
save(im,'poe2-unique-gear-buying-checklist')

im,d=base('PoE2 ツイスターの装備比較','構成・段階・武器セットを合わせる',1420)
y=232
d.rounded_rectangle((48,y,1152,y+307),radius=20,fill='#ffffff',outline='#c7bfae',width=2)
icon(d,'weapon',78,y+70,COLORS[0])
label(d,(242,y+27),'ジェムリング：会心移行',50,COLORS[0])
label(d,(242,y+99),'タングルタン ＋ アジスの標',49)
label(d,(242,y+171),'会心ツリー・追加ダメージも必要',43,MUTED)
label(d,(242,y+230),'2品の交換だけで完成とはしない',41,MUTED)
y=563
d.rounded_rectangle((48,y,1152,y+265),radius=20,fill='#ffffff',outline='#c7bfae',width=2)
icon(d,'ring',78,y+64,COLORS[1])
label(d,(242,y+27),'複数の元素地面で強化',50,COLORS[1])
label(d,(242,y+99),'テイミングは「指輪」',53)
label(d,(242,y+174),'原典の段階・指輪枠の条件を確認',43,MUTED)
y=853
d.rounded_rectangle((48,y,1152,y+383),radius=20,fill='#ffffff',outline='#c7bfae',width=2)
label(d,(80,y+26),'スピリットウォーカー：武器セット',49,COLORS[2])
for n,(badge,name,note) in enumerate([
    ('1','スカイシルバー','攻撃速度を確保するセット1'),
    ('2','目の導きの掌','Spirit・追加冷気の補助：セット2'),
]):
    yy=y+104+n*133
    d.rounded_rectangle((80,yy,184,yy+103),radius=18,fill=COLORS[2])
    label(d,(115,yy+23),badge,60,'#ffffff')
    label(d,(216,yy+6),name,53)
    label(d,(216,yy+77),note,39,MUTED)
footer(d,1297,'別原典の完成形を混ぜず、使うスキルとの割当を確認。')
save(im,'poe2-twister-unique-gear-weapon-sets')
