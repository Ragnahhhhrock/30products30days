// Server-rendered public pages for each participant, so search engines can index them.
//   /u/<username>/             blog: every post that has opened
//   /u/<username>/advent/      advent calendar
//   /u/<username>/day-NN/      one post
//   /sitemap-participants.xml  every public page above
// Only published, visible entries whose date has arrived are ever rendered (same rule as the JSON API).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => (n < 10 ? "0" : "") + n;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ld = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

function inline(s) {
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener nofollow ugc">$1</a>');
}
function md(body) {
  const out = []; let para = [], items = [];
  const flush = () => {
    if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
    if (items.length) { out.push("<ul>" + items.map((i) => "<li>" + inline(i) + "</li>").join("") + "</ul>"); items = []; }
  };
  String(body || "").split(/\r?\n/).forEach((line) => {
    if (!line.trim()) flush();
    else if (line.startsWith("## ")) { flush(); out.push("<h2>" + inline(line.slice(3)) + "</h2>"); }
    else if (line.startsWith("- ")) { if (para.length) flush(); items.push(line.slice(2)); }
    else { if (items.length) flush(); para.push(line.trim()); }
  });
  flush();
  return out.join("\n");
}

function badge(n, size) {
  const t = pad(n);
  return `<svg class="l30-badge" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Day ${t}">` +
    '<circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/>' +
    `<text x="48" y="68" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">${t}</text>` +
    '<path d="M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>';
}

const NAV = [["/", "Home"], ["/blog/", "Blog"], ["/advent/", "Advent calendar"], ["/community/", "Community"], ["/account/", "My account"], ["/register.html", "Join"]];
const navHtml = (cur) =>
  '<header class="site-nav"><div class="site-nav__in"><a class="site-nav__brand" href="/"><img src="/brand/logos/launch-badge.svg" alt="" width="36" height="36"><span>30 Products 30 Days</span></a><nav aria-label="Main"><ul class="site-nav__list">' +
  NAV.map((i) => `<li><a class="site-nav__link" href="${i[0]}"${i[0] === cur ? ' aria-current="page"' : ""}>${i[1]}</a></li>`).join("") +
  "</ul></nav></div></header>";

function shell(c, o) {
  const robots = o.noindex ? "noindex, follow" : "index, follow, max-image-preview:large";
  const url = c.site + o.path;
  const image = o.image || c.site + "/social/og-image.png";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FM1RLPT7RK"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','G-FM1RLPT7RK');
</script>
<script src="/analytics.js" defer></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#FFD21F">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="30 Products in 30 Days">
<meta property="og:title" content="${esc(o.ogTitle || o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:type" content="${o.ogType || "website"}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:locale" content="en_AU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@30days30prods">
<meta name="twitter:title" content="${esc(o.ogTitle || o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="stylesheet" href="/design-system/components/bundle.css">
<link rel="stylesheet" href="/site-nav.css">
<link rel="stylesheet" href="/participants/p.css">
${o.ld ? `<script type="application/ld+json">${ld(o.ld)}</script>` : ""}
</head>
<body>
${navHtml(o.nav || "/community/")}
${o.body}
<footer><div class="wrap"><img src="/brand/logos/launch-badge.svg" alt="" width="32" height="32"><span>&copy; 2026 30products30days.com</span><a href="/">Home</a><a href="/community/">Community</a><a href="/blog/">Blog</a><a href="/advent/">Advent calendar</a></div></footer>
<script src="/participants/p.js"></script>
${o.script ? `<script>${o.script}</script>` : ""}
</body>
</html>`;
}

// Social share buttons: plain links (no third-party scripts), plus copy-link and native share when the browser supports them.
function shareBar(url, text, heading) {
  const u = encodeURIComponent(url), t = encodeURIComponent(text), both = encodeURIComponent(text + " " + url);
  const links = [
    ["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["Reddit", `https://www.reddit.com/submit?url=${u}&title=${t}`],
    ["WhatsApp", `https://wa.me/?text=${both}`],
    ["Email", `mailto:?subject=${t}&body=${both}`],
  ];
  return `<section class="share" aria-labelledby="shareH" data-share-url="${esc(url)}" data-share-text="${esc(text)}"><h2 class="share__title" id="shareH">${esc(heading || "Share this")}</h2><ul class="share__list">` +
    '<li><button type="button" class="l30-btn l30-btn--secondary" data-native-share hidden>Share</button></li>' +
    links.map((l) => `<li><a class="l30-btn l30-btn--secondary" href="${esc(l[1])}"${l[0] === "Email" ? "" : ' target="_blank" rel="noopener noreferrer"'} aria-label="Share on ${l[0]}${l[0] === "Email" ? "" : " (opens in a new tab)"}">${l[0]}</a></li>`).join("") +
    `<li><button type="button" class="l30-btn l30-btn--secondary" data-copy-link hidden>Copy link</button></li></ul><p class="share__msg" role="status" aria-live="polite"></p></section>`;
}

