// The NYQO mark as a solid object: its two pieces fly in and lock together, then squad tiles
// drift into orbit around it. Everything leans towards the cursor and opens up on scroll.
import { THREE, coarsePointer, createRenderer, studioEnvironment, runScene, trackPointer, easeOutExpo, clamp01 } from "./kit.js?v=20261115";
import { buildMark, assemble } from "./mark.js?v=20261115";
import { SQUADS, buildTile, displayFontReady } from "./tiles.js?v=20261115";

const ASSEMBLE_MS = 1500;
const TILES_AT = 650;
const GROUND = 0x0c0a12;
// On a narrow screen the canvas runs past the viewport, so the orbit is pulled in to stay visible.
const compact = matchMedia("(max-width: 900px)");

export async function mountHero(host) {
  await displayFontReady();
  const renderer = createRenderer(host, { maxDpr: coarsePointer ? 2 : 1.75 });
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  // Tiles at the back of the orbit sink into the page colour instead of competing with the mark.
  scene.fog = new THREE.Fog(GROUND, 1430, 2000);
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 4000);
  camera.position.set(0, 0, 1445);

  scene.add(new THREE.HemisphereLight(0xd9ccff, GROUND, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-520, 640, 380);
  scene.add(key);
  const top = new THREE.DirectionalLight(0xe9e0ff, 1.2);
  top.position.set(200, 900, 100);
  scene.add(top);
  const rim = new THREE.DirectionalLight(0xb48bff, 3);
  rim.position.set(520, -240, -420);
  scene.add(rim);

  const { group: mark, pieces } = buildMark();
  scene.add(mark);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tileCount = coarsePointer ? 5 : 7;
  const tiles = SQUADS.slice(0, tileCount).map((squad, i) => {
    const mesh = buildTile(squad, 112, anisotropy);
    mesh.scale.setScalar(0);
    scene.add(mesh);
    return {
      mesh,
      angle: (i / tileCount) * Math.PI * 2 + 0.5,
      radius: 292 + (i % 3) * 16,
      lift: ((i * 37) % 60) - 30,
      size: 0.86 + ((i * 53) % 30) / 100,
      phase: i * 1.7,
    };
  });

  // A few loose fragments between the tiles keep the space from feeling empty.
  const shardCount = coarsePointer ? 8 : 16;
  const shards = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(7, 0),
    new THREE.MeshPhysicalMaterial({ color: 0x9135ff, roughness: 0.3, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }),
    shardCount,
  );
  const shardData = Array.from({ length: shardCount }, (_, i) => ({
    angle: (i / shardCount) * Math.PI * 2 + Math.random() * 0.4,
    radius: 210 + Math.random() * 190,
    y: (Math.random() - 0.5) * 400,
    z: (Math.random() - 0.5) * 420 - 80,
    scale: 0.5 + Math.random() * 1.2,
    spin: (Math.random() - 0.5) * 0.8,
    speed: 0.03 + Math.random() * 0.05,
  }));
  scene.add(shards);

  const pointer = trackPointer();
  const dummy = new THREE.Object3D();
  const orbit = new THREE.Euler();
  const spot = new THREE.Vector3();
  let start = 0;

  const frame = (now) => {
    start ||= now;
    const elapsed = now - start;
    const t = now / 1000;
    pointer.step();
    const scroll = clamp01(scrollY / (host.offsetHeight || 1));

    assemble(pieces, (i) => easeOutExpo(clamp01((elapsed - i * 140) / ASSEMBLE_MS)));
    // The rim light flares once as the pieces lock into place.
    const lock = clamp01((elapsed - ASSEMBLE_MS * 0.55) / 500);
    rim.intensity = 3 + Math.sin(lock * Math.PI) * 5;

    // Rests turned a little so the depth reads, and sways slowly like something on display.
    mark.rotation.y = -0.42 + pointer.x * 0.32 + Math.sin(t * 0.45) * 0.12 + scroll * 0.6;
    mark.rotation.x = 0.12 + pointer.y * 0.2 + Math.sin(t * 0.33) * 0.04;
    mark.position.y = Math.sin(t * 0.8) * 7 + scroll * 40;

    // The orbit is a tilted ring: tiles pass low in front of the mark and high behind it.
    orbit.set(0.46 + pointer.y * 0.1 + scroll * 0.3, 0, -0.14);
    tiles.forEach((tile, i) => {
      const arrive = easeOutExpo(clamp01((elapsed - TILES_AT - i * 110) / 1300));
      const angle = tile.angle + t * 0.13 + pointer.x * 0.22 + (1 - arrive) * 1.4;
      const radius = tile.radius * (compact.matches ? 0.82 : 1) * (1 + scroll * 0.28) * (2.2 - arrive * 1.2);
      spot.set(Math.cos(angle) * radius, tile.lift + Math.sin(t * 0.7 + tile.phase) * 8, Math.sin(angle) * radius).applyEuler(orbit);
      tile.mesh.position.copy(spot);
      tile.mesh.rotation.set(-0.1 + Math.sin(t * 0.5 + tile.phase) * 0.06, Math.cos(angle) * 0.62, Math.sin(t * 0.4 + tile.phase) * 0.05 - 0.04);
      tile.mesh.scale.setScalar(tile.size * arrive);
    });

    shardData.forEach((s, i) => {
      const a = s.angle + t * s.speed;
      dummy.position.set(Math.cos(a) * s.radius - pointer.x * 40 * s.scale, s.y + Math.sin(t * 0.6 + i) * 10 + pointer.y * 26, s.z + Math.sin(a) * 80);
      dummy.rotation.set(t * s.spin, t * s.spin * 0.7, i);
      dummy.scale.setScalar(s.scale * clamp01((elapsed - 500 - i * 40) / 700));
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    });
    shards.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
