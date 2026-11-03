/* Landing screen: a wipe into the site when Enter is pressed, plus pointer parallax and a
   magnetic Enter button. Decoration only: the button is an ordinary link and works without
   any of this. The wipe is off for reduced motion; pointer effects are off on touch. */
(function () {
  'use strict';
  var land = document.querySelector('.land');
  if (!land) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var btn = land.querySelector('.enter');

  /* a green circle grows out of the button, then the site loads */
  if (btn && !RM) {
    btn.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var w = document.createElement('div');
      w.className = 'wipe';
      w.style.left = x + 'px';
      w.style.top = y + 'px';
      document.body.appendChild(w);
      var far = Math.sqrt(Math.pow(Math.max(x, innerWidth - x), 2) + Math.pow(Math.max(y, innerHeight - y), 2));
      void w.getBoundingClientRect();
      w.style.transform = 'translate(-50%,-50%) scale(' + ((far * 2.2) / 12).toFixed(1) + ')';
      setTimeout(function () { location.href = btn.href; }, 740);
    });
  }
  /* coming back with the browser's back button should not show a stuck wipe */
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    var w = document.querySelector('.wipe');
    if (w && w.parentNode) w.parentNode.removeChild(w);
  });

  if (RM || coarse) return;

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
