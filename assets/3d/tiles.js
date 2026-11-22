// Squad tiles as solid cards. The faces are painted on a canvas the same way the page draws them:
// one flat colour, one motif, the name in caps.
import { THREE, roundedBox } from "./kit.js?v=20261115";

export const SQUADS = [
  { name: "Midnight Squad", color: "#1358b4", motif: "letter", light: true },
  { name: "Sunday Raid", color: "#ff6b3d", motif: "peaks" },
  { name: "Ranked Crew", color: "#9b7bff", motif: "dots" },
  { name: "Speedrun Club", color: "#2dd4bf", motif: "rings" },
  { name: "LAN Basement", color: "#f2d43a", motif: "stripes" },
  { name: "Lo-Fi Lounge", color: "#2fa7ff", motif: "zigzag" },
  { name: "The Respawns", color: "#ff5d8f", motif: "rings" },
  { name: "Co-op Night", color: "#ff9b45", motif: "letter" },
];

const DARK = "rgba(0,0,0,0.22)";
const LIGHT = "rgba(255,255,255,0.28)";

const MOTIFS = {
  letter(ctx, squad) {
    ctx.font = '400 260px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = DARK;
    ctx.fillText(squad.name[0], 196, 222);
    ctx.textAlign = "start";
  },
  peaks(ctx) {
    ctx.fillStyle = DARK;
    ctx.beginPath();
    for (const [x, y] of [[0, 169], [90, 70], [140, 120], [210, 30], [300, 169]]) ctx.lineTo(x, y);
    ctx.fill();
    ctx.fillStyle = LIGHT;
    ctx.beginPath();
    ctx.arc(235, 40, 16, 0, Math.PI * 2);
    ctx.fill();
  },
  dots(ctx) {
    ctx.fillStyle = DARK;
    for (let x = 132; x < 300; x += 24) {
      for (let y = 12; y < 169; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  rings(ctx) {
    const ring = (r, width, style) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(240, 130, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(110, 18, DARK);
    ring(64, 14, LIGHT);
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.arc(240, 130, 22, 0, Math.PI * 2);
    ctx.fill();
  },
  stripes(ctx) {
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 14;
    for (let x = -170; x < 300; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 169);
      ctx.lineTo(x + 169, 0);
      ctx.stroke();
    }
  },
  zigzag(ctx) {
    const line = (y, width, style) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(-10 + i * 50, y - (i % 2) * 50);
      ctx.stroke();
    };
    line(150, 22, DARK);
    line(90, 10, LIGHT);
  },
};

/** Resolves once the display face can be drawn on a canvas, or shortly after if it never arrives. */
export function displayFontReady() {
  return Promise.race([document.fonts.load('400 34px "Bebas Neue"'), new Promise((done) => setTimeout(done, 1500))]);
}

function paint(squad) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 338;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = squad.color;
  ctx.fillRect(0, 0, 300, 169);
  MOTIFS[squad.motif](ctx, squad);
  ctx.font = '400 34px "Bebas Neue", Impact, sans-serif';
  ctx.letterSpacing = "1px";
  ctx.textBaseline = "top";
  ctx.fillStyle = squad.light ? "#fff" : "#0c0a12";
  ctx.fillText(squad.name.toUpperCase(), 16, 15);
  return canvas;
}

/** A tile `width` units wide in the page's 300:169 shape, face painted, edges in a darker tone. */
export function buildTile(squad, width, anisotropy = 4) {
  const height = (width * 169) / 300;
  const texture = new THREE.CanvasTexture(paint(squad));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  // The extruded caps carry raw x/y as UVs, so the texture is stretched over the tile's extent.
  texture.repeat.set(1 / width, 1 / height);
  texture.offset.set(0.5, 0.5);
  const face = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3, envMapIntensity: 0.55 });
  const edge = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(squad.color).multiplyScalar(0.3), roughness: 0.5 });
  return new THREE.Mesh(roundedBox(width, height, width * 0.06, width * 0.055, 1.2), [face, edge]);
}
