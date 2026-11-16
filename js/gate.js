/* The surface at night: stars, the sea, and the moon's road of light across the water. */
(() => {
  'use strict';
  const gate = document.getElementById('gate'), cv = document.getElementById('gateSky'), moon = gate.querySelector('.gate__moon');
  const x = cv.getContext('2d');
  const HZ = .64; // the horizon, where .gate__water begins
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  let W = 0, H = 0, dpr = 1, hz = 0, mx = 0, my = 0, stars = [], glints = [], swells = [];

  function seed() {
    const r = rng(1403);
    const n = Math.min(320, Math.round(W * H * HZ / 1500));
    stars = Array.from({ length: n }, () => {
      const big = r() < .06;
      return { x: r() * W, y: Math.pow(r(), 1.35) * hz * .97, s: big ? 1.1 + r() * .9 : .35 + r() * .75, a: big ? .85 : .25 + r() * .6, f: .6 + r() * 2.4, p: r() * 6.283, w: r() < .25 };
    });
    glints = Array.from({ length: 300 }, () => {
      let g = 0; for (let i = 0; i < 4; i++) g += r(); g = (g - 2) / 2; // roughly bell-shaped: dense in the middle of the road
      return { d: Math.pow(r(), .75), o: g, f: 1.5 + r() * 4.5, p: r() * 6.283, l: .5 + r() };
    });
    swells = Array.from({ length: 34 }, (_, i) => ({ k: (i + r() * .6) / 34, p: r() * 6.283, s: .25 + r() * .5, a: 1.5 + r() * 2 }));
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = gate.clientWidth; H = gate.clientHeight; hz = H * HZ;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = gate.getBoundingClientRect(), m = moon.getBoundingClientRect();
    mx = m.left - g.left + m.width / 2; my = m.top - g.top + m.height / 2;
    seed();
  }

  function draw(t) {
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);

    // stars, thinning into the haze above the horizon and kept off the moon's glare
    for (const s of stars) {
      const tw = s.w ? .55 + .45 * Math.sin(t * s.f + s.p) : .85 + .15 * Math.sin(t * s.f + s.p);
      const haze = 1 - clamp((s.y - hz * .55) / (hz * .45));
      const glare = clamp((Math.hypot(s.x - mx, s.y - my) - 40) / 90);
      const a = s.a * tw * haze * (.25 + .75 * glare);
      if (a < .02) continue;
      x.globalAlpha = a; x.fillStyle = '#eef2ff';
      x.beginPath(); x.arc(s.x, s.y, s.s, 0, 6.283); x.fill();
      if (s.s > 1.2) {
        const rg = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s * 4);
        rg.addColorStop(0, 'rgba(220,228,255,.35)'); rg.addColorStop(1, 'rgba(220,228,255,0)');
        x.globalAlpha = a; x.fillStyle = rg; x.fillRect(s.x - s.s * 4, s.y - s.s * 4, s.s * 8, s.s * 8);
      }
    }
    x.globalAlpha = 1;

    // the water: lit by the sky at the horizon, darkening toward us
    const wg = x.createLinearGradient(0, hz, 0, H);
    wg.addColorStop(0, '#3a3a6e'); wg.addColorStop(.06, '#1d2550'); wg.addColorStop(.3, '#0e1738'); wg.addColorStop(1, '#040a1e');
    x.fillStyle = wg; x.fillRect(0, hz, W, H - hz);

    // a soft column of moonlight on the water, widening as it comes closer
    for (let y = hz; y < H; y += 4) {
      const k = (y - hz) / (H - hz), half = 12 + k * W * .3, a = .2 * Math.pow(1 - k, 1.6);
      const hg = x.createLinearGradient(mx - half, 0, mx + half, 0);
      hg.addColorStop(0, 'rgba(240,236,255,0)'); hg.addColorStop(.5, `rgba(255,244,218,${a.toFixed(3)})`); hg.addColorStop(1, 'rgba(240,236,255,0)');
      x.fillStyle = hg; x.fillRect(mx - half, y, half * 2, 4);
    }

    // swells: long low crests, closer together and fainter near the horizon
    for (const w of swells) {
      const y0 = hz + Math.pow(w.k, 1.9) * (H - hz) + 1;
      const amp = .4 + w.k * w.a * 2.2, len = 40 + w.k * 180;
      x.lineWidth = .6 + w.k * .9;
      x.globalAlpha = .025 + .06 * w.k;
      x.strokeStyle = '#8fa3e6';
      x.beginPath();
      for (let px = -10; px <= W + 10; px += 8) {
        const y = y0 + Math.sin(px / len * 6.283 + t * w.s + w.p) * amp;
        px < -9 ? x.moveTo(px, y) : x.lineTo(px, y);
      }
      x.stroke();
    }
    x.globalAlpha = 1;

    // the road of light: short glints that flash and fade, spreading out toward the viewer
    x.fillStyle = '#fff6df';
    for (const g of glints) {
      const v = Math.sin(t * g.f + g.p);
      if (v < .15) continue;
      const y = hz + 1 + Math.pow(g.d, 1.7) * (H - hz - 1);
      const spread = 8 + g.d * W * .2;
      const gx = mx + g.o * spread + Math.sin(t * .7 + g.p) * (1 + g.d * 4);
      const l = (3 + g.d * 26) * g.l, h = .6 + g.d * 1.6;
      x.globalAlpha = (v - .15) / .85 * (1 - .55 * g.d) * (1 - Math.abs(g.o) * .6);
      x.fillRect(gx - l / 2, y - h / 2, l, h);
    }
    x.globalAlpha = 1;

    // the horizon: a thin seam of light where sky meets sea
    const sg = x.createLinearGradient(0, hz - 3, 0, hz + 3);
    sg.addColorStop(0, 'rgba(210,200,255,0)'); sg.addColorStop(.5, 'rgba(220,210,255,.35)'); sg.addColorStop(1, 'rgba(210,200,255,0)');
    x.fillStyle = sg; x.fillRect(0, hz - 3, W, 6);
  }

  let t0 = performance.now(), openAt = 0;
  function loop(n) {
    if (gate.classList.contains('open')) { if (!openAt) openAt = n; if (n - openAt > 1500) return; }
    draw(still ? 0 : (n - t0) / 1000);
    if (!still) requestAnimationFrame(loop);
  }
  // Android: the tap that opens the gift also hides the browser's bars (iPhone does not allow it for pages)
  gate.addEventListener('click', () => {
    const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fs || gate.disabled || document.fullscreenElement || !/Android/i.test(navigator.userAgent)) return;
    try { const p = fs.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  });
  size();
  addEventListener('resize', () => { size(); if (still) draw(0); });
  requestAnimationFrame(loop);
})();
