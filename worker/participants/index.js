// Participants API: magic-link login for approved registrants, daily product entries, public advent calendars.
// Bindings: DB (D1), IMAGES (R2), EMAIL (Email Service). Secrets: TURNSTILE_SECRET, ADMIN_EMAILS.

const ORIGINS = ["https://30products30days.com", "https://www.30products30days.com"];
const SITE = "https://30products30days.com";
const FROM = "30 Products 30 Days <contact@30products30days.com>";
const START = Date.UTC(2026, 10, 28);            // Day 1 = 28 Nov 2026 (Perth calendar date)
const EDIT_UNTIL = Date.UTC(2027, 0, 4);         // entries stay editable a week after Day 30
const TYPES = ["Digital", "Physical", "Service"];
const SPAM = /\b(seo|backlinks?|guest post|lead generation|first page of google|casino|forex|loan offer|crypto giveaway)\b/i;
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const USER_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const RESERVED = new Set(["admin", "api", "account", "calendar", "community", "blog", "advent", "register", "contact", "support", "help"]);

const enc = new TextEncoder();
const nowSec = () => Math.floor(Date.now() / 1000);
const perthDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(new Date()); // YYYY-MM-DD
const perthMs = () => { const [y, m, d] = perthDate().split("-").map(Number); return Date.UTC(y, m - 1, d); };
const todayDay = () => Math.floor((perthMs() - START) / 864e5) + 1;   // <=0 before start, >30 after

