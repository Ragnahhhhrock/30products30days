// GA4 event helpers for 30products30days.com (measurement ID G-FM1RLPT7RK, loaded in <head>).
// No personal data (names, emails, messages) is ever sent with an event.
(function () {
  window.dataLayer = window.dataLayer || [];
  window.track = function (name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
  };

  var D = document;

  // Challenge day (Day 1 = 28 Nov 2026 00:00 Perth), sent once per page view while the challenge is live.
  var diff = Date.now() - Date.parse("2026-11-28T00:00:00+08:00");
  var day = diff >= 0 ? Math.floor(diff / 864e5) + 1 : 0;
  if (day >= 1 && day <= 30) window.track("challenge_day_view", { challenge_day: day, page_path: location.pathname });

  // Link clicks: social, blog, sign-up, contact and other outbound links.
  D.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    var where = (a.closest("footer") ? "footer" : a.closest("header") ? "header" : "body");
    var social = { "x.com": "x", "www.instagram.com": "instagram", "www.facebook.com": "facebook" }[u.hostname];
    if (social) return window.track("social_click", { network: social, link_url: u.href, location: where });
    if (u.hostname === location.hostname) {
      if (u.pathname.indexOf("/blog") === 0 && u.pathname !== location.pathname) return window.track("blog_click", { link_url: u.pathname, location: where });
      if (u.pathname.indexOf("/register") === 0) return window.track("signup_click", { location: where });
      if (u.hash === "#cf") return window.track("contact_click", { location: where });
    } else {
      window.track("outbound_click", { link_domain: u.hostname, link_url: u.href, location: where });
    }
  });

  // First interaction with each form (signup / contact), once per page view.
  var started = {};
  D.addEventListener("focusin", function (e) {
    var f = e.target.form;
    if (!f || !f.id || started[f.id]) return;
    started[f.id] = 1;
    window.track("form_begin", { form_name: f.id === "cf" ? "contact" : "signup" });
  });
})();
