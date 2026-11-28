# Repo rules

Read `design-system/README.md` and `design-system/tokens.json` before building anything. Nothing ships that does not conform to them.

## Product launches

For every new product launch, follow `LAUNCH_WORKFLOW.md` (blog post, advent calendar entry, Instagram post, Facebook post).

## Advent calendar entries (`advent/index.html`)

Whenever you create or fill an advent calendar entry (a `.door` for a given day), do both of these, every time:

1. **Create a thumbnail** for the product using the design system, and insert it into that day's door (`.door__inside`).
   - Save it as `advent/thumbs/day-NN.svg` (NN is the zero-padded day, e.g. `day-07.svg`). PNG only if SVG is not practical.
   - 3:4 portrait to match the door (`aspect-ratio: 3/4`), in a rounded frame with the 3px `outline` border and a hard bottom-right offset shadow (`shadow-hard-sm`). No blurred shadows, no stock photos.
   - Tokens only: `ink` outlines and text; `brand-launch`, `brand-flamingo`, `brand-orbit` fills (at most three brand colours); Bricolage Grotesque 800 for the day number and product name, DM Sans for anything else. Include the day badge (swap only the number, never redraw or recolour it) and the product name in sentence case.
   - Text contrast 4.5:1 or better. `alt` text: "Day NN: Product name".
2. **Make the thumbnail clickable**, linking to the product.
   - Wrap the thumbnail `<img>` in an `<a>` pointing at the product's own URL (the product site or page, not the blog post), inside `.door__inside`.
   - Visible focus state, 44px or larger touch target, accessible name such as "Open Day NN: Product name". Use `target="_blank" rel="noopener"` only for external product URLs.
   - Set `data-post="1"` on the door so the page script unlocks it on its date.

After editing, check the door opens on its date, the thumbnail renders and the link goes to the right product. Then commit and push to this repo.

## Challenge badge (every product)
Every product built for the challenge must carry the "Part of 30 Products 30 Days" badge (source: https://30products30days.com/badge/). Put it on the product's own page, in the footer or main page area, linking to https://30products30days.com/?ref=badge. Paste the snippet as is: no script, no tracking, nothing to host. Do not recolour or redraw it. Use the light snippet on light pages, the dark one on dark pages. If the product has no HTML (physical, service), use a plain link to the same URL on its page or link-in-bio.

Light page:
```html
<a href="https://30products30days.com/?ref=badge" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:6px 20px 6px 8px;background:#FFD21F;color:#0F1B3D;border:3px solid #0F1B3D;border-radius:999px;box-shadow:4px 4px 0 0 #0F1B3D;font:700 15px/1.2 'DM Sans',Arial,sans-serif;text-decoration:none"><img src="https://30products30days.com/brand/logos/launch-badge.svg" alt="" width="32" height="32" style="display:block"><span>Part of 30 Products 30 Days</span></a>
```
Dark page:
```html
<a href="https://30products30days.com/?ref=badge" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:6px 20px 6px 8px;background:#16234F;color:#F2F5FA;border:3px solid #F2F5FA;border-radius:999px;box-shadow:4px 4px 0 0 #050A1F;font:700 15px/1.2 'DM Sans',Arial,sans-serif;text-decoration:none"><img src="https://30products30days.com/brand/logos/launch-badge.svg" alt="" width="32" height="32" style="display:block"><span>Part of 30 Products 30 Days</span></a>
```
