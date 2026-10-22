/* Trailers tab: official videos as VHS tapes that open on YouTube. */
(function (LN) {
  var el = LN.el;

  function cinta(t, i) {
    var safe = LN.safeUrl(t.url);
    var a = safe ? LN.extLink(null, t.url, "tape") : el("div", "tape");
    a.id = "t-" + t._id;
    if (safe) a.setAttribute("aria-label", (t.titulo || "Tráiler") + " en YouTube");
    var sc = el("div", "screen");
    sc.appendChild(el("span", "num", t.numero || String(i + 1).padStart(2, "0")));
    sc.appendChild(el("span", "rec", "Play"));
    var pl = el("span", "play"); pl.setAttribute("aria-hidden", "true"); sc.appendChild(pl);
    if (t.duracion) sc.appendChild(el("span", "dur", t.duracion));
    var nt = LN.newTag("trailers", t._id); if (nt) sc.appendChild(nt);
    a.appendChild(sc);
    var m = el("div", "meta");
    m.appendChild(el("h3", null, t.titulo));
    m.appendChild(el("span", "label", LN.fmtDate((t.fecha || "") + "T12:00:00") + (t.canal ? " · " + t.canal : "")));
    if (t.descripcion) m.appendChild(el("p", null, t.descripcion));
    var r = LN.fila(); r.appendChild(LN.chip(t.estado));
    if (safe) r.appendChild(el("span", "yt", "Ver en YouTube ↗"));
    m.appendChild(r); a.appendChild(m);
    return t.spoiler ? LN.spoilWrap(a, "t:" + t._id) : a;
  }

  LN.seccion("trailers", function (datos) {
    var box = LN.clear("tapes");
    if (!datos.trailers.length) { LN.vacio(box, "p", "Todavía no hay tráilers guardados. Aparecerán tras la próxima revisión."); return; }
    datos.trailers.forEach(function (t, i) { box.appendChild(cinta(t, i)); });
    LN.resolverHash();
  });
})(window.LN);
