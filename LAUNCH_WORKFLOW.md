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

## 3. Instagram post, 4. Facebook post, 5. LinkedIn post (automatic)
Order is fixed: blog post, advent entry, Instagram, Facebook, LinkedIn. Push the blog post and the advent entry together (or the advent entry first). Pushing the blog post to `main` triggers `.github/workflows/social-post.yml`, which first checks the day's advent entry exists (it stops and posts nothing if not), then:
- renders the images from the post's front matter (`social/render.py`, design-system tokens only): square 1080x1080 for Instagram and Facebook, landscape 1200x628 for LinkedIn;
- queues it on the 30products30days Instagram account, the Facebook page and Malcolm's personal LinkedIn through Buffer (`social/post.py`; Buffer posts at each channel's next slot) with the daily caption:
  ```
  Day NN of R: Product name.   (R = 30 minus NN, days remaining: Day 01 of 29; Day 30 reads "Day 30: final day")
  One sentence on what it is and who it is for.
  Price. Read the launch post: <blog post URL>   (https://30products30days.com/blog/<post-file-name>/)
  N of 30 shipped.
  #30products30days
  ```
- records the result in `social/posted.json`, so a rerun never double-posts.

Before pushing, preview the image: `python3 social/render.py blog/posts/day-NN-name.md out.png`. Check the run in the repo's Actions tab after the push. Requires secret `BUFFER_API_KEY` (the channel ids are built into the workflow). Test without posting via the workflow's manual run with `dry_run` on.

## 6. Commit and push
Commit the blog post, advent entry and thumbnail, and push to `main` on this repo. This push triggers the social posts.

## Checklist
- [ ] Blog post built, no placeholders
- [ ] Advent thumbnail + link + `data-post="1"`
- [ ] Social workflow run succeeded (Instagram, Facebook, LinkedIn)
- [ ] Committed and pushed
