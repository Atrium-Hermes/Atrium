// Standalone preview: replicates components/hero-loop.tsx math and rasterizes a
// 5-panel montage (loop phases 0, .25, .5, .75, 1) to PNG using only Node zlib.
// Endpoints (0 and 1) must render the crisp logo; .5 is max scatter.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const LOOP_FRAMES = [0, 0.25, 0.5, 0.75, 1];
const K = 3;
const LOGO = [[0, 0], [2, 0], [0, 1], [1, 1], [1, 2], [2, 2]];
const PANEL = 260, GAP = 12;
const BG = [244, 243, 234], ACCENT = [61, 75, 49]; // light sage / dark olive

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function buildParticles(size) {
  const pitch = size * 0.17, sq = pitch * 0.82, sub = sq / K, c = size / 2;
  const out = []; let gid = 0;
  for (const [col, row] of LOGO) {
    const scx = c + (col - 1) * pitch, scy = c + (row - 1) * pitch;
    for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
      out.push({
        hx: scx + (a - (K - 1) / 2) * sub, hy: scy + (b - (K - 1) / 2) * sub,
        side: sub, r: pitch * (0.4 + 1.0 * hash(gid + 1.7)),
        ang0: hash(gid + 9.3) * Math.PI * 2, spin: (hash(gid + 4.1) - 0.5) * Math.PI * 1.6,
      });
      gid++;
    }
  }
  return out;
}

function drawPanel(px, py, frac, buf, W) {
  const ph = 2 * Math.PI * frac, env = (1 - Math.cos(ph)) / 2;
  for (const p of buildParticles(PANEL)) {
    const ang = p.ang0 + ph;
    const x = p.hx + env * p.r * Math.cos(ang), y = p.hy + env * p.r * Math.sin(ang);
    const s = p.side * (1.06 - 0.42 * env), rot = env * p.spin, alpha = 1 - 0.4 * env;
    const co = Math.cos(rot), si = Math.sin(rot), h = s / 2, reach = Math.ceil(h * 1.5);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const lx = dx * co + dy * si, ly = -dx * si + dy * co;
      if (Math.abs(lx) > h || Math.abs(ly) > h) continue;
      const cx = Math.round(x + dx), cy = Math.round(y + dy);
      if (cx < 0 || cy < 0 || cx >= PANEL || cy >= PANEL) continue;
      const idx = ((py + cy) * W + (px + cx)) * 3;
      for (let k = 0; k < 3; k++) buf[idx + k] = Math.round(buf[idx + k] * (1 - alpha) + ACCENT[k] * alpha);
    }
  }
}

const W = PANEL * 5 + GAP * 4, H = PANEL;
const buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { buf[i * 3] = BG[0]; buf[i * 3 + 1] = BG[1]; buf[i * 3 + 2] = BG[2]; }
LOOP_FRAMES.forEach((f, i) => drawPanel(i * (PANEL + GAP), 0, f, buf, W));

// --- minimal PNG encoder (RGB, no alpha) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type), body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("../../hero-loop-preview.png", import.meta.url), png);
console.log(`wrote hero-loop-preview.png (${W}x${H}) — panels: ph = 0, .25, .5, .75, 1`);
