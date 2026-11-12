#!/usr/bin/env node
/*
 * Headline collector (no AI), run three times a day by GitHub Actions: reads the official and press feeds in
 * scripts/fuentes.json and publishes every new GTA VI headline in data/titulares.json, shown in the page's
 * "Al minuto" block. It never touches the curated data (data/data.json).
 * Repeats are skipped: same link, same headline, links already in data.json, or the same story told by another
 * outlet within a few days (the source listed first in fuentes.json wins, so Rockstar and Take-Two come first).
 * Only headline, outlet, link and date are stored; never article text.
 *
 * Usage: node scripts/actualizar.js [--prueba] [--config ruta/fuentes.json]
 *   --prueba  shows what would be published without writing anything
 * Exit code 1 only if every source failed (so the scheduled run is flagged).
 */
"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = path.resolve(__dirname, "..");
var ARGS = process.argv.slice(2);
var PRUEBA = ARGS.indexOf("--prueba") >= 0;
var CONFIG = path.resolve(ARGS.indexOf("--config") >= 0 ? ARGS[ARGS.indexOf("--config") + 1] : path.join(__dirname, "fuentes.json"));
var DATOS = path.join(ROOT, "data", "data.json");
var TITULARES = path.join(ROOT, "data", "titulares.json");

var USER_AGENT = "LeonidaNewsBot/1.0 (+https://joelortizz.github.io/leonida-news/)";
var TIMEOUT_MS = 20000;
var DIA_MS = 86400000;
// Tracking parameters removed before comparing links.
var PARAMS_SEGUIMIENTO = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref|cmpid|icid)$/i;

// ---------- Text helpers ----------

function sinAcentos(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function tituloNormal(s) { return sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function urlNormal(u) {
  try {
    var x = new URL(String(u).trim());
    x.hash = "";
    x.hostname = x.hostname.toLowerCase().replace(/^www\./, "");
    // A YouTube short is the same video as its watch?v= page.
    var corto = /^\/shorts\/([\w-]+)/.exec(x.pathname);
    if (x.hostname === "youtube.com" && corto) { x.pathname = "/watch"; x.search = "?v=" + corto[1]; }
    Array.from(x.searchParams.keys()).forEach(function (k) { if (PARAMS_SEGUIMIENTO.test(k)) x.searchParams.delete(k); });
    return (x.protocol + "//" + x.hostname + x.pathname.replace(/\/+$/, "") + (x.search || "")).toLowerCase();
  } catch (e) { return String(u || "").trim().toLowerCase(); }
}

var ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
function decodificar(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, function (m, n) { return ENTIDADES[n]; })
    .replace(/\s+/g, " ").trim();
}

// Keywords match as whole words, ignoring case, accents and the space in "GTA 6" / "GTA6".
function patronClaves(claves) {
  var partes = claves.map(function (k) { return tituloNormal(k).split(" ").join("\\s*"); });
  return new RegExp("(^|[^a-z0-9])(" + partes.join("|") + ")($|[^a-z0-9])");
}

// ---------- Feed parsing (RSS 2.0 and Atom) ----------

function etiqueta(xml, nombres) {
  for (var i = 0; i < nombres.length; i++) {
    var m = new RegExp("<" + nombres[i] + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + nombres[i] + ">", "i").exec(xml);
    if (m) return decodificar(m[1]);
  }
  return "";
}
function enlace(xml) {
  var alt = /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(xml) || /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i.exec(xml);
  if (alt) return decodificar(alt[1]);
  var href = /<link\b[^>]*href=["']([^"']+)["']/i.exec(xml);
  if (href) return decodificar(href[1]);
  return etiqueta(xml, ["link", "guid"]);
}
function leerFeed(xml) {
  var bloques = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return bloques.map(function (b) {
    var autor = /<author\b[\s\S]*?<name>([\s\S]*?)<\/name>/i.exec(b);
    return {
      titulo: etiqueta(b, ["title"]),
      url: enlace(b),
      fecha: etiqueta(b, ["pubDate", "published", "dc:date", "updated"]),
      autor: autor ? decodificar(autor[1]) : etiqueta(b, ["dc:creator"])
    };
  });
}

// Decodes with the charset the server declares (header or XML prologue); Vandal, for instance, uses ISO-8859-1.
function texto(res) {
  return res.arrayBuffer().then(function (buf) {
    var bytes = Buffer.from(buf);
    var cab = /charset=([\w-]+)/i.exec(res.headers.get("content-type") || "");
    var prologo = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(bytes.subarray(0, 200).toString("latin1"));
    var charset = (cab && cab[1]) || (prologo && prologo[1]) || "utf-8";
    try { return new TextDecoder(charset).decode(bytes); } catch (e) { return bytes.toString("utf8"); }
  });
}

function descargar(fuente) {
  return fetch(fuente.url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return texto(res);
    })
    .then(function (xml) {
      // An empty feed is fine (e.g. a channel with no public videos); a page that is not a feed is an error.
      if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("la respuesta no es un feed RSS ni Atom (¿ha cambiado la URL?)");
      return leerFeed(xml);
    });
}


