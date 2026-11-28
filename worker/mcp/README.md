# MCP server

Lets registrants' AI agents complete their profile and submit their daily product and post. It is a remote MCP server (streamable HTTP, stateless JSON-RPC) at `https://mcp.30products30days.com/mcp`, and shares the participants Worker's D1 database and image bucket, so anything an agent saves appears in `/account/` and on the public `/u/<username>/` pages.

## Launch flow (like submitting to Product Hunt through its MCP server)
`start_launch` creates a private draft for a day and returns a checklist of what is missing. `update_launch` fills it in, `upload_launch_image` adds a product shot (https link or base64, 2 MB), `get_launch` returns the preview (title, tagline, post, image, public link, opening date) and checklist, and `submit_launch` goes public only after `confirm: true`; without it, it just returns the preview. `withdraw_launch` makes a launch private again. Clients that support MCP prompts also get a guided `launch_my_product` command.

Other tools: `get_style_guide`, `get_challenge_status`, `list_launches`, `get_profile`, `update_profile` (name, bio, website, X, Instagram, LinkedIn), `upload_profile_picture`.

Same rules as the web account page: https links only, 8 link cap, spam keyword check, one launch per day (1 to 30), edits until 4 Jan 2027, launches stay hidden until their date (Perth time), organisers can still hide a post. Every call is scoped to the signed-in participant. 200 tool calls an hour, 40 submissions an hour and 30 image fetches an hour per participant.

## Sign-in
OAuth 2.1 with PKCE and dynamic client registration (`/register`, `/authorize`, `/token`, plus `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`). On `/authorize` the registrant enters their email (Turnstile), we email a single-use 15-minute link, and they choose Allow on a consent page. Only approved participants can connect; the answer is the same for any address. Access tokens last 24 hours, refresh tokens 30 days and rotate on use. Suspending a participant stops their tokens working.

## Deploy (one time)
1. `cd worker/mcp && npx wrangler d1 execute 30p30d-participants --remote --file=schema.sql` (adds the `oauth_*` tables to the existing database).
2. `npx wrangler secret put TURNSTILE_SECRET` (the same secret as the participants Worker).
3. In Cloudflare, add `mcp.30products30days.com` to the Turnstile widget's allowed hostnames (the site key is in `wrangler.toml`).
4. `npx wrangler deploy`. The custom domain `mcp.30products30days.com` is created automatically; the zone must be on Cloudflare.
5. Test: add `https://mcp.30products30days.com/mcp` as a custom connector in Claude and sign in with an approved email. The registrant page is `/connect/`.

## Notes
- If the participants Worker's URL changes, update `API_ORIGIN` in `tools.js` (image links).
- Keep `SPAM_EXEMPT_EMAILS` in `wrangler.toml` in step with the participants Worker.
