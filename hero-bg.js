/* ===== Фон главного экрана: «Звуковой ландшафт» =====
   Холм из волновых линий уходит к горизонту, как спектр трека.
   Над ним расходятся круги от ударов, внизу плывут искры.
   Курсор поднимает волну под собой, клик запускает «удар баса».
   WebGL; если его нет, рисуется упрощённая версия на 2D canvas.
*/
(() => {
  'use strict';

  const canvas = document.getElementById('heroCanvas');
  const hero = document.getElementById('top');
  if (!canvas || !hero) return;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const LINES = (coarse || innerWidth < 760) ? 22 : 30;

  /* ---------------- Шейдеры ---------------- */
  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform float uIntro;   // 0..1, появление
uniform vec2  uMouse;   // -1..1, сглаженный
uniform float uAct;     // 0..1, курсор над экраном
uniform float uBoost;   // 0..1, энергия от клика
uniform vec2 uRings[12];
uniform vec3  uClick;   // xy: точка клика, z: время клика (<0: не было)

const float NEAR = 0.65;
const vec3 AMBER = vec3(1.0, 0.62, 0.04);
const vec3 BLUE  = vec3(0.04, 0.52, 1.0);
const vec3 HOT   = vec3(1.0, 0.93, 0.76);

float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// высота «спектра» в мировой точке (xw, n)
float terrain(float xw, float n){
  vec2 q = vec2(xw * 0.8, n * 0.45);
  float h = vnoise(q + vec2(4.7, 0.0)) + 0.5 * vnoise(q * 2.2 + vec2(1.3, 7.9));
  h *= 0.6667;
  h = max(h - 0.30, 0.0) * 1.45;
  h = h * h * 1.35;
  float side = 1.0 - exp(-xw * xw * 0.06);       // 0 в центре, 1 по краям
  return h * (0.16 + 1.25 * side);
}

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  float px = 2.0 / uRes.y;
  float t = uTime;
  float ie = 1.0 - pow(1.0 - uIntro, 3.0);

  // «музыкальная» динамика: общий уровень + удар каждые 0.625 с (96 BPM)
  float bp = 0.5 + 0.5 * cos(6.2831853 * t * 1.6);
  float beat = bp * bp * bp;                       // плавный пульс 96 BPM
  float energy = (0.80 + 0.20 * sin(t * 0.45) * sin(t * 0.17 + 1.0) + 0.05 * beat + 0.55 * uBoost) * ie;

  vec2 mp = vec2(uMouse.x * aspect, uMouse.y);
  float horizon = 0.24 + uMouse.y * 0.035 * uAct;
  float above = p.y - horizon;

  /* ---------- ландшафт: идём от ближних линий к дальним ----------
     acc: накопленный свет, T: сколько ещё видно «сквозь» ближние линии.
     Как только пиксель закрыт ближней горой (T ~ 0), дальше можно не считать:
     это в разы дешевле и не нагружает видеокарту. */
  vec3 acc = vec3(0.0);
  float T = 1.0;

  float wide = clamp(1.6 / aspect, 1.0, 2.2);     // на узких экранах показываем больше «мира»
  float spd = t * 0.45;
  float baseId = floor(spd);
  float fr = spd - baseId;

  for (int i = 0; i < LINES; i++){
    float l = float(i);
    float u = l - fr;
    // линия, проходящая «сквозь камеру», плавно гаснет и не должна закрывать кадр
    float nf = smoothstep(0.10, 0.90, u + NEAR);
    if (nf <= 0.0) continue;
    float persp = 1.0 / (u + NEAR);
    float yBase = horizon - 0.95 * persp;

    // линия целиком выше пикселя и не может его закрыть: берём только её свечение, если рядом
    float top = yBase + 3.4 * persp + 0.04;
    if (p.y > top) continue;

    float n = l + baseId;
    float xw = p.x * wide * (u + NEAR) * 1.15 + uMouse.x * 1.4 * uAct + 0.5 * sin(t * 0.13);

    float h = terrain(xw, n);
    h += 0.025 * sin(xw * 9.0 + t * 1.8 + n) * h;   // дрожь на вершинах
    float swell = 0.5 + 0.5 * sin(n * 0.8 - t * 1.1 + xw * 0.6);
    h += 0.22 * swell * swell;                      // бегущая к зрителю волна

    // волна под курсором
    float dx = p.x - mp.x;
    float dyl = (yBase + 0.25 * persp) - mp.y;
    float g = exp(-(dx * dx * 4.0 + dyl * dyl * 10.0));
    h += uAct * g * 1.3 * (0.65 + 0.35 * sin(t * 7.0 - length(vec2(dx, dyl)) * 14.0));

    h *= nf;
    float y = yBase + h * energy * persp * 1.05;
    float depthN = clamp(u / float(LINES - 1), 0.0, 1.0);   // 0 близко, 1 далеко (плавно, без скачков)
    float hot = clamp(h * energy * 0.85, 0.0, 1.0);

    vec3 lc = mix(BLUE, AMBER, 1.0 - smoothstep(0.15, 1.0, depthN));
    lc = mix(lc, HOT, hot * hot);

    // сама линия
    float dl = abs(p.y - y);
    float wpx = px * mix(0.9, 2.2, clamp(persp * 0.9, 0.0, 1.0));
    float core = 1.0 - smoothstep(0.0, wpx, dl);
    float glow = exp(-dl / (wpx * 5.0)) * 0.22;
    float fog = pow(1.0 - depthN, 1.3) * 0.9 + 0.1;
    float farFade = 1.0 - smoothstep(0.82, 1.0, depthN);   // дальние линии плавно появляются
    float bright = (0.45 + 1.4 * hot) * fog * nf * farFade;
    acc += T * lc * (core + glow) * bright * ie;

    // закраска под линией скрывает всё, что дальше
    float below = y - p.y;
    float fillM = smoothstep(-px * 0.5, px, below);
    vec3 fillC = lc * 0.07 * hot * exp(-max(below, 0.0) * 7.0 * (0.4 + persp));   // max: без переполнения exp -> NaN
    acc += T * fillM * fillC;
    T *= 1.0 - fillM;
    if (T < 0.01) break;
  }

  /* ---------- небо (считаем только там, где оно видно) ---------- */
  vec3 col = acc;
  if (T > 0.01){
    vec3 sky = vec3(0.0);
    float hg = exp(-length(vec2(p.x * 0.7, above * 1.7)) * 1.6);
    sky += AMBER * 0.30 * hg * ie;
    sky += vec3(1.0, 0.45, 0.05) * 0.25 * exp(-abs(above) * 9.0) * exp(-p.x * p.x * 0.45) * ie;

    float skyMask = smoothstep(-0.02, 0.06, above);

    // туманность
    vec2 nq = vec2(p.x * 0.8 + t * 0.015, p.y * 1.2 - t * 0.01);
    float nb = vnoise(nq * 1.7) * 0.65 + vnoise(nq * 3.6 + 5.0) * 0.35;
    sky += mix(BLUE, AMBER, smoothstep(0.35, 0.8, nb)) * pow(nb, 2.4) * 0.30
           * smoothstep(0.0, 0.7, above) * ie;

    // Фоновые импульсы входят в небо: ландшафт перекрывает их через T.
    float rd = length(vec2(p.x * 0.9, above));
    for (int k = 0; k < 12; k++) {
      float age = t - uRings[k].x;
      if (uRings[k].y > 0.0 && age > 0.0 && age < 3.6) {
        float phase = age / 3.6;
        float radius = age * 0.64;
        float width = 0.009 + phase * 0.018;
        float fade = smoothstep(0.0, 0.06, age) * pow(1.0 - phase, 1.7);
        float distanceToRing = rd - radius;
        float core = exp(-pow(distanceToRing / width, 2.0));
        float halo = exp(-pow(distanceToRing / (width * 4.0), 2.0));
        sky += mix(AMBER, HOT, 0.25) * (core * 0.8 + halo * 0.2)
          * fade * uRings[k].y * skyMask * ie;
      }
    }

    // звёзды
    vec2 sg = p * 24.0 + vec2(0.0, -t * 0.12);
    vec2 si = floor(sg);
    vec2 sf = fract(sg) - 0.5;
    float sr = hash21(si);
    vec2 so = (vec2(hash21(si + 1.7), hash21(si + 8.3)) - 0.5) * 0.7;
    float star = (1.0 - smoothstep(0.0, 0.07, length(sf - so))) * step(0.84, sr)
               * (0.5 + 0.5 * sin(t * (1.0 + sr * 3.0) + sr * 40.0));
    sky += vec3(1.0, 0.9, 0.75) * star * 0.8 * smoothstep(0.05, 0.5, above) * ie;

    col += T * sky;
  }

  /* ---------- искры ---------- */
  vec2 eg = p * 9.0 + vec2(0.0, -t * 0.35);
  vec2 ei = floor(eg);
  vec2 ef = fract(eg) - 0.5;
  float er = hash21(ei + 3.3);
  vec2 eo = (vec2(hash21(ei + 1.1), hash21(ei + 7.7)) - 0.5) * 0.6;
  eo.x += 0.12 * sin(t * 0.8 + er * 30.0);
  float ember = (1.0 - smoothstep(0.0, 0.05, length(ef - eo))) * step(0.9, er)
              * (0.5 + 0.5 * sin(t * 1.7 + er * 40.0));
  col += AMBER * ember * 0.9 * ie * (1.0 - smoothstep(0.1, 1.0, p.y));

  /* ---------- финальная обработка ---------- */
  col = 1.0 - exp(-col * 1.35);
  col *= 1.0 - 0.38 * dot(p * 0.5, p * 0.5);
  col += (hash21(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

  /* ---------------- Общее состояние ---------------- */
  const S = {
    t: 0,                    // секунды анимации
    introStart: -1,          // момент старта появления (мс)
    intro: 0,
    mx: 0, my: 0, tx: 0, ty: 0,
    act: 0, actT: 0,
    boost: 0,
    click: [0, 0, -1],
    visible: true,
    running: false,
    raf: 0,
    last: 0,
    scale: Math.min(window.devicePixelRatio || 1, 1.5) * (coarse ? 0.5 : 0.6),
    maxScale: Math.min(window.devicePixelRatio || 1, 1.5),
    ema: 16.7,
    dts: 0.0167,
    frames: 0,
  };
  const MIN_SCALE = 0.45;

  let renderer = null;

  // Независимые кольца: повторный клик не сбрасывает предыдущие.
  const ringCanvas = document.createElement('canvas');
  ringCanvas.setAttribute('aria-hidden', 'true');
  ringCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;background:transparent';
  canvas.after(ringCanvas);
  const ringCtx = ringCanvas.getContext('2d');
  const rings = [];
  const ambientRings = new Float32Array(24);
  let ambientIndex = 0;
  function emitAmbient(strength) {
    ambientRings[ambientIndex * 2] = S.t;
    ambientRings[ambientIndex * 2 + 1] = strength;
    ambientIndex = (ambientIndex + 1) % 12;
  }
  const music = document.getElementById('bgMusic');
  let analyser, spectrum, audioContext, source;
  let lastIdle = -10, lastMusicTime = -1;
  const beatTimes = window.strongerBeats || [];
  const eqBars = [...document.querySelectorAll('.music-eq i')];
  const eqLevels = [0.3, 0.3, 0.3, 0.3];
  const bands = [[40, 180], [180, 700], [700, 2800], [2800, 10000]];
  function connectAudio() {
    if (!music) return;
    try {
      if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.35;
        spectrum = new Uint8Array(analyser.frequencyBinCount);
        source = audioContext.createMediaElementSource(music);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }
      audioContext.resume().catch(() => {});
    } catch (error) { console.warn('[hero-audio]', error); }
  }
  document.getElementById('musicBtn')?.addEventListener('click', connectAudio);
  function drawRings(dt) {
    if (!ringCtx) return;
    const w = ringCanvas.width, h = ringCanvas.height;
    ringCtx.clearRect(0, 0, w, h);
    const playing = music && !music.paused && !music.ended;
    if (playing && analyser && audioContext.state === 'running') {
      analyser.getByteFrequencyData(spectrum);
      const binHz = audioContext.sampleRate / analyser.fftSize;
      eqBars.forEach((bar, index) => {
        const [low, high] = bands[index];
        let sum = 0, count = 0;
        for (let i = Math.max(1, Math.floor(low / binHz)); i <= Math.min(spectrum.length - 1, Math.ceil(high / binHz)); i++) {
          sum += Math.pow(spectrum[i] / 255, 2); count++;
        }
        const target = 0.12 + 0.88 * Math.min(1, Math.sqrt(sum / count) * 1.3);
        eqLevels[index] += (target - eqLevels[index]) * (1 - Math.exp(-dt * (target > eqLevels[index] ? 25 : 8)));
        bar.style.transform = 'scaleY(' + eqLevels[index] + ')';
      });
      const time = music.currentTime;
      // Привязка к позиции аудио: пауза, повтор и перемотка не сбивают ритм.
      const from = lastMusicTime < 0 || time < lastMusicTime || time - lastMusicTime > 0.3 ? time - 0.06 : lastMusicTime;
      for (const beatTime of beatTimes) {
        if (beatTime > time) break;
        if (beatTime > from) {
          emitAmbient(0.95);
          ambientRings[((ambientIndex + 11) % 12) * 2] -= time - beatTime;
        }
      }
      lastMusicTime = time;
    } else if (!playing && S.t - lastIdle > 1.8) {
      emitAmbient(0.55);
      lastIdle = S.t;
      lastMusicTime = -1;
    }
    if (!playing) eqBars.forEach((bar, i) => {
      eqLevels[i] += (0.3 - eqLevels[i]) * (1 - Math.exp(-dt * 10));
      bar.style.transform = 'scaleY(' + eqLevels[i] + ')';
    });
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], age = S.t - r.born, life = 3.6;
      if (age >= life) { rings.splice(i, 1); continue; }
      const fade = Math.min(1, age / 0.18) * Math.pow(1 - age / life, 2) * r.strength * S.intro;
      ringCtx.beginPath();
      ringCtx.arc(r.x * w, r.y * h, age * h * 0.32, 0, Math.PI * 2);
      ringCtx.strokeStyle = 'rgba(255,199,94,' + fade + ')';
      ringCtx.lineWidth = Math.max(2.5, h / 280);
      ringCtx.shadowColor = 'rgba(255,174,35,' + fade * 0.6 + ')';
      ringCtx.shadowBlur = 8;
      ringCtx.stroke();
    }
  }

  /* ---------------- WebGL ---------------- */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[hero-bg] shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG.replace('const float NEAR', '#define LINES ' + LINES + '\nconst float NEAR'));
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[hero-bg] link:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  function webglAvailable() {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
      if (!gl) return false;
      const ok = !!buildProgram(gl);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return ok;
    } catch (e) { return false; }
  }

  function createGLRenderer() {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' })
            || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    let prog = null, loc = {}, buf = null;
    function init() {
      prog = buildProgram(gl);
      if (!prog) return false;
      gl.useProgram(prog);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uIntro', 'uMouse', 'uAct', 'uBoost', 'uClick', 'uRings[0]'].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
      return true;
    }
    if (!init()) return null;

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
    canvas.addEventListener('webglcontextrestored', () => { init(); draw(); }, false);

    function draw() {
      if (gl.isContextLost()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uTime, S.t);
      gl.uniform1f(loc.uIntro, S.intro);
      gl.uniform2f(loc.uMouse, S.mx, S.my);
      gl.uniform1f(loc.uAct, S.act);
      gl.uniform1f(loc.uBoost, S.boost);
      gl.uniform2fv(loc['uRings[0]'], ambientRings);
      gl.uniform3f(loc.uClick, S.click[0], S.click[1], S.click[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { draw, adaptive: true };
  }

  /* ---------------- Запасной вариант на 2D canvas ---------------- */
  function createFallbackRenderer() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vn = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      let fx = x - ix, fy = y - iy;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    };
    const terrain = (xw, n) => {
      let h = vn(xw * 0.8 + 4.7, n * 0.45) + 0.5 * vn(xw * 1.76 + 1.3, n * 0.99 + 7.9);
      h = Math.max(h * 0.6667 - 0.30, 0) * 1.45;
      return h * h * 1.35 * (0.25 + 0.95 * Math.exp(-xw * xw * 0.05));
    };
    const rows = 26;

    function draw() {
      const w = canvas.width, hpx = canvas.height, half = hpx / 2;
      const ie = 1 - Math.pow(1 - S.intro, 3);
      const t = S.t;
      const energy = (0.8 + 0.2 * Math.sin(t * 0.45) * Math.sin(t * 0.17 + 1) + 0.55 * S.boost) * ie;
      const horizon = half - 0.16 * half;   // y сверху

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, hpx);
      const g = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, Math.max(w, hpx) * 0.6);
      g.addColorStop(0, `rgba(255,159,10,${0.35 * ie})`);
      g.addColorStop(1, 'rgba(255,159,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, hpx);

      const spd = t * 0.45, baseId = Math.floor(spd), fr = spd - baseId;
      const step = Math.max(4, Math.round(w / 220));
      for (let i = 0; i < rows; i++) {
        const l = rows - 1 - i, u = l - fr, persp = 1 / (u + 0.65);
        const yBase = horizon + 0.95 * persp * half;
        const depthN = l / (rows - 1);
        const pts = [];
        for (let x = 0; x <= w + step; x += step) {
          const xw = ((x - w / 2) / half) * (u + 0.65) * 1.15 + 0.5 * Math.sin(t * 0.13);
          const h = terrain(xw, l + baseId);
          pts.push([x, yBase - h * energy * persp * 0.75 * half, h]);
        }
        ctx.beginPath();
        ctx.moveTo(0, hpx + 2);
        pts.forEach((q) => ctx.lineTo(q[0], q[1]));
        ctx.lineTo(w + step, hpx + 2);
        ctx.closePath();
        ctx.fillStyle = '#020100';
        ctx.fill();

        ctx.beginPath();
        pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        const warm = 1 - Math.min(1, Math.max(0, (depthN - 0.15) / 0.85));
        const r = Math.round(10 + 245 * warm), gg = Math.round(133 + (159 - 133) * warm - 20 * (1 - warm)), b = Math.round(255 - 245 * warm);
        ctx.strokeStyle = `rgba(${r},${gg},${b},${(0.25 + 0.75 * (1 - depthN)) * ie})`;
        ctx.lineWidth = 1 + (1 - depthN) * 1.6;
        ctx.stroke();
      }
    }
    return { draw, adaptive: false };
  }

  /* ---------------- Размер ---------------- */
  function resize() {
    const cssW = Math.max(1, canvas.clientWidth || hero.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight || hero.clientHeight);
    ringCanvas.width = Math.round(cssW);
    ringCanvas.height = Math.round(cssH);
    const sc = renderer && renderer.adaptive ? S.scale : Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(cssW * sc));
    const h = Math.max(2, Math.round(cssH * sc));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  /* ---------------- Цикл ---------------- */
  function frame(now) {
    S.raf = 0;
    if (!S.running) return;
    const dt = Math.min(0.1, (now - S.last) / 1000 || 0.016);
    S.last = now;

    S.dts += (dt - S.dts) * 0.12;
    S.t += S.dts;
    if (S.introStart >= 0) S.intro = clamp((now - S.introStart) / 2800, 0, 1);

    const k = 1 - Math.exp(-dt * 5);
    S.mx += (S.tx - S.mx) * k;
    S.my += (S.ty - S.my) * k;
    S.act += (S.actT - S.act) * (1 - Math.exp(-dt * 3));
    S.boost *= Math.exp(-dt * 2.2);

    // подстройка качества под скорость кадров
    if (renderer.adaptive) {
      S.ema = S.ema * 0.92 + dt * 1000 * 0.08;
      if (++S.frames % 45 === 0 && S.ema > 26 && S.scale > MIN_SCALE) {
        S.scale = Math.max(MIN_SCALE, S.scale * 0.82);
        resize();
      }
    }
    renderer.draw();
    drawRings(dt);
    schedule();
  }
  function schedule() {
    if (!S.raf && S.running) S.raf = requestAnimationFrame(frame);
  }
  function update() {
    const want = S.visible && !document.hidden && S.introStart >= 0 && !reduceQuery.matches;
    if (want && !S.running) {
      S.running = true;
      S.last = performance.now();
      schedule();
    } else if (!want && S.running) {
      S.running = false;
      cancelAnimationFrame(S.raf);
      S.raf = 0;
    }
  }

  function drawStatic() {
    S.t = 7.3; S.intro = 1;
    resize();
    renderer.draw();
  }

  /* ---------------- Ввод ---------------- */
  function pointerToState(e) {
    const r = hero.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const inside = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
    S.tx = clamp(nx, -1, 1);
    S.ty = clamp(ny, -1, 1);
    S.actT = inside ? 1 : 0;
    return inside ? { nx, ny, aspect: r.width / r.height } : false;
  }
  window.addEventListener('pointermove', (e) => { pointerToState(e); }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    const info = pointerToState(e);
    if (!info || reduceQuery.matches) return;
    rings.push({ x: (info.nx + 1) / 2, y: (1 - info.ny) / 2, born: S.t, strength: 0.8 });
    S.boost = Math.min(0.4, S.boost + 0.15);
  }, { passive: true });
  const releasePointer = () => { S.actT = 0; };
  document.addEventListener('pointerleave', releasePointer);
  window.addEventListener('blur', releasePointer);
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') releasePointer(); }, { passive: true });

  /* ---------------- Запуск ---------------- */
  renderer = (webglAvailable() && createGLRenderer()) || createFallbackRenderer();
  if (!renderer) return;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      S.visible = entries[0].isIntersecting;
      update();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', update);
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      resize();
      if (!S.running && S.introStart >= 0) { if (reduceQuery.matches) drawStatic(); else renderer.draw(); }
    }).observe(hero);
  }
  const onMotion = () => { if (reduceQuery.matches) { update(); drawStatic(); } else { S.introStart = performance.now() - 2800; update(); } };
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onMotion);

  // Чёрный кадр, пока идёт прелоадер; анимация начинается, когда страница готова.
  resize();
  renderer.draw();

  function begin() {
    if (S.introStart >= 0) return;
    if (reduceQuery.matches) { S.introStart = performance.now(); drawStatic(); return; }
    S.introStart = performance.now();
    update();
  }
  const root = document.documentElement;
  if (root.classList.contains('ready')) begin();
  else {
    const mo = new MutationObserver(() => {
      if (root.classList.contains('ready')) { mo.disconnect(); begin(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { mo.disconnect(); begin(); }, 4500);
  }
})();
