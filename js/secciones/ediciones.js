/* Editions tab: each edition as an admission ticket, plus extra facts (pre-order bonus, pre-load, physical copy…). */
(function (LN) {
  var el = LN.el;

  function ticket(e) {
    var t = el("article", "ticket" + (e.destacada ? " top" : ""));
    var h = el("div", "head");
    h.appendChild(el("span", "label", e.destacada ? "Edición completa" : "Edición")); h.appendChild(el("h3", null, e.nombre));
    t.appendChild(h);
    var pr = el("div", "price"); pr.appendChild(el("b", null, e.precio || "—")); if (e.precioAlt) pr.appendChild(el("span", null, e.precioAlt));
    t.appendChild(pr);
    var ul = el("ul"); (e.incluye || []).forEach(function (x) { ul.appendChild(el("li", null, x)); });
    t.appendChild(ul);
    var r = LN.fila(); r.appendChild(LN.chip(e.estado)); r.appendChild(LN.srcLink(e.fuente, e.url));
    t.appendChild(r);
    return t;
  }

  LN.seccion("ediciones", function (datos) {
    var box = LN.clear("tickets");
    if (!datos.ediciones.length) LN.vacio(box, "p", "Todavía no hay ediciones guardadas.");
    datos.ediciones.forEach(function (e) { box.appendChild(ticket(e)); });
    var extras = LN.clear("edExtras");
    ((datos.estado.ediciones || {}).extras || []).forEach(function (f) { extras.appendChild(LN.factCard(f)); });
  });
})(window.LN);
