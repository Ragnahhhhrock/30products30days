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

## 3. Instagram post (@30products30days)
- Render a **square (1080x1080) image** from the daily template: edit day number, product name, price and progress in `social/build.py`, run `python3 social/build.py`. Output is in `instagram/`.
- Caption (daily template from the project's `social-copy.md`):
  ```
  Day NN: Product name.
  One sentence on what it is and who it is for.
  Price. Link in bio.
  N of 30 shipped.
  #30products30days
  ```
- Add alt text: "Product card for Day NN with a progress bar showing N of 30 shipped."
- Post to the 30products30days Instagram account.

## 4. Facebook post (30 Products 30 Days page)
- Use the same image, with the same caption pattern plus the product link.
- Post to the 30products30days Facebook page.

## 5. Commit and push
Commit all changes (blog, advent, social assets) and push to `main` on this repo.

## Checklist
- [ ] Blog post built, no placeholders
- [ ] Advent thumbnail + link + `data-post="1"`
- [ ] Instagram square image posted
- [ ] Facebook image post published
- [ ] Committed and pushed
