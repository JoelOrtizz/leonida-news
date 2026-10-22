/* Leonida News core: the shared LN namespace, the section registry and the small DOM helpers every section reuses. */
(function () {
  var LN = window.LN = {};
  var ESTADOS = { confirmado: "Confirmado", reportado: "Reportado", rumor: "Rumor" };

  // Sections register a paint function; app.js fills LN.datos from data/data.json and paints them all.
  LN.datos = null;
  LN.secciones = {};
  LN.seccion = function (nombre, pintar) { LN.secciones[nombre] = pintar; };
  LN.pintar = function (nombre) { if (LN.datos && LN.secciones[nombre]) LN.secciones[nombre](LN.datos); };
  // While everything is being painted, deep links wait: a later section could otherwise redraw the entry just highlighted.
  var pintandoTodo = false;
  LN.pintandoTodo = function () { return pintandoTodo; };
  LN.pintarTodo = function () {
    pintandoTodo = true;
    try { Object.keys(LN.secciones).forEach(LN.pintar); } finally { pintandoTodo = false; }
    if (LN.resolverHash) LN.resolverHash();
  };

  LN.REDUCE = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Neon palette for colours that come from the data ("color": "pink"…); same values as the c-* classes in estilos.css.
  LN.COLORES = { pink: "#ff2e93", cyan: "#19e3ff", sun: "#ffd23f", orange: "#ff7a3d", green: "#3dffb0", red: "#ff6b5a", violet: "#9b7bff" };

  LN.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  LN.clear = function (id) { var b = document.getElementById(id); b.textContent = ""; return b; };
  LN.vacio = function (box, tag, msg) { box.appendChild(LN.el(tag, "empty", msg)); };

  LN.fmtDate = function (iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "";
    var o = { day: "numeric", month: "short", year: "numeric" };
    if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; }
    return d.toLocaleString("es-ES", o);
  };
  LN.timeEl = function (fecha) {
    var t = LN.el("time"); t.dateTime = fecha || "";
    var d = new Date((fecha || "") + "T12:00:00");
    if (isNaN(d)) { t.textContent = fecha || ""; return t; }
    t.textContent = d.getDate() + " " + d.toLocaleString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
    t.appendChild(LN.el("small", null, String(d.getFullYear())));
    return t;
  };

  // Reliability badge: confirmado / reportado / rumor (anything unknown is shown as a rumour).
  LN.chip = function (estado) { var k = ESTADOS[estado] ? estado : "rumor"; return LN.el("span", "chip " + k, ESTADOS[k]); };

  // Links and images taken from the data are only used when they are safe.
  LN.safeUrl = function (u) { return /^https?:\/\//.test(u || ""); };
  LN.safeImg = function (u) { return LN.safeUrl(u) || /^img\/(?!.*\.\.)[a-z0-9\/._-]+$/i.test(u || ""); };
  LN.extLink = function (text, url, cls) {
    var a = LN.el("a", cls, text); a.href = url; a.target = "_blank"; a.rel = "noopener";
    return a;
  };
  LN.srcLink = function (name, url) {
    var s = LN.el("span", "src");
    if (LN.safeUrl(url)) s.appendChild(LN.extLink(name || "Fuente", url));
    else s.textContent = name || "";
    return s;
  };
  LN.fila = function (cls) { return LN.el("div", "row" + (cls ? " " + cls : "")); };

  // Fact tile (label, value, reliability and source): used by the summary sheet and the editions extras.
  LN.factCard = function (f) {
    var d = LN.el("div", "fact");
    d.appendChild(LN.el("span", "label", f.etiqueta));
    d.appendChild(LN.el("span", "v", f.valor));
    var r = LN.fila(); r.appendChild(LN.chip(f.estado)); r.appendChild(LN.srcLink(f.fuente, f.url));
    d.appendChild(r);
    return d;
  };

  // Per-viewer memory in this browser. Storage can be unavailable (private mode): reads then return null.
  LN.store = function (k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k));
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  };
})();
