// Contact form Worker: Turnstile check -> spam filter -> email via Email Routing send_email binding.
// Secrets (wrangler secret put): TURNSTILE_SECRET, TO_EMAIL (a verified Email Routing destination).
import { EmailMessage } from "cloudflare:email";

const ORIGINS = ["https://30products30days.com", "https://www.30products30days.com"];
const FROM = "contact-form@30products30days.com";
const SPAM = /\b(seo|backlinks?|guest post|lead generation|web ?design|website (design|redesign)|first page of google|google (ranking|rankings|visibility)|charity foundation|immediate release|funds? (has|have) been approved|casino|crypto|forex|loan offer|appointment booking)\b/i;
const TOPICS = { general: "General", sponsors: "Sponsors" };

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});
const json = (body, status, origin) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });

const clean = (s, max) => String(s ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const wrap76 = (s) => s.replace(/(.{76})/g, "$1\r\n");

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!ORIGINS.includes(origin)) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let d;
    try { d = await request.json(); } catch { return json({ ok: false }, 400, origin); }

    const name = clean(d.name, 100);
    const email = clean(d.email, 200);
    const topic = TOPICS[d.topic] ? d.topic : "general";
    const message = String(d.message ?? "").trim().slice(0, 4000);
    if (d._gotcha) return json({ ok: true }, 200, origin); // honeypot: pretend success
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 10)
      return json({ ok: false, error: "invalid" }, 400, origin);

    // Turnstile
    const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: String(d.token ?? ""),
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!ts.success) return json({ ok: false, error: "captcha" }, 400, origin);

    // Cold-outreach filter: silently drop, do not tip off the sender
    if (SPAM.test(`${name} ${message}`) || (message.match(/https?:\/\//g) || []).length > 2)
      return json({ ok: true }, 200, origin);

    const subject = `[30p30d ${TOPICS[topic]}] ${name}`;
    const body = `From: ${name} <${email}>\nTopic: ${TOPICS[topic]}\n\n${message}\n`;
    const raw = [
      `From: 30products30days form <${FROM}>`,
      `To: ${env.TO_EMAIL}`,
      `Reply-To: ${email}`,
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@30products30days.com>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(b64(body)),
    ].join("\r\n");

    try {
      await env.MAIL.send(new EmailMessage(FROM, env.TO_EMAIL, raw));
    } catch {
      return json({ ok: false, error: "send" }, 502, origin);
    }
    return json({ ok: true }, 200, origin);
  },
};
