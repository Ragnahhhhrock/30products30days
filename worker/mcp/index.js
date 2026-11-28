// Remote MCP server for 30 Products 30 Days registrants.
// Endpoint: POST /mcp (Bearer token). OAuth 2.1 + PKCE with dynamic client registration; the registrant approves by emailed one-time link.
// Bindings: DB (D1, shared with the participants Worker), IMAGES (R2), EMAIL. Secret: TURNSTILE_SECRET.

import { handleMcp, limited, SITE } from "./tools.js";

const FROM = "30 Products 30 Days <contact@30products30days.com>";
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const enc = new TextEncoder();
const nowSec = () => Math.floor(Date.now() / 1000);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);

const ACCESS_TTL = 86400, REFRESH_TTL = 30 * 86400, CODE_TTL = 300, REQ_TTL = 1800, LINK_TTL = 900;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id", "Access-Control-Expose-Headers": "WWW-Authenticate" };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...extra } });
const oerr = (error, description, status = 400) => json({ error, error_description: description }, status);

// ---------- pages (design system: Cloud ground, Midnight ink, 3px outline, hard shadow) ----------
const CSS = `
@font-face{font-family:"Bricolage Grotesque";src:url(${SITE}/design-system/fonts/BricolageGrotesque-ExtraBold.ttf);font-weight:800}
@font-face{font-family:"DM Sans";src:url(${SITE}/design-system/fonts/DMSans-Regular.ttf);font-weight:400}
@font-face{font-family:"DM Sans";src:url(${SITE}/design-system/fonts/DMSans-Bold.ttf);font-weight:700}
:root{--page:#F2F5FA;--card:#fff;--ink:#0F1B3D;--muted:#33415F;--launch:#FFD21F;--flamingo:#FF6F91;--orbit:#4B5BFF;--link:#3A49E6}
@media(prefers-color-scheme:dark){:root{--page:#0B1330;--card:#16234F;--ink:#F2F5FA;--muted:#B9C3DD;--link:#A5AFFF}}
*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:400 16px/1.5 "DM Sans",Arial,sans-serif;padding:24px 16px}
main{max-width:520px;margin:0 auto}
h1{font:800 32px/1.1 "Bricolage Grotesque","Arial Black",Arial,sans-serif;letter-spacing:-.5px;margin:8px 0 16px}
mark{background:var(--launch);color:#0F1B3D;padding:0 8px;border-radius:12px}
.label{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
.panel{background:var(--card);border:3px solid var(--ink);border-radius:20px;box-shadow:4px 4px 0 var(--ink);padding:24px;margin-top:16px}
label{display:block;font-weight:700;margin-bottom:8px}
input[type=email]{width:100%;min-height:44px;padding:8px 16px;border:3px solid var(--ink);border-radius:12px;background:var(--card);color:var(--ink);font:inherit;margin-bottom:16px}
button{min-height:44px;padding:8px 24px;border:3px solid var(--ink);border-radius:999px;font:700 16px "DM Sans",Arial,sans-serif;cursor:pointer;box-shadow:4px 4px 0 var(--ink);margin:16px 8px 0 0}
button:active{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.primary{background:var(--orbit);color:#fff}.secondary{background:var(--card);color:var(--ink)}
:focus-visible{outline:3px solid var(--link);outline-offset:2px}
.help{color:var(--muted);font-size:15px}a{color:var(--link)}ul{padding-left:20px}
@media(prefers-reduced-motion:reduce){button:active{transform:none}}`;

function page(title, inner, extraHead = "") {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)} | 30 Products 30 Days</title><style>${CSS}</style>${extraHead}</head><body><main><p class="label">30 Products 30 Days</p>${inner}</main></body></html>`;
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline' https://challenges.cloudflare.com; font-src ${SITE}; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; img-src data:; frame-ancestors 'none'; base-uri 'none'`,
  } });
}
const errPage = (msg) => { const r = page("Cannot connect", `<h1>Cannot <mark>connect</mark></h1><div class="panel"><p>${esc(msg)}</p></div>`); return new Response(r.body, { status: 400, headers: r.headers }); };

// ---------- helpers ----------
const redirectOk = (u) => { try { const x = new URL(u); return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname)); } catch { return false; } };
const withParams = (uri, params) => { const u = new URL(uri); for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) u.searchParams.set(k, v); return u.toString(); };

