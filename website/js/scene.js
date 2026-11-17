/* NTS Real Estate System — 3D hero scenes (three.js r128)
 *  - "building": a lit, rotating city of towers that reacts to the mouse and to scroll
 *  - "lattice":  a wireframe knot with orbiting blocks used on inner-page headers
 */
(() => {
  'use strict';
  if (typeof THREE === 'undefined') return; // offline / CDN blocked: page still works without 3D
  const host = document.querySelector('.hero, .page-hero');
  if (!host) return;
  const mode = document.body.dataset.scene;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { canvas.remove(); return; } // no WebGL: gradient background remains
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.028);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const BRAND = 0x1a6ff0, CYAN = 0x1bc0f5;

  scene.add(new THREE.AmbientLight(0x6f8cff, 0.55));
  const key = new THREE.DirectionalLight(0x9fd8ff, 0.9); key.position.set(8, 14, 6); scene.add(key);
  const glow = new THREE.PointLight(BRAND, 2.2, 40); glow.position.set(0, 6, 0); scene.add(glow);

  // deterministic RNG so the skyline is identical on every load
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const root = new THREE.Group();
  scene.add(root);
  const spinners = [];

  /* particles (shared) */
  const makeDust = (n, spread, size) => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rnd() - 0.5) * spread; p[i * 3 + 1] = rnd() * spread * 0.6; p[i * 3 + 2] = (rnd() - 0.5) * spread; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: CYAN, size, transparent: true, opacity: 0.7, depthWrite: false }));
  };

  if (mode === 'building') {
    /* procedural window texture */
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#0b1328'; x.fillRect(0, 0, 128, 256);
      for (let r = 0; r < 16; r++) for (let q = 0; q < 6; q++) {
        const lit = rnd();
        x.fillStyle = lit > 0.62 ? '#ffd58a' : lit > 0.38 ? '#46c9ff' : '#13204a';
        x.fillRect(8 + q * 20, 6 + r * 15.5, 12, 9);
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      return t;
    })();

    const addTower = (x, z, w, d, h, hot) => {
      const side = tex.clone(); side.needsUpdate = true; side.repeat.set(Math.max(1, Math.round(w)), Math.max(1, h / 2.4));
      const sideMat = new THREE.MeshStandardMaterial({ map: side, emissiveMap: side, emissive: 0xffffff, emissiveIntensity: hot ? 1.15 : 0.7, roughness: 0.5, metalness: 0.4 });
      const topMat = new THREE.MeshStandardMaterial({ color: 0x0f1c3f, roughness: 0.6, metalness: 0.3 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
      m.position.set(x, h / 2, z);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry),
        new THREE.LineBasicMaterial({ color: hot ? CYAN : BRAND, transparent: true, opacity: hot ? 0.9 : 0.4 })
      );
      m.add(edges);
      root.add(m);
      return m;
    };

    const N = 6, gap = 3.1;
    for (let i = -N / 2; i < N / 2; i++) for (let j = -N / 2; j < N / 2; j++) {
      if (rnd() < 0.18) continue;
      const dist = Math.hypot(i + 0.5, j + 0.5);
      const h = 1.6 + rnd() * 4.2 + Math.max(0, 3 - dist) * 1.3;
      addTower(i * gap + gap / 2, j * gap + gap / 2, 1.5 + rnd() * 0.8, 1.5 + rnd() * 0.8, h, false);
    }
    const hero = addTower(0.4, 0.4, 2.1, 2.1, 11.5, true);

    // roof beacon + orbit ring around the hero tower
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: CYAN }));
    beacon.position.y = 6.2; hero.add(beacon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.03, 8, 120), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0.4, 8, 0.4); root.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(1.45); ring2.material = ring.material.clone(); ring2.material.opacity = 0.35; ring2.position.y = 5.2; root.add(ring2);
    spinners.push((t) => { ring.position.y = 8 + Math.sin(t * 0.9) * 0.5; ring2.position.y = 5.2 + Math.cos(t * 0.7) * 0.5; ring.rotation.z = t * 0.5; ring2.rotation.z = -t * 0.3; });

    // key-shaped floating marker (key = property handover)
    const keyG = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.11, 12, 32), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa630, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.25 }));
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.14), bow.material); shaft.position.x = 1.1;
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), bow.material); tooth1.position.set(1.55, -0.2, 0);
    const tooth2 = tooth1.clone(); tooth2.position.x = 1.1; tooth2.scale.y = 0.7;
    keyG.add(bow, shaft, tooth1, tooth2); keyG.position.set(-4.2, 4.5, 4.5); keyG.scale.setScalar(0.9);
    root.add(keyG);
    spinners.push((t) => { keyG.rotation.y = t * 0.9; keyG.rotation.z = Math.sin(t * 0.6) * 0.3; keyG.position.y = 4.5 + Math.sin(t * 1.1) * 0.35; });

    const grid = new THREE.GridHelper(44, 44, BRAND, 0x10224a);
    grid.material.transparent = true; grid.material.opacity = 0.35; root.add(grid);
    const dust = makeDust(260, 34, 0.07); root.add(dust);
    spinners.push((t) => { dust.rotation.y = t * 0.02; });
  } else {
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.1, 0.55, 220, 18, 2, 3),
      new THREE.MeshBasicMaterial({ color: BRAND, wireframe: true, transparent: true, opacity: 0.5 })
    );
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 0.8, flatShading: true, roughness: 0.3 }));
    const cubes = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const s = 0.18 + rnd() * 0.34;
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s * (1 + rnd() * 2.4), s), new THREE.MeshStandardMaterial({ color: 0x142654, emissive: BRAND, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.4 }));
      const a = (i / 14) * Math.PI * 2, r = 3.6 + rnd() * 1.4;
      c.position.set(Math.cos(a) * r, (rnd() - 0.5) * 3, Math.sin(a) * r);
      c.add(new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.7 })));
      cubes.add(c);
    }
    root.add(knot, core, cubes, makeDust(220, 26, 0.06));
    spinners.push((t) => { knot.rotation.x = t * 0.18; knot.rotation.y = t * 0.24; core.rotation.y = -t * 0.5; core.rotation.x = t * 0.3; cubes.rotation.y = t * 0.12; cubes.children.forEach((c, i) => { c.rotation.y = t * (0.3 + i * 0.02); }); });
  }

  /* ───────── sizing, input, loop ───────── */
  let w = 1, h = 1, wide = true, mx = 0, my = 0, sx = 0, sy = 0, scrollP = 0;
  const size = () => {
    w = host.clientWidth; h = host.clientHeight; wide = w / h > 1.05;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const s = mode === 'building' ? (wide ? 0.9 : 0.62) : (wide ? 1 : 0.7);
    root.scale.setScalar(s);
    root.position.x = wide ? (mode === 'building' ? 6.2 : 4.2) : 0;
    root.position.y = wide ? 0 : (mode === 'building' ? 2.4 : 2.2);
  };
  size();
  addEventListener('resize', size);
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  window.__scrollFx = (y) => { scrollP = Math.min(1, y / Math.max(1, host.clientHeight)); };

  const isBuilding = mode === 'building';
  const baseCam = isBuilding ? [21, 15, 24] : [0, 0, 11];
  const render = (t) => {
    sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
    spinners.forEach((f) => f(t));
    if (isBuilding) {
      root.rotation.y = t * 0.07 + sx * 0.7 + scrollP * 1.4;
      camera.position.set(baseCam[0] - sx * 3, baseCam[1] - sy * 2 - scrollP * 3, baseCam[2] - scrollP * 3.5);
      camera.lookAt(wide ? 1.2 : 0, 3.2 + scrollP * 2, 0);
      root.children[0] && (root.position.y = (wide ? 0 : 2.4) - scrollP * 2);
    } else {
      root.rotation.y = sx * 0.6 + scrollP * 0.8; root.rotation.x = sy * 0.4;
      camera.position.set(baseCam[0], baseCam[1], baseCam[2]);
      camera.lookAt(0, 0, 0);
    }
    glow.position.set(Math.sin(t * 0.4) * 8, 6, Math.cos(t * 0.4) * 8);
    canvas.style.opacity = String(1 - scrollP * 0.85);
    renderer.render(scene, camera);
  };

  if (reduce) { render(2); addEventListener('resize', () => render(2)); return; }

  let running = true, raf = 0;
  const clock = new THREE.Clock();
  const loop = () => { raf = requestAnimationFrame(loop); render(clock.getElapsedTime()); };
  const setRun = (on) => { if (on && !raf) { clock.start(); loop(); } else if (!on) { cancelAnimationFrame(raf); raf = 0; } };
  new IntersectionObserver(([e]) => { running = e.isIntersecting; setRun(running && !document.hidden); }).observe(host);
  document.addEventListener('visibilitychange', () => setRun(running && !document.hidden));
  setRun(true);
})();
