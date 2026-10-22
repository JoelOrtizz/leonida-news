/* "Nuevo desde tu visita": remembers in this browser which entries were already seen and badges the tabs that have new ones. */
(function (LN) {
  var el = LN.el;
  var CLAVE = "ln-seen-v1", MAX_IDS = 1000;
  var seen = LN.store(CLAVE) || {}, fresh = {}, timer = 0;
  // Collections shown in each tab.
  var TAB_COLLS = {
    resumen: ["agenda"], noticias: ["noticias"], trailers: ["trailers"], personajes: ["personajes"], musica: ["musica"],
    cronologia: ["cronologia"], mitos: ["mitos"], resenas: ["resenas"]
  };
  LN.pestanaActual = "resumen";

  function unseen(coll) {
    var f = fresh[coll] || {}, s = seen[coll] || [];
    return Object.keys(f).filter(function (id) { return s.indexOf(id) < 0; }).length;
  }
  function updateBadges() {
    Array.prototype.forEach.call(document.querySelectorAll(".tabbar button"), function (b) {
      var n = (TAB_COLLS[b.dataset.tab] || []).reduce(function (t, c) { return t + unseen(c); }, 0);
      var badge = b.querySelector(".badge");
      if (!n) { if (badge) badge.remove(); return; }
      if (!badge) { badge = el("span", "badge"); b.appendChild(badge); }
      badge.textContent = n; badge.setAttribute("aria-label", n + (n === 1 ? " nueva" : " nuevas"));
    });
  }

  // After a short stay on a tab, its new entries count as seen.
  LN.marcarVisto = function (tab) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      (TAB_COLLS[tab] || []).forEach(function (c) {
        seen[c] = seen[c] || [];
        Object.keys(fresh[c] || {}).forEach(function (id) { if (seen[c].indexOf(id) < 0) seen[c].push(id); });
        if (seen[c].length > MAX_IDS) seen[c] = seen[c].slice(-MAX_IDS);
      });
      LN.store(CLAVE, seen); updateBadges();
    }, 1500);
  };

  // On the first visit everything counts as seen; afterwards, ids not stored yet are new.
  LN.track = function (coll, ids) {
    if (!Array.isArray(seen[coll])) { seen[coll] = ids.slice(); LN.store(CLAVE, seen); fresh[coll] = {}; }
    else { fresh[coll] = fresh[coll] || {}; ids.forEach(function (id) { if (seen[coll].indexOf(id) < 0) fresh[coll][id] = true; }); }
    updateBadges();
    if ((TAB_COLLS[LN.pestanaActual] || []).indexOf(coll) >= 0) LN.marcarVisto(LN.pestanaActual);
  };

  LN.newTag = function (coll, id) { return fresh[coll] && fresh[coll][id] ? el("span", "new-tag", "Nuevo") : null; };
})(window.LN);
