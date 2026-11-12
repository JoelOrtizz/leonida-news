/* Header notice: the headlines are collected at 08:30, 17:30 and 23:30 in Spain all year
   (see .github/workflows/actualizar.yml); if the visitor is in another time zone, also show those times in theirs. */
(function () {
  var local = document.getElementById("avisoLocal");
  if (!local) return;
  var HORAS = ["08:30", "17:30", "23:30"];
  var formato = { hour: "2-digit", minute: "2-digit" };
  var madrid = Object.assign({ timeZone: "Europe/Madrid" }, formato);

  // Today's instant for a Madrid time: Madrid is UTC+1 or UTC+2, so try both and keep the one that matches.
  function instante(hhmm) {
    var p = hhmm.split(":"), d = new Date();
    for (var desfase = 1; desfase <= 2; desfase++) {
      d.setUTCHours(+p[0] - desfase, +p[1], 0, 0);
      if (d.toLocaleTimeString("es-ES", madrid) === hhmm) return d;
    }
    return null;
  }

  var enTuZona = HORAS.map(function (h) { var d = instante(h); return d ? d.toLocaleTimeString("es-ES", formato) : h; });
  if (enTuZona.join() === HORAS.join()) return;
  local.textContent = " (en tu zona horaria: " + enTuZona[0] + ", " + enTuZona[1] + " y " + enTuZona[2] + ")";
})();
