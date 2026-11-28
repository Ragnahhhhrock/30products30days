# Participants API

Powers `/account/`, the public pages `/u/<username>/` (blog), `/u/<username>/advent/` and `/u/<username>/day-NN/`, `/calendar/?u=<username>` (redirects to `/u/` once live), `/community/` and `/admin/`. Approved registrants sign in with an emailed one-time link, publish one product post a day, and each gets their own advent calendar. Doors open only when the day's date has arrived (Perth time), and the API never returns future posts.

## Deploy (one time)
1. `cd worker/participants && npx wrangler d1 create 30p30d-participants`, paste the `database_id` into `wrangler.toml`.
2. `npx wrangler d1 execute 30p30d-participants --remote --file=schema.sql`
3. `npx wrangler r2 bucket create 30p30d-participant-images`
4. Onboard `30products30days.com` for sending in Cloudflare Email Service (Workers Paid is needed to email arbitrary recipients). Sign-in emails go out as `contact@30products30days.com`.
5. `npx wrangler secret put TURNSTILE_SECRET`; organiser emails are the `ADMIN_EMAILS` var in `wrangler.toml`.
6. `npx wrangler deploy`. If the workers.dev URL differs from `30p30d-participants.malgordonperth.workers.dev`, update `API` in `participants/p.js`.
7. Sign in at `/account/` with an organiser email, open `/admin/`, and paste the registrant emails to approve them.

## Profile picture and links
Participants can add a profile picture (PNG, JPG or WebP, 2 MB or less, stored in R2) and links to a personal site, X, Instagram and LinkedIn from `/account/`. Handles are turned into clean https links on save and only the matching site is accepted. They show in the hero of the public blog and advent pages (with `sameAs` in the page's JSON-LD) and the picture shows on the community list. **Existing database:** run `npx wrangler d1 execute 30p30d-participants --remote --file=migrations/001-profile-picture-and-links.sql` before deploying the Worker.

## Notes
- Only approved emails receive a link; the login response is identical for everyone else.
- Link tokens are single use, expire in 15 minutes, and live in the URL fragment. Sessions last 30 days and are stored hashed.
- Entries: drafts, publish ahead (stays hidden until its date), edits until 4 Jan 2027. Organisers can hide a post or suspend a participant.
- Post text is stored as plain markdown and escaped on render; links must be https.

## Public pages (indexable)
`pages.js` renders each participant's blog, advent calendar and posts as plain HTML (own title, description, canonical, Open Graph and JSON-LD, plus share buttons for X, Facebook, LinkedIn, Reddit, WhatsApp, email and copy link). `/sitemap-participants.xml` lists them and `robots.txt` points to it. A page with no opened posts is `noindex` until the first one opens.
- Deploy the Worker **first** (`npx wrangler deploy`): `wrangler.toml` routes `30products30days.com/u/*` and the sitemap to it, which needs the domain proxied through Cloudflare. Until then the site keeps using `/calendar/?u=`; the pages switch to `/u/` links by themselves once `/u/` answers.
- Responses are cached for 5 minutes.
