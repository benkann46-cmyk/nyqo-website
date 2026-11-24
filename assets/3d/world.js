import { THREE, coarsePointer, createRenderer, studioEnvironment, roundedBox, runScene, trackPointer, clamp01 } from "./kit.js?v=20261115";
import { buildMark, assemble } from "./mark.js?v=20261115";
import { loadModel } from "./model.js?v=20261112";

const GROUND = 0x0c0a12;
const HAZE = 0x1a1133;
const VIOLET = 0x9135ff;
const VIOLET_TEXT = 0xb48bff;
const GREEN = 0x4cc77a;
const AMBER = 0xff9b45;

const KNOLL = 5;
const PLINTH = 1.1;
const RACK = { w: 2.5, h: 8.6, d: 2.95 };
const MODEL = { url: new URL("./models/server.gltf?v=20261112", import.meta.url).href, foot: -0.951, top: 0.716 };
const TOWER = 1.5;
const MARK_Y = PLINTH + RACK.h + 2.7;

const STOPS = [
  [[-58, 47, 152], [0, 15, 0]],
  [[-43, 25, 106], [0, 14, 0]],
  [[-26, 10, 64], [0, 13.5, 0]],
  [[-15, 7.4, 44], [0, 15.5, 0]],
  [[-7, 7.8, 37], [0, 15, 0]],
  [[-1.5, 8.6, 35], [0, 14.6, 0]],
];
const MOON = new THREE.Vector3(0.12, 0.23, -1).normalize();
const APPROACH = Math.atan2(STOPS[0][0][2], STOPS[0][0][0]);

