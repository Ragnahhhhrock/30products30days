// MCP tools for registrants' agents. Streamable HTTP, stateless JSON-RPC. Every call is scoped to the signed-in participant.

export const SITE = "https://30products30days.com";
const API_ORIGIN = "https://30p30d-participants.malgordonperth.workers.dev";   // serves /api/img
const START = Date.UTC(2026, 10, 28);            // Day 1 = 28 Nov 2026 (Perth calendar date)
const EDIT_UNTIL = Date.UTC(2027, 0, 4);         // entries stay editable a week after Day 30
const TYPES = ["Digital", "Physical", "Service"];
const SPAM = /\b(seo|backlinks?|guest post|lead generation|first page of google|casino|forex|loan offer|crypto giveaway)\b/i;
const USER_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;
const SOCIAL = {   // profile links: accept a handle or a link, store a clean https link
  x: { hosts: ["x.com", "twitter.com"], base: "https://x.com/", handle: /^[A-Za-z0-9_]{1,15}$/, name: "X" },
  instagram: { hosts: ["instagram.com"], base: "https://www.instagram.com/", handle: /^[A-Za-z0-9_.]{1,30}$/, name: "Instagram" },
  linkedin: { hosts: ["linkedin.com"], base: "https://www.linkedin.com/in/", handle: /^[A-Za-z0-9-]{3,100}$/, name: "LinkedIn" },
};
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
- profile picture: PNG, JPG or WebP up to 2 MB, optional (upload_profile_picture).
- website: https link, optional. x, instagram, linkedin: a handle or a link on that site, optional. Shown as buttons on the public pages.

GOOD POST SHAPE
1. One-sentence opener: what it is and who it is for.
2. Two or three short paragraphs or bullets: what you get, how it works, why you made it today.
3. Price and where to get it.

BEFORE YOU PUBLISH
Show the registrant the preview from get_launch and get their OK before submit_launch. Drafts are private; a submitted launch goes public when its day arrives.`;

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
  body: e.body, image: imgUrl(e.image_key), status: e.status === "published" ? "submitted" : "draft", hidden_by_organiser: !!e.hidden, public_url: e.status === "published" ? pageUrl(me, e.day) : null,
});
const profileOut = (me) => ({ username: me.username, display_name: me.display_name, bio: me.bio, avatar: imgUrl(me.avatar_key), website: me.website || "", x: me.x_url || "", instagram: me.instagram_url || "", linkedin: me.linkedin_url || "", public_url: me.username ? `${SITE}/u/${me.username}/` : null });

// Returns { v } with the cleaned https link ("" when blank), or { error }.
function websiteUrl(raw) {
  const s = oneLine(raw, 300);
  if (!s) return { v: "" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https:\/\//i.test(s)) return { error: "Website must start with https://" };
  let u; try { u = new URL(/^https:\/\//i.test(s) ? s : "https://" + s); } catch { return { error: "That website link doesn't look right" }; }
  if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return { error: "That website link doesn't look right" };
  u.hash = "";
  return { v: u.href.slice(0, 300) };
}
function socialUrl(raw, kind) {
  const c = SOCIAL[kind], s = oneLine(raw, 300);
  if (!s) return { v: "" };
  const h = s.replace(/^@/, "");
  if (c.handle.test(h)) return { v: c.base + h };
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch { return { error: `Add your ${c.name} handle or profile link` }; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: `Add your ${c.name} handle or profile link` };
  if (!c.hosts.some((d) => host === d || host.endsWith("." + d)) || u.pathname.length < 2) return { error: `Use your ${c.name} handle or a link on ${c.hosts[0]}` };
  return { v: `https://${host}${u.pathname.replace(/\/+$/, "")}`.slice(0, 200) };
}

