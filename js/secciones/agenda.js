/* Upcoming dates (summary tab): relative day count, local time and "add to calendar" for Google, Outlook and .ics. */
(function (LN) {
  var el = LN.el;
  var DIA = 86400000, REPINTAR_CADA = 30 * 60 * 1000;

  function evDate(e) { return e.todoElDia ? new Date(e.inicio + "T00:00:00") : new Date(e.inicio); }
  function evEnd(e, d) {
    if (e.todoElDia) { var n = new Date(d); n.setDate(n.getDate() + 1); return n; }
    return e.fin ? new Date(e.fin) : new Date(d.getTime() + 3600000);
  }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
  function utcStamp(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function detalles(e) { return (e.descripcion || "") + (e.url ? "\n" + e.url : ""); }

  function calLinks(e, d) {
    var end = evEnd(e, d), det = detalles(e);
    var g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.titulo) +
      "&dates=" + (e.todoElDia ? ymd(d) + "/" + ymd(end) : utcStamp(d) + "/" + utcStamp(end)) + "&details=" + encodeURIComponent(det);
    var o = "https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=" + encodeURIComponent(e.titulo) +
      "&body=" + encodeURIComponent(det) +
      (e.todoElDia ? "&startdt=" + e.inicio + "&enddt=" + end.toISOString().slice(0, 10) + "&allday=true" : "&startdt=" + d.toISOString() + "&enddt=" + end.toISOString());
    return [["Google Calendar", g], ["Outlook", o]];
  }

  // "+ Mi calendario": builds an .ics file in the browser, for Apple Calendar and any other calendar app.
  function icsText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFold(line) {
    var out = [];
    while (line.length > 60) { out.push(line.slice(0, 60)); line = " " + line.slice(60); }
    out.push(line);
    return out.join("\r\n");
  }
  function icsButton(e, d) {
    var b = el("button", null, "+ Mi calendario"); b.type = "button";
    b.addEventListener("click", function () {
      var end = evEnd(e, d);
      var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Leonida News//ES", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
        "UID:" + e._id + "@leonida-news", "DTSTAMP:" + utcStamp(new Date()),
        e.todoElDia ? "DTSTART;VALUE=DATE:" + ymd(d) : "DTSTART:" + utcStamp(d),
        e.todoElDia ? "DTEND;VALUE=DATE:" + ymd(end) : "DTEND:" + utcStamp(end),
        "SUMMARY:" + icsText(e.titulo), "DESCRIPTION:" + icsText(detalles(e))];
      if (LN.safeUrl(e.url)) lines.push("URL:" + e.url);
      lines.push("END:VEVENT", "END:VCALENDAR");
      var url = URL.createObjectURL(new Blob([lines.map(icsFold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
      var a = el("a"); a.href = url; a.download = "leonida-news-" + e._id + ".ics";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    return b;
  }

  function relDays(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var n = Math.round((x - t) / DIA);
    return n === 0 ? "Hoy" : n === 1 ? "Mañana" : n > 1 ? "En " + n + " días" : n === -1 ? "Ayer" : "Hace " + (-n) + " días";
  }

  function evento(e, d, now) {
    var past = evEnd(e, d).getTime() < now;
    var li = el("li", "ev" + (e.destacado ? " top" : "") + (past ? " past" : "")); li.id = "a-" + e._id;
    var day = el("div", "day");
    day.appendChild(el("b", null, String(d.getDate())));
    day.appendChild(el("span", null, d.toLocaleString("es-ES", { month: "short" }).replace(".", "")));
    li.appendChild(day);
    var b = el("div", "body");
    b.appendChild(el("h3", null, e.titulo));
    var w = el("div", "when");
    var nt = LN.newTag("agenda", e._id); if (nt) w.appendChild(nt);
    w.appendChild(el("span", "rel", past ? "Ya pasó" : relDays(d)));
    w.appendChild(el("span", null, e.todoElDia
      ? d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      : d.toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " (tu hora)"));
    if (e.aproximada) w.appendChild(el("span", "approx", "Fecha estimada"));
    b.appendChild(w);
    if (e.descripcion) b.appendChild(el("p", null, e.descripcion));
    var r = LN.fila(); r.appendChild(LN.chip(e.estado)); r.appendChild(LN.srcLink(e.fuente, e.url));
    if (!past) {
      var cal = el("div", "cal");
      calLinks(e, d).forEach(function (c) { cal.appendChild(LN.extLink("+ " + c[0], c[1])); });
      cal.appendChild(icsButton(e, d));
      r.appendChild(cal);
    }
    b.appendChild(r); li.appendChild(b);
    return li;
  }

  // Past milestones stay visible (dimmed) for two days, then disappear.
  LN.seccion("agenda", function (datos) {
    var ol = LN.clear("agenda"), now = Date.now();
    var items = datos.agenda.map(function (e) { return { e: e, d: evDate(e) }; })
      .filter(function (x) { return !isNaN(x.d) && evEnd(x.e, x.d).getTime() > now - 2 * DIA; })
      .sort(function (a, b) { return a.d - b.d; });
    if (!items.length) { LN.vacio(ol, "li", "No hay fechas próximas guardadas."); return; }
    items.forEach(function (x) { ol.appendChild(evento(x.e, x.d, now)); });
    LN.resolverHash();
  });
  // Keeps "En N días" and past/future correct if the page stays open.
  setInterval(function () { LN.pintar("agenda"); }, REPINTAR_CADA);
})(window.LN);