const compact = matchMedia("(max-width: 900px)");
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function noise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i++) {
    sum += amp * noise(x, z);
    x *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
function ridges(x, z) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(noise(x, z) * 2 - 1);
    sum += amp * n * n;
    x *= 2.07;
    z *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

function heightAt(x, z) {
  const d = Math.hypot(x, z);
  let turn = Math.atan2(z, x) - APPROACH;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const open = 1 - 0.9 * Math.exp(-(turn * turn) / 0.42);
  const mountains = ridges(x * 0.0085 + 3.1, z * 0.0085 - 1.7) * 96 * smooth(34, 230, d) * open;
  const rolling = (fbm(x * 0.035 + 9, z * 0.035 + 4) - 0.47) * 8 * smooth(9, 46, d);
  return KNOLL * (1 - smooth(8, 62, d)) + rolling + mountains;
}

function buildTerrain(segments) {
  const reach = 460;
  const geometry = new THREE.PlaneGeometry(2, 2, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color(0x15111f);
  const high = new THREE.Color(0x5a4f7c);
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i);
    const v = position.getZ(i);
    const x = Math.sign(u) * Math.abs(u) ** 1.8 * reach;
    const z = Math.sign(v) * Math.abs(v) ** 1.8 * reach;
    const y = heightAt(x, z);
    position.setXYZ(i, x, y, z);
    tint.copy(low).lerp(high, smooth(10, 70, y) * (0.75 + 0.25 * hash(x, z)));
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.12 });
  const uniforms = { uTime: { value: 0 }, uLine: { value: new THREE.Color(VIOLET) } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorld;
        uniform float uTime;
        uniform vec3 uLine;
        float cell(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float drift(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cell(i), cell(i + vec2(1.0, 0.0)), f.x), mix(cell(i + vec2(0.0, 1.0)), cell(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float band = vWorld.y / 3.0;
        float contour = 1.0 - min(abs(fract(band - 0.5) - 0.5) / max(fwidth(band), 0.0001), 1.0);
        float near = 1.0 - smoothstep(30.0, 260.0, length(vViewPosition));
        float wave = fract(uTime * 0.09);
        float ring = smoothstep(9.0, 0.0, abs(length(vWorld.xz) - wave * 240.0)) * (1.0 - wave) * (1.0 - wave);
        float mist = (1.0 - smoothstep(-5.0, 11.0, vWorld.y)) * smoothstep(16.0, 70.0, length(vWorld.xz));
        mist *= 0.3 + 0.7 * drift(vWorld.xz * 0.02 + vec2(uTime * 0.035, uTime * 0.02));
        totalEmissiveRadiance += uLine * (contour * 0.42 * near + ring * 0.5) + vec3(0.2, 0.15, 0.44) * mist * 0.4;`,
      );
  };
  return { mesh: new THREE.Mesh(geometry, material), uniforms };
}

function buildSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(GROUND) },
      haze: { value: new THREE.Color(HAZE) },
      glow: { value: new THREE.Color(0x5a1fb8) },
      moon: { value: MOON },
      moonlight: { value: new THREE.Color(0xd9d4ff) },
    },
    vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 zenith;
      uniform vec3 haze;
      uniform vec3 glow;
      uniform vec3 moon;
      uniform vec3 moonlight;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 color = mix(haze, zenith, smoothstep(-0.05, 0.42, h));
        float behind = max(0.0, dot(normalize(dir.xz), normalize(moon.xz)));
        color += glow * pow(behind, 5.0) * (1.0 - smoothstep(0.0, 0.34, h)) * 0.6;
        float facing = max(0.0, dot(dir, moon));
        color += moonlight * (smoothstep(0.99905, 0.9993, facing) * 4.5 + pow(facing, 700.0) * 0.7 + pow(facing, 50.0) * 0.16);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
}

function buildStars(random, count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const turn = random() * Math.PI * 2;
    const lift = 0.06 + random() * 0.94;
    const flat = Math.sqrt(1 - lift * lift);
    positions.set([Math.cos(turn) * flat * 860, lift * 860, Math.sin(turn) * flat * 860], i * 3);
    const bright = 0.25 + random() ** 3 * 0.75;
    colors.set([bright * 1.3, bright * 1.2, bright * 1.6], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, fog: false, depthWrite: false }));
}

function buildTrees(random, count, flight) {
  const low = flight.slice(Math.floor(flight.length * 0.4));
  const inSight = (x, z) =>
    low.some((p) => {
      const along = clamp01((x * p.x + z * p.z) / (p.x * p.x + p.z * p.z));
      return (x - p.x * along) ** 2 + (z - p.z * along) ** 2 < 36;
    });
  const geometry = new THREE.ConeGeometry(1, 4.4, 5, 1);
  geometry.translate(0, 2.2, 0);
  const trees = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x1d1830, flatShading: true, roughness: 1, envMapIntensity: 0.1 }), count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 30; tries++) {
    const turn = random() * Math.PI * 2;
    const d = 26 + random() ** 1.4 * 190;
    const x = Math.cos(turn) * d;
    const z = Math.sin(turn) * d;
    const y = heightAt(x, z);
    if (y > 40 || fbm(x * 0.03 + 20, z * 0.03) < 0.46) continue;
    if (Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) + Math.abs(heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) > 3.4) continue;
    if (flight.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 110) || inSight(x, z)) continue;
    const size = 0.75 + random() * 0.95;
    dummy.position.set(x, y - 0.2, z);
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(size, size * (0.9 + random() * 0.5), size);
    dummy.updateMatrix();
    trees.setMatrixAt(placed++, dummy.matrix);
  }
  trees.count = placed;
  return trees;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function fadeUpTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 128, 0, 0);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
}

function cabinetMaterial(map, lights) {
  const material = new THREE.MeshStandardMaterial({ map, color: 0xb4b2bd, roughness: 0.5, metalness: 0.7, envMapIntensity: 0.5 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lights);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAt;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvAt = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vAt;
        uniform float uWake;
        uniform float uTime;
        uniform vec3 uStrip;
        uniform vec3 uGreen;
        uniform vec3 uAmber;
        float flicker(float cell, float tick) { return fract(sin(cell * 12.9898 + tick * 78.233) * 43758.5453); }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 texel = sampledDiffuseColor.rgb;
        float rise = (vAt.y - (${MODEL.foot})) / ${(MODEL.top - MODEL.foot).toFixed(3)};
        float status = step(vAt.x, 0.02) * step(0.2, vAt.z) * step(rise, 0.98);
        float teal = smoothstep(0.03, 0.2, min(texel.g, texel.b) - texel.r);
        float core = status * smoothstep(0.35, 0.7, min(texel.r, min(texel.g, texel.b)));
        float glow = max(teal * max(texel.g, texel.b), core);
        diffuseColor.rgb *= 1.0 - max(teal, core) * 0.92;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float column = floor(vAt.x * 80.0);
        float cell = floor(rise * 48.0) * 7.3 + column * 3.1;
        float kind = mod(column, 3.0);
        vec3 led = kind < 0.5 ? uGreen : kind < 1.5 ? uGreen * step(0.45, flicker(cell, floor(uTime * 9.0))) : uAmber * step(0.82, flicker(cell, floor(uTime * 1.3)));
        totalEmissiveRadiance += glow * mix(uStrip, led * 3.0 * step(rise, uWake), status);`,
      );
  };
  return material;
}

function buildServer() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x2c273b, flatShading: true, roughness: 0.9, envMapIntensity: 0.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 9, 0.7, 8), stone);
  base.position.y = 0.35;
  const step = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, PLINTH - 0.7, 8), stone);
  step.position.y = 0.7 + (PLINTH - 0.7) / 2;
  group.add(base, step);

  const { w, h, d } = RACK;
  const cabinet = new THREE.Mesh(
    roundedBox(w, h, d, 0.2, 0.08),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1723, roughness: 0.4, metalness: 0.75, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.45 }),
  );
  cabinet.position.y = PLINTH + h / 2;
  group.add(cabinet);

  const lights = {
    uWake: { value: 0 },
    uTime: { value: 0 },
    uStrip: { value: new THREE.Color() },
    uGreen: { value: new THREE.Color(GREEN) },
    uAmber: { value: new THREE.Color(AMBER) },
  };
  loadModel(MODEL.url)
    .then(({ geometry, map }) => {
      map.anisotropy = 8;
      const model = new THREE.Mesh(geometry, cabinetMaterial(map, lights));
      const scale = h / (MODEL.top - MODEL.foot);
      model.scale.setScalar(scale);
      model.position.y = PLINTH - MODEL.foot * scale;
      group.remove(cabinet);
      cabinet.geometry.dispose();
      cabinet.material.dispose();
      group.add(model);
    })
    .catch((err) => console.warn("[nyqo] server model off", err));

  const { group: mark, pieces } = buildMark();
  assemble(pieces, () => 1);
  mark.scale.setScalar(0.0082);
  mark.position.y = MARK_Y;
  group.add(mark);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 150, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: VIOLET_TEXT, alphaMap: fadeUpTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }),
  );
  beam.position.y = MARK_Y + 1.5 + 75;
  group.add(beam);

  return { group, mark, lights, beam };
}

