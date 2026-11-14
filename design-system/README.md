# 30 Products 30 Days

A design system for the 30 Products 30 Days challenge: one product made and shipped every day for thirty days, digital, physical or a service. The look is a sticker you slap on every launch.

## Content fundamentals
- **Voice:** upbeat and short. Say what the product is, who it is for and what it costs. One exclamation mark per post at most.
- **Naming:** day first. Every product reads "Day 07" before its own name, and gets its own day badge as its icon.
- **Copy examples:** "Made today, live tonight." "Day 07: Product name here." "Grab it." Avoid hype words and vague claims.
- **Case:** sentence case everywhere. Labels such as "7 OF 30 SHIPPED" are set in caps with +2 tracking.

## Visual foundations
- **Colour:** Midnight (`ink`) for text and every outline; Launch yellow (`brand-launch`) for hero fills and the badge; Flamingo (`brand-flamingo`) for highlights; Orbit (`brand-orbit`) for buttons and links; Cloud (`surface-page`) as the ground. Use at most three brand colours in a layout. Text pairs: ink on yellow or pink, white on Orbit or Midnight. A dark theme swaps surfaces and ink; the brand colours stay.
- **Type:** Bricolage Grotesque 800 for anything shouted (headlines, day numbers, prices); DM Sans for everything else. Font files are in `fonts/`. Scale in `tokens.json`: 112 / 56 / 32 / 22 display, 20 / 16 body, 13 caps label.
- **Shape:** 3px outline (`border-w`) on everything clickable or shareable. Hard offset shadows (`shadow-hard-sm`, `-md`, `-lg`), never blurred, always bottom-right. Corners `radius-sm` 12, `radius-md` 20, `radius-lg` 28; buttons and tags are pills.
- **Spacing:** 4 / 8 / 16 / 24 / 40 / 64. Minimum side gutter 16px; touch targets 44px or more.
- **Imagery:** product shots inside a rounded frame with the hard shadow. No stock photos.
- **Motion:** only the button press, moving 2px then 4px toward its shadow. Respect reduced motion.

## Logos and assets
`assets/Logos`: the badge (`launch-badge.svg`), the badge for dark grounds (`launch-badge-reversed.svg`) and the two-line wordmark (`launch-wordmark.svg`), all drawn from Bricolage Grotesque 800 outlines. `assets/Social`: the Open Graph image (1200x630), the Twitter card image (1200x600) and ready-to-paste `meta-tags.html`. Never redraw or recolour the badge; swap only the number.

## Components
Button, Tag, DayBadge, ProductCard and ProgressBar, exported as `window.Launch30`. Load `tokens.css`, `components/bundle.css`, React 18 and `components/bundle.js`.

## Rules
- One primary button per view.
- Every outline is `outline` at `border-w`; never a thin grey border on an interactive element.
- Status is shown by fill and outline style as well as colour (Shipped filled navy, Building yellow, Coming up dashed).
- Text contrast is 4.5:1 or better in both themes.
