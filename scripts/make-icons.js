// Generates public/icon-192.png and icon-512.png with Node built-ins only (no dependencies).
const fs = require('fs'), zlib = require('zlib'), path = require('path')
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const m = size * 0.28
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const book = x > m && x < size - m && y > m && y < size - m && Math.abs(x - size / 2) > size * 0.015
      const o = y * (size * 3 + 1) + 1 + x * 3
      const col = book ? [255, 255, 255] : [37, 99, 235]
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const out = path.join(__dirname, '..', 'public')
for (const s of [192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), png(s))
console.log('icons generated')
