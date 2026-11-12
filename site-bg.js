/* ===== Фон разделов: продолжение «звукового ландшафта» =====
   За контентом медленно плывут волновые линии спектра — как в hero,
   но тише: дальние линии уходят в синеву, ближние подсвечены янтарём.
   Вверх поднимаются редкие искры, по краям лежат мягкие пятна света.
   2D canvas без зависимостей. При prefers-reduced-motion рисуется один
   статичный кадр, в фоновой вкладке анимация останавливается.
*/
(() => {
  'use strict';

  const canvas = document.getElementById('siteBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const EMBER_COUNT = coarse || innerWidth < 760 ? 18 : 34;

  const S = {
    w: 0, h: 0, dpr: 1,
    t: 0,
    tx: 0, ty: 0, mx: 0, my: 0,   // указатель -1..1 (сглаженный)
    running: false,
    raf: 0,
    last: 0,
    ema: 16.7,                     // среднее время кадра, мс
    low: false,                    // щадящий режим на слабых устройствах
    embers: [],
  };

  /* ---------- искры ---------- */
  function makeEmber(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.04 + Math.random() * 0.08,
      r: 0.5 + Math.random() * 1.2,
      vy: 0.012 + Math.random() * 0.028,
      sway: 0.3 + Math.random() * 0.9,
      phase: Math.random() * 6.2832,
      a: 0.3 + Math.random() * 0.7,
      warm: Math.random(),
    };
  }
  for (let i = 0; i < EMBER_COUNT; i++) S.embers.push(makeEmber(true));

  /* ---------- форма волны ---------- */
  function wave(x, i, t) {
    return (
      Math.sin(x * 1.35 + t * 0.5 + i * 1.71) * 0.55 +
      Math.sin(x * 2.85 - t * 0.33 + i * 2.31) * 0.30 +
      Math.sin(x * 6.05 + t * 0.21 + i * 4.13) * 0.15
    );
  }
  const LINES = 9;

  function resize() {
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    S.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    S.w = Math.round(w * S.dpr);
    S.h = Math.round(h * S.dpr);
    if (canvas.width !== S.w) canvas.width = S.w;
    if (canvas.height !== S.h) canvas.height = S.h;
  }

  /* ---------- мягкие пятна света ---------- */
  function drawGlows() {
    const { w, h } = S;
    const t = S.t;
    const g1x = w * (0.74 + 0.04 * Math.sin(t * 0.09) + S.mx * 0.02);
    const g1y = h * (0.14 + 0.05 * Math.cos(t * 0.11) + S.my * 0.02);
    const g2x = w * (0.22 + 0.05 * Math.cos(t * 0.07) + S.mx * 0.02);
    const g2y = h * (0.82 + 0.04 * Math.sin(t * 0.08) - S.my * 0.02);

    let g = ctx.createRadialGradient(g1x, g1y, 0, g1x, g1y, Math.max(w, h) * 0.42);
    g.addColorStop(0, 'rgba(255,159,10,0.075)');
    g.addColorStop(1, 'rgba(255,159,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    g = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, Math.max(w, h) * 0.46);
    g.addColorStop(0, 'rgba(10,132,255,0.06)');
    g.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------- линии спектра ---------- */
  function drawLines() {
    const { w, h } = S;
    const t = S.t;
    const scroll = window.scrollY || window.pageYOffset || 0;
    const step = Math.max(6, Math.round(w / 150));
    for (let i = 0; i < LINES; i++) {
      const f = i / (LINES - 1);              // 0 — далёкая (синяя), 1 — близкая (янтарная)
      // линия «привязана» к странице: при скролле уходит вниз и снова
      // появляется сверху — поле спектра кажется бесконечным
      let y = h * (0.12 + f * 0.76) - scroll * 0.06 * S.dpr;
      y = ((y % h) + h) % h;
      const amp = (5 + f * f * 34) * (1 + 0.3 * S.my);
      const r = Math.round(10 + 245 * f);
      const g = Math.round(133 + 26 * f);
      const b = Math.round(255 - 245 * f);
      const base = 0.05 + 0.075 * (1 - f);
      const phase = t * (0.16 + f * 0.2) + f * 2.1 + S.mx * 0.6;

      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) {
        const wy = wave((x / w) * 4.2 + phase, f * 7.3, t) * amp;
        const yy = y + wy;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      // широкий штрих — мягкое свечение, тонкий — сама линия
      if (!S.low) {
        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (base * 0.3).toFixed(3) + ')';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + base.toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  /* ---------- искры ---------- */
  function drawEmbers(dt) {
    const { w, h } = S;
    const t = S.t;
    for (const e of S.embers) {
      e.y -= e.vy * dt * (0.55 + 0.9 * Math.abs(Math.sin(e.phase + t * 0.6)));
      e.x += Math.sin(t * 0.5 * e.sway + e.phase) * dt * 0.008;
      if (e.y < -0.04) {
        const n = makeEmber(false);
        e.x = n.x; e.y = n.y; e.r = n.r; e.vy = n.vy;
        e.sway = n.sway; e.phase = n.phase; e.a = n.a; e.warm = n.warm;
        continue;
      }
      const flick = 0.55 + 0.45 * Math.sin(t * 2.1 + e.phase * 7.0);
      const a = Math.min(1, e.a * flick) * (e.warm > 0.55 ? 0.15 : 0.10);
      ctx.fillStyle = 'rgba(' + (e.warm > 0.55 ? '255,196,96' : '255,159,10') + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(e.x * w, e.y * h, e.r * S.dpr, 0, 6.2832);
      ctx.fill();
    }
  }

  /* ---------- виньетка: края остаются глубоко чёрными ---------- */
  function drawVignette() {
    const { w, h } = S;
    const g = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.38,
      w / 2, h / 2, Math.hypot(w, h) * 0.58
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------- цикл ---------- */
  function frame(now) {
    S.raf = 0;
    if (!S.running) return;
    const dt = Math.min(0.1, (now - S.last) / 1000 || 0.016);
    S.last = now;
    S.t += dt;
    S.ema = S.ema * 0.92 + dt * 1000 * 0.08;
    if (S.ema > 38 && !S.low) S.low = true;
    const k = 1 - Math.exp(-dt * 5);
    S.mx += (S.tx - S.mx) * k;
    S.my += (S.ty - S.my) * k;

    ctx.clearRect(0, 0, S.w, S.h);
    drawGlows();
    drawLines();
    drawEmbers(dt);
    drawVignette();
    schedule();
  }
  function schedule() {
    if (!S.raf && S.running) S.raf = requestAnimationFrame(frame);
  }
  function stop() {
    S.running = false;
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
  }
  function start() {
    if (S.running) return;
    if (reduce.matches || document.hidden) { drawStatic(); return; }
    S.running = true;
    S.last = performance.now();
    schedule();
  }

  /* статичный кадр для prefers-reduced-motion и фоновых вкладок */
  function drawStatic() {
    S.t = 6.3;
    ctx.clearRect(0, 0, S.w, S.h);
    drawGlows();
    drawLines();
    for (const e of S.embers) {
      const a = Math.min(1, e.a * 0.8) * (e.warm > 0.55 ? 0.12 : 0.08);
      ctx.fillStyle = 'rgba(255,170,60,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(e.x * S.w, e.y * S.h, e.r * S.dpr, 0, 6.2832);
      ctx.fill();
    }
    drawVignette();
  }

  /* ---------- события ---------- */
  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      S.tx = (e.clientX / innerWidth) * 2 - 1;
      S.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener('resize', () => {
    resize();
    if (!S.running) {
      if (reduce.matches || document.hidden) drawStatic();
    }
  });
  if (reduce.addEventListener) {
    reduce.addEventListener('change', () => { stop(); start(); });
  }

  /* ---------- запуск ---------- */
  resize();
  if (reduce.matches || document.hidden) drawStatic();
  else start();
})();
