import { THREE } from "./kit.js?v=20261115";

const ARRAYS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export async function loadModel(url) {
  const base = new URL(url);
  const part = (uri) => Object.assign(new URL(uri, base), { search: base.search });
  const ok = (response) => {
    if (!response.ok) throw new Error(`${response.url}: ${response.status}`);
    return response;
  };
  const gltf = await ok(await fetch(base)).json();
  const [buffer, map] = await Promise.all([
    fetch(part(gltf.buffers[0].uri)).then((response) => ok(response).arrayBuffer()),
    new THREE.TextureLoader().loadAsync(part(gltf.images[0].uri).href),
  ]);

  const attribute = (index) => {
    const accessor = gltf.accessors[index];
    const view = gltf.bufferViews[accessor.bufferView];
    const Type = ARRAYS[accessor.componentType];
    const size = SIZES[accessor.type];
    const stride = view.byteStride ? view.byteStride / Type.BYTES_PER_ELEMENT : size;
    const data = new Type(buffer, (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), accessor.count * stride);
    if (stride === size) return new THREE.BufferAttribute(data, size, accessor.normalized);
    return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(data, stride), size, 0, accessor.normalized);
  };
  const primitive = gltf.meshes[0].primitives[0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", attribute(primitive.attributes.POSITION));
  geometry.setAttribute("normal", attribute(primitive.attributes.NORMAL));
  geometry.setAttribute("uv", attribute(primitive.attributes.TEXCOORD_0));
  geometry.setIndex(attribute(primitive.indices));

  map.flipY = false;
  map.colorSpace = THREE.SRGBColorSpace;
  return { geometry, map };
}
