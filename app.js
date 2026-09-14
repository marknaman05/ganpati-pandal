'use strict';
(function () {
  const C = window.PANDAL_CONFIG || {};
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');
  // Lite mode for low-end phones: no shadows/antialias, fewer lights, procedural props instead
  // of heavy models, fewer petals. Auto-detected; force with ?lite or ?hd in the URL.
  const qs = new URLSearchParams(location.search);
  const LITE = qs.has('lite') || (!qs.has('hd') && (isTouch || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4));

  // =================================================================
  //  Layout (matches the sketch: pandal at the back, entry on the
  //  right with checkerboard tiles, red carpet leading to the pandal)
  // =================================================================
  const HALL  = { w: 16, d: 22, h: 6.5 };            // x, z, y
  const HX = HALL.w / 2, HZ = HALL.d / 2;
  const DOOR  = { z: 5, width: 3.0, height: 2.9 }; // on the right wall (x = +HX)
  const PORCH = { x0: HX, x1: HX + 9, z0: DOOR.z - 4.5, z1: DOOR.z + 4.5 };
  const STAGE = { x: 0, z: -HZ + 3.5, w: 8, d: 4, h: 0.7 };
  const EYE = 1.65;

  // =================================================================
  //  Renderer / scene
  // =================================================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0610);
  scene.fog = new THREE.Fog(0x0b0610, 40, 90);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: !LITE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !LITE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  document.getElementById('app').appendChild(renderer.domElement);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // =================================================================
  //  Helpers
  // =================================================================
  const DEV_FONT = '"Noto Sans Devanagari","Kohinoor Devanagari","Devanagari MT","Mangal",sans-serif';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o));
  const interactables = [];

  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = shadow; o.receiveShadow = shadow;
    scene.add(o);
    return o;
  }
  function box(w, h, d, m, x, y, z, shadow) { return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, shadow); }
  function limb(a, b, r, m) {
    const A = V3(...a), B = V3(...b), d = new THREE.Vector3().subVectors(B, A), len = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 12), m);
    o.position.copy(A).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    o.castShadow = true;
    return o;
  }
  function interactable(obj, action, label) {
    obj.traverse(o => { o.userData.action = action; o.userData.label = label; });
    interactables.push(obj);
  }

  // =================================================================
  //  Textures (all procedural – no image files needed)
  // =================================================================
  const T = {};
  T.carpet = canvasTex(256, 256, (ctx, w, h) => {              // maroon ikat-style hall carpet
    ctx.fillStyle = '#7a1e1e'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9741f'; ctx.lineWidth = 6;
    for (let i = -h; i < w + h; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke();
    }
    ctx.fillStyle = '#e0b04a';
    for (let x = 32; x < w; x += 64) for (let y = 32; y < h; y += 64) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
  }, [10, 14]);
  T.redCarpet = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b3121b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }, [2, 8]);
  T.checker = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, 64, 64); ctx.fillRect(64, 64, 64, 64);
  }, [10, 12]);
  T.wall = canvasTex(512, 512, (ctx, w, h) => {                  // off-white marble-ish wall
    ctx.fillStyle = '#ebe5d8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,110,100,.07)'; ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
  }, [4, 2]);
  T.drape = canvasTex(256, 256, (ctx, w, h) => {                 // pleated pink cloth
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#f6a9c9'); g.addColorStop(0.5, '#ec7fae'); g.addColorStop(1, '#f6a9c9');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
    }
  }, [6, 1]);
  T.peach = canvasTex(256, 256, (ctx, w, h) => {                 // pleated peach cloth (back wall)
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#f7cdb4'); g.addColorStop(0.5, '#eaa98a'); g.addColorStop(1, '#f7cdb4');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
    }
  }, [12, 1]);
  T.satin = canvasTex(256, 256, (ctx, w, h) => {                 // magenta satin stage skirt
    for (let x = 0; x < w; x += 32) {
      const g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, '#8e0f57'); g.addColorStop(0.5, '#e23a9a'); g.addColorStop(1, '#8e0f57');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 32, h);
    }
  }, [8, 1]);
  T.lattice = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#163a1f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6db36a'; ctx.lineWidth = 5;
    for (let i = -h; i < w + h; i += 48) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke();
    }
  }, [2, 1.4]);
  function drawLogo(ctx, x, y, size, img) {
    // yellow card: red "पूं" monogram, "पूर्वांचल" above, "महाराष्ट्र मंडळ" below, then स्थापना वर्ष 1984
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff5b0'; ctx.fillRect(0, 0, size, size * 1.3);
    if (img) {
      const c = (C.images && C.images.logoCrop) || [0, 0, 1, 1];   // fractions [x, y, w, h] of the image to use
      ctx.drawImage(img, c[0] * img.width, c[1] * img.height, c[2] * img.width, c[3] * img.height, 0, 0, size, size * 4 / 3);
      ctx.restore(); return;
    }
    // fallback: hand-drawn version of the mandal logo (yellow card, black border, red monogram)
    ctx.strokeStyle = '#111'; ctx.lineWidth = size * 0.025; ctx.strokeRect(size * 0.05, size * 0.04, size * 0.9, size * 0.92);
    ctx.lineWidth = size * 0.01; ctx.strokeRect(size * 0.09, size * 0.08, size * 0.82, size * 0.84);
    ctx.fillStyle = '#d0121c'; ctx.textAlign = 'center';
    ctx.font = `bold ${size * 0.11}px ${DEV_FONT}`; ctx.fillText('पूर्वांचल', size / 2, size * 0.24);
    ctx.save(); ctx.translate(size / 2, size * 0.66); ctx.transform(1, 0, -0.12, 1, 0, 0);
    ctx.font = `bold ${size * 0.48}px ${DEV_FONT}`; ctx.lineWidth = size * 0.02; ctx.strokeStyle = '#d0121c';
    ctx.strokeText('पूं', 0, 0); ctx.fillText('पूं', 0, 0); ctx.restore();
    ctx.font = `bold ${size * 0.11}px ${DEV_FONT}`; ctx.fillText('महाराष्ट्र मंडळ', size / 2, size * 0.88);
    ctx.fillStyle = '#1a2a80';
    ctx.font = `bold ${size * 0.13}px ${DEV_FONT}`; ctx.fillText('स्थापना वर्ष', size / 2, size * 1.1);
    ctx.font = `bold ${size * 0.16}px system-ui, sans-serif`; ctx.fillText(String(C.establishedYear || ''), size / 2, size * 1.26);
    ctx.restore();
    return;
    ctx.strokeStyle = '#111'; ctx.lineWidth = size * 0.02; ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
    ctx.fillStyle = '#d0121c'; ctx.textAlign = 'center';
    ctx.font = `bold ${size * 0.1}px ${DEV_FONT}`; ctx.fillText('पूर्वांचल', size / 2, size * 0.2);
    ctx.font = `bold ${size * 0.5}px ${DEV_FONT}`; ctx.fillText('पूं', size / 2, size * 0.66);
    ctx.font = `bold ${size * 0.1}px ${DEV_FONT}`; ctx.fillText('महाराष्ट्र मंडळ', size / 2, size * 0.86);
    ctx.fillStyle = '#1a2a80';
    ctx.font = `bold ${size * 0.13}px ${DEV_FONT}`; ctx.fillText('स्थापना वर्ष', size / 2, size * 1.1);
    ctx.font = `bold ${size * 0.16}px system-ui, sans-serif`; ctx.fillText(String(C.establishedYear || ''), size / 2, size * 1.26);
    ctx.restore();
  }
  function drawBanner(ctx, w, h, logoImg) {
    ctx.fillStyle = '#fff6d2'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8141c'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, w - 28, h - 28);
    drawLogo(ctx, 60, 70, 300, logoImg);
    const cx = 1200;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8141c'; ctx.font = `bold 118px ${DEV_FONT}`; ctx.fillText(C.mandalName || '', cx, 150);
    ctx.font = `bold 128px ${DEV_FONT}`; ctx.fillText(C.eventTitle || '', cx, 285);
    ctx.fillRect(470, 315, 1460, 74);
    ctx.fillStyle = '#fff'; ctx.font = `bold 44px ${DEV_FONT}`; ctx.fillText(C.eventDates || '', cx, 368);
    ctx.fillStyle = '#1a2a80'; ctx.font = `bold 60px ${DEV_FONT}`; ctx.fillText(C.venue || '', cx, 465);
  }
  T.banner = canvasTex(2048, 512, (ctx, w, h) => drawBanner(ctx, w, h, null));
  // optional: real logo image (config.images.logo) – redraws the banner once it loads
  if (C.images && C.images.logo) {
    const im = new Image();
    im.onload = () => { drawBanner(T.banner.image.getContext('2d'), 2048, 512, im); T.banner.needsUpdate = true; };
    im.src = C.images.logo + '?v=' + (C.version || 1);
  }
  T.poster = canvasTex(768, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, w, h);
    // soft watercolour border with flowers
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9fd3f2'); g.addColorStop(0.5, '#f7b7d2'); g.addColorStop(1, '#b8e0a8');
    ctx.strokeStyle = g; ctx.lineWidth = 28; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = '#7bc5a0'; ctx.lineWidth = 3; ctx.strokeRect(46, 46, w - 92, h - 92);
    const flower = (x, y, c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 12, 8, a, 0, 6.283); ctx.fill(); } ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.283); ctx.fill(); };
    flower(70, 90, '#f26d8f'); flower(w - 70, h - 90, '#f26d8f'); flower(70, h - 90, '#ff9fbf'); flower(w - 70, 90, '#ff9fbf');
    // Ganesha silhouette (top right)
    ctx.fillStyle = '#f2a445'; ctx.beginPath(); ctx.arc(600, 200, 60, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(600, 320, 78, 70, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e8892b'; ctx.beginPath(); ctx.ellipse(548, 205, 22, 34, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(652, 205, 22, 34, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#e8892b'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(600, 230); ctx.quadraticCurveTo(600, 290, 640, 300); ctx.stroke();
    ctx.fillStyle = '#d7263d'; ctx.beginPath(); ctx.moveTo(600, 118); ctx.lineTo(630, 150); ctx.lineTo(570, 150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c2185b'; ctx.beginPath(); ctx.ellipse(600, 390, 90, 36, 0, 0, 6.283); ctx.fill();
    // text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7a1e1e'; ctx.font = `bold 30px ${DEV_FONT}`; ctx.fillText('॥ श्री गणेशाय नमः ॥', 330, 110);
    ctx.fillStyle = '#c8141c'; ctx.font = `bold 104px ${DEV_FONT}`; ctx.fillText('गणेशोत्सव', 330, 230);
    ctx.fillStyle = '#1e6fb5'; ctx.font = `bold 92px ${DEV_FONT}`; ctx.fillText('सूचना', 330, 340);
    ctx.fillStyle = '#2e7d32'; ctx.font = `bold 34px ${DEV_FONT}`; ctx.fillText('· सर्व भक्तांना विनंती ·', 384, 430);
    const lines = [
      ['🏠', '#2e7d32', 'मंडपात शांती व स्वच्छता राखा.', 'हाच खरा बाप्पाचा मान.'],
      ['🚫', '#c62828', 'मंडपात प्रवेश करताना', 'कृपया चप्पल बाहेर काढा.'],
      ['🔇', '#c62828', 'ध्वनीप्रदूषण टाळा.', 'मधुर संगीताचा आनंद घ्या.'],
      ['🍃', '#2e7d32', 'पर्यावरणाची काळजी घ्या.', 'प्लास्टिकचा वापर टाळा.'],
      ['🗑️', '#6a1b9a', 'कृपया कचरा योग्य ठिकाणी टाका.', 'स्वच्छता हीच सेवा.'],
      ['🙏', '#ef6c00', 'शिस्त, संयम आणि सहकार्य ठेवा.', 'मिळून गणेशोत्सव यशस्वी बनवूया.'],
    ];
    ctx.textAlign = 'left';
    lines.forEach(([ic, col, l1, l2], i) => {
      const y = 500 + i * 76;
      ctx.font = '38px system-ui, sans-serif'; ctx.fillText(ic, 70, y + 12);
      ctx.fillStyle = col; ctx.font = `bold 30px ${DEV_FONT}`; ctx.fillText((i + 1) + '.', 130, y);
      ctx.fillStyle = '#222'; ctx.font = `bold 28px ${DEV_FONT}`; ctx.fillText(l1, 170, y);
      ctx.font = `26px ${DEV_FONT}`; ctx.fillText(l2, 170, y + 34);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c8141c'; ctx.font = `bold 34px ${DEV_FONT}`; ctx.fillText('आपले सहकार्य हीच आमची शक्ती!!', w / 2, 975);
    ctx.fillStyle = '#7a1e1e'; ctx.font = `bold 26px ${DEV_FONT}`; ctx.fillText('गणपती बाप्पा मोरया ! मंगलमूर्ती मोरया !!', w / 2, 1008);
  });
  T.welcome = canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ff8c1a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a1e1e'; ctx.textAlign = 'center';
    ctx.font = `bold 120px ${DEV_FONT}`; ctx.fillText('स्वागत', w / 2, 125);
    ctx.font = `bold 60px ${DEV_FONT}`; ctx.fillText(C.eventTitle || 'Ganesh Utsav', w / 2, 215);
  });

  const upiLink = `upi://pay?pa=${encodeURIComponent((C.upi || {}).id || '')}&pn=${encodeURIComponent((C.upi || {}).payeeName || '')}&tn=${encodeURIComponent((C.upi || {}).note || '')}&cu=INR`;
  let qrCanvas = null;
  try {
    const holder = document.getElementById('qr-holder');
    new QRCode(holder, { text: upiLink, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    qrCanvas = holder.querySelector('canvas');
  } catch (e) { console.warn('QR generation failed', e); }
  T.qrBoard = canvasTex(768, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8141c'; ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold 84px ${DEV_FONT}`; ctx.fillText('दान · DONATE', w / 2, 105);
    if (qrCanvas) ctx.drawImage(qrCanvas, 128, 200, 512, 512);
    ctx.fillStyle = '#222'; ctx.font = 'bold 40px system-ui, sans-serif'; ctx.fillText('Scan to pay via UPI / Paytm', w / 2, 790);
    ctx.font = '34px ui-monospace, monospace'; ctx.fillText((C.upi || {}).id || '', w / 2, 850);
    ctx.fillStyle = '#c8141c'; ctx.font = `bold 44px ${DEV_FONT}`; ctx.fillText('गणपती बाप्पा मोरया!', w / 2, 950);
  });

  // =================================================================
  //  Materials
  // =================================================================
  const M = {
    wall: mat(0xffffff, { map: T.wall, roughness: 0.95 }),
    ceiling: mat(0xf4efe6, { roughness: 1 }),
    wood: mat(0x5a3418, { roughness: 0.7 }),
    gold: mat(0xe6b422, { roughness: 0.3, metalness: 0.9 }),
    brass: mat(0xc9a13b, { roughness: 0.4, metalness: 0.8 }),
    silver: mat(0xd8d8d8, { roughness: 0.3, metalness: 0.9 }),
    white: mat(0xf5f3ee, { roughness: 0.9 }),
    whiteCloth: mat(0xe8eef8, { roughness: 1 }),
    pink: mat(0xd6207a, { roughness: 0.7 }),
    drape: mat(0xffffff, { map: T.drape, roughness: 0.9, side: THREE.DoubleSide }),
    peach: mat(0xffffff, { map: T.peach, roughness: 0.9, side: THREE.DoubleSide }),
    satin: mat(0xffffff, { map: T.satin, roughness: 0.35, metalness: 0.15 }),
    green: mat(0x2f8f3c, { roughness: 0.9 }),
    darkGreen: mat(0x1f5a2a, { roughness: 0.9 }),
    terracotta: mat(0xb9552c, { roughness: 0.9 }),
    black: mat(0x111111, { roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.35 }),
    skin: mat(0xe9829f, { roughness: 0.55 }),
    skinDark: mat(0xc95f82, { roughness: 0.6 }),
    shawl: mat(0xc41a24, { roughness: 0.5 }),
    dhoti: mat(0xb8136e, { roughness: 0.3, metalness: 0.25 }),
    redSatin: mat(0xc0121c, { roughness: 0.3, metalness: 0.2 }),
    marigold: mat(0xff9a1f, { roughness: 0.9 }),
    flameEm: new THREE.MeshBasicMaterial({ color: 0xffb340 }),
    tube: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blueLamp: new THREE.MeshBasicMaterial({ color: 0x4f7bff }),
  };

  // -----------------------------------------------------------------
  //  Real 3D models (Sketchfab glTF) – see config.models + download-models.mjs.
  //  Each model is fetched once and cloned per placement; if the file is
  //  missing the procedural fallback simply stays in place.
  // -----------------------------------------------------------------
  const modelCache = {};
  // image-based lighting for the loaded models (what Sketchfab's viewer does) – gold, silk and
  // glossy paint need reflections to look right. Applied to model materials only, not the hall.
  let _env = null;
  function envMap() {
    if (_env || !THREE.RoomEnvironment) return _env;
    const pmrem = new THREE.PMREMGenerator(renderer);
    _env = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return _env;
  }
  let _gltf = null;
  function gltfLoader() {   // shared loader with Draco decoding (models are Draco-compressed to keep the site small)
    if (_gltf) return _gltf;
    _gltf = new THREE.GLTFLoader();
    if (THREE.DRACOLoader) { const d = new THREE.DRACOLoader(); d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/'); _gltf.setDRACOLoader(d); }
    return _gltf;
  }
  const credits = new Map();
  function getModel(key) {
    const cfg = (C.models || {})[key];
    if (!cfg || !cfg.path || !THREE.GLTFLoader || (LITE && cfg.lite === false)) return Promise.reject(new Error('not configured'));
    if (!modelCache[key]) modelCache[key] = new Promise((res, rej) => gltfLoader().load(cfg.path + '?v=' + (C.version || 1), g => {
      if (cfg.keep) {   // model packs several variants side by side – keep just one node
        const keep = g.scene.getObjectByName(cfg.keep);
        if (keep) keep.parent.children.slice().forEach(c => { if (c !== keep) c.parent.remove(c); });
      }
      const env = envMap();
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material) { if (o.material.map) o.material.map.encoding = THREE.sRGBEncoding; if (env) { o.material.envMap = env; o.material.envMapIntensity = 1.0; o.material.needsUpdate = true; } } } });
      // measure once; every clone reuses the same normalisation
      const bb = new THREE.Box3().setFromObject(g.scene);
      g.scene.userData.bb = bb;
      if (cfg.credit) { credits.set(key, cfg.credit); renderCredits(); }
      res(g.scene);
    }, undefined, rej));
    return modelCache[key];
  }
  // pos = where the model's base centre should sit; height = target height (m)
  function placeModel(key, pos, height, o = {}) {
    getModel(key).then(src => {
      // rigged (SkinnedMesh) models need SkeletonUtils to clone their skeleton too
      const obj = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(src) : src.clone(true);
      obj.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
      const bb = src.userData.bb, size = bb.getSize(new THREE.Vector3());
      const k = height / (size.y || 1);
      // keep the model's own root transform intact (Sketchfab exports rely on it);
      // do the scale + base-centring on an inner group instead
      const inner = new THREE.Group(), wrap = new THREE.Group();
      inner.add(obj);
      inner.scale.setScalar(k);
      inner.position.set(-(bb.min.x + bb.max.x) / 2 * k, -bb.min.y * k, -(bb.min.z + bb.max.z) / 2 * k);
      wrap.add(inner); wrap.position.copy(pos); wrap.rotation.y = o.rotY || 0;
      scene.add(wrap);
      if (o.fallback) { scene.remove(o.fallback); const i = interactables.indexOf(o.fallback); if (i >= 0) interactables.splice(i, 1); }
      if (o.action) interactable(wrap, o.action, o.label);
      if (o.onLoad) o.onLoad(wrap);
    }).catch(err => { if (err && err.message !== 'not configured' && !modelCache[key + ':warned']) { modelCache[key + ':warned'] = true; console.warn('Model "' + key + '" not found at ' + C.models[key].path + ' – using built-in version. Run: SKETCHFAB_TOKEN=… node download-models.mjs'); } });
  }
  function renderCredits() {
    const el = document.getElementById('credits'); if (!el) return;
    el.hidden = credits.size === 0 || !document.body.classList.contains('show-credits');
    el.innerHTML = '<b>3D models (CC-BY):</b> ' + [...credits.values()].map(c => `<a href="${c.url}" target="_blank" rel="noopener">${c.title}</a> by ${c.author}`).join(' · ');
  }

  // =================================================================
  //  Hall: floor, walls, ceiling, windows, fixtures
  // =================================================================
  {
    const floor = mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), mat(0xffffff, { map: T.carpet, roughness: 1 }), 0, 0, 0);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;

    const ceil = mesh(new THREE.PlaneGeometry(HALL.w, HALL.d), M.ceiling, 0, HALL.h, 0, false);
    ceil.rotation.x = Math.PI / 2;

    const t = 0.4;
    box(HALL.w + t, HALL.h, t, M.wall, 0, HALL.h / 2, -HZ - t / 2);        // back
    box(HALL.w + t, HALL.h, t, M.wall, 0, HALL.h / 2, HZ + t / 2);         // front
    box(t, HALL.h, HALL.d, M.wall, -HX - t / 2, HALL.h / 2, 0);            // left
    // right wall with door opening
    const zA = DOOR.z - DOOR.width / 2, zB = DOOR.z + DOOR.width / 2;
    box(t, HALL.h, zA + HZ, M.wall, HX + t / 2, HALL.h / 2, (-HZ + zA) / 2);
    box(t, HALL.h, HZ - zB, M.wall, HX + t / 2, HALL.h / 2, (zB + HZ) / 2);
    box(t, HALL.h - DOOR.height, DOOR.width, M.wall, HX + t / 2, DOOR.height + (HALL.h - DOOR.height) / 2, DOOR.z);
    // door frame
    box(t + 0.1, DOOR.height, 0.18, M.wood, HX + t / 2, DOOR.height / 2, zA + 0.09);
    box(t + 0.1, DOOR.height, 0.18, M.wood, HX + t / 2, DOOR.height / 2, zB - 0.09);
    box(t + 0.1, 0.18, DOOR.width, M.wood, HX + t / 2, DOOR.height - 0.09, DOOR.z);
    // open wooden doors (folded against the inside wall)
    box(0.06, DOOR.height - 0.2, DOOR.width / 2 - 0.1, M.wood, HX - 0.05, DOOR.height / 2, zA - DOOR.width / 4);
    box(0.06, DOOR.height - 0.2, DOOR.width / 2 - 0.1, M.wood, HX - 0.05, DOOR.height / 2, zB + DOOR.width / 4);

    // windows on both side walls
    const glassM = new THREE.MeshStandardMaterial({ color: 0x3a3f55, emissive: 0x1a2340, roughness: 0.2, metalness: 0.4 });
    for (const side of [-1, 1]) for (const z of [-2, 4]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 2.4), M.wood));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 2.1), glassM); g.add(gl);
      for (let i = -1; i <= 1; i++) { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.06), M.wood)).position.z = i * 0.7; g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.2), M.wood)).position.y = i * 0.7; }
      g.position.set(side * (HX - 0.05), 3.6, z);
      scene.add(g);
    }
    // wall fans, AC units, clock, speakers
    for (const side of [-1, 1]) for (const z of [-5, 1]) {
      const fan = new THREE.Group();
      fan.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16), M.black)).rotation.z = Math.PI / 2;
      const cage = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 8, 24), M.black); cage.rotation.y = Math.PI / 2; fan.add(cage);
      fan.position.set(side * (HX - 0.4), 5.2, z); scene.add(fan);
    }
    box(0.5, 0.8, 2.4, M.white, -HX + 0.3, HALL.h - 0.6, 0);
    box(0.5, 0.8, 2.4, M.white, HX - 0.3, HALL.h - 0.6, 0);
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), M.white); clock.rotation.x = Math.PI / 2; clock.position.set(0, HALL.h - 0.8, HZ - 0.25); scene.add(clock);
    box(0.5, 1.0, 0.4, M.black, -HX + 0.8, 1.3, STAGE.z + 3.5);       // speakers
    box(0.5, 1.0, 0.4, M.black, HX - 0.8, 1.3, STAGE.z + 3.5);

    // ceiling tube lights
    for (let x = -4; x <= 4; x += 4) for (let z = -6; z <= 8; z += 7) {
      mesh(new THREE.BoxGeometry(1.4, 0.06, 0.16), M.tube, x, HALL.h - 0.05, z, false);
    }
  }

  // =================================================================
  //  Floor paths: red carpet (L-shape, entry → centre → pandal)
  //  and the black & white checkerboard porch outside the entry
  // =================================================================
  {
    const rc = mat(0xffffff, { map: T.redCarpet, roughness: 1 });
    const aisle = mesh(new THREE.PlaneGeometry(3, HZ + STAGE.z + STAGE.d / 2 + (DOOR.z + 1.5) - 0), rc, 0, 0.012, 0, false);
    // aisle from stage front to the door row (z = DOOR.z)
    const zFront = STAGE.z + STAGE.d / 2, zBack = DOOR.z + 1.5;
    aisle.geometry = new THREE.PlaneGeometry(2.6, zBack - zFront);
    aisle.position.set(0, 0.012, (zFront + zBack) / 2);
    aisle.rotation.x = -Math.PI / 2; aisle.receiveShadow = true;
    const cross = mesh(new THREE.PlaneGeometry(HX - 1.3, 2.6), rc, (HX + 1.5) / 2, 0.012, DOOR.z, false);
    cross.rotation.x = -Math.PI / 2; cross.receiveShadow = true;

    // porch outside the door
    const porch = mesh(new THREE.PlaneGeometry(PORCH.x1 - PORCH.x0, PORCH.z1 - PORCH.z0), mat(0xffffff, { map: T.checker, roughness: 0.4 }),
      (PORCH.x0 + PORCH.x1) / 2, 0, (PORCH.z0 + PORCH.z1) / 2, false);
    porch.rotation.x = -Math.PI / 2; porch.receiveShadow = true;
    const ground = mesh(new THREE.PlaneGeometry(200, 200), mat(0x0d0a0c, { roughness: 1 }), 0, -0.02, 0, false);
    ground.rotation.x = -Math.PI / 2;
    // porch roof + pillars + welcome arch
    const px = PORCH.x1 - 4.5;
    for (const z of [PORCH.z0 + 1, PORCH.z1 - 1]) box(0.3, 4.2, 0.3, M.white, px, 2.1, z);
    box(px - PORCH.x0 + 0.6, 0.25, PORCH.z1 - PORCH.z0 + 0.4, M.wall, (PORCH.x0 + px + 0.3) / 2, 4.3, DOOR.z);
    const sign = mesh(new THREE.PlaneGeometry(6, 1.5), mat(0xffffff, { map: T.welcome, roughness: 0.8, side: THREE.DoubleSide }), px - 0.2, 2.95, DOOR.z, false);
    sign.rotation.y = Math.PI / 2;
    // notice poster on the outside of the right wall, beside the door (right-hand side when facing the door)
    {
      const posterMat = mat(0xffffff, { map: T.poster, roughness: 0.85 });
      const poster = mesh(new THREE.PlaneGeometry(0.8, 1.07), posterMat, HX + 0.4 + 0.035, 1.75, DOOR.z - DOOR.width / 2 - 0.75, false);
      poster.rotation.y = Math.PI / 2;
      box(0.03, 1.11, 0.84, mat(0xf3efe4, { roughness: 1 }), HX + 0.4 + 0.005, 1.75, DOOR.z - DOOR.width / 2 - 0.75, false);   // paper backing
      if (C.images && C.images.poster) {   // real photo of the poster, if provided
        new THREE.TextureLoader().load(C.images.poster + '?v=' + (C.version || 1), tex => { tex.encoding = THREE.sRGBEncoding; posterMat.map = tex; posterMat.needsUpdate = true; });
      }
    }
    // marigold garland on the arch (string of small spheres)
    const gar = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), M.marigold, 90);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const u = i / 89, z = PORCH.z0 + 1 + u * (PORCH.z1 - PORCH.z0 - 2);
      mtx.makeTranslation(px - 0.2, 4.15 - Math.sin(u * Math.PI) * 0.3, z);
      gar.setMatrixAt(i, mtx);
    }
    scene.add(gar);
    // string lights
    for (let i = 0; i < 12; i++) {
      const s = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd34d : 0xff7ab8 }), px - 0.3, 4.05, PORCH.z0 + 1 + i, false);
      s.userData.blink = i;
    }
    const porchLight = new THREE.PointLight(0xffd7a0, 1.2, 18, 2); porchLight.position.set(PORCH.x0 + 4, 3.8, DOOR.z); scene.add(porchLight);
  }

  // =================================================================
  //  Stage / pandal
  // =================================================================
  const flames = [];
  function diya(x, y, z, s = 1) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.05 * s, 0.06 * s, 12), M.brass));
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.14 * s, 8), M.flameEm); f.position.y = 0.1 * s; g.add(f);
    if (!LITE) { const l = new THREE.PointLight(0xffa640, 0.35, 2.5, 2); l.position.y = 0.15 * s; g.add(l); }
    g.position.set(x, y, z); scene.add(g); flames.push(f);
    return g;
  }
  function samai(x, z, h = 1.6) {   // tall brass oil lamp
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 20), M.brass));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 12), M.brass); stem.position.y = h / 2; g.add(stem);
    for (let i = 1; i <= 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), M.brass); r.rotation.x = Math.PI / 2; r.position.y = h * i / 4; g.add(r); }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.1, 12), M.brass); cup.position.y = h; g.add(cup);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), M.flameEm); f.position.y = h + 0.12; g.add(f); flames.push(f);
    if (!LITE) { const l = new THREE.PointLight(0xffa640, 0.5, 4, 2); l.position.y = h + 0.2; g.add(l); }
    g.position.set(x, 0, z); g.traverse(o => { o.castShadow = true; });
    return g;
  }

  function addFlame(parent, h) {   // flame + warm light on top of a loaded lamp model
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), M.flameEm); f.position.y = h + 0.06; parent.add(f); flames.push(f);
    if (!LITE) { const l = new THREE.PointLight(0xffa640, 0.5, 4, 2); l.position.y = h + 0.15; parent.add(l); }
  }

  {
    const s = STAGE, top = s.h;
    // main platform: satin skirt + white cloth top
    box(s.w, s.h, s.d, M.satin, s.x, s.h / 2, s.z);
    box(s.w + 0.1, 0.05, s.d + 0.1, M.whiteCloth, s.x, s.h + 0.025, s.z);
    // upper platform for the big murti
    box(4.8, 0.9, 2.4, M.whiteCloth, s.x, top + 0.45, s.z - 1.1);

    // ---- back wall drapes (peach pleats full width, pink star drapes) ----
    const backZ = -HZ + 0.03;
    const back = mesh(new THREE.PlaneGeometry(HALL.w, HALL.h), M.peach, 0, HALL.h / 2, backZ, false);
    for (const side of [-1, 1]) {   // side walls near the stage
      const p = mesh(new THREE.PlaneGeometry(8, HALL.h), M.peach, side * (HX - 0.03), HALL.h / 2, -HZ + 4, false);
      p.rotation.y = -side * Math.PI / 2;
    }
    const star = (cx, cy, cz, ry) => {
      const g = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5.2), M.drape);
        strip.rotation.z = i * Math.PI / 8;
        g.add(strip);
      }
      // rosette in the centre
      const cols = [0xffe14d, 0xff4d4d, 0xff8ad6, 0xffffff, 0x8f5bff];
      for (let i = 0; i < 14; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(cols[i % cols.length], { roughness: 1 }));
        f.position.set(Math.cos(i / 14 * Math.PI * 2) * 0.55, Math.sin(i / 14 * Math.PI * 2) * 0.55, 0.15); g.add(f);
      }
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(0xffe14d, { roughness: 1 })); c.position.z = 0.2; g.add(c);
      g.position.set(cx, cy, cz); g.rotation.y = ry; scene.add(g);
    };
    star(-5.7, 4.1, backZ + 0.05, 0);
    star(5.7, 4.1, backZ + 0.05, 0);
    star(-HX + 0.1, 4.1, -HZ + 5.5, Math.PI / 2);
    star(HX - 0.1, 4.1, -HZ + 5.5, -Math.PI / 2);
    // hanging white garland strands on the back wall
    {
      const strand = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), M.white, 4 * 40);
      const m = new THREE.Matrix4(); let k = 0;
      for (const x of [-3.6, -3.1, 3.1, 3.6]) for (let i = 0; i < 32; i++) { m.makeTranslation(x, 5.0 - i * 0.11, backZ + 0.15); strand.setMatrixAt(k++, m); }
      scene.add(strand);
    }

    // ---- flower lattice backdrop: brown crossed sticks with flowers on the diagonals ----
    {
      const W = 5.2, H = 3.2, cx = 0, cy = 2.95, z = backZ + 0.12;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
      // sticks: two diagonal families, clipped to the frame by placing them on a grid
      const stickGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
      const segs = [];
      const step = 0.55;
      for (let ang of [Math.PI / 4, -Math.PI / 4]) for (let k = -12; k <= 12; k++) {
        // line: points p = c + t*dir, c offset along the normal
        const dir = V3(Math.cos(ang), Math.sin(ang), 0), nrm = V3(-Math.sin(ang), Math.cos(ang), 0);
        const c = V3(cx, cy, z).addScaledVector(nrm, k * step);
        // clip to rectangle
        let t0 = -1e9, t1 = 1e9;
        for (const [p0, d, lo, hi] of [[c.x, dir.x, cx - W / 2, cx + W / 2], [c.y, dir.y, cy - H / 2, cy + H / 2]]) {
          const a = (lo - p0) / d, b = (hi - p0) / d; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
        }
        if (t1 - t0 > 0.2) segs.push([c.clone().addScaledVector(dir, (t0 + t1) / 2), t1 - t0, ang]);
      }
      const sticks = new THREE.InstancedMesh(stickGeo, mat(0x4a2c14, { roughness: 0.9 }), segs.length);
      segs.forEach(([p, len, ang], i) => { e.set(0, 0, ang - Math.PI / 2); q.setFromEuler(e); sc.set(1, len, 1); m.compose(p, q, sc); sticks.setMatrixAt(i, m); });
      scene.add(sticks);
      // flowers at the lattice crossings (yellow, red, white, blue) + thick garland border (yellow/red/green)
      const pts = [];
      const cols = [0xffe63b, 0xe8141c, 0xffffff, 0x4f8cff, 0xffe63b, 0xe8141c];
      for (let i = -5; i <= 5; i++) for (let j = -3; j <= 3; j++) {
        const x = cx + i * step, y = cy + j * step;
        if (Math.abs(x - cx) > W / 2 - 0.15 || Math.abs(y - cy) > H / 2 - 0.15) continue;
        if ((i + j) % 2 === 0) pts.push([x, y, z + 0.06, cols[(i * 3 + j * 5 + 100) % cols.length], 0.11]);
      }
      const border = [0xffe63b, 0xffe63b, 0xe8141c, 0xe8141c, 0xffe63b, 0xffe63b, 0x2e9e3a];
      for (let ring = 0; ring < 3; ring++) {
        const w = W + 0.55 - ring * 0.3, h = H + 0.55 - ring * 0.3, per = 0.2;
        let k = 0;
        for (let x = -w / 2; x <= w / 2; x += per, k++) { pts.push([cx + x, cy + h / 2, z + ring * 0.06, border[Math.floor(k / 3) % border.length], 0.13]); pts.push([cx + x, cy - h / 2, z + ring * 0.06, border[Math.floor((k + 4) / 3) % border.length], 0.13]); }
        for (let y = -h / 2 + per; y < h / 2; y += per, k++) { pts.push([cx - w / 2, cy + y, z + ring * 0.06, border[Math.floor(k / 3) % border.length], 0.13]); pts.push([cx + w / 2, cy + y, z + ring * 0.06, border[Math.floor((k + 2) / 3) % border.length], 0.13]); }
      }
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat(0xffffff, { roughness: 1 }), pts.length);
      const col = new THREE.Color(); q.identity();
      pts.forEach((p, k) => { sc.setScalar(p[4] * (0.85 + Math.random() * 0.3)); m.compose(V3(p[0] + (Math.random() - 0.5) * 0.04, p[1] + (Math.random() - 0.5) * 0.04, p[2]), q, sc); inst.setMatrixAt(k, m); inst.setColorAt(k, col.setHex(p[3])); });
      scene.add(inst);
      // white flower strands hanging either side of the lattice
      const strands = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), M.white, 2 * 34);
      let k = 0; for (const x of [cx - W / 2 - 1.1, cx + W / 2 + 1.1]) for (let i = 0; i < 34; i++) { m.makeTranslation(x, cy + H / 2 + 0.3 - i * 0.12, z); strands.setMatrixAt(k++, m); }
      scene.add(strands);
    }

    // ---- banner ----
    mesh(new THREE.PlaneGeometry(6.0, 1.4), mat(0xffffff, { map: T.banner, roughness: 0.8 }), 0, 5.55, backZ + 0.1, false);

    // ---- big murti (procedural, replaced by a real .glb if configured) ----
    const bigPos = V3(s.x, top + 0.9, s.z - 1.1);
    const big = buildGanesha(0.6);
    big.position.copy(bigPos); scene.add(big);
    interactable(big, 'aarti', 'Play / pause Aarti');
    placeModel('bigMurti', V3(s.x, top + 0.9, s.z - 1.1), 2.4, { fallback: big, action: 'aarti', label: 'Play / pause Aarti', rotY: (C.models.bigMurti && C.models.bigMurti.rotY) || 0 });

    // ---- small murti in front on a red satin seat, wrapped in marigold garlands ----
    box(1.4, 0.04, 1.2, M.redSatin, s.x, top + 0.02, s.z + 0.9);
    box(0.9, 0.16, 0.7, M.redSatin, s.x, top + 0.1, s.z + 0.9);
    const small = buildGanesha(0.24);
    small.position.set(s.x, top + 0.18, s.z + 0.9); scene.add(small);
    interactable(small, 'aarti', 'Play / pause Aarti');
    placeModel('smallMurti', V3(s.x, top + 0.18, s.z + 0.9), 0.7, { fallback: small, action: 'aarti', label: 'Play / pause Aarti' });
    {
      const pts = [];
      for (const [r, c, h] of [[0.5, 0xff8c1a, 0.7], [0.38, 0xffc21a, 0.56]]) {
        for (let i = 0; i <= 26; i++) { const a = Math.PI * (i / 26); pts.push([s.x + Math.cos(a) * (r + 0.15), top + 0.2 + Math.sin(a) * (h + 0.15), s.z + 0.5 + (i % 2) * 0.05, c]); }   // arch stands behind the murti
        for (let i = 0; i < 6; i++) { pts.push([s.x - r - 0.15, top + 0.2 - i * 0.02, s.z + 0.55 + i * 0.05, c]); pts.push([s.x + r + 0.15, top + 0.2 - i * 0.02, s.z + 0.55 + i * 0.05, c]); }
      }
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xffffff, { roughness: 1 }), pts.length);
      const m = new THREE.Matrix4(), col = new THREE.Color();
      pts.forEach((p, k) => { m.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(k, m); inst.setColorAt(k, col.setHex(p[3])); });
      scene.add(inst);
      // mango leaves, apples, coconut, shankh, loose marigolds around the base
      const leaf = mat(0x2f7a2a, { roughness: 0.9, side: THREE.DoubleSide });
      for (let i = 0; i < 7; i++) { const l = mesh(new THREE.PlaneGeometry(0.1, 0.26), leaf, s.x - 0.45 + i * 0.15, top + 0.16, s.z + 1.28, false); l.rotation.set(-0.9, 0, (i - 3) * 0.2); }
      mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xb01515), s.x - 0.75, top + 0.1, s.z + 1.3);
      mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xb01515), s.x + 0.75, top + 0.1, s.z + 1.35);
      mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(0x6b3d1e), s.x + 0.55, top + 0.12, s.z + 1.5);
      const shankh = mesh(new THREE.ConeGeometry(0.08, 0.26, 10), M.white, s.x + 0.3, top + 0.08, s.z + 1.45); shankh.rotation.z = Math.PI / 2;
      const loose = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 5), M.marigold, 40);
      for (let i = 0; i < 40; i++) { m.makeTranslation(s.x - 0.8 + Math.random() * 1.6, top + 0.06, s.z + 1.15 + Math.random() * 0.5); loose.setMatrixAt(i, m); }
      scene.add(loose);
    }
    // golden aura light behind the big murti (pulses while aarti plays)
    const aura = new THREE.PointLight(0xffc36b, 0.8, 8, 2); aura.position.set(0, top + 2.6, s.z - 0.8); scene.add(aura);
    window.__aura = aura;
    // blue uplights on the platform (as in the photos)
    if (!LITE) for (const x of [-2.2, 2.2]) { const b = new THREE.PointLight(0x4f7bff, 0.9, 6, 2); b.position.set(x, top + 1.2, s.z - 0.2); scene.add(b); }

    // ---- brass samai lamps: tall pair on the upper platform, short pair in front ----
    for (const x of [-2.5, 2.5]) { const l = samai(x, s.z - 1.2, 1.3); l.position.y = top + 0.9; scene.add(l); placeModel('oilLamp', V3(x, top + 0.9, s.z - 1.2), 1.4, { fallback: l, onLoad: w => addFlame(w, 1.7) }); }
    for (const x of [-1.4, 1.6]) { const l = samai(x, s.z + 0.4, 0.8); l.position.y = top; scene.add(l); placeModel('oilLamp', V3(x, top, s.z + 0.4), 1.0, { fallback: l, onLoad: w => addFlame(w, 1.1) }); }
    // incense burner on the stage front (model only; no procedural fallback)
    placeModel('incenseBurner', V3(-1.0, top, s.z + 1.7), 0.25, { onLoad: w => { if (!LITE) { const sm = new THREE.PointLight(0xffb060, 0.25, 2, 2); sm.position.y = 0.35; w.add(sm); } } });

    // ---- pooja items on the front of the stage ----
    const fz = s.z + 0.85;   // items span fz-0.2 … fz+0.85, all inside the stage edge (s.z + 2)
    // aarti thali: hidden until the aarti plays, then it floats in front of the murti and circles clockwise
    const thaliGroup = new THREE.Group();
    thaliGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.03, 20), M.silver));
    thaliGroup.add(diya(0, 0.02, 0, 0.9));
    for (let i = 0; i < 12; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), i % 2 ? M.marigold : mat(0xe02020)); p.position.set(Math.cos(i / 12 * 6.28) * 0.17, 0.035, Math.sin(i / 12 * 6.28) * 0.17); thaliGroup.add(p); }
    thaliGroup.traverse(o => { o.castShadow = true; });
    scene.add(thaliGroup);
    let aartiThali = thaliGroup;
    aartiThali.visible = false;
    placeModel('pujaThali', V3(0, 0, 0), 0.16, { fallback: thaliGroup, onLoad: w => { aartiThali = w; w.visible = false; const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 8), M.flameEm); f.position.set(0, 0.18, 0); w.add(f); flames.push(f); const l = new THREE.PointLight(0xffa640, 0.35, 2.5, 2); l.position.y = 0.22; w.add(l); } });
    const thaliOrbit = { cx: s.x, cy: top + 0.55, cz: s.z + 0.9 + 0.55, r: 0.42 };   // circles the small murti
    window.__thali = { get obj() { return aartiThali; }, orbit: thaliOrbit };
    diya(0.3, top + 0.04, fz + 0.6, 0.8);
    // fruits
    mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xc81e1e), -1.4, top + 0.1, fz);
    mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xc81e1e), -1.2, top + 0.1, fz + 0.15);
    mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(0x6b3d1e), 1.0, top + 0.12, fz - 0.2);          // coconut
    for (let i = 0; i < 3; i++) { const b = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), mat(0xf5d020), 1.9 + i * 0.08, top + 0.04, fz + 0.1); b.rotation.z = Math.PI / 2; b.rotation.y = i * 0.3; }
    // bowls with kumkum / haldi / rice
    [[-1.9, fz + 0.5, 0xf2f2f2], [-1.7, fz + 0.75, 0xe02020], [-1.4, fz + 0.55, 0xf5c400], [-2.2, fz + 0.8, 0xffffff]].forEach(([x, z, c]) => {
      mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 12), M.white, x, top + 0.03, z);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), mat(c), x, top + 0.065, z, false);
    });
    // laddoo box
    box(0.5, 0.06, 0.34, mat(0xffd54f), 2.1, top + 0.03, fz + 0.5);
    for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(0xf29d2a), 1.9 + (i % 3) * 0.16, top + 0.1, fz + 0.42 + Math.floor(i / 3) * 0.16);
    // modak / sweets boxes
    box(0.5, 0.08, 0.36, mat(0x1e5bc6), 2.7, top + 0.04, fz + 0.1);
    box(0.4, 0.06, 0.3, mat(0xffe08a), -2.6, top + 0.03, fz + 0.2);
    // acrylic donation box on the stage
    {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), M.glass));
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.5), M.wood); base.position.y = -0.25; g.add(base);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.03), M.black); slot.position.y = 0.23; g.add(slot);
      const notes = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), mat(0xe8dcb5)); notes.position.y = -0.16; g.add(notes);
      g.position.set(3.1, top + 0.28, fz + 0.45); scene.add(g);
      interactable(g, 'donate', 'Donate to the Mandal');
    }
    // scattered petals on the cloth
    {
      const pet = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 6), mat(0xff9a1f, { side: THREE.DoubleSide }), 80);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(-Math.PI / 2, 0, 0), sc = V3(1, 1, 1);
      for (let i = 0; i < 80; i++) { e.z = Math.random() * 6; q.setFromEuler(e); m.compose(V3(-3.5 + Math.random() * 7, top + 0.06, s.z + 0.3 + Math.random() * 1.6), q, sc); pet.setMatrixAt(i, m); }
      scene.add(pet);
    }
    // flower pots along the stage edges
    const pot = (x, z, colors, y = top, key) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 14), M.terracotta)).position.y = 0.17;
      colors.forEach((c, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13 + Math.random() * 0.06, 10, 8), mat(c, { roughness: 1 })); b.position.set((Math.random() - 0.5) * 0.3, 0.45 + i * 0.12, (Math.random() - 0.5) * 0.3); g.add(b); });
      g.position.set(x, y, z); g.traverse(o => { o.castShadow = true; }); scene.add(g);
      placeModel(key || 'flowerPot', V3(x, y, z), 0.9, { fallback: g, rotY: Math.random() * 6.28 });
    };
    pot(-3.4, s.z - 1.4, [0xffe63b, 0xffe63b, 0x2fbf71]); pot(-3.6, s.z - 0.5, [0xffe63b, 0xff8ad6]); pot(-3.4, s.z + 0.4, [0x2fbf71, 0xf2f2f2]);
    pot(3.4, s.z - 1.4, [0x9ff0e0, 0xffe63b]); pot(3.6, s.z - 0.5, [0xffe63b, 0xffe63b]); pot(3.4, s.z + 0.4, [0xe8141c, 0x2fbf71]);
    pot(-3.0, s.z + 1.4, [0xe8141c, 0x2fbf71], top, 'rosePot'); pot(3.0, s.z + 1.4, [0xffe63b, 0x2fbf71], top, 'rosePot');
    for (const x of [-5.4, 5.4]) { pot(x, s.z + 2.6, [0x2fbf71, 0x2fbf71, 0x3f9bd0], 0, 'rosePot'); pot(x + (x < 0 ? -0.7 : 0.7), s.z + 1.6, [0x2fbf71, 0xe8141c], 0); }

    // ---- donation QR standee (right of the stage, clickable) ----
    {
      const g = new THREE.Group();
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), mat(0xffffff, { map: T.qrBoard, roughness: 0.6 }));
      board.position.y = 1.15; g.add(board);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.04), M.black); bk.position.set(0, 1.15, -0.03); g.add(bk);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), M.silver); pole.position.y = 0.35; g.add(pole);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 16), M.black); foot.position.y = 0.02; g.add(foot);
      g.position.set(3.1, 0, s.z + s.d / 2 + 0.7); g.rotation.y = -0.15; scene.add(g);
      interactable(g, 'donate', 'Donate · दान (opens UPI / Paytm)');
      window.__qrStand = g;
    }

    // ---- temple bell (clickable) ----
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.42, 20), M.brass); g.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.brass); cap.position.y = 0.2; g.add(cap);
      const clap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.brass); clap.position.y = -0.24; g.add(clap);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), M.black); chain.position.y = 1.0; g.add(chain);
      g.position.set(-3.6, 2.1, s.z + 2.6); scene.add(g);
      interactable(g, 'bell', 'Ring the bell');
      window.__bell = g;
    }

    // ---- stage lighting rig ----
    const truss = box(9, 0.12, 0.12, M.black, 0, HALL.h - 0.4, s.z + 3.5, false);
    [-3.2, -2.6, 2.6, 3.2].forEach(x => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 12), M.black); lamp.position.set(x, HALL.h - 0.65, s.z + 3.5); lamp.rotation.x = 0.7; scene.add(lamp);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), x < 0 ? M.blueLamp : new THREE.MeshBasicMaterial({ color: 0xffe0b0 })); lens.position.set(x, HALL.h - 0.77, s.z + 3.65); lens.rotation.x = -0.9; scene.add(lens);
    });
    const spotB = new THREE.SpotLight(0x5a86ff, 1.6, 30, 0.45, 0.5, 1); spotB.position.set(-3, HALL.h - 0.6, s.z + 3.5); spotB.target.position.set(0, 2, s.z - 1); scene.add(spotB, spotB.target);
    const spotW = new THREE.SpotLight(0xffe2c0, 1.8, 30, 0.5, 0.5, 1); spotW.position.set(3, HALL.h - 0.6, s.z + 3.5); spotW.target.position.set(0, 2, s.z - 1);
    spotW.castShadow = true; spotW.shadow.mapSize.set(1024, 1024); spotW.shadow.bias = -0.0005; scene.add(spotW, spotW.target);
    const spotS = new THREE.SpotLight(0xffffff, 0.4, 30, 0.35, 0.6, 1); spotS.position.set(0, HALL.h - 0.3, s.z + 2); spotS.target.position.set(0, 1.5, s.z + 1); scene.add(spotS, spotS.target);
    // halogen floods on stands at both front corners (as in the photos)
    for (const x of [-5, 5]) {
      box(0.06, 3.2, 0.06, M.black, x, 1.6, s.z + 3.0, false);
      box(0.5, 0.35, 0.25, M.black, x, 3.3, s.z + 3.0, false);
      mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 3.3, s.z + 3.13, false);
    }
  }

  // =================================================================
  //  Ganesha murti (procedural)
  // =================================================================
  function buildGanesha(scale) {
    const g = new THREE.Group();
    const add = (o) => { o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    const S = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
    const pearl = mat(0xf0f0f0, { roughness: 0.25, metalness: 0.6 });
    const red = mat(0xd01a1a, { roughness: 0.4 });

    // --- silver scroll-arm throne on a red satin base ---
    add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 2.0), M.redSatin)).position.y = 0.07;
    add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 1.7), M.redSatin)).position.y = 0.3;
    for (const side of [-1, 1]) {
      const arm = add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 10, 28, Math.PI * 1.45), M.silver));
      arm.position.set(side * 1.3, 0.95, 0.15); arm.rotation.z = side > 0 ? -0.4 : Math.PI + 0.4;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 12), M.silver)).position.set(side * 1.3, 0.55, 0.15);
      add(new THREE.Mesh(S(0.16, 12, 10), M.silver)).position.set(side * 1.62, 1.25, 0.15);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 1.4 + (side > 0 ? -0.4 : Math.PI + 0.4); const p = add(new THREE.Mesh(S(0.035, 6, 5), pearl)); p.position.set(side * 1.3 + Math.cos(a) * 0.53, 0.95 + Math.sin(a) * 0.53, 0.28); }
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.12), M.silver)).position.set(0, 1.15, -0.85);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 0.1), mat(0x5a3fb0, { roughness: 0.6 }))).position.set(0, 1.15, -0.78);

    // --- seated body (one knee raised), magenta satin dhoti ---
    const dhoti = add(new THREE.Mesh(S(0.95), M.dhoti)); dhoti.position.set(0, 0.85, 0.05); dhoti.scale.set(1.25, 0.65, 1.0);
    add(new THREE.Mesh(S(0.36), M.dhoti)).position.set(-0.55, 1.05, 0.55);
    const shin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.7, 12), M.dhoti)); shin.position.set(-0.6, 0.7, 0.8); shin.rotation.x = 0.35;
    const footL = add(new THREE.Mesh(S(0.15, 12, 10), M.skin)); footL.position.set(-0.55, 0.42, 1.0); footL.scale.set(1, 0.6, 1.4);
    const footR = add(new THREE.Mesh(S(0.15, 12, 10), M.skin)); footR.position.set(0.45, 0.42, 0.8); footR.scale.set(1.2, 0.6, 1.3);
    const belly = add(new THREE.Mesh(S(0.7, 24, 18), M.skin)); belly.position.set(0, 1.45, 0); belly.scale.set(1, 1.05, 0.9);
    add(new THREE.Mesh(S(0.05, 8, 6), M.skinDark)).position.set(0, 1.25, 0.63);
    const shawl = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.3, 0.08), M.shawl)); shawl.position.set(0.55, 1.35, 0.35); shawl.rotation.set(0.15, 0, -0.35);

    // --- head with big fan ears ---
    const head = add(new THREE.Mesh(S(0.52, 26, 20), M.skin)); head.position.set(0, 2.5, 0); head.scale.set(1, 0.95, 0.95);
    for (const side of [-1, 1]) {
      const ear = add(new THREE.Mesh(S(0.44, 18, 14), M.skin)); ear.position.set(side * 0.68, 2.5, -0.1); ear.scale.set(0.16, 1.1, 0.95); ear.rotation.y = side * 0.35;
      const inner = add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), M.skinDark)); inner.position.set(side * 0.64, 2.5, -0.02); inner.rotation.y = side * 0.35; inner.scale.set(0.9, 1.15, 1);
      const w = add(new THREE.Mesh(S(0.09, 10, 8), M.white)); w.position.set(side * 0.2, 2.6, 0.45); w.scale.set(1.1, 0.75, 0.5);
      add(new THREE.Mesh(S(0.045, 8, 6), M.black)).position.set(side * 0.2, 2.6, 0.5);
      const brow = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), M.black)); brow.position.set(side * 0.2, 2.72, 0.48); brow.rotation.z = -side * 0.25;
    }
    const tilak = add(new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.28), red)); tilak.position.set(0, 2.85, 0.5); tilak.rotation.x = -0.25;
    // trunk curling to his left with a red stripe
    const curve = new THREE.CatmullRomCurve3([V3(0, 2.42, 0.42), V3(0, 2.15, 0.6), V3(0.03, 1.8, 0.66), V3(0.2, 1.5, 0.7), V3(0.42, 1.45, 0.62), V3(0.5, 1.6, 0.5)]);
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.14, 12, false), M.skin));
    const stripe = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.15, 12, false), red)); stripe.scale.set(0.3, 1, 1);
    add(new THREE.Mesh(S(0.14, 10, 8), M.skin)).position.copy(curve.getPoint(1));
    const tusk = add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 8), M.white)); tusk.position.set(-0.22, 2.2, 0.5); tusk.rotation.set(0.9, 0, 0.35);

    // --- ornate gold mukut with a rayed halo behind the head ---
    add(new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), M.gold)).position.set(0, 2.95, -0.35);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), M.gold)).position.set(0, 2.95, -0.33);
    for (let k = 0; k < 16; k++) { const ray = add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), M.gold)); const a = k / 16 * Math.PI * 2; ray.position.set(Math.cos(a) * 0.86, 2.95 + Math.sin(a) * 0.86, -0.34); ray.rotation.z = a - Math.PI / 2; }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.24, 24), M.gold)).position.y = 2.98;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.18, 24), M.gold)).position.y = 3.2;
    add(new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.85, 24), M.gold)).position.y = 3.5;
    for (let k = 0; k < 7; k++) { const a = (k - 3) * 0.32; add(new THREE.Mesh(S(0.045, 8, 6), mat(k % 2 ? 0x1fa64a : 0xd01a1a, { roughness: 0.2 }))).position.set(Math.sin(a) * 0.55, 2.98, Math.cos(a) * 0.55); }
    add(new THREE.Mesh(S(0.09, 10, 8), mat(0xd01a1a, { roughness: 0.2 }))).position.set(0, 3.0, 0.55);
    add(new THREE.Mesh(S(0.07, 10, 8), mat(0xd01a1a, { roughness: 0.2 }))).position.y = 3.95;

    // --- four arms: blessing hand, modak, axe, lotus ---
    const arm = (a, b, c) => { add(limb(a, b, 0.15, M.skin)); add(limb(b, c, 0.13, M.skin)); const h = add(new THREE.Mesh(S(0.16, 12, 10), M.skin)); h.position.set(...c); h.scale.set(1, 1.25, 0.6); return h; };
    arm([0.7, 1.9, 0], [1.05, 1.4, 0.35], [0.95, 1.9, 0.75]);
    for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 6), M.skin)).position.set(0.85 + k * 0.07, 2.1, 0.78);
    arm([-0.7, 1.9, 0], [-1.05, 1.4, 0.35], [-0.55, 1.25, 0.8]);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 12), mat(0xf8d16a))).position.set(-0.55, 1.42, 0.85);
    arm([0.6, 2.05, -0.15], [1.25, 1.95, -0.2], [1.2, 2.65, -0.05]);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), M.gold)).position.set(1.2, 3.0, -0.05);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.04), M.silver)).position.set(1.32, 3.35, -0.05);
    arm([-0.6, 2.05, -0.15], [-1.25, 1.95, -0.2], [-1.2, 2.65, -0.05]);
    add(new THREE.Mesh(S(0.15, 10, 8), mat(0xff6fa8))).position.set(-1.2, 2.9, -0.05);
    for (const p of [[0.95, 1.7, 0.7], [-0.55, 1.05, 0.75], [1.2, 2.45, -0.05], [-1.2, 2.45, -0.05]]) { const b = add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), M.gold)); b.position.set(...p); b.rotation.x = Math.PI / 2; }

    // --- marigold garlands: orange + yellow strands, U-shaped over the chest ---
    {
      const pts = [];
      for (const [r, dy, c, n] of [[0.95, 0.0, 0xff8c1a, 30], [0.75, 0.15, 0xffc21a, 26]]) {
        for (let i = 0; i <= n; i++) { const a = Math.PI + Math.PI * (i / n); pts.push([Math.cos(a) * r, 2.0 + dy + Math.sin(a) * r * 0.9, 0.62 + Math.sin(i / n * Math.PI) * 0.12, c]); }
      }
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xffffff, { roughness: 1 }), pts.length);
      const m = new THREE.Matrix4(), col = new THREE.Color();
      pts.forEach((p, k) => { m.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(k, m); inst.setColorAt(k, col.setHex(p[3])); });
      inst.castShadow = true; g.add(inst);
    }

    // --- silver mushak in front, to his right ---
    const mouse = new THREE.Group();
    const mb = new THREE.Mesh(S(0.28, 14, 12), M.silver); mb.scale.set(1.6, 0.85, 1); mouse.add(mb);
    const mh = new THREE.Mesh(S(0.19, 12, 10), M.silver); mh.position.set(0.42, 0.06, 0); mh.scale.set(1.3, 1, 1); mouse.add(mh);
    const nose = new THREE.Mesh(S(0.05, 8, 6), mat(0xff6fa8)); nose.position.set(0.66, 0.05, 0); mouse.add(nose);
    for (const sd of [-1, 1]) { const e = new THREE.Mesh(S(0.09, 10, 8), M.silver); e.position.set(0.36, 0.26, sd * 0.14); e.scale.set(0.4, 1, 1); mouse.add(e); const ey = new THREE.Mesh(S(0.03, 6, 5), M.black); ey.position.set(0.55, 0.14, sd * 0.1); mouse.add(ey); }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 20, Math.PI), M.silver); tail.position.set(-0.45, 0, 0); tail.rotation.x = Math.PI / 2; mouse.add(tail);
    const laddu = new THREE.Mesh(S(0.08, 8, 6), M.marigold); laddu.position.set(0.72, 0, 0.1); mouse.add(laddu);
    mouse.position.set(1.7, 0.42, 1.0); mouse.rotation.y = 0.5; mouse.traverse(o => { o.castShadow = true; }); g.add(mouse);

    g.scale.setScalar(scale);
    return g;
  }

  // =================================================================
  //  Chairs (instanced) – rows facing the stage, aisle in the centre
  // =================================================================
  const chairBlocks = [];
  {
    const pos = [];
    const rows = 4, cols = 4, gapX = 1.05, gapZ = 1.45, z0 = STAGE.z + STAGE.d / 2 + 3.2;
    for (const side of [-1, 1]) for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) pos.push({ x: side * (1.9 + c * gapX), z: z0 + r * gapZ });
    for (const side of [-1, 1]) chairBlocks.push({ x0: Math.min(side * 1.9, side * (1.9 + (cols - 1) * gapX)) - 0.3, x1: Math.max(side * 1.9, side * (1.9 + (cols - 1) * gapX)) + 0.3, z0: z0 - 0.4, z1: z0 + (rows - 1) * gapZ + 0.4 });
    const n = pos.length, m = new THREE.Matrix4();
    const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.07, 0.46), M.white, n);
    const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.52, 0.06), M.white, n);
    const skirt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.38, 0.48), M.pink, n);
    const sash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.47, 0.12, 0.08), M.pink, n);
    pos.forEach((p, i) => {
      m.makeTranslation(p.x, 0.41, p.z); seat.setMatrixAt(i, m);
      m.makeTranslation(p.x, 0.7, p.z + 0.2); back.setMatrixAt(i, m);
      m.makeTranslation(p.x, 0.19, p.z); skirt.setMatrixAt(i, m);
      m.makeTranslation(p.x, 0.78, p.z + 0.21); sash.setMatrixAt(i, m);
    });
    [seat, back, skirt, sash].forEach(o => { o.castShadow = true; o.receiveShadow = true; scene.add(o); });
  }

  // =================================================================
  //  Global lighting
  // =================================================================
  scene.add(new THREE.AmbientLight(0xffe6d0, 0.18));
  const hemi = new THREE.HemisphereLight(0xfff1e0, 0x3a1a20, 0.28); scene.add(hemi);
  for (const z of [-3, 5]) { const p = new THREE.PointLight(0xfff0dc, 0.5, 18, 2); p.position.set(0, HALL.h - 0.4, z); scene.add(p); }

  // falling petals while aarti plays
  const petalCount = LITE ? 50 : 140;
  const petals = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 6), mat(0xffa3cf, { side: THREE.DoubleSide }), petalCount);
  const petalState = [];
  for (let i = 0; i < petalCount; i++) petalState.push({ x: -6 + Math.random() * 12, y: 1 + Math.random() * 7, z: STAGE.z - 3 + Math.random() * 7, r: Math.random() * 6, s: 0.4 + Math.random() * 0.6 });
  petals.visible = false; scene.add(petals);

  // =================================================================
  //  Player / controls
  // =================================================================
  const player = { x: PORCH.x1 - 1.2, z: DOOR.z, yaw: Math.PI / 2, pitch: 0 };
  const keys = {};
  const walkRects = [
    { x0: -HX + 0.5, x1: HX - 0.5, z0: -HZ + 0.5, z1: HZ - 0.5 },
    { x0: HX - 0.6, x1: HX + 0.6, z0: DOOR.z - DOOR.width / 2 + 0.35, z1: DOOR.z + DOOR.width / 2 - 0.35 },
    { x0: PORCH.x0 + 0.5, x1: PORCH.x1 - 0.5, z0: PORCH.z0 + 0.5, z1: PORCH.z1 - 0.5 },
  ];
  const blockRects = [
    { x0: -STAGE.w / 2 - 0.5, x1: STAGE.w / 2 + 0.5, z0: -HZ, z1: STAGE.z + STAGE.d / 2 + 0.5 },
    { x0: 2.6, x1: 3.6, z0: STAGE.z + STAGE.d / 2 + 0.2, z1: STAGE.z + STAGE.d / 2 + 1.2 },   // QR stand
    { x0: -5.7, x1: -4.3, z0: STAGE.z + 2.3, z1: STAGE.z + 3.7 },      // flood-light stand
    { x0: 4.3, x1: 5.7, z0: STAGE.z + 2.3, z1: STAGE.z + 3.7 },
    ...chairBlocks,
  ];
  const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const canStand = (x, z) => walkRects.some(r => inR(r, x, z)) && !blockRects.some(r => inR(r, x, z));

  let locked = false, paused = true;
  const canvas = renderer.domElement;
  const overlay = document.getElementById('overlay');
  const hud = document.getElementById('hud');

  function enter() {
    paused = false;
    document.body.classList.remove('show-credits');
    renderCredits();
    overlay.hidden = true; hud.hidden = false;
    if (!isTouch) canvas.requestPointerLock && canvas.requestPointerLock();
    ensureAudio();
  }
  function pause(msg) {
    paused = true;
    document.getElementById('overlay-msg').textContent = msg || 'Paused';
    document.getElementById('enter-btn').textContent = '▶ Resume';
    overlay.hidden = false;
  }
  document.getElementById('enter-btn').addEventListener('click', enter);
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && !paused && !isTouch && donateModal.hidden) pause('Click Resume to continue walking.');
  });
  document.addEventListener('mousemove', e => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
  });
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') interactAtCenter(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('click', () => { if (isTouch || paused) return; if (!locked) canvas.requestPointerLock(); else interactAtCenter(); });

  // touch: joystick on the left, drag to look elsewhere, tap to interact
  const joy = { active: false, id: null, dx: 0, dy: 0 };
  const look = { id: null, lx: 0, ly: 0, moved: 0, sx: 0, sy: 0 };
  const joyEl = document.getElementById('joystick'), knob = document.getElementById('joystick-knob');
  if (isTouch) {
    joyEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; joy.active = true; joy.id = t.identifier; e.preventDefault(); }, { passive: false });
    const joyMove = e => {
      for (const t of e.changedTouches) if (t.identifier === joy.id) {
        const r = joyEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        joy.dx = dx; joy.dy = dy; knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
      }
    };
    joyEl.addEventListener('touchmove', e => { joyMove(e); e.preventDefault(); }, { passive: false });
    const joyEnd = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.active = false; joy.id = null; joy.dx = joy.dy = 0; knob.style.transform = ''; } };
    joyEl.addEventListener('touchend', joyEnd); joyEl.addEventListener('touchcancel', joyEnd);

    canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (look.id !== null) return; look.id = t.identifier; look.lx = look.sx = t.clientX; look.ly = look.sy = t.clientY; look.moved = 0; }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === look.id) {
        player.yaw -= (t.clientX - look.lx) * 0.005; player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - look.ly) * 0.005));
        look.moved += Math.abs(t.clientX - look.lx) + Math.abs(t.clientY - look.ly); look.lx = t.clientX; look.ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const lookEnd = e => { for (const t of e.changedTouches) if (t.identifier === look.id) { if (look.moved < 12 && !paused) interactAt(look.sx, look.sy); look.id = null; } };
    canvas.addEventListener('touchend', lookEnd); canvas.addEventListener('touchcancel', lookEnd);
  }

  // =================================================================
  //  Interaction (raycast)
  // =================================================================
  const raycaster = new THREE.Raycaster();
  const tooltip = document.getElementById('tooltip');
  function pick(ndcX, ndcY) {
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    raycaster.far = 14;
    const hits = raycaster.intersectObjects(interactables, true);
    return hits.length ? hits[0].object.userData : null;
  }
  function interactAtCenter() { const u = pick(0, 0); if (u) doAction(u.action); }
  function interactAt(px, py) { const u = pick((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1); if (u) doAction(u.action); }
  function doAction(a) {
    if (a === 'aarti') toggleAarti();
    else if (a === 'donate') openDonate();
    else if (a === 'bell') ringBell();
  }

  // =================================================================
  //  Aarti player
  // =================================================================
  const audio = document.getElementById('aarti-audio');
  const btnAarti = document.getElementById('btn-aarti');
  const nowPlaying = document.getElementById('now-playing');
  const playlist = (C.aarti && C.aarti.length) ? C.aarti : [];
  let trackIdx = 0, aartiOn = false;
  function loadTrack(i) { if (!playlist.length) return; trackIdx = (i + playlist.length) % playlist.length; audio.src = playlist[trackIdx].src; }
  function toggleAarti() {
    if (!playlist.length) return toast('No aarti files configured – add mp3s to assets/aarti/ and list them in config.js');
    if (!audio.getAttribute('src')) loadTrack(0);
    if (aartiOn) audio.pause();
    else audio.play().catch(err => toast('Could not play aarti: ' + err.message));
  }
  audio.addEventListener('play', () => { aartiOn = true; btnAarti.textContent = '⏸ Aarti'; btnAarti.classList.add('active'); nowPlaying.hidden = false; nowPlaying.querySelector('span').textContent = playlist[trackIdx].title; petals.visible = true; });
  audio.addEventListener('pause', () => { aartiOn = false; btnAarti.textContent = '▶ Aarti'; btnAarti.classList.remove('active'); nowPlaying.hidden = true; petals.visible = false; });
  // loop the aarti; with several tracks, move to the next one
  audio.addEventListener('ended', () => { if (playlist.length > 1) loadTrack(trackIdx + 1); else audio.currentTime = 0; audio.play().catch(() => {}); });
  audio.addEventListener('error', () => { audio.removeAttribute('src'); aartiOn = false; btnAarti.textContent = '▶ Aarti'; btnAarti.classList.remove('active'); nowPlaying.hidden = true; petals.visible = false; toast('Aarti file not found: ' + (playlist[trackIdx] || {}).src + ' — drop the mp3 into assets/aarti/'); });
  btnAarti.addEventListener('click', toggleAarti);

  // temple bell (WebAudio synthesised, no file needed)
  let actx = null;
  function ensureAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); }
  let bellSwing = 0;
  function ringBell() {
    ensureAudio(); if (!actx) return;
    const t = actx.currentTime, out = actx.createGain(); out.gain.value = 0.35; out.connect(actx.destination);
    [[520, 1, 2.8], [1040, 0.5, 2.2], [1560, 0.3, 1.6], [2600, 0.15, 1.0]].forEach(([f, a, d]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d);
    });
    bellSwing = 1;
  }
  document.getElementById('btn-bell').addEventListener('click', ringBell);

  // =================================================================
  //  Donate modal
  // =================================================================
  const donateModal = document.getElementById('donate-modal');
  donateModal.hidden = true;
  document.getElementById('upi-id').textContent = 'UPI ID: ' + ((C.upi || {}).id || '—');
  document.getElementById('upi-link').href = upiLink;
  if (C.paymentLink) { const pl = document.getElementById('paytm-link'); pl.href = C.paymentLink; pl.hidden = false; }
  function openDonate() {
    donateModal.hidden = false;
    if (locked) document.exitPointerLock();
    // On phones the UPI deep link opens Paytm / any UPI app directly, as in the sketch.
    if (isTouch) setTimeout(() => { location.href = C.paymentLink || upiLink; }, 300);
  }
  function closeDonate() { donateModal.hidden = true; if (!isTouch && !paused) canvas.requestPointerLock(); }
  document.getElementById('donate-close').addEventListener('click', closeDonate);
  donateModal.addEventListener('click', e => { if (e.target === donateModal) closeDonate(); });
  document.getElementById('btn-donate').addEventListener('click', openDonate);
  document.getElementById('btn-help').addEventListener('click', () => { if (locked) document.exitPointerLock(); document.body.classList.add('show-credits'); renderCredits(); pause('Walk to the pandal, click the murti for aarti, the bell to ring it, and the QR stand to donate.'); });

  // toast
  let toastTimer;
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000); }

  // =================================================================
  //  Main loop
  // =================================================================
  const clock = new THREE.Clock();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    if (!paused) {
      let fwd = 0, side = 0;
      if (keys.KeyW || keys.ArrowUp) fwd += 1; if (keys.KeyS || keys.ArrowDown) fwd -= 1;
      if (keys.KeyD || keys.ArrowRight) side += 1; if (keys.KeyA || keys.ArrowLeft) side -= 1;
      if (joy.active) { fwd -= joy.dy; side += joy.dx; }
      const l = Math.hypot(fwd, side); if (l > 1) { fwd /= l; side /= l; }
      const speed = (keys.ShiftLeft || keys.ShiftRight) ? 6.5 : 3.6;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      const dx = (-sy * fwd + cy * side) * speed * dt, dz = (-cy * fwd - sy * side) * speed * dt;
      const nx = player.x + dx, nz = player.z + dz;
      if (canStand(nx, nz)) { player.x = nx; player.z = nz; }
      else if (canStand(nx, player.z)) player.x = nx;
      else if (canStand(player.x, nz)) player.z = nz;
    }
    const bob = (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || joy.active) && !paused ? Math.sin(t * 9) * 0.03 : 0;
    camera.position.set(player.x, EYE + bob, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // hover tooltip (desktop, pointer locked)
    if (!isTouch && locked) { const u = pick(0, 0); tooltip.hidden = !u; if (u) tooltip.textContent = u.label; } else tooltip.hidden = true;

    // flames flicker
    flames.forEach((f, i) => { const k = 1 + Math.sin(t * 18 + i * 1.7) * 0.18 + Math.sin(t * 31 + i) * 0.1; f.scale.set(k, k * 1.1, k); });
    // aura pulses with aarti
    if (window.__aura) window.__aura.intensity = aartiOn ? 1.4 + Math.sin(t * 3) * 0.6 : 0.8;
    // aarti thali: only while the aarti plays, circling clockwise in front of the murti
    if (window.__thali) {
      const th = window.__thali.obj, o = window.__thali.orbit;
      th.visible = aartiOn;
      if (aartiOn) {
        const a = -t * 1.6;                                   // negative = clockwise for a viewer facing -z
        th.position.set(o.cx + Math.cos(a) * o.r, o.cy + Math.sin(a) * o.r * 0.8, o.cz + 0.1 * Math.sin(t * 2));
        th.rotation.set(-0.35, 0, Math.sin(a) * 0.15);        // tilted slightly toward the murti
      }
    }
    // bell swing
    if (window.__bell) { window.__bell.rotation.z = Math.sin(t * 12) * 0.25 * bellSwing; bellSwing = Math.max(0, bellSwing - dt * 0.6); }
    // string lights blink
    // petals
    if (petals.visible) {
      petalState.forEach((p, i) => {
        p.y -= dt * (0.6 + p.s * 0.5); p.x += Math.sin(t * 2 + i) * dt * 0.3; p.r += dt * 2;
        if (p.y < STAGE.h + 0.1) { p.y = 7.5; p.x = -6 + Math.random() * 12; p.z = STAGE.z - 3 + Math.random() * 7; }
        tmpE.set(p.r, p.r * 0.7, 0); tmpQ.setFromEuler(tmpE); tmpS.setScalar(p.s);
        tmpM.compose(V3(p.x, p.y, p.z), tmpQ, tmpS); petals.setMatrixAt(i, tmpM);
      });
      petals.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  // debug hook: teleport the player (used by tests)
  window.__setView = v => { Object.assign(player, v); };
  window.__scene = scene; window.__renderer = renderer;
  loadTrack(0);
  tick();
})();
