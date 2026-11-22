// NYQO Flash as an object: the bolt from the icon set, cast in cyan. Every few seconds it strikes.
import { THREE, coarsePointer, createRenderer, studioEnvironment, runScene, trackPointer, easeOutExpo, easeOutBack, clamp01 } from "./kit.js?v=20261115";

// Outline of #i-bolt (viewBox 0 0 24 24).
const BOLT = [[13.5, 2], [4, 13.5], [11, 13.5], [10, 22], [19.5, 10.5], [12.5, 10.5]];
const CYAN = 0x5ee7ff;
const STRIKE_EVERY_MS = 4600;

export function mountFlash(host) {
  const renderer = createRenderer(host);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, { accent: CYAN, floor: 0x1b6f8a });
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 4000);
  camera.position.set(0, 0, 1150);

  scene.add(new THREE.HemisphereLight(0xd6f8ff, 0x0c0a12, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-420, 600, 420);
  scene.add(key);
  const rim = new THREE.DirectionalLight(CYAN, 3);
  rim.position.set(480, -200, -380);
  scene.add(rim);

  const shape = new THREE.Shape(BOLT.map(([x, y]) => new THREE.Vector2((x - 11.75) * 15, (12 - y) * 15)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 40, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelSegments: 5, curveSegments: 1 });
  geometry.translate(0, 0, -20);
  const face = new THREE.MeshPhysicalMaterial({
    color: CYAN,
    emissive: 0x1aa7c4,
    emissiveIntensity: 0.3,
    roughness: 0.16,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.1,
  });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0x1787a6, emissive: 0x0b5a73, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.25, clearcoat: 1 });
  const bolt = new THREE.Mesh(geometry, [face, edge]);
  scene.add(bolt);

  const sparkCount = coarsePointer ? 12 : 22;
  const sparks = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(6, 0),
    new THREE.MeshBasicMaterial({ color: 0xc9f7ff, toneMapped: false }),
    sparkCount,
  );
  const sparkData = Array.from({ length: sparkCount }, () => {
    const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, (Math.random() - 0.5) * 0.7).normalize();
    return { direction, reach: 150 + Math.random() * 170, size: 0.5 + Math.random(), spin: (Math.random() - 0.5) * 6 };
  });
  scene.add(sparks);

  const pointer = trackPointer();
  const dummy = new THREE.Object3D();
  let start = 0;

  const frame = (now) => {
    start ||= now;
    const elapsed = now - start;
    const t = now / 1000;
    pointer.step();

    const drop = clamp01(elapsed / 1100);
    // The first strike lands as the bolt does; after that it repeats on a slow beat.
    const sinceStrike = (elapsed - 700 + STRIKE_EVERY_MS * 1000) % STRIKE_EVERY_MS;
    const strike = elapsed < 700 ? 0 : Math.max(0, 1 - sinceStrike / 520);

    bolt.rotation.set(pointer.y * 0.18, -0.5 + (1 - easeOutExpo(drop)) * -3.4 + Math.sin(t * 0.55) * 0.3 + pointer.x * 0.4, -0.16);
    bolt.position.y = (1 - easeOutExpo(drop)) * 260 + Math.sin(t * 0.9) * 8;
    bolt.scale.setScalar(easeOutBack(clamp01(elapsed / 900)) * (1 + strike * 0.05));
    face.emissiveIntensity = 0.3 + strike * 1.5;
    edge.emissiveIntensity = 0.3 + strike * 1.1;
    rim.intensity = 3 + strike * 6;

    const burst = elapsed < 700 ? 1 : clamp01(sinceStrike / 1000);
    sparkData.forEach((spark, i) => {
      const out = easeOutExpo(burst);
      dummy.position.copy(spark.direction).multiplyScalar(40 + out * spark.reach);
      dummy.position.y -= burst * burst * 50;
      dummy.rotation.set(t * spark.spin, i, t * spark.spin * 0.6);
      dummy.scale.setScalar(spark.size * (1 - burst) * 1.4);
      dummy.updateMatrix();
      sparks.setMatrixAt(i, dummy.matrix);
    });
    sparks.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