async function turnstileOk(env, token, ip) {
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: new URLSearchParams({ secret: String(env.TURNSTILE_SECRET ?? "").replace(/\s+/g, ""), response: String(token ?? ""), remoteip: ip || "" }),
  }).then((x) => x.json()).catch(() => ({ success: false }));
  return !!r.success;
}

async function authBearer(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer (\S{20,100})$/);
  if (!m) return null;
  return env.DB.prepare(
    "SELECT p.* FROM oauth_tokens t JOIN participants p ON p.id=t.participant_id WHERE t.hash=? AND t.kind='access' AND t.expires_at>? AND p.status='approved'"
  ).bind(await sha(m[1]), nowSec()).first();
}

async function issueTokens(env, participantId, clientId) {
  const access = rand(), refresh = rand(), t = nowSec();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO oauth_tokens (hash, kind, participant_id, client_id, expires_at) VALUES (?, 'access', ?, ?, ?)").bind(await sha(access), participantId, clientId, t + ACCESS_TTL),
    env.DB.prepare("INSERT INTO oauth_tokens (hash, kind, participant_id, client_id, expires_at) VALUES (?, 'refresh', ?, ?, ?)").bind(await sha(refresh), participantId, clientId, t + REFRESH_TTL),
    env.DB.prepare("DELETE FROM oauth_tokens WHERE expires_at<?").bind(t),
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope: "entries" };
}

async function readBody(request) {
  const ct = request.headers.get("Content-Type") || "";
  try {
    if (ct.includes("application/json")) return await request.json();
    return Object.fromEntries(await request.formData());
  } catch { return null; }
}

// ---------- OAuth ----------
const metaAS = (env) => ({
  issuer: env.ISSUER, authorization_endpoint: env.ISSUER + "/authorize", token_endpoint: env.ISSUER + "/token", registration_endpoint: env.ISSUER + "/register",
  response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"], scopes_supported: ["entries"],
});
const metaPR = (env) => ({ resource: env.ISSUER + "/mcp", authorization_servers: [env.ISSUER], bearer_methods_supported: ["header"], scopes_supported: ["entries"], resource_name: "30 Products 30 Days" });

async function register(request, env, ip) {
  if (await limited(env, "reg:" + ip, 30, 3600)) return oerr("temporarily_unavailable", "Too many registrations", 429);
  const d = await readBody(request);
  const uris = d && Array.isArray(d.redirect_uris) ? d.redirect_uris.map(String).filter(redirectOk).slice(0, 10) : [];
  if (!uris.length || uris.length !== d.redirect_uris.length) return oerr("invalid_redirect_uri", "redirect_uris must be https (or http on localhost)");
  const id = "c_" + rand().slice(0, 28), name = clean(d.client_name, 80) || "MCP client";
  await env.DB.prepare("INSERT INTO oauth_clients (client_id, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?)").bind(id, name, JSON.stringify(uris), nowSec()).run();
  return json({ client_id: id, client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: nowSec() }, 201);
}

