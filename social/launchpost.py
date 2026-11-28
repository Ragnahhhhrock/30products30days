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
    return meta

def caption(meta, platform):
    """Daily caption from the design-system voice. Instagram links live in the bio."""
    n = meta["day"]
    cta = "Link in bio." if platform == "instagram" else meta["link"]
    return (f"Day {n:02d}: {meta['title']}.\n"
            f"{meta['summary']}\n"
            f"{meta['price']}. {cta}\n"
            f"{n} of 30 shipped.\n"
            f"#30products30days")

def alt_text(meta):
    n = meta["day"]
    return (f"Product card for Day {n:02d}: {meta['title']}, {meta['type'].lower()}, "
            f"{meta['price']}. Progress bar showing {n} of 30 shipped.")
