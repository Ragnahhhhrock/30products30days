#!/usr/bin/env python3
"""Build the blog from blog/posts/*.md into static HTML. No dependencies.

Only files in blog/posts/ are built, so only those go live.
Run from anywhere:  python3 blog/build.py

Front matter (between --- lines):
  day: 7            title: Product name      type: Digital | Physical | Service
  date: 2026-12-04  summary: One sentence.   price: Free or $9   link: https://...
A post with an empty link, empty price or any {{placeholder}} is refused.
"""
import datetime as dt, html, pathlib, re, shutil, sys
from email.utils import format_datetime

ROOT = pathlib.Path(__file__).resolve().parent
SITE = "https://30products30days.com"
E = html.escape

def parse(path):
    t = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", t, re.S)
    if not m: sys.exit(f"{path.name}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1); meta[k.strip()] = v.strip()
    for k in ("day", "title", "type", "date", "summary", "price", "link"):
        if not meta.get(k): sys.exit(f"{path.name}: front matter '{k}' is empty")
    if "{{" in t: sys.exit(f"{path.name}: unfilled {{{{placeholder}}}} left in post")
    if not meta["link"].startswith("https://"): sys.exit(f"{path.name}: link must start with https://")
    meta["day"] = int(meta["day"]); meta["slug"] = path.stem
    meta["date"] = dt.date.fromisoformat(meta["date"])
    meta["body"] = m.group(2).strip()
    return meta

def inline(s):
    s = E(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|/[^)\s]*)\)", lambda m: f'<a href="{E(m.group(2))}">{m.group(1)}</a>', s)
    return s

def md(body):
    out, para, items = [], [], []
    def flush():
        nonlocal para, items
        if para: out.append("<p>" + inline(" ".join(para)) + "</p>"); para = []
        if items: out.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>"); items = []
    for line in body.splitlines():
        if not line.strip(): flush()
        elif line.startswith("## "): flush(); out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.startswith("- "): 
            if para: flush()
            items.append(line[2:])
        else:
            if items: flush()
            para.append(line.strip())
    flush(); return "\n".join(out)

def badge(n, size):
    return (f'<svg class="l30-badge" width="{size}" height="{size}" viewBox="0 0 120 120" role="img" aria-label="Day {n:02d}">'
    '<circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/>'
    f'<text x="48" y="68" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">{n:02d}</text>'
    '<path d="M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>')

