/* Nyrex motion layer. Plain JS, no libraries.
   Everything here is decoration: the site works without it, and the heavy
   parts (bubbles, scroll-driven bits) stay off when the visitor prefers reduced motion. */
(function () {
  'use strict';
  var LITE = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
  if (LITE) document.documentElement.classList.add('fx-lite');
  /* heavy tier (WebGL, particle trail) only on capable desktops; ?fx=heavy / ?fx=lite force it for previews */
  var QS = location.search;
  var HEAVY = false;
  try {
    HEAVY = !/[?&]fx=lite/.test(QS) && (/[?&]fx=heavy/.test(QS) || (
      !LITE && window.innerWidth >= 1024 &&
      matchMedia('(pointer: fine)').matches && matchMedia('(hover: hover)').matches &&
      (navigator.hardwareConcurrency || 4) >= 6 &&
      (navigator.deviceMemory == null || navigator.deviceMemory >= 4) &&
      !(navigator.connection && navigator.connection.saveData)));
  } catch (e) {}
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var NS = 'http://www.w3.org/2000/svg';

  /* ---- 1. icons draw themselves (CSS does the animation, this only sets pathLength) ---- */
  try {
    $$('.fgrid .ico svg, .facts svg').forEach(function (svg) {
      svg.classList.add('fx-draw');
      $$('path,circle,rect,line,polyline', svg).forEach(function (el) { el.setAttribute('pathLength', '1'); });
    });
  } catch (e) {}

  /* ---- 2. chat-bubble field on the hero, page heads, dark bands ---- */
  function bubbles(host, dark) {
    var c = document.createElement('canvas');
    c.className = 'fx-bubbles';
    c.setAttribute('aria-hidden', 'true');
    host.insertBefore(c, host.firstChild);
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var items = [], running = false, visible = false, mx = -1e4, my = -1e4, last = 0;
    var line = dark ? '126,226,184' : '8,133,96';

    function make(init) {
      var s = 24 + Math.random() * 56;
      return {
        x: Math.random() * w, y: init ? Math.random() * h : h + s * 1.4, s: s,
        v: 0.12 + Math.random() * 0.3, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.8,
        dots: Math.random() < 0.3, mine: Math.random() < 0.5, a: 0.12 + Math.random() * 0.16, push: 0
      };
    }
    function size() {
      var r = host.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(clamp(w * h / 110000, 5, 10));
      while (items.length < n) items.push(make(true));
      items.length = n;
    }
    function rr(x, y, bw, bh, r, tailRight) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + bw, y, x + bw, y + bh, r);
      ctx.arcTo(x + bw, y + bh, x, y + bh, tailRight ? 2 : r);
      ctx.arcTo(x, y + bh, x, y, tailRight ? r : 2);
      ctx.arcTo(x, y, x + bw, y, r);
      ctx.closePath();
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < items.length; i++) {
        var b = items[i];
        var bw = b.s * 1.55, bh = b.s;
        var dx = b.x - mx, dy = b.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { b.push = Math.min(1, b.push + 0.08); b.x += dx / (Math.sqrt(d2) + 1) * 1.6; b.y += dy / (Math.sqrt(d2) + 1) * 1.6; }
        else b.push *= 0.95;
        b.y -= b.v; b.ph += 0.01 * b.sp;
        var x = b.x + Math.sin(b.ph) * 14, y = b.y;
        if (y < -bh * 1.5) { items[i] = make(false); continue; }
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(' + line + ',' + (b.a + b.push * 0.25) + ')';
        rr(x, y, bw, bh, bh * 0.32, b.mine);
        if (b.mine) { ctx.fillStyle = 'rgba(' + line + ',' + (b.a * 0.35) + ')'; ctx.fill(); }
        ctx.stroke();
        if (b.dots) {
          ctx.fillStyle = 'rgba(' + line + ',' + (b.a + 0.1) + ')';
          for (var k = 0; k < 3; k++) {
            var o = 0.5 + 0.5 * Math.sin(t / 320 + k * 0.9);
            ctx.globalAlpha = 0.35 + o * 0.65;
            ctx.beginPath(); ctx.arc(x + bw / 2 + (k - 1) * bh * 0.26, y + bh / 2, bh * 0.07, 0, 6.28); ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = 'rgba(' + line + ',' + (b.a * 0.8) + ')';
          ctx.beginPath(); ctx.moveTo(x + bw * 0.2, y + bh * 0.38); ctx.lineTo(x + bw * 0.8, y + bh * 0.38);
          ctx.moveTo(x + bw * 0.2, y + bh * 0.62); ctx.lineTo(x + bw * 0.55, y + bh * 0.62); ctx.stroke();
        }
      }
    }
    function loop(t) {
      if (!running) return;
      if (t - last > 33) { draw(t); last = t; }
      requestAnimationFrame(loop);
    }
    function update() {
      var go = visible && !document.hidden;
      if (go && !running) { running = true; requestAnimationFrame(loop); }
      if (!go) running = false;
    }
    size();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; update(); }, { rootMargin: '80px' }).observe(host);
    } else { visible = true; update(); }
    document.addEventListener('visibilitychange', update);
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
    }, { passive: true });
    host.addEventListener('pointerleave', function () { mx = my = -1e4; });
  }

  /* ---- 3. cursor glow on hero and dark bands (desktop pointers only) ---- */
  function spot(host) {
    host.classList.add('fx-spot');
    if (RM || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;
    var ticking = false, ex = 0, ey = 0;
    host.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY;
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var r = host.getBoundingClientRect();
        host.style.setProperty('--mx', (ex - r.left) + 'px');
        host.style.setProperty('--my', (ey - r.top) + 'px');
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---- Siri-style glass orb under the hero phone ---- */
  function glassOrb() {
    var hv = $('.hero-visual');
    if (!hv) return;
    var o = document.createElement('div');
    o.className = 'fx-orb2';
    o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<i class="sw"></i><i class="sw b"></i>';
    hv.appendChild(o);
  }

  /* ---- 4. rings orbiting the phone in the hero ---- */
  function orbit() {
    var hv = $('.hero-visual');
    if (!hv) return;
    var o = document.createElement('div');
    o.className = 'fx-orbit';
    o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<i class="o1"></i><i class="o2"></i><i class="d1"></i><i class="d2"></i><i class="d3"></i>';
    hv.insertBefore(o, hv.firstChild);
  }

  /* ---- 5. outlined headline band that slides with scroll ---- */
  var band = null;
  function marquee() {
    var anchor = $('.strip');
    if (!anchor) return;
    var m = document.createElement('div');
    m.className = 'fx-mega';
    m.setAttribute('aria-hidden', 'true');
    var a = 'Answered in seconds <b>/</b> Any hour <b>/</b> Any language <b>/</b> ';
    var b = 'Your rules <b>/</b> Your hours <b>/</b> Your tone <b>/</b> ';
    var rep = function (s) { return new Array(6).join(s); };
    m.innerHTML = '<div class="row1"><span>' + rep(a) + '</span></div><div class="row2"><span>' + rep(b) + '</span></div>';
    anchor.parentNode.insertBefore(m, anchor.nextSibling);
    band = { el: m, r1: $('.row1 span', m), r2: $('.row2 span', m) };
  }

  /* ---- 6. clock whose hands follow the scroll through the "11:02 pm" band ---- */
  var clock = null;
  function makeClock() {
    var strip = $('.strip .wrap');
    if (!strip) return;
    var wrap = document.createElement('div');
    wrap.className = 'fx-clock';
    wrap.setAttribute('aria-hidden', 'true');
    var s = '<svg viewBox="0 0 200 200" focusable="false"><circle class="ring" cx="100" cy="100" r="92"/><circle class="ring2" cx="100" cy="100" r="78"/>';
    for (var i = 0; i < 60; i++) {
      var big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 78 : 83, r2 = 88;
      s += '<line class="' + (big ? 'tk big' : 'tk') + '" x1="' + (100 + Math.sin(a) * r1).toFixed(2) + '" y1="' + (100 - Math.cos(a) * r1).toFixed(2) + '" x2="' + (100 + Math.sin(a) * r2).toFixed(2) + '" y2="' + (100 - Math.cos(a) * r2).toFixed(2) + '"/>';
    }
    s += '<line class="hh" x1="100" y1="100" x2="100" y2="60"/><line class="mh" x1="100" y1="100" x2="100" y2="38"/><circle class="cd" cx="100" cy="100" r="5"/></svg><span class="am">11:02 pm</span>';
    wrap.innerHTML = s;
    strip.insertBefore(wrap, strip.firstChild);
    clock = { box: $('.strip'), hh: $('.hh', wrap), mh: $('.mh', wrap), label: $('.am', wrap) };
    setClock(0);
  }
  function setClock(p) {
    if (!clock) return;
    var min = 2 + p * 600;               // 11:02 pm, sweeping ten hours to the next morning
    var hour = 11 * 30 + 1 + p * 300;
    clock.mh.setAttribute('transform', 'rotate(' + (min * 6).toFixed(1) + ' 100 100)');
    clock.hh.setAttribute('transform', 'rotate(' + (hour % 360).toFixed(1) + ' 100 100)');
    var total = (23 * 60 + 2 + Math.round(p * 600)) % 1440;
    var hr = Math.floor(total / 60), mn = total % 60, ap = hr >= 12 ? 'pm' : 'am', h12 = hr % 12 || 12;
    clock.label.textContent = h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
  }


  /* ---- 8. Siri-style fluid orb behind the hero phone ---- */
  function siriOrb() {
    var hv = $('.hero-visual');
    if (!hv) return;
    var o = document.createElement('div');
    o.className = 'fx-siri';
    o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i>';
    hv.insertBefore(o, hv.firstChild);
  }

  /* ---- 9. Siri-style layered wave along the bottom of the closing band ---- */
  function siriWave(host) {
    var c = document.createElement('canvas');
    c.className = 'fx-wave';
    c.setAttribute('aria-hidden', 'true');
    host.insertBefore(c, host.firstChild);
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var amp = 0.22, target = 0.22, t = 0, running = false, visible = false, last = 0;
    var layers = [
      { c: '8,133,96', f: 1.3, s: 0.9, a: 1.0, w: 2.2 },
      { c: '23,161,115', f: 1.9, s: -1.2, a: 0.8, w: 2 },
      { c: '79,191,146', f: 2.5, s: 1.5, a: 0.65, w: 1.8 },
      { c: '126,226,184', f: 3.1, s: -1.9, a: 0.5, w: 1.6 },
      { c: '255,255,255', f: 1.6, s: 2.2, a: 0.4, w: 1.2 }
    ];
    function size() {
      var r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      var mid = h * 0.68, step = Math.max(3, w / 160);
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        for (var pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          for (var x = 0; x <= w + step; x += step) {
            var u = x / w, env = Math.pow(Math.max(0, 1 - Math.pow(u * 2 - 1, 2)), 2);
            var y = mid + Math.sin(u * Math.PI * 2 * L.f + t * L.s + i) * h * 0.42 * amp * L.a * env
                        + Math.sin(u * Math.PI * 5 * L.f - t * L.s * 0.7) * h * 0.08 * amp * env;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.lineWidth = pass ? L.w : L.w * 5;
          ctx.strokeStyle = 'rgba(' + L.c + ',' + (pass ? 0.9 : 0.07) + ')';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(ts) {
      if (!running) return;
      if (ts - last > 30) { t += 0.04; amp += (target - amp) * 0.06; target += (0.22 - target) * 0.03; draw(); last = ts; }
      requestAnimationFrame(loop);
    }
    function update() {
      var go = visible && !document.hidden && !RM;
      if (go && !running) { running = true; requestAnimationFrame(loop); }
      if (!go) running = false;
    }
    size();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) target = 0.8; update(); }, { rootMargin: '60px' }).observe(host);
    }
    document.addEventListener('visibilitychange', update);
    host.addEventListener('pointermove', function () { target = Math.min(1, target + 0.06); }, { passive: true });
    host.addEventListener('pointerdown', function () { target = 1; });
  }

  /* ---- 7. one scroll handler for every scroll-linked effect ---- */
  var foot = $('footer.foot');
  var queued = false;
  function frame() {
    queued = false;
    var vh = window.innerHeight;
    if (band) {
      var r = band.el.getBoundingClientRect();
      if (r.bottom > -50 && r.top < vh + 50) {
        var off = (r.top - vh / 2) * 0.45;
        band.r1.style.transform = 'translate3d(' + (off - 600).toFixed(1) + 'px,0,0)';
        band.r2.style.transform = 'translate3d(' + (-off - 1400).toFixed(1) + 'px,0,0)';
      }
    }
    if (clock) {
      var cr = clock.box.getBoundingClientRect();
      if (cr.bottom > 0 && cr.top < vh) setClock(clamp((vh - cr.top) / (cr.height + vh * 0.6), 0, 1));
    }
    if (foot) {
      var fr = foot.getBoundingClientRect();
      foot.style.setProperty('--fp', clamp((vh - fr.top) / (fr.height * 0.85), 0, 1).toFixed(3));
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  /* ---- start ---- */
  function start() {
    try {
      if (HEAVY && !RM) {
        document.documentElement.classList.add('fx-heavy');
        var gs = document.createElement('script');
        gs.src = '/fx-gl.js'; gs.async = true;
        document.head.appendChild(gs);
      }
      if (!RM) {
        if (!LITE) {
          $$('.board-hero,.pagehead').forEach(function (h) { bubbles(h, false); });
          $$('.cta-band,.strip').forEach(function (h) { bubbles(h, true); });
        }
        orbit();
      }
      siriOrb();
      $$('.cta-band').forEach(siriWave);
      $$('.board-hero,.pagehead,.land').forEach(spot);
      $$('.cta-band,.strip').forEach(spot);
      glassOrb();
      marquee();
      makeClock();
      if (!RM) {
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue);
        frame();
      } else if (foot) {
        foot.style.setProperty('--fp', '1');
      }
    } catch (e) { /* decoration only; never break the page */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
