# Product launch workflow

Run this for every new product launch (one per day, Day 1 = 28 Nov 2026, Perth time). Everything must conform to `design-system/README.md` and `design-system/tokens.json`. Do not put "built with Claude" in promotional material unless explicitly told to.

Inputs needed: day number, product name, type (Digital / Physical / Service), one-sentence summary, price, product URL.

## 1. Blog post
- Create `blog/posts/day-NN-product-name.md` with front matter (`day`, `title`, `type`, `date`, `summary`, `price`, `link`). Format and voice: see `blog/README.md`.
- Replace every `{{placeholder}}`, then run `python3 blog/build.py`.
- The blog post is the official launch notification.

## 2. Advent calendar entry
Follow "Advent calendar entries" in `CLAUDE.md`:
- Create `advent/thumbs/day-NN.svg` (3:4, design-system tokens only, day badge, product name, alt text "Day NN: Product name").
- Insert it in that day's `.door__inside`, wrapped in a link to the product URL (not the blog post). Set `data-post="1"` on the door.
- Re-run `python3 blog/build.py` and check the door opens on its date.

## 3 and 4. Instagram and Facebook posts (automatic)
Pushing the blog post to `main` triggers `.github/workflows/social-post.yml`, which:
- renders the square (1080x1080) image from the post's front matter (`social/render.py`, design-system tokens only);
- queues it on the 30products30days Instagram account and Facebook page through Buffer (`social/post.py`; Buffer posts at each channel's next slot) with the daily caption:
  ```
  Day NN: Product name.
  One sentence on what it is and who it is for.
  Price. Link in bio.   (Facebook: the product link instead of "Link in bio.")
  N of 30 shipped.
  #30products30days
  ```
- records the result in `social/posted.json`, so a rerun never double-posts.

Before pushing, preview the image: `python3 social/render.py blog/posts/day-NN-name.md out.png`. Check the run in the repo's Actions tab after the push. Requires secret `BUFFER_API_KEY` and variables `BUFFER_INSTAGRAM_CHANNEL`, `BUFFER_FACEBOOK_CHANNEL`. Test without posting via the workflow's manual run with `dry_run` on.

## 5. Commit and push
Commit the blog post, advent entry and thumbnail, and push to `main` on this repo. This push triggers the social posts.

## Checklist
- [ ] Blog post built, no placeholders
- [ ] Advent thumbnail + link + `data-post="1"`
- [ ] Social workflow run succeeded (Instagram + Facebook)
- [ ] Committed and pushed
