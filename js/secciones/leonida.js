/* Leonida tab: schematic map of the state; tapping a region (on the map or its chip) shows its details. */
(function (LN) {
  var el = LN.el;
  // Same colours as the regions in the SVG map (estilos.css, .reg[data-region=…]).
  var REGCOLOR = { "port-gellhorn": "#ff7a3d", "mount-kalaga": "#9b7bff", "ambrosia": "#ffd23f", "grassrivers": "#3dffb0", "vice-city": "#ff2e93", "leonida-keys": "#19e3ff" };
  var regiones = {}, activa = "vice-city";

  LN.seleccionarRegion = function (id) {
    if (!regiones[id]) return;
    activa = id;
    var r = regiones[id], d = LN.clear("regDetail");
    d.style.setProperty("--c", REGCOLOR[id] || LN.COLORES.pink);
    d.appendChild(el("h3", null, r.nombre));
    if (r.inspiracion) d.appendChild(el("span", "insp", "Inspiración: " + r.inspiracion));
    if (r.descripcion) d.appendChild(el("p", null, r.descripcion));
    if (Array.isArray(r.destacados) && r.destacados.length) {
      var t = el("div", "tags"); r.destacados.forEach(function (x) { t.appendChild(el("span", null, x)); }); d.appendChild(t);
    }
    var row = LN.fila(); row.appendChild(LN.chip(r.estado)); row.appendChild(LN.srcLink(r.fuente, r.url)); d.appendChild(row);
    Array.prototype.forEach.call(document.querySelectorAll("#leoMap .reg"), function (p) { p.classList.toggle("on", p.dataset.region === id); });
    Array.prototype.forEach.call(document.querySelectorAll("#regChips button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.region === id)); });
  };

  LN.seccion("leonida", function (datos) {
    var list = datos.regiones;
    regiones = {};
    list.forEach(function (r) { regiones[r._id] = r; });
    var chips = LN.clear("regChips");
    list.forEach(function (r) {
      var b = el("button", null, r.nombre); b.type = "button"; b.dataset.region = r._id;
      b.style.setProperty("--c", REGCOLOR[r._id] || LN.COLORES.pink);
      b.addEventListener("click", function () { LN.seleccionarRegion(r._id); });
      chips.appendChild(b);
    });
    if (!list.length) { LN.vacio(LN.clear("regDetail"), "p", "Todavía no hay regiones guardadas."); return; }
    LN.seleccionarRegion(regiones[activa] ? activa : list[0]._id);
  });

  Array.prototype.forEach.call(document.querySelectorAll("#leoMap .reg"), function (p) {
    p.addEventListener("click", function () { LN.seleccionarRegion(p.dataset.region); });
    p.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); LN.seleccionarRegion(p.dataset.region); }
    });
  });
})(window.LN);