function buildCables(random) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x0b0911, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.3 });
  const curves = [0.32, 1.62, 2.75, 3.95, 5.25].map((turn, i) => {
    const points = [];
    for (let d = 5.4; d < 236; d += 11) {
      const a = turn + Math.sin(d * 0.028 + i * 2.1) * 0.16 * smooth(6, 60, d) + (random() - 0.5) * 0.02;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      points.push(new THREE.Vector3(x, Math.max(heightAt(x, z), d < 9 * TOWER ? KNOLL + 0.7 * TOWER : 0) + 0.2, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 190, 0.17, 5), material));
    return curve;
  });
  return { group, curves };
}

function buildFilm(renderer) {
  const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const picture = new THREE.WebGLRenderTarget(2, 2, { type, samples: coarsePointer ? 2 : 4 });
  const mips = Array.from({ length: 5 }, () => new THREE.WebGLRenderTarget(2, 2, { type, depthBuffer: false }));
  const vertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const pass = (fragmentShader, uniforms, options) => new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...options });
  const taps = `
    varying vec2 vUv;
    uniform sampler2D map;
    uniform vec2 texel;
    vec3 soft() {
      return (texture2D(map, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(map, vUv + texel * vec2(1.0, -1.0)).rgb +
        texture2D(map, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(map, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.25;
    }`;
  const down = pass(
    `${taps}
    uniform float cut;
    void main() {
      vec3 c = min(soft(), vec3(6.0));
      if (cut > 0.0) c *= smoothstep(cut, cut + 0.9, max(c.r, max(c.g, c.b)));
      gl_FragColor = vec4(c, 1.0);
    }`,
    { map: { value: null }, texel: { value: new THREE.Vector2() }, cut: { value: 0 } },
  );
  const up = pass(`${taps} void main() { gl_FragColor = vec4(soft(), 1.0); }`, { map: { value: null }, texel: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending });
  const print = pass(
    `varying vec2 vUv;
    uniform sampler2D map;
    uniform sampler2D bloom;
    uniform float time;
    uniform float rush;
    void main() {
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      vec2 fringe = d * r * (0.004 + rush * 0.02);
      vec3 c = vec3(texture2D(map, vUv - fringe).r, texture2D(map, vUv).g, texture2D(map, vUv + fringe).b);
      c += texture2D(bloom, vUv).rgb * 0.16;
      c *= 1.0 - smoothstep(0.1, 0.62, r) * 0.6;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      float grain = fract(sin(dot(gl_FragCoord.xy + fract(time) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      gl_FragColor.rgb += grain * 0.028;
    }`,
    { map: { value: picture.texture }, bloom: { value: mips[0].texture }, time: { value: 0 }, rush: { value: 0 } },
  );
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), down);
  screen.frustumCulled = false;
  const stage = new THREE.Scene();
  stage.add(screen);
  const flat = new THREE.Camera();
  const size = new THREE.Vector2();
  const draw = (material, target) => {
    screen.material = material;
    renderer.setRenderTarget(target);
    renderer.render(stage, flat);
  };

  return (scene, camera, time, rush) => {
    renderer.getDrawingBufferSize(size);
    if (picture.width !== size.x || picture.height !== size.y) {
      picture.setSize(size.x, size.y);
      mips.forEach((mip, i) => mip.setSize(Math.max(1, size.x >> (i + 1)), Math.max(1, size.y >> (i + 1))));
    }
    renderer.setRenderTarget(picture);
    renderer.render(scene, camera);
    let source = picture;
    mips.forEach((mip, i) => {
      down.uniforms.map.value = source.texture;
      down.uniforms.texel.value.set(1 / source.width, 1 / source.height);
      down.uniforms.cut.value = i === 0 ? (hdr ? 1 : 0.8) : 0;
      draw(down, mip);
      source = mip;
    });
    renderer.autoClear = false;
    for (let i = mips.length - 2; i >= 0; i--) {
      up.uniforms.map.value = mips[i + 1].texture;
      up.uniforms.texel.value.set(1 / mips[i + 1].width, 1 / mips[i + 1].height);
      draw(up, mips[i]);
    }
    renderer.autoClear = true;
    print.uniforms.time.value = time;
    print.uniforms.rush.value = rush;
    draw(print, null);
  };
}

