import * as THREE from "../vendor/three/three.module.min.js";

export { THREE };

export const coarsePointer = matchMedia("(pointer: coarse)").matches;

export function createRenderer(host, { maxDpr = 1.75 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  return renderer;
}

export function studioEnvironment(renderer, { accent = 0xb48bff, floor = 0x7404f5 } = {}) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), new THREE.MeshBasicMaterial({ color: 0x0c0a12, side: THREE.BackSide })));
  const panel = (color, strength, w, h, position) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }),
    );
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  panel(0xffffff, 6, 30, 14, new THREE.Vector3(-18, 26, 22));
  panel(accent, 5, 10, 40, new THREE.Vector3(34, 0, -10));
  panel(floor, 4, 40, 8, new THREE.Vector3(0, -30, 10));
  panel(0xffffff, 1.6, 16, 16, new THREE.Vector3(20, 10, 34));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  return env;
}

export function roundedBox(w, h, d, r = Math.min(w, h) * 0.15, bevel = Math.min(2.5, d * 0.2)) {
  const x = -w / 2 + bevel;
  const y = -h / 2 + bevel;
  const iw = w - bevel * 2;
  const ih = h - bevel * 2;
  const ir = Math.max(0.01, Math.min(r, iw / 2, ih / 2));
  const shape = new THREE.Shape();
  shape.moveTo(x + ir, y);
  shape.lineTo(x + iw - ir, y);
  shape.quadraticCurveTo(x + iw, y, x + iw, y + ir);
  shape.lineTo(x + iw, y + ih - ir);
  shape.quadraticCurveTo(x + iw, y + ih, x + iw - ir, y + ih);
  shape.lineTo(x + ir, y + ih);
  shape.quadraticCurveTo(x, y + ih, x, y + ih - ir);
  shape.lineTo(x, y + ir);
  shape.quadraticCurveTo(x, y, x + ir, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -(d - bevel * 2) / 2);
  return geometry;
}

export function contactShadow(width, depth, opacity = 0.55) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function trackPointer() {
  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  if (!coarsePointer) {
    addEventListener(
      "pointermove",
      (e) => {
        target.x = (e.clientX / innerWidth) * 2 - 1;
        target.y = (e.clientY / innerHeight) * 2 - 1;
      },
      { passive: true },
    );
  }
  eased.step = (rate = 0.06) => {
    eased.x += (target.x - eased.x) * rate;
    eased.y += (target.y - eased.y) * rate;
  };
  return eased;
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

export function runScene(host, renderer, camera, frame, onFirstFrame) {
  let visible = false;
  let raf = 0;
  let painted = false;
  let stopped = false;
  const resize = () => {
    const canvas = renderer.domElement;
    const { width, height } = canvas.clientWidth ? { width: canvas.clientWidth, height: canvas.clientHeight } : host.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    frame(now);
    if (!painted) {
      painted = true;
      onFirstFrame?.();
    }
  };
  const update = () => {
    const run = visible && !document.hidden && !stopped;
    if (run && !raf) raf = requestAnimationFrame(tick);
    if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(host);
  document.addEventListener("visibilitychange", update);
  const stop = () => {
    stopped = true;
    host.classList.remove("is-3d", "is-eligible");
    update();
  };
  renderer.domElement.addEventListener("webglcontextlost", stop);
  reduceMotion.addEventListener("change", () => reduceMotion.matches && stop());
  resize();
}
