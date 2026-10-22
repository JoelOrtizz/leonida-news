/* Hero: draws a Vice City sunset on canvas, masked by the site's "LN" initials that start huge (screen fully covered) and shrink to logo size as you scroll */
(function () {
  var hero = document.getElementById("hero"), cv = document.getElementById("heroCanvas");
  var title = document.getElementById("heroTitle"), hint = document.getElementById("hint");
  var ctx = cv.getContext("2d"), scene = document.createElement("canvas"), sctx = scene.getContext("2d");
  var W = 0, H = 0, DPR = 1, ready = false, raf = 0;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PALM = [
    "M70 210 C68 160 66 120 60 70 L64 70 C72 120 76 160 80 210 Z",
    "M62 72 C40 50 14 52 0 66 C22 56 42 60 62 76 Z", "M62 72 C44 40 20 30 4 34 C26 38 44 52 60 78 Z",
    "M62 72 C62 40 52 18 38 6 C52 26 58 46 60 76 Z", "M62 72 C80 44 104 36 126 42 C104 44 84 56 64 78 Z",
    "M62 72 C90 62 112 70 128 86 C110 76 88 72 64 78 Z", "M62 72 C74 46 82 28 82 8 C88 30 80 52 64 78 Z"
  ].map(function (d) { return new Path2D(d); });

  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function palm(c, x, y, s, flip) {
    c.save(); c.translate(x, y); c.scale(flip ? -s : s, s); c.translate(-70, -210);
    PALM.forEach(function (p) { c.fill(p); }); c.restore();
  }

  function paintScene() {
    var w = scene.width = Math.round(W * DPR * 1.3), h = scene.height = Math.round(H * DPR * 1.3);
    var c = sctx, hz = h * 0.64, r = rnd(19);
    var sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#1d0f3d"); sky.addColorStop(.45, "#6d1b7b"); sky.addColorStop(.8, "#ff2e93"); sky.addColorStop(1, "#ff9a3d");
    c.fillStyle = sky; c.fillRect(0, 0, w, hz);
    for (var i = 0; i < 90; i++) { c.fillStyle = "rgba(255,255,255," + (0.2 + r() * .6) + ")"; c.fillRect(r() * w, r() * hz * .45, 1.5 * DPR, 1.5 * DPR); }
    var R = Math.min(w, h) * 0.26, cx = w / 2;
    var sun = c.createLinearGradient(0, hz - R, 0, hz);
    sun.addColorStop(0, "#ffd23f"); sun.addColorStop(.55, "#ff7a3d"); sun.addColorStop(1, "#ff2e93");
    c.save(); c.shadowColor = "rgba(255,122,61,.8)"; c.shadowBlur = 80 * DPR;
    c.beginPath(); c.arc(cx, hz, R, Math.PI, 0); c.closePath(); c.fillStyle = sun; c.fill(); c.restore();
    c.fillStyle = "#ff2e93"; c.globalCompositeOperation = "destination-out";
    for (var k = 0, y = hz - R * .45; y < hz; k++) { var g = 2 + k * 2.2; c.fillRect(cx - R, y, R * 2, g * DPR); y += (g + 9) * DPR; }
    c.globalCompositeOperation = "source-over";
    var x = 0; c.fillStyle = "#170a33";
    while (x < w) {
      var bw = (18 + r() * 46) * DPR, bh = (30 + r() * 150) * DPR * (Math.abs(x - cx) < R * 1.1 ? .55 : 1);
      c.fillRect(x, hz - bh, bw, bh);
      c.fillStyle = "rgba(25,227,255,.55)";
      for (var wy = hz - bh + 8 * DPR; wy < hz - 6 * DPR; wy += 9 * DPR) for (var wx = x + 4 * DPR; wx < x + bw - 4 * DPR; wx += 8 * DPR) if (r() > .78) c.fillRect(wx, wy, 2.5 * DPR, 3 * DPR);
      c.fillStyle = "#170a33"; x += bw + (2 + r() * 6) * DPR;
    }
    var sea = c.createLinearGradient(0, hz, 0, h);
    sea.addColorStop(0, "#3a0f55"); sea.addColorStop(1, "#0b0620");
    c.fillStyle = sea; c.fillRect(0, hz, w, h - hz);
    for (var j = 0; j < 26; j++) {
      var yy = hz + Math.pow(j / 26, 1.6) * (h - hz), ww = R * (1.6 - j / 26) * (0.6 + r() * .5);
      c.fillStyle = j % 2 ? "rgba(255,122,61,.55)" : "rgba(255,46,147,.5)"; c.fillRect(cx - ww / 2, yy, ww, (1 + j * .25) * DPR);
    }
    c.fillStyle = "#ff2e93"; c.fillRect(0, hz - 1 * DPR, w, 2 * DPR);
    c.fillStyle = "#07031a";
    var s = h / 210 * .62;
    palm(c, w * .08, h * 1.02, s, false); palm(c, w * .2, h * 1.02, s * .7, true);
    palm(c, w * .9, h * 1.02, s * .85, true); palm(c, w * .78, h * 1.02, s * .55, false);
  }

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    paintScene(); draw();
  }
  // Zoom anchor: centre of the widest solid run across the middle of the letters, so at full zoom a stroke fills the screen.
  var MARK = "LN", anchors = {};
  function anchorX(font, F1, capMid) {
    var key = font + "|" + Math.round(F1);
    if (anchors[key] != null) return anchors[key];
    var c = document.createElement("canvas"), g = c.getContext("2d");
    g.font = font; var wT = Math.ceil(g.measureText(MARK).width) + 4;
    c.width = wT; c.height = 3;
    g.font = font; g.textBaseline = "alphabetic"; g.fillText(MARK, 0, capMid + 1);
    var row = g.getImageData(0, 1, wT, 1).data, best = [0, wT], len = -1, start = -1;
    for (var x = 0; x <= wT; x++) {
      var on = x < wT && row[x * 4 + 3] > 128;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { if (x - start > len) { len = x - start; best = [start, x]; } start = -1; }
    }
    return (anchors[key] = (best[0] + best[1]) / 2);
  }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function draw() {
    raf = 0;
    if (!W || !H) return; // nothing to draw while the page has no size yet (hidden tab or iframe)
    var rect = hero.getBoundingClientRect();
    var total = hero.offsetHeight - H;
    var p = reduce ? 1 : clamp(-rect.top / (total || 1));
    var m = ease(clamp(p / 0.62));
    var w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);

    var zoom = 1.3 - 0.3 * m;
    var sw = scene.width / 1.3 * zoom, sh = scene.height / 1.3 * zoom;
    ctx.drawImage(scene, (w - sw) / 2, (h - sh) / 2 - (1 - m) * h * 0.08, sw, sh);

    if (ready) {
      // Text is set at its final size and enlarged with a transform: browsers stop drawing glyphs at huge font sizes.
      var F1 = Math.min(w * 0.62, h * 0.62);
      var k = 1 + 45 * Math.pow(1 - m, 2.4);
      var font = "400 " + F1 + "px 'Bebas Neue', Impact, sans-serif";
      ctx.font = font;
      ctx.textBaseline = "alphabetic";
      var wT = ctx.measureText(MARK).width;
      var capMid = F1 * 0.36;
      var ax = anchorX(font, F1, capMid), ay = -capMid;
      var finalOx = w / 2 - wT / 2, finalOy = h * 0.47 + capMid;
      var finalAx = finalOx + ax, finalAy = finalOy + ay;
      var sx = w / 2 + (finalAx - w / 2) * m, sy = h / 2 + (finalAy - h / 2) * m;
      var ox = sx - ax * k, oy = sy - ay * k;
      ctx.save();
      ctx.setTransform(k, 0, 0, k, ox, oy);
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "#000"; ctx.fillText(MARK, 0, 0);
      ctx.restore();
      if (m > 0.6) {
        ctx.save();
        ctx.setTransform(k, 0, 0, k, ox, oy);
        ctx.globalAlpha = (m - 0.6) / 0.4;
        ctx.lineWidth = 3 * DPR / k; ctx.strokeStyle = "#19e3ff";
        ctx.shadowColor = "#19e3ff"; ctx.shadowBlur = 24 * DPR;
        ctx.strokeText(MARK, 0, 0);
        ctx.restore();
      }
    }
    var t = clamp((p - 0.55) / 0.25);
    title.style.opacity = t; title.style.transform = "translateY(" + (20 * (1 - t)) + "px)";
    hint.style.opacity = 1 - clamp(p / 0.15);
  }
  function req() { if (!raf) raf = requestAnimationFrame(draw); }

  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", size);
  size();
  var fontLoad = document.fonts && document.fonts.load ? document.fonts.load("400 100px 'Bebas Neue'") : Promise.resolve();
  Promise.race([fontLoad, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () { ready = true; draw(); });
})();
