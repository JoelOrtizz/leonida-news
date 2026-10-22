/* Daily review notice: the scheduled run is at 23:00 in Spain all year (see .github/workflows/actualizar.yml);
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
  if (enTuZona !== "23:00") local.textContent = " (las " + enTuZona + " en tu zona horaria)";
})();
