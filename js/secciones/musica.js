/* Music tab: radio stations and the soundtrack. Listening only happens on Rockstar's own page: the portal hosts no audio. */
(function (LN) {
  var el = LN.el;
  var ROCKSTAR = /^https:\/\/www\.rockstargames\.com\//;

  function trackList(items, sub) {
    var ol = el("ol", "tracks");
    (items || []).forEach(function (t) {
      var li = el("li"), d = el("div");
      d.appendChild(el("b", null, t.titulo)); d.appendChild(el("span", null, t.artista + (sub && t[sub] ? " · " + t[sub] : "")));
      li.appendChild(d); ol.appendChild(li);
    });
    return ol;
  }
  function listenLink(url, text) {
    var a = LN.extLink(null, url, "listen");
    var pl = el("span", "pl"); pl.setAttribute("aria-hidden", "true");
    a.appendChild(pl); a.appendChild(document.createTextNode(text + " ↗"));
    return a;
  }
  function img(cls, src, alt) {
    var i = el("img", cls); i.src = src; i.alt = alt; i.loading = "lazy"; i.decoding = "async";
    return i;
  }

  function emisora(s) {
    var c = el("article", "station"); c.id = "r-" + s._id; c.tabIndex = 0;
    c.style.setProperty("--c", LN.COLORES[s.color] || LN.COLORES.pink);
    var cv = el("div", "cover");
    if (LN.safeImg(s.fondo)) cv.appendChild(img("bg", s.fondo, ""));
    if (LN.safeImg(s.logo)) cv.appendChild(img("logo", s.logo, "Logo de " + s.nombre));
    if (s.genero) cv.appendChild(el("span", "genre", s.genero));
    var eq = el("span", "eq"); eq.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 4; i++) eq.appendChild(el("i"));
    cv.appendChild(eq);
    var nt = LN.newTag("musica", s._id); if (nt) cv.appendChild(nt);
    c.appendChild(cv);
    var m = el("div", "meta");
    m.appendChild(el("h3", null, s.nombre));
    if (s.presentadores) {
      var h = el("div", "hosts"); h.appendChild(document.createTextNode("Con ")); h.appendChild(el("b", null, s.presentadores)); m.appendChild(h);
    }
    if (s.voces) m.appendChild(el("div", "voices", "Voces: " + s.voces + " (según la prensa)"));
    if (s.detalle) m.appendChild(el("p", null, s.detalle));
    if (s.temas && s.temas.length) { m.appendChild(el("span", "label", "Temas confirmados")); m.appendChild(trackList(s.temas)); }
    if (ROCKSTAR.test(s.url || "")) m.appendChild(listenLink(s.url, "Escuchar adelanto en Rockstar"));
    var r = LN.fila(); r.appendChild(LN.chip(s.estado)); r.appendChild(LN.srcLink(s.fuente, s.url));
    m.appendChild(r);
    c.appendChild(m);
    return c;
  }

  function pintarEmisoras(list) {
    var box = LN.clear("stations");
    document.getElementById("mucount").textContent = list.length ? list.length + " emisoras confirmadas" : "";
    if (!list.length) { LN.vacio(box, "p", "Todavía no hay emisoras guardadas."); return; }
    list.forEach(function (s) { box.appendChild(emisora(s)); });
    LN.verMas(box);
  }

  function pintarAlbum(doc) {
    var box = LN.clear("album");
    if (!doc) { LN.vacio(box, "p", "Todavía no hay datos de la banda sonora."); return; }
    if (doc.intro) document.getElementById("muIntro").textContent = doc.intro;
    var a = doc.album || {};
    if (LN.safeImg(a.portada)) box.appendChild(img("cover", a.portada, "Portada de " + (a.titulo || "el álbum")));
    var info = el("div", "info");
    if (a.titulo) info.appendChild(el("h3", null, a.titulo));
    var sub = [a.temas ? a.temas + " temas originales" : "", a.fecha ? "sale el " + LN.fmtDate(a.fecha + "T12:00:00") : ""].filter(Boolean).join(" · ");
    if (sub) info.appendChild(el("span", "label", sub));
    if (doc.score) {
      var sc = el("div", "score");
      sc.appendChild(el("b", null, "Música original: " + doc.score.artista));
      sc.appendChild(el("p", null, "«" + doc.score.titulo + "»" + (doc.score.con ? " con " + doc.score.con : "") + ". " + (doc.score.nota || "")));
      info.appendChild(sc);
    }
    if (a.sencillos && a.sencillos.length) { info.appendChild(el("span", "label", "Sencillos publicados")); info.appendChild(trackList(a.sencillos)); }
    if (ROCKSTAR.test(doc.url || "")) info.appendChild(listenLink(doc.url, "Escuchar los sencillos en Rockstar"));
    if (doc.trailers && doc.trailers.length) { info.appendChild(el("span", "label", "Canciones de los tráilers")); info.appendChild(trackList(doc.trailers, "donde")); }
    var r = LN.fila(); r.appendChild(LN.chip("confirmado")); r.appendChild(LN.srcLink(doc.fuente, doc.url));
    if (doc.urlVoces) r.appendChild(LN.srcLink("Voces de los locutores: " + doc.fuenteVoces, doc.urlVoces));
    info.appendChild(r);
    box.appendChild(info);
  }

  LN.seccion("musica", function (datos) {
    pintarEmisoras(datos.musica);
    pintarAlbum(datos.estado.musica || null);
    LN.resolverHash();
  });
})(window.LN);
