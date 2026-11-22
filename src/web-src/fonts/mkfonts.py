"""Облегчённые копии шрифтов надписей масок (латиница, кириллица, нужные знаки): обычный и жирный.
Шрифты с зарезервированными именами (OFL) переименованы. Запуск: python3 mkfonts.py <google/fonts> <web-src/fonts>"""
import sys, os, glob, shutil
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer
G, OUT = sys.argv[1:3]
U = list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + list(range(0x400, 0x460)) + list(range(0x2010, 0x203b)) + \
    [0x2116, 0x2122, 0x2212, 0x2190, 0x2191, 0x2192, 0x2193, 0x20bd, 0x2026, 0x2022, 0x25cf, 0x2264, 0x2265, 0xb0, 0xd7]
# ключ, папка, имя внутри (CSS-семейство), подпись в меню, переименован ли (RFN)
FONTS = [('P', 'ptsans', 'LMG Mask P', 'PT Sans'), ('F', 'firasans', 'LMG Mask F', 'Fira Sans'),
         ('S', 'sourcesans3', 'LMG Mask S', 'Source Sans 3'), ('L', 'lato', 'LMG Mask L', 'Lato'),
         ('Y', 'ysabeauoffice', 'LMG Mask Y', 'Ysabeau Office'), ('C', 'scada', 'LMG Mask C', 'Scada'),
         ('J', 'jost', 'LMG Mask J', 'Jost'), ('I', 'istokweb', 'LMG Mask I', 'Istok')]
def src(d, bold):
    fs = sorted(glob.glob(f'{G}/ofl/{d}/*.ttf'))
    st = [f for f in fs if f.endswith('-Bold.ttf' if bold else '-Regular.ttf')]
    if st:
        return TTFont(st[0])
    v = [f for f in fs if 'Italic' not in f][0]
    t = TTFont(v)
    return instancer.instantiateVariableFont(t, {a.axisTag: (700 if bold else 400) if a.axisTag == 'wght' else a.defaultValue for a in t['fvar'].axes})
for key, d, fam, label in FONTS:
    for bold in (False, True):
        t = src(d, bold)
        cm = t.getBestCmap()
        o = subset.Options(); o.hinting = False; o.layout_features = ['kern', 'liga']; o.name_IDs = ['*']; o.notdef_outline = True
        s = subset.Subsetter(o); s.populate(unicodes=[u for u in U if u in cm]); s.subset(t)
        sub = 'Bold' if bold else 'Regular'
        for rec in list(t['name'].names):
            if rec.nameID in (1, 16): rec.string = fam
            elif rec.nameID == 4: rec.string = fam + (' Bold' if bold else '')
            elif rec.nameID == 3: rec.string = f'{fam} {sub}; subset of {label} (SIL OFL 1.1)'
            elif rec.nameID == 6: rec.string = fam.replace(' ', '') + '-' + sub
            elif rec.nameID in (2, 17): rec.string = sub
        if 'STAT' in t: del t['STAT']
        out = f'{OUT}/LMGMask{key}-{sub}.ttf'
        t.save(out)
        print(out, os.path.getsize(out), 0xd7 in cm, 0x2116 in cm)
    shutil.copy(f'{G}/ofl/{d}/OFL.txt', f'{OUT}/LICENSE-{label.replace(" ", "")}-OFL.txt')
