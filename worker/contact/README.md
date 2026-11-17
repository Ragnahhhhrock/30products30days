# Contact form Worker

Replaces the public `mailto:` links. Flow: Turnstile verify -> honeypot/keyword filter -> email to `TO_EMAIL` via Email Routing.

Deploy: `npx wrangler deploy`, then set secrets `TURNSTILE_SECRET` and `TO_EMAIL`.
Live at https://30p30d-contact.malgordonperth.workers.dev (binding `MAIL`, secrets `TO_EMAIL`, `TURNSTILE_SECRET`).
