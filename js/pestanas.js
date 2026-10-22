/* Tabs: switching panels, keyboard arrows, and the scrollable tab strip (arrows, wheel, drag and edge fades). */
(function (LN) {
  var tabnav = document.querySelector(".tabnav"), strip = tabnav.querySelector(".tabbar");
  var botones = Array.prototype.slice.call(strip.querySelectorAll("button"));
  var tabPrev = document.getElementById("tabPrev"), tabNext = document.getElementById("tabNext"), dragMoved = false;

  LN.showTab = function (name, scroll) {
    if (!document.getElementById("p-" + name)) name = "resumen";
    botones.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on) {
        var bl = b.offsetLeft, br = bl + b.offsetWidth;
        if (bl < strip.scrollLeft || br > strip.scrollLeft + strip.clientWidth - 36) strip.scrollTo({ left: Math.max(0, bl - 24), behavior: "smooth" });
      }
      document.getElementById("p-" + b.dataset.tab).hidden = !on;
    });
    LN.pestanaActual = name; LN.marcarVisto(name);
    // Coming from further down the page, jump back to the top of the panel (just under the sticky tab bar).
    if (scroll) {
      var y = tabnav.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(tabnav).top) || 0);
      if (window.scrollY > y) window.scrollTo(0, y);
    }
  };

  // Arrows show only when the tabs do not fit; at either end the matching arrow is disabled.
  function updateArrows() {
    var max = strip.scrollWidth - strip.clientWidth, desborda = max > 2;
    var l = desborda && strip.scrollLeft > 2, r = desborda && strip.scrollLeft < max - 2;
    tabnav.classList.toggle("desborda", desborda);
    tabPrev.disabled = !l; tabNext.disabled = !r;
    tabnav.classList.toggle("fade-l", l); tabnav.classList.toggle("fade-r", r);
  }
  function nudge(dir) { strip.scrollBy({ left: dir * Math.max(160, strip.clientWidth * 0.6), behavior: LN.REDUCE ? "auto" : "smooth" }); }

  tabPrev.addEventListener("click", function () { nudge(-1); });
  tabNext.addEventListener("click", function () { nudge(1); });
  strip.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  // A vertical mouse wheel scrolls the strip sideways while it can still move.
  strip.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    var max = strip.scrollWidth - strip.clientWidth;
    if (max <= 0 || (e.deltaY < 0 && strip.scrollLeft <= 0) || (e.deltaY > 0 && strip.scrollLeft >= max - 1)) return;
    e.preventDefault();
    strip.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
  }, { passive: false });
  // Mouse drag; a drag must not also count as a click on the tab under the pointer.
  strip.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    var x0 = e.clientX, s0 = strip.scrollLeft; dragMoved = false;
    function move(ev) {
      var dx = ev.clientX - x0;
      if (!dragMoved && Math.abs(dx) > 5) { dragMoved = true; strip.classList.add("dragging"); }
      if (dragMoved) strip.scrollLeft = s0 - dx;
    }
    function up() {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      strip.classList.remove("dragging"); setTimeout(function () { dragMoved = false; }, 0);
    }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateArrows);
  setTimeout(updateArrows, 0);

  botones.forEach(function (b, i) {
    b.addEventListener("click", function (e) { if (dragMoved) { e.preventDefault(); return; } LN.showTab(b.dataset.tab, true); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var n = botones[(i + (e.key === "ArrowRight" ? 1 : botones.length - 1)) % botones.length];
      n.focus(); LN.showTab(n.dataset.tab, true);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { LN.showTab(b.dataset.go, true); });
  });
  LN.showTab((location.hash || "").slice(1) || "resumen", false);
})(window.LN);
