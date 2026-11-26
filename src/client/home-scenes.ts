import * as THREE from "three";

type Motion = (time: number, delta: number) => void;
const lime = new THREE.Color("#c6e887");
const pale = new THREE.Color("#e0e8c9");
const vivid = new THREE.Color("#7d83ff");
const vividSoft = new THREE.Color("#b9bdff");

function orbitScene(world: THREE.Group): Motion {
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 3),
    new THREE.MeshPhysicalMaterial({ color: "#405a35", metalness: 0.55, roughness: 0.2, clearcoat: 1,
      emissive: "#24321c", emissiveIntensity: 0.4 }));
  world.add(core);

  const rings = [
    [1.22, 0.009, lime, 0.88, 0.94, 0.18, -0.35],
    [1.55, 0.006, pale, 0.48, 0.28, 1.08, 0.16],
    [1.04, 0.005, vivid, 0.76, 1.42, -0.5, 0.82],
  ].map(([radius, tube, color, opacity, rx, ry, rz]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius as number, tube as number, 8, 180),
      new THREE.MeshBasicMaterial({ color: color as THREE.Color, transparent: true, opacity: opacity as number }));
    ring.rotation.set(rx as number, ry as number, rz as number);
    world.add(ring);
    return ring;
  });

  const nodeGeo = new THREE.SphereGeometry(0.035, 12, 12);
  const nodeMats = [new THREE.MeshBasicMaterial({ color: lime }), new THREE.MeshBasicMaterial({ color: pale }), new THREE.MeshBasicMaterial({ color: vivid })];
  const nodes: THREE.Mesh[] = [];
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 11; i += 1) {
    const angle = i / 11 * Math.PI * 2;
    const radius = i % 2 === 0 ? 1.22 : 1.55;
    const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66, Math.sin(angle * 2) * 0.24);
    points.push(point);
    const node = new THREE.Mesh(nodeGeo, nodeMats[i % nodeMats.length]);
    node.position.copy(point);
    world.add(node);
    nodes.push(node);
  }

  const linkPositions: number[] = [];
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    linkPositions.push(point.x, point.y, point.z, next.x, next.y, next.z);
  });
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
  world.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: lime, transparent: true, opacity: 0.28 })));

  const stars: number[] = [];
  for (let i = 0; i < 112; i += 1) {
    const angle = i * 2.399963229728653;
    const y = ((i * 0.61803398875) % 1) * 2 - 1;
    const radius = 2.05 + (i % 9) * 0.075;
    const spread = Math.sqrt(1 - y * y);
    stars.push(Math.cos(angle) * spread * radius, y * radius, Math.sin(angle) * spread * radius * 0.34);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  world.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: pale, size: 0.018, transparent: true, opacity: 0.56 })));

  const glow = new THREE.PointLight(lime, 17, 5, 2);
  glow.position.set(0.5, 0.45, 1.3);
  world.add(glow);

  return (time, delta) => {
    core.rotation.y += delta * 0.22;
    core.rotation.x = Math.sin(time * 0.32) * 0.08;
    rings[0].rotation.z += delta * 0.06;
    rings[1].rotation.x -= delta * 0.035;
    rings[2].rotation.y += delta * 0.048;
    nodes.forEach((node, i) => {
      node.scale.setScalar(1 + Math.sin(time * 1.7 + i * 0.8) * 0.28);
      node.position.z = points[i].z + Math.sin(time * 0.7 + i) * 0.09;
    });
    world.rotation.y = Math.sin(time * 0.2) * 0.08;
  };
}

function flowScene(world: THREE.Group, compact: boolean, viewportWidth: number): Motion {
  const width = compact ? Math.min(8.2, Math.max(6.8, viewportWidth / 43)) : 13.2;
  const height = compact ? 3.2 : 2.8;
  const segmentsX = compact ? 22 : 52;
  const segmentsY = compact ? 7 : 11;
  const plane = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const positions = plane.attributes.position as THREE.BufferAttribute;
  const surface = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({
    color: "#9fbd75",
    wireframe: true,
    transparent: true,
    opacity: compact ? 0.68 : 0.58,
  }));
  surface.position.z = -0.25;
  world.add(surface);

  const dotsGeo = new THREE.BufferGeometry();
  const dots = new Float32Array(positions.count * 3);
  dotsGeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
  world.add(new THREE.Points(dotsGeo, new THREE.PointsMaterial({
    color: pale,
    size: compact ? 0.024 : 0.022,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  })));

  const halfWidth = width / 2;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfWidth, -0.15, 0.12),
    new THREE.Vector3(-halfWidth * 0.68, 0.42, 0.02),
    new THREE.Vector3(-halfWidth * 0.32, -0.3, 0.34),
    new THREE.Vector3(0, 0.25, 0.16),
    new THREE.Vector3(halfWidth * 0.34, -0.34, 0.38),
    new THREE.Vector3(halfWidth * 0.68, 0.36, 0.06),
    new THREE.Vector3(halfWidth, 0.02, 0.18),
  ]);
  world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 150, compact ? 0.014 : 0.011, 8, false),
    new THREE.MeshBasicMaterial({ color: lime, transparent: true, opacity: 0.86 })));

  const beadGeo = new THREE.SphereGeometry(compact ? 0.09 : 0.075, 18, 18);
  const beads = [vivid, pale, vividSoft].map(color => {
    const bead = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color }));
    world.add(bead);
    return bead;
  });

  const particles: number[] = [];
  const particleCount = compact ? 45 : 90;
  for (let i = 0; i < particleCount; i += 1) {
    particles.push(
      ((i * 37) % 89) / 89 * width - halfWidth,
      ((i * 19) % 23) / 23 * height - height / 2,
      -0.55 + ((i * 13) % 17) / 17 * 0.9,
    );
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.Float32BufferAttribute(particles, 3));
  world.add(new THREE.Points(particleGeo, new THREE.PointsMaterial({
    color: pale,
    size: compact ? 0.014 : 0.013,
    transparent: true,
    opacity: 0.48,
  })));

  return (time) => {
    const dotPositions = dotsGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = Math.sin(x * (compact ? 1.28 : 1.15) - time * 1.18) * (compact ? 0.29 : 0.2)
        + Math.cos(y * 2.4 + time * 0.82) * (compact ? 0.19 : 0.13);
      positions.setZ(i, z);
      dotPositions[i * 3] = x;
      dotPositions[i * 3 + 1] = y;
      dotPositions[i * 3 + 2] = z + 0.018;
    }
    positions.needsUpdate = true;
    dotsGeo.attributes.position.needsUpdate = true;
    beads.forEach((bead, i) => {
      const point = curve.getPointAt((time * (0.075 + i * 0.012) + i / beads.length) % 1);
      bead.position.copy(point);
      bead.scale.setScalar(0.88 + Math.sin(time * 2.2 + i) * 0.22);
    });
    world.rotation.y = Math.sin(time * 0.18) * 0.055;
  };
}

