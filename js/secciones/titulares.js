/* "Al minuto" block in the News tab: headlines collected automatically (scripts/actualizar.js → data/titulares.json),
   shown as they are, with outlet and link, and kept apart from the curated news. */
(function (LN) {
  var el = LN.el;
  var TIPOS = { video: "Vídeo", comunicado: "Comunicado" };

  function item(t) {
    var li = el("li", "item titular");
    li.appendChild(LN.timeEl(t.fecha.slice(0, 10)));
    var body = el("div");
    var h = el("h3");
    h.appendChild(LN.extLink(t.titulo, t.url));
    body.appendChild(h);
    var r = LN.fila();
    var nt = LN.newTag("titulares", t._id); if (nt) r.appendChild(nt);
    if (t.oficial) r.appendChild(el("span", "chip confirmado", "Oficial"));
    if (TIPOS[t.tipo]) r.appendChild(el("span", "cat", TIPOS[t.tipo]));
    r.appendChild(el("span", "src", t.fuente));
    body.appendChild(r); li.appendChild(body);
    return t.spoiler ? LN.spoilWrap(li, "t:" + t._id) : li;
  }

  LN.seccion("titulares", function (datos) {
    var lista = datos.titulares.filter(function (t) { return LN.safeUrl(t.url); });
    var ul = LN.clear("titulares");
    document.getElementById("tcount").textContent = lista.length ? lista.length + " titulares" : "";
    if (!lista.length) LN.vacio(ul, "li", "Todavía no hay titulares. La próxima recogida es a las 08:30, 17:30 o 23:30 (hora peninsular española).");
    lista.forEach(function (t) { ul.appendChild(item(t)); });
    LN.verMas(ul);
  });
})(window.LN);
