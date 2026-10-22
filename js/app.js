(function () {
  var LAUNCH = new Date(2026, 10, 19, 0, 0, 0);
  var state = { news: [], filter: "all" };
  var LABEL = { confirmado: "Confirmado", reportado: "Reportado", rumor: "Rumor" };

  try { var saved = localStorage.getItem("gta6-filter"); if (saved) state.filter = saved; } catch (e) {}

  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    var ms = LAUNCH - new Date();
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    document.getElementById("cd-d").textContent = Math.floor(s / 86400);
    document.getElementById("cd-h2").textContent = pad(Math.floor(s % 86400 / 3600));
    document.getElementById("cd-m").textContent = pad(Math.floor(s % 3600 / 60));
    document.getElementById("cd-s").textContent = pad(s % 60);
  }
  tick(); setInterval(tick, 1000);

  function fmtDate(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "";
    var o = { day: "numeric", month: "short", year: "numeric" };
    if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; }
    return d.toLocaleString("es-ES", o);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function chip(estado) { var k = LABEL[estado] ? estado : "rumor"; return el("span", "chip " + k, LABEL[k]); }
  function srcLink(name, url) {
    var s = el("span", "src");
    if (url && /^https?:\/\//.test(url)) { var a = el("a", null, name || "Fuente"); a.href = url; a.target = "_blank"; a.rel = "noopener"; s.appendChild(a); }
    else s.textContent = name || "";
    return s;
  }
  function timeEl(fecha) {
    var t = el("time"); t.dateTime = fecha || "";
    var d = new Date((fecha || "") + "T12:00:00");
    if (isNaN(d)) { t.textContent = fecha || ""; return t; }
    t.textContent = d.getDate() + " " + d.toLocaleString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
    t.appendChild(el("small", null, String(d.getFullYear())));
    return t;
  }

  function renderFacts(meta) {
    var box = document.getElementById("facts");
    box.textContent = "";
    var facts = (meta && Array.isArray(meta.hechos)) ? meta.hechos : [];
    if (!facts.length) { box.appendChild(el("p", "empty", "La ficha aparecerá tras la primera revisión.")); return; }
    facts.forEach(function (f) {
      var d = el("div", "fact");
      d.appendChild(el("span", "label", f.etiqueta));
      d.appendChild(el("span", "v", f.valor));
      var r = el("div", "row"); r.appendChild(chip(f.estado)); r.appendChild(srcLink(f.fuente, f.url));
      d.appendChild(r); box.appendChild(d);
    });
  }

  function renderMeta(meta) {
    if (!meta) return;
    if (meta.actualizado) {
      document.getElementById("upd").textContent = fmtDate(meta.actualizado, true);
    }
    if (meta.lanzamientoTexto) document.getElementById("launchLbl").textContent = "Lanzamiento: " + meta.lanzamientoTexto;
    if (meta.lanzamientoISO) { var d = new Date(meta.lanzamientoISO + "T00:00:00"); if (!isNaN(d)) LAUNCH = d; tick(); }
    renderFacts(meta);
  }

  // Per-viewer memory in this browser: which items were already seen, and the spoiler preference.
  function store(k, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; }
  }
  var SEEN = store("ln-seen-v1") || {}, fresh = {}, currentTab = "resumen", seenTimer = 0;
  var TAB_COLLS = { resumen: ["agenda"], noticias: ["noticias"], trailers: ["trailers"], personajes: ["personajes"], musica: ["musica"], cronologia: ["cronologia"], mitos: ["mitos"], resenas: ["resenas"] };
  function track(coll, ids) {
    if (!Array.isArray(SEEN[coll])) { SEEN[coll] = ids.slice(); store("ln-seen-v1", SEEN); fresh[coll] = {}; }
    else { fresh[coll] = fresh[coll] || {}; ids.forEach(function (id) { if (SEEN[coll].indexOf(id) < 0) fresh[coll][id] = true; }); }
    updateBadges();
    if ((TAB_COLLS[currentTab] || []).indexOf(coll) >= 0) scheduleSeen(currentTab);
  }
  function isNew(coll, id) { return !!(fresh[coll] && fresh[coll][id]); }
  function unseen(coll) {
    var f = fresh[coll] || {}, s = SEEN[coll] || [];
    return Object.keys(f).filter(function (id) { return s.indexOf(id) < 0; }).length;
  }
  function updateBadges() {
    Array.prototype.forEach.call(document.querySelectorAll(".tabbar button"), function (b) {
      var n = (TAB_COLLS[b.dataset.tab] || []).reduce(function (t, c) { return t + unseen(c); }, 0);
      var badge = b.querySelector(".badge");
      if (!n) { if (badge) badge.remove(); return; }
      if (!badge) { badge = el("span", "badge"); b.appendChild(badge); }
      badge.textContent = n; badge.setAttribute("aria-label", n + (n === 1 ? " nueva" : " nuevas"));
    });
  }
  function scheduleSeen(tab) {
    clearTimeout(seenTimer);
    seenTimer = setTimeout(function () {
      (TAB_COLLS[tab] || []).forEach(function (c) {
        SEEN[c] = SEEN[c] || [];
        Object.keys(fresh[c] || {}).forEach(function (id) { if (SEEN[c].indexOf(id) < 0) SEEN[c].push(id); });
        if (SEEN[c].length > 1000) SEEN[c] = SEEN[c].slice(-1000);
      });
      store("ln-seen-v1", SEEN); updateBadges();
    }, 1500);
  }
  function newTag(coll, id) { return isNew(coll, id) ? el("span", "new-tag", "Nuevo") : null; }

  var noSpoil = store("ln-nospoil"); if (noSpoil === null) noSpoil = true;
  var revealed = {};
  function spoilWrap(node, key) {
    if (!noSpoil || revealed[key]) return node;
    node.classList.add("spoil");
    var b = el("button", "spoil-btn"); b.type = "button";
    b.appendChild(document.createTextNode("Contiene spoilers")); b.appendChild(el("small", null, "Toca para mostrar"));
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation(); revealed[key] = true;
      var quick = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.classList.add("revealing");
      setTimeout(function () { node.classList.remove("spoil", "revealing"); b.remove(); }, quick ? 0 : 720);
    });
    node.appendChild(b);
    return node;
  }

  // Deep links: each news item, myth and milestone can be shared as this page's address plus #token.
  var BASE_URL = location.origin + location.pathname;
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TOKEN_TAB = [["pj-", "personajes"], ["n-", "noticias"], ["m-", "mitos"], ["t-", "trailers"], ["r-", "musica"], ["c-", "cronologia"], ["a-", "resumen"]];
  function tabFor(token) {
    if (token === "album") return "musica";
    for (var i = 0; i < TOKEN_TAB.length; i++) if (token.indexOf(TOKEN_TAB[i][0]) === 0) return TOKEN_TAB[i][1];
    return null;
  }
  function shareBtn(token) {
    var b = el("button", "share", "Copiar enlace"); b.type = "button";
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var url = BASE_URL + "#" + token;
      function ok() { b.textContent = "Copiado ✓"; b.classList.add("ok"); setTimeout(function () { b.textContent = "Copiar enlace"; b.classList.remove("ok"); }, 2000); }
      function fallback() {
        if (b.nextSibling && b.nextSibling.className === "copybox") return;
        var box = el("span", "copybox"), inp = el("input"); inp.value = url; inp.readOnly = true; inp.setAttribute("aria-label", "Enlace para copiar");
        box.appendChild(inp); b.parentNode.insertBefore(box, b.nextSibling); inp.focus(); inp.select();
      }
      try { navigator.clipboard.writeText(url).then(ok, fallback); } catch (err) { fallback(); }
    });
    return b;
  }
  function focusEl(x) {
    setTimeout(function () {
      x.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "center" });
      x.classList.remove("hl"); void x.offsetWidth; x.classList.add("hl");
    }, 80);
  }
  var pendingHash = (location.hash || "").slice(1);
  if (pendingHash && tabFor(pendingHash)) { try { history.scrollRestoration = "manual"; } catch (e) {} }
  function resolveHash() {
    if (!pendingHash) return;
    var tab = tabFor(pendingHash);
    if (!tab) { pendingHash = ""; return; }
    var x = document.getElementById(pendingHash);
    if (!x && tab === "noticias" && state.filter !== "all" && state.news.some(function (n) { return "n-" + n._id === pendingHash; })) {
      state.filter = "all"; renderFeed(); return;
    }
    if (!x) return;
    pendingHash = "";
    showTab(tab, false); focusEl(x);
    setTimeout(function () { var r = x.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) x.scrollIntoView({ block: "center" }); }, 900);
  }

  function newsItem(n, withId) {
    var li = el("li", "item");
    if (withId) li.id = "n-" + n._id;
    li.appendChild(timeEl(n.fecha));
    var body = el("div");
    body.appendChild(el("h3", null, n.titulo));
    if (n.resumen) body.appendChild(el("p", null, n.resumen));
    var r = el("div", "row");
    var nt = newTag("noticias", n._id); if (nt) r.appendChild(nt);
    r.appendChild(chip(n.estado));
    if (n.categoria) r.appendChild(el("span", "cat", n.categoria));
    r.appendChild(srcLink(n.fuente, n.url));
    if (withId) r.appendChild(shareBtn("n-" + n._id));
    body.appendChild(r); li.appendChild(body);
    return n.spoiler ? spoilWrap(li, "n:" + n._id) : li;
  }

  var lastAgenda = [];
  function evDate(e) { return e.todoElDia ? new Date(e.inicio + "T00:00:00") : new Date(e.inicio); }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
  function utcStamp(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function evEnd(e, d) {
    if (e.todoElDia) { var n = new Date(d); n.setDate(n.getDate() + 1); return n; }
    return e.fin ? new Date(e.fin) : new Date(d.getTime() + 3600000);
  }
  function calLinks(e, d) {
    var end = evEnd(e, d), details = (e.descripcion || "") + (e.url ? "\n" + e.url : "");
    var g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.titulo) +
      "&dates=" + (e.todoElDia ? ymd(d) + "/" + ymd(end) : utcStamp(d) + "/" + utcStamp(end)) + "&details=" + encodeURIComponent(details);
    var o = "https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=" + encodeURIComponent(e.titulo) +
      "&body=" + encodeURIComponent(details) +
      (e.todoElDia ? "&startdt=" + e.inicio + "&enddt=" + end.toISOString().slice(0, 10) + "&allday=true" : "&startdt=" + d.toISOString() + "&enddt=" + end.toISOString());
    return [["Google Calendar", g], ["Outlook", o]];
  }
  // "+ Mi calendario": builds an .ics file in the browser, for Apple Calendar and any other calendar app.
  function icsText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFold(line) {
    var out = [];
    while (line.length > 60) { out.push(line.slice(0, 60)); line = " " + line.slice(60); }
    out.push(line);
    return out.join("\r\n");
  }
  function icsButton(e, d) {
    var b = el("button", null, "+ Mi calendario"); b.type = "button";
    b.addEventListener("click", function () {
      var end = evEnd(e, d), details = (e.descripcion || "") + (e.url ? "\n" + e.url : "");
      var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Leonida News//ES", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
        "UID:" + e._id + "@leonida-news", "DTSTAMP:" + utcStamp(new Date()),
        e.todoElDia ? "DTSTART;VALUE=DATE:" + ymd(d) : "DTSTART:" + utcStamp(d),
        e.todoElDia ? "DTEND;VALUE=DATE:" + ymd(end) : "DTEND:" + utcStamp(end),
        "SUMMARY:" + icsText(e.titulo), "DESCRIPTION:" + icsText(details)];
      if (/^https?:\/\//.test(e.url || "")) lines.push("URL:" + e.url);
      lines.push("END:VEVENT", "END:VCALENDAR");
      var url = URL.createObjectURL(new Blob([lines.map(icsFold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
      var a = el("a"); a.href = url; a.download = "leonida-news-" + e._id + ".ics";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    return b;
  }
  function relDays(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var n = Math.round((x - t) / 86400000);
    return n === 0 ? "Hoy" : n === 1 ? "Mañana" : n > 1 ? "En " + n + " días" : n === -1 ? "Ayer" : "Hace " + (-n) + " días";
  }
  function renderAgenda(list) {
    lastAgenda = list;
    var ol = clear("agenda"), now = Date.now();
    var items = list.map(function (e) { return { e: e, d: evDate(e) }; })
      .filter(function (x) { return !isNaN(x.d) && evEnd(x.e, x.d).getTime() > now - 2 * 86400000; })
      .sort(function (a, b) { return a.d - b.d; });
    if (!items.length) { ol.appendChild(el("li", "empty", "No hay fechas próximas guardadas.")); return; }
    items.forEach(function (x) {
      var e = x.e, d = x.d, past = evEnd(e, d).getTime() < now;
      var li = el("li", "ev" + (e.destacado ? " top" : "") + (past ? " past" : "")); li.id = "a-" + e._id;
      var day = el("div", "day");
      day.appendChild(el("b", null, String(d.getDate())));
      day.appendChild(el("span", null, d.toLocaleString("es-ES", { month: "short" }).replace(".", "")));
      li.appendChild(day);
      var b = el("div", "body");
      b.appendChild(el("h3", null, e.titulo));
      var w = el("div", "when");
      var nt = newTag("agenda", e._id); if (nt) w.appendChild(nt);
      w.appendChild(el("span", "rel", past ? "Ya pasó" : relDays(d)));
      w.appendChild(el("span", null, e.todoElDia
        ? d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
        : d.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " (tu hora)"));
      if (e.aproximada) w.appendChild(el("span", "approx", "Fecha estimada"));
      b.appendChild(w);
      if (e.descripcion) b.appendChild(el("p", null, e.descripcion));
      var r = el("div", "row"); r.appendChild(chip(e.estado)); r.appendChild(srcLink(e.fuente, e.url));
      if (!past) {
        var cal = el("div", "cal");
        calLinks(e, d).forEach(function (c) { var a = el("a", null, "+ " + c[0]); a.href = c[1]; a.target = "_blank"; a.rel = "noopener"; cal.appendChild(a); });
        cal.appendChild(icsButton(e, d));
        r.appendChild(cal);
      }
      b.appendChild(r); li.appendChild(b); ol.appendChild(li);
    });
    resolveHash();
  }
  setInterval(function () { if (lastAgenda.length) renderAgenda(lastAgenda); }, 30 * 60 * 1000);

  function renderLatest() {
    var ul = document.getElementById("latest");
    ul.textContent = "";
    if (!state.news.length) { ul.appendChild(el("li", "empty", "Todavía no hay noticias guardadas.")); return; }
    state.news.slice(0, 3).forEach(function (n) { ul.appendChild(newsItem(n)); });
  }

  function showTab(name, scroll) {
    if (!document.getElementById("p-" + name)) name = "resumen";
    Array.prototype.forEach.call(document.querySelectorAll(".tabbar button"), function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on) { var bar = b.parentElement, bl = b.offsetLeft, br = bl + b.offsetWidth; if (bl < bar.scrollLeft || br > bar.scrollLeft + bar.clientWidth - 36) bar.scrollTo({ left: Math.max(0, bl - 24), behavior: "smooth" }); }
      document.getElementById("p-" + b.dataset.tab).hidden = !on;
    });
    currentTab = name; scheduleSeen(name);
    if (scroll) {
      var bar = document.querySelector(".tabnav");
      var y = bar.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(bar).top) || 0);
      if (window.scrollY > y) window.scrollTo(0, y);
    }
  }
  // Tab strip overflow: arrows, mouse wheel and drag scroll it sideways; edge fades show there is more.
  var tabnav = document.querySelector(".tabnav"), strip = tabnav.querySelector(".tabbar");
  var tabPrev = document.getElementById("tabPrev"), tabNext = document.getElementById("tabNext"), dragMoved = false;
  function updateArrows() {
    var max = strip.scrollWidth - strip.clientWidth, l = strip.scrollLeft > 2, r = strip.scrollLeft < max - 2;
    tabPrev.hidden = !l; tabNext.hidden = !r;
    tabnav.classList.toggle("fade-l", l); tabnav.classList.toggle("fade-r", r);
  }
  function nudge(dir) { strip.scrollBy({ left: dir * Math.max(160, strip.clientWidth * 0.6), behavior: REDUCE ? "auto" : "smooth" }); }
  tabPrev.addEventListener("click", function () { nudge(-1); });
  tabNext.addEventListener("click", function () { nudge(1); });
  strip.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  strip.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    var max = strip.scrollWidth - strip.clientWidth;
    if (max <= 0 || (e.deltaY < 0 && strip.scrollLeft <= 0) || (e.deltaY > 0 && strip.scrollLeft >= max - 1)) return;
    e.preventDefault();
    strip.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
  }, { passive: false });
  strip.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    var x0 = e.clientX, s0 = strip.scrollLeft; dragMoved = false;
    function move(ev) {
      var dx = ev.clientX - x0;
      if (!dragMoved && Math.abs(dx) > 5) { dragMoved = true; strip.classList.add("dragging"); }
      if (dragMoved) strip.scrollLeft = s0 - dx;
    }
    function up() { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); strip.classList.remove("dragging"); setTimeout(function () { dragMoved = false; }, 0); }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateArrows);
  setTimeout(updateArrows, 0);

  Array.prototype.forEach.call(document.querySelectorAll(".tabbar button"), function (b, i, all) {
    b.addEventListener("click", function (e) { if (dragMoved) { e.preventDefault(); return; } showTab(b.dataset.tab, true); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var n = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      n.focus(); showTab(n.dataset.tab, true);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.go, true); });
  });
  showTab((location.hash || "").slice(1) || "resumen", false);

  function renderFeed() {
    renderLatest();
    var ul = document.getElementById("feed");
    ul.textContent = "";
    var list = state.news.filter(function (n) { return state.filter === "all" || n.estado === state.filter; });
    document.getElementById("ncount").textContent = state.news.length ? state.news.length + " entradas" : "";
    if (!list.length) {
      ul.appendChild(el("li", "empty", state.news.length ? "No hay entradas con este filtro." : "Todavía no hay noticias guardadas. Aparecerán tras la próxima revisión."));
      return;
    }
    list.forEach(function (n) { ul.appendChild(newsItem(n, true)); });
    resolveHash();
  }

  var lastTrailers = [], lastMyths = [];
  function renderTrailers(list) {
    lastTrailers = list;
    var box = document.getElementById("tapes");
    box.textContent = "";
    if (!list.length) { box.appendChild(el("p", "empty", "Todavía no hay tráilers guardados. Aparecerán tras la próxima revisión.")); return; }
    list.forEach(function (t, i) {
      var safe = t.url && /^https?:\/\//.test(t.url);
      var a = el(safe ? "a" : "div", "tape"); a.id = "t-" + t._id;
      if (safe) { a.href = t.url; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", (t.titulo || "Tráiler") + " en YouTube"); }
      var sc = el("div", "screen");
      sc.appendChild(el("span", "num", t.numero || String(i + 1).padStart(2, "0")));
      sc.appendChild(el("span", "rec", "Play"));
      var pl = el("span", "play"); pl.setAttribute("aria-hidden", "true"); sc.appendChild(pl);
      if (t.duracion) sc.appendChild(el("span", "dur", t.duracion));
      a.appendChild(sc);
      var m = el("div", "meta");
      m.appendChild(el("h3", null, t.titulo));
      m.appendChild(el("span", "label", fmtDate((t.fecha || "") + "T12:00:00") + (t.canal ? " · " + t.canal : "")));
      if (t.descripcion) m.appendChild(el("p", null, t.descripcion));
      var r = el("div", "row"); r.appendChild(chip(t.estado));
      if (safe) r.appendChild(el("span", "yt", "Ver en YouTube ↗"));
      m.appendChild(r); a.appendChild(m);
      var nt = newTag("trailers", t._id); if (nt) sc.appendChild(nt);
      box.appendChild(t.spoiler ? spoilWrap(a, "t:" + t._id) : a);
    });
    resolveHash();
  }

  function clear(id) { var b = document.getElementById(id); b.textContent = ""; return b; }
  function initials(name) { return String(name || "?").replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ' ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  var COLORS = { pink: 1, cyan: 1, sun: 1, orange: 1, green: 1, red: 1, violet: 1 };
  var REGCOLOR = { "port-gellhorn": "#ff7a3d", "mount-kalaga": "#9b7bff", "ambrosia": "#ffd23f", "grassrivers": "#3dffb0", "vice-city": "#ff2e93", "leonida-keys": "#19e3ff" };

  var castCache = [];
  function renderCast(list) {
    castCache = list;
    setTimeout(resolveHash, 0);
    var box = clear("cast");
    if (!list.length) { box.appendChild(el("p", "empty", "Todavía no hay personajes guardados.")); return; }
    list.forEach(function (p) {
      var c = el("article", "pcard c-" + (COLORS[p.color] ? p.color : "pink")); c.id = "pj-" + p._id;
      c.tabIndex = 0;
      var art = el("div", "art");
      if (safeImg(p.imagen)) {
        var im = el("img", "portrait"); im.src = p.imagen; im.alt = "Retrato oficial de " + p.nombre; im.loading = "lazy"; im.decoding = "async";
        im.onerror = function () { im.remove(); art.classList.remove("has-img"); };
        art.classList.add("has-img"); art.appendChild(im);
      }
      art.appendChild(el("span", "ini", initials(p.nombre)));
      if (p.rol) art.appendChild(el("span", "role", p.rol));
      var nt = newTag("personajes", p._id); if (nt) art.appendChild(nt);
      c.appendChild(art);
      var m = el("div", "meta");
      m.appendChild(el("h3", null, p.nombre));
      if (p.descripcion) m.appendChild(el("p", null, p.descripcion));
      m.appendChild(srcLink(p.fuente, p.url));
      c.appendChild(m); box.appendChild(c);
    });
  }

  var regions = {}, activeReg = "vice-city";
  function selectRegion(id) {
    if (!regions[id]) return;
    activeReg = id;
    var r = regions[id], d = clear("regDetail");
    d.style.setProperty("--c", REGCOLOR[id] || "#ff2e93");
    d.appendChild(el("h3", null, r.nombre));
    if (r.inspiracion) d.appendChild(el("span", "insp", "Inspiración: " + r.inspiracion));
    if (r.descripcion) d.appendChild(el("p", null, r.descripcion));
    if (Array.isArray(r.destacados) && r.destacados.length) {
      var t = el("div", "tags"); r.destacados.forEach(function (x) { t.appendChild(el("span", null, x)); }); d.appendChild(t);
    }
    var row = el("div", "row"); row.style.display = "flex"; row.style.gap = "10px"; row.style.flexWrap = "wrap"; row.style.alignItems = "center";
    row.appendChild(chip(r.estado)); row.appendChild(srcLink(r.fuente, r.url)); d.appendChild(row);
    Array.prototype.forEach.call(document.querySelectorAll("#leoMap .reg"), function (p) { p.classList.toggle("on", p.dataset.region === id); });
    Array.prototype.forEach.call(document.querySelectorAll("#regChips button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.region === id)); });
  }
  function renderRegions(list) {
    regions = {};
    list.forEach(function (r) { regions[r._id] = r; });
    var chips = clear("regChips");
    list.forEach(function (r) {
      var b = el("button", null, r.nombre); b.type = "button"; b.dataset.region = r._id;
      b.style.setProperty("--c", REGCOLOR[r._id] || "#ff2e93");
      b.addEventListener("click", function () { selectRegion(r._id); });
      chips.appendChild(b);
    });
    if (!list.length) { clear("regDetail").appendChild(el("p", "empty", "Todavía no hay regiones guardadas.")); return; }
    selectRegion(regions[activeReg] ? activeReg : list[0]._id);
  }
  Array.prototype.forEach.call(document.querySelectorAll("#leoMap .reg"), function (p) {
    p.addEventListener("click", function () { selectRegion(p.dataset.region); });
    p.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectRegion(p.dataset.region); } });
  });

  function renderEditions(list) {
    var box = clear("tickets");
    if (!list.length) { box.appendChild(el("p", "empty", "Todavía no hay ediciones guardadas.")); return; }
    list.forEach(function (e) {
      var t = el("article", "ticket" + (e.destacada ? " top" : ""));
      var h = el("div", "head"); h.appendChild(el("span", "label", e.destacada ? "Edición completa" : "Edición")); h.appendChild(el("h3", null, e.nombre)); t.appendChild(h);
      var pr = el("div", "price"); pr.appendChild(el("b", null, e.precio || "—")); if (e.precioAlt) pr.appendChild(el("span", null, e.precioAlt)); t.appendChild(pr);
      var ul = el("ul"); (e.incluye || []).forEach(function (x) { ul.appendChild(el("li", null, x)); }); t.appendChild(ul);
      var r = el("div", "row"); r.appendChild(chip(e.estado)); r.appendChild(srcLink(e.fuente, e.url)); t.appendChild(r);
      box.appendChild(t);
    });
  }
  function renderEdExtras(doc) {
    var box = clear("edExtras");
    ((doc && doc.extras) || []).forEach(function (f) {
      var d = el("div", "fact");
      d.appendChild(el("span", "label", f.etiqueta));
      d.appendChild(el("span", "v", f.valor));
      var r = el("div", "row"); r.appendChild(chip(f.estado)); r.appendChild(srcLink(f.fuente, f.url));
      d.appendChild(r); box.appendChild(d);
    });
  }

  var VERD = { "falso": "Falso", "cierto": "Cierto", "sin-confirmar": "Sin confirmar" };
  function monthLabel(m) {
    var d = new Date(m + "-15T12:00:00");
    return isNaN(d) ? "" : d.toLocaleString("es-ES", { month: "long", year: "numeric" });
  }
  function renderMyths(list) {
    lastMyths = list;
    var box = clear("myths");
    document.getElementById("micount").textContent = list.length ? list.length + " revisados" : "";
    if (!list.length) { box.appendChild(el("p", "empty", "Todavía no hay mitos guardados.")); return; }
    list.forEach(function (m) {
      var v = VERD[m.veredicto] ? m.veredicto : "sin-confirmar";
      var c = el("article", "myth"); c.id = "m-" + m._id;
      c.appendChild(el("span", "stamp " + v, VERD[v]));
      c.appendChild(el("q", null, m.afirmacion));
      if (m.explicacion) c.appendChild(el("p", null, m.explicacion));
      var r = el("div", "row");
      if (m.mes) r.appendChild(el("span", "cat", monthLabel(m.mes)));
      r.appendChild(srcLink(m.fuente, m.url));
      r.appendChild(shareBtn("m-" + m._id));
      c.appendChild(r);
      var nt = newTag("mitos", m._id); if (nt) c.appendChild(nt);
      box.appendChild(m.spoiler ? spoilWrap(c, "m:" + m._id) : c);
    });
    resolveHash();
  }

  function renderReviewMeta(doc) {
    doc = doc || {};
    var sm = document.getElementById("scMeta"), so = document.getElementById("scOpen");
    sm.textContent = doc.metacritic != null ? doc.metacritic : "TBD"; sm.classList.toggle("has", doc.metacritic != null);
    so.textContent = doc.opencritic != null ? doc.opencritic : "TBD"; so.classList.toggle("has", doc.opencritic != null);
    document.getElementById("reEmbargo").textContent = doc.embargo || "—";
    var note = clear("reNote");
    if (doc.nota) note.appendChild(document.createTextNode(doc.nota + " "));
    if (doc.url) note.appendChild(srcLink(doc.fuente, doc.url));
    document.getElementById("reChecked").textContent = doc.comprobado ? "Comprobado: " + fmtDate(doc.comprobado + "T12:00:00") : "";
  }
  function renderReviews(list) {
    var ul = clear("reviews");
    if (!list.length) { ul.appendChild(el("li", "empty", "Aún no hay reseñas. Aparecerán aquí cuando se levante el embargo.")); return; }
    list.forEach(function (rv) {
      var li = el("li", "item");
      li.appendChild(timeEl(rv.fecha));
      var body = el("div");
      var h = el("h3"); if (rv.nota) { h.appendChild(el("span", "grade", rv.nota)); h.appendChild(document.createTextNode(" · ")); } h.appendChild(document.createTextNode(rv.medio || "")); body.appendChild(h);
      if (rv.resumen) body.appendChild(el("p", null, rv.resumen));
      var r = el("div", "row");
      var nt = newTag("resenas", rv._id); if (nt) r.appendChild(nt);
      r.appendChild(srcLink(rv.medio ? "Leer en " + rv.medio : "Leer reseña", rv.url)); body.appendChild(r);
      li.appendChild(body); ul.appendChild(li);
    });
  }

  var CVAL = { pink: "#ff2e93", cyan: "#19e3ff", sun: "#ffd23f", orange: "#ff7a3d", green: "#3dffb0", red: "#ff6b5a", violet: "#9b7bff" };
  // Images: absolute https links or files inside img/ of this site (no "..").
  function safeImg(u) { return /^https?:\/\//.test(u || "") || /^img\/(?!.*\.\.)[a-z0-9\/._-]+$/i.test(u || ""); }
  function trackList(items, sub) {
    var ol = el("ol", "tracks");
    (items || []).forEach(function (t) {
      var li = el("li"), d = el("div");
      d.appendChild(el("b", null, t.titulo)); d.appendChild(el("span", null, t.artista + (sub && t[sub] ? " · " + t[sub] : "")));
      li.appendChild(d); ol.appendChild(li);
    });
    return ol;
  }

  // Listening only happens on Rockstar's own page: the portal links there and hosts no audio.
  function listenLink(url, text) {
    var a = el("a", "listen"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.appendChild(el("span", "pl")); a.setAttribute("aria-hidden", "false");
    a.appendChild(document.createTextNode(text + " ↗"));
    return a;
  }
  var musicCache = [], albumDoc = null;
  function renderStations(list) {
    musicCache = list;
    var box = clear("stations");
    document.getElementById("mucount").textContent = list.length ? list.length + " emisoras confirmadas" : "";
    if (!list.length) { box.appendChild(el("p", "empty", "Todavía no hay emisoras guardadas.")); return; }
    list.forEach(function (s) {
      var c = el("article", "station"); c.id = "r-" + s._id; c.tabIndex = 0;
      c.style.setProperty("--c", CVAL[s.color] || CVAL.pink);
      var cv = el("div", "cover");
      if (safeImg(s.fondo)) { var bg = el("img", "bg"); bg.src = s.fondo; bg.alt = ""; bg.loading = "lazy"; bg.decoding = "async"; cv.appendChild(bg); }
      if (safeImg(s.logo)) { var lg = el("img", "logo"); lg.src = s.logo; lg.alt = "Logo de " + s.nombre; lg.loading = "lazy"; lg.decoding = "async"; cv.appendChild(lg); }
      if (s.genero) cv.appendChild(el("span", "genre", s.genero));
      var eq = el("span", "eq"); eq.setAttribute("aria-hidden", "true"); for (var i = 0; i < 4; i++) eq.appendChild(el("i")); cv.appendChild(eq);
      var nt = newTag("musica", s._id); if (nt) { nt.style.cssText = "position:absolute;z-index:3;right:12px;top:12px"; cv.appendChild(nt); }
      c.appendChild(cv);
      var m = el("div", "meta");
      m.appendChild(el("h3", null, s.nombre));
      if (s.presentadores) { var h = el("div", "hosts"); h.appendChild(document.createTextNode("Con ")); h.appendChild(el("b", null, s.presentadores)); m.appendChild(h); }
      if (s.voces) m.appendChild(el("div", "voices", "Voces: " + s.voces + " (según la prensa)"));
      if (s.detalle) m.appendChild(el("p", null, s.detalle));
      if (s.temas && s.temas.length) { m.appendChild(el("span", "label", "Temas confirmados")); m.appendChild(trackList(s.temas)); }
      if (/^https:\/\/www\.rockstargames\.com\//.test(s.url || "")) m.appendChild(listenLink(s.url, "Escuchar adelanto en Rockstar"));
      var r = el("div", "row"); r.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:auto";
      r.appendChild(chip(s.estado)); r.appendChild(srcLink(s.fuente, s.url));
      m.appendChild(r);
      c.appendChild(m); box.appendChild(c);
    });
    resolveHash();
  }
  function renderAlbum(doc) {
    albumDoc = doc;
    var box = clear("album");
    if (!doc) { box.appendChild(el("p", "empty", "Todavía no hay datos de la banda sonora.")); return; }
    if (doc.intro) document.getElementById("muIntro").textContent = doc.intro;
    var a = doc.album || {};
    if (safeImg(a.portada)) { var im = el("img", "cover"); im.src = a.portada; im.alt = "Portada de " + (a.titulo || "el álbum"); im.loading = "lazy"; box.appendChild(im); }
    var info = el("div", "info");
    if (a.titulo) info.appendChild(el("h3", null, a.titulo));
    if (a.temas || a.fecha) info.appendChild(el("span", "label", [a.temas ? a.temas + " temas originales" : "", a.fecha ? "sale el " + fmtDate(a.fecha + "T12:00:00") : ""].filter(Boolean).join(" · ")));
    if (doc.score) {
      var sc = el("div", "score");
      sc.appendChild(el("b", null, "Música original: " + doc.score.artista));
      sc.appendChild(el("p", null, "«" + doc.score.titulo + "»" + (doc.score.con ? " con " + doc.score.con : "") + ". " + (doc.score.nota || "")));
      info.appendChild(sc);
    }
    if (a.sencillos && a.sencillos.length) { info.appendChild(el("span", "label", "Sencillos publicados")); info.appendChild(trackList(a.sencillos)); }
    if (/^https:\/\/www\.rockstargames\.com\//.test(doc.url || "")) info.appendChild(listenLink(doc.url, "Escuchar los sencillos en Rockstar"));
    if (doc.trailers && doc.trailers.length) { info.appendChild(el("span", "label", "Canciones de los tráilers")); info.appendChild(trackList(doc.trailers, "donde")); }
    var r = el("div", "row"); r.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:center";
    r.appendChild(chip("confirmado")); r.appendChild(srcLink(doc.fuente, doc.url));
    if (doc.urlVoces) r.appendChild(srcLink("Voces de los locutores: " + doc.fuenteVoces, doc.urlVoces));
    info.appendChild(r);
    box.appendChild(info);
    resolveHash();
  }

  var cronoCache = [];
  var TIPOS = { anuncio: 1, trailer: 1, fecha: 1, retraso: 1, filtracion: 1, lanzamiento: 1 };
  function renderTimeline(list) {
    cronoCache = list;
    var ol = clear("timeline");
    if (!list.length) { ol.appendChild(el("li", "empty", "Todavía no hay hitos guardados.")); return; }
    var year = null, now = Date.now();
    list.forEach(function (c) {
      var d = new Date(c.fecha + "T12:00:00"); if (isNaN(d)) return;
      if (d.getFullYear() !== year) { year = d.getFullYear(); var yl = el("li", "tl-year", String(year)); yl.setAttribute("aria-hidden", "true"); ol.appendChild(yl); }
      var tipo = TIPOS[c.tipo] ? c.tipo : "anuncio", future = d.getTime() > now;
      var li = el("li", "tl-item " + tipo + (future ? " future" : "")); li.id = "c-" + c._id;
      li.appendChild(el("span", "d", d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) + (future ? " · Próximamente" : "")));
      li.appendChild(el("h3", null, c.titulo));
      if (c.descripcion) li.appendChild(el("p", null, c.descripcion));
      var r = el("div", "row");
      var nt = newTag("cronologia", c._id); if (nt) r.appendChild(nt);
      r.appendChild(chip(c.estado)); r.appendChild(srcLink(c.fuente, c.url)); r.appendChild(shareBtn("c-" + c._id));
      li.appendChild(r);
      ol.appendChild(c.spoiler ? spoilWrap(li, "c:" + c._id) : li);
    });
    resolveHash();
  }

  // Search across everything the page has loaded.
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function searchIndex() {
    var out = [];
    function add(k, t, s, txt, go) { out.push({ k: k, t: t || "", s: s || "", n: norm(t), x: norm([t, s, txt].join(" ")), go: go }); }
    state.news.forEach(function (n) { add("Noticia", n.titulo, n.resumen, [n.categoria, n.fuente].join(" "), "n-" + n._id); });
    lastMyths.forEach(function (m) { add("Mito", m.afirmacion, m.explicacion, m.fuente, "m-" + m._id); });
    lastTrailers.forEach(function (t) { add("Tráiler", t.titulo, t.descripcion, t.canal, "t-" + t._id); });
    castCache.forEach(function (p) { add("Personaje", p.nombre, p.rol + " · " + (p.descripcion || ""), "", "pj-" + p._id); });
    musicCache.forEach(function (s) {
      add("Radio", s.nombre, s.genero + " · Con " + (s.presentadores || ""),
        [s.voces, s.detalle].concat((s.temas || []).map(function (t) { return t.artista + " " + t.titulo; })).join(" "), "r-" + s._id);
    });
    if (albumDoc && albumDoc.album) {
      var al = albumDoc.album;
      add("Banda sonora", al.titulo, "Música original de " + ((albumDoc.score || {}).artista || ""),
        (al.sencillos || []).concat(albumDoc.trailers || []).map(function (t) { return t.artista + " " + t.titulo; }).join(" "), "album");
    }
    cronoCache.forEach(function (c) { add("Cronología", c.titulo, c.descripcion, c.fecha, "c-" + c._id); });
    lastAgenda.forEach(function (e) { add("Agenda", e.titulo, e.descripcion, e.inicio, "a-" + e._id); });
    Object.keys(regions).forEach(function (id) { var r = regions[id]; add("Región", r.nombre, r.descripcion, [r.inspiracion].concat(r.destacados || []).join(" "), "reg:" + id); });
    return out;
  }
  var qIn = document.getElementById("q"), qRes = document.getElementById("qres"), qHits = [], qSel = -1;
  function hilite(parent, text, terms) {
    var t = String(text), nt = norm(t), last = 0, spans = [];
    terms.forEach(function (w) { var i = nt.indexOf(w); if (i >= 0) spans.push([i, i + w.length]); });
    spans.sort(function (a, b) { return a[0] - b[0]; });
    spans.forEach(function (s) {
      if (s[0] < last) return;
      parent.appendChild(document.createTextNode(t.slice(last, s[0])));
      parent.appendChild(el("mark", null, t.slice(s[0], s[1]))); last = s[1];
    });
    parent.appendChild(document.createTextNode(t.slice(last)));
  }
  function closeSearch() { qRes.hidden = true; qIn.setAttribute("aria-expanded", "false"); qSel = -1; }
  function goTo(go) {
    closeSearch(); qIn.value = ""; qIn.blur();
    if (go.indexOf("reg:") === 0) { showTab("leonida", true); selectRegion(go.slice(4)); focusEl(document.getElementById("regDetail")); return; }
    var x = document.getElementById(go);
    if (!x && go.indexOf("n-") === 0) { state.filter = "all"; renderFeed(); x = document.getElementById(go); }
    showTab(tabFor(go) || "resumen", false);
    if (x) focusEl(x);
  }
  function runSearch() {
    var q = norm(qIn.value).trim();
    if (q.length < 2) { closeSearch(); return; }
    var terms = q.split(/\s+/).filter(Boolean);
    qHits = searchIndex().filter(function (it) { return terms.every(function (w) { return it.x.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return (terms.every(function (w) { return b.n.indexOf(w) >= 0; }) ? 1 : 0) - (terms.every(function (w) { return a.n.indexOf(w) >= 0; }) ? 1 : 0); })
      .slice(0, 12);
    qRes.textContent = ""; qSel = -1;
    if (!qHits.length) { qRes.appendChild(el("li", "none", "Sin resultados para «" + qIn.value.trim() + "».")); }
    qHits.forEach(function (it, i) {
      var li = el("li"); li.setAttribute("role", "option"); li.id = "qopt-" + i;
      li.appendChild(el("span", "k", it.k));
      var t = el("span", "t"); hilite(t, it.t, terms);
      if (it.s) { var sm = el("small"); sm.textContent = it.s; t.appendChild(sm); }
      li.appendChild(t);
      li.addEventListener("mousedown", function (e) { e.preventDefault(); goTo(it.go); });
      qRes.appendChild(li);
    });
    qRes.hidden = false; qIn.setAttribute("aria-expanded", "true");
  }
  function moveSel(d) {
    if (!qHits.length) return;
    qSel = (qSel + d + qHits.length) % qHits.length;
    Array.prototype.forEach.call(qRes.children, function (li, i) { li.setAttribute("aria-selected", String(i === qSel)); if (i === qSel) li.scrollIntoView({ block: "nearest" }); });
    qIn.setAttribute("aria-activedescendant", "qopt-" + qSel);
  }
  var qTimer = 0;
  qIn.addEventListener("input", function () { clearTimeout(qTimer); qTimer = setTimeout(runSearch, 120); });
  qIn.addEventListener("focus", function () { if (qIn.value.trim().length >= 2) runSearch(); });
  qIn.addEventListener("blur", function () { setTimeout(closeSearch, 150); });
  qIn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); }
    else if (e.key === "Enter") { e.preventDefault(); var it = qHits[qSel >= 0 ? qSel : 0]; if (it) goTo(it.go); }
    else if (e.key === "Escape") { closeSearch(); }
  });

  Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.f === state.filter));
    b.addEventListener("click", function () {
      state.filter = b.dataset.f;
      try { localStorage.setItem("gta6-filter", state.filter); } catch (e) {}
      Array.prototype.forEach.call(document.querySelectorAll(".filters button"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      renderFeed();
    });
  });

  function loadError() {
    var upd = clear("upd"), retry = el("button", "more", "Reintentar");
    upd.appendChild(document.createTextNode("no disponible "));
    retry.type = "button"; retry.addEventListener("click", load); upd.appendChild(retry);
    var msg = "No se han podido cargar los datos. Prueba a recargar la página.";
    ["facts", "tapes", "cast", "regDetail", "tickets", "myths", "stations", "album"].forEach(function (id) { clear(id).appendChild(el("p", "empty", msg)); });
    ["feed", "latest", "reviews", "agenda", "timeline"].forEach(function (id) { clear(id).appendChild(el("li", "empty", msg)); });
  }

  var spoilBtn = document.getElementById("spoilToggle");
  spoilBtn.setAttribute("aria-pressed", String(noSpoil));
  spoilBtn.addEventListener("click", function () {
    noSpoil = !noSpoil; revealed = {};
    store("ln-nospoil", noSpoil);
    spoilBtn.setAttribute("aria-pressed", String(noSpoil));
    renderFeed(); renderTrailers(lastTrailers); renderMyths(lastMyths); renderTimeline(cronoCache);
  });

  // Data: one JSON file in the repository, read once per visit. Each collection keeps the order it had in claude.ai;
  // entries missing the sort field go last (some myths have no "mes").
  var ORDER = {
    noticias: ["fecha", -1], trailers: ["fecha", 1], agenda: ["inicio", 1], personajes: ["orden", 1], musica: ["orden", 1],
    cronologia: ["fecha", 1], regiones: ["orden", 1], ediciones: ["orden", 1], mitos: ["mes", -1], resenas: ["fecha", -1]
  };
  function rows(data, coll) {
    var key = ORDER[coll][0], dir = ORDER[coll][1];
    return (Array.isArray(data[coll]) ? data[coll] : []).map(function (x) { var o = Object.assign({}, x); o._id = x.id; return o; })
      .sort(function (a, b) {
        var x = a[key], y = b[key];
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
        return x < y ? -dir : x > y ? dir : 0;
      });
  }
  function tracked(data, coll) { var r = rows(data, coll); track(coll, r.map(function (x) { return x._id; })); return r; }
  function load() {
    document.getElementById("upd").textContent = "cargando…";
    fetch("data/data.json", { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      var est = data.estado || {};
      if (est.resumen) renderMeta(est.resumen); else renderFacts(null);
      state.news = tracked(data, "noticias"); renderFeed();
      renderTrailers(tracked(data, "trailers"));
      renderAgenda(tracked(data, "agenda"));
      renderCast(tracked(data, "personajes"));
      renderStations(tracked(data, "musica"));
      renderAlbum(est.musica || null);
      renderTimeline(tracked(data, "cronologia"));
      renderRegions(rows(data, "regiones"));
      renderEditions(rows(data, "ediciones"));
      renderEdExtras(est.ediciones || null);
      renderMyths(tracked(data, "mitos"));
      renderReviewMeta(est.resenas || null);
      renderReviews(tracked(data, "resenas"));
    }).catch(loadError);
  }
  load();
})();
