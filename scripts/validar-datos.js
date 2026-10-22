#!/usr/bin/env node
/*
 * Checks data/data.json against the schema in the project rules before it is committed or published.
 * Usage: node scripts/validar-datos.js [ruta/al/data.json]
 * Exits with code 1 if there are errors; warnings are printed but do not fail.
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var FILE = path.resolve(process.argv[2] || path.join(ROOT, "data", "data.json"));

var ESTADOS = ["confirmado", "reportado", "rumor"];
var VEREDICTOS = ["falso", "cierto", "sin-confirmar"];
var TIPOS = ["anuncio", "trailer", "fecha", "retraso", "filtracion", "lanzamiento"];
var COLORES = ["pink", "cyan", "sun", "orange", "green", "red", "violet"];
var CANALES = ["Rockstar Games", "Take-Two Interactive"];
var REGIONES = ["vice-city", "leonida-keys", "grassrivers", "ambrosia", "port-gellhorn", "mount-kalaga"];
var MAX_NOTICIAS = 250;

// "confirmado" needs an official source. YouTube links must also come from the official channel (checked with oEmbed when added).
var OFICIALES = [
  /^(www\.)?rockstargames\.com$/, /^support\.rockstargames\.com$/, /^store\.rockstargames\.com$/,
  /^(www\.|ir\.)?take2games\.com$/, /^(www\.)?sec\.gov$/,
  /^(www\.)?esrb\.org$/, /^(www\.)?pegi\.info$/,
  /^(www\.|store\.)?playstation\.com$/, /^(www\.)?xbox\.com$/, /^(www\.)?microsoft\.com$/,
  /^(www\.)?youtube\.com$/, /^(www\.)?thegameawards\.com$/
];
var OFICIALES_RUTA = [{ host: /^(x|twitter)\.com$/, ruta: /^\/RockstarGames\// }];

var errores = [];
var avisos = [];
function error(donde, msg) { errores.push(donde + ": " + msg); }
function aviso(donde, msg) { avisos.push(donde + ": " + msg); }

// Field checkers: each returns an error message or null.
function texto(v) { return typeof v === "string" && v.trim() ? null : "debe ser un texto no vacío"; }
function numero(v) { return typeof v === "number" && isFinite(v) ? null : "debe ser un número"; }
function booleano(v) { return typeof v === "boolean" ? null : "debe ser true o false"; }
function lista(v) { return Array.isArray(v) ? null : "debe ser una lista"; }
function enumerado(valores) { return function (v) { return valores.indexOf(v) >= 0 ? null : "debe ser uno de: " + valores.join(", "); }; }
function patron(re, desc) { return function (v) { return typeof v === "string" && re.test(v) ? null : "debe tener el formato " + desc; }; }
function numeroONulo(v) { return v === null || (typeof v === "number" && isFinite(v)) ? null : "debe ser un número o null"; }

function fechaReal(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
function fecha(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && fechaReal(v) ? null : "debe ser una fecha AAAA-MM-DD válida"; }
function fechaHora(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(v) && fechaReal(v) && !isNaN(Date.parse(v))
    ? null : "debe ser una fecha y hora ISO 8601 en UTC (AAAA-MM-DDTHH:MM:SSZ)";
}
function mes(v) { return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? null : "debe tener el formato AAAA-MM"; }

function url(v) {
  if (typeof v !== "string") return "debe ser una URL";
  try { var u = new URL(v); } catch (e) { return "no es una URL válida"; }
  return u.protocol === "https:" ? null : "debe empezar por https://";
}
function imagen(v) {
  if (v === "") return null; // empty is allowed: images for new stations are added by hand
  if (typeof v !== "string") return "debe ser una ruta de imagen";
  if (/^https:\/\//.test(v)) return null;
  if (!/^img\/(?!.*\.\.)[a-z0-9\/._-]+$/.test(v)) return "debe ser https://… o una ruta img/… en minúsculas y sin «..»";
  return fs.existsSync(path.join(ROOT, v)) ? null : "el archivo no existe";
}
function esOficial(v) {
  try { var u = new URL(v); } catch (e) { return false; }
  return OFICIALES.some(function (re) { return re.test(u.hostname); }) ||
    OFICIALES_RUTA.some(function (r) { return r.host.test(u.hostname) && r.ruta.test(u.pathname); });
}

// Schema: required fields (true) and optional ones (false) with their checker.
var FUENTE = { estado: [true, enumerado(ESTADOS)], fuente: [true, texto], url: [true, url] };
function con(extra) { var o = {}; [FUENTE, extra].forEach(function (s) { Object.keys(s).forEach(function (k) { o[k] = s[k]; }); }); return o; }
var DATO = con({ etiqueta: [true, texto], valor: [true, texto] });
var CANCION = { artista: [true, texto], titulo: [true, texto], donde: [false, texto] };

var COLECCIONES = {
  noticias: con({ fecha: [true, fecha], titulo: [true, texto], resumen: [true, texto], categoria: [true, texto], spoiler: [false, booleano] }),
  // Trailers have no "fuente": the official channel ("canal") is the source.
  trailers: {
    fecha: [true, fecha], numero: [true, patron(/^\d{2}$/, "«01»")], titulo: [true, texto], duracion: [true, patron(/^~?\d+:\d{2}$/, "«m:ss» (o «~m:ss» si es aproximada)")],
    canal: [true, enumerado(CANALES)], descripcion: [true, texto], estado: [true, enumerado(ESTADOS)], url: [true, url], spoiler: [false, booleano]
  },
  mitos: {
    mes: [false, mes], afirmacion: [true, texto], veredicto: [true, enumerado(VEREDICTOS)], explicacion: [true, texto],
    fuente: [true, texto], url: [true, url], spoiler: [false, booleano]
  },
  resenas: { fecha: [true, fecha], medio: [true, texto], nota: [true, texto], resumen: [true, texto], url: [true, url] },
  agenda: con({
    inicio: [true, texto], fin: [false, fechaHora], todoElDia: [true, booleano], titulo: [true, texto], descripcion: [true, texto],
    aproximada: [false, booleano], destacado: [false, booleano]
  }),
  musica: con({
    orden: [true, numero], nombre: [true, texto], genero: [true, texto], detalle: [true, texto], presentadores: [false, texto],
    voces: [false, texto], temas: [false, lista], color: [true, enumerado(COLORES)], logo: [false, imagen], fondo: [false, imagen]
  }),
  cronologia: con({ fecha: [true, fecha], titulo: [true, texto], descripcion: [true, texto], tipo: [true, enumerado(TIPOS)], spoiler: [false, booleano] }),
  personajes: con({
    orden: [true, numero], nombre: [true, texto], rol: [true, texto], descripcion: [true, texto], color: [true, enumerado(COLORES)], imagen: [false, imagen]
  }),
  regiones: con({
    orden: [true, numero], nombre: [true, texto], inspiracion: [true, texto], descripcion: [true, texto], destacados: [true, lista]
  }),
  ediciones: con({
    orden: [true, numero], nombre: [true, texto], precio: [true, texto], precioAlt: [false, texto], destacada: [false, booleano], incluye: [true, lista]
  })
};

function revisar(donde, obj, esquema) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { error(donde, "debe ser un objeto"); return; }
  Object.keys(esquema).forEach(function (k) {
    var req = esquema[k][0], fn = esquema[k][1];
    if (obj[k] === undefined) { if (req) error(donde, "falta el campo «" + k + "»"); return; }
    var e = fn(obj[k]);
    if (e) error(donde, "«" + k + "» " + e);
  });
  Object.keys(obj).forEach(function (k) { if (k !== "id" && !esquema[k]) aviso(donde, "campo desconocido «" + k + "» (¿errata?)"); });
  if (obj.estado === "confirmado" && typeof obj.url === "string" && !esOficial(obj.url)) {
    error(donde, "está «confirmado» pero la URL no es de una fuente oficial (" + obj.url + ")");
  }
}

function revisarLista(donde, arr, esquema) {
  if (!Array.isArray(arr)) { error(donde, "debe ser una lista"); return; }
  arr.forEach(function (x, i) { revisar(donde + "[" + i + "]", x, esquema); });
}

function revisarColeccion(nombre, arr) {
  if (!Array.isArray(arr)) { error(nombre, "debe ser una lista"); return; }
  var vistos = {};
  arr.forEach(function (doc, i) {
    var donde = nombre + "/" + (doc && doc.id ? doc.id : "#" + i);
    if (!doc || typeof doc.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(doc.id)) error(donde, "«id» debe ser un texto en minúsculas con guiones");
    else if (vistos[doc.id]) error(donde, "«id» repetido");
    else vistos[doc.id] = true;
    revisar(donde, doc, COLECCIONES[nombre]);
  });
}

function revisarExtras(datos) {
  var d = {};
  Object.keys(COLECCIONES).forEach(function (c) { d[c] = Array.isArray(datos[c]) ? datos[c].filter(Boolean) : []; });
  d.agenda.forEach(function (e) {
    var donde = "agenda/" + e.id;
    var msg = e.todoElDia ? fecha(e.inicio) : fechaHora(e.inicio);
    if (msg) error(donde, "«inicio» " + msg + (e.todoElDia ? " (todoElDia: true)" : " (todoElDia: false)"));
    if (e.todoElDia && e.fin !== undefined) aviso(donde, "«fin» se ignora en eventos de todo el día");
  });
  d.musica.forEach(function (s) { if (Array.isArray(s.temas)) revisarLista("musica/" + s.id + ".temas", s.temas, CANCION); });
  d.regiones.forEach(function (r) { if (REGIONES.indexOf(r.id) < 0) error("regiones/" + r.id, "id no permitido; las regiones son: " + REGIONES.join(", ")); });
  var numeros = {};
  d.trailers.forEach(function (t) {
    if (numeros[t.numero]) error("trailers/" + t.id, "«numero» " + t.numero + " repetido");
    numeros[t.numero] = true;
    if (/^~/.test(t.duracion)) aviso("trailers/" + t.id, "duración aproximada (" + t.duracion + "); pon la exacta cuando se conozca");
    if (!/^https:\/\/(www\.)?youtube\.com\/watch\?v=/.test(t.url)) aviso("trailers/" + t.id, "la URL no es un vídeo de YouTube (enlace provisional)");
  });
  var destacados = d.agenda.filter(function (e) { return e.destacado; }).length;
  if (destacados > 1) aviso("agenda", destacados + " hitos con «destacado»; solo debería estarlo el lanzamiento");
  if (d.noticias.length > MAX_NOTICIAS) aviso("noticias", d.noticias.length + " noticias; borra los rumores más antiguos (máximo " + MAX_NOTICIAS + ")");
}

function revisarEstado(est) {
  if (!est || typeof est !== "object") { error("estado", "falta el objeto «estado»"); return; }
  revisar("estado.resumen", est.resumen, {
    actualizado: [true, fechaHora], lanzamientoISO: [true, fecha], lanzamientoTexto: [true, texto], hechos: [true, lista]
  });
  if (est.resumen && Array.isArray(est.resumen.hechos)) {
    revisarLista("estado.resumen.hechos", est.resumen.hechos, DATO);
    var n = est.resumen.hechos.length;
    if (n < 4 || n > 8) aviso("estado.resumen.hechos", n + " datos en la ficha; deberían ser entre 4 y 8");
  }
  revisar("estado.resenas", est.resenas, {
    metacritic: [true, numeroONulo], opencritic: [true, numeroONulo], embargo: [true, texto], nota: [true, texto],
    fuente: [true, texto], url: [true, url], comprobado: [true, fecha]
  });
  revisar("estado.ediciones", est.ediciones, { extras: [true, lista] });
  if (est.ediciones && Array.isArray(est.ediciones.extras)) revisarLista("estado.ediciones.extras", est.ediciones.extras, DATO);
  var mus = est.musica;
  revisar("estado.musica", mus, {
    intro: [true, texto], album: [true, function (v) { return v && typeof v === "object" ? null : "debe ser un objeto"; }],
    score: [false, function (v) { return v && typeof v === "object" ? null : "debe ser un objeto"; }],
    trailers: [false, lista], fuente: [true, texto], url: [true, url], fuenteVoces: [false, texto], urlVoces: [false, url]
  });
  if (mus && mus.album) {
    revisar("estado.musica.album", mus.album, {
      titulo: [true, texto], temas: [false, numero], fecha: [false, fecha], portada: [false, imagen], sencillos: [false, lista]
    });
    if (Array.isArray(mus.album.sencillos)) revisarLista("estado.musica.album.sencillos", mus.album.sencillos, CANCION);
  }
  if (mus && mus.score) revisar("estado.musica.score", mus.score, { artista: [true, texto], titulo: [true, texto], con: [false, texto], nota: [false, texto] });
  if (mus && Array.isArray(mus.trailers)) revisarLista("estado.musica.trailers", mus.trailers, CANCION);
}

// Queue written by scripts/actualizar.js (data/pendientes.json, next to data.json); checked only if it exists.
var COLA = {
  estado: [true, enumerado(["pendiente", "procesado", "descartado"])], tipo: [true, enumerado(["video", "comunicado", "prensa"])],
  oficial: [true, booleano], fuente: [true, texto], fuenteId: [true, texto], idioma: [true, enumerado(["es", "en"])],
  titulo: [true, texto], url: [true, url], fecha: [true, fechaHora], detectado: [true, fechaHora]
};
function revisarCola(ruta) {
  if (!fs.existsSync(ruta)) return null;
  var cola;
  try { cola = JSON.parse(fs.readFileSync(ruta, "utf8")); } catch (e) { error("pendientes", "no es JSON válido: " + e.message); return null; }
  revisar("pendientes", cola, { actualizado: [true, fechaHora], elementos: [true, lista] });
  if (!Array.isArray(cola.elementos)) return null;
  var ids = {};
  cola.elementos.forEach(function (x, i) {
    var donde = "pendientes/" + (x && x.id ? x.id : "#" + i);
    if (!x || !/^[0-9a-f]{12}$/.test(x.id)) error(donde, "«id» debe tener 12 caracteres hexadecimales");
    else if (ids[x.id]) error(donde, "«id» repetido");
    else ids[x.id] = true;
    revisar(donde, x, COLA);
  });
  return cola.elementos.filter(function (x) { return x && x.estado === "pendiente"; }).length;
}

function main() {
  var d;
  try { d = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch (e) { console.error("✗ No se puede leer " + FILE + ": " + e.message); process.exit(1); }

  revisarEstado(d.estado);
  Object.keys(COLECCIONES).forEach(function (c) { revisarColeccion(c, d[c]); });
  revisarExtras(d);
  var pendientes = revisarCola(path.join(path.dirname(FILE), "pendientes.json"));

  avisos.forEach(function (a) { console.warn("⚠ " + a); });
  errores.forEach(function (e) { console.error("✗ " + e); });
  var resumen = Object.keys(COLECCIONES).map(function (c) { return c + " " + (Array.isArray(d[c]) ? d[c].length : 0); }).join(", ");
  if (errores.length) { console.error("\n" + errores.length + " error(es), " + avisos.length + " aviso(s) en " + path.relative(ROOT, FILE)); process.exit(1); }
  console.log("✓ " + path.relative(ROOT, FILE) + " es válido (" + resumen + ")" + (avisos.length ? " con " + avisos.length + " aviso(s)" : ""));
  if (pendientes !== null) console.log("✓ Cola válida: " + pendientes + " elemento(s) pendiente(s) de revisar");
}

main();
