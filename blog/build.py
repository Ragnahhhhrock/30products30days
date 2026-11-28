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
from urllib.parse import quote
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
  .share{margin-top:var(--space-5)}
  .share__list{list-style:none;margin:0;padding:0 4px 4px 0;display:flex;flex-wrap:wrap;gap:var(--space-3)}
  .share .l30-btn{background:var(--surface-card);color:var(--ink);padding:12px 20px;font-family:var(--font-body)}
  .share .l30-btn[hidden]{display:none}
  .share__status{margin:var(--space-2) 0 0;min-height:1.6em;color:var(--ink-muted);font-size:15px}
  footer{margin-top:var(--space-6);padding:var(--space-5) 0;border-top:var(--border-w) solid var(--outline);color:var(--ink-muted);font-size:14px}
  footer .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3)}
  footer img{width:32px;height:32px}
  @media (prefers-reduced-motion:reduce){.item{transition:none}.item:hover{transform:none}.share .l30-btn{transition:none}}
"""

NAV_ITEMS = [('home', '/', 'Home'), ('blog', '/blog/', 'Blog'), ('advent', '/advent/', 'Advent calendar'), ('community', '/community/', 'Community'), ('account', '/account/', 'My account'), ('join', '/register.html', 'Join'), ('contact', '/#cf', 'Contact')]

def nav(cur):
    li = "".join(f'<li><a class="site-nav__link" href="{h}"{" aria-current=" + chr(34) + "page" + chr(34) if k == cur else ""}>{t}</a></li>' for k, h, t in NAV_ITEMS)
    return ('<header class="site-nav"><div class="site-nav__in"><a class="site-nav__brand" href="/"><img src="/brand/logos/launch-badge.svg" alt="" width="36" height="36"><span>30 Products 30 Days</span></a>'
            f'<nav aria-label="Main"><ul class="site-nav__list">{li}</ul></nav></div></header>')

def page(title, desc, url, hero, main, ogimg="/social/og-image.png", extra_css="", script="", wide=False, current="blog"):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FM1RLPT7RK"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){{dataLayer.push(arguments);}}
gtag('js',new Date());
gtag('config','G-FM1RLPT7RK');
</script>
<script src="/analytics.js" defer></script>
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
<link rel="stylesheet" href="/site-nav.css">
<style>{CSS}{extra_css}</style>
</head>
<body>
{nav(current)}
{hero}
<main class="wrap{" wrap--wide" if wide else ""}">
{main}
</main>
<footer><div class="wrap"><img src="/brand/logos/launch-badge.svg" alt="" width="32" height="32"><span>&copy; 2026 30products30days.com</span><a href="/">Home</a><a href="/blog/">Blog</a><a href="/advent/">Advent calendar</a></div></footer>
{script}
</body>
</html>
"""

SHARE_JS = """<script>
(function(){
  var box=document.querySelector(".share");if(!box)return;
  var url=box.dataset.url,title=box.dataset.title,st=box.querySelector(".share__status");
  var native=box.querySelector("[data-share-native]"),copy=box.querySelector("[data-share-copy]");
  if(navigator.share){native.hidden=false;native.addEventListener("click",function(){navigator.share({title:title,url:url}).catch(function(){})})}
  copy.addEventListener("click",function(){
    function ok(){st.textContent="Link copied."}
    function fail(){st.textContent="Copy failed. The link is "+url}
    function legacy(){var t=document.createElement("textarea");t.value=url;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();
      var r=false;try{r=document.execCommand("copy")}catch(e){}document.body.removeChild(t);r?ok():fail()}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(ok,legacy)}else{legacy()}
  });
})();
</script>"""