const dayDate = (c, n) => { const d = new Date(c.start + (n - 1) * 864e5); return { iso: d.toISOString().slice(0, 10), label: d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] }; };
const progress = (n) => `<div class="l30-progress" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${n}" aria-label="${n} of 30 shipped"><div class="l30-progress__label">${n} OF 30 SHIPPED</div><div class="l30-progress__track"><div class="l30-progress__fill" style="width:${(n / 30 * 100).toFixed(1)}%"></div></div></div>`;
const imgAbs = (c, e) => (e.image_key ? `${c.api}/api/img/${e.image_key}` : null);

function tabs(user, cur) {
  const a = (href, label, key) => `<a class="l30-btn l30-btn--${key === cur ? "primary" : "secondary"}" href="${href}"${key === cur ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<div class="actions actions--tabs">${a(`/u/${user}/`, "Blog", "blog")}${a(`/u/${user}/advent/`, "Advent calendar", "advent")}</div>`;
}

function html(body, status, extra) {
  return new Response(body, { status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": status && status !== 200 ? "no-store" : "public, max-age=300, s-maxage=300", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", ...(extra || {}) } });
}

function notFound(c) {
  return html(shell(c, { path: "/community/", title: "Not found | 30 Products in 30 Days", desc: "We couldn't find that page.", noindex: true,
    body: '<header class="hero"><div class="wrap"><div class="hero__text"><p class="label">404</p><h1>We couldn\'t find <mark>that page</mark></h1><p class="lead">Pick someone from the community instead.</p></div></div></header><main class="wrap"><div class="actions"><a class="l30-btn l30-btn--primary" href="/community/">See the community</a></div></main>' }), 404);
}

async function loadPerson(c, env, user) {
  const p = await env.DB.prepare("SELECT id, username, display_name, bio FROM participants WHERE username=? AND status='approved'").bind(user).first();
  if (!p) return null;
  const rows = await env.DB.prepare("SELECT * FROM entries WHERE participant_id=? AND status='published' AND hidden=0 AND day<=? ORDER BY day").bind(p.id, c.today).all();
  return { p, entries: rows.results };
}

