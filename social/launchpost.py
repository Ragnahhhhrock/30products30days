"""Shared helpers for the launch social posts (front matter + caption)."""
import pathlib, re, sys

def parse(path):
    t = pathlib.Path(path).read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    if not m:
        sys.exit(f"{path}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    for k in ("day", "title", "type", "summary", "price", "link"):
        if not meta.get(k):
            sys.exit(f"{path}: front matter '{k}' is empty")
    meta["day"] = int(meta["day"])
    meta["slug"] = pathlib.Path(path).stem
    return meta

SITE = "https://30products30days.com"

def blog_url(meta):
    return f"{SITE}/blog/{meta['slug']}/"

def day_label(meta):
    """"Day 01 of 29" (30 minus the day = days remaining); the last day reads "Day 30: final day"."""
    n = meta["day"]
    return "Day 30: final day" if n >= 30 else f"Day {n:02d} of {30 - n}"

def caption(meta, platform):
    """Daily caption in the design-system voice, ending with the blog post link for this launch.
    Instagram captions are not clickable, so it is shown without https://."""
    n = meta["day"]
    url = blog_url(meta)
    link = url.replace("https://", "") if platform == "instagram" else url
    head = f"{day_label(meta)}{'.' if n >= 30 else ':'} {meta['title']}." if n < 30 else f"{day_label(meta)}. {meta['title']}."
    return (f"{head}\n"
            f"{meta['summary']}\n"
            f"{meta['price']}. Read the launch post: {link}\n"
            f"{n} of 30 shipped.\n"
            f"#30products30days")

def alt_text(meta):
    n = meta["day"]
    return (f"Product card for {day_label(meta)}, {meta['title']}, {meta['type'].lower()}, "
            f"{meta['price']}. Progress bar showing {n} of 30 shipped.")
