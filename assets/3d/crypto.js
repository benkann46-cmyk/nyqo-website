import { THREE, createRenderer, studioEnvironment, roundedBox, contactShadow, runScene, easeInOutCubic, easeOutExpo, clamp01 } from "./kit.js?v=20261115";

const GRAPHITE = 0x221e2e;
const GRAPHITE_DARK = 0x16131f;
const VIOLET = 0x9135ff;

const SEAL = 300;
const TO_SERVER = 950;
const HOLD = 1150;
const TO_PC = 1420;
const OPEN = 1750;
const SHOW = 3900;

export function mountCrypto(host, wire) {
  const renderer = createRenderer(host, { maxDpr: 1.5 });
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(26, 3, 10, 5000);

  scene.add(new THREE.HemisphereLight(0xd9ccff, 0x0c0a12, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(-300, 600, 500);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb48bff, 2.2);
  rim.position.set(400, 200, -500);
  scene.add(rim);

  const standard = (color, roughness = 0.45, metalness = 0.35) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: 0.4, envMapIntensity: 1 });
  const screenTexture = (() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 320;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0c0a12";
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = "#16131f";
    ctx.fillRect(0, 0, 120, 320);
    [["#9135ff", 24], ["#ff6b3d", 74], ["#2dd4bf", 124]].forEach(([color, y]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(16, y, 88, 38, 8);
      ctx.fill();
    });
    ctx.fillStyle = "#2c273b";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.roundRect(140 + (i % 2) * 70, 30 + i * 62, 230 - (i % 2) * 40, 40, 12);
      ctx.fill();
    }
    ctx.fillStyle = "#211d2d";
    ctx.beginPath();
    ctx.roundRect(140, 272, 352, 32, 10);
    ctx.fill();
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  })();
  const screenMaterial = () => new THREE.MeshBasicMaterial({ map: screenTexture, color: 0xffffff });

  const laptop = new THREE.Group();
  laptop.position.set(-400, 0, 0);
  const base = new THREE.Mesh(roundedBox(230, 150, 10, 12, 2), standard(GRAPHITE));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 5;
  laptop.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 10, -72);
  lid.rotation.x = -0.22;
  const lidShell = new THREE.Mesh(roundedBox(230, 150, 6, 12, 2), standard(GRAPHITE));
  lidShell.position.y = 75;
  lid.add(lidShell);
  const laptopScreen = new THREE.Mesh(new THREE.PlaneGeometry(208, 128), screenMaterial());
  laptopScreen.position.set(0, 77, 3.2);
  lid.add(laptopScreen);
  laptop.add(lid);
  const shadowA = contactShadow(320, 220);
  shadowA.position.y = 0.2;
  laptop.add(shadowA);
  scene.add(laptop);

  const server = new THREE.Group();
  const tower = new THREE.Mesh(roundedBox(150, 240, 150, 10, 3), standard(GRAPHITE_DARK, 0.5, 0.5));
  tower.position.y = 120;
  server.add(tower);
  const slots = [];
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(
      new THREE.PlaneGeometry(112, 9),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET).multiplyScalar(0.25) }),
    );
    slot.position.set(0, 52 + i * 30, 76.2);
    server.add(slot);
    slots.push(slot);
  }
  const shadowB = contactShadow(260, 260);
  shadowB.position.y = 0.2;
  server.add(shadowB);
  scene.add(server);

  const pc = new THREE.Group();
  pc.position.set(400, 0, 0);
  const monitor = new THREE.Mesh(roundedBox(240, 150, 10, 10, 2.5), standard(GRAPHITE));
  monitor.position.y = 130;
  pc.add(monitor);
  const pcScreen = new THREE.Mesh(new THREE.PlaneGeometry(222, 132), screenMaterial());
  pcScreen.position.set(0, 130, 5.3);
  pc.add(pcScreen);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 60, 16), standard(GRAPHITE));
  neck.position.set(0, 32, -10);
  pc.add(neck);
  const foot = new THREE.Mesh(roundedBox(110, 70, 6, 20, 2), standard(GRAPHITE));
  foot.rotation.x = -Math.PI / 2;
  foot.position.set(0, 3, -10);
  pc.add(foot);
  const shadowC = contactShadow(320, 220);
  shadowC.position.y = 0.2;
  pc.add(shadowC);
  scene.add(pc);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-400, 150, 20),
    new THREE.Vector3(-210, 290, 40),
    new THREE.Vector3(0, 280, 60),
    new THREE.Vector3(210, 290, 40),
    new THREE.Vector3(400, 150, 20),
  ]);
  const routeGeometry = new THREE.TubeGeometry(curve, 160, 1.4, 8, false);
  scene.add(new THREE.Mesh(routeGeometry, new THREE.MeshBasicMaterial({ color: 0x3a3350, transparent: true, opacity: 0.8 })));
  const glow = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uHead: { value: -1 }, uColor: { value: new THREE.Color(0xb48bff) } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader:
      "uniform float uHead; uniform vec3 uColor; varying vec2 vUv;" +
      "void main() { float d = uHead - vUv.x; float a = (1.0 - smoothstep(0.0, 0.32, d)) * step(0.0, d); gl_FragColor = vec4(uColor * a * 1.6, a); }",
  });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 3.2, 8, false), glow));

  const lock = new THREE.Group();
  const lockMaterial = new THREE.MeshPhysicalMaterial({
    color: VIOLET,
    roughness: 0.25,
    metalness: 0.3,
    clearcoat: 1,
    emissive: new THREE.Color(VIOLET),
    emissiveIntensity: 0.35,
  });
  const lockBody = new THREE.Mesh(roundedBox(40, 32, 18, 6, 2), lockMaterial);
  lock.add(lockBody);
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(11, 3.2, 12, 28, Math.PI),
    new THREE.MeshPhysicalMaterial({ color: 0xcbc7d4, roughness: 0.2, metalness: 0.9 }),
  );
  shackle.position.y = 16;
  lock.add(shackle);
  lock.visible = false;
  scene.add(lock);

  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = 768;
  cardCanvas.height = 240;
  const cardTexture = new THREE.CanvasTexture(cardCanvas);
  cardTexture.colorSpace = THREE.SRGBColorSpace;
  cardTexture.anisotropy = 4;
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(256, 80),
    new THREE.MeshBasicMaterial({ map: cardTexture, transparent: true, depthWrite: false }),
  );
  card.visible = false;
  scene.add(card);
  const drawCard = (text) => {
    const ctx = cardCanvas.getContext("2d");
    ctx.clearRect(0, 0, 768, 240);
    ctx.fillStyle = "#211d2d";
    ctx.beginPath();
    ctx.roundRect(8, 8, 752, 224, 44);
    ctx.fill();
    ctx.strokeStyle = "rgba(180,139,255,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ebe9f0";
    ctx.font = '500 44px "Inter", system-ui, sans-serif';
    ctx.textBaseline = "middle";
    const lines = [""];
    for (const word of text.split(" ")) {
      const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
      if (ctx.measureText(next).width <= 680 || !lines.at(-1)) lines[lines.length - 1] = next;
      else if (lines.length < 2) lines.push(word);
      else {
        lines[1] = `${lines[1]}…`;
        break;
      }
    }
    const top = lines.length === 1 ? 120 : 92;
    lines.forEach((line, i) => ctx.fillText(line, 44, top + i * 58));
    cardTexture.needsUpdate = true;
  };
  const cardAt = (group, y) => new THREE.Vector3(group.position.x, y, 40);
  const fromCard = cardAt(laptop, 210);
  const toCard = cardAt(pc, 240);

  let sentAt = -1;
  wire.addEventListener("wire:send", (e) => {
    drawCard(e.detail.text);
    sentAt = performance.now();
  });

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  host.addEventListener(
    "pointermove",
    (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    },
    { passive: true },
  );
  host.addEventListener("pointerleave", () => Object.assign(pointer, { x: 0, y: 0 }));

  const frame = (now) => {
    const t = now / 1000;
    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;
    camera.position.set(eased.x * 110, 300 - eased.y * 45, 1000);
    camera.lookAt(0, 150, 0);

    const e = sentAt < 0 ? Infinity : now - sentAt;
    let head = -1;
    lock.visible = e < OPEN + 250;
    card.visible = e < SEAL || (e > OPEN - 100 && e < SHOW + 500);

    if (e < SEAL) {
      const p = easeInOutCubic(e / SEAL);
      card.position.copy(fromCard);
      card.scale.set(1 - p * 0.85, 1 - p * 0.6, 1);
      card.material.opacity = 1 - p;
      lock.position.copy(fromCard);
      lock.scale.setScalar(p);
      lock.rotation.set(0, 0, 0);
      shackle.position.y = 16;
    } else if (e < OPEN + 250) {
      lock.scale.setScalar(1);
      let u;
      if (e < TO_SERVER) u = 0.5 * easeInOutCubic((e - SEAL) / (TO_SERVER - SEAL));
      else if (e < HOLD) u = 0.5;
      else if (e < TO_PC) u = 0.5 + 0.5 * easeInOutCubic((e - HOLD) / (TO_PC - HOLD));
      else u = 1;
      head = u;
      lock.position.copy(curve.getPointAt(u));
      lock.position.y += 18;
      const held = e >= TO_SERVER && e < HOLD ? Math.sin(((e - TO_SERVER) / (HOLD - TO_SERVER)) * Math.PI * 6) * 0.18 : 0;
      lock.rotation.set(0, t * 2.2, held);
      if (e >= TO_PC) {
        const p = easeOutExpo(clamp01((e - TO_PC) / (OPEN - TO_PC)));
        shackle.position.y = 16 + p * 12;
        lock.scale.setScalar(1 - clamp01((e - OPEN) / 250));
      }
    }
    if (e >= OPEN - 100 && e < SHOW + 500) {
      const p = easeOutExpo(clamp01((e - OPEN + 100) / 420));
      const fade = 1 - clamp01((e - SHOW) / 500);
      card.position.copy(toCard);
      card.position.y += (1 - p) * -40;
      card.scale.set(0.3 + p * 0.7, 0.3 + p * 0.7, 1);
      card.material.opacity = p * fade;
    }
    glow.uniforms.uHead.value = head;

    const nearServer = head >= 0 ? clamp01(1 - Math.abs(head - 0.5) * 5) : 0;
    slots.forEach((slot, i) => {
      const blink = 0.1 + 0.08 * Math.max(0, Math.sin(t * 2.4 + i * 1.7));
      slot.material.color.set(VIOLET).multiplyScalar(blink + nearServer * 0.9);
    });
    lockMaterial.emissiveIntensity = 0.35 + nearServer * 0.6;
    laptopScreen.material.color.setScalar(e < SEAL + 200 ? 1.5 : 0.85);
    pcScreen.material.color.setScalar(e > OPEN - 100 && e < SHOW ? 1.5 : 0.85);

    renderer.render(scene, camera);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
