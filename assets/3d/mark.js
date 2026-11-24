import { THREE } from "./kit.js?v=20261115";

const PIECES = [
  {
    points: [[0, 51], [87, 0], [211, 76], [211, 155], [73, 74], [73, 219], [0, 262]],
    face: 0x9135ff,
    side: 0x4b14a0,
    from: { position: [-330, 210, -260], rotation: [0.7, -1.1, 0.5] },
  },
  {
    points: [[230, 49], [299, 7], [299, 223], [211, 283], [95, 216], [95, 142], [131, 158], [131, 202], [165, 178], [230, 203]],
    face: 0x7404f5,
    side: 0x3a0a85,
    from: { position: [330, -220, -260], rotation: [-0.6, 1.0, -0.4] },
  },
];

const material = (color, roughness) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });

export function buildMark() {
  const group = new THREE.Group();
  const pieces = PIECES.map((piece) => {
    const shape = new THREE.Shape(piece.points.map(([x, y]) => new THREE.Vector2(x, -y)));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 46,
      bevelEnabled: true,
      bevelThickness: 5,
      bevelSize: 3.5,
      bevelSegments: 5,
      curveSegments: 1,
    });
    geometry.translate(-150, 142, -23);
    const mesh = new THREE.Mesh(geometry, [material(piece.face, 0.18), material(piece.side, 0.38)]);
    group.add(mesh);
    return { mesh, from: piece.from };
  });
  return { group, pieces };
}

export function assemble(pieces, progress) {
  pieces.forEach(({ mesh, from }, i) => {
    const k = 1 - progress(i);
    mesh.position.set(from.position[0] * k, from.position[1] * k, from.position[2] * k);
    mesh.rotation.set(from.rotation[0] * k, from.rotation[1] * k, from.rotation[2] * k);
  });
}
