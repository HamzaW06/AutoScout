#!/usr/bin/env node
// Run: node generate-icons.js
// Generates placeholder PNG icons for the AutoScout Chrome extension.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  writeU32BE(len, data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crcBuf = Buffer.alloc(4);
  writeU32BE(crcBuf, crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function createPNG(size) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc(height * (1 + width * 4));
  let off = 0;

  for (let y = 0; y < height; y++) {
    raw[off++] = 0; // filter byte: None
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2 + 0.5;
      const dy = y - height / 2 + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = size * 0.42;

      if (dist < radius) {
        // Gold circle (#F0C040)
        raw[off++] = 240;
        raw[off++] = 192;
        raw[off++] = 64;
        raw[off++] = 255;
      } else {
        // Transparent
        raw[off++] = 0;
        raw[off++] = 0;
        raw[off++] = 0;
        raw[off++] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, width, 0);
  writeU32BE(ihdr, height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
}

console.log('Done! Placeholder icons generated.');