const cors = (o) => ({ "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Vary": "Origin" });
const json = (body, status, o) => new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(o) } });
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const oneLine = (s, max) => clean(s, max).replace(/\s+/g, " ");

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const rand = () => { const a = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

async function limited(env, key, max, windowSec) {
  const t = nowSec();
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM rate WHERE k=? AND ts>?").bind(key, t - windowSec).first();
  if (r.c >= max) return true;
  await env.DB.prepare("INSERT INTO rate (k, ts) VALUES (?, ?)").bind(key, t).run();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate WHERE ts<?").bind(t - 86400).run();
  return false;
}

const adminList = (env) => String(env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (env, p) => adminList(env).includes(p.email);

async function auth(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer (\S{20,100})$/);
  if (!m) return null;
  const row = await env.DB.prepare(
    "SELECT p.* FROM sessions s JOIN participants p ON p.id=s.participant_id WHERE s.hash=? AND s.expires_at>? AND p.status='approved'"
  ).bind(await sha(m[1]), nowSec()).first();
  return row || null;
}

const imgUrl = (k) => (k ? `/api/img/${k}` : null);
const entryOut = (e) => ({ day: e.day, product_name: e.product_name, pitch: e.pitch, product_url: e.product_url, price: e.price, type: e.type, body: e.body, image: imgUrl(e.image_key), status: e.status, hidden: !!e.hidden, updated_at: e.updated_at });
const publicEntry = (e) => ({ day: e.day, product_name: e.product_name, pitch: e.pitch, product_url: e.product_url, price: e.price, type: e.type, body: e.body, image: imgUrl(e.image_key) });
const profileOut = (env, p) => ({ email: p.email, username: p.username, display_name: p.display_name, bio: p.bio, is_admin: isAdmin(env, p) });

function validateEntry(d, publish) {
  const e = {
    product_name: oneLine(d.product_name, 80), pitch: oneLine(d.pitch, 140), product_url: oneLine(d.product_url, 300),
    price: oneLine(d.price, 30), type: TYPES.includes(d.type) ? d.type : "Digital", body: clean(d.body, 8000),
  };
  if (e.product_url && !/^https:\/\/[^\s]+$/.test(e.product_url)) return { error: "Product link must start with https://" };
  if ((e.body.match(/https?:\/\//g) || []).length > 8) return { error: "Too many links in the post" };
  if (SPAM.test(`${e.product_name} ${e.pitch} ${e.body}`)) return { error: "That post looks like spam" };
  if (publish) {
    if (!e.product_name) return { error: "Add the product name" };
    if (!e.pitch) return { error: "Add a one-line pitch" };
    if (!e.product_url) return { error: "Add the product link" };
    if (!e.price) return { error: "Add the price (or Free)" };
    if (e.body.length < 20) return { error: "Write a few lines in the post" };
  }
  return { e };
}

function sniffImage(bytes) {
  if (bytes.length > 12 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return ["png", "image/png"];
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ["jpg", "image/jpeg"];
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return ["webp", "image/webp"];
  return null;
}

async function sendLoginEmail(env, to, token) {
  const link = `${SITE}/account/#t=${token}`;
  const text = `Your sign-in link for 30 Products 30 Days:\n\n${link}\n\nIt works once and expires in 15 minutes. If you did not ask for it, ignore this email.\n`;
  const html = `<p>Your sign-in link for 30 Products 30 Days:</p><p><a href="${link}">Sign in</a></p><p>It works once and expires in 15 minutes. If you did not ask for it, ignore this email.</p>`;
  await env.EMAIL.send({ to, from: FROM, subject: "Your 30 Products 30 Days sign-in link", text, html });
}

async function turnstileOk(env, token, ip) {
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: String(env.TURNSTILE_SECRET ?? "").replace(/\s+/g, ""), response: String(token ?? ""), remoteip: ip || "" }),
  }).then((x) => x.json()).catch(() => ({ success: false }));
  return !!r.success;
}

async function readJson(request) { try { return await request.json(); } catch { return null; } }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const isImg = url.pathname.startsWith("/api/img/");
    if (request.method === "OPTIONS") return ORIGINS.includes(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response("Forbidden", { status: 403 });
    if (isImg && request.method === "GET") return serveImage(env, url.pathname.slice("/api/img/".length));
    if (!ORIGINS.includes(origin)) return new Response("Forbidden", { status: 403 });
    const o = origin;
    const path = url.pathname;
    const ip = request.headers.get("CF-Connecting-IP") || "";

    try {
      // ---------- public ----------
      if (request.method === "GET" && path === "/api/public/participants") {
        const td = todayDay();
        const rows = await env.DB.prepare(
          `SELECT p.username, p.display_name, COUNT(e.id) AS shipped, MAX(e.day) AS latest_day
           FROM participants p LEFT JOIN entries e ON e.participant_id=p.id AND e.status='published' AND e.hidden=0 AND e.day<=?
           WHERE p.status='approved' AND p.username IS NOT NULL GROUP BY p.id ORDER BY shipped DESC, p.display_name`
        ).bind(td).all();
        return json({ today_day: td, participants: rows.results }, 200, o);
      }
      let m = path.match(/^\/api\/public\/u\/([a-z0-9-]{3,24})$/);
      if (request.method === "GET" && m) {
        const td = todayDay();
        const p = await env.DB.prepare("SELECT id, username, display_name, bio FROM participants WHERE username=? AND status='approved'").bind(m[1]).first();
        if (!p) return json({ error: "not_found" }, 404, o);
        const rows = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND status='published' AND hidden=0 AND day<=? ORDER BY day").bind(p.id, td).all();
        return json({ today_day: td, profile: { username: p.username, display_name: p.display_name, bio: p.bio }, entries: rows.results.map(publicEntry) }, 200, o);
      }

      // ---------- login ----------
      if (request.method === "POST" && path === "/api/login") {
        const d = await readJson(request);
        const email = clean(d && d.email, 200).toLowerCase();
        if (!EMAIL_RE.test(email)) return json({ ok: false, error: "invalid" }, 400, o);
        if (!(await turnstileOk(env, d.token, ip))) return json({ ok: false, error: "captcha" }, 400, o);
        if (await limited(env, "ip:" + ip, 20, 3600) || await limited(env, "em:" + email, 5, 3600)) return json({ ok: false, error: "slow_down" }, 429, o);
        let p = await env.DB.prepare("SELECT * FROM participants WHERE email=?").bind(email).first();
        if (!p && adminList(env).includes(email)) {
          await env.DB.prepare("INSERT INTO participants (email, status, created_at) VALUES (?, 'approved', ?)").bind(email, nowSec()).run();
          p = await env.DB.prepare("SELECT * FROM participants WHERE email=?").bind(email).first();
        }
        if (p && p.status === "approved") {
          const token = rand();
          await env.DB.prepare("INSERT INTO login_tokens (hash, participant_id, expires_at) VALUES (?, ?, ?)").bind(await sha(token), p.id, nowSec() + 900).run();
          await sendLoginEmail(env, email, token);
        }
        return json({ ok: true }, 200, o);   // same answer whether or not the address is approved
      }
      if (request.method === "POST" && path === "/api/session") {
        const d = await readJson(request);
        const token = String((d && d.token) || "");
        if (token.length < 20 || token.length > 100) return json({ ok: false }, 400, o);
        const h = await sha(token);
        const row = await env.DB.prepare("SELECT * FROM login_tokens WHERE hash=? AND used=0 AND expires_at>?").bind(h, nowSec()).first();
        if (!row) return json({ ok: false, error: "expired" }, 400, o);
        await env.DB.prepare("UPDATE login_tokens SET used=1 WHERE hash=?").bind(h).run();
        const p = await env.DB.prepare("SELECT * FROM participants WHERE id=? AND status='approved'").bind(row.participant_id).first();
        if (!p) return json({ ok: false }, 400, o);
        const session = rand();
        await env.DB.prepare("INSERT INTO sessions (hash, participant_id, expires_at) VALUES (?, ?, ?)").bind(await sha(session), p.id, nowSec() + 30 * 86400).run();
        return json({ ok: true, session, profile: profileOut(env, p) }, 200, o);
      }

      // ---------- signed in ----------
      const me = await auth(request, env);
      if (!me) return json({ error: "auth" }, 401, o);

      if (request.method === "POST" && path === "/api/logout") {
        const tok = (request.headers.get("Authorization") || "").slice(7);
        await env.DB.prepare("DELETE FROM sessions WHERE hash=?").bind(await sha(tok)).run();
        return json({ ok: true }, 200, o);
      }
      if (request.method === "GET" && path === "/api/me") {
        const rows = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? ORDER BY day").bind(me.id).all();
        return json({ today_day: todayDay(), profile: profileOut(env, me), entries: rows.results.map(entryOut) }, 200, o);
      }
      if (request.method === "PUT" && path === "/api/me") {
        const d = await readJson(request);
        if (!d) return json({ error: "invalid" }, 400, o);
        const username = clean(d.username, 24).toLowerCase();
        const display = oneLine(d.display_name, 60);
        const bio = clean(d.bio, 300);
        if (!USER_RE.test(username) || RESERVED.has(username)) return json({ error: "Username: 3 to 24 letters, numbers or hyphens" }, 400, o);
        if (!display) return json({ error: "Add a display name" }, 400, o);
        const clash = await env.DB.prepare("SELECT id FROM participants WHERE username=? AND id<>?").bind(username, me.id).first();
        if (clash) return json({ error: "That username is taken" }, 409, o);
        await env.DB.prepare("UPDATE participants SET username=?, display_name=?, bio=? WHERE id=?").bind(username, display, bio, me.id).run();
        return json({ ok: true }, 200, o);
      }

      m = path.match(/^\/api\/entry\/(\d{1,2})$/);
      if (request.method === "PUT" && m) {
        const day = Number(m[1]);
        if (day < 1 || day > 30) return json({ error: "invalid_day" }, 400, o);
        if (!me.username) return json({ error: "Set your username first" }, 400, o);
        if (perthMs() > EDIT_UNTIL) return json({ error: "The challenge is closed for edits" }, 403, o);
        const d = await readJson(request);
        if (!d) return json({ error: "invalid" }, 400, o);
        const v = validateEntry(d, !!d.publish);
        if (v.error) return json({ error: v.error }, 400, o);
        if (d.publish && await limited(env, "pub:" + me.id, 40, 3600)) return json({ error: "slow_down" }, 429, o);
        const e = v.e, status = d.publish ? "published" : "draft";
        await env.DB.prepare(
          `INSERT INTO entries (participant_id, day, product_name, pitch, product_url, price, type, body, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (participant_id, day) DO UPDATE SET product_name=excluded.product_name, pitch=excluded.pitch, product_url=excluded.product_url,
             price=excluded.price, type=excluded.type, body=excluded.body, status=excluded.status, updated_at=excluded.updated_at`
        ).bind(me.id, day, e.product_name, e.pitch, e.product_url, e.price, e.type, e.body, status, nowSec()).run();
        const row = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND day=?").bind(me.id, day).first();
        return json({ ok: true, entry: entryOut(row), reveals_today: day <= todayDay() }, 200, o);
      }
      m = path.match(/^\/api\/entry\/(\d{1,2})\/image$/);
      if (request.method === "POST" && m) {
        const day = Number(m[1]);
        const row = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND day=?").bind(me.id, day).first();
        if (!row) return json({ error: "Save the entry first, then add the image" }, 400, o);
        const buf = await request.arrayBuffer();
        if (buf.byteLength > 2 * 1024 * 1024) return json({ error: "Image must be 2 MB or smaller" }, 413, o);
        const bytes = new Uint8Array(buf);
        const kind = sniffImage(bytes);
        if (!kind) return json({ error: "Use a PNG, JPG or WebP image" }, 400, o);
        const key = `${me.id}/${day}-${rand().slice(0, 16)}.${kind[0]}`;
        await env.IMAGES.put(key, buf, { httpMetadata: { contentType: kind[1] } });
        if (row.image_key) await env.IMAGES.delete(row.image_key);
        await env.DB.prepare("UPDATE entries SET image_key=?, updated_at=? WHERE id=?").bind(key, nowSec(), row.id).run();
        return json({ ok: true, image: imgUrl(key) }, 200, o);
      }

      // ---------- admin ----------
      if (path.startsWith("/api/admin/")) {
        if (!isAdmin(env, me)) return json({ error: "forbidden" }, 403, o);
        if (request.method === "GET" && path === "/api/admin/participants") {
          const rows = await env.DB.prepare(
            `SELECT p.id, p.email, p.username, p.display_name, p.status, COUNT(e.id) AS published
             FROM participants p LEFT JOIN entries e ON e.participant_id=p.id AND e.status='published' GROUP BY p.id ORDER BY p.created_at DESC`
          ).all();
          return json({ participants: rows.results }, 200, o);
        }
        if (request.method === "POST" && path === "/api/admin/participants") {
          const d = await readJson(request);
          const list = [...new Set((d && Array.isArray(d.emails) ? d.emails : []).map((s) => clean(s, 200).toLowerCase()).filter((s) => EMAIL_RE.test(s)))].slice(0, 500);
          let added = 0;
          for (const email of list) {
            const r = await env.DB.prepare("INSERT OR IGNORE INTO participants (email, status, created_at) VALUES (?, 'approved', ?)").bind(email, nowSec()).run();
            added += r.meta.changes || 0;
          }
          return json({ ok: true, added, skipped: list.length - added }, 200, o);
        }
        m = path.match(/^\/api\/admin\/participants\/(\d+)$/);
        if (request.method === "PATCH" && m) {
          const d = await readJson(request);
          const status = d && d.status === "suspended" ? "suspended" : "approved";
          await env.DB.prepare("UPDATE participants SET status=? WHERE id=?").bind(status, Number(m[1])).run();
          if (status === "suspended") await env.DB.prepare("DELETE FROM sessions WHERE participant_id=?").bind(Number(m[1])).run();
          return json({ ok: true }, 200, o);
        }
        if (request.method === "GET" && path === "/api/admin/entries") {
          const rows = await env.DB.prepare(
            `SELECT e.id, e.day, e.product_name, e.pitch, e.status, e.hidden, e.updated_at, p.username, p.display_name
             FROM entries e JOIN participants p ON p.id=e.participant_id WHERE e.status='published' ORDER BY e.updated_at DESC LIMIT 100`
          ).all();
          return json({ entries: rows.results }, 200, o);
        }
        m = path.match(/^\/api\/admin\/entries\/(\d+)$/);
        if (request.method === "PATCH" && m) {
          const d = await readJson(request);
          await env.DB.prepare("UPDATE entries SET hidden=? WHERE id=?").bind(d && d.hidden ? 1 : 0, Number(m[1])).run();
          return json({ ok: true }, 200, o);
        }
      }
      return json({ error: "not_found" }, 404, o);
    } catch (err) {
      return json({ error: "server" }, 500, o);
    }
  },
};

async function serveImage(env, key) {
  if (!/^\d+\/\d{1,2}-[A-Za-z0-9_-]{16}\.(png|jpg|webp)$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers: {
    "Content-Type": obj.httpMetadata.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*", "Cross-Origin-Resource-Policy": "cross-origin", "Content-Security-Policy": "default-src 'none'",
  } });
}
