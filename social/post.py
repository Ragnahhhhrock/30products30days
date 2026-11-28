#!/usr/bin/env python3
"""Queue a launch on the 30 Products 30 Days Instagram account and Facebook page through Buffer.

  python3 social/post.py blog/posts/day-07-name.md [--dry-run]
  python3 social/post.py --list-channels

Same Buffer account and API key as the other autoposters (Buffer, Settings, API).
Env:
  BUFFER_API_KEY                  secret (required unless --dry-run)
  BUFFER_ORGANIZATION_ID          optional; the account's first organisation if unset
  BUFFER_INSTAGRAM_CHANNEL        channel id or name of the 30products30days Instagram channel
  BUFFER_FACEBOOK_CHANNEL         channel id or name of the 30products30days Facebook page channel
  IMAGE_URL                       public https URL of the square image
  BUFFER_MODE                     addToQueue (default, Buffer picks the next slot) or shareNow
The channel is never guessed: if it is not set or not found, the script lists what Buffer has and stops,
so a launch can never land on another project's account. State is kept in social/posted.json.
"""
import json, os, pathlib, sys, time
import urllib.error, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from launchpost import parse, caption, alt_text

API = os.environ.get("BUFFER_API_URL", "https://api.buffer.com")
STATE = pathlib.Path(__file__).resolve().parent / "posted.json"
# Launch order: blog post, advent calendar entry, then Instagram, then Facebook. A failure stops the run, so Facebook never goes before Instagram.
PLATFORMS = (("instagram", "BUFFER_INSTAGRAM_CHANNEL"), ("facebook", "BUFFER_FACEBOOK_CHANNEL"))

def q(s):
    return json.dumps(s, ensure_ascii=False)

def gql(query, key):
    req = urllib.request.Request(API, data=json.dumps({"query": query}).encode(), headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "30products30days-social/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Buffer returned {e.code}: {e.read().decode()[:300]}")

def channels(key):
    org = os.environ.get("BUFFER_ORGANIZATION_ID")
    if not org:
        d = gql("query { account { organizations { id name } } }", key)
        orgs = (((d.get("data") or {}).get("account") or {}).get("organizations")) or []
        if not orgs:
            sys.exit(f"No Buffer organisation found (set BUFFER_ORGANIZATION_ID): {json.dumps(d)[:300]}")
        org = orgs[0]["id"]
    d = gql("query { channels(input: { organizationId: %s }) { id name service } }" % q(org), key)
    return (d.get("data") or {}).get("channels") or []

def show(chans):
    for c in chans:
        print(f"  {c['service']:<10} {c['name']:<40} id={c['id']}")

def pick(chans, service, want):
    """Match by exact id, else exact name (case-insensitive), within the right service. Never a default."""
    pool = [c for c in chans if str(c["service"]).lower() == service]
    for c in pool:
        if c["id"] == want:
            return c
    hit = [c for c in pool if c["name"].strip().lower() == want.strip().lower()]
    return hit[0] if len(hit) == 1 else None

def mutation(ch, service, text, image_url, alt, level):
    meta = ""
    if level == 0:
        meta = {"instagram": "metadata: { instagram: { type: post, shouldShareToFeed: true } }",
                "facebook": "metadata: { facebook: { type: post } }"}[service]
    img_meta = f"metadata: {{ altText: {q(alt)} }}" if level <= 1 else ""
    mode = os.environ.get("BUFFER_MODE") or "addToQueue"  # an empty variable counts as unset
    return f"""mutation {{
  createPost(input: {{
    text: {q(text)}
    channelId: {q(ch['id'])}
    schedulingType: automatic
    mode: {mode}
    {meta}
    assets: [{{ image: {{ url: {q(image_url)} {img_meta} }} }}]
  }}) {{
    ... on PostActionSuccess {{ post {{ id }} }}
    ... on MutationError {{ message }}
  }}
}}"""

def create(ch, service, meta, image_url, key, dry):
    text, alt = caption(meta, service), alt_text(meta)
    err = ""
    for level in (0, 1, 2):  # full metadata, then alt text only, then the bare image post
        m = mutation(ch, service, text, image_url, alt, level)
        if dry:
            print(m); return "dry-run"
        d = gql(m, key)
        res = (d.get("data") or {}).get("createPost")
        if res and res.get("post"):
            return res["post"]["id"]
        err = (res or {}).get("message") or json.dumps(d.get("errors") or d)[:300]
        print(f"  {service}: attempt {level + 1} rejected: {err}")
    sys.exit(f"{service}: could not queue the post: {err}")

def wait_live(url, minutes=5):
    end = time.time() + minutes * 60
    while time.time() < end:
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "30products30days-social/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(15)
    return False

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    key = os.environ.get("BUFFER_API_KEY", "")
    if "--list-channels" in sys.argv:
        if not key:
            sys.exit("BUFFER_API_KEY is not set")
        show(channels(key)); return
    if not args:
        sys.exit(__doc__)
    meta = parse(args[0])
    day = str(meta["day"])
    if meta["day"] < 1:
        print(f"Day {day} is not a launch; skipping."); return
    image_url = os.environ.get("IMAGE_URL", "")
    if not image_url.startswith("https://"):
        sys.exit("IMAGE_URL must be a public https URL")
    if not key and not dry:
        sys.exit("BUFFER_API_KEY is not set, so nothing can be posted")
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    done = state.get(day, {})
    todo = [(p, v) for p, v in PLATFORMS if p not in done]
    if not todo:
        print(f"Day {day} already posted: {done}"); return
    chans = channels(key) if key else []
    picked = {}
    for p, var in todo:
        want = os.environ.get(var, "").strip()
        if dry and not key:
            picked[p] = {"id": want or f"dry-{p}", "name": want or p, "service": p}; continue
        ch = pick(chans, p, want) if want else None
        if not ch:
            print(f"{var} is {'not set' if not want else 'not a ' + p + ' channel in this Buffer account'}. Channels available:")
            show(chans)
            sys.exit(f"Set {var} to the id or exact name of the 30products30days {p} channel.")
        picked[p] = ch
    if not dry and not wait_live(image_url):
        sys.exit(f"Image is not live yet: {image_url}")
    for p, _ in todo:
        print(f"== {p} -> {picked[p]['name']}")
        pid = create(picked[p], p, meta, image_url, key, dry)
        if not dry:
            done[p] = pid
            state[day] = done
            STATE.write_text(json.dumps(state, indent=2) + "\n")
            print(f"  queued ({pid})")

if __name__ == "__main__":
    main()
