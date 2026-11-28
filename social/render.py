#!/usr/bin/env python3
"""Render the square (1080x1080) social image for a launch post.

  python3 social/render.py blog/posts/day-07-name.md [out.png]            square 1080x1080 (Instagram, Facebook)
  python3 social/render.py blog/posts/day-07-name.md [out.png] --linkedin   landscape 1200x628 (LinkedIn)
  python3 social/render.py blog/posts/day-07-name.md [out.png] --x          16:9 1200x675 (X)

Built only from design-system tokens: ink outlines (3px), hard bottom-right
shadow, Bricolage Grotesque 800 + DM Sans, DayBadge with only the number swapped.
Set CHROME_PATH to use a local Chrome instead of Playwright's Chromium.
"""
import html, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from launchpost import parse, day_label

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = (ROOT / "design-system" / "fonts").as_uri()
STAR = "M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z"  # from DayBadge
E = html.escape

def page(m):
    n = m["day"]
    day = f"{n:02d}"
    title = m["title"]
    tsize = 56 if len(title) <= 16 else 44 if len(title) <= 30 else 32
    pct = round(n / 30 * 100)
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><style>
@font-face{{font-family:"Bricolage Grotesque";font-weight:800;src:url({FONTS}/BricolageGrotesque-ExtraBold.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:400;src:url({FONTS}/DMSans-Regular.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:700;src:url({FONTS}/DMSans-Bold.ttf)}}
*{{box-sizing:border-box;margin:0}}
body{{width:540px;height:540px;background:#F2F5FA;font-family:"DM Sans",Arial,sans-serif;color:#0F1B3D;position:relative;overflow:hidden}}
.card{{position:absolute;left:24px;top:24px;width:482px;height:482px;background:#FFFFFF;border:3px solid #0F1B3D;border-radius:28px;box-shadow:10px 10px 0 0 #0F1B3D;overflow:hidden;display:flex;flex-direction:column}}
.head{{display:flex;align-items:center;gap:12px;padding:12px 20px;background:#FF6F91;border-bottom:3px solid #0F1B3D}}
.day{{font:800 22px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-.5px}}
.type{{margin-left:auto;background:#FFFFFF;border:2px solid #0F1B3D;border-radius:999px;padding:4px 12px;font:700 12px/1.2 "DM Sans",Arial,sans-serif}}
.body{{flex:1;padding:24px;display:flex;flex-direction:column;gap:12px}}
h1{{font:800 {tsize}px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-2px}}
p{{font:400 20px/1.55 "DM Sans",Arial,sans-serif;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}
.price{{margin-top:auto;font:800 32px/1.1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-1px}}
.foot{{padding:14px 24px 18px;border-top:3px solid #0F1B3D;background:#FFFFFF}}
.label{{font:700 13px/1.3 "DM Sans",Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}}
.track{{height:16px;border:3px solid #0F1B3D;border-radius:999px;background:#FFFFFF;overflow:hidden}}
.fill{{height:100%;width:{pct}%;background:#FFD21F;border-right:3px solid #0F1B3D}}
</style><body><div class="card">
<div class="head"><svg width="56" height="56" viewBox="0 0 120 120" role="img" aria-label="Day {day}"><circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/><text x="48" y="68" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">{day}</text><path d="{STAR}" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>
<span class="day">{E(day_label(m))}</span><span class="type">{E(m['type'])}</span></div>
<div class="body"><h1>{E(title)}</h1><p>{E(m['summary'])}</p><div class="price">{E(m['price'])}</div></div>
<div class="foot"><div class="label">{n} of 30 shipped</div><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="{n}"><div class="fill"></div></div></div>
</div></body></html>"""

def page_landscape(m):
    """1200x627 (LinkedIn) variant: same card, laid out wide. Viewport 600x314 at 2x."""
    n = m["day"]; day = f"{n:02d}"
    title = m["title"]
    tsize = 48 if len(title) <= 12 else 36 if len(title) <= 30 else 28
    pct = round(n / 30 * 100)
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><style>
@font-face{{font-family:"Bricolage Grotesque";font-weight:800;src:url({FONTS}/BricolageGrotesque-ExtraBold.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:400;src:url({FONTS}/DMSans-Regular.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:700;src:url({FONTS}/DMSans-Bold.ttf)}}
*{{box-sizing:border-box;margin:0}}
body{{width:600px;height:314px;background:#F2F5FA;font-family:"DM Sans",Arial,sans-serif;color:#0F1B3D;position:relative;overflow:hidden}}
.card{{position:absolute;left:20px;top:18px;width:556px;height:270px;background:#FFFFFF;border:3px solid #0F1B3D;border-radius:28px;box-shadow:8px 8px 0 0 #0F1B3D;overflow:hidden;display:flex;flex-direction:column}}
.head{{display:flex;align-items:center;gap:12px;padding:6px 20px;background:#FF6F91;border-bottom:3px solid #0F1B3D}}
.day{{font:800 22px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-.5px}}
.type{{margin-left:auto;background:#FFFFFF;border:2px solid #0F1B3D;border-radius:999px;padding:4px 12px;font:700 12px/1.2 "DM Sans",Arial,sans-serif}}
.body{{flex:1;padding:14px 24px;display:flex;flex-direction:column;gap:8px;min-height:0}}
h1{{font:800 {tsize}px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-1.5px}}
p{{font:400 16px/1.5 "DM Sans",Arial,sans-serif;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.foot{{display:flex;align-items:center;gap:16px;padding:10px 24px;border-top:3px solid #0F1B3D;background:#FFFFFF}}
.label{{font:700 13px/1.3 "DM Sans",Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}}
.track{{flex:1;height:16px;border:3px solid #0F1B3D;border-radius:999px;background:#FFFFFF;overflow:hidden}}
.fill{{height:100%;width:{pct}%;background:#FFD21F;border-right:3px solid #0F1B3D}}
.price{{font:800 22px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-.5px;white-space:nowrap}}
</style><body><div class="card">
<div class="head"><svg width="40" height="40" viewBox="0 0 120 120" role="img" aria-label="Day {day}"><circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/><text x="48" y="68" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">{day}</text><path d="{STAR}" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>
<span class="day">{E(day_label(m))}</span><span class="type">{E(m['type'])}</span></div>
<div class="body"><h1>{E(title)}</h1><p>{E(m['summary'])}</p></div>
<div class="foot"><div class="label">{n} of 30 shipped</div><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="{n}"><div class="fill"></div></div><div class="price">{E(m['price'])}</div></div>
</div></body></html>"""

def page_x(m):
    """1200x675 (X, 16:9) variant: same card on an 800x450 layout, rendered at 1.5x."""
    n = m["day"]; day = f"{n:02d}"
    title = m["title"]
    tsize = 64 if len(title) <= 12 else 52 if len(title) <= 30 else 40
    pct = round(n / 30 * 100)
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><style>
@font-face{{font-family:"Bricolage Grotesque";font-weight:800;src:url({FONTS}/BricolageGrotesque-ExtraBold.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:400;src:url({FONTS}/DMSans-Regular.ttf)}}
@font-face{{font-family:"DM Sans";font-weight:700;src:url({FONTS}/DMSans-Bold.ttf)}}
*{{box-sizing:border-box;margin:0}}
body{{width:800px;height:450px;background:#F2F5FA;font-family:"DM Sans",Arial,sans-serif;color:#0F1B3D;position:relative;overflow:hidden}}
.card{{position:absolute;left:32px;top:28px;width:726px;height:386px;background:#FFFFFF;border:3px solid #0F1B3D;border-radius:28px;box-shadow:10px 10px 0 0 #0F1B3D;overflow:hidden;display:flex;flex-direction:column}}
.head{{display:flex;align-items:center;gap:14px;padding:10px 28px;background:#FF6F91;border-bottom:3px solid #0F1B3D}}
.day{{font:800 26px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-.5px}}
.type{{margin-left:auto;background:#FFFFFF;border:2px solid #0F1B3D;border-radius:999px;padding:5px 14px;font:700 14px/1.2 "DM Sans",Arial,sans-serif}}
.body{{flex:1;padding:22px 28px;display:flex;flex-direction:column;gap:10px;min-height:0}}
h1{{font:800 {tsize}px/1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-2px}}
p{{font:400 21px/1.5 "DM Sans",Arial,sans-serif;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.price{{margin-top:auto;font:800 32px/1.1 "Bricolage Grotesque",Arial,sans-serif;letter-spacing:-1px}}
.foot{{display:flex;align-items:center;gap:18px;padding:14px 28px;border-top:3px solid #0F1B3D;background:#FFFFFF}}
.label{{font:700 13px/1.3 "DM Sans",Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}}
.track{{flex:1;height:16px;border:3px solid #0F1B3D;border-radius:999px;background:#FFFFFF;overflow:hidden}}
.fill{{height:100%;width:{pct}%;background:#FFD21F;border-right:3px solid #0F1B3D}}
</style><body><div class="card">
<div class="head"><svg width="52" height="52" viewBox="0 0 120 120" role="img" aria-label="Day {day}"><circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/><text x="48" y="68" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">{day}</text><path d="{STAR}" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>
<span class="day">{E(day_label(m))}</span><span class="type">{E(m['type'])}</span></div>
<div class="body"><h1>{E(m['title'])}</h1><p>{E(m['summary'])}</p><div class="price">{E(m['price'])}</div></div>
<div class="foot"><div class="label">{n} of 30 shipped</div><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="{n}"><div class="fill"></div></div></div>
</div></body></html>"""

def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    landscape = "--linkedin" in sys.argv
    xmode = "--x" in sys.argv
    if not argv:
        sys.exit(__doc__)
    post = pathlib.Path(argv[0])
    m = parse(post)
    suffix = "-linkedin" if landscape else "-x" if xmode else ""
    out = pathlib.Path(argv[1]) if len(argv) > 1 else ROOT / "social" / "out" / f"day-{m['day']:02d}{suffix}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    tmp = out.with_suffix(".html")
    tmp.write_text(page_x(m) if xmode else page_landscape(m) if landscape else page(m), encoding="utf-8")
    size = {"width": 800, "height": 450} if xmode else {"width": 600, "height": 314} if landscape else {"width": 540, "height": 540}
    scale = 1.5 if xmode else 2
    with sync_playwright() as p:
        kw = {"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}
        b = p.chromium.launch(args=["--allow-file-access-from-files"], **kw)
        pg = b.new_page(viewport=size, device_scale_factor=scale)
        pg.goto(tmp.as_uri())
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out))
        b.close()
    tmp.unlink()
    print(out)

if __name__ == "__main__":
    main()
