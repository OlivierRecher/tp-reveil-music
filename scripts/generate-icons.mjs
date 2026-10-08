// Génère les icônes PNG de la PWA (192 et 512 px) sans dépendance : PNG RGB écrit avec node:zlib.
// Motif : soleil levant (disque ambré) sur fond sombre, contenu dans la zone sûre « maskable »
// (cercle central de 80 %). Usage : node scripts/generate-icons.mjs
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const BACKGROUND = [0x1f, 0x29, 0x37];
const SUN = [0xfb, 0xbf, 0x24];
const HORIZON = [0x93, 0xc5, 0xfd];

function pixel(x, y, size) {
  const cx = size / 2;
  const horizonY = size * 0.62;
  const band = size * 0.035;
  if (Math.abs(y - horizonY) <= band / 2 && Math.abs(x - cx) <= size * 0.3) return HORIZON;
  const dx = x - cx;
  const dy = y - horizonY;
  if (y < horizonY - band / 2 && Math.hypot(dx, dy) <= size * 0.24) return SUN;
  return BACKGROUND;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits par canal
  header[9] = 2; // RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1); // octet de filtre 0 en tête de ligne
    for (let x = 0; x < size; x++) raw.set(pixel(x + 0.5, y + 0.5, size), row + 1 + x * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const target = new URL(`../apps/web/public/icon-${size}.png`, import.meta.url);
  writeFileSync(target, png(size));
  console.log(`icône écrite : ${target.pathname}`);
}