CSS = """
  @font-face{font-family:"Bricolage Grotesque";font-weight:800;src:url(/design-system/fonts/BricolageGrotesque-ExtraBold.ttf) format("truetype");font-display:swap}
  @font-face{font-family:"DM Sans";font-weight:400;src:url(/design-system/fonts/DMSans-Regular.ttf) format("truetype");font-display:swap}
  @font-face{font-family:"DM Sans";font-weight:500;src:url(/design-system/fonts/DMSans-Medium.ttf) format("truetype");font-display:swap}
  @font-face{font-family:"DM Sans";font-weight:700;src:url(/design-system/fonts/DMSans-Bold.ttf) format("truetype");font-display:swap}
  :root{
    --surface-page:#F2F5FA;--surface-card:#FFFFFF;--ink:#0F1B3D;--ink-muted:#33415F;--outline:#0F1B3D;
    --brand-launch:#FFD21F;--brand-flamingo:#FF6F91;--brand-orbit:#4B5BFF;--on-orbit:#FFFFFF;
    --link:#3A49E6;--focus-ring:#3A49E6;--status-shipped:#0F1B3D;--on-status-shipped:#FFFFFF;
    --font-display:"Bricolage Grotesque","Arial Black",Arial,sans-serif;--font-body:"DM Sans",Arial,sans-serif;
    --space-1:4px;--space-2:8px;--space-3:16px;--space-4:24px;--space-5:40px;--space-6:64px;
    --radius-sm:12px;--radius-md:20px;--radius-lg:28px;--radius-pill:999px;
    --shadow-hard-sm:4px 4px 0 0 #0F1B3D;--shadow-hard-md:8px 8px 0 0 #0F1B3D;--border-w:3px;
  }
  @media (prefers-color-scheme:dark){
    :root{--surface-page:#0B1330;--surface-card:#16234F;--ink:#F2F5FA;--ink-muted:#B9C3DD;--outline:#F2F5FA;
      --link:#A5AFFF;--focus-ring:#FFD21F;--status-shipped:#F2F5FA;--on-status-shipped:#0F1B3D;
      --shadow-hard-sm:4px 4px 0 0 #050A1F;--shadow-hard-md:8px 8px 0 0 #050A1F}
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--surface-page);color:var(--ink);font:400 18px/1.6 var(--font-body)}
  .wrap{max-width:760px;margin:0 auto;padding:0 var(--space-3)}
  a{color:var(--link)}
  a:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px;border-radius:4px}
  .label{font:700 13px/1.3 var(--font-body);letter-spacing:2px;text-transform:uppercase;margin:0 0 var(--space-2)}
  .hero{background:var(--brand-launch);color:#0F1B3D;border-bottom:var(--border-w) solid var(--outline)}
  .hero .wrap{padding-top:var(--space-5);padding-bottom:var(--space-5);display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap}
  .hero__text{flex:1 1 360px;min-width:0}
  h1{font:800 clamp(36px,7vw,60px)/1 var(--font-display);letter-spacing:-.03em;margin:var(--space-2) 0 var(--space-3)}
  h1 mark{background:var(--brand-flamingo);color:#0F1B3D;padding:0 12px;border-radius:var(--radius-sm);display:inline-block;transform:rotate(-2deg)}
  .lead{font-size:20px;margin:0}
  .meta{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;font:700 13px/1.3 var(--font-body);letter-spacing:1px;text-transform:uppercase}
  .pill{display:inline-flex;background:#FFFFFF;color:#0F1B3D;border:2px solid #0F1B3D;border-radius:var(--radius-pill);padding:4px 12px;font:700 12px/1.2 var(--font-body);letter-spacing:0;text-transform:none}
  main{padding:var(--space-5) 0 0}
  h2{font:800 clamp(26px,4vw,32px)/1.1 var(--font-display);letter-spacing:-1px;margin:var(--space-5) 0 var(--space-3)}
  .post p,.post li{max-width:64ch}
  .post ul{padding-left:22px}
  .note{color:var(--ink-muted);font-size:15px}
  .actions{display:flex;flex-wrap:wrap;gap:var(--space-3);margin:var(--space-5) 0 0}
  .list{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-4)}
  .item{display:flex;gap:var(--space-3);align-items:center;background:var(--surface-card);border:var(--border-w) solid var(--outline);border-radius:var(--radius-lg);box-shadow:var(--shadow-hard-md);padding:var(--space-3) var(--space-4);text-decoration:none;color:var(--ink)}
  .item:hover{transform:translate(2px,2px);box-shadow:6px 6px 0 0 var(--outline)}
  .item:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  .item h2{font:800 24px/1.1 var(--font-display);letter-spacing:-.5px;margin:0 0 4px}
  .item p{margin:0;color:var(--ink-muted);font-size:16px}
  .panel{background:var(--surface-card);border:var(--border-w) solid var(--outline);border-radius:var(--radius-lg);box-shadow:var(--shadow-hard-md);padding:var(--space-4)}
  .l30-card{margin-top:var(--space-5)}
  footer{margin-top:var(--space-6);padding:var(--space-5) 0;border-top:var(--border-w) solid var(--outline);color:var(--ink-muted);font-size:14px}
  footer .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
  footer img{width:32px;height:32px}
  @media (prefers-reduced-motion:reduce){.item{transition:none}.item:hover{transform:none}}
"""

