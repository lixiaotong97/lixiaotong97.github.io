/* Sec. 5.4 qualitative examples: tabs, the source image (hover lens, click to enlarge) and the model's verbatim
   response, streamed in paragraph by paragraph when a case is opened. Data: assets/js/qual.js (tools/build_qual.py). */
(function () {
  'use strict';
  var Q = window.QUAL, root = document.getElementById('qv');
  if (!Q || !root) return;
  var motion = document.documentElement.classList.contains('motion');
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, cls, html, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function tex(scope) {
    if (!window.katex) return;
    Array.prototype.forEach.call(scope.querySelectorAll('.tex'), function (e) { try { katex.render(e.textContent, e, { throwOnError: false }); } catch (x) { } });
    Array.prototype.forEach.call(scope.querySelectorAll('.texd'), function (e) { try { katex.render(e.textContent, e, { throwOnError: false, displayMode: true }); } catch (x) { } });
  }

  var tabs = $('.qv-tabs', root), card = $('.qv-card', root), img = $('.qv-img', root), lens = $('.qv-lens', root), wrap = $('.qv-imgwrap', root);
  var title = $('.qv-title', root), qEl = $('.qv-q .qv-body', root), aEl = $('.qv-a .qv-body', root), scroller = $('.qv-text', root), cap = $('.qv-cap', root);
  var cur = -1, seen = false;
  var btns = Q.map(function (c, i) {
    var b = h('button', 'qv-tab', '<small>' + c.cat + '</small>' + c.tab, tabs);
    b.type = 'button'; b.setAttribute('role', 'tab');
    b.addEventListener('click', function () { show(i, true); });
    return b;
  });
  tabs.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var n = (cur + (e.key === 'ArrowRight' ? 1 : Q.length - 1)) % Q.length; show(n, true); btns[n].focus(); e.preventDefault();
  });

  function stream(nodes) {
    // paragraphs fade up one after another; long transcriptions settle within ~1.6 s
    var n = nodes.length, gap = Math.min(70, 1600 / Math.max(1, n));
    nodes.forEach(function (e, i) { e.classList.add('qv-in'); e.style.animationDelay = (120 + i * gap).toFixed(0) + 'ms'; });
  }
  function show(i, user) {
    if (i === cur) return;
    cur = i; var c = Q[i];
    btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
    card.setAttribute('data-shape', c.w > c.h * 1.2 ? 'wide' : c.w * c.h < 600000 ? 'small' : 'tall');
    card.classList.remove('qv-swap'); void card.offsetWidth; if (motion) card.classList.add('qv-swap');
    img.src = c.img; img.alt = c.title; img.width = c.w; img.height = c.h;
    title.textContent = c.title;
    qEl.innerHTML = c.q; aEl.innerHTML = c.a; cap.innerHTML = c.cap;
    tex(qEl); tex(aEl);
    scroller.scrollTop = 0;
    if (motion && (seen || user)) stream(Array.prototype.slice.call(aEl.children));
  }

  // magnifying lens over the source image
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches, Z = 2.6;
  if (fine) {
    wrap.addEventListener('mousemove', function (e) {
      var r = img.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.classList.remove('on'); return; }
      var L = lens.offsetWidth / 2, wr = wrap.getBoundingClientRect();
      lens.style.transform = 'translate(' + (e.clientX - wr.left - L) + 'px,' + (e.clientY - wr.top - L) + 'px)';
      lens.style.backgroundImage = 'url("' + img.currentSrc + '")';
      lens.style.backgroundSize = (r.width * Z) + 'px ' + (r.height * Z) + 'px';
      lens.style.backgroundPosition = (L - x * Z) + 'px ' + (L - y * Z) + 'px';
      lens.classList.add('on');
    });
    wrap.addEventListener('mouseleave', function () { lens.classList.remove('on'); });
  }

  show(0, false);
  // stream the first answer in when the viewer first scrolls into view
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect(); seen = true; root.classList.add('seen'); stream(Array.prototype.slice.call(aEl.children));
    }, { threshold: 0.35 });
    io.observe(card);
  } else { seen = true; root.classList.add('seen'); }
})();
