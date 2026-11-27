// Shared helpers for the participant pages (account, calendar, community, admin).
(function () {
  var API = "https://30p30d-participants.malgordonperth.workers.dev";
  var KEY = "l30-session", START = Date.UTC(2026, 10, 28);
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var L = window.L30 = {
    API: API,
    esc: function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); },
    session: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    setSession: function (v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} },
    api: function (path, opts) {
      opts = opts || {};
      var h = opts.headers || {};
      var s = L.session();
      if (s) h.Authorization = "Bearer " + s;
      if (opts.json !== undefined) { h["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
      return fetch(API + path, { method: opts.method || "GET", headers: h, body: opts.body })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, ok: r.ok, data: d }; }); })
        .catch(function () { return { status: 0, ok: false, data: { error: "Network problem. Try again." } }; });
    },
    img: function (p) { return p ? API + p : ""; },
    perthToday: function () { return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(new Date()); },
    dayDate: function (n) { var d = new Date(START + (n - 1) * 864e5); return { iso: d.toISOString().slice(0, 10), label: d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] }; },
    inline: function (s) {
      s = L.esc(s);
      s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener nofollow ugc">$1</a>');
      return s;
    },
    md: function (body) {
      var out = [], para = [], items = [];
      function flush() {
        if (para.length) { out.push("<p>" + L.inline(para.join(" ")) + "</p>"); para = []; }
        if (items.length) { out.push("<ul>" + items.map(function (i) { return "<li>" + L.inline(i) + "</li>"; }).join("") + "</ul>"); items = []; }
      }
      String(body || "").split(/\r?\n/).forEach(function (line) {
        if (!line.trim()) flush();
        else if (line.indexOf("## ") === 0) { flush(); out.push("<h2>" + L.inline(line.slice(3)) + "</h2>"); }
        else if (line.indexOf("- ") === 0) { if (para.length) flush(); items.push(line.slice(2)); }
        else { if (items.length) flush(); para.push(line.trim()); }
      });
      flush();
      return out.join("\n");
    },
    badge: function (n, size) {
      var t = (n < 10 ? "0" : "") + n;
      return '<svg class="l30-badge" width="' + size + '" height="' + size + '" viewBox="0 0 120 120" role="img" aria-label="Day ' + t + '">' +
        '<circle cx="54" cy="58" r="46" fill="#0F1B3D"/><circle cx="48" cy="52" r="46" fill="#FFD21F" stroke="#0F1B3D" stroke-width="5"/>' +
        '<text x="48" y="68" text-anchor="middle" font-family="var(--font-display)" font-weight="800" font-size="50" letter-spacing="-3" fill="#0F1B3D">' + t + '</text>' +
        '<path d="M100 6 L104 18 L116 22 L104 26 L100 38 L96 26 L84 22 L96 18 Z" fill="#FF6F91" stroke="#0F1B3D" stroke-width="3" stroke-linejoin="round"/></svg>';
    },
    nav: function (cur) {
      var items = [["home","/","Home"],["blog","/blog/","Blog"],["advent","/advent/","Advent calendar"],["community","/community/","Community"],["account","/account/","My account"],["join","/register.html","Join"]];
      var li = items.map(function (i) { return '<li><a class="site-nav__link" href="' + i[1] + '"' + (i[0] === cur ? ' aria-current="page"' : "") + ">" + i[2] + "</a></li>"; }).join("");
      var el = document.getElementById("nav");
      if (el) el.innerHTML = '<div class="site-nav__in"><a class="site-nav__brand" href="/"><img src="/brand/logos/launch-badge.svg" alt="" width="36" height="36"><span>30 Products 30 Days</span></a><nav aria-label="Main"><ul class="site-nav__list">' + li + "</ul></nav></div>";
    },
    status: function (el, text, cls) { el.textContent = text; el.className = "status " + (cls || ""); },
    // Advent door markup, same look as /advent/. e = published entry or null.
    door: function (n, e, today, base) {
      var d = L.dayDate(n), colour = n % 2 ? "pink" : "blue", open = e && n <= today;
      var inside = open
        ? '<div class="door__inside" inert aria-hidden="true">' + L.badge(n, 48) + "<h2>" + L.esc(e.product_name) + '</h2><span class="l30-tag l30-tag--shipped door__type">' + L.esc(e.type) + '</span><a class="l30-btn l30-btn--primary" href="' + base + "&day=" + n + '">Read the post</a></div>'
        : '<div class="door__inside" aria-hidden="true"></div>';
      function half(side, hid) {
        return '<span class="half half--' + side + '"' + (hid ? ' aria-hidden="true"' : "") + '><span class="half__in">' + L.badge(n, 56) + '<span class="door__date">' + d.label + '</span><span class="door__hint">Day ' + (n < 10 ? "0" : "") + n + "</span></span></span>";
      }
      var cover = '<button type="button" class="door__cover" disabled aria-disabled="true" aria-label="Day ' + n + ", " + d.label + ', not open yet">' + half("l") + half("r", true) + "</button>";
      return '<li class="door door--' + colour + ' door--locked" data-day="' + n + '" data-date="' + d.iso + '" data-label="' + d.label + '" data-post="' + (e ? 1 : 0) + '"><span class="today-tag" hidden>Today</span>' + inside + cover + "</li>";
    },
    // Door behaviour copied from the advent page: tear open once, remember per browser.
    wireDoors: function (scope) {
      var OK = "l30-advent-opened-" + scope, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      var today = L.perthToday(), opened = [];
      try { opened = JSON.parse(localStorage.getItem(OK) || "[]"); } catch (e) {}
      function save(d) { if (opened.indexOf(d) < 0) opened.push(d); try { localStorage.setItem(OK, JSON.stringify(opened)); } catch (e) {} }
      function finish(door, focus) {
        door.classList.remove("is-tearing"); door.classList.add("is-open");
        var ins = door.querySelector(".door__inside"); ins.removeAttribute("inert"); ins.removeAttribute("aria-hidden");
        if (focus) { var a = ins.querySelector("a"); if (a) a.focus(); }
      }
      document.querySelectorAll(".door").forEach(function (door) {
        var date = door.dataset.date, has = door.dataset.post === "1", cover = door.querySelector(".door__cover"), tag = door.querySelector(".today-tag");
        if (date === today && tag) tag.hidden = false;
        if (!has || date > today) return;
        door.classList.remove("door--locked"); cover.disabled = false; cover.removeAttribute("aria-disabled");
        cover.setAttribute("aria-label", "Tear open Day " + door.dataset.day + ", " + door.dataset.label);
        cover.querySelectorAll(".door__hint").forEach(function (h) { h.textContent = "Tear me open"; });
        if (opened.indexOf(date) >= 0) { finish(door, false); return; }
        cover.addEventListener("click", function () {
          if (door.classList.contains("is-tearing")) return;
          save(date);
          if (reduce) { finish(door, true); return; }
          door.classList.add("is-tearing");
          var done = false, end = function () { if (done) return; done = true; finish(door, true); };
          door.querySelector(".half--r").addEventListener("animationend", end);
          setTimeout(end, 1300);
        });
      });
    }
  };
})();