def page(title, desc, url, hero, main, ogimg="/social/og-image.png"):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{SITE}{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="30 Products in 30 Days">
<meta property="og:image" content="{SITE}{ogimg}">
<meta property="og:locale" content="en_AU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@30days30prods">
<meta name="theme-color" content="#FFD21F">
<link rel="canonical" href="{SITE}{url}">
<link rel="alternate" type="application/rss+xml" title="30 Products in 30 Days" href="{SITE}/blog/feed.xml">
<link rel="stylesheet" href="/design-system/components/bundle.css">
<style>{CSS}</style>
</head>
<body>
{hero}
<main class="wrap">
{main}
</main>
<footer><div class="wrap"><img src="/brand/logos/launch-badge.svg" alt="" width="32" height="32"><span>&copy; 2026 30products30days.com</span><a href="/">Home</a><a href="/blog/">Blog</a></div></footer>
</body>
</html>
"""

def build_post(p):
    n = p["day"]; nice = p["date"].strftime("%-d %B %Y")
    title = f"Day {n:02d}: {p['title']}"
    hero = f"""<header class="hero"><div class="wrap">
  {badge(n,96)}
  <div class="hero__text"><div class="meta"><span class="pill">{E(p['type'])}</span><time datetime="{p['date']}">{nice}</time></div>
  <h1>{E(title)}</h1><p class="lead">{E(p['summary'])}</p></div>
</div></header>"""
    card = f"""<article class="l30-card"><header class="l30-card__head"><span class="l30-card__day">Day {n:02d}</span><span class="l30-card__type">{E(p['type'])}</span></header>
<div class="l30-card__body"><h3 class="l30-card__title">{E(p['title'])}</h3><p class="l30-card__text">{E(p['summary'])}</p>
<div class="l30-card__foot"><b class="l30-card__price">{E(p['price'])}</b><a class="l30-btn l30-btn--primary" href="{E(p['link'])}" rel="noopener">Grab it</a></div></div></article>"""
    main = f'<div class="post">{md(p["body"])}</div>\n{card}\n<div class="actions"><a class="l30-btn l30-btn--secondary" href="/blog/">All posts</a></div>'
    d = ROOT / p["slug"]; d.mkdir(exist_ok=True)
    (d / "index.html").write_text(page(f"{title} | 30 Products in 30 Days", p["summary"], f"/blog/{p['slug']}/", hero, main), encoding="utf-8")

def build_index(posts):
    hero = """<header class="hero"><div class="wrap"><div class="hero__text"><p class="label">The blog</p>
<h1>One launch, <mark>one post</mark></h1><p class="lead">Every product gets its own post the day it ships.</p></div></div></header>"""
    if posts:
        items = "".join(f"""<li><a class="item" href="/blog/{p['slug']}/">{badge(p['day'],56)}<div><h2>Day {p['day']:02d}: {E(p['title'])}</h2><p>{E(p['summary'])}</p></div></a></li>""" for p in posts)
        main = f'<ol class="list" reversed>{items}</ol>'
    else:
        main = '<div class="panel"><p style="margin:0"><strong>First post lands on 28 November 2026.</strong> Check back on launch day, or follow along on <a href="https://x.com/30days30prods" rel="me noopener">X</a>.</p></div>'
    (ROOT / "index.html").write_text(page("Blog | 30 Products in 30 Days", "One launch and one post every day from 28 November 2026.", "/blog/", hero, main).replace('og:type" content="article"', 'og:type" content="website"'), encoding="utf-8")

def build_feed(posts):
    items = "".join(f"""<item><title>{E(f"Day {p['day']:02d}: {p['title']}")}</title><link>{SITE}/blog/{p['slug']}/</link><guid>{SITE}/blog/{p['slug']}/</guid><pubDate>{format_datetime(dt.datetime.combine(p['date'], dt.time(8,0), dt.timezone(dt.timedelta(hours=8))))}</pubDate><description>{E(p['summary'])}</description></item>""" for p in posts)
    (ROOT / "feed.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>30 Products in 30 Days</title><link>{SITE}/blog/</link><description>One launch and one post every day from 28 November 2026.</description><language>en-AU</language>{items}</channel></rss>
""", encoding="utf-8")

def main():
    posts = sorted((parse(f) for f in (ROOT / "posts").glob("*.md")), key=lambda p: p["day"], reverse=True)
    live = {p["slug"] for p in posts}
    for d in ROOT.iterdir():  # drop pages for posts that were unpublished
        if d.is_dir() and d.name.startswith("day-") and d.name not in live: shutil.rmtree(d)
    for p in posts: build_post(p)
    build_index(posts); build_feed(posts)
    print(f"built {len(posts)} post(s)")

if __name__ == "__main__": main()
