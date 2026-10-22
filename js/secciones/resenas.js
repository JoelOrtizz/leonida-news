/* Reviews tab: Metacritic / OpenCritic scores, review embargo and each outlet's review. */
(function (LN) {
  var el = LN.el;

  function puntuacion(id, valor) {
    var b = document.getElementById(id);
    b.textContent = valor != null ? valor : "TBD";
    b.classList.toggle("has", valor != null);
  }

  function pintarResumen(doc) {
    doc = doc || {};
    puntuacion("scMeta", doc.metacritic);
    puntuacion("scOpen", doc.opencritic);
    document.getElementById("reEmbargo").textContent = doc.embargo || "—";
    var note = LN.clear("reNote");
    if (doc.nota) note.appendChild(document.createTextNode(doc.nota + " "));
    if (doc.url) note.appendChild(LN.srcLink(doc.fuente, doc.url));
    document.getElementById("reChecked").textContent = doc.comprobado ? "Comprobado: " + LN.fmtDate(doc.comprobado + "T12:00:00") : "";
  }

  function resena(rv) {
    var li = el("li", "item");
    li.appendChild(LN.timeEl(rv.fecha));
    var body = el("div");
    var h = el("h3");
    if (rv.nota) { h.appendChild(el("span", "grade", rv.nota)); h.appendChild(document.createTextNode(" · ")); }
    h.appendChild(document.createTextNode(rv.medio || ""));
    body.appendChild(h);
    if (rv.resumen) body.appendChild(el("p", null, rv.resumen));
    var r = LN.fila();
    var nt = LN.newTag("resenas", rv._id); if (nt) r.appendChild(nt);
    r.appendChild(LN.srcLink(rv.medio ? "Leer en " + rv.medio : "Leer reseña", rv.url));
    body.appendChild(r); li.appendChild(body);
    return li;
  }

  LN.seccion("resenas", function (datos) {
    pintarResumen(datos.estado.resenas);
    var ul = LN.clear("reviews");
    if (!datos.resenas.length) { LN.vacio(ul, "li", "Aún no hay reseñas. Aparecerán aquí cuando se levante el embargo."); return; }
    datos.resenas.forEach(function (rv) { ul.appendChild(resena(rv)); });
  });
})(window.LN);
