/* News tab: reliability filter and full feed, plus the three latest items shown in the summary ("Lo último"). */
(function (LN) {
  var el = LN.el;
  var CLAVE = "gta6-filter"; // stored as a plain string (not JSON) since the claude.ai version: keep it readable
  var filtro = "all";
  try { filtro = localStorage.getItem(CLAVE) || "all"; } catch (e) {}
  var botones = Array.prototype.slice.call(document.querySelectorAll(".filters button"));

  function item(n, conEnlace) {
    var li = el("li", "item");
    if (conEnlace) li.id = "n-" + n._id;
    li.appendChild(LN.timeEl(n.fecha));
    var body = el("div");
    body.appendChild(el("h3", null, n.titulo));
    if (n.resumen) body.appendChild(el("p", null, n.resumen));
    var r = LN.fila();
    var nt = LN.newTag("noticias", n._id); if (nt) r.appendChild(nt);
    r.appendChild(LN.chip(n.estado));
    if (n.categoria) r.appendChild(el("span", "cat", n.categoria));
    r.appendChild(LN.srcLink(n.fuente, n.url));
    if (conEnlace) r.appendChild(LN.shareBtn("n-" + n._id));
    body.appendChild(r); li.appendChild(body);
    return n.spoiler ? LN.spoilWrap(li, "n:" + n._id) : li;
  }

  function marcarBotones() { botones.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.f === filtro)); }); }

  LN.seccion("noticias", function (datos) {
    var news = datos.noticias;
    var latest = LN.clear("latest");
    if (!news.length) LN.vacio(latest, "li", "Todavía no hay noticias guardadas.");
    news.slice(0, 3).forEach(function (n) { latest.appendChild(item(n, false)); });

    var ul = LN.clear("feed");
    var list = news.filter(function (n) { return filtro === "all" || n.estado === filtro; });
    document.getElementById("ncount").textContent = news.length ? news.length + " entradas" : "";
    if (!list.length) {
      LN.vacio(ul, "li", news.length ? "No hay entradas con este filtro." : "Todavía no hay noticias guardadas. Aparecerán tras la próxima revisión.");
      return;
    }
    list.forEach(function (n) { ul.appendChild(item(n, true)); });
    LN.resolverHash();
  });

  // A deep link or search result may point to a news item hidden by the filter: clear the filter and redraw.
  // Returns true when it had to do so.
  LN.revelarNoticia = function (token) {
    var existe = LN.datos && LN.datos.noticias.some(function (n) { return "n-" + n._id === token; });
    if (filtro === "all" || !existe) return false;
    filtro = "all"; marcarBotones(); LN.pintar("noticias");
    return true;
  };

  marcarBotones();
  botones.forEach(function (b) {
    b.addEventListener("click", function () {
      filtro = b.dataset.f;
      try { localStorage.setItem(CLAVE, filtro); } catch (e) {}
      marcarBotones(); LN.pintar("noticias");
    });
  });
})(window.LN);
