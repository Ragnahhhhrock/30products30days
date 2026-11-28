#!/usr/bin/env python3
"""Post a launch to the 30 Products 30 Days Instagram account and Facebook page.

  python3 social/post.py blog/posts/day-07-name.md [--dry-run]

Env (GitHub Actions secrets): META_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID, INSTAGRAM_USER_ID
Also: IMAGE_URL (public https URL of the square image).
State lives in social/posted.json so a rerun never double-posts a platform.
No dependencies (urllib only). The token is sent in the POST body and never printed.
"""
import json, os, pathlib, sys, time, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from launchpost import parse, caption, alt_text

API = "https://graph.facebook.com/v21.0"
STATE = pathlib.Path(__file__).resolve().parent / "posted.json"

def call(path, data):
    body = urllib.parse.urlencode({**data, "access_token": os.environ["META_PAGE_ACCESS_TOKEN"]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(f"{API}/{path}", data=body), timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Graph API {path} failed: {e.code} {e.read().decode()[:400]}")

def get(path, params):
    q = urllib.parse.urlencode({**params, "access_token": os.environ["META_PAGE_ACCESS_TOKEN"]})
    with urllib.request.urlopen(f"{API}/{path}?{q}", timeout=60) as r:
        return json.load(r)

def facebook(meta, image_url):
    r = call(f"{os.environ['FACEBOOK_PAGE_ID']}/photos",
             {"url": image_url, "caption": caption(meta, "facebook"),
              "alt_text_custom": alt_text(meta), "published": "true"})
    return r.get("post_id") or r["id"]

def instagram(meta, image_url):
    uid = os.environ["INSTAGRAM_USER_ID"]
    c = call(f"{uid}/media", {"image_url": image_url, "caption": caption(meta, "instagram"),
                              "alt_text": alt_text(meta)})["id"]
    for _ in range(30):  # wait for Instagram to fetch and process the image
        s = get(c, {"fields": "status_code"}).get("status_code")
        if s == "FINISHED":
            break
        if s in ("ERROR", "EXPIRED"):
            sys.exit(f"Instagram container {c} status {s}")
        time.sleep(4)
    else:
        sys.exit(f"Instagram container {c} not ready in time")
    return call(f"{uid}/media_publish", {"creation_id": c})["id"]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)
    meta = parse(args[0])
    day = str(meta["day"])
    if meta["day"] < 1:
        print(f"Day {day} is not a launch; skipping."); return
    image_url = os.environ.get("IMAGE_URL", "")
    if not image_url.startswith("https://"):
        sys.exit("IMAGE_URL must be a public https URL")
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    done = state.get(day, {})
    for name, fn in (("facebook", facebook), ("instagram", instagram)):
        if name in done:
            print(f"{name}: already posted ({done[name]}); skipping."); continue
        if dry:
            print(f"--- {name} (dry run)\nimage: {image_url}\n{caption(meta, name)}\nalt: {alt_text(meta)}\n")
            continue
        done[name] = fn(meta, image_url)
        state[day] = done
        STATE.write_text(json.dumps(state, indent=2) + "\n")  # save after each platform
        print(f"{name}: posted {done[name]}")

if __name__ == "__main__":
    main()