function init(root: HTMLElement): (() => void) | undefined {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-home-scene-canvas]");
  if (!canvas) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.devicePixelRatio <= 1.35, powerPreference: "low-power" });
  } catch {
    canvas.dataset.failed = "true";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.z = 6.5;
  scene.add(new THREE.HemisphereLight(0xe0e8c9, 0x101810, 1.45));
  const key = new THREE.DirectionalLight(0xe0e8c9, 2.4);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const world = new THREE.Group();
  scene.add(world);
  const isFlowScene = root.dataset.homeScene === "flow";
  const initialWidth = Math.max(1, root.getBoundingClientRect().width);
  const motion = isFlowScene ? flowScene(world, initialWidth < 620, initialWidth) : orbitScene(world);

  let frame = 0;
  let lastFrame = 0;
  let lastTime = 0;
  let visible = true;
  let pointerX = 0;
  let pointerY = 0;
  const stop = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    lastTime = 0;
  };
  const render = () => renderer.render(scene, camera);
  const tick = (now: number) => {
    frame = 0;
    if (!visible || document.visibilityState === "hidden") return;
    if (now - lastFrame < 32) { frame = window.requestAnimationFrame(tick); return; }
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastFrame = now;
    lastTime = now;
    motion(now / 1000, delta);
    world.rotation.x += (pointerY * 0.045 - world.rotation.x) * 0.025;
    world.rotation.z += (pointerX * 0.04 - world.rotation.z) * 0.025;
    render();
    frame = window.requestAnimationFrame(tick);
  };
  const start = () => {
    if (!frame && visible && document.visibilityState !== "hidden") {
      lastFrame = 0; lastTime = 0; frame = window.requestAnimationFrame(tick);
    }
  };
  const resize = () => {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 620 ? (isFlowScene ? 9.4 : 9.2) : (isFlowScene ? 6.5 : 9.2);
    camera.updateProjectionMatrix();
    render();
  };
  const move = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
  };
  const leave = () => { pointerX = 0; pointerY = 0; };
  const visibility = () => document.visibilityState === "hidden" ? stop() : start();
  const intersection = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    visible = Boolean(entries[0]?.isIntersecting);
    if (visible) {
      start();
    } else {
      stop();
    }
  }, { rootMargin: "40px 0px" }) : null;
  intersection?.observe(root);

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(root);
  else window.addEventListener("resize", resize, { passive: true });
  root.addEventListener("pointermove", move, { passive: true });
  root.addEventListener("pointerleave", leave, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  resize();
  root.classList.add("is-live");
  start();

  return () => {
    stop();
    intersection?.disconnect();
    resizeObserver?.disconnect();
    if (!resizeObserver) window.removeEventListener("resize", resize);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", visibility);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      const item = object as THREE.Mesh;
      if ("geometry" in object && item.geometry) geometries.add(item.geometry);
      if ("material" in object && item.material) {
        const list = Array.isArray(item.material) ? item.material : [item.material];
        list.forEach(material => materials.add(material));
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    root.classList.remove("is-live");
  };
}

const roots = [...document.querySelectorAll<HTMLElement>("[data-home-scene]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const active = new Map<HTMLElement, () => void>();
let observer: IntersectionObserver | null = null;

function disposeAll() {
  observer?.disconnect();
  observer = null;
  active.forEach(dispose => dispose());
  active.clear();
  roots.forEach(root => { root.dataset.sceneLoaded = ""; });
}
function observeScenes() {
  if (reducedMotion.matches || roots.length === 0) return;
  observer?.disconnect();
  const boot = (root: HTMLElement) => {
    if (root.dataset.sceneLoaded === "true") return;
    root.dataset.sceneLoaded = "true";
    const dispose = init(root);
    if (dispose) active.set(root, dispose);
  };
  if (typeof IntersectionObserver !== "function") { roots.forEach(boot); return; }
  observer = new IntersectionObserver((entries, current) => entries.forEach(entry => {
    if (entry.isIntersecting) { current.unobserve(entry.target); boot(entry.target as HTMLElement); }
  }), { rootMargin: "180px 0px" });
  roots.forEach(root => observer?.observe(root));
}
reducedMotion.addEventListener("change", () => reducedMotion.matches ? disposeAll() : observeScenes());
window.addEventListener("pagehide", disposeAll);
window.addEventListener("pageshow", event => { if (event.persisted) observeScenes(); });
if (!reducedMotion.matches) observeScenes();