const dayProp = { type: "integer", minimum: 1, maximum: 30, description: "Challenge day, 1 to 30 (Day 1 = 28 Nov 2026)." };
const entryProps = {
  product_name: { type: "string", maxLength: 80, description: "Product name." },
  pitch: { type: "string", maxLength: 140, description: "One-line tagline." },
  product_url: { type: "string", description: "Where people get it. Must start with https://" },
  price: { type: "string", maxLength: 30, description: "For example Free or $9." },
  type: { type: "string", enum: TYPES },
  body: { type: "string", maxLength: 8000, description: "The launch post, plain markdown. Call get_style_guide first." },
};

const TOOLS = [
  { name: "get_style_guide", description: "Read this first. Returns the voice, field limits and post shape every launch and profile must follow.", inputSchema: { type: "object", properties: {} }, annotations: { title: "Get style guide", readOnlyHint: true } },
  { name: "get_challenge_status", description: "Today's challenge day (Perth time) and, for each of the 30 days, whether there is no launch yet, a draft, or a submitted launch.", inputSchema: { type: "object", properties: {} }, annotations: { title: "Challenge status", readOnlyHint: true } },
  { name: "get_profile", description: "Read the registrant's public profile (username, display name, bio, profile picture, website, X, Instagram and LinkedIn links).", inputSchema: { type: "object", properties: {} }, annotations: { title: "Get profile", readOnlyHint: true } },
  {
    name: "update_profile", description: "Complete or change the registrant's profile. Only the fields you pass change. A username and display name are needed before a launch can be started.",
    inputSchema: { type: "object", properties: { username: { type: "string", description: "3 to 24 lowercase letters, numbers or hyphens." }, display_name: { type: "string", maxLength: 60 }, bio: { type: "string", maxLength: 300 }, website: { type: "string", description: "Personal site, https link. Empty string clears it." }, x: { type: "string", description: "X handle or x.com link. Empty string clears it." }, instagram: { type: "string", description: "Instagram handle or instagram.com link. Empty string clears it." }, linkedin: { type: "string", description: "LinkedIn profile link or handle. Empty string clears it." } } },
    annotations: { title: "Update profile", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "upload_profile_picture", description: "Set the registrant's profile picture. PNG, JPG or WebP, up to 2 MB, sent as base64. Replaces any earlier picture.",
    inputSchema: { type: "object", properties: { image_base64: { type: "string", description: "Base64 image data, with or without a data: prefix." } }, required: ["image_base64"] },
    annotations: { title: "Upload profile picture", readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "start_launch", description: "Start a launch for a product: creates a private draft for a day and returns a checklist of what is still needed. Day defaults to the next day without a launch. Pass any fields you already have. Follow it with update_launch, get_launch, then submit_launch.",
    inputSchema: { type: "object", properties: { day: { ...dayProp, description: "Day 1 to 30. Defaults to the next day without a launch." }, ...entryProps } },
    annotations: { title: "Start launch", readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: "update_launch", description: "Change a launch draft. Only the fields you pass change. Returns the updated checklist. Never publishes: use submit_launch for that. Editing a submitted launch updates it live.",
    inputSchema: { type: "object", properties: { day: dayProp, ...entryProps }, required: ["day"] },
    annotations: { title: "Update launch", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  { name: "get_launch", description: "Read one launch in full with its checklist and a preview of how it will appear (title, tagline, post, image, public link, opening date).", inputSchema: { type: "object", properties: { day: dayProp }, required: ["day"] }, annotations: { title: "Get launch and preview", readOnlyHint: true } },
  { name: "list_launches", description: "List all of the registrant's launches with status and what is missing from each.", inputSchema: { type: "object", properties: {} }, annotations: { title: "List launches", readOnlyHint: true } },
  {
    name: "upload_launch_image", description: "Attach a product image to a launch. Give either image_url (an https link to a PNG, JPG or WebP) or image_base64. Up to 2 MB. Replaces any earlier image. Save the launch with start_launch first.",
    inputSchema: { type: "object", properties: { day: dayProp, image_url: { type: "string", description: "https link to the image." }, image_base64: { type: "string", description: "Base64 image data, with or without a data: prefix." } }, required: ["day"] },
    annotations: { title: "Upload launch image", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "submit_launch", description: "Submit a launch so it goes public on the registrant's page when its day opens (immediately if the day has arrived, Perth time). Without confirm=true it only returns the preview and any problems. Show the registrant the preview and get their OK, then call again with confirm=true.",
    inputSchema: { type: "object", properties: { day: dayProp, confirm: { type: "boolean", description: "Set true only after the registrant has approved the preview." } }, required: ["day"] },
    annotations: { title: "Submit launch", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  { name: "withdraw_launch", description: "Take a submitted launch back to a private draft.", inputSchema: { type: "object", properties: { day: dayProp }, required: ["day"] }, annotations: { title: "Withdraw launch", readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
];

const PROMPTS = [{
  name: "launch_my_product", title: "Launch my product", description: "Guided flow: complete the profile if needed, draft a launch, preview it and submit it after the registrant approves.",
  arguments: [{ name: "day", description: "Challenge day 1 to 30 (optional).", required: false }, { name: "idea", description: "What the product is, in a sentence or two (optional).", required: false }],
}];
const promptText = (a) => `Launch a product on 30 Products 30 Days${a.day ? ` for Day ${a.day}` : ""}.${a.idea ? `\nThe product: ${a.idea}` : ""}

Work through this with the registrant:
1. Call get_style_guide and get_profile. If the profile has no username or display name, ask for them and call update_profile.
2. Ask for anything you still need: product name, link (https), price, type, and a product image if they have one. Do not invent details.
3. Call start_launch with what you have, then draft the tagline and post in the house voice and save them with update_launch.
4. Add the image with upload_launch_image if you have one.
5. Call get_launch and show the registrant the preview. Ask whether to submit it or change anything.
6. Only after they approve, call submit_launch with confirm=true. Share the public link and the day it opens.`;

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

async function getEntryRow(env, me, day) { return env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND day=?").bind(me.id, day).first(); }
const parseDay = (a) => { const d = Number(a && a.day); return Number.isInteger(d) && d >= 1 && d <= 30 ? d : null; };

function checklist(me, e) {
  const missing = [], recommended = [];
  if (!me.username) missing.push("Profile: username (update_profile)");
  if (!me.display_name) missing.push("Profile: display name (update_profile)");
  if (!e.product_name) missing.push("product_name");
  if (!e.pitch) missing.push("pitch (one-line tagline)");
  if (!e.product_url) missing.push("product_url (https link)");
  if (!e.price) missing.push("price (or Free)");
  if ((e.body || "").length < 20) missing.push("body (the post, at least 20 characters)");
  else if (e.body.length < 150) recommended.push("body: a few short paragraphs reads better than one line");
  if (!e.image_key) recommended.push("image: a product shot (upload_launch_image)");
  const ready = missing.length === 0;
  const submitted = e.status === "published";
  const next = !ready ? `Provide: ${missing[0]}` : submitted ? "Live or scheduled. Use update_launch to edit, withdraw_launch to make it private." : "Call get_launch, show the registrant the preview, then submit_launch with confirm=true once they approve.";
  return { ready_to_submit: ready, status: submitted ? "submitted" : "draft", missing, recommended, next_step: next };
}

function preview(me, e) {
  const n = String(e.day).padStart(2, "0"), url = pageUrl(me, e.day);
  return {
    title: `Day ${n}: ${e.product_name}`, tagline: e.pitch, price: e.price, type: e.type, product_url: e.product_url, image: imgUrl(e.image_key),
    post_markdown: e.body, opens_on: dayDate(e.day), public_url: url,
    suggested_share_text: `Day ${n}: ${e.product_name}. ${e.pitch} ${e.price}.${url ? " " + url : ""}`.trim(),
  };
}

const launchOut = (me, e, extra = {}) => ({ ...extra, launch: entryOut(me, e), checklist: checklist(me, e), preview: preview(me, e) });

async function writeEntry(env, me, day, merged, status, spamOk) {
  const err = validateEntry(merged, status === "published", spamOk);
  if (err) return fail(err);
  if (!me.username) return fail("Set a username first with update_profile.");
  if (perthMs() > EDIT_UNTIL) return fail("The challenge is closed for edits.");
  if (status === "published" && await limited(env, "pub:" + me.id, 40, 3600)) return fail("Slow down: too many submissions this hour.");
  await env.DB.prepare(
    `INSERT INTO entries (participant_id, day, product_name, pitch, product_url, price, type, body, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participant_id, day) DO UPDATE SET product_name=excluded.product_name, pitch=excluded.pitch, product_url=excluded.product_url,
       price=excluded.price, type=excluded.type, body=excluded.body, status=excluded.status, updated_at=excluded.updated_at`
  ).bind(me.id, day, merged.product_name, merged.pitch, merged.product_url, merged.price, merged.type, merged.body, status, nowSec()).run();
  return null;
}

function mergeFields(a, cur) {
  const pick = (k, max, line) => (a[k] !== undefined ? (line ? oneLine(a[k], max) : clean(a[k], max)) : (cur[k] || ""));
  return {
    product_name: pick("product_name", 80, true), pitch: pick("pitch", 140, true), product_url: pick("product_url", 300, true),
    price: pick("price", 30, true), body: pick("body", 8000, false),
    type: TYPES.includes(a.type) ? a.type : (TYPES.includes(cur.type) ? cur.type : "Digital"),
  };
}

async function fetchImage(url) {
  if (!/^https:\/\/[^\s]+$/.test(url)) throw new Error("image_url must be an https link.");
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "30p30d-mcp/1.0" } });
  if (!r.ok) throw new Error(`Could not fetch the image (HTTP ${r.status}).`);
  const len = Number(r.headers.get("content-length") || 0);
  if (len > 2 * 1024 * 1024) throw new Error("Image must be 2 MB or smaller.");
  const reader = r.body.getReader(), chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("Image must be 2 MB or smaller."); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function callTool(name, a, env, me, spamOk) {
  a = a && typeof a === "object" ? a : {};
  switch (name) {
    case "get_style_guide": return ok(STYLE_GUIDE);
    case "get_challenge_status": {
      const rows = await env.DB.prepare("SELECT day, status FROM entries WHERE participant_id=?").bind(me.id).all();
      const by = Object.fromEntries(rows.results.map((r) => [r.day, r]));
      const days = Array.from({ length: 30 }, (_, i) => { const d = i + 1, r = by[d]; return { day: d, date: dayDate(d), state: r ? (r.status === "published" ? "submitted" : "draft") : "none" }; });
      return ok({ today_day: todayDay(), edits_close: "2027-01-04", profile_complete: !!(me.username && me.display_name), days });
    }
    case "get_profile": return ok(profileOut(me));
    case "update_profile": {
      const username = a.username !== undefined ? clean(a.username, 24).toLowerCase() : me.username;
      const display = a.display_name !== undefined ? oneLine(a.display_name, 60) : me.display_name;
      const bio = a.bio !== undefined ? clean(a.bio, 300) : me.bio;
      const web = a.website !== undefined ? websiteUrl(a.website) : { v: me.website || "" };
      if (web.error) return fail(web.error + ".");
      const soc = {};
      for (const k of Object.keys(SOCIAL)) { soc[k] = a[k] !== undefined ? socialUrl(a[k], k) : { v: me[k + "_url"] || "" }; if (soc[k].error) return fail(soc[k].error + "."); }
      if (!username || !USER_RE.test(username) || RESERVED.has(username)) return fail("Username must be 3 to 24 lowercase letters, numbers or hyphens, and not a reserved word.");
      if (!display) return fail("Add a display name.");
      const clash = await env.DB.prepare("SELECT id FROM participants WHERE username=? AND id<>?").bind(username, me.id).first();
      if (clash) return fail("That username is taken. Try another.");
      await env.DB.prepare("UPDATE participants SET username=?, display_name=?, bio=?, website=?, x_url=?, instagram_url=?, linkedin_url=? WHERE id=?").bind(username, display, bio || "", web.v, soc.x.v, soc.instagram.v, soc.linkedin.v, me.id).run();
      return ok({ next_step: "Call start_launch to begin a product launch.", result: "Profile saved.", profile: profileOut({ ...me, username, display_name: display, bio, website: web.v, x_url: soc.x.v, instagram_url: soc.instagram.v, linkedin_url: soc.linkedin.v }) });
    }
    case "upload_profile_picture": {
      const b64 = String(a.image_base64 || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
      if (!b64 || b64.length > 2_900_000) return fail("Image must be 2 MB or smaller.");
      let bytes;
      try { const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/")); bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); } catch { return fail("image_base64 is not valid base64."); }
      if (bytes.length > 2 * 1024 * 1024) return fail("Image must be 2 MB or smaller.");
      const kind = sniffImage(bytes);
      if (!kind) return fail("Use a PNG, JPG or WebP image.");
      const key = `${me.id}/avatar-${rand().slice(0, 16)}.${kind[0]}`;
      await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind[1] } });
      if (me.avatar_key) await env.IMAGES.delete(me.avatar_key);
      await env.DB.prepare("UPDATE participants SET avatar_key=? WHERE id=?").bind(key, me.id).run();
      return ok({ result: "Profile picture saved.", avatar: imgUrl(key) });
    }
    case "start_launch": {
      if (!me.username || !me.display_name) return fail("Complete the profile first: update_profile with a username and display name, then call start_launch again.");
      let day = a.day !== undefined ? parseDay(a) : null;
      if (a.day !== undefined && !day) return fail("day must be 1 to 30.");
      if (!day) {
        const rows = await env.DB.prepare("SELECT day FROM entries WHERE participant_id=?").bind(me.id).all();
        const used = new Set(rows.results.map((r) => r.day));
        for (let d = Math.min(Math.max(todayDay(), 1), 30); d <= 30 && !day; d++) if (!used.has(d)) day = d;
        if (!day) for (let d = 1; d <= 30 && !day; d++) if (!used.has(d)) day = d;
        if (!day) return fail("All 30 days already have a launch. Use update_launch to change one.");
      }
      const cur = await getEntryRow(env, me, day);
      if (cur && cur.status === "published") return fail(`Day ${day} is already submitted. Use update_launch to edit it.`);
      const merged = mergeFields(a, cur || {});
      const err = await writeEntry(env, me, day, merged, "draft", spamOk);
      if (err) return err;
      const row = await getEntryRow(env, me, day);
      return ok(launchOut(me, row, { result: cur ? `Day ${day} draft updated.` : `Started the Day ${day} launch as a private draft.` }));
    }
    case "update_launch": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const cur = await getEntryRow(env, me, day);
      if (!cur) return fail(`No launch for Day ${day} yet. Call start_launch first.`);
      const err = await writeEntry(env, me, day, mergeFields(a, cur), cur.status, spamOk);
      if (err) return err;
      return ok(launchOut(me, await getEntryRow(env, me, day), { result: cur.status === "published" ? "Saved. The live post is updated." : "Draft saved." }));
    }
    case "get_launch": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const row = await getEntryRow(env, me, day);
      return row ? ok(launchOut(me, row)) : fail(`No launch for Day ${day} yet. Call start_launch.`);
    }
    case "list_launches": {
      const rows = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? ORDER BY day").bind(me.id).all();
      return ok({ today_day: todayDay(), launches: rows.results.map((e) => ({ day: e.day, opens_on: dayDate(e.day), product_name: e.product_name, status: e.status === "published" ? "submitted" : "draft", missing: checklist(me, e).missing, public_url: e.status === "published" ? pageUrl(me, e.day) : null })) });
    }
    case "upload_launch_image": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const row = await getEntryRow(env, me, day);
      if (!row) return fail("Call start_launch first, then add the image.");
      let bytes;
      if (a.image_url) {
        if (await limited(env, "imgfetch:" + me.id, 30, 3600)) return fail("Slow down: too many image fetches this hour.");
        try { bytes = await fetchImage(String(a.image_url)); } catch (e) { return fail(e.message || "Could not fetch the image."); }
      } else {
        const b64 = String(a.image_base64 || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
        if (!b64) return fail("Give image_url or image_base64.");
        if (b64.length > 2_900_000) return fail("Image must be 2 MB or smaller.");
        try { const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/")); bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); } catch { return fail("image_base64 is not valid base64."); }
      }
      if (bytes.length > 2 * 1024 * 1024) return fail("Image must be 2 MB or smaller.");
      const kind = sniffImage(bytes);
      if (!kind) return fail("Use a PNG, JPG or WebP image.");
      const key = `${me.id}/${day}-${rand().slice(0, 16)}.${kind[0]}`;
      await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind[1] } });
      if (row.image_key) await env.IMAGES.delete(row.image_key);
      await env.DB.prepare("UPDATE entries SET image_key=?, updated_at=? WHERE id=?").bind(key, nowSec(), row.id).run();
      return ok(launchOut(me, await getEntryRow(env, me, day), { result: "Image saved." }));
    }
    case "submit_launch": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const cur = await getEntryRow(env, me, day);
      if (!cur) return fail(`No launch for Day ${day} yet. Call start_launch.`);
      const merged = { product_name: cur.product_name, pitch: cur.pitch, product_url: cur.product_url, price: cur.price, body: cur.body, type: cur.type };
      const problem = validateEntry(merged, true, spamOk) || (me.username ? null : "Set a username first with update_profile.");
      if (problem) return ok(launchOut(me, cur, { result: `Not ready to submit: ${problem}` }));
      if (cur.status === "published") return ok(launchOut(me, cur, { result: "Already submitted." }));
      if (a.confirm !== true) return ok(launchOut(me, cur, { result: "Ready. Show the registrant this preview, and if they approve call submit_launch again with confirm=true." }));
      const err = await writeEntry(env, me, day, merged, "published", spamOk);
      if (err) return err;
      const row = await getEntryRow(env, me, day);
      return ok(launchOut(me, row, { result: day <= todayDay() ? "Submitted and live now." : `Submitted. It goes public when Day ${day} opens on ${dayDate(day)} (Perth time).` }));
    }
    case "withdraw_launch": {
      const day = parseDay(a); if (!day) return fail("day must be 1 to 30.");
      const cur = await getEntryRow(env, me, day);
      if (!cur) return fail(`No launch for Day ${day}.`);
      const err = await writeEntry(env, me, day, { product_name: cur.product_name, pitch: cur.pitch, product_url: cur.product_url, price: cur.price, body: cur.body, type: cur.type }, "draft", spamOk);
      if (err) return err;
      return ok(launchOut(me, await getEntryRow(env, me, day), { result: "Withdrawn. It is a private draft again." }));
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
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "30-products-30-days", title: "30 Products 30 Days", version: "1.0.0" },
        instructions: "Helps a registrant complete their profile and launch their daily product. Use the launch_my_product prompt or: get_style_guide, start_launch, update_launch, get_launch (preview), then submit_launch with confirm=true only after the registrant approves. Keep every call to their own account.",
      } };
    }
    case "ping": return { jsonrpc: "2.0", id, result: {} };
    case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "prompts/list": return { jsonrpc: "2.0", id, result: { prompts: PROMPTS } };
    case "prompts/get": {
      const p = msg.params || {};
      if (p.name !== "launch_my_product") return rpcErr(id, -32602, "Unknown prompt");
      const args = p.arguments && typeof p.arguments === "object" ? p.arguments : {};
      const day = Number(args.day);
      return { jsonrpc: "2.0", id, result: { description: PROMPTS[0].description, messages: [{ role: "user", content: { type: "text", text: promptText({ day: Number.isInteger(day) && day >= 1 && day <= 30 ? day : "", idea: oneLine(args.idea, 500) }) } }] } };
    }
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
