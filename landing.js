/* Landing screen: pointer parallax and a magnetic Enter button.
   Decoration only; off for reduced motion, and no pointer effects on touch. */
(function () {
  'use strict';
  var land = document.querySelector('.land');
  if (!land) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (RM || coarse) return;

  var btn = land.querySelector('.enter');
  var tx = 0, ty = 0, cx = 0, cy = 0, q = false;

  function step() {
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    land.style.setProperty('--px', cx.toFixed(3));
    land.style.setProperty('--py', cy.toFixed(3));
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) requestAnimationFrame(step); else q = false;
  }
  function kick() { if (!q) { q = true; requestAnimationFrame(step); } }

  land.addEventListener('pointermove', function (e) {
    var r = land.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
    if (btn) {
      var b = btn.getBoundingClientRect();
      var dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 170) btn.style.translate = (dx * 0.22).toFixed(1) + 'px ' + (dy * 0.3).toFixed(1) + 'px';
      else btn.style.translate = '0 0';
    }
  }, { passive: true });
  land.addEventListener('pointerleave', function () {
    tx = ty = 0; kick();
    if (btn) btn.style.translate = '0 0';
  });
})();
