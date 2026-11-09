/* Reconstruction cards (Reconstruction section): PiD-style drag-to-compare,
   ViT pixel decoder vs. code-conditioned Refiner on the same codes.
   Images: assets/rc/cNN/{orig,g16,g64,rf1}.webp; either side can show any of the four (1024 px wide, encoder-input aspect), loaded only when the grid nears the viewport. */
(function () {
  'use strict';
  function src(id, k) { return 'assets/rc/c' + (id < 10 ? '0' : '') + id + '/' + k + '.webp'; }
  function el(tag, cls, html, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

  /* ---------- the draggable comparison ---------- */
  var ARROWS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg>';
  function Compare(host, o) {
    o = o || {};
    var root = el('div', 'cmp', null, host), x = 50, zoom = 1, ox = 50, oy = 50, drag = false;
    var r = el('div', 'cmp-z', '<img alt="" draggable="false">', root);
    var lc = el('div', 'cmp-l', null, root);
    var l = el('div', 'cmp-z', '<img alt="" draggable="false">', lc);
    var tl = el('span', 'cmp-tag l', '', root), tr = el('span', 'cmp-tag r', '', root);
    var hd = el('div', 'cmp-h', '<i></i>', root);
    var knob = el('button', 'cmp-k', ARROWS, hd);
    knob.type = 'button'; knob.setAttribute('role', 'slider'); knob.setAttribute('aria-valuemin', '0'); knob.setAttribute('aria-valuemax', '100');
    var li = l.firstChild, ri = r.firstChild;
    function setX(v) {
      x = Math.max(0, Math.min(100, v)); root.style.setProperty('--x', x + '%');
      knob.setAttribute('aria-valuenow', Math.round(x));
      tl.style.opacity = x < 12 ? 0 : 1; tr.style.opacity = x > 88 ? 0 : 1;
    }
    function setOrigin() { var t = 'scale(' + zoom + ')', og = ox + '% ' + oy + '%'; [l, r].forEach(function (z) { z.style.transform = t; z.style.transformOrigin = og; }); }
    function rel(e) { var b = root.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100]; }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (zoom > 1 && !knob.contains(e.target)) return;            // when zoomed, only the knob moves the divider
      drag = true; root.classList.add('is-drag'); try { root.setPointerCapture(e.pointerId); } catch (_) { }
      setX(rel(e)[0]); e.preventDefault();
    });
    root.addEventListener('pointermove', function (e) {
      var p = rel(e);
      if (drag) { setX(p[0]); return; }
      if (zoom > 1 && e.pointerType === 'mouse') { ox = Math.max(0, Math.min(100, p[0])); oy = Math.max(0, Math.min(100, p[1])); setOrigin(); }
    });
    function end() { drag = false; root.classList.remove('is-drag'); }
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    knob.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : e.key === 'Home' ? -100 : e.key === 'End' ? 100 : 0;
      if (d) { setX(x + d); e.preventDefault(); }
    });
    var token = 0;
    this.set = function (ls, rs, ll, rl, ar) {
      var t = ++token, n = 0; root.classList.add('is-loading');
      if (ar) root.style.aspectRatio = ar;
      tl.textContent = ll; tr.textContent = rl; knob.setAttribute('aria-label', 'Divider: left ' + ll + ', right ' + rl);
      [[li, ls], [ri, rs]].forEach(function (p) {
        var im = new Image();
        im.onload = im.onerror = function () { if (t !== token) return; p[0].src = p[1]; if (++n === 2) { root.classList.remove('is-loading'); root.classList.add('has-img'); } };
        im.src = p[1];
      });
      li.alt = ll; ri.alt = rl;
    };
    this.zoom = function (z, cx, cy) { zoom = z; if (cx != null) { ox = cx; oy = cy; } root.classList.toggle('is-zoom', z > 1); setOrigin(); };
    this.root = root;
    setX(o.x != null ? o.x : 50);
  }

  function whenNear(node, fn) {   // load images only once the block approaches the viewport
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: '600px 0px' });
    io.observe(node);
  }

  var grid = document.getElementById('rf-grid');
  if (!grid) return;
  var PICK = [[53, 'Fur and fine hair', 1024, 1024], [57, 'Hand-drawn map, small text', 1024, 672], [40, 'Portrait', 1024, 1024], [29, 'Signage at a distance', 1024, 1024], [36, 'Embroidered fabric', 1024, 1024], [11, 'Ornate facade', 1024, 1024]];
  var NAME = { orig: 'Original', g16: 'Pixel decoder · G16', g64: 'Pixel decoder · G64', rf1: 'Refiner · 1-step' };
  var cards = [], L = 'g16', R = 'rf1', live = false;
  PICK.forEach(function (p) {
    var card = el('div', 'rf-card', null, grid);
    var cmp = new Compare(el('div', 'rf-stage', null, card), { x: 50 });
    el('div', 'rf-foot', '<span><b>' + p[1] + '</b> · case ' + p[0] + '</span>', card);
    cards.push({ p: p, cmp: cmp });
  });
  // cards stay square; non-square cases are center-cropped (both layers alike)
  function draw() { if (!live) return; cards.forEach(function (k) { k.cmp.set(src(k.p[0], L), src(k.p[0], R), NAME[L], NAME[R]); k.cmp.root.querySelector('.cmp-tag.l').classList.toggle('rf', L === 'rf1'); k.cmp.root.querySelector('.cmp-tag.r').classList.toggle('rf', R === 'rf1'); }); }
  function seg(id, cb) {
    var bs = document.querySelectorAll('#' + id + ' button');
    Array.prototype.forEach.call(bs, function (b) { b.addEventListener('click', function () { Array.prototype.forEach.call(bs, function (o) { o.setAttribute('aria-pressed', o === b); }); cb(b.dataset.v); }); });
  }
  seg('rf-l', function (v) { L = v; draw(); });
  seg('rf-r', function (v) { R = v; draw(); });
  seg('rf-zoom', function (v) { cards.forEach(function (k) { k.cmp.zoom(+v); }); });
  whenNear(grid, function () { live = true; draw(); });
})();
