/* Animated paper figures (Figures 2, 3 and 5).
   The figure itself stays the paper's (a JPEG rasterized from the PDF). On top of it sits an SVG layer in the PDF's own
   units (assets/js/figdata.js): a pale veil that leaves the active modules lit, glowing outlines, and light flowing along
   the arrows, step by step in the order the paper describes. Everything is a pure function of the loop time t, so the
   step buttons can jump anywhere. Each loop ends with the paper's figure, unveiled.
   Debug: ?freeze=fig2:7.5 pins a figure at t = 7.5 s (for screenshots). */
(function () {
  'use strict';
  var FD = window.FIGDATA;
  var motion = document.documentElement.classList.contains('motion');
  var NS = 'http://www.w3.org/2000/svg';
  var freeze = (location.search.match(/[?&]freeze=([a-z0-9]+):([\d.]+)/) || []);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, a, parent) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  function h(tag, cls, html, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function env(t, t0, t1, fin, fout) { if (t < t0 || t > t1 + fout) return 0; return Math.min(sstep(t0, t0 + fin, t), 1 - sstep(t1, t1 + fout, t)); }
  function easeIO(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function ptsD(p) { return 'M' + p.map(function (q) { return q[0] + ' ' + q[1]; }).join('L'); }
  function grow(r, d) { return [r[0] - d, r[1] - d, r[2] + 2 * d, r[3] + 2 * d]; }
  function setRect(e, r) { e.setAttribute('x', r[0]); e.setAttribute('y', r[1]); e.setAttribute('width', Math.max(0, r[2])); e.setAttribute('height', Math.max(0, r[3])); }
  function op(e, a) { var s = a <= 0.002 ? '0' : a >= 0.998 ? '1' : a.toFixed(3); if (e._op !== s) { e._op = s; e.setAttribute('opacity', s); } }
  function plen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }

  // hot colours, matched to the figures' own module colours
  var HOT = { v: '#6a4cff', o: '#f26b1d', g: '#0fa572', b: '#1c7cf2', r: '#e8455f', y: '#e5a000', k: '#4b5563' };
  function col(c) { return HOT[c] || c; }

  /* ---------------- stage: the SVG layer over one figure ---------------- */
  function Stage(fig, D, id) {
    this.D = D; this.vb = D.vb; this.id = id; this.cues = [];
    var vb = D.vb, P = id;
    var svg = this.svg = el('svg', { 'class': 'afig-fx', viewBox: vb.join(' '), preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, fig);
    var defs = this.defs = el('defs', {}, svg);
    var fg = el('filter', { id: P + '-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 2.4 }, fg);
    var fs = el('filter', { id: P + '-soft', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3.2 }, fs);
    var mk = el('mask', { id: P + '-mask', maskUnits: 'userSpaceOnUse', x: vb[0] - 20, y: vb[1] - 20, width: vb[2] + 40, height: vb[3] + 40 }, defs);
    el('rect', { x: vb[0] - 20, y: vb[1] - 20, width: vb[2] + 40, height: vb[3] + 40, fill: '#fff' }, mk);
    this.gHole = el('g', { filter: 'url(#' + P + '-soft)' }, mk);
    this.veil = el('rect', { x: vb[0] - 2, y: vb[1] - 2, width: vb[2] + 4, height: vb[3] + 4, fill: '#fcfcfe', mask: 'url(#' + P + '-mask)', opacity: 0 }, svg);
    this.gTint = el('g', {}, svg);
    this.gRing = el('g', { fill: 'none' }, svg);
    this.gFlow = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    this.gTop = el('g', {}, svg);
    this.veilAt = function () { return 0; };
  }
  Stage.prototype.box = function (k) { if (typeof k !== 'string') return k; var b = this.D.box[k]; if (!b) throw new Error('box ' + k); return b; };
  Stage.prototype.path = function (k) { if (typeof k !== 'string') return k; var p = this.D.path[k]; if (!p) throw new Error('path ' + k); return p; };
  Stage.prototype.on = function (f) { this.cues.push(f); };

  // a module lights up: cut out of the veil, with a thin glowing outline (rounded box, or the module's own outline)
  Stage.prototype.lit = function (targets, c, t0, t1, o) {
    o = o || {}; var self = this, els = [], C = col(c);
    (Array.isArray(targets) && typeof targets[0] !== 'number' ? targets : [targets]).forEach(function (k) {
      var pad = o.pad == null ? 3 : o.pad, rx = o.rx == null ? 6 : o.rx;
      if (typeof k === 'string' && k.indexOf('poly:') === 0) {
        var d = ptsD(self.D.poly[k.slice(5)]) + 'Z';
        var hole = el('path', { d: d, fill: '#000', stroke: '#000', 'stroke-width': 2 * pad + 6, 'stroke-linejoin': 'round', opacity: 0 }, self.gHole); els.push(hole);
        if (o.ring !== false) {
          var halo = el('path', { d: d, stroke: C, 'stroke-width': 4, 'stroke-linejoin': 'round', opacity: 0, filter: 'url(#' + self.id + '-glow)' }, self.gRing); halo._k = 0.32;
          var ring = el('path', { d: d, stroke: C, 'stroke-width': 1.6, 'stroke-linejoin': 'round', opacity: 0 }, self.gRing); els.push(halo, ring);
        }
        return;
      }
      var r = self.box(k);
      var hl = el('rect', { rx: rx + 2, fill: '#000', opacity: 0 }, self.gHole); setRect(hl, grow(r, pad + 3)); els.push(hl);
      if (o.ring !== false) {
        var ha = el('rect', { rx: rx, stroke: C, 'stroke-width': 4, opacity: 0, filter: 'url(#' + self.id + '-glow)' }, self.gRing); setRect(ha, grow(r, pad)); ha._k = 0.32;
        var rg = el('rect', { rx: rx, stroke: C, 'stroke-width': 1.5, opacity: 0 }, self.gRing); setRect(rg, grow(r, pad)); els.push(ha, rg);
      }
      if (o.tint) { var tn = el('rect', { rx: rx, fill: C, opacity: 0 }, self.gTint); setRect(tn, grow(r, 1)); tn._k = o.tint; els.push(tn); }
    });
    this.on(function (t) { var a = env(t, t0, t1, o.fin || 0.35, o.fout || 0.45); els.forEach(function (e) { op(e, a * (e._k || 1)); }); });
  };

  // light flowing along an arrow, once: a bright head draws the arrow on and sparks where it lands; the arrow then
  // stays lit (steady, no further motion) until t1
  Stage.prototype.flow = function (pts, c, t0, t1, o) {
    o = o || {}; pts = this.path(pts);
    var d = ptsD(pts), C = col(c), L = plen(pts);
    var dur = o.dur || clamp(L / 140, 0.35, 0.9);
    var hole = el('path', { d: d, stroke: '#000', 'stroke-width': 9, opacity: 0 }, this.gHole);
    var trace = el('path', { d: d, stroke: C, 'stroke-width': o.w || 1.7, opacity: 0, 'stroke-dasharray': L + ' ' + (L + 2) }, this.gFlow);
    var seg = Math.min(o.seg || 22, L * 0.75);
    var halo = el('path', { d: d, stroke: C, 'stroke-width': 7, opacity: 0, filter: 'url(#' + this.id + '-glow)', 'stroke-dasharray': seg + ' ' + (L + seg + 2) }, this.gFlow);
    var core = el('path', { d: d, stroke: C, 'stroke-width': 2.8, opacity: 0, 'stroke-dasharray': seg + ' ' + (L + seg + 2) }, this.gFlow);
    var end = pts[pts.length - 1];
    var spark = el('circle', { cx: end[0], cy: end[1], r: 0, fill: C, opacity: 0, filter: 'url(#' + this.id + '-glow)' }, this.gTop);
    this.on(function (t) {
      if (t < t0 || t > t1 + 0.6) { op(trace, 0); op(core, 0); op(halo, 0); op(spark, 0); op(hole, 0); return; }
      var a = 1 - sstep(t1, t1 + 0.6, t);
      op(hole, a * sstep(t0, t0 + 0.2, t));
      var u = easeIO(clamp((t - t0) / dur, 0, 1));
      trace.setAttribute('stroke-dashoffset', (L * (1 - u)).toFixed(2));
      op(trace, 0.95 * a);
      var off = (seg - u * (L + seg)).toFixed(2), on = u > 0 && u < 1 ? 1 : 0;
      core.setAttribute('stroke-dashoffset', off); halo.setAttribute('stroke-dashoffset', off);
      op(core, on * a); op(halo, 0.65 * on * a);
      var s = (t - t0 - dur) / 0.5;
      if (o.spark !== false && s >= 0 && s <= 1) { spark.setAttribute('r', (2 + 7 * s).toFixed(2)); op(spark, 0.75 * (1 - s)); } else op(spark, 0);
    });
  };

  // cells light up one after another (codes being produced), and stay lit until t1
  Stage.prototype.cells = function (rects, c, t0, gap, t1, o) {
    o = o || {}; var self = this, C = col(c);
    rects.forEach(function (r, i) {
      var ts = t0 + i * gap;
      var hole = el('rect', { rx: 2, fill: '#000', opacity: 0 }, self.gHole); setRect(hole, grow(r, 2));
      var ring = el('rect', { rx: 2.5, fill: 'none', stroke: C, 'stroke-width': 1.4, opacity: 0 }, self.gRing); setRect(ring, grow(r, 1.2));
      var glow = el('rect', { rx: 2.5, fill: C, opacity: 0, filter: 'url(#' + self.id + '-glow)' }, self.gTint); setRect(glow, grow(r, 1));
      var cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
      self.on(function (t) {
        var a = env(t, ts, t1, 0.25, 0.45); op(hole, a); op(ring, a);
        var p = (t - ts) / 0.6, g = p >= 0 && p <= 1 ? Math.sin(Math.PI * p) : 0;
        op(glow, 0.35 * g * (o.glow == null ? 1 : o.glow));
        var sc = 1 + 0.18 * g;
        ring.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + sc.toFixed(3) + ') translate(' + (-cx) + ' ' + (-cy) + ')');
      });
    });
  };

  // a soft band of light sweeping across a box (patchify / scanning)
  Stage.prototype.scan = function (box, c, t0, dur, o) {
    o = o || {}; var r = this.box(box), C = col(c), id = this.id + '-sc' + (this.nScan = (this.nScan || 0) + 1);
    var cp = el('clipPath', { id: id }, this.defs); setRect(el('rect', { rx: 4 }, cp), r);
    var gr = el('linearGradient', { id: id + 'g', x1: 0, x2: 1, y1: 0, y2: 0 }, this.defs);
    el('stop', { offset: 0, 'stop-color': C, 'stop-opacity': 0 }, gr); el('stop', { offset: 0.75, 'stop-color': C, 'stop-opacity': 0.16 }, gr); el('stop', { offset: 1, 'stop-color': C, 'stop-opacity': 0.5 }, gr);
    var g = el('g', { 'clip-path': 'url(#' + id + ')' }, this.gTop), bw = r[2] * (o.band || 0.35);
    var band = el('rect', { y: r[1], height: r[3], width: bw, fill: 'url(#' + id + 'g)', opacity: 0 }, g);
    var edge = el('rect', { y: r[1], height: r[3], width: 1.2, fill: C, opacity: 0 }, g);
    var grid = null;
    if (o.grid) {
      grid = el('g', { stroke: C, 'stroke-width': 0.5, opacity: 0 }, g);
      for (var x = r[0] + o.grid; x < r[0] + r[2]; x += o.grid) el('line', { x1: x, x2: x, y1: r[1], y2: r[1] + r[3] }, grid);
      for (var y = r[1] + o.grid; y < r[1] + r[3]; y += o.grid) el('line', { x1: r[0], x2: r[0] + r[2], y1: y, y2: y }, grid);
    }
    this.on(function (t) {
      var p = (t - t0) / dur;
      if (p < 0 || p > 1.4) { op(band, 0); op(edge, 0); if (grid) op(grid, 0); return; }
      var x = r[0] - bw + easeIO(clamp(p, 0, 1)) * (r[2] + bw);
      band.setAttribute('x', x.toFixed(2)); edge.setAttribute('x', (x + bw - 0.6).toFixed(2));
      var a = 1 - sstep(1, 1.4, p); op(band, a); op(edge, 0.85 * a);
      if (grid) op(grid, 0.35 * env(t, t0, t0 + dur, 0.3, 0.5));
    });
  };

  // a small message travelling along a path: a pill with a label, or a little stack of code tiles
  Stage.prototype.packet = function (pts, t0, dur, o) {
    o = o || {}; pts = this.path(pts);
    var g = el('g', { opacity: 0 }, this.gTop), P = el('path', { d: ptsD(pts), fill: 'none', stroke: 'none' }, this.gTop);
    var w = o.w || 22, hh = o.h || 9, C = col(o.c || 'v');
    if (o.tiles) {
      var n = o.tiles.length, s = o.s || 5;
      o.tiles.forEach(function (tc, i) { el('rect', { x: -s / 2, y: -n * s / 2 + i * s, width: s - 0.6, height: s - 0.6, rx: 1, fill: tc, stroke: '#fff', 'stroke-width': 0.5 }, g); });
    } else {
      el('rect', { x: -w / 2 - 0.6, y: -hh / 2 - 0.6, width: w + 1.2, height: hh + 1.2, rx: hh / 2 + 0.6, fill: '#fff', opacity: 0.95 }, g);
      el('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: hh / 2, fill: C }, g);
      if (o.label) { var tx = el('text', { x: 0, y: hh * 0.27, 'text-anchor': 'middle', fill: '#fff', 'font-size': o.fs || 6, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif' }, g); tx.textContent = o.label; }
    }
    var L = plen(pts);
    this.on(function (t) {
      var p = (t - t0) / dur;
      if (p < 0 || p > 1) { op(g, 0); return; }
      var q = P.getPointAtLength(easeIO(p) * L);
      g.setAttribute('transform', 'translate(' + q.x.toFixed(2) + ' ' + q.y.toFixed(2) + ')');
      op(g, Math.min(1, p / 0.12, (1 - p) / 0.15));
    });
  };

  // an expanding ring (arrival, or "this updates")
  Stage.prototype.ripple = function (box, c, t0, o) {
    o = o || {}; var r = this.box(box), C = col(c);
    var e = el('rect', { rx: 6, fill: 'none', stroke: C, 'stroke-width': 1.4, opacity: 0 }, this.gTop);
    this.on(function (t) {
      var p = (t - t0) / (o.dur || 0.9);
      if (p < 0 || p > 1) { op(e, 0); return; }
      setRect(e, grow(r, 2 + 9 * easeIO(p))); op(e, 0.8 * (1 - p));
    });
  };

  Stage.prototype.render = function (t) {
    op(this.veil, this.veilAt(t));
    for (var i = 0; i < this.cues.length; i++) this.cues[i](t);
  };

  /* ---------------- player: the step bar, play/pause, loop ---------------- */
  function Player(root, def) {
    var fig = $('.afig-stage', root), D = FD[def.data], self = this;
    this.root = root; this.def = def; this.t = 0; this.playing = false; this.userPaused = false; this.inView = false;
    var S = this.S = new Stage(fig, D, root.id);
    def.build(S);
    var steps = def.steps, last = steps[steps.length - 1];
    this.T = def.T; this.Tmain = last.t1;
    S.veilAt = function (t) { return 0.74 * env(t, steps[0].t0 + 0.05, self.Tmain - 0.3, 0.5, 0.9); };
    // controls
    var bar = $('.afig-bar', root);
    this.btn = h('button', 'afig-play', '', bar); this.btn.type = 'button';
    var list = h('div', 'afig-steps', null, bar); list.setAttribute('role', 'tablist');
    list.style.gridTemplateColumns = 'repeat(' + steps.length + ', 1fr)';
    this.stepEls = steps.map(function (s, i) {
      var b = h('button', 'step', '<span class="track"><i></i></span><span class="num">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span class="lbl">' + s.label + '</span>', list);
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { self.seek(s.t0 + 0.001); if (!self.userPaused) self.play(); });
      return b;
    });
    this.btn.addEventListener('click', function () { if (self.playing) { self.userPaused = true; self.pause(); } else { self.userPaused = false; self.play(); } });
    this.stH = $('.afig-text h4', root); this.stP = $('.afig-text p', root); this.cur = -2;
    root.classList.add('is-live');
    this.seek(0);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      es.forEach(function (e) { self.inView = e.isIntersecting; if (self.inView && !self.userPaused) self.play(); else self.pause(); });
    }, { threshold: 0.3 }).observe(fig);
    document.addEventListener('visibilitychange', function () { if (document.hidden) self.pause(); else if (self.inView && !self.userPaused) self.play(); });
  }
  Player.prototype.stepAt = function (t) { var s = this.def.steps; for (var i = 0; i < s.length; i++) if (t >= s[i].t0 && t < s[i].t1) return i; return -1; };
  Player.prototype.seek = function (t) {
    this.t = t; this.S.render(t);
    var i = this.stepAt(t), steps = this.def.steps;
    this.stepEls.forEach(function (b, j) {
      var s = steps[j], p = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
      if (t >= this.Tmain) p = 1;
      var bi = b._i || (b._i = $('i', b)), sv = 'scaleX(' + p.toFixed(4) + ')';
      if (bi._s !== sv) { bi._s = sv; bi.style.transform = sv; }
      b.classList.toggle('is-on', j === i); b.setAttribute('aria-selected', j === i);
    }, this);
    if (i !== this.cur) {
      this.cur = i;
      var s = i >= 0 ? steps[i] : this.def.rest, H = this.stH, P = this.stP;
      [H, P].forEach(function (e) { e.classList.add('out'); });
      clearTimeout(this._sw);
      this._sw = setTimeout(function () { H.innerHTML = s.h; P.innerHTML = s.p; [H, P].forEach(function (e) { e.classList.remove('out'); }); }, 200);
    }
  };
  Player.prototype.play = function () {
    if (this.playing || freeze[1]) return;
    var self = this; this.playing = true; this.root.classList.add('is-playing'); this.last = 0;
    function tick(now) {
      if (!self.playing) return;
      var dt = self.last ? Math.min(0.1, (now - self.last) / 1000) : 0; self.last = now;
      var t = self.t + dt; if (t >= self.T) t = 0;
      self.seek(t);
      self.raf = requestAnimationFrame(tick);
    }
    this.raf = requestAnimationFrame(tick);
  };
  Player.prototype.pause = function () { this.playing = false; this.root.classList.remove('is-playing'); if (this.raf) cancelAnimationFrame(this.raf); };

  /* ---------------- the three figures ---------------- */
  var DEFS = {};

  // Figure 2: overview (a), ResMod (b), dual-branch objectives (c)
  DEFS.fig2 = {
    data: 'fig2', T: 26.5,
    rest: { h: 'The full pipeline', p: 'One frozen encoder, one Residual Modulator, one grouped quantizer: the same discrete codes feed the pixel and semantic decoders. Pick a step to replay it.' },
    steps: [
      { t0: 0, t1: 3.4, label: 'Any-resolution input', h: 'Any-resolution input', p: 'Images enter at their native resolution and aspect ratio, from a 1372-pixel newspaper page to a thin strip of text. Each is patchified on its own grid; nothing is resized to a fixed square.' },
      { t0: 3.4, t1: 6.6, label: 'Frozen encoder', h: 'Frozen representation encoder', p: 'A pretrained native-resolution ViT stays frozen in every stage, so its semantic structure is never overwritten by reconstruction objectives.' },
      { t0: 6.6, t1: 13.2, label: 'Residual Modulator', h: 'Residual Modulator', p: 'Features tapped from several encoder depths are fused, projected by a zero-initialized head, and turned into a token-wise scale and shift of the final semantic feature: <i>Z</i> = <i>S</i> + <i>γ</i>⊙<i>S</i> + <i>β</i>. At initialization <i>Z</i> = <i>S</i> exactly.' },
      { t0: 13.2, t1: 18.2, label: 'Grouped quantization', h: 'Grouped product quantization', p: 'Each position is split into <i>G</i> channel groups, each matched to its own codebook. The result is a short sequence of multi-group discrete tokens: higher capacity, same spatial length.' },
      { t0: 18.2, t1: 23.6, label: 'Dual decoders', h: 'Dual decoders', p: 'The same codes are decoded twice: to pixels (MSE + LPIPS + Gram) and back to the modulated features (cosine + MSE). Both objectives shape one shared vocabulary.' }
    ],
    build: function (S) {
      // 1 input
      S.lit('inputs', 'v', 0.2, 3.3, { pad: 2 });
      S.scan('inputs', 'v', 0.5, 2.2, { grid: 14, band: 0.3 });
      // 2 encoder
      S.lit('poly:encoder', 'o', 3.4, 6.5);
      S.lit('inputs', 'v', 3.4, 4.6, { ring: false, pad: 2 });
      ['#f6c7a1', '#f3ddc4', '#e9b893'].forEach(function (c, i) { S.packet([[200, 120 + i * 18], [262, 136], [279, 134]], 3.7 + i * 0.35, 1.2, { tiles: [c, '#f6eadd', c], s: 5 }); });
      S.ripple('snow', 'b', 4.6);
      S.scan('encoder', 'o', 4.3, 1.8, { band: 0.4 });
      // 3 ResMod: (a) multi-layer taps, then (b) in detail
      S.lit('poly:encoder', 'o', 6.6, 8.4, { ring: false });
      S.lit('resmod', 'v', 6.6, 13.1);
      S.flow('ml1', 'o', 6.8, 9.0); S.flow('ml2', 'o', 7.0, 9.0); S.flow('ml3', 'o', 7.2, 9.0);
      S.lit('panelB', 'v', 8.2, 13.1, { ring: false, pad: 1 });
      S.lit(['H1', 'H2', 'H3'], 'o', 8.4, 13.1, { pad: 1.5, rx: 3 });
      S.flow('h1', 'o', 8.8, 13.0); S.flow('h2', 'o', 8.9, 13.0); S.flow('h3', 'o', 9.0, 13.0);
      S.lit('fusion', 'v', 9.4, 13.1);
      S.flow('f2z', 'v', 9.9, 13.0); S.lit('zproj', 'k', 10.2, 13.1);
      S.flow('z2s', 'v', 10.6, 13.0); S.lit('shift', 'o', 10.9, 13.1);
      S.lit('Sfinal', 'r', 10.2, 13.1, { pad: 1.5, rx: 3 });
      S.flow('resS', 'o', 10.4, 13.0, { dur: 0.9 });
      S.flow('s2Z', 'v', 11.5, 13.0); S.lit('Z', 'v', 11.8, 13.1, { rx: 16 }); S.lit('eqB', 'v', 11.9, 13.1, { ring: false });
      S.ripple('Z', 'v', 12.1);
      // 4 grouped quantization
      S.lit('resmod', 'v', 13.2, 14.6, { ring: false });
      S.lit('poly:quant', 'g', 13.2, 18.1);
      S.lit('tokens', 'g', 13.6, 18.1, { pad: 1, rx: 8, ring: false });
      S.flow('q2tok', 'g', 13.7, 18.0, { dur: 0.4 });
      var rows = S.D.cells.tokrows, ncol = rows[0].length, order = [];
      for (var c = 0; c < ncol; c++) for (var r = 0; r < rows.length; r++) order.push(rows[r][c]);   // one position = one column of G codes
      S.cells(order, 'g', 14.1, 0.085, 18.0);
      S.flow('chan', 'k', 14.1, 18.0, { dur: 0.6, spark: false });
      S.flow('seq', 'k', 15.2, 18.0, { dur: 0.8, spark: false });
      // 5 dual decoders
      S.lit('tokens', 'g', 18.2, 19.6, { ring: false, pad: 1 });
      S.flow('tok2proj', 'b', 18.3, 23.5, { dur: 0.4 });
      S.lit('poly:proj', 'g', 18.5, 23.5); S.lit('poly:vitdec', 'b', 18.9, 23.5);
      S.scan('vitdec', 'b', 19.0, 1.4, { band: 0.5 });
      S.lit('panelC', 'b', 20.0, 23.5, { ring: false, pad: 1 });
      S.lit('grid', 'v', 20.1, 23.5, { rx: 8 });
      S.cells(S.D.cells.mod, 'v', 20.2, 0.03, 23.5, { glow: 0.6 });
      S.flow('c2pix', 'b', 20.8, 23.4); S.flow('c2sem', 'o', 20.8, 23.4);
      S.lit('poly:pixdec', 'b', 21.2, 23.5); S.lit('poly:semdec', 'o', 21.2, 23.5);
      S.flow('pix2out', 'b', 21.7, 23.4); S.flow('sem2out', 'o', 21.7, 23.4);
      S.lit('pixout', 'b', 22.1, 23.5, { pad: 1 }); S.lit('semout', 'o', 22.1, 23.5, { pad: 1 });
    }
  };

  // Figure 3: tokenization (a) and the three uses of the codes (b-d)
  DEFS.fig3 = {
    data: 'fig3', T: 25,
    rest: { h: 'One set of codes, three uses', p: 'Understanding embeds the indices with new tables; reconstruction and generation decode them through the frozen codebooks and the same pixel decoder.' },
    steps: [
      { t0: 0, t1: 6, label: 'Visual tokenization', h: '(a) Visual tokenization', p: 'At each position the modulated feature <i>z<sub>t</sub></i> is split into <i>G</i> channel groups. Each group picks its nearest entry in its own frozen codebook <i>ℰ</i><sup>(g)</sup>, giving <i>G</i> indices and their embeddings.' },
      { t0: 6, t1: 11, label: 'Understanding', h: '(b) Understanding', p: 'The language model sees only the indices: newly initialized group-wise embedding tables <i>W</i><sup>(1…G)</sup>, trained jointly with the LM, embed them; the embeddings are concatenated and passed to the LLM.' },
      { t0: 11, t1: 16, label: 'Reconstruction', h: '(c) Reconstruction', p: 'The same indices are looked up in the frozen tokenizer codebooks; the concatenated embeddings go to the pixel decoder <i>𝒟</i><sub>pix</sub>.' },
      { t0: 16, t1: 22.4, label: 'Generation & editing', h: '(d) Generation & editing', p: 'A multi-sub-token head on the LLM predicts each position\'s indices one after another, optionally conditioned on a reference image, then decodes them through the same frozen codebooks and pixel decoder.' }
    ],
    build: function (S) {
      var A = S.D.rowsA, colors = ['r', 'g', 'b'];
      A.forEach(function (R, i) {
        var d = i * 0.35, c = colors[i];
        S.lit(R.feat, 'v', 0.2 + d, 5.9, { pad: 2, rx: 3 });
        S.flow(R.a[0], 'v', 0.6 + d, 5.8);
        S.lit(R.z, 'v', 1.0 + d, 5.9, { pad: 2, rx: 3 });
        S.flow(R.a[1], 'g', 1.4 + d, 5.8);
        S.lit(R.cb, 'g', 1.9 + d, 5.9, { pad: 2, rx: 4 });
        S.scan(R.cb, 'g', 1.9 + d, 0.9, { band: 0.6 });
        S.flow(R.a[2], c, 2.7 + d, 5.8);
        S.lit(R.id, c, 3.2 + d, 5.9, { pad: 2, rx: 7 }); S.ripple(R.id, c, 3.3 + d);
        S.flow(R.a[3], 'g', 3.7 + d, 5.8);
        S.lit(R.emb, 'g', 4.1 + d, 5.9, { pad: 2, rx: 3 });
      });
      // (b) understanding
      S.lit('lblB', 'k', 6.0, 10.9, { ring: false });
      S.lit('b_img', 'k', 6.1, 10.9, { pad: 2, rx: 3 });
      S.flow('img53', 'k', 6.4, 10.8); S.lit('poly:b_enc', 'g', 6.7, 10.9);
      S.flow('img55', 'g', 7.1, 10.8);
      S.lit('b_id1', 'r', 7.4, 10.9, { rx: 6 }); S.lit('b_id2', 'g', 7.55, 10.9, { rx: 6 }); S.lit('b_id3', 'b', 7.7, 10.9, { rx: 6 });
      S.flow('img56', 'y', 8.0, 10.8); S.lit('b_tab', 'y', 8.3, 10.9, { rx: 4 }); S.ripple('b_fire', 'o', 8.4);
      S.flow('img69', 'y', 8.7, 10.8); S.lit('b_cat', 'y', 8.9, 10.9, { rx: 12 });
      S.flow('img67', 'k', 9.3, 10.8); S.lit('b_llm', 'k', 9.5, 10.9, { rx: 14 }); S.scan('b_llm', 'k', 9.5, 0.9);
      S.flow('img68', 'k', 9.9, 10.8); S.lit('b_txt', 'v', 10.1, 10.9, { ring: false });
      S.packet('img55', 7.0, 0.7, { tiles: ['#f3c5c5', '#d4ecc8', '#c9dcf2'], s: 4.4 });
      // (c) reconstruction
      S.lit('lblC', 'k', 11.0, 15.9, { ring: false });
      S.lit('c_img', 'k', 11.1, 15.9, { pad: 2, rx: 3 });
      S.flow('img86', 'k', 11.4, 15.8); S.lit('poly:c_enc', 'g', 11.7, 15.9);
      S.flow('img88', 'g', 12.1, 15.8);
      S.lit('c_id1', 'r', 12.4, 15.9, { rx: 6 }); S.lit('c_id2', 'g', 12.55, 15.9, { rx: 6 }); S.lit('c_id3', 'b', 12.7, 15.9, { rx: 6 });
      S.packet('img88', 12.0, 0.7, { tiles: ['#f3c5c5', '#d4ecc8', '#c9dcf2'], s: 4.4 });
      S.flow('img89', 'g', 13.0, 15.8); S.lit('c_cb', 'g', 13.3, 15.9, { rx: 4 });
      S.flow('img84', 'g', 13.7, 15.8); S.lit('c_cat', 'g', 13.9, 15.9, { rx: 12 });
      S.flow('img31', 'b', 14.3, 15.8); S.lit('poly:pixdec', 'b', 14.5, 15.9);
      S.flow('img48', 'b', 14.9, 15.8); S.lit('c_out', 'b', 15.1, 15.9, { pad: 2, rx: 3 }); S.ripple('c_out', 'b', 15.2);
      // (d) generation & editing
      S.lit('lblD', 'k', 16.0, 22.3, { ring: false });
      S.lit(['d_ref', 'd_txt'], 'k', 16.1, 22.3, { pad: 2, rx: 3 }); S.lit(['d_reflbl', 'd_slash'], 'k', 16.1, 22.3, { ring: false });
      S.flow('img70', 'k', 16.5, 22.2); S.lit('d_llm', 'k', 16.8, 22.3, { rx: 10 }); S.scan('d_llm', 'k', 16.8, 0.8);
      S.flow('img32', 'r', 17.3, 22.2); S.lit('d_msh', 'r', 17.5, 22.3, { rx: 8, ring: false });
      S.lit('d_s1', 'r', 17.7, 22.3, { rx: 6 }); S.flow('img33', 'r', 18.0, 22.2);
      S.lit('d_s2', 'g', 18.3, 22.3, { rx: 6 }); S.flow('img34', 'r', 18.6, 22.2); S.flow('img35', 'r', 18.9, 22.2);
      S.lit('d_s3', 'b', 19.2, 22.3, { rx: 6 }); S.ripple('d_s3', 'b', 19.3);
      S.flow('img28', 'g', 19.5, 22.2); S.lit('d_cb', 'g', 19.8, 22.3, { rx: 4 });
      S.flow('img46', 'g', 20.2, 22.2); S.lit('d_cat', 'g', 20.4, 22.3, { rx: 12 });
      S.flow('img47', 'b', 20.8, 22.2); S.lit('poly:pixdec', 'b', 21.0, 22.3);
      S.flow('img50', 'b', 21.4, 22.2); S.lit('d_out', 'b', 21.6, 22.3, { pad: 2, rx: 3 }); S.ripple('d_out', 'b', 21.7);
    }
  };

  // Figure 5: the code-conditioned Refiner and what each change buys
  DEFS.fig5 = {
    data: 'fig5', T: 24,
    rest: { h: 'Same codes, sharper pixels', p: 'The Refiner changes only the decoder: the discrete codes, and everything built on them, stay the same.' },
    steps: [
      { t0: 0, t1: 4.8, label: 'Code conditioning', h: 'Two conditioning paths', p: 'Discrete code embeddings condition the decoder twice: a context adapter turns them into context tokens concatenated with the noise latents, and a time-aware spatial adapter maps them to a 2<i>h</i>×2<i>w</i> residual grid.' },
      { t0: 4.8, t1: 10, label: 'Flow transformer', h: 'Flow transformer with zero-init injection', p: 'Pretrained DiT blocks denoise the latents at timestep <i>t</i>. Spatially aligned residuals are injected into selected blocks through zero-initialized projections, so the added path initially preserves the backbone computation.' },
      { t0: 10, t1: 13.4, label: 'One-step decode', h: 'One-step decode, no text', p: 'A frozen VAE decoder turns the latents into a 2<i>H</i>×2<i>W</i> image. A multi-step teacher is distilled into a one-step student, and no text condition is needed.' },
      { t0: 13.4, t1: 21.6, label: 'What each change buys', h: 'What each change buys', p: 'More quantization groups (G16 → G64) improve fidelity. Decoding G16 codes with the Refiner (R52: 52 steps) recovers sharper detail, and one-step distillation (R1) keeps it at a single step.' }
    ],
    build: function (S) {
      // 1 conditioning
      S.lit('codes', 'v', 0.2, 4.7, { pad: 2, rx: 3 }); S.lit('codes_lbl', 'v', 0.2, 4.7, { ring: false }); S.ripple('codes', 'v', 0.3);
      S.flow('c2ctx', 'v', 0.7, 4.6); S.lit('ctx', 'v', 1.0, 4.7, { rx: 8 });
      S.flow('ctx2seq', 'v', 1.5, 4.6); S.lit('seq', 'v', 1.8, 4.7, { rx: 3 }); S.lit(['seq_lbl', 'seq_lbl2'], 'v', 1.8, 4.7, { ring: false });
      S.flow('c2spa', 'g', 2.3, 4.6, { dur: 0.8 }); S.lit('spa', 'g', 2.9, 4.7, { rx: 8 });
      S.flow('spa2lat', 'g', 3.4, 4.6); S.lit('lat', 'g', 3.7, 4.7, { pad: 2, rx: 2 }); S.lit('lat_lbl', 'g', 3.7, 4.7, { ring: false }); S.ripple('lat', 'g', 3.8);
      S.packet('c2ctx', 0.6, 0.8, { tiles: ['#f6e19a', '#f1b98a', '#cdbbe8'], s: 4.5 });
      // 2 flow transformer
      S.lit('seq', 'v', 4.8, 9.9, { rx: 3, ring: false }); S.lit('lat', 'g', 4.8, 9.9, { pad: 2, rx: 2, ring: false }); S.lit('lat_lbl', 'g', 4.8, 9.9, { ring: false });
      S.lit('flow', 'b', 4.9, 9.9, { pad: 1, rx: 8, ring: false });
      S.flow('seq2dit', 'b', 5.1, 9.8); S.lit('dit1', 'b', 5.4, 9.9, { rx: 8 });
      S.flow('d12', 'b', 6.2, 9.8); S.lit('dit2', 'b', 6.5, 9.9, { rx: 8 });
      S.flow('d2dots', 'b', 7.3, 9.8); S.flow('dots2d3', 'b', 7.6, 9.8); S.lit('dit3', 'r', 7.9, 9.9, { rx: 8 });
      S.lit('zinj', 'g', 5.2, 9.9, { ring: false }); S.flow('inj1', 'g', 5.2, 9.8, { dur: 0.7 }); S.flow('inj2', 'g', 6.3, 9.8, { dur: 0.9 }); S.flow('inj3', 'g', 7.4, 9.8, { dur: 1.1 });
      S.ripple('dit1', 'g', 5.95); S.ripple('dit2', 'g', 7.25); S.ripple('dit3', 'g', 8.55);
      S.lit('tclock', 'b', 5.0, 9.9, { rx: 8 }); S.ripple('tclock', 'b', 8.9);
      // 3 decode
      S.lit('dit3', 'r', 10.0, 11.2, { rx: 8, ring: false });
      S.flow('d2vae', 'k', 10.1, 13.3); S.lit('vae', 'k', 10.5, 13.3, { rx: 8 }); S.scan('vae', 'k', 10.5, 0.9);
      S.flow('vae2out', 'k', 11.0, 13.3); S.lit('out', 'v', 11.4, 13.3, { pad: 2, rx: 3 }); S.lit('out_lbl', 'v', 11.4, 13.3, { ring: false }); S.scan('out', 'v', 11.4, 1.1, { band: 0.5 });
      S.lit('ours', 'g', 11.9, 13.3, { ring: false, pad: 1 });
      // 4 comparison
      S.lit(['in', 'g16', 'g64'], 'k', 13.4, 15.6, { ring: false, pad: 2 });
      S.lit(['g16', 'g64'], 'b', 13.6, 15.6, { pad: 2, rx: 3 }); S.flow('scale', 'b', 13.7, 15.5, { dur: 1.0 }); S.lit('l_scale', 'b', 14.2, 15.6, { ring: false });
      S.lit(['z_g16', 'z_g64'], 'b', 14.3, 15.6, { pad: 1, rx: 2 });
      S.lit(['in', 'g16', 'r52'], 'k', 15.8, 18.4, { ring: false, pad: 2 });
      S.lit(['g16', 'r52'], 'o', 16.0, 18.4, { pad: 2, rx: 3 }); S.flow('diff', 'o', 16.1, 18.3, { dur: 1.1 }); S.lit('l_diff', 'o', 16.6, 18.4, { ring: false });
      S.lit(['z_g16', 'z_r52'], 'o', 16.7, 18.4, { pad: 1, rx: 2 });
      S.lit(['in', 'r52', 'r1'], 'k', 18.6, 21.5, { ring: false, pad: 2 });
      S.lit(['r52', 'r1'], 'g', 18.8, 21.5, { pad: 2, rx: 3 }); S.flow('one', 'g', 18.9, 21.4, { dur: 1.0 }); S.lit('l_one', 'g', 19.4, 21.5, { ring: false });
      S.lit(['z_r52', 'z_r1'], 'g', 19.5, 21.5, { pad: 1, rx: 2 });
    }
  };

  /* ---------------- boot ---------------- */
  if (!FD || !motion) return;   // reduced motion or no data: the paper's figures, unchanged
  $$('.afig[data-afig]').forEach(function (root) {
    var def = DEFS[root.getAttribute('data-afig')];
    if (!def) return;
    var img = $('.afig-stage img', root);
    function start() {
      try {
        var p = new Player(root, def);
        if (freeze[1] === root.getAttribute('data-afig')) p.seek(+freeze[2]);
      } catch (e) { root.classList.remove('is-live'); if (window.console) console.warn(e); }
    }
    if (img.complete) start(); else img.addEventListener('load', start);
  });
})();
