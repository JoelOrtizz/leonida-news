/* Deep links: every entry can be shared as this page's address plus #token, and opening such a link jumps to it. */
(function (LN) {
  var el = LN.el;
  var BASE_URL = location.origin + location.pathname;
  // Token prefix → tab that contains the entry.
  var TOKEN_TAB = [["pj-", "personajes"], ["n-", "noticias"], ["m-", "mitos"], ["t-", "trailers"], ["r-", "musica"], ["c-", "cronologia"], ["a-", "resumen"]];

  LN.tabFor = function (token) {
    if (token === "album") return "musica";
    for (var i = 0; i < TOKEN_TAB.length; i++) if (token.indexOf(TOKEN_TAB[i][0]) === 0) return TOKEN_TAB[i][1];
    return null;
  };

  LN.shareBtn = function (token) {
    var b = el("button", "share", "Copiar enlace"); b.type = "button";
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var url = BASE_URL + "#" + token;
      function ok() {
        b.textContent = "Copiado ✓"; b.classList.add("ok");
        setTimeout(function () { b.textContent = "Copiar enlace"; b.classList.remove("ok"); }, 2000);
      }
      // Without clipboard access, show the link in a field ready to copy.
      function fallback() {
        if (b.nextSibling && b.nextSibling.className === "copybox") return;
        var box = el("span", "copybox"), inp = el("input");
        inp.value = url; inp.readOnly = true; inp.setAttribute("aria-label", "Enlace para copiar");
        box.appendChild(inp); b.parentNode.insertBefore(box, b.nextSibling); inp.focus(); inp.select();
      }
      try { navigator.clipboard.writeText(url).then(ok, fallback); } catch (err) { fallback(); }
    });
    return b;
  };

  LN.focusEl = function (x) {
    setTimeout(function () {
      x.scrollIntoView({ behavior: LN.REDUCE ? "auto" : "smooth", block: "center" });
      x.classList.remove("hl"); void x.offsetWidth; x.classList.add("hl");
    }, 80);
  };

  var pendiente = (location.hash || "").slice(1);
  if (pendiente && LN.tabFor(pendiente)) { try { history.scrollRestoration = "manual"; } catch (e) {} }

  // Sections call this after drawing: once the linked entry exists, open its tab and highlight it.
  LN.resolverHash = function () {
    if (!pendiente || LN.pintandoTodo()) return;
    var tab = LN.tabFor(pendiente);
    if (!tab) { pendiente = ""; return; }
    var x = document.getElementById(pendiente);
    if (!x && tab === "noticias" && LN.revelarNoticia(pendiente)) return;
    if (!x) return;
    pendiente = "";
    LN.showTab(tab, false); LN.focusEl(x);
    setTimeout(function () {
      var r = x.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) x.scrollIntoView({ block: "center" });
    }, 900);
  };
})(window.LN);
