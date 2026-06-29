(() => {
  /* ══════════════════════════════════════════════════════════════
   *  CYBER-ROMANCE MATRIX ANIMATION (UPDATED)
   *  Canvas particle text + heart rain + interactive effects
   * ══════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const heartMsg = document.getElementById('heartMessage');

  // DOM Elements for new features
  const landingScreen = document.getElementById('landingScreen');
  const btnOpen = document.getElementById('btnOpen');
  const letterContainer = document.getElementById('letterContainer');
  const letterText = document.getElementById('letterText');
  const btnRestart = document.getElementById('btnRestart');
  const skipHint = document.getElementById('skipHint');

  let W, H, dpr;

  // ═══════════ CONFIGURATION ═══════════
  const RAIN_CHARS = '♥♡❥✦❀✿•°♥♡❤';

  // Feature 4: Adaptive Particle Count
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const PARTICLE_N = isMobile ? 500 : 1600;

  const SPRING = 0.09;
  const FRICTION = 0.80;

  // Feature 6: Personal Letter Text
  const LETTER_CONTENT = "makasih yah cantikk\nkamu udah mau sama aku dan nerima segala kekurangan ku,\n\naku gak bisa janjiin apa apa untuk sekarang cuma aku bakal berusaha buat bikin kamu selalu bahagia dan terus nyaman sama aku\n\n♥";

  // Updated Sequence (excluding Fitur 8 & non-looping at the end)
  const SEQ = [
    { text: '3', dur: 1400, fs: 0.35, title: '3...' },
    { text: '2', dur: 1400, fs: 0.35, title: '2...' },
    { text: '1', dur: 1400, fs: 0.35, title: '1...' },
    { text: 'You', dur: 1100, fs: 0.24, title: '♥ You' },
    { text: 'Are', dur: 1100, fs: 0.24, title: '♥ Are' },
    { text: 'My', dur: 1100, fs: 0.24, title: '♥ My' },
    { text: 'Favorite', dur: 1200, fs: 0.22, title: '♥ Favorite' },
    { text: 'Girls', dur: 1500, fs: 0.24, title: '♥ Girls' },
    { text: null, dur: 5500, type: 'heart', title: 'I Love You ♥' },
    { text: null, dur: 3000, type: 'fireworks', title: '♥ For You ♥' },
    { text: null, dur: 9999999, type: 'letter', title: 'Surat Untukmu ♥' },
  ];

  // ═══════════ AUDIO SYSTEM (Feature 1) ═══════════
  let audioCtx = null;
  const bgMusic = new Audio('music.mp3');
  bgMusic.loop = true;
  bgMusic.addEventListener('error', (e) => {
    console.warn("Background music ('music.mp3') could not be loaded.", e);
  });

  function initAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Heartbeat sound synthesizer (with high-frequency harmonic for small/phone speakers)
  function playHeartbeatSFX() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const playPulse = (delay) => {
      const time = audioCtx.currentTime + delay;

      // 1. Deep sub bass oscillator (felt on good audio systems)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(75, time);
      osc1.frequency.exponentialRampToValueAtTime(20, time + 0.15);

      gain1.gain.setValueAtTime(0, time);
      gain1.gain.linearRampToValueAtTime(0.8, time + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);

      // 2. Triangle oscillator with lowpass filter (audible on small/phone speakers)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(150, time);
      osc2.frequency.exponentialRampToValueAtTime(40, time + 0.15);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, time);

      gain2.gain.setValueAtTime(0, time);
      gain2.gain.linearRampToValueAtTime(0.18, time + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc2.connect(filter);
      filter.connect(gain2);
      gain2.connect(audioCtx.destination);

      osc1.start(time);
      osc1.stop(time + 0.25);
      osc2.start(time);
      osc2.stop(time + 0.25);
    };

    // Double thud: lub-dub
    playPulse(0);
    playPulse(0.18);
  }

  // Whoosh transition sound synthesizer
  function playWhooshSFX() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, audioCtx.currentTime + 0.5);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }

  // ═══════════ PARTICLE ARRAYS ═══════════
  const px = new Float32Array(PARTICLE_N);
  const py = new Float32Array(PARTICLE_N);
  const pvx = new Float32Array(PARTICLE_N);
  const pvy = new Float32Array(PARTICLE_N);
  const ptx = new Float32Array(PARTICLE_N);
  const pty = new Float32Array(PARTICLE_N);
  const psz = new Float32Array(PARTICLE_N);
  const pal = new Float32Array(PARTICLE_N);

  // Particle color interpolation states (Feature 7)
  let coreR = 255, coreG = 255, coreB = 255;
  let glowR = 255, glowG = 255, glowB = 255;
  let tCoreR = 255, tCoreG = 255, tCoreB = 255;
  let tGlowR = 255, tGlowG = 255, tGlowB = 255;

  function initParticles() {
    for (let i = 0; i < PARTICLE_N; i++) {
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
      pvx[i] = 0; pvy[i] = 0;
      ptx[i] = px[i]; pty[i] = py[i];
      psz[i] = Math.random() * 1.6 + 0.5;
      pal[i] = 0;
    }
  }

  // ═══════════ TEXT PIXEL SAMPLING ═══════════
  const S = 600; // Fixed sampling canvas size (smaller = faster on mobile)
  const off = document.createElement('canvas');
  off.width = S;
  off.height = S;
  const oCtx = off.getContext('2d', { willReadFrequently: true });

  function sampleText(text, fontRatio) {
    oCtx.clearRect(0, 0, S, S);

    let fs = S * fontRatio;
    oCtx.font = `900 ${fs}px "Inter", Arial, sans-serif`;
    // Use 'alphabetic' baseline (most reliable across all browsers)
    oCtx.textAlign = 'center';
    oCtx.textBaseline = 'alphabetic';

    // Measure real bounds
    let m = oCtx.measureText(text);
    let textW = m.width;
    let asc = m.actualBoundingBoxAscent || (fs * 0.82);
    let desc = m.actualBoundingBoxDescent || (fs * 0.18);
    let textH = asc + desc;

    // Scale down if too wide or tall for safe area
    const maxW = S * 0.88;
    const maxH = S * 0.72;
    let sf = 1.0;
    if (textW > maxW) sf = Math.min(sf, maxW / textW);
    if (textH > maxH) sf = Math.min(sf, maxH / textH);
    if (sf < 1.0) {
      fs *= sf;
      oCtx.font = `900 ${fs}px "Inter", Arial, sans-serif`;
      m = oCtx.measureText(text);
      asc = m.actualBoundingBoxAscent || (fs * 0.82);
      desc = m.actualBoundingBoxDescent || (fs * 0.18);
    }

    // Manually center: baseline Y so glyph is visually centered at S/2
    const drawY = (S / 2) + (asc - desc) / 2;

    oCtx.fillStyle = '#fff';
    oCtx.fillText(text, S / 2, drawY);

    const data = oCtx.getImageData(0, 0, S, S).data;
    const pts = [];
    const gap = isMobile ? 5 : 3;
    const screenScale = Math.min(W, H) / S;
    const halfS = S / 2;
    const halfW = W / 2;
    const halfH = H / 2;

    for (let y = 0; y < S; y += gap) {
      for (let x = 0; x < S; x += gap) {
        if (data[(y * S + x) * 4 + 3] > 128) {
          pts.push(
            (x - halfS) * screenScale + halfW,
            (y - halfS) * screenScale + halfH
          );
        }
      }
    }
    return pts;
  }

  // ═══════════ HEART POINTS (DIRECT MATH) ═══════════
  function generateHeartPoints() {
    const pts = [];
    const scale = Math.min(W, H) * 0.022;
    const cx = W / 2;
    const cy = H / 2;

    // Outline points (dense)
    for (let i = 0; i < 500; i++) {
      const t = (i / 500) * Math.PI * 2;
      const hx = cx + 16 * Math.pow(Math.sin(t), 3) * scale;
      const hy = cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale;
      pts.push(hx, hy);
    }

    // Fill interior with concentric smaller hearts
    for (let s = 0.92; s > 0.05; s -= 0.08) {
      const innerScale = scale * s;
      const numPts = Math.floor(300 * s);
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const hx = cx + 16 * Math.pow(Math.sin(t), 3) * innerScale;
        const hy = cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * innerScale;
        pts.push(hx + (Math.random() - 0.5) * 4, hy + (Math.random() - 0.5) * 4);
      }
    }

    return pts;
  }

  // ═══════════ TARGET ASSIGNMENT ═══════════
  function assignTargets(pts) {
    const n = pts.length / 2;
    for (let i = 0; i < PARTICLE_N; i++) {
      if (n === 0) {
        ptx[i] = Math.random() * W;
        pty[i] = Math.random() * H;
        pal[i] = 0;
      } else {
        // If there are MORE sample points than particles, spread the particles
        // EVENLY across all points so the entire shape is represented (otherwise
        // the tail points are never assigned and long words get truncated).
        // If there are fewer points than particles, wrap so the extras overlap
        // and densify the shape.
        const pointIndex = n > PARTICLE_N
          ? Math.floor((i * n) / PARTICLE_N)
          : (i % n);
        const idx = pointIndex * 2;
        ptx[i] = pts[idx];
        pty[i] = pts[idx + 1];
        pal[i] = 1;
      }
    }
  }

  function scatterParticles() {
    for (let i = 0; i < PARTICLE_N; i++) {
      pvx[i] += (Math.random() - 0.5) * 20;
      pvy[i] += (Math.random() - 0.5) * 20;
      ptx[i] = Math.random() * W;
      pty[i] = Math.random() * H;
      pal[i] = 0;
    }
  }

  // Scatter into slow ambient background particles for letter phase
  function scatterSlowly() {
    for (let i = 0; i < PARTICLE_N; i++) {
      ptx[i] = Math.random() * W;
      pty[i] = Math.random() * H;
      pvx[i] = (Math.random() - 0.5) * 1.5;
      pvy[i] = (Math.random() - 0.5) * 1.5;
      pal[i] = 0.5; // low opacity
    }
  }

  // ═══════════ MOUSE / TOUCH INTERACTION (Feature 3) ═══════════
  let mouseX = -9999;
  let mouseY = -9999;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (started && Math.random() < 0.45) spawnSparkle(mouseX, mouseY);
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      if (started && Math.random() < 0.45) spawnSparkle(mouseX, mouseY);
    }
  }, { passive: true });

  const resetMouse = () => { mouseX = -9999; mouseY = -9999; };
  window.addEventListener('mouseleave', resetMouse);
  window.addEventListener('touchend', resetMouse, { passive: true });

  function updateParticles(now) {
    const step = SEQ[seqIdx];
    const isHeart = step && step.type === 'heart';

    for (let i = 0; i < PARTICLE_N; i++) {
      let tx = ptx[i];
      let ty = pty[i];

      pvx[i] += (tx - px[i]) * SPRING;
      pvy[i] += (ty - py[i]) * SPRING;

      // Mouse attraction — DESKTOP POINTER ONLY.
      // On a touch screen the finger sits right on top of the text, so this
      // force sucks the glyph's particles toward the finger and garbles it.
      // Disabled on mobile to keep the text readable.
      if (!isMobile && mouseX > -1000 && mouseY > -1000) {
        const dx = mouseX - px[i];
        const dy = mouseY - py[i];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const force = (1 - dist / 130) * 0.14;
          pvx[i] += dx * force;
          pvy[i] += dy * force;
        }
      }

      pvx[i] *= FRICTION;
      pvy[i] *= FRICTION;
      px[i] += pvx[i];
      py[i] += pvy[i];
    }
  }

  // ═══════════ SPARKLE TRAIL (Feature 3) ═══════════
  const SPARKLE_MAX = 50;
  const sx = new Float32Array(SPARKLE_MAX);
  const sy = new Float32Array(SPARKLE_MAX);
  const svx = new Float32Array(SPARKLE_MAX);
  const svy = new Float32Array(SPARKLE_MAX);
  const salpha = new Float32Array(SPARKLE_MAX);
  const ssize = new Float32Array(SPARKLE_MAX);
  let sparkleIdx = 0;

  function spawnSparkle(x, y) {
    const i = sparkleIdx;
    sx[i] = x;
    sy[i] = y;
    svx[i] = (Math.random() - 0.5) * 2.5;
    svy[i] = (Math.random() - 0.5) * 2.5 - 0.4;
    salpha[i] = 1.0;
    ssize[i] = Math.random() * 2.5 + 1.2;
    sparkleIdx = (sparkleIdx + 1) % SPARKLE_MAX;
  }

  function updateDrawSparkles() {
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < SPARKLE_MAX; i++) {
      if (salpha[i] <= 0) continue;

      sx[i] += svx[i];
      sy[i] += svy[i];
      salpha[i] -= 0.025;

      if (salpha[i] > 0) {
        ctx.fillStyle = `rgba(255, 192, 203, ${salpha[i]})`;
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], ssize[i] * salpha[i], 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ═══════════ FIREWORKS SYSTEM (Feature 9) ═══════════
  const FW_MAX = 240;
  const fwx = new Float32Array(FW_MAX);
  const fwy = new Float32Array(FW_MAX);
  const fwvx = new Float32Array(FW_MAX);
  const fwvy = new Float32Array(FW_MAX);
  const fwAlpha = new Float32Array(FW_MAX);
  const fwColor = [];
  let fwActive = false;

  function spawnFireworks() {
    fwActive = true;
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < FW_MAX; i++) {
      fwx[i] = cx;
      fwy[i] = cy;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2.5;
      fwvx[i] = Math.cos(angle) * speed;
      fwvy[i] = Math.sin(angle) * speed - 1.2; // slight upward drift
      fwAlpha[i] = 1.0;
      fwColor[i] = 320 + Math.random() * 45; // Pink-Magenta hue ranges
    }
  }

  function updateDrawFireworks() {
    if (!fwActive) return;
    let activeCount = 0;
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < FW_MAX; i++) {
      if (fwAlpha[i] <= 0) continue;

      activeCount++;
      fwx[i] += fwvx[i];
      fwy[i] += fwvy[i];
      fwvy[i] += 0.07; // Gravity
      fwvx[i] *= 0.98;
      fwvy[i] *= 0.98;
      fwAlpha[i] -= 0.015;

      if (fwAlpha[i] > 0) {
        ctx.fillStyle = `hsla(${fwColor[i]}, 100%, 72%, ${fwAlpha[i]})`;
        ctx.beginPath();
        ctx.arc(fwx[i], fwy[i], Math.random() * 2.2 + 1, 0, 6.2832);
        ctx.fill();
      }
    }

    if (activeCount === 0) fwActive = false;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ═══════════ DRAW PARTICLES ═══════════
  function drawParticles(isHeart, now) {
    ctx.globalCompositeOperation = 'screen';

    // Calculate the heartbeat scale factor (pulse)
    let heartPulse = 1.0;
    if (isHeart) {
      const cycleTime = (now - seqStart) % 1200;
      if (cycleTime >= 0 && cycleTime < 160) {
        heartPulse = 1.0 + 0.22 * Math.sin((cycleTime / 160) * Math.PI);
      } else if (cycleTime >= 190 && cycleTime < 350) {
        heartPulse = 1.0 + 0.16 * Math.sin(((cycleTime - 190) / 160) * Math.PI);
      }
    }

    const cx = W / 2;
    const cy = H / 2;

    // Apply the heartbeat as ONE canvas transform instead of recomputing the
    // pulsed position+radius for every particle inside each draw loop.
    const pulsing = isHeart && heartPulse !== 1.0;
    if (pulsing) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(heartPulse, heartPulse);
      ctx.translate(-cx, -cy);
    }

    // Outer glow — skip on mobile for performance
    if (!isMobile) {
      ctx.fillStyle = `rgba(${Math.round(glowR)}, ${Math.round(glowG)}, ${Math.round(glowB)}, 0.08)`;
      ctx.beginPath();
      for (let i = 0; i < PARTICLE_N; i++) {
        if (pal[i] <= 0) continue;
        const r = psz[i] * 4;
        ctx.moveTo(px[i] + r, py[i]);
        ctx.arc(px[i], py[i], r, 0, 6.2832);
      }
      ctx.fill();
    }

    // Core
    ctx.fillStyle = `rgba(${Math.round(coreR)}, ${Math.round(coreG)}, ${Math.round(coreB)}, 0.88)`;
    ctx.beginPath();
    const coreScale = isMobile ? 1.3 : 1.0;
    for (let i = 0; i < PARTICLE_N; i++) {
      if (pal[i] <= 0) continue;
      const r = psz[i] * coreScale;
      ctx.moveTo(px[i] + r, py[i]);
      ctx.arc(px[i], py[i], r, 0, 6.2832);
    }
    ctx.fill();

    // Bright center — skip on mobile (the core layer already reads as bright,
    // and this saves a whole extra per-particle pass each frame).
    if (!isMobile) {
      ctx.fillStyle = isHeart ? 'rgba(255,210,240,0.95)' : 'rgba(255,255,250,0.95)';
      ctx.beginPath();
      for (let i = 0; i < PARTICLE_N; i++) {
        if (pal[i] <= 0) continue;
        const r = psz[i] * 0.35;
        ctx.moveTo(px[i] + r, py[i]);
        ctx.arc(px[i], py[i], r, 0, 6.2832);
      }
      ctx.fill();
    }

    if (pulsing) ctx.restore();

    ctx.globalCompositeOperation = 'source-over';
  }

  // ═══════════ MATRIX RAIN SYSTEM ═══════════
  let rainCols = [];

  function initRain() {
    rainCols = [];
    // Wider columns + shorter trails on mobile = far fewer fillText() calls per
    // frame (the matrix rain runs during every phase, including the heart).
    const colW = isMobile ? 40 : 18;
    const numCols = Math.ceil(W / colW) + 4;
    const maxTrail = isMobile ? 8 : 14;

    for (let i = 0; i < numCols; i++) {
      const trailLen = 6 + Math.floor(Math.random() * maxTrail);
      const chars = [];
      for (let j = 0; j < trailLen; j++) {
        chars.push(RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)]);
      }
      rainCols.push({
        x: i * colW + Math.random() * 6,
        y: -Math.random() * H * 1.5,
        speed: 1.0 + Math.random() * 3.2,
        charSize: 11 + Math.random() * 5,
        hue: 320 + Math.random() * 40,
        trailLen,
        chars,
      });
    }
  }

  function updateDrawRain() {
    for (let c = 0; c < rainCols.length; c++) {
      const col = rainCols[c];
      col.y += col.speed;

      if (col.y - col.trailLen * col.charSize > H) {
        col.y = -col.trailLen * col.charSize - Math.random() * 300;
        col.speed = 1.0 + Math.random() * 3.2;
      }

      if (Math.random() < 0.04) {
        const idx = Math.floor(Math.random() * col.trailLen);
        col.chars[idx] = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
      }

      ctx.font = `${col.charSize}px monospace`;
      for (let j = 0; j < col.trailLen; j++) {
        const cy = col.y - j * col.charSize;
        if (cy < -col.charSize || cy > H + col.charSize) continue;

        const fade = j === 0 ? 0.9 : Math.max(0.02, (1 - j / col.trailLen) * 0.5);
        const light = j === 0 ? 80 : Math.max(28, 65 - j * 3);

        ctx.fillStyle = `hsla(${col.hue}, 100%, ${light}%, ${fade})`;
        ctx.fillText(col.chars[j], col.x, cy);
      }
    }
  }

  // ═══════════ AMBIENT GLOW & FLASH ═══════════
  function drawAmbientGlow(now) {
    const pulse = Math.sin(now * 0.0008) * 0.15 + 0.85;
    const r = Math.min(W, H) * 0.5 * pulse;
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
    g.addColorStop(0, 'rgba(80, 20, 60, 0.06)');
    g.addColorStop(0.6, 'rgba(40, 8, 35, 0.03)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  let flashAlpha = 0;
  function triggerFlash() { flashAlpha = 0.3; }

  function drawFlash() {
    if (flashAlpha <= 0) return;
    ctx.fillStyle = `rgba(255, 180, 220, ${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
    flashAlpha *= 0.88;
    if (flashAlpha < 0.005) flashAlpha = 0;
  }

  // ═══════════ SEQUENCE CONTROLLER ═══════════
  let seqIdx = 0;
  let seqStart = 0;
  let started = false;
  let clickedOpen = false;
  let lastHeartbeatCycle = -1;
  let typingInterval = null;

  function startSequence(now) {
    seqIdx = 0;
    seqStart = now;
    started = true;

    // Reset overlays
    heartMsg.classList.remove('visible', 'beating');
    letterContainer.classList.remove('visible');
    btnRestart.classList.remove('show');

    lastHeartbeatCycle = -1;
    if (typingInterval) clearInterval(typingInterval);

    triggerStep(0);
  }

  function triggerStep(idx) {
    const step = SEQ[idx];
    if (!step) return;

    // Feature 10: Dynamic Page Title
    if (step.title) {
      document.title = step.title;
    }

    // Feature 7: Dynamic color target setup
    if (idx < 3) {
      // Countdown: Cyan / Blueish-white
      tCoreR = 190; tCoreG = 240; tCoreB = 255;
      tGlowR = 100; tGlowG = 190; tGlowB = 255;
    } else if (step.text && idx >= 3 && idx <= 7) {
      // Text words: Warm golden glow
      tCoreR = 255; tCoreG = 220; tCoreB = 120;
      tGlowR = 255; tGlowG = 150; tGlowB = 40;
    } else {
      // Heart & finale: Pink / Magenta romantic colors
      tCoreR = 255; tCoreG = 110; tCoreB = 180;
      tGlowR = 255; tGlowG = 30; tGlowB = 130;
    }

    // Play SFX (Feature 1)
    if (step.text || step.type === 'fireworks') {
      playWhooshSFX();
    }

    // Step type behaviors
    if (step.type === 'heart') {
      triggerFlash();
      const pts = generateHeartPoints();
      assignTargets(pts);
      setTimeout(() => heartMsg.classList.add('visible', 'beating'), 700);

      // Will be triggered automatically by the render loop
      lastHeartbeatCycle = -1;
    } else if (step.type === 'fireworks') {
      heartMsg.classList.remove('visible', 'beating');
      scatterParticles();
      spawnFireworks();
    } else if (step.type === 'letter') {
      heartMsg.classList.remove('visible', 'beating');
      scatterSlowly();

      // Feature 6: Typing animation trigger
      letterContainer.classList.add('visible');
      setTimeout(() => {
        startTyping(LETTER_CONTENT, 'letterText', () => {
          btnRestart.classList.add('show');
        });
      }, 600);
    } else if (step.text) {
      triggerFlash();
      heartMsg.classList.remove('visible', 'beating');
      const pts = sampleText(step.text, step.fs);
      assignTargets(pts);
    }

    // Skip hint visibility logic (Feature 3)
    if (step.text && idx < 8) {
      skipHint.classList.add('visible');
    } else {
      skipHint.classList.remove('visible');
    }
  }

  function updateSequence(now) {
    if (!started) return;

    const step = SEQ[seqIdx];
    if (!step) return;

    const elapsed = now - seqStart;
    if (elapsed >= step.dur) {
      seqIdx++;
      seqStart = now;
      if (seqIdx >= SEQ.length) return; // Stop at last step (letter) - no automatic loop!
      triggerStep(seqIdx);
    }
  }

  // Feature 3: Tap to Skip
  function skipCurrentStep() {
    if (!started) return;
    const step = SEQ[seqIdx];
    if (!step || step.type === 'letter') return; // Can't skip letter phase

    seqIdx++;
    if (seqIdx >= SEQ.length) return;
    seqStart = performance.now();
    triggerStep(seqIdx);
  }

  // ═══════════ TYPING ANIMATION (Feature 6) ═══════════
  function startTyping(text, elementId, onComplete) {
    const el = document.getElementById(elementId);
    el.textContent = '';
    let idx = 0;

    if (typingInterval) clearInterval(typingInterval);

    typingInterval = setInterval(() => {
      if (idx < text.length) {
        el.textContent += text.charAt(idx);
        idx++;
      } else {
        clearInterval(typingInterval);
        if (onComplete) onComplete();
      }
    }, 55);
  }

  // ═══════════ MAIN RENDER LOOP ═══════════
  let introStart = null;
  const INTRO_DUR = 1500;

  function render(now) {
    requestAnimationFrame(render);

    if (!clickedOpen) {
      // Prior to opening: draw static background rain & glow
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      drawAmbientGlow(now);
      updateDrawRain();
      return;
    }

    if (introStart === null) introStart = now;
    const introElapsed = now - introStart;

    // Intro glow animation
    if (introElapsed < INTRO_DUR) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      const progress = introElapsed / INTRO_DUR;
      const alpha = 1 - progress;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const radius = Math.min(W, H) * 0.45 * easeOut;

      const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.15, `rgba(255, 255, 255, ${alpha * 0.8})`);
      grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Motion blur trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
    ctx.fillRect(0, 0, W, H);

    // Dynamic color interpolation updates (Feature 7)
    coreR += (tCoreR - coreR) * 0.06;
    coreG += (tCoreG - coreG) * 0.06;
    coreB += (tCoreB - coreB) * 0.06;
    glowR += (tGlowR - glowR) * 0.06;
    glowG += (tGlowG - glowG) * 0.06;
    glowB += (tGlowB - glowB) * 0.06;

    drawAmbientGlow(now);
    updateDrawRain();
    updateSequence(now);
    updateDrawSparkles();
    updateDrawFireworks();
    updateParticles(now);

    const step = SEQ[seqIdx];
    const isHeart = step && step.type === 'heart';
    drawParticles(isHeart, now);

    // Heartbeat SOUND sync only. The visual "beat" of the DOM message is driven
    // by a CSS animation (.beating class) instead of a per-frame JS transform —
    // re-transforming a blurred, multi-shadow text node every frame was a major
    // mobile performance cost.
    if (isHeart) {
      const cycleIdx = Math.floor((now - seqStart) / 1200);
      if (cycleIdx > lastHeartbeatCycle) {
        playHeartbeatSFX();
        lastHeartbeatCycle = cycleIdx;
      }
    } else {
      lastHeartbeatCycle = -1;
    }

    drawFlash();
  }

  // ═══════════ RESIZE ═══════════
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    initRain();
    initParticles();
    if (started) triggerStep(seqIdx);
  }

  // ═══════════ BIND EVENTS ═══════════
  window.addEventListener('resize', resize);

  // Anti-flicker fade-in on load (Fix 3)
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });
  // Fallback in case load fires before script parses
  if (document.readyState === 'complete') {
    document.body.classList.add('loaded');
  }

  // Landing button click (Feature 2)
  btnOpen.addEventListener('click', () => {
    clickedOpen = true;
    initAudioContext();
    bgMusic.play().catch(err => {
      console.warn("Background music autoplay was blocked/failed:", err);
    });
    landingScreen.classList.add('hide');
    // Delay sequence start until intro pulse animation finishes
    setTimeout(() => {
      startSequence(performance.now());
    }, INTRO_DUR);
  });

  // Restart button click
  btnRestart.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid triggering tap-to-skip
    startSequence(performance.now());
  });

  // Tap to skip event listener on canvas (Feature 3)
  canvas.addEventListener('click', skipCurrentStep);

  // Kickstart canvas sizes
  resize();
  requestAnimationFrame(render);
})();