export async function handlePublic(request, env, c) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });

  if (path === "/sitemap-participants.xml") return sitemap(env, c);
  if (path === "/u" || path === "/u/") return Response.redirect(c.site + "/community/", 302);

  const m = path.match(/^\/u\/([a-z0-9-]{3,24})(?:\/(advent|day-(\d{2})))?(\/?)$/);
  if (!m) return notFound(c);
  const [, user, sub, dayStr, slash] = m;
  if (!slash) return Response.redirect(`${c.site}${path}/`, 301);

  const person = await loadPerson(c, env, user);
  if (!person) return notFound(c);
  const { p, entries } = person;
  const name = p.display_name || p.username;
  const byDay = {}; entries.forEach((e) => { byDay[e.day] = e; });
  const shipped = entries.length;
  const base = `/u/${user}/`;
  const bio = p.bio || "One product a day for thirty days.";

  if (sub && sub.startsWith("day-")) {
    const day = Number(dayStr), e = byDay[day];
    if (!e) return notFound(c);
    const d = dayDate(c, day), t = pad(day), path2 = `${base}day-${t}/`, pageUrl = c.site + path2, img = imgAbs(c, e);
    const body = `<header class="hero"><div class="wrap"><div class="hero__text"><p class="label">Day ${t} &middot; ${d.label} 2026 &middot; ${esc(e.type)}</p><h1>${esc(e.product_name)}</h1><p class="lead">${esc(e.pitch)}</p></div>${badge(day, 120)}</div></header>
<main class="wrap" style="padding-bottom:var(--space-6)">
<p class="help">By <a href="${base}">${esc(name)}</a></p>
${img ? `<img class="cover" src="${esc(img)}" alt="${esc(e.product_name)}" style="margin:var(--space-3) 0 var(--space-4)">` : ""}
<div class="post">${md(e.body)}</div>
<article class="l30-card" style="margin-top:var(--space-5)"><header class="l30-card__head"><span class="l30-card__day">Day ${t}</span><span class="l30-card__type">${esc(e.type)}</span></header><div class="l30-card__body"><h2 class="l30-card__title">${esc(e.product_name)}</h2><p class="l30-card__text">${esc(e.pitch)}</p><div class="l30-card__foot"><b class="l30-card__price">${esc(e.price)}</b><a class="l30-btn l30-btn--primary" href="${esc(e.product_url)}" rel="noopener nofollow ugc">Grab it</a></div></div></article>
${shareBar(pageUrl, `Day ${t}: ${e.product_name} by ${name} #30products30days`, "Share this post")}
<div class="actions"><a class="l30-btn l30-btn--secondary" href="${base}">More from ${esc(name)}</a><a class="l30-btn l30-btn--secondary" href="${base}advent/">Advent calendar</a></div>
</main>`;
    return html(shell(c, {
      path: path2, nav: "/community/", ogType: "article", image: img, body,
      title: `Day ${t}: ${e.product_name} by ${name} | 30 Products in 30 Days`, ogTitle: `Day ${t}: ${e.product_name}`, desc: e.pitch,
      ld: { "@context": "https://schema.org", "@type": "BlogPosting", headline: `Day ${t}: ${e.product_name}`, description: e.pitch, datePublished: d.iso, dateModified: new Date(e.updated_at * 1000).toISOString(),
        url: pageUrl, mainEntityOfPage: pageUrl, image: img || c.site + "/social/og-image.png", author: { "@type": "Person", name, url: c.site + base },
        isPartOf: { "@type": "Blog", name: `${name}: 30 Products in 30 Days`, url: c.site + base }, publisher: { "@type": "Organization", name: "30 Products in 30 Days", url: c.site } },
    }));
  }

  const hero = (label, h1) => `<header class="hero hero--advent"><div class="wrap"><p class="label">${label}</p><h1>${h1}</h1><p class="lead">${esc(bio)}</p>${progress(shipped)}</div></header>`;
  const noindex = shipped === 0;   // thin pages stay out of search until the first post opens

  if (sub === "advent") {
    let doors = "";
    for (let n = 1; n <= 30; n++) {
      const e = byDay[n], d = dayDate(c, n), colour = n % 2 ? "pink" : "blue", t = pad(n);
      const inside = e
        ? `<div class="door__inside" inert aria-hidden="true">${badge(n, 48)}<h2>${esc(e.product_name)}</h2><span class="l30-tag l30-tag--shipped door__type">${esc(e.type)}</span><a class="l30-btn l30-btn--primary" href="${base}day-${t}/">Read the post</a></div>`
        : '<div class="door__inside" aria-hidden="true"></div>';
      const half = (side, hid) => `<span class="half half--${side}"${hid ? ' aria-hidden="true"' : ""}><span class="half__in">${badge(n, 56)}<span class="door__date">${d.label}</span><span class="door__hint">Day ${t}</span></span></span>`;
      doors += `<li class="door door--${colour} door--locked" data-day="${n}" data-date="${d.iso}" data-label="${d.label}" data-post="${e ? 1 : 0}"><span class="today-tag" hidden>Today</span>${inside}<button type="button" class="door__cover" disabled aria-disabled="true" aria-label="Day ${n}, ${d.label}, not open yet">${half("l")}${half("r", true)}</button></li>`;
    }
    const pageUrl = c.site + base + "advent/";
    const body = `${hero("Advent calendar", `${esc(name)}<br><mark>advent calendar</mark>`)}
<main class="wrap wrap--wide" style="padding-top:var(--space-5);padding-bottom:var(--space-6)">
${tabs(user, "advent")}
<ol class="doors" aria-label="Advent calendar">${doors}</ol>
${shareBar(pageUrl, `${name}'s 30 Products in 30 Days advent calendar #30products30days`, "Share this calendar")}
</main>`;
    return html(shell(c, {
      path: base + "advent/", noindex, body, script: `L30.wireDoors(${JSON.stringify(user)});`,
      title: `${name}'s advent calendar | 30 Products in 30 Days`, ogTitle: `${name}'s advent calendar`,
      desc: `${shipped} of 30 products shipped so far. Open a door a day to see what ${name} built for the 30 Products in 30 Days challenge.`,
      ld: { "@context": "https://schema.org", "@type": "CollectionPage", name: `${name}'s advent calendar`, url: pageUrl, isPartOf: { "@type": "WebSite", name: "30 Products in 30 Days", url: c.site }, author: { "@type": "Person", name } },
    }));
  }

  // blog index
  const pageUrl = c.site + base;
  const list = entries.slice().reverse().map((e) => {
    const t = pad(e.day);
    return `<li><a class="item" href="${base}day-${t}/">${badge(e.day, 64)}<div><h2>${esc(e.product_name)}</h2><p>${esc(e.pitch)}</p></div></a></li>`;
  }).join("");
  const body = `${hero("Participant blog", `${esc(name)}<br><mark>blog</mark>`)}
<main class="wrap" style="padding-top:var(--space-5);padding-bottom:var(--space-6)">
${tabs(user, "blog")}
${list ? `<ul class="list">${list}</ul>` : '<div class="nodata"><strong>No posts yet.</strong> Each day\'s post appears here as its door opens.</div>'}
${shareBar(pageUrl, `${name}'s 30 Products in 30 Days blog #30products30days`, "Share this blog")}
</main>`;
  return html(shell(c, {
    path: base, noindex, body,
    title: `${name}'s blog | 30 Products in 30 Days`, ogTitle: `${name}'s 30 Products in 30 Days blog`,
    desc: p.bio ? `${p.bio} ${shipped} of 30 products shipped.` : `${shipped} of 30 products shipped. Follow ${name} through the 30 Products in 30 Days challenge.`,
    ld: { "@context": "https://schema.org", "@type": "Blog", name: `${name}: 30 Products in 30 Days`, description: bio, url: pageUrl, author: { "@type": "Person", name },
      blogPost: entries.map((e) => ({ "@type": "BlogPosting", headline: `Day ${pad(e.day)}: ${e.product_name}`, url: `${c.site}${base}day-${pad(e.day)}/`, datePublished: dayDate(c, e.day).iso })) },
  }));
}

async function sitemap(env, c) {
  const rows = await env.DB.prepare(
    `SELECT p.username, e.day, e.updated_at FROM entries e JOIN participants p ON p.id=e.participant_id
     WHERE p.status='approved' AND p.username IS NOT NULL AND e.status='published' AND e.hidden=0 AND e.day<=? ORDER BY p.username, e.day LIMIT 20000`
  ).bind(c.today).all();
  const iso = (s) => new Date(s * 1000).toISOString().slice(0, 10);
  const users = new Map();
  for (const r of rows.results) {
    const u = users.get(r.username) || { last: 0, days: [] };
    u.last = Math.max(u.last, r.updated_at); u.days.push(r); users.set(r.username, u);
  }
  const url = (loc, last) => `<url><loc>${c.site}${loc}</loc><lastmod>${iso(last)}</lastmod></url>`;
  let out = "";
  for (const [user, u] of users) {
    out += url(`/u/${user}/`, u.last) + url(`/u/${user}/advent/`, u.last);
    for (const r of u.days) out += url(`/u/${user}/day-${pad(r.day)}/`, r.updated_at);
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${out}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}