async function authorize(url, env) {
  const q = url.searchParams;
  const client = await env.DB.prepare("SELECT * FROM oauth_clients WHERE client_id=?").bind(q.get("client_id") || "").first();
  if (!client) return errPage("Unknown app. Add this server to your agent again.");
  const redirect = q.get("redirect_uri") || "";
  if (!JSON.parse(client.redirect_uris).includes(redirect)) return errPage("This app's return address does not match.");
  const state = q.get("state") || "";
  const back = (error) => Response.redirect(withParams(redirect, { error, state }), 302);
  if (q.get("response_type") !== "code") return back("unsupported_response_type");
  const challenge = q.get("code_challenge") || "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return back("invalid_request");
  const rid = rand();
  await env.DB.prepare("INSERT INTO oauth_requests (id, client_id, redirect_uri, state, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(rid, client.client_id, redirect, state.slice(0, 500), challenge, nowSec() + REQ_TTL).run();
  return page("Connect your agent", `
<h1>Connect your <mark>agent</mark></h1>
<p><strong>${esc(client.client_name)}</strong> wants to help with your profile, products and posts. Sign in with the email you registered with. We send a one-time link, so there is no password.</p>
<form class="panel" method="post" action="/authorize/email">
<input type="hidden" name="rid" value="${esc(rid)}">
<label for="email">Email</label><input type="email" id="email" name="email" autocomplete="email" required>
<div class="cf-turnstile" data-sitekey="${esc(env.TURNSTILE_SITEKEY)}"></div>
<button type="submit" class="primary">Email me a link</button>
<p class="help">Not registered yet? <a href="${SITE}/register.html">Join the challenge</a>. We approve participants before they can connect.</p>
</form>`, `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`);
}

async function authorizeEmail(request, env, ip) {
  const d = await readBody(request);
  if (!d) return errPage("Something went wrong. Start again from your agent.");
  const email = clean(d.email, 200).toLowerCase();
  const req = await env.DB.prepare("SELECT * FROM oauth_requests WHERE id=? AND expires_at>?").bind(String(d.rid || ""), nowSec()).first();
  if (!req) return errPage("That request expired. Start again from your agent.");
  if (!EMAIL_RE.test(email)) return errPage("That does not look like an email address. Go back and try again.");
  if (!(await turnstileOk(env, d["cf-turnstile-response"], ip))) return errPage("The check did not pass. Go back and try again.");
  if (await limited(env, "mip:" + ip, 20, 3600) || await limited(env, "mem:" + email, 5, 3600)) return errPage("Too many tries. Wait a little and try again.");
  const p = await env.DB.prepare("SELECT * FROM participants WHERE email=? AND status='approved'").bind(email).first();
  if (p) {
    const token = rand();
    await env.DB.prepare("INSERT INTO oauth_email_tokens (hash, request_id, participant_id, expires_at) VALUES (?, ?, ?, ?)").bind(await sha(token), req.id, p.id, nowSec() + LINK_TTL).run();
    const link = `${env.ISSUER}/authorize/confirm?t=${token}`;
    await env.EMAIL.send({
      to: email, from: FROM, subject: "Connect your agent to 30 Products 30 Days",
      text: `Someone asked to connect an agent to your 30 Products 30 Days account.\n\nIf that was you, open this link and choose Allow:\n\n${link}\n\nIt works once and expires in 15 minutes. If it was not you, ignore this email.\n`,
      html: `<p>Someone asked to connect an agent to your 30 Products 30 Days account.</p><p>If that was you, <a href="${link}">open this link and choose Allow</a>. It works once and expires in 15 minutes.</p><p>If it was not you, ignore this email.</p>`,
    });
  }
  return page("Check your email", `<h1>Check your <mark>email</mark></h1><div class="panel"><p>If that address is registered and approved, we have sent a one-time link. Open it to finish connecting. You can close this tab.</p></div>`);   // same answer for every address
}

async function loadLink(env, token) {
  const row = await env.DB.prepare("SELECT * FROM oauth_email_tokens WHERE hash=? AND used=0 AND expires_at>?").bind(await sha(token), nowSec()).first();
  if (!row) return null;
  const req = await env.DB.prepare("SELECT r.*, c.client_name FROM oauth_requests r JOIN oauth_clients c ON c.client_id=r.client_id WHERE r.id=? AND r.expires_at>?").bind(row.request_id, nowSec()).first();
  return req ? { row, req } : null;
}

async function confirmPage(url, env) {
  const token = url.searchParams.get("t") || "";
  const found = token.length >= 20 && token.length <= 100 ? await loadLink(env, token) : null;
  if (!found) return errPage("This link has expired or was already used. Start again from your agent.");
  return page("Allow access", `
<h1>Allow <mark>access</mark>?</h1>
<form class="panel" method="post" action="/authorize/approve">
<input type="hidden" name="t" value="${esc(token)}">
<p><strong>${esc(found.req.client_name)}</strong> will be able to, as you:</p>
<ul><li>read and update your profile</li><li>read, draft and publish your daily products and posts</li><li>upload your product images</li></ul>
<p class="help">It cannot see other registrants' drafts or change anyone else's account. You can disconnect it by removing the connection in your agent.</p>
<button type="submit" class="primary" name="decision" value="allow">Allow</button><button type="submit" class="secondary" name="decision" value="deny">Cancel</button>
</form>`);
}

async function approve(request, env) {
  const d = await readBody(request);
  const token = String((d && d.t) || "");
  const found = token.length >= 20 && token.length <= 100 ? await loadLink(env, token) : null;
  if (!found) return errPage("This link has expired or was already used. Start again from your agent.");
  const used = await env.DB.prepare("UPDATE oauth_email_tokens SET used=1 WHERE hash=? AND used=0").bind(await sha(token)).run();
  if (!used.meta.changes) return errPage("This link was already used. Start again from your agent.");
  const { req, row } = found;
  await env.DB.prepare("DELETE FROM oauth_requests WHERE id=?").bind(req.id).run();
  if (d.decision !== "allow") return Response.redirect(withParams(req.redirect_uri, { error: "access_denied", state: req.state }), 302);
  const code = rand();
  await env.DB.prepare("INSERT INTO oauth_codes (hash, client_id, redirect_uri, participant_id, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(await sha(code), req.client_id, req.redirect_uri, row.participant_id, req.code_challenge, nowSec() + CODE_TTL).run();
  return Response.redirect(withParams(req.redirect_uri, { code, state: req.state }), 302);
}

async function tokenEndpoint(request, env, ip) {
  if (await limited(env, "tok:" + ip, 120, 3600)) return oerr("temporarily_unavailable", "Too many requests", 429);
  const d = await readBody(request);
  if (!d) return oerr("invalid_request", "Bad body");
  const clientId = String(d.client_id || "");
  if (d.grant_type === "authorization_code") {
    const row = await env.DB.prepare("SELECT * FROM oauth_codes WHERE hash=?").bind(await sha(String(d.code || ""))).first();
    if (!row || row.used || row.expires_at < nowSec() || row.client_id !== clientId || row.redirect_uri !== String(d.redirect_uri || "")) return oerr("invalid_grant", "Code is invalid or expired");
    const claimed = await env.DB.prepare("UPDATE oauth_codes SET used=1 WHERE hash=? AND used=0").bind(row.hash).run();
    if (!claimed.meta.changes) return oerr("invalid_grant", "Code already used");
    const verifier = String(d.code_verifier || "");
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier))) !== row.code_challenge) return oerr("invalid_grant", "PKCE check failed");
    const p = await env.DB.prepare("SELECT id FROM participants WHERE id=? AND status='approved'").bind(row.participant_id).first();
    if (!p) return oerr("invalid_grant", "Account not available");
    return json(await issueTokens(env, row.participant_id, clientId));
  }
  if (d.grant_type === "refresh_token") {
    const h = await sha(String(d.refresh_token || ""));
    const row = await env.DB.prepare("SELECT * FROM oauth_tokens WHERE hash=? AND kind='refresh' AND expires_at>?").bind(h, nowSec()).first();
    if (!row || row.client_id !== clientId) return oerr("invalid_grant", "Refresh token is invalid or expired");
    const gone = await env.DB.prepare("DELETE FROM oauth_tokens WHERE hash=?").bind(h).run();   // rotate: each refresh token works once
    if (!gone.meta.changes) return oerr("invalid_grant", "Refresh token already used");
    const p = await env.DB.prepare("SELECT id FROM participants WHERE id=? AND status='approved'").bind(row.participant_id).first();
    if (!p) return oerr("invalid_grant", "Account not available");
    return json(await issueTokens(env, row.participant_id, clientId));
  }
  return oerr("unsupported_grant_type", "Use authorization_code or refresh_token");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (path === "/" && method === "GET") return Response.redirect(`${SITE}/connect/`, 302);
      if (path === "/.well-known/oauth-authorization-server" && method === "GET") return json(metaAS(env));
      if ((path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp") && method === "GET") return json(metaPR(env));
      if (path === "/register" && method === "POST") return await register(request, env, ip);
      if (path === "/authorize" && method === "GET") return await authorize(url, env);
      if (path === "/authorize/email" && method === "POST") return await authorizeEmail(request, env, ip);
      if (path === "/authorize/confirm" && method === "GET") return await confirmPage(url, env);
      if (path === "/authorize/approve" && method === "POST") return await approve(request, env);
      if (path === "/token" && method === "POST") return await tokenEndpoint(request, env, ip);
      if (path === "/mcp") {
        if (method === "GET" || method === "DELETE") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST", ...CORS } });
        if (method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });
        const me = await authBearer(request, env);
        if (!me) return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${env.ISSUER}/.well-known/oauth-protected-resource"` });
        const res = await handleMcp(request, env, me);
        for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
        return res;
      }
      return new Response("Not found", { status: 404 });
    } catch (err) {
      return json({ error: "server_error" }, 500);
    }
  },
};