// ---------- Same story ----------

// Words that say nothing about which story a headline tells: articles, connectors and the game's own name.
var VACIAS = ("a al ante como con contra de del desde el en entre es esta este esto han hay la las le les lo los mas muy no o para " +
  "pero por que se sea ser si sin sobre su sus te tu un una uno unos y ya the of to in on for and or is are be with at by from as it its " +
  "this that has have will can new gta grand theft auto vi 6 rockstar games juego videojuego").split(" ");
var ES_VACIA = {};
VACIAS.forEach(function (w) { ES_VACIA[w] = true; });

function palabras(titulo) {
  var vistas = {};
  return tituloNormal(titulo).split(" ").filter(function (w) {
    if (w.length < 3 || ES_VACIA[w] || vistas[w]) return false;
    vistas[w] = true;
    return true;
  });
}

// Two headlines tell the same story when most of the meaningful words of the shorter one are in the other.
function mismaNoticia(a, b) {
  if (a.length < 3 || b.length < 3) return false;
  var comunes = a.filter(function (w) { return b.indexOf(w) >= 0; }).length;
  return comunes / Math.min(a.length, b.length) >= 0.6;
}

// ---------- Published headlines ----------

function leerJSON(ruta, porDefecto) {
  if (!fs.existsSync(ruta)) return porDefecto;
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

// Links already in the curated sections of data/data.json: those stories are on the page already.
function enlacesPublicados(datos) {
  var urls = {};
  ["noticias", "trailers", "mitos", "resenas", "agenda", "cronologia"].forEach(function (c) {
    (datos[c] || []).forEach(function (x) { if (x.url) urls[urlNormal(x.url)] = true; });
  });
  return urls;
}

function podar(lista, conf, ahora) {
  var limite = ahora - conf.diasRetencion * DIA_MS;
  var antes = lista.elementos.length;
  lista.elementos = lista.elementos.filter(function (x) { return Date.parse(x.fecha) >= limite; }).slice(0, conf.maxElementos);
  return antes - lista.elementos.length;
}

// ---------- Main ----------

function descargarTodas(fuentes) {
  return Promise.all(fuentes.map(function (f, prioridad) {
    return descargar(f).then(function (items) { return { fuente: f, prioridad: prioridad, items: items }; }, function (e) {
      var causa = e.cause && (e.cause.code || e.cause.message);
      return { fuente: f, error: (e.message || String(e)) + (causa ? " (" + causa + ")" : "") };
    });
  }));
}

// Headlines about GTA VI from the last days, with the source's priority, ready to be compared.
function candidatos(resultados, conf, ahora, fallidas) {
  var desde = ahora - conf.diasAtras * DIA_MS;
  var claves = patronClaves(conf.palabrasClave);
  var lista = [];
  resultados.forEach(function (r) {
    var f = r.fuente;
    if (r.error) { fallidas.push(f.id); console.warn("⚠ " + f.nombre + " (" + f.id + "): " + r.error); return; }
    var n = 0;
    r.items.forEach(function (it) {
      var fecha = Date.parse(it.fecha);
      if (!it.titulo || !/^https:\/\//.test(it.url) || isNaN(fecha) || fecha < desde || fecha > ahora + DIA_MS) return;
      if (!claves.test(tituloNormal(it.titulo))) return;
      if (f.autor && it.autor && it.autor !== f.autor) return;
      n++;
      lista.push({ fuente: f, prioridad: r.prioridad, titulo: it.titulo, url: it.url, fecha: fecha });
    });
    console.log("· " + f.nombre + " (" + f.id + "): " + r.items.length + " elementos, " + n + " sobre GTA VI");
  });
  // Higher-priority sources first and, within one source, the earliest report: that is the one kept.
  return lista.sort(function (a, b) { return a.prioridad - b.prioridad || a.fecha - b.fecha; });
}

function main() {
  var conf = leerJSON(CONFIG, null);
  if (!conf) { console.error("✗ No existe " + CONFIG); process.exit(1); }
  var titulares = leerJSON(TITULARES, { actualizado: null, elementos: [] });
  var ahora = Date.now();
  var publicados = enlacesPublicados(leerJSON(DATOS, {}));
  var spoiler = patronClaves(conf.palabrasSpoiler);
  var ventana = conf.horasMismaNoticia * 3600000;

  // What is already listed: links, exact headlines and the words of each story, to skip repeats.
  var urls = {}, titulos = {}, historias = [];
  function anotar(x, fecha) {
    urls[urlNormal(x.url)] = titulos[tituloNormal(x.titulo)] = true;
    historias.push({ palabras: palabras(x.titulo), fecha: fecha });
  }
  titulares.elementos.forEach(function (x) { anotar(x, Date.parse(x.fecha)); });

  return descargarTodas(conf.fuentes).then(function (resultados) {
    var fallidas = [], nuevos = [], repetidos = 0;
    candidatos(resultados, conf, ahora, fallidas).forEach(function (c) {
      var u = urlNormal(c.url), t = tituloNormal(c.titulo), p = palabras(c.titulo);
      if (urls[u] || titulos[t] || publicados[u]) return;
      var repetido = historias.some(function (h) { return Math.abs(h.fecha - c.fecha) <= ventana && mismaNoticia(p, h.palabras); });
      if (repetido) { repetidos++; return; }
      var x = {
        id: crypto.createHash("sha1").update(u).digest("hex").slice(0, 12),
        fecha: new Date(c.fecha).toISOString().replace(/\.\d{3}Z$/, "Z"),
        titulo: c.titulo, fuente: c.fuente.nombre, fuenteId: c.fuente.id, tipo: c.fuente.tipo, oficial: !!c.fuente.oficial,
        idioma: c.fuente.idioma, url: c.url, spoiler: spoiler.test(t)
      };
      anotar(x, c.fecha);
      nuevos.push(x);
    });

    titulares.elementos = nuevos.concat(titulares.elementos).sort(function (a, b) { return Date.parse(b.fecha) - Date.parse(a.fecha); });
    var podados = podar(titulares, conf, ahora);

    console.log("\n" + nuevos.length + " nuevos, " + repetidos + " repetidos (misma noticia), " + podados + " antiguos retirados, " +
      titulares.elementos.length + " publicados" + (fallidas.length ? "; fuentes con error: " + fallidas.join(", ") : ""));
    nuevos.forEach(function (x) { console.log("  + [" + (x.oficial ? "oficial" : "prensa") + (x.spoiler ? ", spoiler" : "") + "] " + x.fuente + ": " + x.titulo); });

    // Written only when something changes, so quiet runs commit nothing.
    if (PRUEBA) console.log("\n(prueba: no se ha escrito nada)");
    else if (nuevos.length || podados) {
      titulares.actualizado = new Date(ahora).toISOString().replace(/\.\d{3}Z$/, "Z");
      fs.writeFileSync(TITULARES, JSON.stringify(titulares, null, 2) + "\n");
      console.log("\n✓ " + path.relative(ROOT, TITULARES) + " actualizado");
    } else console.log("\nSin titulares nuevos.");

    if (fallidas.length === conf.fuentes.length) { console.error("✗ Han fallado todas las fuentes"); process.exit(1); }
  });
}

main().catch(function (e) { console.error("✗ " + (e.stack || e)); process.exit(1); });
