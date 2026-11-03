/* Nyrex heavy tier: WebGL orb and aurora, plus a cursor particle trail.
   Loaded by fx.js only on capable desktops (fine pointer, wide screen, 6+ cores,
   4 GB+ memory, no data-saver, no reduced-motion). Phones and weak machines never download this.
   If the frame rate drops, or WebGL fails, everything here removes itself and the
   lighter CSS/canvas effects from fx.js take over again. Green and white only. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('fx-heavy')) return;

  var forced = /[?&]fx=heavy/.test(location.search);
  var inst = [], trail = null, raf = 0, running = false, dead = false;
  var px = -1e4, py = -1e4, frames = 0, dts = [], last = 0;

  /* ---------- shaders ---------- */
  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  function common(prec) {
    return [
      'precision ' + prec + ' float;',
      'uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uB;',
      'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
      ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
      /* Nyrex greens only: #0A3D30 #088560 #17A173 #4FBF92 #7EE2B8 */
      'const vec3 c0=vec3(.039,.239,.188);const vec3 c1=vec3(.031,.522,.376);',
      'const vec3 c2=vec3(.090,.631,.451);const vec3 c3=vec3(.310,.749,.573);const vec3 c4=vec3(.494,.886,.722);',
      'vec3 ramp(float t){t=clamp(t,0.,1.)*4.;vec3 c=mix(c0,c1,smoothstep(0.,1.,t));',
      ' c=mix(c,c2,smoothstep(1.,2.,t));c=mix(c,c3,smoothstep(2.,3.,t));return mix(c,c4,smoothstep(3.,4.,t));}'
    ].join('\n');
  }
  var ORB = [
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes*2.-1.;',
    ' float r=length(uv);float t=uT*.16;',
    ' vec2 m=uM*2.-1.;',
    ' float pull=uB*exp(-dot(uv-m,uv-m)*2.2);',
    ' vec2 q=uv+.34*vec2(fbm(uv*1.6+vec2(t,-t)),fbm(uv*1.6+vec2(-t,t)+4.));',
    ' q+=(m-uv)*pull*.3;',
    ' float f=fbm(q*2.1+t);',
    ' float rot=(1.-r)*2.6+t*2.;vec2 ur=vec2(cos(rot)*uv.x-sin(rot)*uv.y,sin(rot)*uv.x+cos(rot)*uv.y);',
    ' float sw=fbm(ur*1.9+f*1.5);',
    ' float edge=r+(f-.5)*.44-pull*.12;',
    ' float body=smoothstep(.98,.18,edge);',
    ' float core=smoothstep(.6,.0,edge);',
    ' float x=.2+.5*f+.25*sw*(1.-r)+.25*core;',
    ' vec3 col=ramp(mix(.28,1.,clamp(x,0.,1.)));',
    ' col=mix(col,vec3(1.),core*smoothstep(.5,.85,f)*.4);',
    ' float rim=smoothstep(.3,.62,edge)*smoothstep(1.,.74,edge);',
    ' col=mix(col,ramp(.9),rim*.5);',
    ' float a=clamp(body*(.5+.4*core)+rim*.3,0.,.92);',
    ' gl_FragColor=vec4(col*a,a);',
    '}'
  ].join('\n');
  var AURORA = [
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;float t=uT*.3;',
    ' vec3 acc=vec3(0.);float A=0.;',
    ' float dx=uv.x-uM.x;float boost=uB*exp(-dx*dx*7.);',
    ' for(int i=0;i<4;i++){',
    '  float fi=float(i);',
    '  float y=.3+.07*fi+(.13+.05*boost)*sin(uv.x*(2.4+fi*.8)+t*(1.+fi*.35)+fi*1.9)+.045*sin(uv.x*8.+t*2.2+fi*2.);',
    '  float d=uv.y-y;',
    '  float g=exp(-d*d*(1400.+420.*fi))+.22*exp(-abs(d)*7.);',
    '  acc+=ramp(.4+.17*fi)*g;A+=g;',
    ' }',
    ' float fade=smoothstep(.0,.12,uv.y)*smoothstep(.95,.5,uv.y);',
    ' float a=clamp(A*.5,0.,1.)*fade;',
    ' vec3 col=acc/max(A,.001);',
    ' gl_FragColor=vec4(col*a,a);',
    '}'
  ].join('\n');

  /* ---------- tear everything down and hand back to the light effects ---------- */
  function fallback() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    inst.forEach(function (I) { if (I.c.parentNode) I.c.parentNode.removeChild(I.c); });
    inst = [];
    if (trail && trail.c.parentNode) trail.c.parentNode.removeChild(trail.c);
    root.classList.remove('fx-heavy');
  }

  /* ---------- one WebGL canvas ---------- */
  function mk(host, frag, cls, scale, mapEl) {
    var c = document.createElement('canvas');
    c.className = 'fx-gl ' + cls;
    c.setAttribute('aria-hidden', 'true');
    var gl = null;
    try { gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' }); } catch (e) {}
    if (!gl) return null;
    var hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    var prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (window.console) console.warn('nyrex fx shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, common(prec) + '\n' + frag);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    var I = {
      c: c, gl: gl, host: host, scale: scale, b: 0, vis: false, ok: true,
      uRes: gl.getUniformLocation(p, 'uRes'), uT: gl.getUniformLocation(p, 'uT'),
      uM: gl.getUniformLocation(p, 'uM'), uB: gl.getUniformLocation(p, 'uB')
    };
    c.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); I.ok = false; c.style.display = 'none';
      if (inst.every(function (x) { return !x.ok; })) fallback();
    });
    return I;
  }
  function size(I) {
    var r = I.c.getBoundingClientRect();
    var w = Math.max(2, Math.round(r.width * I.scale)), h = Math.max(2, Math.round(r.height * I.scale));
    if (I.c.width !== w || I.c.height !== h) { I.c.width = w; I.c.height = h; }
  }
  function mount(host, frag, cls, scale) {
    if (!host) return;
    var I = mk(host, frag, cls, scale);
    if (!I) return;
    host.insertBefore(I.c, host.firstChild);
    size(I);
    inst.push(I);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { I.vis = en[0].isIntersecting; if (I.vis) wake(); }, { rootMargin: '60px' }).observe(host);
    } else { I.vis = true; }
  }

  /* ---------- frame driver (one loop for all canvases, sleeps when nothing is on screen) ---------- */
  function wake() { if (!running && !dead) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    if (dead) return;
    var any = false, dt = now - last; last = now;
    if (document.hidden) { running = false; return; }
    for (var i = 0; i < inst.length; i++) {
      var I = inst[i];
      if (!I.vis || !I.ok) continue;
      any = true;
      var rr = I.c.getBoundingClientRect();
      var near = px > rr.left - 80 && px < rr.right + 80 && py > rr.top - 80 && py < rr.bottom + 80;
      I.b += ((near ? 1 : 0) - I.b) * 0.06;
      var mx = Math.max(-0.3, Math.min(1.3, (px - rr.left) / rr.width));
      var my = Math.max(-0.3, Math.min(1.3, 1 - (py - rr.top) / rr.height));
      var gl = I.gl;
      gl.viewport(0, 0, I.c.width, I.c.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(I.uRes, I.c.width, I.c.height);
      gl.uniform1f(I.uT, now / 1000);
      gl.uniform2f(I.uM, mx, my);
      gl.uniform1f(I.uB, I.b);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (!any) { running = false; return; }
    /* safety net: if the first ~90 frames average slower than ~30 fps, give up on the heavy tier */
    if (!forced && dt < 200) {
      frames++;
      if (frames > 20 && frames <= 110) dts.push(dt);
      if (frames === 110) {
        dts.sort(function (a, b) { return a - b; });
        if (dts[dts.length >> 1] > 34) { fallback(); return; }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  /* ---------- cursor particle trail ---------- */
  function makeTrail() {
    var c = document.createElement('canvas');
    c.className = 'fx-trail';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    if (!ctx) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5), W = 0, H = 0, ps = [], on = false, lx = null, ly = null;
    var cols = ['23,161,115', '79,191,146', '126,226,184', '8,133,96'];
    function rs() { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    rs(); window.addEventListener('resize', rs);
    function emit(x, y, n, spd) {
      for (var i = 0; i < n && ps.length < 160; i++) {
        var a = Math.random() * 6.283, v = (0.2 + Math.random()) * spd;
        ps.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.2, life: 1, d: 0.014 + Math.random() * 0.016, r: 1.6 + Math.random() * 3.2, c: cols[(Math.random() * cols.length) | 0] });
      }
      if (!on) { on = true; requestAnimationFrame(step); }
    }
    function step() {
      ctx.clearRect(0, 0, W, H);
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 - 0.01; p.life -= p.d;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(' + p.c + ',' + (p.life * 0.55).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, 6.283); ctx.fill();
      }
      if (ps.length) requestAnimationFrame(step); else on = false;
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY;
      if (lx !== null) { var d = Math.hypot(px - lx, py - ly); if (d > 6) emit(px, py, Math.min(3, 1 + (d / 24) | 0), 0.9); }
      lx = px; ly = py;
      wake();
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      for (var i = 0; i < 20 && ps.length < 160; i++) {
        var a = i / 20 * 6.283;
        ps.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 1, d: 0.02, r: 2.4, c: cols[i % cols.length] });
      }
      if (!on) { on = true; requestAnimationFrame(step); }
    }, { passive: true });
    return { c: c };
  }

  /* ---------- go ---------- */
  function start() {
    try {
      mount($('.hero-visual'), ORB, 'fx-gl-orb', 0.6);
      mount($('.land-stage'), ORB, 'fx-gl-orb', 0.6);
      mount($('.cta-band'), AURORA, 'fx-gl-aurora', 0.5);
      if (!inst.length) { fallback(); return; }
      trail = makeTrail();
      var rt;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { inst.forEach(size); }, 150); });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
      wake();
    } catch (e) { fallback(); }
  }
  function $(s) { return document.querySelector(s); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
