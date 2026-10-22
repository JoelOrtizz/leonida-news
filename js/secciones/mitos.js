/* Myths tab: rumours about the game with a stamped verdict (false, true or unconfirmed). */
(function (LN) {
  var el = LN.el;
  var VEREDICTOS = { "falso": "Falso", "cierto": "Cierto", "sin-confirmar": "Sin confirmar" };

  function mes(m) {
    var d = new Date(m + "-15T12:00:00");
    return isNaN(d) ? "" : d.toLocaleString("es-ES", { month: "long", year: "numeric" });
  }

  function mito(m) {
    var v = VEREDICTOS[m.veredicto] ? m.veredicto : "sin-confirmar";
    var c = el("article", "myth"); c.id = "m-" + m._id;
    c.appendChild(el("span", "stamp " + v, VEREDICTOS[v]));
    c.appendChild(el("q", null, m.afirmacion));
    if (m.explicacion) c.appendChild(el("p", null, m.explicacion));
    var r = LN.fila();
    if (m.mes) r.appendChild(el("span", "cat", mes(m.mes)));
    r.appendChild(LN.srcLink(m.fuente, m.url));
    r.appendChild(LN.shareBtn("m-" + m._id));
    c.appendChild(r);
    var nt = LN.newTag("mitos", m._id); if (nt) c.appendChild(nt);
    return m.spoiler ? LN.spoilWrap(c, "m:" + m._id) : c;
  }

  LN.seccion("mitos", function (datos) {
    var box = LN.clear("myths");
    document.getElementById("micount").textContent = datos.mitos.length ? datos.mitos.length + " revisados" : "";
    if (!datos.mitos.length) { LN.vacio(box, "p", "Todavía no hay mitos guardados."); return; }
    datos.mitos.forEach(function (m) { box.appendChild(mito(m)); });
    LN.resolverHash();
  });
})(window.LN);
