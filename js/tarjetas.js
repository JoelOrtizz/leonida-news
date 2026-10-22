/* Tapping a card keeps it "active" (the same lift and glow as on mouse hover), which touch screens otherwise lack.
   Only one card is active at a time; tapping it again, tapping outside or pressing Escape releases it. */
(function () {
  var TARJETAS = ".pcard, .station, .fact, .ev, .myth, .tl-item, .ticket";
  // Clicks on links and controls inside a card do their own thing and do not toggle it.
  var CONTROLES = "a, button, input, select, textarea, label, summary";
  var activa = null;

  function soltar() { if (activa) { activa.classList.remove("activa"); activa = null; } }

  document.addEventListener("click", function (e) {
    var t = e.target.closest(TARJETAS);
    if (t && e.target.closest(CONTROLES)) return;
    if (!t || t === activa) { soltar(); return; }
    soltar();
    activa = t; t.classList.add("activa");
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") soltar(); });
})();