def share_block(p):
    """Share links for a post: plain URLs (no third-party scripts), plus Copy link and the native share sheet where supported."""
    url = f"{SITE}/blog/{p['slug']}/"
    title = f"Day {p['day']:02d}: {p['title']}" if p["day"] >= 1 else p["title"]
    text = f"{title} | 30 Products in 30 Days"
    u, t = quote(url, safe=""), quote(text, safe="")
    links = [
        ("X", f"https://x.com/intent/post?text={t}&url={u}", "Share on X"),
        ("Facebook", f"https://www.facebook.com/sharer/sharer.php?u={u}", "Share on Facebook"),
        ("LinkedIn", f"https://www.linkedin.com/sharing/share-offsite/?url={u}", "Share on LinkedIn"),
        ("WhatsApp", f"https://wa.me/?text={quote(text + ' ' + url, safe='')}", "Share on WhatsApp"),
        ("Email", f"mailto:?subject={t}&body={quote(url, safe='')}", "Share by email"),
    ]
    li = "".join(f'<li><a class="l30-btn" href="{E(h)}" aria-label="{E(a)} (opens in a new tab)" target="_blank" rel="noopener noreferrer">{n}</a></li>' if n != "Email"
                 else f'<li><a class="l30-btn" href="{E(h)}" aria-label="{E(a)}">{n}</a></li>' for n, h, a in links)
    li += '<li><button type="button" class="l30-btn" data-share-copy>Copy link</button></li>'
    li += '<li><button type="button" class="l30-btn" data-share-native hidden>Share&hellip;</button></li>'
    return (f'<section class="share" aria-labelledby="share-h" data-url="{E(url)}" data-title="{E(text)}">'
            f'<p class="label" id="share-h">Share this post</p><ul class="share__list">{li}</ul>'
            '<p class="share__status" role="status" aria-live="polite"></p></section>')

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
    main = f'<div class="post">{md(p["body"])}</div>\n{card}\n{share_block(p)}\n<div class="actions"><a class="l30-btn l30-btn--secondary" href="/blog/">All posts</a></div>'
    d = ROOT / p["slug"]; d.mkdir(exist_ok=True)
    (d / "index.html").write_text(page(f"{title} | 30 Products in 30 Days", p["summary"], f"/blog/{p['slug']}/", hero, main, script=SHARE_JS), encoding="utf-8")

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

