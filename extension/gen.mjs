import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname, fileURLToPath } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeU32BE(buf, val, pos) {
  buf[pos] = (val >>> 24) & 0xff;
  buf[pos + 1] = (val >>> 16) & 0xff;
  buf[pos + 2] = (val >>> 8) & 0xff;
  buf[pos + 3] = val & 0xff;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  writeU32BE(len, data.length, 0);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  writeU32BE(c, crc32(td), 0);
  return Buffer.concat([len, td, c]);
}

function createPNG(size) {
  const w = size, h = size;
  const raw = Buffer.alloc(h * (1 + w * 4));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const d = Math.sqrt((x - w / 2 + 0.5) ** 2 + (y - h / 2 + 0.5) ** 2);
      if (d < size * 0.42) { raw[o++] = 240; raw[o++] = 192; raw[o++] = 64; raw[o++] = 255; }
      else { raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; }
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, w, 0); writeU32BE(ihdr, h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', deflateSync(raw)), makeChunk('IEND', Buffer.alloc(0))]);
}

const dir = join(__dirname, 'icons');
mkdirSync(dir, { recursive: true });
for (const s of [16, 48, 128]) {
  const p = join(dir, `icon${s}.png`);
  writeFileSync(p, createPNG(s));
  console.log(`Created ${p}`);
}
