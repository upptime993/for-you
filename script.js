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
  const btnContinue = document.getElementById('btnContinue');
  const skipHint = document.getElementById('skipHint');
  const faceOverlay = document.getElementById('faceOverlay');

  let W, H, dpr;

  // ═══════════ CONFIGURATION ═══════════
  const RAIN_CHARS = '♥♡❥✦❀✿•°♥♡❤';

  // Feature 4: Adaptive Particle Count
  // (mobile bumped a little so the photo sketch is dense enough to recognise;
  //  still cheap thanks to the heart-phase draw optimisations)
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const PARTICLE_N = isMobile ? 650 : 1600;

  const SPRING = 0.09;
  const FRICTION = 0.80;

  // Feature 6: Personal Letter Text
  const LETTER_CONTENT = "makasih yah cantikk\nkamu udah mau sama aku dan nerima segala kekurangan ku,\n\naku gak bisa janjiin apa apa untuk sekarang cuma aku bakal berusaha buat bikin kamu selalu bahagia dan terus nyaman sama aku\n\n♥";

  // Tone palettes for the particle color interpolation (Feature 7).
  // cr/cg/cb = core color, gr/gg/gb = glow color.
  const TONES = {
    cool:     { cr: 190, cg: 240, cb: 255, gr: 100, gg: 190, gb: 255 }, // countdown
    rose:     { cr: 255, cg: 170, cb: 205, gr: 255, gg: 80,  gb: 150 }, // intimate messages
    gold:     { cr: 255, cg: 220, cb: 120, gr: 255, gg: 150, gb: 40  }, // "favorite girls"
    romantic: { cr: 255, cg: 110, cb: 180, gr: 255, gg: 30,  gb: 130 }, // heart & finale
    sketch:   { cr: 235, cg: 230, cb: 245, gr: 190, gg: 160, gb: 210 }, // photo sketch (soft silver)
  };

  // Updated Sequence (excluding Fitur 8 & non-looping at the end)
  //  - 'music: true'  → start the background song when this step shows
  //  - 'manual: true' → do NOT auto-advance; wait for the "Lanjut" button
  const SEQ = [
    { text: '3', dur: 1400, fs: 0.35, title: '3...', tone: 'cool' },
    { text: '2', dur: 1400, fs: 0.35, title: '2...', tone: 'cool' },
    { text: '1', dur: 2400, fs: 0.35, title: '1...', tone: 'cool' },
    { text: 'nungguin yah...', dur: 2000, fs: 0.17, title: '♥', tone: 'rose', music: true },
    { text: 'sebenernya...', dur: 1800, fs: 0.18, title: '♥', tone: 'rose' },
    { text: 'aku mau bilang...', dur: 2000, fs: 0.15, title: '♥', tone: 'rose' },
    { text: 'You', dur: 1100, fs: 0.24, title: '♥ You', tone: 'gold' },
    { text: 'Are', dur: 1100, fs: 0.24, title: '♥ Are', tone: 'gold' },
    { text: 'My', dur: 1100, fs: 0.24, title: '♥ My', tone: 'gold' },
    { text: 'Favorite', dur: 1200, fs: 0.22, title: '♥ Favorite', tone: 'gold' },
    { text: 'Girls', dur: 1500, fs: 0.24, title: '♥ Girls', tone: 'gold' },
    { text: null, dur: 6000, type: 'face', title: '♥', tone: 'sketch' },
    { text: null, dur: 9999999, type: 'heart', manual: true, title: 'I Love You ♥', tone: 'romantic' },
    { text: null, dur: 3000, type: 'fireworks', title: '♥ For You ♥', tone: 'romantic' },
    { text: null, dur: 9999999, type: 'letter', title: 'Surat Untukmu ♥', tone: 'romantic' },
  ];

  // ═══════════ AUDIO SYSTEM (Feature 1) ═══════════
  let audioCtx = null;
  const bgMusic = new Audio('music.mp3');
  bgMusic.loop = true;
  bgMusic.addEventListener('error', (e) => {
    console.warn("Background music ('music.mp3') could not be loaded.", e);
  });

  // Music volume levels: normal vs ducked (so the heartbeat SFX dominates).
  const MUSIC_BASE = 0.6;
  const MUSIC_DUCK = 0.14;

  function initAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Start the song from the top at normal volume (called at the first message).
  function startMusic() {
    try { bgMusic.currentTime = 0; } catch (e) { /* ignore */ }
    bgMusic.volume = MUSIC_BASE;
    bgMusic.play().catch(err => {
      console.warn("Background music could not start:", err);
    });
  }

  // Smoothly ramp the music volume (used to duck under the heartbeat and back).
  let musicFadeTimer = null;
  function fadeMusicTo(target, ms) {
    if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
    const startVol = bgMusic.volume;
    const steps = Math.max(1, Math.round(ms / 50));
    let s = 0;
    musicFadeTimer = setInterval(() => {
      s++;
      const v = startVol + (target - startVol) * (s / steps);
      bgMusic.volume = Math.min(1, Math.max(0, v));
      if (s >= steps) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
    }, 50);
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
      gain1.gain.linearRampToValueAtTime(0.9, time + 0.02);
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
      filter.frequency.setValueAtTime(180, time);

      // Boosted so the thump is clearly audible on small phone speakers
      // (which can't reproduce the deep sub-bass oscillator above).
      gain2.gain.setValueAtTime(0, time);
      gain2.gain.linearRampToValueAtTime(0.34, time + 0.02);
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

  // Whoosh transition sound synthesizer. `peak` controls loudness so the
  // countdown can use a louder whoosh than the regular text transitions.
  function playWhooshSFX(peak = 0.15) {
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
    gain.gain.linearRampToValueAtTime(peak, audioCtx.currentTime + 0.15);
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

  // ═══════════ PHOTO → PARTICLE SKETCH ═══════════
  // Her photo is turned into a particle "sketch": edge detection traces the
  // outline + facial features, very dark pixels fill in the hair, and a centred
  // elliptical mask drops the busy background.
  const faceImg = new Image();
  let faceReady = false;
  faceImg.onload = () => { faceReady = true; };
  faceImg.onerror = () => { console.warn("Face image ('muka.jpeg') could not be loaded."); };
  faceImg.src = 'muka.jpeg';

  function sampleImageSketch() {
    if (!faceReady) return [];
    const iw = faceImg.naturalWidth, ih = faceImg.naturalHeight;
    if (!iw || !ih) return [];

    oCtx.clearRect(0, 0, S, S);
    // Fit the photo inside the S×S sampling box ("contain"), centred.
    const fit = Math.min(S / iw, S / ih) * 0.96;
    const dw = iw * fit, dh = ih * fit;
    const imgLeft = (S - dw) / 2;
    const imgTop  = (S - dh) / 2;

    let data;
    try {
      oCtx.drawImage(faceImg, imgLeft, imgTop, dw, dh);
      data = oCtx.getImageData(0, 0, S, S).data;
    } catch (e) {
      // e.g. a tainted canvas when opened via file:// — fail soft.
      console.warn('Could not read photo pixels (serve over http to enable):', e);
      return [];
    }

    // ── Pre-compute a full luminance map for fast neighbour lookups ──
    const lumMap = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const o = i * 4;
      // Transparent pixels (outside drawn image) → treat as white
      lumMap[i] = data[o + 3] > 10
        ? 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
        : 255;
    }

    const pts = [];
    // Finer grid so facial features aren't lost between samples
    const gap = isMobile ? 3 : 2;
    const screenScale = Math.min(W, H) / S;
    const halfS = S / 2, halfW = W / 2, halfH = H / 2;

    // ── Elliptical mask centred on the *drawn image*, not the canvas ──
    // This properly excludes the tiled background behind her.
    const mcx = imgLeft + dw / 2;
    const mcy = imgTop + dh / 2;
    const mrx = dw * 0.46;
    const mry = dh * 0.50;

    for (let y = 1; y < S - 1; y += gap) {
      for (let x = 1; x < S - 1; x += gap) {
        // Elliptical mask — everything outside is background, skip it
        const enx = (x - mcx) / mrx;
        const eny = (y - mcy) / mry;
        if (enx * enx + eny * eny > 1) continue;

        const c = lumMap[y * S + x];

        // ── KEY FIX: Sobel edge detection with 1px offset ──
        // (Old code used `gap` as offset which was 4-5 pixels apart,
        //  making it impossible to detect fine facial features.)
        const gx = lumMap[y * S + (x + 1)] - lumMap[y * S + (x - 1)];
        const gy = lumMap[(y + 1) * S + x] - lumMap[(y - 1) * S + x];
        const edgeMag = Math.sqrt(gx * gx + gy * gy);

        // ── Multi-criteria sampling for a natural pencil-sketch look ──
        // Darkness: 0 (white) → 1 (black)
        const darkness = 1 - c / 255;
        // Normalised edge strength: 0 → 1
        const edgeScore = Math.min(edgeMag / 45, 1.0);

        let keep = false;

        // 1. Strong edges → always keep (face outline, eyes, nose, lips)
        if (edgeScore > 0.45) keep = true;

        // 2. Very dark areas → always keep (hair, eyebrows, pupils)
        if (c < 60) keep = true;

        // 3. Dark mid-tones → probabilistic (eye areas, shadows, lips)
        if (c < 100 && Math.random() < darkness * 0.65) keep = true;

        // 4. Medium edges on medium tones → keep (nose bridge, jawline)
        if (edgeScore > 0.25 && c < 150) keep = true;

        // 5. Subtle shading on lighter areas → sparse dots for depth
        if (c < 160 && darkness > 0.3 && Math.random() < darkness * 0.3) keep = true;

        if (keep) {
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
    const isFace = step && step.type === 'face';

    if (isFace) {
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < PARTICLE_N; i++) {
        const dx = px[i] - cx;
        const dy = py[i] - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Reset particle if it goes offscreen, fades out, or randomly to create continuous stream
        if (pal[i] <= 0.05 || dist > Math.max(W, H) * 0.55 || Math.random() < 0.008) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 90; // start near center portrait
          px[i] = cx + Math.cos(angle) * r;
          py[i] = cy + Math.sin(angle) * r;
          
          // Velocity radiating outwards + slight float upwards
          const speed = 0.8 + Math.random() * 2.8;
          pvx[i] = Math.cos(angle) * speed;
          pvy[i] = Math.sin(angle) * speed - 0.3;
          
          pal[i] = 0.4 + Math.random() * 0.6; // random opacity/life
          psz[i] = Math.random() * 1.5 + 0.6;
        } else {
          // Move
          px[i] += pvx[i];
          py[i] += pvy[i];
          // Friction/drift
          pvx[i] *= 0.99;
          pvy[i] *= 0.99;
          // Fade out
          pal[i] -= 0.003;
        }
      }
      return;
    }

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
        const r = psz[i] * 4 * pal[i];
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
      const r = psz[i] * coreScale * pal[i];
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
        const r = psz[i] * 0.35 * pal[i];
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
  let continueTimer = null;

  function startSequence(now) {
    seqIdx = 0;
    seqStart = now;
    started = true;

    // Reset overlays
    heartMsg.classList.remove('visible', 'beating');
    letterContainer.classList.remove('visible');
    faceOverlay.classList.remove('visible');
    btnRestart.classList.remove('show');
    btnContinue.classList.remove('show');

    // Silence the music again until the first message re-triggers it.
    bgMusic.pause();

    lastHeartbeatCycle = -1;
    if (typingInterval) clearInterval(typingInterval);
    if (continueTimer) { clearTimeout(continueTimer); continueTimer = null; }

    triggerStep(0);
  }

  function triggerStep(idx) {
    const step = SEQ[idx];
    if (!step) return;

    // Feature 10: Dynamic Page Title
    if (step.title) {
      document.title = step.title;
    }

    // Hide the manual "Lanjut" button on every step; the heart step re-shows it.
    if (continueTimer) { clearTimeout(continueTimer); continueTimer = null; }
    btnContinue.classList.remove('show');

    // Feature 7: Dynamic color target setup (per-step tone)
    const tone = TONES[step.tone] || TONES.romantic;
    tCoreR = tone.cr; tCoreG = tone.cg; tCoreB = tone.cb;
    tGlowR = tone.gr; tGlowG = tone.gg; tGlowB = tone.gb;

    // Mod 1: Start the background music exactly when its message appears.
    if (step.music) startMusic();

    // Play SFX (Feature 1) — louder whoosh for the 3-2-1 countdown.
    if (step.tone === 'cool') {
      playWhooshSFX(0.42);
    } else if (step.text || step.type === 'fireworks') {
      playWhooshSFX();
    }

    // Step type behaviors
    if (step.type === 'heart') {
      triggerFlash();
      faceOverlay.classList.remove('visible');
      const pts = generateHeartPoints();
      assignTargets(pts);
      setTimeout(() => heartMsg.classList.add('visible', 'beating'), 700);

      // Will be triggered automatically by the render loop
      lastHeartbeatCycle = -1;

      // Mod 2: duck the music so the heartbeat clearly dominates.
      fadeMusicTo(MUSIC_DUCK, 700);

      // Mod 3: this step does NOT auto-advance — reveal the "Lanjut" button
      // after the animation settles (~3s) so the user continues manually.
      continueTimer = setTimeout(() => btnContinue.classList.add('show'), 3000);
    } else if (step.type === 'fireworks') {
      heartMsg.classList.remove('visible', 'beating');
      faceOverlay.classList.remove('visible');
      fadeMusicTo(MUSIC_BASE, 800); // restore music after the heart phase
      scatterParticles();
      spawnFireworks();
    } else if (step.type === 'letter') {
      heartMsg.classList.remove('visible', 'beating');
      faceOverlay.classList.remove('visible');
      scatterSlowly();

      // Feature 6: Typing animation trigger
      letterContainer.classList.add('visible');
      setTimeout(() => {
        startTyping(LETTER_CONTENT, 'letterText', () => {
          btnRestart.classList.add('show');
        });
      }, 600);
    } else if (step.type === 'face') {
      triggerFlash();
      heartMsg.classList.remove('visible', 'beating');
      // Show the face image overlay with CSS glow & sparkle effects
      faceOverlay.classList.add('visible');
      // Scatter particles as ambient floating background behind the portrait
      scatterSlowly();
    } else if (step.text) {
      triggerFlash();
      heartMsg.classList.remove('visible', 'beating');
      faceOverlay.classList.remove('visible');
      const pts = sampleText(step.text, step.fs);
      assignTargets(pts);
    }

    // Skip hint visibility logic (Feature 3) — show for any on-screen text step.
    if (step.text) {
      skipHint.classList.add('visible');
    } else {
      skipHint.classList.remove('visible');
    }
  }

  function updateSequence(now) {
    if (!started) return;

    const step = SEQ[seqIdx];
    if (!step) return;

    // Manual steps (the heart) never auto-advance — they wait for the button.
    if (step.manual) return;

    const elapsed = now - seqStart;
    if (elapsed >= step.dur) {
      seqIdx++;
      seqStart = now;
      if (seqIdx >= SEQ.length) return; // Stop at last step (letter) - no automatic loop!
      triggerStep(seqIdx);
    }
  }

  // Advance to the next step (shared by tap-to-skip and the Lanjut button).
  function advanceStep() {
    if (!started) return;
    if (seqIdx >= SEQ.length - 1) return;
    seqIdx++;
    seqStart = performance.now();
    triggerStep(seqIdx);
  }

  // Feature 3: Tap to Skip
  function skipCurrentStep() {
    if (!started) return;
    const step = SEQ[seqIdx];
    // Letter is the end, and manual steps (heart) only advance via the button.
    if (!step || step.type === 'letter' || step.manual) return;
    advanceStep();
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
    // Unlock audio inside this user gesture (play+pause silently) so the song
    // can be started LATER, at the "nungguin yah..." message, without the
    // browser blocking it as autoplay.
    bgMusic.volume = 0;
    bgMusic.play().then(() => {
      bgMusic.pause();
      try { bgMusic.currentTime = 0; } catch (e) { /* ignore */ }
    }).catch(err => {
      console.warn("Audio unlock failed:", err);
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

  // Mod 3: Manual "Lanjut" button — advance from the heart phase to the finale.
  btnContinue.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid triggering tap-to-skip on the canvas underneath
    btnContinue.classList.remove('show');
    advanceStep();
  });

  // Tap to skip event listener on canvas (Feature 3)
  canvas.addEventListener('click', skipCurrentStep);

  // ═══════════ PROCESS FACE IMAGE BACKGROUND REMOVAL ═══════════
  const facePortrait = document.getElementById('facePortrait');
  if (facePortrait) {
    const faceImg = new Image();
    faceImg.src = 'muka.png';
    faceImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = faceImg.naturalWidth;
      canvas.height = faceImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(faceImg, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;
      
      const visited = new Uint8Array(w * h);
      const queue = [];
      const threshold = 230; // Brightness threshold for background pixels
      
      function enqueue(x, y) {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        
        const r = data[idx * 4];
        const g = data[idx * 4 + 1];
        const b = data[idx * 4 + 2];
        
        // If color is close to white, it is a background pixel
        if (r > threshold && g > threshold && b > threshold) {
          visited[idx] = 1;
          queue.push(idx);
        }
      }
      
      // Seed from borders
      for (let x = 0; x < w; x++) {
        enqueue(x, 0);
        enqueue(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        enqueue(0, y);
        enqueue(w - 1, y);
      }
      
      // Flood fill BFS
      let head = 0;
      while (head < queue.length) {
        const idx = queue[head++];
        const x = idx % w;
        const y = Math.floor(idx / w);
        
        // Set background pixel transparency to 0
        data[idx * 4 + 3] = 0;
        
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
      }
      
      // Secondary pass: Fade out near margins to be absolutely sure no edge artifacts exist
      const cx = w / 2;
      const cy = h / 2;
      const maxDist = Math.min(w, h) * 0.44;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > maxDist) {
            const factor = Math.min(1, (dist - maxDist) / (Math.min(w, h) * 0.1));
            const brightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            if (brightness > 200) {
              data[idx + 3] = Math.min(data[idx + 3], Math.round(data[idx + 3] * (1 - factor)));
            }
          }
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      facePortrait.src = canvas.toDataURL();
    };
  }

  // Kickstart canvas sizes
  resize();
  requestAnimationFrame(render);
})();