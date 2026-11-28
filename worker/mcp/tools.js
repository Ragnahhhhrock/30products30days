// MCP tools for registrants' agents. Streamable HTTP, stateless JSON-RPC. Every call is scoped to the signed-in participant.

export const SITE = "https://30products30days.com";
const API_ORIGIN = "https://30p30d-participants.malgordonperth.workers.dev";   // serves /api/img
const START = Date.UTC(2026, 10, 28);            // Day 1 = 28 Nov 2026 (Perth calendar date)
const EDIT_UNTIL = Date.UTC(2027, 0, 4);         // entries stay editable a week after Day 30
const TYPES = ["Digital", "Physical", "Service"];
const SPAM = /\b(seo|backlinks?|guest post|lead generation|first page of google|casino|forex|loan offer|crypto giveaway)\b/i;
const USER_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const RESERVED = new Set(["admin", "api", "account", "calendar", "community", "blog", "advent", "register", "contact", "support", "help", "connect", "mcp"]);
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const nowSec = () => Math.floor(Date.now() / 1000);
const perthDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(new Date());
const perthMs = () => { const [y, m, d] = perthDate().split("-").map(Number); return Date.UTC(y, m - 1, d); };
const todayDay = () => Math.floor((perthMs() - START) / 864e5) + 1;
const dayDate = (day) => new Date(START + (day - 1) * 864e5).toISOString().slice(0, 10);
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const oneLine = (s, max) => clean(s, max).replace(/\s+/g, " ");
const rand = () => { const a = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

export async function limited(env, key, max, windowSec) {
  const t = nowSec();
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM rate WHERE k=? AND ts>?").bind(key, t - windowSec).first();
  if (r.c >= max) return true;
  await env.DB.prepare("INSERT INTO rate (k, ts) VALUES (?, ?)").bind(key, t).run();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate WHERE ts<?").bind(t - 86400).run();
  return false;
}

const STYLE_GUIDE = `30 PRODUCTS 30 DAYS: STYLE GUIDE FOR POSTS AND PROFILES
The challenge: one product made and shipped every day for 30 days (Day 1 = 28 Nov 2026, Perth time). Products can be digital, physical or a service. Each day has one entry: the product details plus a short post. Posts are public on the registrant's page at ${SITE}/u/<username>/ and appear in their advent calendar. A day's post stays hidden until that day's date has arrived (Perth time), so publishing ahead is fine.

VOICE
- Upbeat and short. Say what the product is, who it is for and what it costs.
- Sentence case everywhere. One exclamation mark per post at most.
- Plain, concrete claims. Avoid hype words and vague claims.
- Do not write "built with Claude" (or similar) in the post unless the registrant asks for it.
- Examples of the house tone: "Made today, live tonight." "Day 07: Product name here." "Grab it."

FIELDS AND LIMITS
- product_name: up to 80 characters. Required to publish.
- pitch: one line, up to 140 characters. Required to publish.
- product_url: must start with https://. Required to publish.
- price: up to 30 characters, for example "Free" or "$9". Required to publish.
- type: Digital, Physical or Service.
- body: plain markdown, 20 to 8000 characters, at most 8 links, links must be https. It is escaped on render, so do not use raw HTML.
- image: PNG, JPG or WebP up to 2 MB (a product shot works best, no stock photos).
- Posts that read like SEO, backlink, casino, forex or lead-generation spam are rejected.

PROFILE
- username: 3 to 24 lowercase letters, numbers or hyphens. It becomes the public address ${SITE}/u/<username>/.
- display_name: up to 60 characters. bio: up to 300 characters, optional.

GOOD POST SHAPE
1. One-sentence opener: what it is and who it is for.
2. Two or three short paragraphs or bullets: what you get, how it works, why you made it today.
3. Price and where to get it.

BEFORE YOU PUBLISH
Show the registrant the draft and get their OK. Saving a draft is always safe; publishing makes it public once its day arrives.`;

function validateEntry(e, publish, skipSpam) {
  if (e.product_url && !/^https:\/\/[^\s]+$/.test(e.product_url)) return "Product link must start with https://";
  if ((e.body.match(/https?:\/\//g) || []).length > 8) return "Too many links in the post (max 8)";
  if (!skipSpam && SPAM.test(`${e.product_name} ${e.pitch} ${e.body}`)) return "That post looks like spam";
  if (publish) {
    if (!e.product_name) return "Add the product name";
    if (!e.pitch) return "Add a one-line pitch";
    if (!e.product_url) return "Add the product link";
    if (!e.price) return "Add the price (or Free)";
    if (e.body.length < 20) return "Write a few lines in the post";
  }
  return null;
}

function sniffImage(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["png", "image/png"];
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["jpg", "image/jpeg"];
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return ["webp", "image/webp"];
  return null;
}

const imgUrl = (k) => (k ? `${API_ORIGIN}/api/img/${k}` : null);
const pageUrl = (me, day) => (me.username ? `${SITE}/u/${me.username}/day-${String(day).padStart(2, "0")}/` : null);
const entryOut = (me, e) => ({
  day: e.day, opens_on: dayDate(e.day), product_name: e.product_name, pitch: e.pitch, product_url: e.product_url, price: e.price, type: e.type,
  body: e.body, image: imgUrl(e.image_key), status: e.status, hidden_by_organiser: !!e.hidden, public_url: e.status === "published" ? pageUrl(me, e.day) : null,
});
const profileOut = (me) => ({ username: me.username, display_name: me.display_name, bio: me.bio, public_url: me.username ? `${SITE}/u/${me.username}/` : null });

const dayProp = { type: "integer", minimum: 1, maximum: 30, description: "Challenge day, 1 to 30 (Day 1 = 28 Nov 2026)." };
const entryProps = {
  product_name: { type: "string", maxLength: 80 },
  pitch: { type: "string", maxLength: 140, description: "One-line pitch." },
  product_url: { type: "string", description: "Link to the product. Must start with https://" },
  price: { type: "string", maxLength: 30, description: "For example Free or $9." },
  type: { type: "string", enum: TYPES },
  body: { type: "string", maxLength: 8000, description: "The post, in plain markdown. Call get_style_guide first." },
};

const TOOLS = [
  { name: "get_style_guide", description: "Read this first. Returns the voice, field limits and post shape every post and profile must follow.", inputSchema: { type: "object", properties: {} }, annotations: { title: "Get style guide", readOnlyHint: true } },
  { name: "get_challenge_status", description: "Today's challenge day (Perth time) and, for each of the 30 days, whether the registrant has no entry, a draft or a published post.", inputSchema: { type: "object", properties: {} }, annotations: { title: "Challenge status", readOnlyHint: true } },
  { name: "get_profile", description: "Read the registrant's public profile (username, display name, bio).", inputSchema: { type: "object", properties: {} }, annotations: { title: "Get profile", readOnlyHint: true } },
  {
    name: "update_profile", description: "Complete or change the registrant's profile. Only the fields you pass change. A username is needed before any entry can be saved.",
    inputSchema: { type: "object", properties: { username: { type: "string", description: "3 to 24 lowercase letters, numbers or hyphens." }, display_name: { type: "string", maxLength: 60 }, bio: { type: "string", maxLength: 300 } } },
    annotations: { title: "Update profile", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  { name: "list_entries", description: "List the registrant's entries (all days they have started), with status.", inputSchema: { type: "object", properties: {} }, annotations: { title: "List entries", readOnlyHint: true } },
  { name: "get_entry", description: "Read one day's entry in full.", inputSchema: { type: "object", properties: { day: dayProp }, required: ["day"] }, annotations: { title: "Get entry", readOnlyHint: true } },
  {
    name: "save_entry",
    description: "Create or update one day's product and post. Only the fields you pass change. By default it saves a draft (private). Set publish=true to publish: the post then goes public when that day's date arrives (Perth time). Show the registrant the draft and get their OK before publishing. Call get_style_guide first.",
    inputSchema: { type: "object", properties: { day: dayProp, ...entryProps, publish: { type: "boolean", description: "Publish now. Needs name, pitch, link, price and a post of at least 20 characters." } }, required: ["day"] },
    annotations: { title: "Save or publish entry", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  { name: "publish_entry", description: "Publish an existing draft. Confirm with the registrant first.", inputSchema: { type: "object", properties: { day: dayProp }, required: ["day"] }, annotations: { title: "Publish entry", readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  { name: "unpublish_entry", description: "Turn a published entry back into a private draft.", inputSchema: { type: "object", properties: { day: dayProp }, required: ["day"] }, annotations: { title: "Unpublish entry", readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  {
    name: "upload_entry_image", description: "Attach a product image to a day's entry (save the entry first). PNG, JPG or WebP, up to 2 MB, sent as base64. Replaces any earlier image.",
    inputSchema: { type: "object", properties: { day: dayProp, image_base64: { type: "string", description: "Base64 image data, with or without a data: prefix." } }, required: ["day", "image_base64"] },
    annotations: { title: "Upload entry image", readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
];

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

async function getEntryRow(env, me, day) { return env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND day=?").bind(me.id, day).first(); }
const parseDay = (a) => { const d = Number(a && a.day); return Number.isInteger(d) && d >= 1 && d <= 30 ? d : null; };

async function writeEntry(env, me, day, merged, status, spamOk) {
  const err = validateEntry(merged, status === "published", spamOk);
  if (err) return fail(err);
  if (!me.username) return fail("Set a username first with update_profile.");
  if (perthMs() > EDIT_UNTIL) return fail("The challenge is closed for edits.");
  if (status === "published" && await limited(env, "pub:" + me.id, 40, 3600)) return fail("Slow down: too many publishes this hour.");
  await env.DB.prepare(
    `INSERT INTO entries (participant_id, day, product_name, pitch, product_url, price, type, body, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participant_id, day) DO UPDATE SET product_name=excluded.product_name, pitch=excluded.pitch, product_url=excluded.product_url,
       price=excluded.price, type=excluded.type, body=excluded.body, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(me.id, day, merged.product_name, merged.pitch, merged.product_url, merged.price, merged.type, merged.body, status, nowSec()).run();
  const row = await getEntryRow(env, me, day);
  const note = status === "published"
    ? (day <= todayDay() ? "Published and live now." : `Published. It stays hidden until Day ${day} opens on ${dayDate(day)} (Perth time).`)
    : "Saved as a private draft.";
  return ok({ result: note, entry: entryOut(me, row) });
}

async function callTool(name, a, env, me, spamOk) {
  a = a && typeof a === "object" ? a : {};
  switch (name) {
    case "get_style_guide": return ok(STYLE_GUIDE);
    case "get_challenge_status": {
      const rows = await env.DB.prepare("SELECT day, status, hidden FROM entries WHERE participant_id=?").bind(me.id).all();
      const by = Object.fromEntries(rows.results.map((r) => [r.day, r]));
      const days = Array.from({ length: 30 }, (_, i) => { const d = i + 1, r = by[d]; return { day: d, date: dayDate(d), state: r ? (r.status === "published" ? "published" : "draft") : "none" }; });
      return ok({ today_day: todayDay(), edits_close: "2027-01-04", profile_complete: !!(me.username && me.display_name), days });
    }
    case "get_profile": return ok(profileOut(me));
    case "update_profile": {
      const username = a.username !== undefined ? clean(a.username, 24).toLowerCase() : me.username;
      const display = a.display_name !== undefined ? oneLine(a.display_name, 60) : me.display_name;
      const bio = a.bio !== undefined ? clean(a.bio, 300) : me.bio;
      if (!username || !USER_RE.test(username) || RESERVED.has(username)) return fail("Username must be 3 to 24 lowercase letters, numbers or hyphens, and not a reserved word.");
      if (!display) return fail("Add a display name.");
      const clash = await env.DB.prepare("SELECT id FROM participants WHERE username=? AND id<>?").bind(username, me.id).first();
      if (clash) return fail("That username is taken. Try another.");
      await env.DB.prepare("UPDATE participants SET username=?, display_name=?, bio=? WHERE id=?").bind(username, display, bio || "", me.id).run();
      return ok({ result: "Profile saved.", profile: profileOut({ ...me, username, display_name: display, bio }) });
    }
    case "list_entries": {
      const rows = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? ORDER BY day").bind(me.id).all();
      return ok({ today_day: todayDay(), entries: rows.results.map((e) => entryOut(me, e)) });
    }
    case "get_entry": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const row = await getEntryRow(env, me, day);
      return row ? ok(entryOut(me, row)) : fail(`No entry for Day ${day} yet. Use save_entry to create one.`);
    }
    case "save_entry": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const cur = (await getEntryRow(env, me, day)) || {};
      const pick = (k, max, line) => (a[k] !== undefined ? (line ? oneLine(a[k], max) : clean(a[k], max)) : (cur[k] || ""));
      const merged = {
        product_name: pick("product_name", 80, true), pitch: pick("pitch", 140, true), product_url: pick("product_url", 300, true),
        price: pick("price", 30, true), body: pick("body", 8000, false),
        type: TYPES.includes(a.type) ? a.type : (TYPES.includes(cur.type) ? cur.type : "Digital"),
      };
      const status = a.publish === true ? "published" : (a.publish === false ? "draft" : (cur.status || "draft"));
      return writeEntry(env, me, day, merged, status, spamOk);
    }
    case "publish_entry": case "unpublish_entry": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const cur = await getEntryRow(env, me, day);
      if (!cur) return fail(`No entry for Day ${day} yet.`);
      return writeEntry(env, me, day, { product_name: cur.product_name, pitch: cur.pitch, product_url: cur.product_url, price: cur.price, body: cur.body, type: cur.type }, name === "publish_entry" ? "published" : "draft", spamOk);
    }
    case "upload_entry_image": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const row = await getEntryRow(env, me, day);
      if (!row) return fail("Save the entry first, then add the image.");
      let b64 = String(a.image_base64 || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
      if (!b64 || b64.length > 2_900_000) return fail("Image must be 2 MB or smaller.");
      let bytes;
      try { const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/")); bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); } catch { return fail("image_base64 is not valid base64."); }
      if (bytes.length > 2 * 1024 * 1024) return fail("Image must be 2 MB or smaller.");
      const kind = sniffImage(bytes);
      if (!kind) return fail("Use a PNG, JPG or WebP image.");
      const key = `${me.id}/${day}-${rand().slice(0, 16)}.${kind[0]}`;
      await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind[1] } });
      if (row.image_key) await env.IMAGES.delete(row.image_key);
      await env.DB.prepare("UPDATE entries SET image_key=?, updated_at=? WHERE id=?").bind(key, nowSec(), row.id).run();
      return ok({ result: "Image saved.", image: imgUrl(key) });
    }
    default: return null;
  }
}

const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handleOne(msg, env, me) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcErr(msg && msg.id, -32600, "Invalid request");
  const isNote = msg.id === undefined || msg.id === null;
  const id = msg.id;
  switch (msg.method) {
    case "initialize": {
      const want = msg.params && msg.params.protocolVersion;
      return { jsonrpc: "2.0", id, result: {
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "30-products-30-days", title: "30 Products 30 Days", version: "1.0.0" },
        instructions: "Helps a registrant complete their profile and submit their daily product and post. Call get_style_guide first, show the registrant any draft before publishing, and keep every call to their own account.",
      } };
    }
    case "ping": return { jsonrpc: "2.0", id, result: {} };
    case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call": {
      const p = msg.params || {};
      if (!TOOLS.some((t) => t.name === p.name)) return rpcErr(id, -32602, "Unknown tool");
      if (await limited(env, "mcp:" + me.id, 200, 3600)) return { jsonrpc: "2.0", id, result: fail("Slow down: too many calls this hour. Try again later.") };
      const spamOk = String(env.SPAM_EXEMPT_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).includes(me.email);
      try { return { jsonrpc: "2.0", id, result: await callTool(p.name, p.arguments, env, me, spamOk) }; }
      catch { return { jsonrpc: "2.0", id, result: fail("Server error. Try again.") }; }
    }
    default:
      return isNote ? null : rpcErr(id, -32601, "Method not found");
  }
}

export async function handleMcp(request, env, me) {
  const H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify(rpcErr(null, -32700, "Parse error")), { status: 400, headers: H }); }
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return new Response(JSON.stringify(rpcErr(null, -32600, "Invalid batch")), { status: 400, headers: H });
    const out = (await Promise.all(body.map((m) => handleOne(m, env, me)))).filter(Boolean);
    return out.length ? new Response(JSON.stringify(out), { headers: H }) : new Response(null, { status: 202 });
  }
  const res = await handleOne(body, env, me);
  return res ? new Response(JSON.stringify(res), { headers: H }) : new Response(null, { status: 202 });
}