export async function mountWorld(host) {
  const view = host.querySelector("[data-world-view]");
  const random = seeded(20261);
  const renderer = createRenderer(view, { maxDpr: 1.5 });
  const film = buildFilm(renderer);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.fog = new THREE.FogExp2(HAZE, 0.0046);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1200);

  scene.add(buildSky(), buildStars(random, coarsePointer ? 500 : 900));
  scene.add(new THREE.HemisphereLight(0x7a66c0, GROUND, 1.25));
  const moon = new THREE.DirectionalLight(0xd9d4ff, 3.4);
  moon.position.copy(MOON).multiplyScalar(300);
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0x8f86d8, 0.7);
  fill.position.set(-150, 170, 120);
  scene.add(fill);
  const side = new THREE.DirectionalLight(VIOLET, 1.4);
  side.position.set(200, 40, 40);
  scene.add(side);

  const terrain = buildTerrain(coarsePointer ? 150 : 210);
  scene.add(terrain.mesh);

  const positions = new THREE.CatmullRomCurve3(STOPS.map(([p]) => new THREE.Vector3(...p)));
  const targets = new THREE.CatmullRomCurve3(STOPS.map(([, t]) => new THREE.Vector3(...t)));
  scene.add(buildTrees(random, coarsePointer ? 320 : 620, positions.getPoints(60)));

  const server = buildServer();
  server.group.position.y = KNOLL;
  server.group.scale.setScalar(TOWER);
  scene.add(server.group);
  const lamp = new THREE.PointLight(VIOLET, 260, 90, 1.8);
  lamp.position.set(0, KNOLL + 7.5, 10);
  scene.add(lamp);

  const cables = buildCables(random);
  scene.add(cables.group);

  const perCable = 4;
  const packetCount = cables.curves.length * perCable;
  const packets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET_TEXT).multiplyScalar(3), toneMapped: false }), packetCount);
  scene.add(packets);
  const glowPositions = new Float32Array((packetCount + 1) * 3);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.BufferAttribute(glowPositions, 3));
  const glows = new THREE.Points(
    glowGeometry,
    new THREE.PointsMaterial({ map: glowTexture(), color: VIOLET, size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glows.frustumCulled = false;
  scene.add(glows);

  const moteCount = coarsePointer ? 140 : 320;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const turn = random() * Math.PI * 2;
    const d = 6 + random() ** 0.7 * 90;
    motePositions.set([Math.cos(turn) * d, KNOLL + 1 + random() * 26, Math.sin(turn) * d], i * 3);
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xcdb8ff, size: 0.42, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(motes);

  const copy = host.querySelector(".hero-copy");
  const beats = [...host.querySelectorAll("[data-beat]")].map((el) => {
    const [from, to] = el.dataset.beat.split(" ").map(Number);
    return { el, from, to };
  });

  const pointer = trackPointer();
  const dummy = new THREE.Object3D();
  const spot = new THREE.Vector3();
  const look = new THREE.Vector3();
  const stripLit = new THREE.Color(VIOLET_TEXT);
  const heading = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  let flown = -1;
  let rush = 0;
  let last = 0;

  const frame = (now) => {
    const t = now / 1000;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    pointer.step();

    const rect = host.getBoundingClientRect();
    const scroll = clamp01(-rect.top / Math.max(1, rect.height - innerHeight));
    flown = flown < 0 ? scroll : flown + (scroll - flown) * (1 - Math.exp(-dt * 4));
    rush += (Math.min(1, Math.abs(scroll - flown) * 7) - rush) * (1 - Math.exp(-dt * 6));
    host.style.setProperty("--flown", scroll.toFixed(3));
    copy.inert = scroll > 0.14;
    for (const beat of beats) beat.el.classList.toggle("is-on", scroll >= beat.from && scroll < beat.to);

    positions.getPoint(flown, spot);
    targets.getPoint(flown, look);
    const loose = 1 - flown * 0.75;
    spot.x += (Math.sin(t * 0.21) * 1.6 + pointer.x * 3.2) * loose;
    spot.y += (Math.sin(t * 0.17 + 1) * 0.9 - pointer.y * 1.6) * loose;
    spot.y = Math.max(spot.y, heightAt(spot.x, spot.z) + 2.6);
    camera.position.copy(spot);
    camera.lookAt(look);
    positions.getTangent(flown, heading);
    positions.getTangent(Math.min(1, flown + 0.04), ahead);
    const turn = heading.x * ahead.z - heading.z * ahead.x;
    camera.rotateZ(Math.max(-0.07, Math.min(0.07, turn * 1.7)) * (1 - smooth(0.6, 0.9, flown)));
    const tall = compact.matches;
    const through = smooth(0.1, 0.4, flown) * (1 - smooth(0.5, 0.85, flown));
    const settled = smooth(0.7, 1, flown);
    camera.fov = (tall ? 58 : 42) + through * 10 + settled * 2 + rush * 5;
    const { width, height } = renderer.domElement;
    const aside = 1 - smooth(0.04, 0.3, flown);
    camera.setViewOffset(width, height, tall ? 0 : -width * (0.2 * aside + 0.08 * settled), tall ? -height * 0.2 * aside : height * 0.03 * aside, width, height);

    terrain.uniforms.uTime.value = t;

    const wake = smooth(0.3, 0.74, flown) * 1.08;
    server.lights.uWake.value = wake;
    server.lights.uTime.value = t;
    server.mark.rotation.y = Math.atan2(camera.position.x, camera.position.z) + Math.sin(t * 0.6) * 0.5;
    server.mark.position.y = MARK_Y + Math.sin(t * 0.9) * 0.14;
    const power = Math.min(1, wake);
    server.lights.uStrip.value.copy(stripLit).multiplyScalar(0.35 + power * 2.6);
    server.beam.material.opacity = 0.16 + power * 0.5;
    server.beam.scale.x = server.beam.scale.z = 1 + power * 1.6;
    lamp.intensity = 240 + power * 320 + Math.sin(t * 2.2) * 20;

    cables.curves.forEach((curve, c) => {
      const inbound = c % 2 === 0;
      for (let i = 0; i < perCable; i++) {
        const index = c * perCable + i;
        const along = (t * (0.035 + c * 0.004) + i / perCable + c * 0.13) % 1;
        curve.getPointAt((inbound ? 1 - along : along) * 0.62, spot);
        dummy.position.set(spot.x, spot.y + 0.45, spot.z);
        dummy.rotation.set(t * 1.1 + index, t * 0.8, 0);
        dummy.updateMatrix();
        packets.setMatrixAt(index, dummy.matrix);
        glowPositions.set([spot.x, spot.y + 0.45, spot.z], index * 3);
      }
    });
    glowPositions.set([0, KNOLL + MARK_Y * TOWER, 0], packetCount * 3);
    packets.instanceMatrix.needsUpdate = true;
    glowGeometry.attributes.position.needsUpdate = true;
    motes.rotation.y = t * 0.012;

    film(scene, camera, t, rush);
  };

  runScene(host, renderer, camera, frame, () => host.classList.add("is-3d"));
}
