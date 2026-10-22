/* Countdown to launch (shown above the tabs), last review time and the summary tab's fact sheet ("La ficha"). */
(function (LN) {
  var el = LN.el;
  // Until the data loads, count down to the announced date; renderMeta replaces it with lanzamientoISO.
  var lanzamiento = new Date(2026, 10, 19, 0, 0, 0);

  function pad(n) { return String(n).padStart(2, "0"); }
  function tick() {
    var s = Math.floor(Math.max(0, lanzamiento - new Date()) / 1000);
    document.getElementById("cd-d").textContent = Math.floor(s / 86400);
    document.getElementById("cd-h2").textContent = pad(Math.floor(s % 86400 / 3600));
    document.getElementById("cd-m").textContent = pad(Math.floor(s % 3600 / 60));
    document.getElementById("cd-s").textContent = pad(s % 60);
  }
  tick(); setInterval(tick, 1000);

  LN.seccion("resumen", function (datos) {
    var meta = datos.estado.resumen;
    var box = LN.clear("facts");
    if (!meta) { LN.vacio(box, "p", "La ficha aparecerá tras la primera revisión."); return; }
    if (meta.actualizado) document.getElementById("upd").textContent = LN.fmtDate(meta.actualizado, true);
    if (meta.lanzamientoTexto) document.getElementById("launchLbl").textContent = "Lanzamiento: " + meta.lanzamientoTexto;
    if (meta.lanzamientoISO) {
      var d = new Date(meta.lanzamientoISO + "T00:00:00");
      if (!isNaN(d)) { lanzamiento = d; tick(); }
    }
    var hechos = Array.isArray(meta.hechos) ? meta.hechos : [];
    if (!hechos.length) { LN.vacio(box, "p", "La ficha aparecerá tras la primera revisión."); return; }
    hechos.forEach(function (f) { box.appendChild(LN.factCard(f)); });
    LN.verMas(box);
  });
})(window.LN);