def build_sitemap(posts):
    """Static pages plus every published blog post. Participant pages are listed in /sitemap-participants.xml (served by the Worker)."""
    pages = [("/", None), ("/blog/", None), ("/advent/", None), ("/community/", None), ("/register.html", None)]
    pages += [(f"/blog/{p['slug']}/", p["date"]) for p in posts]
    urls = "".join(f"<url><loc>{SITE}{loc}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + "</url>" for loc, d in pages)
    (ROOT.parent / "sitemap.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>
""", encoding="utf-8")


START = dt.date(2026, 11, 28)  # Day 1

ADVENT_CSS = """
  .wrap--wide{max-width:1240px}
  .hero--advent .wrap{display:block}
  .hero--advent .l30-progress{margin-top:var(--space-4)}
  .hero--advent .l30-progress,.hero--advent .l30-progress__label{color:#0F1B3D}
  .hero--advent .l30-progress__track{background:#FFFFFF}
  .doors{list-style:none;margin:0;padding:0 8px 8px 0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--space-4)}
  .door{position:relative;aspect-ratio:3/4;min-height:240px;border:var(--border-w) solid var(--outline);border-radius:var(--radius-md);box-shadow:var(--shadow-hard-sm);background:var(--surface-card)}
  .door__inside{position:absolute;inset:0;border-radius:17px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:var(--space-2);padding:12px;text-align:center}
  .door__inside h2{font:800 clamp(16px,1.6vw,19px)/1.1 var(--font-display);letter-spacing:-.5px;margin:0;overflow-wrap:anywhere}
  .door__type{margin:0}
  .door__thumb{display:block;flex:1;min-height:0;width:100%;border-radius:var(--radius-sm)}
  .door__thumb img{display:block;width:100%;height:100%;object-fit:contain}
  .door__thumb:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}
  .door .l30-btn{width:100%;padding:12px 8px}
  .door__cover{all:unset;box-sizing:border-box;position:absolute;inset:0;display:block;cursor:pointer;z-index:2;border-radius:17px}
  .door__cover:focus-visible{outline:3px solid var(--focus-ring);outline-offset:4px}
  .half{position:absolute;inset:0;display:block;will-change:transform}
  .half__in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-2);text-align:center}
  .half--l .half__in{clip-path:polygon(0 0,52% 0,47% 12%,54% 25%,46% 38%,53% 50%,47% 63%,54% 76%,46% 88%,52% 100%,0 100%);border-radius:17px 0 0 17px}
  .half--r .half__in{clip-path:polygon(52% 0,100% 0,100% 100%,52% 100%,46% 88%,54% 76%,47% 63%,53% 50%,46% 38%,54% 25%,47% 12%);border-radius:0 17px 17px 0}
  .half--l{transform-origin:0 100%}.half--r{transform-origin:100% 100%}
  .door--pink .half__in{background:var(--brand-flamingo);color:#0F1B3D}
  .door--blue .half__in{background:var(--brand-orbit);color:var(--on-orbit)}
  .door__date{font:800 22px/1 var(--font-display);letter-spacing:-.5px}
  .door__hint{font:700 12px/1.2 var(--font-body);letter-spacing:2px;text-transform:uppercase}
  .door__cover::after{content:"";position:absolute;top:10px;bottom:10px;left:50%;border-left:3px dashed currentColor;opacity:.45;pointer-events:none}
  .door--pink .door__cover::after{color:#0F1B3D}.door--blue .door__cover::after{color:#FFFFFF}
  .door--locked .door__cover{cursor:not-allowed}
  .door--locked .half__in{background:var(--surface-card);color:var(--ink-muted)}
  .door--locked .door__cover::after{display:none}
  .door--locked{border-style:dashed}
  .door .l30-badge{filter:none}
  .today-tag{position:absolute;top:-14px;left:12px;z-index:3;background:#0F1B3D;color:#FFFFFF;border:2px solid #0F1B3D;border-radius:var(--radius-pill);padding:2px 10px;font:700 12px/1.3 var(--font-body)}
  .today-tag[hidden]{display:none}
  @keyframes tear-l{0%{transform:none}12%{transform:translateX(-1.5%) rotate(-1.5deg)}100%{transform:translate(-85%,35%) rotate(-28deg);opacity:0}}
  @keyframes tear-r{0%{transform:none}12%{transform:translateX(1.5%) rotate(1.5deg)}100%{transform:translate(85%,35%) rotate(28deg);opacity:0}}
  .door.is-tearing .door__cover{pointer-events:none}
  .door.is-tearing .door__cover::after{display:none}
  .door.is-tearing .half--l{filter:drop-shadow(3px 0 0 var(--outline));animation:tear-l .85s cubic-bezier(.55,0,.85,.4) forwards}
  .door.is-tearing .half--r{filter:drop-shadow(-3px 0 0 var(--outline));animation:tear-r .85s cubic-bezier(.55,0,.85,.4) forwards}
  .door.is-open .door__cover{display:none}
  @media (max-width:1100px){.doors{grid-template-columns:repeat(4,minmax(0,1fr))}}
  @media (max-width:760px){.doors{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-3)}}
  @media (prefers-reduced-motion:reduce){.door.is-tearing .half{animation:none;opacity:0}}
"""

ADVENT_JS = """<script>
(function(){
  var KEY="l30-advent-opened",reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var q=new URLSearchParams(location.search).get("today");
  var today=/^\\d{4}-\\d{2}-\\d{2}$/.test(q||"")?q:new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Perth"}).format(new Date());
  var opened=[];try{opened=JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){}
  function save(d){if(opened.indexOf(d)<0)opened.push(d);try{localStorage.setItem(KEY,JSON.stringify(opened))}catch(e){}}
  function finish(door,focus){
    door.classList.remove("is-tearing");door.classList.add("is-open");
    var ins=door.querySelector(".door__inside");ins.removeAttribute("inert");ins.removeAttribute("aria-hidden");
    if(focus){var a=ins.querySelector("a");if(a)a.focus()}
  }
  document.querySelectorAll(".door").forEach(function(door){
    var date=door.dataset.date,has=door.dataset.post==="1",cover=door.querySelector(".door__cover"),tag=door.querySelector(".today-tag");
    if(date===today&&tag)tag.hidden=false;
    if(!has||date>today)return;
    door.classList.remove("door--locked");cover.disabled=false;cover.removeAttribute("aria-disabled");
    cover.setAttribute("aria-label","Tear open Day "+door.dataset.day+", "+door.dataset.label);
    cover.querySelectorAll(".door__hint").forEach(function(h){h.textContent="Tear me open"});
    if(opened.indexOf(date)>=0){finish(door,false);return}
    cover.addEventListener("click",function(){
      if(door.classList.contains("is-tearing"))return;
      save(date);
      if(typeof window.track==="function")window.track("advent_open",{challenge_day:+door.dataset.day});
      if(reduce){finish(door,true);return}
      door.classList.add("is-tearing");
      var done=false,end=function(){if(done)return;done=true;finish(door,true)};
      door.querySelector(".half--r").addEventListener("animationend",end);
      setTimeout(end,1300);
    });
  });
})();
</script>"""

def build_advent(posts):
    by_day = {p["day"]: p for p in posts}
    doors = []
    for n in range(1, 31):
        d = START + dt.timedelta(days=n - 1); label = f"{d.day} {d:%b}"
        p = by_day.get(n); colour = "pink" if n % 2 else "blue"
        thumb = ROOT.parent / "advent" / "thumbs" / f"day-{n:02d}.svg"
        if p and thumb.exists():  # CLAUDE.md: thumbnail in the door, clickable to the product (advent/make_thumb.py)
            inside = (f'<div class="door__inside" inert aria-hidden="true">'
                      f'<a class="door__thumb" href="{E(p["link"])}" target="_blank" rel="noopener" aria-label="Open Day {n:02d}: {E(p["title"])}">'
                      f'<img src="/advent/thumbs/day-{n:02d}.svg" alt="Day {n:02d}: {E(p["title"])}" width="310" height="410"></a>'
                      f'<a class="l30-btn l30-btn--primary" href="/blog/{p["slug"]}/">Read the post</a></div>')
        elif p:
            inside = (f'<div class="door__inside" inert aria-hidden="true">{badge(n,48)}<h2>{E(p["title"])}</h2>'
                      f'<span class="l30-tag l30-tag--shipped door__type">{E(p["type"])}</span>'
                      f'<a class="l30-btn l30-btn--primary" href="/blog/{p["slug"]}/">Read the post</a></div>')
        else:
            inside = '<div class="door__inside" aria-hidden="true"></div>'
        def half(side, hidden):
            aria = ' aria-hidden="true"' if hidden else ""
            return (f'<span class="half half--{side}"{aria}><span class="half__in">'
                    f'{badge(n,56)}<span class="door__date">{label}</span><span class="door__hint">Day {n:02d}</span></span></span>')
        cover = (f'<button type="button" class="door__cover" disabled aria-disabled="true" aria-label="Day {n:02d}, {label}, not open yet">'
                 f'{half("l",False)}{half("r",True)}</button>')
        doors.append(f'<li class="door door--{colour} door--locked" data-day="{n}" data-date="{d}" data-label="{label}" data-post="{1 if p else 0}">'
                     f'<span class="today-tag" hidden>Today</span>{inside}{cover}</li>')
    shipped = sum(1 for p in posts if p["day"] >= 1)  # Day 0 is an announcement, not a launch
    hero = f"""<header class="hero hero--advent"><div class="wrap">
<p class="label">28 Nov to 27 Dec 2026</p>
<h1>Advent <mark>calendar</mark></h1>
<p class="lead">One door a day. Tear it open to reveal the product we launched, then read the post.</p>
<div class="l30-progress" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="{shipped}" aria-label="{shipped} of 30 shipped">
<div class="l30-progress__label">{shipped} OF 30 SHIPPED</div>
<div class="l30-progress__track"><div class="l30-progress__fill" style="width:{shipped/30*100:.1f}%"></div></div></div>
</div></header>"""
    main = f'<ol class="doors" aria-label="Advent calendar">{"".join(doors)}</ol>'
    out = ROOT.parent / "advent"; out.mkdir(exist_ok=True)
    html_ = page("Advent calendar | 30 Products in 30 Days", "One door a day. Tear it open to reveal the product launched that day.",
                 "/advent/", hero, main, extra_css=ADVENT_CSS, script=ADVENT_JS, wide=True, current="advent")
    (out / "index.html").write_text(html_.replace('og:type" content="article"', 'og:type" content="website"'), encoding="utf-8")

def excerpt(body, limit=200):
    """First paragraph as plain text, cut at a word boundary."""
    para = next((x for x in re.split(r"\n\s*\n", body.strip()) if x.strip() and not x.startswith(("#", "-"))), "")
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", " ".join(para.split())).replace("**", "").replace("*", "")
    if len(t) <= limit: return t
    return t[:limit].rsplit(" ", 1)[0].rstrip(".,;:!?") + "\u2026"

def update_home_latest(posts):
    """Homepage block: abridged most recent post; the whole card links to it."""
    if not posts: return
    p = posts[0]  # posts are sorted newest (highest day) first
    n = p["day"]; head = f"Day {n:02d}" if n >= 1 else "Announcement"
    block = (f'<section class="latest" aria-labelledby="latest-h"><p class="label">Latest from the blog</p><h2 id="latest-h">Latest launch</h2>'
             f'<article class="panel latest__card"><div class="panel__head panel__head--pink"><span>{head}</span><span class="latest__type">{E(p["type"])}</span></div>'
             f'<div class="panel__body latest__body"><h3>{E(p["title"])}</h3><p>{E(excerpt(p["body"]))}</p>'
             f'<span class="l30-btn l30-btn--secondary latest__cta" aria-hidden="true">Read the post</span></div>'
             f'<a class="latest__link" href="/blog/{p["slug"]}/" aria-label="Read the post: {head}: {E(p["title"])}"></a></article></section>')
    h = ROOT.parent / "index.html"
    s = h.read_text(encoding="utf-8")
    s = re.sub(r"<!--latest-->.*?<!--/latest-->", lambda m: f"<!--latest-->{block}<!--/latest-->", s, flags=re.S)
    h.write_text(s, encoding="utf-8")

def update_home_count(posts):
    n = sum(1 for p in posts if p["day"] >= 1)
    h = ROOT.parent / "index.html"
    s = h.read_text(encoding="utf-8")
    s = re.sub(r"<!--launched-->.*?<!--/launched-->", f"<!--launched-->{n}<!--/launched-->", s)
    h.write_text(s, encoding="utf-8")

def main():
    posts = sorted((parse(f) for f in (ROOT / "posts").glob("*.md")), key=lambda p: p["day"], reverse=True)
    live = {p["slug"] for p in posts}
    for d in ROOT.iterdir():  # drop pages for posts that were unpublished
        if d.is_dir() and d.name.startswith("day-") and d.name not in live: shutil.rmtree(d)
    for p in posts: build_post(p)
    build_index(posts); build_feed(posts); build_advent(posts); build_sitemap(posts); update_home_count(posts); update_home_latest(posts)
    print(f"built {len(posts)} post(s)")

if __name__ == "__main__": main()
