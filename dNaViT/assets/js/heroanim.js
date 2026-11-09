/* Hero: the paper's Figure 1 built up element by element (WorldCast-style layered figure).
   Every layer is the full render (assets/fig/teaser_full.jpg) clipped to one element's box, laid over a render of the
   panel backgrounds only; each enters with its own motion and delay (assets/js/hero.js, tools/build_hero.py).
   Plays once when it comes into view; Replay restarts it. Without motion the figure is shown as is. */
(function () {
  'use strict';
  var H = window.HERO, fig = document.getElementById('hero-fig');
  if (!H || !fig) return;
  var motion = document.documentElement.classList.contains('motion');
  if (!motion) { fig.classList.add('play'); return; }   // the static <img> stays
  var stage = fig.querySelector('.hf-stage'), still = stage.querySelector('.hf-static'), replay = fig.querySelector('.hf-replay');
  var FULL = 'assets/fig/teaser_full.jpg?v=87b', BASE = 'assets/fig/teaser_base.jpg';
  function inset(t, r, b, l) { return 'inset(' + [t, r, b, l].map(function (v) { return Math.max(0, v).toFixed(3) + '%'; }).join(' ') + ')'; }

  var html = '<img class="hf-sizer" src="' + BASE + '" alt="" aria-hidden="true"><img class="hf-base" src="' + BASE + '" alt="" aria-hidden="true" data-zoom data-full="' + FULL + '">';
  H.layers.forEach(function (L) {
    var x = L.r[0], y = L.r[1], w = L.r[2], h = L.r[3], p = 0.15;
    var c1 = inset(y - p, 100 - x - w - p, 100 - y - h - p, x - p), c0 = c1;
    if (L.k === 'wipe-right') c0 = inset(y - p, 100 - x + p, 100 - y - h - p, x - p);   // zero width
    if (L.k === 'wipe-down') c0 = inset(y - p, 100 - x - w - p, 100 - y + p, x - p);   // zero height
    var st = '--c0:' + c0 + ';--c1:' + c1 + ';--d:' + L.d.toFixed(2) + 's;transform-origin:' + (x + w / 2).toFixed(2) + '% ' + (y + h / 2).toFixed(2) + '%;';
    if (L.c) st += '--cx:' + L.c[0] + '%;--cy:' + L.c[1] + '%;';
    html += '<img class="hf-l k-' + L.k + '" src="' + FULL + '" alt="" aria-hidden="true" decoding="async" data-zoom data-full="' + FULL + '" style="' + st + '">';
  });
  var holder = document.createElement('div'); holder.innerHTML = html;
  var imgs = Array.prototype.slice.call(holder.querySelectorAll('img'));

  function ready(cb) {
    var n = 0, need = 2, done = false;
    [FULL, BASE].forEach(function (u) { var im = new Image(); im.onload = im.onerror = function () { if (++n === need && !done) { done = true; cb(); } }; im.src = u; });
  }
  function play() { fig.classList.remove('play'); void fig.offsetWidth; fig.classList.add('play'); }
  ready(function () {
    imgs.forEach(function (im) { stage.appendChild(im); });
    if (still) still.remove();
    replay.hidden = false;
    replay.addEventListener('click', play);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect(); requestAnimationFrame(function () { requestAnimationFrame(play); });
      }, { threshold: 0.25 });
      io.observe(stage);
    } else play();
  });
})();
