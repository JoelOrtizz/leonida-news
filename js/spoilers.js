/* Spoiler-free mode: blurs entries marked spoiler: true until the reader taps them. The preference is kept in this browser. */
(function (LN) {
  var el = LN.el;
  var CLAVE = "ln-nospoil";
  var noSpoil = LN.store(CLAVE);
  if (noSpoil === null) noSpoil = true;
  var revealed = {};

  LN.spoilWrap = function (node, key) {
    if (!noSpoil || revealed[key]) return node;
    node.classList.add("spoil");
    var b = el("button", "spoil-btn"); b.type = "button";
    b.appendChild(document.createTextNode("Contiene spoilers")); b.appendChild(el("small", null, "Toca para mostrar"));
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation(); revealed[key] = true;
      node.classList.add("revealing");
      setTimeout(function () { node.classList.remove("spoil", "revealing"); b.remove(); }, LN.REDUCE ? 0 : 720);
    });
    node.appendChild(b);
    return node;
  };

  var toggle = document.getElementById("spoilToggle");
  toggle.setAttribute("aria-pressed", String(noSpoil));
  toggle.addEventListener("click", function () {
    noSpoil = !noSpoil; revealed = {};
    LN.store(CLAVE, noSpoil);
    toggle.setAttribute("aria-pressed", String(noSpoil));
    ["noticias", "trailers", "mitos", "cronologia"].forEach(LN.pintar);
  });
})(window.LN);
