/* Timeline tab: major milestones from 2022 to launch, grouped by year and coloured by type. */
(function (LN) {
  var el = LN.el;
  var TIPOS = { anuncio: 1, trailer: 1, fecha: 1, retraso: 1, filtracion: 1, lanzamiento: 1 };

  function hito(c, d, now) {
    var tipo = TIPOS[c.tipo] ? c.tipo : "anuncio", future = d.getTime() > now;
    var li = el("li", "tl-item " + tipo + (future ? " future" : "")); li.id = "c-" + c._id;
    li.appendChild(el("span", "d", d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) + (future ? " · Próximamente" : "")));
    li.appendChild(el("h3", null, c.titulo));
    if (c.descripcion) li.appendChild(el("p", null, c.descripcion));
    var r = LN.fila();
    var nt = LN.newTag("cronologia", c._id); if (nt) r.appendChild(nt);
    r.appendChild(LN.chip(c.estado)); r.appendChild(LN.srcLink(c.fuente, c.url)); r.appendChild(LN.shareBtn("c-" + c._id));
    li.appendChild(r);
    return c.spoiler ? LN.spoilWrap(li, "c:" + c._id) : li;
  }

  LN.seccion("cronologia", function (datos) {
    var ol = LN.clear("timeline");
    if (!datos.cronologia.length) { LN.vacio(ol, "li", "Todavía no hay hitos guardados."); return; }
    var year = null, now = Date.now();
    datos.cronologia.forEach(function (c) {
      var d = new Date(c.fecha + "T12:00:00"); if (isNaN(d)) return;
      if (d.getFullYear() !== year) {
        year = d.getFullYear();
        var yl = el("li", "tl-year", String(year)); yl.setAttribute("aria-hidden", "true"); ol.appendChild(yl);
      }
      ol.appendChild(hito(c, d, now));
    });
    LN.resolverHash();
  });
})(window.LN);
