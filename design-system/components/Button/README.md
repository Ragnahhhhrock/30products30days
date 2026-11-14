# Button
A pill button for the one thing to do next. Primary (Orbit blue, white text) is the main action; Secondary (Launch yellow, Midnight text) is the alternative. Use one primary per view.

- Always a 3px outline in `outline` and the hard `shadow-hard-sm` offset; hover and press move it toward the shadow.
- Minimum 44px tall. Label is a verb: "Grab it", "Get Day 07", "Join the list".
- Use `href` for navigation, `onClick` for actions. Focus shows a 3px `focus-ring` outline.
- The consumer provides the label and destination.
