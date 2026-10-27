/* =========================================================
   Squish — a translucent 3D desktop stress ball (Three.js)

   A real WebGL sphere with a physically-based translucent
   material you can:
     • click / tap   -> bounce + squish + sparkles
     • click fast     -> pump "energy" so it ricochets harder
     • press + drag   -> spin it 360° AND squish it, then fling
   Motion speed, colour, transparency, smile, sound and the
   ball/fruit/veggie skin are all adjustable in Settings and
   remembered between launches. Runs as a desktop app or from
   the file in any browser.
   ========================================================= */

(() => {
  "use strict";

  const hint = document.getElementById("hint");
  if (!window.THREE) {
    hint.classList.remove("gone");
    hint.innerHTML = "This needs WebGL / Three.js to run.";
    return;
  }
  const THREE = window.THREE;
  const UI_FONT = "Fredoka, ui-rounded, sans-serif";

  /* ----------------------------- Skins ----------------------------- */
  const BALL_COLORS = [
    "#8C9EFF", "#B79CFF", "#7FD1FF", "#6FE3C7", "#FFE27A", "#FFB27A",
    "#FF9EC4", "#FF8A8A", "#A0E86B", "#9AD0FF", "#FFC98A", "#C9CDD6",
  ];
  const FRUITS  = ["🍎", "🍊", "🍋", "🍓", "🍇", "🍑", "🥝", "🫐", "🍒", "🍍", "🍉", "🍌"];
  const F_TINTS = ["#E8614D", "#FF9F43", "#FFE066", "#FF5B7A", "#9B6DD6", "#FFB199",
                   "#9DCF5F", "#6A7BD6", "#E23B5A", "#F2C94C", "#FF7A8A", "#FFE066"];
  const VEGGIES = ["🥦", "🥕", "🥑", "🌽", "🍅", "🍆", "🥒", "🫑", "🧅", "🥔", "🍄", "🌶️"];
  const V_TINTS = ["#6BBF59", "#FF9F43", "#A9C46C", "#FFD24C", "#FF5B4D", "#8B5CF6",
                   "#7CC47C", "#4CAF50", "#E6C9A8", "#D2A679", "#E07A5F", "#FF4D4D"];

  /* --------------------------- Settings --------------------------- */
  const DEFAULTS = {
    type: "ball", color: "#8C9EFF", fruitIndex: 0, veggieIndex: 0,
    transparency: 55, motion: 55, size: 100, face: true, sound: true, alwaysOnTop: false,
    theme: "dark",
  };
  let settings = load();
  function load() {
    try {
      const raw = localStorage.getItem("squish-settings");
      return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() {
    try { localStorage.setItem("squish-settings", JSON.stringify(settings)); } catch (e) {}
  }

  /* --------------------------- Elements --------------------------- */
  const canvas  = document.getElementById("scene");
  const stage   = document.getElementById("stage");
  const counter = document.getElementById("counter");
  const gearBtn = document.getElementById("gearBtn");
  const closeBtn = document.getElementById("closeBtn");
  const panel   = document.getElementById("panel");
  const scrim   = document.getElementById("scrim");
  const typeSeg = document.getElementById("typeSeg");
  const themeSeg = document.getElementById("themeSeg");
  const picker  = document.getElementById("picker");
  const pickerLabel = document.getElementById("pickerLabel");
  const customRow = document.getElementById("customRow");
  const customColor = document.getElementById("customColor");
  const transp  = document.getElementById("transp");
  const sizeR   = document.getElementById("sizeR");
  const motionR = document.getElementById("motion");
  const faceTgl = document.getElementById("faceTgl");
  const soundTgl = document.getElementById("soundTgl");
  const aotTgl  = document.getElementById("aotTgl");
  const aotNote = document.getElementById("aotNote");
  const calmBtn = document.getElementById("calmBtn");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isElectron = !!(window.squish && window.squish.isElectron);

  /* ------------------------- Three.js scene ----------------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);          // transparent, so only the ball shows
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const FOV = 42, CAM_Z = 5;
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xaebbff, 0.8);
  rim.position.set(4, -2, 2);
  scene.add(rim);

  // Environment (soft gradient) so the glassy material has something to reflect/refract
  (function buildEnv() {
    const c = document.createElement("canvas");
    c.width = 16; c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, "#8a7bff");
    grad.addColorStop(0.5, "#2a2150");
    grad.addColorStop(1.0, "#0c0a1b");
    g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose(); pmrem.dispose();
  })();

  // Face / emoji texture painted on a 2D canvas, wrapped on the sphere
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 1024; texCanvas.height = 512;
  const tctx = texCanvas.getContext("2d");
  const faceTex = new THREE.CanvasTexture(texCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function currentTint() {
    if (settings.type === "fruit")  return F_TINTS[settings.fruitIndex]  || "#ff8a8a";
    if (settings.type === "veggie") return V_TINTS[settings.veggieIndex] || "#6bbf59";
    return settings.color;
  }
  function currentEmoji() {
    if (settings.type === "fruit")  return FRUITS[settings.fruitIndex]   || FRUITS[0];
    if (settings.type === "veggie") return VEGGIES[settings.veggieIndex] || VEGGIES[0];
    return null;
  }
  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Our smiley (or a dozing face), centred at (cx,cy). `s` scales the whole face.
  function drawFace(ctx, cx, cy, s, sleep) {
    const ink = "rgba(38,38,50,0.95)";
    const ex = 150 * s, ew = 56 * s, eh = 78 * s;
    const eyeY = cy - 10 * s;
    const my = cy + 120 * s, mr = 170 * s;
    ctx.strokeStyle = ink; ctx.lineCap = "round";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (sleep) {
      ctx.lineWidth = 26 * s;
      ctx.beginPath(); ctx.arc(cx - ex, eyeY, ew, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + ex, eyeY, ew, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, my, mr * 0.5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = "600 " + Math.round(92 * s) + "px " + UI_FONT;
      ctx.globalAlpha = 0.9; ctx.fillText("z", cx + ex + 110 * s, eyeY - 130 * s);
      ctx.globalAlpha = 0.6; ctx.fillText("z", cx + ex + 190 * s, eyeY - 220 * s);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = ink;
      ellipse(ctx, cx - ex, eyeY, ew, eh);
      ellipse(ctx, cx + ex, eyeY, ew, eh);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ellipse(ctx, cx - ex - ew * 0.3, eyeY - eh * 0.35, ew * 0.3, eh * 0.28);
      ellipse(ctx, cx + ex - ew * 0.3, eyeY - eh * 0.35, ew * 0.3, eh * 0.28);
      ctx.strokeStyle = ink; ctx.lineWidth = 30 * s;
      ctx.beginPath(); ctx.arc(cx, my, mr, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  // Ball look: a coloured sphere skin with the face on the front.
  function drawSphere() {
    const w = 1024, h = 512, cx = w / 2, cy = h / 2;
    tctx.clearRect(0, 0, w, h);
    tctx.fillStyle = settings.color;
    tctx.fillRect(0, 0, w, h);
    if (settings.face) drawFace(tctx, cx, cy, 0.68, sleeping);
    faceTex.needsUpdate = true;
  }

  // Fruit / veggie look: the actual emoji shape (transparent around it) + a smiley.
  function drawSprite() {
    const S = 1024, cx = S / 2;
    sctx.clearRect(0, 0, S, S);
    const emo = currentEmoji() || "🍎";
    sctx.textAlign = "center"; sctx.textBaseline = "middle";
    sctx.font = "880px serif";
    sctx.fillText(emo, cx, 480);
    if (settings.face) drawFace(sctx, cx, 650, 1.0, sleeping);
    spriteTex.needsUpdate = true;
  }

  function drawTexture() {
    if (settings.type === "ball") drawSphere(); else drawSprite();
  }

  // --- The ball: a glassy translucent 3D sphere ---
  const geometry = new THREE.SphereGeometry(1, 72, 48);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: faceTex,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    transmission: 0.5,
    thickness: 1.3,
    ior: 1.3,
    envMapIntensity: 1.1,
    transparent: true,
    opacity: 0.8,
  });
  const ball = new THREE.Mesh(geometry, material);
  scene.add(ball);

  // --- Fruit / veggie: a flat billboard of the emoji shape that squishes ---
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = 1024; spriteCanvas.height = 1024;
  const sctx = spriteCanvas.getContext("2d");
  const spriteTex = new THREE.CanvasTexture(spriteCanvas);
  spriteTex.colorSpace = THREE.SRGBColorSpace;
  spriteTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const spriteMat = new THREE.MeshBasicMaterial({ map: spriteTex, transparent: true, depthWrite: false });
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), spriteMat);
  sprite.visible = false;
  scene.add(sprite);

  function applyAppearance() {
    const v = settings.transparency / 100;
    material.transmission = v * 0.9;
    material.opacity = 1 - v * 0.6;      // 1 (solid) .. 0.4 (ghostly)
    material.roughness = 0.1 + (1 - v) * 0.14;
    spriteMat.opacity = 1 - v * 0.5;     // fruit fades too, but stays readable
    const isBall = settings.type === "ball";
    ball.visible = isBall;
    sprite.visible = !isBall;
    document.documentElement.style.setProperty("--accent", settings.color);
    drawTexture();
  }

  /* ------------------------- Physics state ------------------------ */
  // World extents at the ball's depth (recomputed on resize)
  let halfH = 1, halfW = 1;
  function computeExtents() {
    halfH = Math.tan((FOV * Math.PI / 180) / 2) * CAM_Z;
    halfW = halfH * camera.aspect;
  }
  computeExtents();

  const BALL_MAX = 0.74;            // largest radius in world units (the "100%" size)
  const BALL_MIN = BALL_MAX / 3;    // smallest is one third of that
  function rad() { return BALL_MIN + (BALL_MAX - BALL_MIN) * (settings.size / 100); }
  const pos = { x: 0, y: 0 };       // world position
  const vel = { x: 0, y: 0 };       // world units / s
  let energy = 0, squishes = 0;

  // Idle → rest behaviour
  const REST_MS = 3 * 60 * 1000;    // curl up to rest after 3 minutes of no play
  let lastActive = performance.now();
  let resting = false, sleeping = false;
  let wanderT = 2;                  // seconds until the next gentle wander nudge

  // Squash spring (0 = round, positive = flattened vertically)
  let squash = 0, vsquash = 0;
  const SQ_K = 190, SQ_D = 11;

  // Spin
  const angVel = { x: 0, y: 0 };

  // Pointer / drag
  let pressing = false, grabbed = false, moved = false, ptrId = null;
  const pStart = { x: 0, y: 0 }, pLast = { x: 0, y: 0 };
  let pLastT = 0;
  const dragVel = { x: 0, y: 0 };   // px/s

  function motionScale() { return 0.06 + (settings.motion / 100) * 1.4; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------------------------- Audio ----------------------------- */
  let actx = null;
  function pop(level) {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine";
      const f = 200 + level * 300 + Math.random() * 50;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.13);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.17);
    } catch (e) {}
  }

  /* ------------------------ Screen helpers ------------------------ */
  function worldToScreen(x, y) {
    return {
      x: (x / halfW) * (innerWidth / 2) + innerWidth / 2,
      y: (-y / halfH) * (innerHeight / 2) + innerHeight / 2,
    };
  }
  function ballScreenRadius() {
    const meanScale = (scaleX() + scaleY()) / 2;
    return (rad() * meanScale / halfH) * (innerHeight / 2);
  }
  function scaleY() { return 1 - squash; }
  function scaleX() { return 1 + squash * 0.55; }

  /* --------------------------- Actions ---------------------------- */
  function capSpeed() {
    const max = (1.2 + energy * 7) * motionScale();
    const s = Math.hypot(vel.x, vel.y);
    if (s > max) { vel.x *= max / s; vel.y *= max / s; }
  }
  function bounce(bump, dx, dy) {
    wake();
    energy = Math.min(1, energy + bump);
    const power = (1.0 + energy * 5) * motionScale();
    const a = (dx === undefined) ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
    vel.x += Math.cos(a) * power;
    vel.y += Math.sin(a) * power;
    capSpeed();
    squash = 0.34;                        // squash pulse -> spring jiggle
    // a little tumble on each hit
    angVel.x += (Math.random() - 0.5) * 2 * motionScale();
    angVel.y += (Math.random() - 0.5) * 2 * motionScale();
    squishes++; updateHud(); pop(energy);
  }
  function spark(x, y) {
    if (reduceMotion) return;
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "spark";
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      el.style.background = `hsl(${40 + Math.random() * 20} 100% ${70 + Math.random() * 20}%)`;
      el.style.transform = `translate(${x}px, ${y}px)`;
      stage.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transition = "transform .5s ease-out, opacity .5s ease-out";
        el.style.transform = `translate(${x + Math.cos(ang) * dist}px, ${y + Math.sin(ang) * dist}px) scale(0)`;
        el.style.opacity = "0";
      });
      setTimeout(() => el.remove(), 560);
    }
  }
  function sparkAtBall() { const s = worldToScreen(pos.x, pos.y); spark(s.x, s.y); }

  function updateHud() {
    if (counter) counter.textContent = squishes + (squishes === 1 ? " squish" : " squishes");
  }
  function hideHint() { hint.classList.add("gone"); }

  function wake() {
    lastActive = performance.now();
    if (resting || sleeping) { resting = false; sleeping = false; drawTexture(); }
  }
  function enterRest() {
    resting = true; energy = 0;
    if (settings.face && !sleeping) { sleeping = true; drawTexture(); }
  }

  /* ---------------------- Pointer interaction --------------------- */
  function inside(px, py) {
    const s = worldToScreen(pos.x, pos.y);
    return Math.hypot(px - s.x, py - s.y) <= ballScreenRadius() * 1.12;
  }

  stage.addEventListener("pointerdown", (e) => {
    if (actx) actx.resume();
    hideHint();
    wake();
    const x = e.clientX, y = e.clientY;
    if (inside(x, y)) {
      pressing = true; grabbed = true; moved = false; ptrId = e.pointerId;
      pStart.x = x; pStart.y = y; pLast.x = x; pLast.y = y; pLastT = performance.now();
      dragVel.x = 0; dragVel.y = 0;
      squash = Math.max(squash, 0.16);     // a little squeeze the moment you grab it
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("grabbing");
    } else {
      bounce(0.12, pos.x - (x - innerWidth / 2) / (innerWidth / 2) * halfW,
                   pos.y + (y - innerHeight / 2) / (innerHeight / 2) * halfH);
      spark(x, y);
    }
  });

  stage.addEventListener("pointermove", (e) => {
    if (!pressing) return;
    const x = e.clientX, y = e.clientY;
    const now = performance.now();
    const dt = Math.max(0.001, (now - pLastT) / 1000);
    const ddx = x - pLast.x, ddy = y - pLast.y;
    if (!moved && Math.hypot(x - pStart.x, y - pStart.y) > 6) moved = true;

    if (moved) {
      // Spin the ball by the drag (horizontal -> around Y, vertical -> around X).
      // Fruit is a flat shape, so it squishes but doesn't tumble.
      if (settings.type === "ball") {
        ball.rotation.y += ddx * 0.011;
        ball.rotation.x += ddy * 0.011;
        angVel.y = ddx * 0.011 / dt * 0.35;   // momentum for release
        angVel.x = ddy * 0.011 / dt * 0.35;
      }
      // Squish hard from the drag speed — the "grab and mash" feel
      const sp = Math.hypot(ddx, ddy) / dt;         // px/s
      const target = Math.min(0.55, 0.16 + sp * 0.00045);
      squash += (target - squash) * 0.6;
    }
    dragVel.x = dragVel.x * 0.6 + (ddx / dt) * 0.4;
    dragVel.y = dragVel.y * 0.6 + (ddy / dt) * 0.4;
    pLast.x = x; pLast.y = y; pLastT = now;
  });

  function endPress() {
    if (!pressing) return;
    stage.classList.remove("grabbing");
    try { stage.releasePointerCapture(ptrId); } catch (e) {}
    if (moved) {
      // fling: convert px/s drag to world units/s
      const wpp = (2 * halfW) / innerWidth;
      vel.x += dragVel.x * wpp * 0.9 * motionScale();
      vel.y += -dragVel.y * (2 * halfH) / innerHeight * 0.9 * motionScale();
      energy = Math.min(1, energy + 0.08);
      capSpeed();
      squishes++; updateHud(); pop(energy);
    } else {
      bounce(0.16); sparkAtBall();
    }
    pressing = false; grabbed = false; moved = false;
    updateIgnore();
  }
  stage.addEventListener("pointerup", endPress);
  stage.addEventListener("pointercancel", endPress);

  addEventListener("keydown", (e) => {
    if (e.code === "Space" && panel.hidden) {
      e.preventDefault();
      if (actx) actx.resume();
      hideHint(); bounce(0.16); sparkAtBall();
    }
    if (e.code === "Escape" && !panel.hidden) closePanel();
  });

  /* --------------------------- Settings UI ------------------------ */
  function buildPicker() {
    picker.innerHTML = "";
    if (settings.type === "ball") {
      pickerLabel.textContent = "Colour";
      customRow.classList.remove("hidden");
      BALL_COLORS.forEach((hex) => {
        const b = document.createElement("button");
        b.className = "sw" + (hex.toLowerCase() === settings.color.toLowerCase() ? " active" : "");
        b.style.setProperty("--c", hex);
        b.title = hex;
        b.addEventListener("click", () => {
          settings.color = hex; customColor.value = hex;
          save(); applyAppearance(); markActive(hex);
        });
        picker.appendChild(b);
      });
      customColor.value = /^#([0-9a-f]{6})$/i.test(settings.color) ? settings.color : "#8c9eff";
    } else {
      pickerLabel.textContent = settings.type === "fruit" ? "Fruit" : "Vegetable";
      customRow.classList.add("hidden");
      const list = settings.type === "fruit" ? FRUITS : VEGGIES;
      const active = settings.type === "fruit" ? settings.fruitIndex : settings.veggieIndex;
      list.forEach((emo, i) => {
        const b = document.createElement("button");
        b.className = "sw" + (i === active ? " active" : "");
        b.style.setProperty("--c", "transparent");
        b.textContent = emo;
        b.addEventListener("click", () => {
          if (settings.type === "fruit") settings.fruitIndex = i; else settings.veggieIndex = i;
          save(); applyAppearance();
          [...picker.children].forEach((c, idx) => c.classList.toggle("active", idx === i));
        });
        picker.appendChild(b);
      });
    }
  }
  function markActive(hex) {
    [...picker.children].forEach((c) =>
      c.classList.toggle("active", (c.style.getPropertyValue("--c") || "").trim().toLowerCase() === hex.toLowerCase()));
  }
  function applyTheme() { document.body.setAttribute("data-theme", settings.theme); }

  function syncControls() {
    [...typeSeg.children].forEach((b) => b.classList.toggle("active", b.dataset.type === settings.type));
    [...themeSeg.children].forEach((b) => b.classList.toggle("active", b.dataset.theme === settings.theme));
    transp.value = settings.transparency;
    sizeR.value = settings.size;
    motionR.value = settings.motion;
    faceTgl.checked = settings.face;
    soundTgl.checked = settings.sound;
    aotTgl.checked = settings.alwaysOnTop;
    buildPicker();
  }
  function openPanel()  { scrim.hidden = false; panel.hidden = false; if (isElectron) setIgnore(false); }
  function closePanel() { scrim.hidden = true;  panel.hidden = true;  updateIgnore(); }

  gearBtn.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);
  scrim.addEventListener("click", closePanel);
  typeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-type]"); if (!btn) return;
    settings.type = btn.dataset.type; save(); syncControls(); applyAppearance();
  });
  themeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-theme]"); if (!btn) return;
    settings.theme = btn.dataset.theme; save(); applyTheme();
    [...themeSeg.children].forEach((b) => b.classList.toggle("active", b.dataset.theme === settings.theme));
  });
  customColor.addEventListener("input", () => {
    settings.color = customColor.value; save(); applyAppearance(); markActive(customColor.value);
  });
  transp.addEventListener("input", () => { settings.transparency = +transp.value; save(); applyAppearance(); });
  sizeR.addEventListener("input", () => { settings.size = +sizeR.value; save(); });
  motionR.addEventListener("input", () => { settings.motion = +motionR.value; save(); });
  faceTgl.addEventListener("change", () => { settings.face = faceTgl.checked; save(); drawTexture(); });
  soundTgl.addEventListener("change", () => { settings.sound = soundTgl.checked; save(); });
  aotTgl.addEventListener("change", () => {
    settings.alwaysOnTop = aotTgl.checked; save();
    if (isElectron) window.squish.setAlwaysOnTop(aotTgl.checked);
  });
  calmBtn.addEventListener("click", () => { energy = 0; vel.x = 0; vel.y = 0; angVel.x = 0; angVel.y = 0; });

  /* ---------------- Click-through (desktop-pet mode) --------------- */
  // The overlay window ignores clicks everywhere except where the pointer is
  // actually on the ball (or the gear / open Settings), so the desktop stays
  // usable. We flip that as the pointer moves.
  let ignoring = true, mx = innerWidth / 2, my = innerHeight / 2;
  function overInteractive(x, y) {
    if (!panel.hidden) return true;                 // Settings open: capture all
    const r = gearBtn.getBoundingClientRect();
    if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return true;
    return inside(x, y);                            // on the ball
  }
  function setIgnore(v) {
    if (v === ignoring) return;
    ignoring = v;
    if (isElectron && window.squish.setIgnore) window.squish.setIgnore(v);
  }
  function updateIgnore() {
    if (!isElectron) return;
    if (pressing) { setIgnore(false); return; }
    setIgnore(!overInteractive(mx, my));
    document.body.classList.toggle("show-gear", my < 90 && mx > innerWidth - 120);
  }
  addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; updateIgnore(); });

  /* ----------------------- Tray / menu commands ------------------- */
  if (isElectron && window.squish.onCommand) {
    window.squish.onCommand((name) => {
      if (name === "settings") { wake(); openPanel(); }
      else if (name === "reset") { pos.x = 0; pos.y = 0; vel.x = 0; vel.y = 0; angVel.x = 0; angVel.y = 0; wake(); }
      else if (name === "rest") { enterRest(); }
      else if (name === "wake") { wake(); }
    });
  }

  /* --------------------------- Resize ----------------------------- */
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    computeExtents();
  });

  /* ------------------------- The main loop ------------------------ */
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.033) dt = 0.033;

    const ms = motionScale();
    energy = Math.max(0, energy - dt * 0.3);

    // Curl up and rest after a few minutes of no play.
    if (!resting && (now - lastActive) > REST_MS) enterRest();

    if (!grabbed) {
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      const limX = halfW - rad() * scaleX();
      const limY = halfH - rad() * scaleY();
      if (pos.x < -limX) { pos.x = -limX; vel.x = -vel.x * 0.8; squash = Math.min(0.45, Math.abs(vel.x) * 0.1); pop(energy * 0.8); }
      else if (pos.x > limX) { pos.x = limX; vel.x = -vel.x * 0.8; squash = Math.min(0.45, Math.abs(vel.x) * 0.1); pop(energy * 0.8); }
      if (pos.y < -limY) { pos.y = -limY; vel.y = -vel.y * 0.8; squash = Math.min(0.45, Math.abs(vel.y) * 0.1); pop(energy * 0.8); }
      else if (pos.y > limY) { pos.y = limY; vel.y = -vel.y * 0.8; squash = Math.min(0.45, Math.abs(vel.y) * 0.1); pop(energy * 0.8); }
      const drag = Math.exp(-0.85 * dt);
      vel.x *= drag; vel.y *= drag;
      const speed = Math.hypot(vel.x, vel.y);

      if (resting) {
        // Settle near the bottom of the screen, just above the Dock.
        const ty = -(halfH - rad() * scaleY()) * 0.96;
        vel.x += (0 - pos.x) * 3.2 * dt;
        vel.y += (ty - pos.y) * 4.0 * dt;
        vel.x *= 0.84; vel.y *= 0.84;
      } else if (energy < 0.08 && speed < 1.0) {
        // Awake but idle: gently wander around the screen.
        wanderT -= dt;
        if (wanderT <= 0) {
          vel.x += (Math.random() - 0.5) * 0.9 * ms;
          vel.y += (Math.random() - 0.5) * 0.6 * ms;
          wanderT = 1.4 + Math.random() * 2.2;
        }
        // Soft push back from the very edges so it doesn't get stuck.
        const mX = halfW * 0.82, mY = halfH * 0.82;
        if (pos.x > mX)  vel.x -= (pos.x - mX) * 2 * dt;
        if (pos.x < -mX) vel.x -= (pos.x + mX) * 2 * dt;
        if (pos.y > mY)  vel.y -= (pos.y - mY) * 2 * dt;
        if (pos.y < -mY) vel.y -= (pos.y + mY) * 2 * dt;
        vel.x *= 0.98; vel.y *= 0.98;
      }
    }

    const isBall = settings.type === "ball";
    const obj = isBall ? ball : sprite;

    // Spin: idle drift + momentum, damped toward a gentle idle (ball only).
    const idleSpin = (reduceMotion || resting || !isBall) ? 0 : 0.12 * Math.min(1, ms);
    angVel.y += (idleSpin - angVel.y) * (grabbed ? 0 : 1.5 * dt);
    angVel.x += (0 - angVel.x) * (grabbed ? 0 : 1.5 * dt);
    if (isBall && !grabbed) {
      ball.rotation.y += angVel.y * dt * 6;
      ball.rotation.x += angVel.x * dt * 6;
    }

    // Squash spring toward round (0) — but HOLD the squish while you're gripping it,
    // so it stays deformed under your finger and springs back only on release.
    if (!grabbed) {
      vsquash += (-SQ_K * squash - SQ_D * vsquash) * dt;
      squash += vsquash * dt;
    } else {
      vsquash = 0;
    }
    if (squash < -0.5) squash = -0.5;
    if (squash > 0.6) squash = 0.6;

    // Idle breathing
    let breath = 1;
    if (!reduceMotion && energy < 0.04 && Math.hypot(vel.x, vel.y) < 0.2) {
      breath = 1 + 0.02 * Math.sin(now / 620);
    }

    obj.position.set(pos.x, pos.y, 0);
    obj.scale.set(scaleX() * rad() * breath, scaleY() * rad() * breath, ((scaleX() + 1) / 2) * rad() * breath);
    if (!isBall) {
      // Fruit wobbles a little in the direction it's moving.
      const tilt = clamp(vel.x * 0.05, -0.32, 0.32);
      sprite.rotation.set(0, 0, -tilt);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  /* ----------------------------- Boot ----------------------------- */
  if (isElectron) {
    document.body.classList.add("pet");           // transparent floating overlay
  } else {
    document.body.classList.add("has-bg");         // nice backdrop when opened as a file
    aotNote.textContent = "(works in the desktop app)";
  }
  applyTheme();
  syncControls();
  applyAppearance();
  updateHud();
  if (isElectron && settings.alwaysOnTop) window.squish.setAlwaysOnTop(true);
  requestAnimationFrame(frame);
})();
