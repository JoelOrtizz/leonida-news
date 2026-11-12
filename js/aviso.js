/* Daily review notice: the scheduled run starts from 23:00 in Spain all year (see .github/workflows/actualizar.yml);
   if the visitor is in another time zone, also show that time in theirs. */
(function () {
  var local = document.getElementById("avisoLocal");
  if (!local) return;
  var formato = { hour: "2-digit", minute: "2-digit" };

  // 23:00 in Madrid is 21:00 UTC in summer and 22:00 UTC in winter: take the one that matches today.
  var d = new Date();
  for (var h = 21; h <= 22; h++) {
    d.setUTCHours(h, 0, 0, 0);
    if (d.toLocaleTimeString("es-ES", Object.assign({ timeZone: "Europe/Madrid" }, formato)) === "23:00") break;
  }
  var enTuZona = d.toLocaleTimeString("es-ES", formato);
  if (enTuZona !== "23:00") local.textContent = " (a partir de las " + enTuZona + " en tu zona horaria)";
})();

/* Launch week: extra runs at 08:30 and 17:30 in Spain from 16 to 22 Nov 2026. The note is shown until the
   end of 22 Nov in Madrid (23:00 UTC, CET) and then disappears on its own. */
(function () {
  var lanzamiento = document.getElementById("avisoLanzamiento");
  var FIN = Date.UTC(2026, 10, 22, 23, 0, 0);
  if (lanzamiento && Date.now() < FIN) lanzamiento.hidden = false;
})();
