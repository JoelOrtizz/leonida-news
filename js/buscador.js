/* Global search: looks through everything the page has loaded (accent-insensitive) and jumps to the result. */
(function (LN) {
  var el = LN.el;
  var MAX_RESULTADOS = 12, MIN_LETRAS = 2;
  var qIn = document.getElementById("q"), qRes = document.getElementById("qres"), qHits = [], qSel = -1, qTimer = 0;

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function canciones(list) { return (list || []).map(function (t) { return t.artista + " " + t.titulo; }); }

  function indice() {
    var out = [], d = LN.datos;
    if (!d) return out;
    function add(k, t, s, txt, go) { out.push({ k: k, t: t || "", s: s || "", n: norm(t), x: norm([t, s, txt].join(" ")), go: go }); }
    d.noticias.forEach(function (n) { add("Noticia", n.titulo, n.resumen, [n.categoria, n.fuente].join(" "), "n-" + n._id); });
    d.mitos.forEach(function (m) { add("Mito", m.afirmacion, m.explicacion, m.fuente, "m-" + m._id); });
    d.trailers.forEach(function (t) { add("Tráiler", t.titulo, t.descripcion, t.canal, "t-" + t._id); });
    d.personajes.forEach(function (p) { add("Personaje", p.nombre, p.rol + " · " + (p.descripcion || ""), "", "pj-" + p._id); });
    d.musica.forEach(function (s) {
      add("Radio", s.nombre, s.genero + " · Con " + (s.presentadores || ""), [s.voces, s.detalle].concat(canciones(s.temas)).join(" "), "r-" + s._id);
    });
    var mus = d.estado.musica;
    if (mus && mus.album) {
      add("Banda sonora", mus.album.titulo, "Música original de " + ((mus.score || {}).artista || ""),
        canciones(mus.album.sencillos).concat(canciones(mus.trailers)).join(" "), "album");
    }
    d.cronologia.forEach(function (c) { add("Cronología", c.titulo, c.descripcion, c.fecha, "c-" + c._id); });
    d.agenda.forEach(function (e) { add("Agenda", e.titulo, e.descripcion, e.inicio, "a-" + e._id); });
    d.regiones.forEach(function (r) { add("Región", r.nombre, r.descripcion, [r.inspiracion].concat(r.destacados || []).join(" "), "reg:" + r._id); });
    return out;
  }

  // Wraps every search term found in the title in <mark>.
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

  function cerrar() { qRes.hidden = true; qIn.setAttribute("aria-expanded", "false"); qIn.removeAttribute("aria-activedescendant"); qSel = -1; }

  function irA(go) {
    cerrar(); qIn.value = ""; qIn.blur();
    if (go.indexOf("reg:") === 0) {
      LN.showTab("leonida", true); LN.seleccionarRegion(go.slice(4)); LN.focusEl(document.getElementById("regDetail"));
      return;
    }
    var x = document.getElementById(go);
    if (!x && go.indexOf("n-") === 0 && LN.revelarNoticia(go)) x = document.getElementById(go);
    LN.showTab(LN.tabFor(go) || "resumen", false);
    if (x) LN.focusEl(x);
  }

  function buscar() {
    var q = norm(qIn.value).trim();
    if (q.length < MIN_LETRAS) { cerrar(); return; }
    var terms = q.split(/\s+/).filter(Boolean);
    function enTitulo(it) { return terms.every(function (w) { return it.n.indexOf(w) >= 0; }) ? 1 : 0; }
    // Matches in the title first.
    qHits = indice().filter(function (it) { return terms.every(function (w) { return it.x.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return enTitulo(b) - enTitulo(a); })
      .slice(0, MAX_RESULTADOS);
    qRes.textContent = ""; qSel = -1;
    if (!qHits.length) qRes.appendChild(el("li", "none", "Sin resultados para «" + qIn.value.trim() + "»."));
    qHits.forEach(function (it, i) {
      var li = el("li"); li.setAttribute("role", "option"); li.id = "qopt-" + i;
      li.appendChild(el("span", "k", it.k));
      var t = el("span", "t"); hilite(t, it.t, terms);
      if (it.s) t.appendChild(el("small", null, it.s));
      li.appendChild(t);
      li.addEventListener("mousedown", function (e) { e.preventDefault(); irA(it.go); });
      qRes.appendChild(li);
    });
    qRes.hidden = false; qIn.setAttribute("aria-expanded", "true");
  }

  function mover(d) {
    if (!qHits.length) return;
    qSel = (qSel + d + qHits.length) % qHits.length;
    Array.prototype.forEach.call(qRes.children, function (li, i) {
      li.setAttribute("aria-selected", String(i === qSel));
      if (i === qSel) li.scrollIntoView({ block: "nearest" });
    });
    qIn.setAttribute("aria-activedescendant", "qopt-" + qSel);
  }

  qIn.addEventListener("input", function () { clearTimeout(qTimer); qTimer = setTimeout(buscar, 120); });
  qIn.addEventListener("focus", function () { if (qIn.value.trim().length >= MIN_LETRAS) buscar(); });
  qIn.addEventListener("blur", function () { setTimeout(cerrar, 150); });
  qIn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
    else if (e.key === "Enter") { e.preventDefault(); var it = qHits[qSel >= 0 ? qSel : 0]; if (it) irA(it.go); }
    else if (e.key === "Escape") cerrar();
  });
})(window.LN);
