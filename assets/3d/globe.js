// A dotted globe for the translation section. Each time a chat message flips language on the page,
// a ripple leaves the sender's corner of the world and arcs run to the friends reading it.
import { THREE, coarsePointer, createRenderer, runScene, trackPointer, easeOutExpo, clamp01 } from "./kit.js?v=20261115";
import { isLand } from "./land.js?v=20261115";

const R = 200;
const INK = 0xebe9f0;
// Rough positions, only there to spread the languages over the map. `from` matches data-from in the chat.
const PLACES = [
  { label: "Español", lat: 40.4, lon: -3.7, from: "Spanish", color: 0xff5d8f },
  { label: "日本語", lat: 35.7, lon: 139.7, from: "Japanese", color: 0x2dd4bf },
  { label: "Deutsch", lat: 52.5, lon: 13.4, from: "German", color: 0xffc857 },
  { label: "Français", lat: 46.5, lon: 2.5 },
  { label: "Português", lat: 38.7, lon: -9.1 },
  { label: "Türkçe", lat: 39.9, lon: 32.8 },
  { label: "Polski", lat: 52.2, lon: 21 },
  { label: "Українська", lat: 49.5, lon: 31 },
  { label: "العربية", lat: 30, lon: 31.2 },
  { label: "हिन्दी", lat: 24, lon: 78 },
  { label: "Italiano", lat: 42, lon: 12.5 },
  { label: "한국어", lat: 37.5, lon: 127 },
];
const PULSE_MS = 1500;

const rad = (deg) => (deg * Math.PI) / 180;
const onSphere = (lat, lon, radius = 1) =>
  new THREE.Vector3(Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat)), Math.cos(rad(lat)) * Math.cos(rad(lon))).multiplyScalar(radius);

function landDots(count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spots = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = ((((i * golden * 180) / Math.PI) % 360) + 540) % 360 - 180;
    if (isLand(lon, lat)) spots.push(onSphere(lat, lon));
  }
  const dots = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1.65, 8),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0x8f8aa0) },
        uPulseColor: { value: new THREE.Color(INK) },
        uPulseDir: { value: new THREE.Vector3(0, 1, 0) },
        uPulseT: { value: -1 },
        uShow: { value: 0 },
      },
      vertexShader: `
        uniform vec3 uPulseDir; uniform float uPulseT;
        varying float vWave; varying float vFacing;
        void main() {
          vec3 n = normalize((instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
          float reach = acos(clamp(dot(n, uPulseDir), -1.0, 1.0));
          vWave = smoothstep(0.24, 0.0, abs(reach - uPulseT * 2.1)) * (1.0 - uPulseT) * step(0.0, uPulseT);
          vFacing = normalize(normalMatrix * n).z;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * (1.0 + vWave * 1.1), 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform vec3 uPulseColor; uniform float uShow;
        varying float vWave; varying float vFacing;
        void main() {
          float limb = smoothstep(0.0, 0.5, vFacing);
          gl_FragColor = vec4(mix(uColor, uPulseColor, clamp(vWave * 1.4, 0.0, 1.0)), (0.3 + 0.7 * limb) * uShow);
        }`,
    }),
    spots.length,
  );
  const dummy = new THREE.Object3D();
  spots.forEach((spot, i) => {
    dummy.position.copy(spot).multiplyScalar(R * 1.004);
    dummy.lookAt(spot.clone().multiplyScalar(R * 2));
    dummy.updateMatrix();
    dots.setMatrixAt(i, dummy.matrix);
  });
  return dots;
}

function body() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 40),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      // Graphite with a soft key light from the upper left and a thin violet edge.
      fragmentShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          float edge = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
          float lit = max(dot(vN, normalize(vec3(-0.55, 0.65, 0.55))), 0.0);
          vec3 color = mix(vec3(0.063, 0.055, 0.094), vec3(0.135, 0.118, 0.184), lit);
          gl_FragColor = vec4(color + vec3(0.47, 0.33, 0.86) * edge * 0.5, 1.0);
        }`,
    }),
  );
}

function halo() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: "varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "varying vec3 vN; void main() { float a = pow(clamp(-vN.z * 1.9, 0.0, 1.0), 2.6) * 0.42; gl_FragColor = vec4(vec3(0.57, 0.21, 1.0) * a, a); }",
    }),
  );
}

function label(place) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = '600 30px Inter, system-ui, "Noto Sans", sans-serif';
  ctx.font = font;
  const dot = place.color ? 30 : 0;
  const width = Math.ceil(ctx.measureText(place.label).width) + 44 + dot;
  canvas.width = width;
  canvas.height = 60;
  ctx.fillStyle = "#2c273b";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 60, 30);
  ctx.fill();
  if (place.color) {
    ctx.fillStyle = `#${place.color.toString(16).padStart(6, "0")}`;
    ctx.beginPath();
    ctx.arc(31, 30, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ebe9f0";
  ctx.fillText(place.label, 22 + dot, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthTest: false, toneMapped: false }));
  sprite.scale.set((width / 60) * 27, 27, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function arc(a, b) {
  const angle = a.angleTo(b);
  const lift = 0.1 + (angle / Math.PI) * 0.42;
  const sinAngle = Math.sin(angle);
  const points = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    // Great-circle path, raised in the middle so it clears the surface.
    return a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
      .addScaledVector(b, Math.sin(t * angle) / sinAngle)
      .multiplyScalar(R * (1.012 + lift * Math.sin(t * Math.PI)));
  });
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uHead: { value: -1 }, uFlip: { value: 0 }, uTrail: { value: 0 }, uColor: { value: new THREE.Color(INK) } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform float uHead; uniform float uFlip; uniform float uTrail; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float along = mix(vUv.x, 1.0 - vUv.x, uFlip);
        float behind = uHead - along;
        float a = (1.0 - smoothstep(0.0, 0.45, behind)) * step(0.0, behind) + uTrail * step(along, uHead);
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 1.5, 6, false), material);
}

