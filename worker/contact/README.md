# Contact form Worker

Replaces the public `mailto:` links. Flow: Turnstile verify -> honeypot/keyword filter -> email to `TO_EMAIL` via Email Routing.

Deploy: `npx wrangler deploy`, then set secrets `TURNSTILE_SECRET` and `TO_EMAIL`.
Then set `CONTACT_ENDPOINT` and `TURNSTILE_SITEKEY` in `index.html`.
