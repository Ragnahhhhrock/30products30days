# Repo rules

Read `design-system/README.md` and `design-system/tokens.json` before building anything. Nothing ships that does not conform to them.

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
