#!/usr/bin/env python3
"""Make the advent calendar thumbnail for a launch post: advent/thumbs/day-NN.svg

  python3 advent/make_thumb.py blog/posts/day-07-name.md

Design-system tokens only: ink 3px outline, hard bottom-right shadow (shadow-hard-sm), 3:4 portrait,
Launch yellow body and Flamingo band (two brand colours), Bricolage Grotesque 800 for the day and product name,
DM Sans for the type label. The DayBadge is the component's own geometry with only the number swapped.
Text is converted to outlines from design-system/fonts so it renders correctly inside an <img>.
"""
import pathlib, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "design-system" / "fonts"
INK, LAUNCH, FLAMINGO, WHITE = "#0F1B3D", "#FFD21F", "#FF6F91", "#FFFFFF"
STAR = "M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z"  # DayBadge

def font(name):
    f = TTFont(FONTS / name)
    return f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm

BRICO = font("BricolageGrotesque-ExtraBold.ttf")
DMSANS = font("DMSans-Bold.ttf")

def width(text, fnt, size, spacing=0.0):
    f, gs, cmap, upm = fnt
    return sum(f["hmtx"][cmap[ord(c)]][0] * size / upm + spacing for c in text) - (spacing if text else 0)

def path(text, fnt, size, x, y, spacing=0.0, anchor="start"):
    """SVG path data for text with its baseline at y."""
    f, gs, cmap, upm = fnt
    w = width(text, fnt, size, spacing)
    if anchor == "middle": x -= w / 2
    elif anchor == "end": x -= w
    d, cx, s = [], x, size / upm
    for c in text:
        g = cmap[ord(c)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx, y)))
        d.append(pen.getCommands())
        cx += f["hmtx"][g][0] * s + spacing
    return " ".join(x for x in d if x)

def wrap(text, fnt, size, spacing, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if cur and width(t, fnt, size, spacing) > maxw:
            lines.append(cur); cur = w
        else:
            cur = t
    return lines + [cur]

def parse(p):
    t = pathlib.Path(p).read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    meta = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    return {k.strip(): v.strip() for k, v in meta.items()}

def thumb(meta):
    n = int(meta["day"]); day = f"{n:02d}"
    title, kind, price = meta["title"], meta["type"], meta["price"]
    size = 40
    while True:  # shrink until the name fits in 4 lines
        lines = wrap(title, BRICO, size, -1.0, 262)
        if len(lines) <= (3 if size > 32 else 4) and all(width(l, BRICO, size, -1.0) <= 262 for l in lines):
            break
        size -= 2
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 410" width="310" height="410" role="img" aria-label="Day {day}: {title}">',
           f'<rect x="7" y="7" width="300" height="400" rx="20" fill="{INK}"/>',  # shadow-hard-sm, bottom-right, never blurred
           '<defs><clipPath id="c"><rect x="3" y="3" width="300" height="400" rx="20"/></clipPath></defs>',
           f'<rect x="3" y="3" width="300" height="400" rx="20" fill="{LAUNCH}"/>',
           f'<g clip-path="url(#c)"><rect x="0" y="0" width="310" height="96" fill="{FLAMINGO}"/>'
           f'<rect x="0" y="94" width="310" height="3" fill="{INK}"/></g>',
           f'<rect x="3" y="3" width="300" height="400" rx="20" fill="none" stroke="{INK}" stroke-width="3"/>']  # 3px outline
    # DayBadge, number swapped (geometry from the component, scaled 72/120)
    s = 72 / 120
    out.append(f'<g transform="translate(16 12) scale({s})"><circle cx="54" cy="58" r="46" fill="{INK}"/>'
               f'<circle cx="48" cy="52" r="46" fill="{LAUNCH}" stroke="{INK}" stroke-width="5"/>'
               f'<path d="{path(day, BRICO, 50, 48, 68, -3, "middle")}" fill="{INK}"/>'
               f'<path d="{STAR}" fill="{FLAMINGO}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/></g>')
    out.append(f'<path d="{path("Day " + day, BRICO, 26, 100, 56, -0.5)}" fill="{INK}"/>')
    pw = width(kind, DMSANS, 12) + 24
    out.append(f'<rect x="{289 - pw}" y="34" width="{pw}" height="26" rx="13" fill="{WHITE}" stroke="{INK}" stroke-width="2"/>'
               f'<path d="{path(kind, DMSANS, 12, 289 - pw / 2, 51.5, 0, "middle")}" fill="{INK}"/>')
    y = 148
    for l in lines:
        out.append(f'<path d="{path(l, BRICO, size, 20, y, -1.0)}" fill="{INK}"/>'); y += size * 1.05
    out.append(f'<path d="{path(price, BRICO, 30, 20, 375, -1.0)}" fill="{INK}"/>')
    out.append('</svg>')
    return "\n".join(out)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    m = parse(sys.argv[1])
    dest = ROOT / "advent" / "thumbs" / f"day-{int(m['day']):02d}.svg"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(thumb(m), encoding="utf-8")
    print(dest)
