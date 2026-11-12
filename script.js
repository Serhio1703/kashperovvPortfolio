/* ===== Резюме звукорежиссёра — script.js ===== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionQuery.matches;
  const onMotionChange = (e) => { reduceMotion = e.matches; };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

  const finePointer = matchMedia('(pointer: fine)').matches;

  /* 0. Preloader */
  const loader = $('#loader');
  const loaderCount = $('#loaderCount');
  const loaderBar = $('#loaderBar');
  const docEl = document.documentElement;

  let loaderDone = false;
  function finishLoader() {
    if (loaderDone) return;
    loaderDone = true;
    if (loader) loader.classList.add('done');
    document.body.classList.add('loaded');
    docEl.classList.add('ready');
    if (loader) setTimeout(() => { loader.style.display = 'none'; }, 1100);
  }

  if (loader && loaderCount && loaderBar) {
    if (reduceMotion) {
      loaderCount.textContent = '100';
      loaderBar.style.width = '100%';
      setTimeout(finishLoader, 250);
    } else {
      const start = performance.now();
      const DURATION = 1540;
      const step = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        const v = Math.round(eased * 100);
        loaderCount.textContent = v < 10 ? '0' + v : String(v);
        loaderBar.style.width = v + '%';
        if (t < 1) requestAnimationFrame(step);
        else setTimeout(finishLoader, 280);
      };
      requestAnimationFrame(step);
    }
  } else {
    document.body.classList.add('loaded');
    docEl.classList.add('ready');
  }

  /* 1. Lenis */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    try {
      lenis = new window.Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
      });
      const lenisRaf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(lenisRaf);
      };
      requestAnimationFrame(lenisRaf);
      document.documentElement.style.scrollBehavior = 'auto';
    } catch (e) { lenis = null; }
  }

  if (lenis) {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -72, duration: 1.2 });
        }
      });
    });
  }

  if (!reduceMotion) {
    $$('.btn').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.22;
        el.style.translate = `${x}px ${y}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
    });
  }

  /* 2. Курсор */
  (() => {
    const cursor = $('#cursor');
    if (!cursor || !finePointer || reduceMotion) return;
    const ring = cursor.querySelector('.cursor-ring');
    const dot = cursor.querySelector('.cursor-dot');
    let tx = -100, ty = -100, rx = tx, ry = ty, raf = 0;
    const tick = () => {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      dot.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      if (Math.abs(tx - rx) > 0.3 || Math.abs(ty - ry) > 0.3) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!cursor.classList.contains('on')) cursor.classList.add('on');
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    const hoverables = 'a, button, .btn, .gallery-item, .copy, .year-card, .gear-list li, .showreel-play, .showreel-bar, .volume-btn, .volume-range, .band-links a';
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest(hoverables)) cursor.classList.add('hover');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest(hoverables)) cursor.classList.remove('hover');
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('on'));
    window.addEventListener('blur', () => cursor.classList.remove('on'));
  })();

  /* 3. Имя по буквам */
  $$('[data-split]').forEach((el) => {
    const text = el.textContent.trim();
    const offset = Number(el.dataset.offset || 0);
    el.textContent = '';
    Array.from(text).forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i + offset);
      s.setAttribute('aria-hidden', 'true');
      s.textContent = c;
      el.appendChild(s);
    });
  });

  /* 4. Spotlight */
  (() => {
    const spot = $('#spotlight');
    if (!spot || !finePointer || reduceMotion) return;
    let tx = -1000, ty = -1000, cx = tx, cy = ty, raf = 0;
    const update = () => {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      spot.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) raf = requestAnimationFrame(update);
      else raf = 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      spot.classList.add('on');
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    document.addEventListener('pointerleave', () => spot.classList.remove('on'));
    window.addEventListener('blur', () => spot.classList.remove('on'));
  })();

  /* 5. Hero parallax */
  const heroEl = $('#top');
  const heroInnerEl = heroEl && heroEl.querySelector('.hero-inner');
  const heroCanvasEl = $('#heroCanvas');
  let heroLastY = -1;
  let heroRaf = 0;

  function applyHeroParallax(y) {
    if (!heroEl || !heroInnerEl) return;
    const h = heroEl.offsetHeight || 1;
    const clamped = Math.max(0, Math.min(y, h));
    const p = clamped / h;
    heroInnerEl.style.transform =
      `translate3d(0, ${(p * 160).toFixed(2)}px, 0) scale(${(1 - p * 0.08).toFixed(4)})`;
    heroInnerEl.style.opacity = Math.max(0, 1 - p * 1.2).toFixed(3);
    if (heroCanvasEl) {
      heroCanvasEl.style.transform =
        `translate3d(0, ${(p * 260).toFixed(2)}px, 0) scale(${(1 + p * 0.12).toFixed(4)})`;
    }
  }

  function updateHeroParallax(y) {
    if (reduceMotion) return;
    if (y == null) y = window.scrollY;
    if (Math.abs(y - heroLastY) < 0.1) return;
    heroLastY = y;
    if (heroRaf) return;
    heroRaf = requestAnimationFrame(() => { heroRaf = 0; applyHeroParallax(heroLastY); });
  }

  if (lenis) {
    lenis.on('scroll', (e) => {
      const y = typeof e === 'number' ? e : (e && typeof e.scroll === 'number' ? e.scroll : window.scrollY);
      updateHeroParallax(y);
    });
  }

  /* 6. Canvas-утилиты (для карточек работ) */
  const canvasStates = new WeakMap();
  const canvasList = [];

  function trackCanvas(c) {
    let s = canvasStates.get(c);
    if (s) return s;
    s = { w: 1, h: 1, dpr: 0, dirty: true };
    canvasStates.set(c, s);
    canvasList.push(s);
    new ResizeObserver(() => { s.dirty = true; }).observe(c);
    return s;
  }

  window.addEventListener('resize', () => {
    for (let i = 0; i < canvasList.length; i++) canvasList[i].dirty = true;
  }, { passive: true });

  function sizeCanvas(c) {
    const s = trackCanvas(c);
    if (s.dirty || !s.dpr) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      s.w = w; s.h = h; s.dpr = dpr; s.dirty = false;
    }
    const g = c.getContext('2d');
    g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    return { g, w: s.w, h: s.h };
  }

  /* Фон hero теперь рисует hero-bg.js */

  /* 7. Scroll meter / nav / chain */
  const meter = $('#meter');
  const METER_N = 28;
  const meterSegs = [];
  if (meter) {
    for (let i = 0; i < METER_N; i++) {
      const s = document.createElement('i');
      const p = i / METER_N;
      s.className = p < 0.6 ? 'z-ice' : p < 0.85 ? 'z-amber' : 'z-red';
      meter.appendChild(s);
      meterSegs.push(s);
    }
  }

  const nav = $('#nav');
  const chain = $('#chain');
  const nodes = $$('.node');
  let ticking = false;

  function revealVisible() {
    const vh = innerHeight;
    $$('.reveal:not(.in), .skill:not(.in)').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > 0) el.classList.add('in');
    });
  }

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    if (nav) nav.classList.toggle('scrolled', y > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    const prog = max > 0 ? clamp(y / max, 0, 1) : 0;
    const lit = Math.round(prog * METER_N);
    meterSegs.forEach((s, i) => s.classList.toggle('on', i < lit));
    if (chain) {
      const r = chain.getBoundingClientRect();
      chain.style.setProperty('--p', clamp((innerHeight * 0.62 - r.top) / r.height, 0, 1).toFixed(4));
      nodes.forEach((n) => n.classList.toggle('on', n.getBoundingClientRect().top < innerHeight * 0.62));
    }
    revealVisible();
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    updateHeroParallax();
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  if (!reduceMotion) updateHeroParallax();
  setTimeout(revealVisible, 300);
  setTimeout(revealVisible, 1500);

  const links = $$('[data-nav]');
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.dataset.nav === e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-section]').forEach((s) => navObserver.observe(s));
    const heroObs = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) links.forEach((a) => a.classList.remove('active'));
    }, { rootMargin: '-45% 0px -50% 0px' });
    const topEl = $('#top');
    if (topEl) heroObs.observe(topEl);
  }

  /* 8. Skills segments */
  $$('.skill').forEach((el) => {
    const SEG = 24;
    const lvl = clamp(+el.dataset.level || 0, 0, 100);
    const litCount = Math.round((lvl / 100) * SEG);
    const seg = $('.seg', el);
    if (!seg) return;
    for (let i = 0; i < SEG; i++) {
      const s = document.createElement('i');
      s.style.setProperty('--i', i);
      if (i < litCount) {
        const p = i / SEG;
        s.className = 'lit ' + (p < 0.6 ? 'z-ice' : p < 0.85 ? 'z-amber' : 'z-red');
      }
      seg.appendChild(s);
    }
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.05 });
    $$('.reveal, .skill').forEach((el) => revealObserver.observe(el));
  } else {
    $$('.reveal, .skill').forEach((el) => el.classList.add('in'));
  }

  /* 8.5. Счётчики по годам */
  (() => {
    const cards = $$('.year-card');
    if (!cards.length) return;

    const totalEl = $('#totalNum');
    const totalWrap = $('.total');
    const easeOutExpo = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

    const years = cards.map((el) => ({
      el,
      year: +el.dataset.year || 0,
      events: +el.dataset.events || 0,
      num: el.querySelector('.year-num'),
      bar: el.querySelector('.year-bar-fill'),
    }));

    const total = years.reduce((s, y) => s + y.events, 0);
    const max = years.reduce((m, y) => Math.max(m, y.events), 0) || 1;
    const currentYear = new Date().getFullYear();

    years.forEach((y) => {
      const pct = Math.round((y.events / max) * 100);
      y.el.style.setProperty('--target-bar', pct + '%');
      if (y.year === currentYear) y.el.classList.add('is-current');
    });

    if (totalWrap) totalWrap.dataset.total = String(total);

    const animated = new Set();

    function animateTotal() {
      if (!totalEl || animated.has('total')) return;
      animated.add('total');
      if (reduceMotion) { totalEl.textContent = String(total); return; }
      const DURATION = 1600;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        totalEl.textContent = String(Math.round(total * easeOutExpo(t)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function animateYear(item) {
      if (animated.has(item.el)) return;
      animated.add(item.el);
      const DURATION = 1540;
      const targetBar = item.el.style.getPropertyValue('--target-bar');
      if (!item.num) {
        if (item.bar) item.bar.style.width = targetBar;
        return;
      }
      if (reduceMotion) {
        item.num.textContent = String(item.events);
        if (item.bar) item.bar.style.width = targetBar;
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        item.num.textContent = String(Math.round(item.events * easeOutExpo(t)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      if (item.bar) setTimeout(() => { item.bar.style.width = targetBar; }, 120);
    }

    if ('IntersectionObserver' in window) {
      const section = $('#numbers');
      if (section) {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            animateTotal();
            years.forEach(animateYear);
            obs.disconnect();
          });
        }, { threshold: 0.2 });
        obs.observe(section);
      } else {
        animateTotal();
        years.forEach(animateYear);
      }
    } else {
      animateTotal();
      years.forEach(animateYear);
    }
  })();

  /* 8.6. Аудиоплееры: 3 трека + общая громкость */
  (() => {
    const wraps = $$('.showreel');
    if (!wraps.length) return;

    const fmt = (s) => {
      if (!isFinite(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const r = Math.floor(s % 60);
      return m + ':' + String(r).padStart(2, '0');
    };

    const players = [];


    wraps.forEach((wrap) => {
      const audio = wrap.querySelector('audio');
      const playBtn = wrap.querySelector('.showreel-play');
      const bar = wrap.querySelector('.showreel-bar');
      const progress = wrap.querySelector('.showreel-progress');
      const timeEl = wrap.querySelector('.showreel-time');
      const volBtn = wrap.querySelector('.volume-btn');
      const volRange = wrap.querySelector('.volume-range');
      if (!audio || !playBtn || !bar || !progress || !timeEl) return;
      players.push({ wrap, audio, playBtn, bar, progress, timeEl, volBtn, volRange, seeking: false });
    });

    if (!players.length) return;

    function applyVolume(p, v) {
      const volume = clamp(v, 0, 1);
      p.audio.volume = volume;
      if (volume > 0) p.previousVolume = volume;
      if (p.volRange) {
        p.volRange.value = String(volume);
        p.volRange.style.setProperty('--val', (volume * 100) + '%');
      }
      if (p.volBtn) {
        const muted = volume === 0;
        p.volBtn.classList.toggle('muted', muted);
        p.volBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
        p.volBtn.setAttribute('aria-pressed', String(muted));
      }
    }
    players.forEach(p => applyVolume(p, 0.25));

    players.forEach((p) => {
      const updateUI = () => {
        if (!p.audio.duration || !isFinite(p.audio.duration)) {
          p.timeEl.textContent = '0:00 / 0:00';
          return;
        }
        const pct = (p.audio.currentTime / p.audio.duration) * 100;
        p.progress.style.width = pct + '%';
        p.timeEl.textContent = fmt(p.audio.currentTime) + ' / ' + fmt(p.audio.duration);
        p.bar.setAttribute('aria-valuenow', String(Math.round(pct)));
        p.bar.setAttribute('aria-valuetext', fmt(p.audio.currentTime) + ' из ' + fmt(p.audio.duration));
      };

      p.playBtn.addEventListener('click', () => {
        if (p.audio.paused) {
          p.audio.play().catch(() => { p.wrap.classList.add('error'); });
        } else {
          p.audio.pause();
        }
      });

      p.audio.addEventListener('play', () => {
        p.wrap.classList.add('playing');
        p.playBtn.setAttribute('aria-pressed', 'true');
        p.playBtn.setAttribute('aria-label', 'Пауза');

        // Останавливаем другие шоурилы
        players.forEach((other) => {
          if (other !== p && !other.audio.paused) other.audio.pause();
        });

        // ↓↓↓ ИЗМЕНЕНИЕ №1: останавливаем фоновую музыку (Stronger), если играет
        const bgMusic = document.getElementById('bgMusic');
        if (bgMusic && !bgMusic.paused) bgMusic.pause();
      });
      p.audio.addEventListener('pause', () => {
        p.wrap.classList.remove('playing');
        p.playBtn.setAttribute('aria-pressed', 'false');
        p.playBtn.setAttribute('aria-label', 'Воспроизвести');
      });
      p.audio.addEventListener('ended', () => {
        p.wrap.classList.remove('playing');
        p.playBtn.setAttribute('aria-pressed', 'false');
        p.audio.currentTime = 0;
        updateUI();
      });
      p.audio.addEventListener('timeupdate', () => { if (!p.seeking) updateUI(); });
      p.audio.addEventListener('loadedmetadata', updateUI);
      p.audio.addEventListener('error', () => p.wrap.classList.add('error'));

      const seekFromPointer = (e) => {
        const r = p.bar.getBoundingClientRect();
        const ratio = clamp((e.clientX - r.left) / r.width, 0, 1);
        if (p.audio.duration && isFinite(p.audio.duration)) {
          p.audio.currentTime = ratio * p.audio.duration;
          p.progress.style.width = (ratio * 100) + '%';
          p.timeEl.textContent = fmt(p.audio.currentTime) + ' / ' + fmt(p.audio.duration);
        }
      };
      p.bar.addEventListener('pointerdown', (e) => {
        if (!p.audio.duration) return;
        p.bar.setPointerCapture(e.pointerId);
        p.seeking = true;
        seekFromPointer(e);
      });
      p.bar.addEventListener('pointermove', (e) => {
        if (p.seeking) seekFromPointer(e);
      });
      const endSeek = () => { p.seeking = false; };
      p.bar.addEventListener('pointerup', endSeek);
      p.bar.addEventListener('pointercancel', endSeek);
      p.bar.addEventListener('keydown', (e) => {
        if (!p.audio.duration) return;
        let d = 0;
        if (e.key === 'ArrowRight') d = 5;
        else if (e.key === 'ArrowLeft') d = -5;
        if (d) {
          e.preventDefault();
          p.audio.currentTime = clamp(p.audio.currentTime + d, 0, p.audio.duration);
          updateUI();
        }
      });

      if (p.volRange) {
        p.volRange.addEventListener('input', () => {
          applyVolume(p, parseFloat(p.volRange.value));
        });
      }
      if (p.volBtn) {
        p.volBtn.addEventListener('click', () => {
          applyVolume(p, p.audio.volume > 0 ? 0 : (p.previousVolume || 0.25));
        });
      }
    });
  })();

  /* 9. Лайтбокс */
  (() => {
    const lb = $('#lightbox');
    const lbImg = $('#lbImg');
    const lbCap = $('#lbCap');
    const lbCount = $('#lbCount');
    const btnClose = $('#lbClose');
    const btnPrev = $('#lbPrev');
    const btnNext = $('#lbNext');
    const items = $$('.gallery-item');
    if (!lb || !lbImg || !items.length) return;

    const data = items.map((btn) => {
      const img = btn.querySelector('img');
      const cap = btn.querySelector('.gallery-cap');
      return {
        src: btn.dataset.src || (img && img.src) || '',
        alt: (img && img.alt) || '',
        caption: (cap && cap.textContent.trim()) || (img && img.alt) || '',
      };
    });

    let idx = 0;
    let lastFocus = null;

    function render() {
      const item = data[idx];
      lbImg.src = item.src;
      lbImg.alt = item.alt;
      lbCap.textContent = item.caption;
      if (lbCount) lbCount.textContent = `${idx + 1} / ${data.length}`;
    }
    function open(i) {
      idx = i;
      lastFocus = document.activeElement;
      render();
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add('open'));
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      if (btnClose) btnClose.focus();
    }
    function close() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      setTimeout(() => {
        lb.hidden = true;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, 350);
    }
    function next() { idx = (idx + 1) % data.length; render(); }
    function prev() { idx = (idx - 1 + data.length) % data.length; render(); }

    items.forEach((btn, i) => btn.addEventListener('click', () => open(i)));
    if (btnClose) btnClose.addEventListener('click', close);
    if (btnNext) btnNext.addEventListener('click', next);
    if (btnPrev) btnPrev.addEventListener('click', prev);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });
    let touchX = 0;
    lb.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      touchX = e.touches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (!e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
    });
  })();

  /* 10. Карточки работ */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  $$('.track').forEach((card, idx) => {
    const canvas = $('canvas', card);
    if (!canvas) return;
    const rnd = mulberry32(1000 + idx * 77);
    const N = 84;
    const amps = [];
    for (let i = 0; i < N; i++) {
      const env = 0.3 + 0.7 * Math.abs(Math.sin((i / N) * Math.PI * (1.2 + idx * 0.55) + idx));
      amps.push(clamp(env * (0.35 + 0.65 * rnd()), 0.06, 1));
    }
    let prog = 0, raf = 0, startTs = 0;

    function draw(p) {
      const { g, w, h } = sizeCanvas(canvas);
      g.clearRect(0, 0, w, h);
      const bw = w / N;
      for (let i = 0; i < N; i++) {
        const played = i / N <= p;
        g.fillStyle = played ? '#ff9f0a' : 'rgba(134,134,139,.35)';
        const bh = amps[i] * h * 0.92;
        g.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
      }
      if (p > 0 && p < 1) {
        g.fillStyle = '#ff453a';
        g.fillRect(Math.round(p * w) - 1, 0, 2, h);
      }
    }
    function run(ts) {
      if (!startTs) startTs = ts;
      prog = (ts - startTs) / 4500;
      if (prog >= 1) { prog = 1; draw(1); raf = 0; return; }
      draw(prog);
      raf = requestAnimationFrame(run);
    }
    function go() {
      if (reduceMotion) { prog = 1; draw(1); return; }
      cancelAnimationFrame(raf); startTs = 0; raf = requestAnimationFrame(run);
    }
    function rest() { cancelAnimationFrame(raf); raf = 0; prog = 0; draw(0); }

    card.addEventListener('pointerenter', go);
    card.addEventListener('focus', go);
    card.addEventListener('pointerleave', rest);
    card.addEventListener('blur', rest);
    new ResizeObserver(() => draw(prog)).observe(canvas);
    draw(0);
  });

  /* 11. Контакты */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const v = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(v);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = v; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
    }
    toast('Скопировано: ' + v);
  }));

  const printBtn = $('#printBtn');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* 12. Музыка: Stronger — Kanye West */
  (() => {
    const btn = document.getElementById('musicBtn');
    const audio = document.getElementById('bgMusic');
    if (!btn || !audio) return;

    audio.volume = 0.5;

    const toast = document.getElementById('toast');
    let toastTimer = 0;
    function showToast(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }

    function setPlayingUI(playing) {
      btn.classList.toggle('playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? 'Поставить на паузу' : 'Включить музыку');
    }

    // Первичная диагностика
    console.log('[music] element:', audio);
    console.log('[music] src:', audio.src);

    btn.addEventListener('click', async () => {
      if (btn.classList.contains('error')) {
        showToast('Нет файла: audio/stronger.mp3');
        return;
      }

      if (!audio.paused) {
        audio.pause();
        return;
      }

      // 1. Убедимся, что AudioContext разбужен (Chrome/Safari)
      if (window.__heroAudio && window.__heroAudio.resume) {
        try { window.__heroAudio.resume(); } catch (_) {}
      }
      const ctx = window.__heroAudio && window.__heroAudio.context;
      if (ctx && ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (_) {}
      }

      // ↓↓↓ ИЗМЕНЕНИЕ №2: останавливаем все шоурилы, если что-то из них играет
      document.querySelectorAll('.showreel audio').forEach((a) => {
        if (!a.paused) a.pause();
      });

      // 2. Пробуем запустить
      try {
        await audio.play();
        console.log('[music] play OK, duration:', audio.duration, 'ctx:', ctx && ctx.state);
      } catch (e) {
        console.error('[music] play rejected:', e.name, e.message);
        btn.classList.add('error');
        let hint = e.message || e.name || 'ошибка';
        if (e.name === 'NotAllowedError') hint = 'браузер заблокировал автозапуск';
        if (e.name === 'NotSupportedError') hint = 'формат не поддерживается';
        showToast('Аудио не запустилось: ' + hint);
        // Проверяем, существует ли файл вообще
        fetch(audio.src, { method: 'HEAD' }).then((r) => {
          if (!r.ok) console.error('[music] HEAD', r.status, audio.src);
        }).catch(() => {});
      }
    });

    audio.addEventListener('play',  () => {
      // При включении фоновой музыки ставим остальные треки на паузу.
      document.querySelectorAll('audio').forEach((other) => {
        if (other !== audio && !other.paused) other.pause();
      });
      setPlayingUI(true);
      // «Сторож»: если через 600 мс currentTime не сдвинулся — элемент захвачен, но не подключён
      setTimeout(() => {
        if (!audio.paused && audio.currentTime === 0 && window.__heroAudio) {
          console.warn('[music] currentTime не растёт — переподключаю source → destination');
          window.__heroAudio.forceReconnect();
        }
      }, 600);
    });
    audio.addEventListener('pause', () => setPlayingUI(false));
    audio.addEventListener('ended', () => setPlayingUI(false));

    audio.addEventListener('loadedmetadata', () => {
      console.log('[music] metadata OK, длительность:', audio.duration);
      btn.classList.remove('error');
    });

    audio.addEventListener('error', () => {
      const err = audio.error;
      console.error('[music] audio error:', err && err.code, err && err.message, 'src:', audio.src);
      btn.classList.add('error');
      let msg = 'Ошибка аудио';
      if (err) {
        if (err.code === 1) msg = 'Загрузка прервана';
        else if (err.code === 2) msg = 'Сетевая ошибка (файл есть?)';
        else if (err.code === 3) msg = 'Файл повреждён или не mp3';
        else if (err.code === 4) msg = 'Формат не поддерживается или файла нет';
      }
      showToast(msg + ' — проверьте audio/stronger.mp3');
      btn.title = 'Нужен файл audio/stronger.mp3. ' + msg;
    });
  })();
})();
// Выравниваем содержимое карточек отдельно в каждом визуальном ряду.
(() => {
  const grid = document.querySelector('.gear-list');
  if (!grid) return;
  const cards = [...grid.children];
  let frame;
  function align() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const selectors = ['summary', '.gear-spec', '.gear-info > p:nth-child(2)', '.gear-info > h4'];
      cards.forEach(card => selectors.forEach(sel => {
        const el = card.querySelector(sel);
        if (el) el.style.minHeight = '';
      }));
      const rows = new Map();
      cards.forEach(card => {
        const top = Math.round(card.getBoundingClientRect().top);
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push(card);
      });
      rows.forEach(row => {
        if (row.length < 2) return;
        selectors.forEach(sel => {
          const els = row.filter(c => sel === 'summary' || c.querySelector('details').open)
            .map(c => c.querySelector(sel)).filter(Boolean);
          const height = Math.max(0, ...els.map(el => el.getBoundingClientRect().height));
          els.forEach(el => { el.style.minHeight = height + 'px'; });
        });
      });
    });
  }
  grid.querySelectorAll('details').forEach(el => el.addEventListener('toggle', align));
  let lastWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width !== lastWidth) { lastWidth = width; align(); }
  }).observe(grid);
  document.fonts.ready.then(align);
  window.addEventListener('resize', align);
  align();
})();

(() => {
  const buttons = [...document.querySelectorAll('.tool-chip')];
  const panel = document.getElementById('toolSummary');
  if (!panel) return;
  const summaries = [
    'Запись и монтаж многодорожечных сессий, работа с дублями и подготовка материала к сведению. Полезно в студийной работе, где важны точность редактирования и порядок в проекте.',
    'Работа с музыкальными идеями, аранжировкой и обработкой звука. Помогает готовить музыкальный материал и выстраивать структуру композиции.',
    'Запись, монтаж и сведение аудио в гибкой рабочей среде. Подходит для обработки речи, музыкальных записей и подготовки материалов к выпуску.',
    'Настройка входных каналов, маршрутизация и сведение в реальном времени. Помогает управлять голосами, инструментами и воспроизведением в единой программе мероприятия.',
    'Выбор и размещение микрофона под голос или инструмент, настройка уровня записи. Это основа чистого исходного материала и разборчивого звучания.',
    'Оценка звучания пространства и настройка системы под зал. Помогает улучшить разборчивость речи, баланс музыки и контролировать обратную связь.'
  ];
  buttons.forEach(button => button.addEventListener('click', () => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    buttons.forEach(other => other.setAttribute('aria-pressed', String(active && other === button)));
    panel.hidden = !active;
    if (active) {
      panel.querySelector('h4').textContent = button.textContent;
      panel.querySelector('p').textContent = summaries[Number(button.dataset.tool)];
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        panel.animate([{opacity:0, transform:'translateY(5px)'},{opacity:1, transform:'translateY(0)'}], {duration:180, easing:'ease-out'});
    }
  }));
})();
