#!/usr/bin/env python3
"""Copy a launch blog post to the organiser's participant page (/u/<user>/ blog + advent door).

  python3 social/sync_participant.py blog/posts/day-07-name.md [--dry-run]

Env: PARTICIPANT_SYNC_TOKEN (secret, required unless --dry-run), PARTICIPANT_SYNC_URL (default the Worker's /api/sync/entry
on the main domain), PARTICIPANT_SYNC_USER (default malgordon). Idempotent: re-running just re-publishes the same entry.
"""
import json, os, pathlib, re, sys, time, urllib.error, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from launchpost import parse

URL = os.environ.get("PARTICIPANT_SYNC_URL", "https://30p30d-participants.malgordonperth.workers.dev/api/sync/entry")
USER = os.environ.get("PARTICIPANT_SYNC_USER", "malgordon")

def payload(path):
    meta = parse(path)
    t = pathlib.Path(path).read_text(encoding="utf-8")
    body = re.sub(r"\A---\n.*?\n---\n", "", t, count=1, flags=re.S).strip()
    return {"username": USER, "day": meta["day"], "product_name": meta["title"], "pitch": meta["summary"],
            "product_url": meta["link"], "price": meta["price"], "type": meta["type"], "body": body}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    d = payload(args[0])
    if dry:
        print(json.dumps(d, indent=2, ensure_ascii=False)); return
    token = os.environ.get("PARTICIPANT_SYNC_TOKEN", "")
    if not token:
        sys.exit("PARTICIPANT_SYNC_TOKEN is not set")
    req = urllib.request.Request(URL, data=json.dumps(d).encode(), method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "30products30days-sync/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                print(r.status, r.read().decode()); return
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if e.code < 500:
                sys.exit(f"sync failed {e.code}: {msg}")
            print(f"attempt {attempt+1}: {e.code} {msg}")
        except urllib.error.URLError as e:
            print(f"attempt {attempt+1}: {e}")
        time.sleep(3 * (attempt + 1))
    sys.exit("sync failed after retries")

main()