export function mountGlobe(host) {
  const renderer = createRenderer(host);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 4000);
  camera.position.set(0, 0, 1100);

  const globe = new THREE.Group();
  scene.add(globe);
  globe.add(body());
  const dots = landDots(coarsePointer ? 9000 : 15000);
  globe.add(dots);
  scene.add(halo());

  const places = PLACES.map((place, i) => {
    const normal = onSphere(place.lat, place.lon);
    const pin = new THREE.Mesh(
      new THREE.CircleGeometry(place.color ? 4.2 : 2.6, 20),
      new THREE.MeshBasicMaterial({ color: place.color ?? INK, toneMapped: false, transparent: true, opacity: 0 }),
    );
    pin.position.copy(normal).multiplyScalar(R * 1.008);
    pin.lookAt(normal.clone().multiplyScalar(R * 2));
    globe.add(pin);
    const tag = label(place);
    // Staggered heights keep neighbouring tags from landing on top of each other.
    tag.position.copy(normal).multiplyScalar(R * (1.11 + (i % 3) * 0.075));
    globe.add(tag);
    return { ...place, normal, pin, tag, shown: 0 };
  });
  const friends = places.filter((place) => place.from);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 48),
    new THREE.MeshBasicMaterial({ color: INK, toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  globe.add(ring);

  const arcs = [];
  friends.forEach((a, i) =>
    friends.slice(i + 1).forEach((b) => {
      const mesh = arc(a.normal, b.normal);
      globe.add(mesh);
      arcs.push({ a, b, uniforms: mesh.material.uniforms });
    }),
  );

  let pulse = null;
  const lit = new Set();
  document.addEventListener("translate:pulse", (e) => {
    const sender = friends.find((friend) => friend.from === e.detail.from);
    if (!sender) return;
    pulse = { sender, at: performance.now() };
    lit.clear();
    lit.add(sender.label);
    for (const name of e.detail.lit ?? []) lit.add(name);
    dots.material.uniforms.uPulseDir.value.copy(sender.normal);
    dots.material.uniforms.uPulseColor.value.set(sender.color);
    ring.material.color.set(sender.color);
    ring.position.copy(sender.normal).multiplyScalar(R * 1.01);
    ring.lookAt(sender.normal.clone().multiplyScalar(R * 2));
  });

  const pointer = trackPointer();
  const facing = new THREE.Vector3();
  let start = 0;

  const frame = (now) => {
    start ||= now;
    const t = now / 1000;
    const intro = easeOutExpo(clamp01((now - start) / 1400));
    pointer.step(0.05);

    // Sways between Europe and East Asia so both ends of the conversation stay in view.
    globe.rotation.set(0.4 + pointer.y * 0.1, -rad(70 + Math.sin(t * 0.22) * 17) + pointer.x * 0.22, 0);
    globe.scale.setScalar(0.88 + intro * 0.12);
    dots.material.uniforms.uShow.value = intro;

    const p = pulse ? (now - pulse.at) / PULSE_MS : -1;
    const live = p >= 0 && p <= 1;
    dots.material.uniforms.uPulseT.value = live ? p : -1;
    ring.material.opacity = live ? (1 - p) * 0.9 : 0;
    ring.scale.setScalar(4 + easeOutExpo(clamp01(p)) * 30);
    for (const { a, b, uniforms } of arcs) {
      const active = pulse && (pulse.sender === a || pulse.sender === b);
      if (active) {
        uniforms.uFlip.value = pulse.sender === b ? 1 : 0;
        uniforms.uColor.value.set(pulse.sender.color);
        uniforms.uHead.value = clamp01(p / 0.6) * 1.02;
        uniforms.uTrail.value = 0.3 * clamp01(2.4 - p * 1.6);
      } else {
        uniforms.uHead.value = -1;
        uniforms.uTrail.value = 0;
      }
    }

    for (const place of places) {
      facing.copy(place.normal).applyQuaternion(globe.quaternion);
      const front = clamp01((facing.z - 0.08) / 0.3);
      place.shown += ((lit.has(place.label) ? 1 : 0) - place.shown) * 0.12;
      place.tag.material.opacity = place.shown * front * intro;
      place.pin.material.opacity = intro * (place.color ? 1 : 0.75);
    }

    renderer.render(scene, camera);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
