/* Characters tab: official portraits as neon postcards (initials are shown if a portrait is missing or fails to load). */
(function (LN) {
  var el = LN.el;

  function initials(name) {
    return String(name || "?").replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ' ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join("").toUpperCase();
  }

  function postal(p) {
    var c = el("article", "pcard c-" + (LN.COLORES[p.color] ? p.color : "pink")); c.id = "pj-" + p._id;
    c.tabIndex = 0;
    var art = el("div", "art");
    if (LN.safeImg(p.imagen)) {
      var im = el("img", "portrait"); im.src = p.imagen; im.alt = "Retrato oficial de " + p.nombre; im.loading = "lazy"; im.decoding = "async";
      im.onerror = function () { im.remove(); art.classList.remove("has-img"); };
      art.classList.add("has-img"); art.appendChild(im);
    }
    art.appendChild(el("span", "ini", initials(p.nombre)));
    if (p.rol) art.appendChild(el("span", "role", p.rol));
    var nt = LN.newTag("personajes", p._id); if (nt) art.appendChild(nt);
    c.appendChild(art);
    var m = el("div", "meta");
    m.appendChild(el("h3", null, p.nombre));
    if (p.descripcion) m.appendChild(el("p", null, p.descripcion));
    m.appendChild(LN.srcLink(p.fuente, p.url));
    c.appendChild(m);
    return c;
  }

  LN.seccion("personajes", function (datos) {
    var box = LN.clear("cast");
    if (!datos.personajes.length) { LN.vacio(box, "p", "Todavía no hay personajes guardados."); return; }
    datos.personajes.forEach(function (p) { box.appendChild(postal(p)); });
    LN.verMas(box);
    LN.resolverHash();
  });
})(window.LN);
