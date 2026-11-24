import { THREE, createRenderer, studioEnvironment, runScene, trackPointer, easeOutExpo, easeOutBack, clamp01 } from "./kit.js?v=20261115";
import { buildMark } from "./mark.js?v=20261115";
import { SQUADS, buildTile, displayFontReady } from "./tiles.js?v=20261115";

const HAND = ["Sunday Raid", "Ranked Crew", "Midnight Squad", "Speedrun Club", "LAN Basement"];
const PIVOT_Y = -330;
const ARM = 345;
const FIT = 2 * Math.tan(THREE.MathUtils.degToRad(14));

export async function mountDownload(host) {
  await displayFontReady();
  const renderer = createRenderer(host);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 4000);
  camera.position.set(0, 0, 900);

  scene.add(new THREE.HemisphereLight(0xd9ccff, 0x0c0a12, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-420, 620, 420);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb48bff, 2.4);
  rim.position.set(460, -200, -360);
  scene.add(rim);

  const stage = new THREE.Group();
  scene.add(stage);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cards = HAND.map((name, i) => {
    const mesh = buildTile(SQUADS.find((squad) => squad.name === name), 168, anisotropy);
    stage.add(mesh);
    return { mesh, spread: (i - 2) * 0.27, depth: -40 - Math.abs(i - 2) * 16 - i * 2 };
  });

  const { group: mark } = buildMark();
  stage.add(mark);

  const pointer = trackPointer();
  let start = 0;

  const frame = (now) => {
    start ||= now;
    const elapsed = now - start;
    const t = now / 1000;
    pointer.step();

    cards.forEach((card, i) => {
      const open = easeOutExpo(clamp01((elapsed - 150 - Math.abs(i - 2) * 90) / 1300));
      const turn = card.spread * open + Math.sin(t * 0.6 + i) * 0.012;
      card.mesh.position.set(Math.sin(turn) * ARM, PIVOT_Y + Math.cos(turn) * ARM - (1 - open) * 30, card.depth);
      card.mesh.rotation.set(0, 0, -turn);
    });

    const pop = easeOutBack(clamp01((elapsed - 350) / 900));
    mark.scale.setScalar(0.36 * pop);
    mark.position.set(0, -34 + Math.sin(t * 0.9) * 5, 70);
    mark.rotation.set(0.1 + pointer.y * 0.2, -0.4 + pointer.x * 0.5 + Math.sin(t * 0.5) * 0.14 + (1 - pop) * 2.2, 0);

    stage.rotation.set(pointer.y * 0.06, pointer.x * 0.12, 0);
    camera.position.set(0, -12, Math.max(260, 640 / camera.aspect) / FIT);
    renderer.render(scene, camera);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
