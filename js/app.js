/* Start-up: loads data/data.json once per visit, prepares each collection and paints every section. */
(function (LN) {
  // Order each collection had in claude.ai: [field, 1 ascending | -1 descending]. Entries missing the field go last.
  var ORDEN = {
    noticias: ["fecha", -1], trailers: ["fecha", 1], agenda: ["inicio", 1], personajes: ["orden", 1], musica: ["orden", 1],
    cronologia: ["fecha", 1], regiones: ["orden", 1], ediciones: ["orden", 1], mitos: ["mes", -1], resenas: ["fecha", -1]
  };
  // Collections whose new entries are flagged as "Nuevo" for returning visitors.
  var SEGUIDAS = ["noticias", "trailers", "agenda", "personajes", "musica", "cronologia", "mitos", "resenas"];

  // The data uses "id"; the page works with "_id" (the claude.ai database field), set here once.
  function filas(data, coll) {
    var campo = ORDEN[coll][0], dir = ORDEN[coll][1];
    return (Array.isArray(data[coll]) ? data[coll] : [])
      .map(function (x) { var o = Object.assign({}, x); o._id = x.id; return o; })
      .sort(function (a, b) {
        var x = a[campo], y = b[campo];
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
        return x < y ? -dir : x > y ? dir : 0;
      });
  }

  // titulares: automatic headlines from data/titulares.json, already newest first; an empty list if that file failed.
  function preparar(data, titulares) {
    var datos = { estado: data.estado || {} };
    Object.keys(ORDEN).forEach(function (coll) { datos[coll] = filas(data, coll); });
    datos.titulares = (titulares && Array.isArray(titulares.elementos) ? titulares.elementos : [])
      .map(function (x) { var o = Object.assign({}, x); o._id = x.id; return o; });
    datos.titularesActualizado = titulares && titulares.actualizado;
    SEGUIDAS.concat("titulares").forEach(function (coll) { LN.track(coll, datos[coll].map(function (x) { return x._id; })); });
    return datos;
  }

  function leer(ruta) {
    return fetch(ruta, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function errorDeCarga() {
    var upd = LN.clear("upd"), retry = LN.el("button", "more", "Reintentar");
    upd.appendChild(document.createTextNode("no disponible "));
    retry.type = "button"; retry.addEventListener("click", cargar); upd.appendChild(retry);
    var msg = "No se han podido cargar los datos. Prueba a recargar la página.";
    ["facts", "tapes", "cast", "regDetail", "tickets", "myths", "stations", "album"].forEach(function (id) { LN.vacio(LN.clear(id), "p", msg); });
    ["feed", "titulares", "latest", "reviews", "agenda", "timeline"].forEach(function (id) { LN.vacio(LN.clear(id), "li", msg); });
  }

  // no-cache: the browser revalidates, so a data update is visible on the next visit.
  // The automatic headlines are optional: if they fail, the rest of the page still loads.
  function cargar() {
    document.getElementById("upd").textContent = "cargando…";
    var titulares = leer("data/titulares.json").catch(function () { return null; });
    Promise.all([leer("data/data.json"), titulares]).then(function (r) {
      LN.datos = preparar(r[0], r[1]);
      LN.pintarTodo();
    }).catch(errorDeCarga);
  }

  cargar();
})(window.LN);
