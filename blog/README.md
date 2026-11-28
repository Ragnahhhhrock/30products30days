# Blog

One post per launch day. Static HTML built from Markdown by `build.py` (no dependencies).

Only files in `blog/posts/` are built, so only those go live. Drafts live on the `blog-drafts` branch in `blog/drafts/`.

## Publish a post
1. Bring the draft over: `git checkout blog-drafts -- blog/drafts/day-07-name.md && git mv blog/drafts/day-07-name.md blog/posts/` (or copy it into `blog/posts/`).
2. Fill the front matter `price` and `link`, and replace every `{{placeholder}}`. The build refuses a post that still has one.
3. `python3 blog/build.py`
4. Commit `blog/` and `index.html` to `main` and push. (The build also updates the "products launched" count on the homepage; day number and days remaining update automatically.)

## Post format
```
---
day: 7
title: Product name
type: Digital
date: 2026-12-04
summary: One sentence.
price: Free
link: https://example.com
---
Body in Markdown: paragraphs, ## headings, - lists, **bold**, [links](https://...).
```
Voice: upbeat and short. Say what it is, who it is for and what it costs. Sentence case, one exclamation mark at most.

## Advent calendar
`build.py` also writes `advent/index.html`: 30 doors, one per day (Day 1 = 28 Nov 2026, Perth time). A door tears open only when its date has arrived **and** its post is in `blog/posts/`; the reveal shows the product and links to the post. Unpublished days carry no product info, so nothing leaks early. Publishing a post (steps above) updates the calendar.
