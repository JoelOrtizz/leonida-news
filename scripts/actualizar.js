#!/usr/bin/env node
/*
 * Daily collector (no AI): reads the official and press feeds in scripts/fuentes.json and queues every new
 * GTA VI headline in data/pendientes.json. It never touches the published data (data/data.json): Claude reviews
 * the queue, writes the entries in Spanish and marks each item as processed or discarded.
 * Only headline, outlet, link and date are stored; never article text.
 *
 * Usage: node scripts/actualizar.js [--prueba] [--config ruta/fuentes.json]
 *   --prueba  shows what would be queued without writing anything
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
var COLA = path.join(ROOT, "data", "pendientes.json");

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

// ---------- Queue ----------

function leerJSON(ruta, porDefecto) {
  if (!fs.existsSync(ruta)) return porDefecto;
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

// Everything already published or queued, to avoid proposing it again.
function conocidos(datos, cola) {
  var urls = {}, titulos = {};
  ["noticias", "trailers", "mitos", "resenas", "agenda", "cronologia"].forEach(function (c) {
    (datos[c] || []).forEach(function (x) {
      if (x.url) urls[urlNormal(x.url)] = true;
      if (x.titulo) titulos[tituloNormal(x.titulo)] = true;
    });
  });
  cola.elementos.forEach(function (x) { urls[urlNormal(x.url)] = true; titulos[tituloNormal(x.titulo)] = true; });
  return { urls: urls, titulos: titulos };
}

function podar(cola, conf, ahora) {
  var limite = ahora - conf.diasRetencion * DIA_MS;
  var antes = cola.elementos.length;
  cola.elementos = cola.elementos.filter(function (x) { return x.estado === "pendiente" || Date.parse(x.detectado) >= limite; });
  if (cola.elementos.length > conf.maxElementos) {
    cola.elementos.sort(function (a, b) { return Date.parse(b.detectado) - Date.parse(a.detectado); });
    cola.elementos = cola.elementos.slice(0, conf.maxElementos);
  }
  return antes - cola.elementos.length;
}

// ---------- Main ----------

function main() {
  var conf = leerJSON(CONFIG, null);
  if (!conf) { console.error("✗ No existe " + CONFIG); process.exit(1); }
  var datos = leerJSON(DATOS, {});
  var cola = leerJSON(COLA, { actualizado: null, elementos: [] });
  var ahora = Date.now(), desde = ahora - conf.diasAtras * DIA_MS;
  var claves = patronClaves(conf.palabrasClave);
  var vistos = conocidos(datos, cola);

  return Promise.all(conf.fuentes.map(function (f) {
    return descargar(f).then(function (items) { return { fuente: f, items: items }; }, function (e) {
      var causa = e.cause && (e.cause.code || e.cause.message);
      return { fuente: f, error: (e.message || String(e)) + (causa ? " (" + causa + ")" : "") };
    });
  })).then(function (resultados) {
    var nuevos = [], fallidas = [];
    resultados.forEach(function (r) {
      var f = r.fuente;
      if (r.error) { fallidas.push(f.id); console.warn("⚠ " + f.nombre + ": " + r.error); return; }
      var n = 0;
      r.items.forEach(function (it) {
        var fecha = Date.parse(it.fecha);
        if (!it.titulo || !/^https:\/\//.test(it.url) || isNaN(fecha) || fecha < desde || fecha > ahora + DIA_MS) return;
        if (!claves.test(tituloNormal(it.titulo))) return;
        if (f.autor && it.autor && it.autor !== f.autor) return;
        var u = urlNormal(it.url), t = tituloNormal(it.titulo);
        if (vistos.urls[u] || vistos.titulos[t]) return;
        vistos.urls[u] = vistos.titulos[t] = true;
        n++;
        nuevos.push({
          id: crypto.createHash("sha1").update(u).digest("hex").slice(0, 12),
          estado: "pendiente", tipo: f.tipo, oficial: !!f.oficial, fuente: f.nombre, fuenteId: f.id, idioma: f.idioma,
          titulo: it.titulo, url: it.url, fecha: new Date(fecha).toISOString(), detectado: new Date(ahora).toISOString()
        });
      });
      console.log("· " + f.nombre + ": " + r.items.length + " elementos, " + n + " nuevos sobre GTA VI");
    });

    var podados = podar(cola, conf, ahora);
    nuevos.sort(function (a, b) { return Date.parse(b.fecha) - Date.parse(a.fecha); });
    cola.elementos = nuevos.concat(cola.elementos);
    var pendientes = cola.elementos.filter(function (x) { return x.estado === "pendiente"; }).length;

    console.log("\n" + nuevos.length + " nuevos, " + podados + " antiguos eliminados, " + pendientes + " pendientes en la cola" +
      (fallidas.length ? "; fuentes con error: " + fallidas.join(", ") : ""));
    nuevos.forEach(function (x) { console.log("  + [" + (x.oficial ? "oficial" : "prensa") + "] " + x.fuente + ": " + x.titulo); });

    // Written only when the queue changes, so the scheduled job commits nothing on quiet days.
    if (PRUEBA) console.log("\n(prueba: no se ha escrito nada)");
    else if (nuevos.length || podados) {
      cola.actualizado = new Date(ahora).toISOString();
      fs.writeFileSync(COLA, JSON.stringify(cola, null, 2) + "\n");
      console.log("\n✓ " + path.relative(ROOT, COLA) + " actualizado");
    } else console.log("\nSin cambios en la cola.");

    if (fallidas.length === conf.fuentes.length) { console.error("✗ Han fallado todas las fuentes"); process.exit(1); }
  });
}

main().catch(function (e) { console.error("✗ " + (e.stack || e)); process.exit(1); });
