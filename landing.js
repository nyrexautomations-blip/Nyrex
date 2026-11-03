/* Landing screen: pointer parallax and an orb ripple. Decoration only; off for reduced motion. */
(function () {
  'use strict';
  var land = document.querySelector('.land');
  if (!land) return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var stage = land.querySelector('.land-stage'), orb = land.querySelector('.orb-xl');
  if (RM) return;

  if (!coarse) {
    var tx = 0, ty = 0, cx = 0, cy = 0, q = false;
    var step = function () {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      land.style.setProperty('--px', cx.toFixed(3));
      land.style.setProperty('--py', cy.toFixed(3));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) requestAnimationFrame(step); else q = false;
    };
    var kick = function () { if (!q) { q = true; requestAnimationFrame(step); } };
    land.addEventListener('pointermove', function (e) {
      var r = land.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    }, { passive: true });
    land.addEventListener('pointerleave', function () { tx = ty = 0; kick(); });
  }

  function ping() {
    var r = document.createElement('span');
    r.className = 'ripple';
    stage.appendChild(r);
    r.addEventListener('animationend', function () { if (r.parentNode) r.parentNode.removeChild(r); });
  }
  if (orb) orb.addEventListener('pointerdown', ping);
  setInterval(function () { if (!document.hidden) ping(); }, 5200);
  setTimeout(ping, 1400);
})();
