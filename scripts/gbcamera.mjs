// GB-Camera-ify a spritesheet of portraits: slice cells, upscale, luminance,
// contrast-stretch, 4-shade quantize with Bayer ordered dithering, DMG green
// palette, plus mirrored variants. Pure node (zlib built-in), no deps.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import zlib from 'node:zlib'

const [,, inPath, outDir, cellW, cellH, scale] = process.argv
const CW = Number(cellW), CH = Number(cellH), S = Number(scale || 2)

// ---------- minimal PNG decode ----------
function decodePNG(buf) {
  let off = 8
  let ihdr = null, plte = null, trns = null
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12],
      }
    } else if (type === 'PLTE') plte = data
    else if (type === 'tRNS') trns = data
    else if (type === 'IDAT') idat.push(data)
    off += 12 + len
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported PNG: ' + JSON.stringify(ihdr))
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color]
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = ihdr.w * channels
  const out = Buffer.alloc(ihdr.h * stride)
  let p = 0
  for (let y = 0; y < ihdr.h; y++) {
    const filter = raw[p++]
    for (let x = 0; x < stride; x++) {
      const cur = raw[p++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let v
      if (filter === 0) v = cur
      else if (filter === 1) v = cur + a
      else if (filter === 2) v = cur + b
      else if (filter === 3) v = cur + ((a + b) >> 1)
      else { // Paeth
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      out[y * stride + x] = v & 0xff
    }
  }
  // RGBA getter
  const px = (x, y) => {
    const i = y * stride + x * channels
    if (ihdr.color === 6) return [out[i], out[i + 1], out[i + 2], out[i + 3]]
    if (ihdr.color === 2) return [out[i], out[i + 1], out[i + 2], 255]
    if (ihdr.color === 0) return [out[i], out[i], out[i], 255]
    if (ihdr.color === 4) return [out[i], out[i], out[i], out[i + 1]]
    // indexed
    const idx = out[i]
    const alpha = trns && idx < trns.length ? trns[idx] : 255
    return [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2], alpha]
  }
  return { w: ihdr.w, h: ihdr.h, px }
}

// ---------- minimal PNG encode (RGB, filter 0) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}
function encodePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- GB camera processing ----------
// Classic DMG shades, darkest→lightest.
const PALETTE = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]]
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

function gbify(src, x0, y0, mirror) {
  const W = CW * S, H = CH * S
  // luminance per source pixel; transparent = background (light, like a
  // photo-booth backdrop) with a soft vignette-ish gradient for depth
  const lum = []
  let min = 255, max = 0
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const sx = mirror ? CW - 1 - x : x
      const [r, g, b, a] = src.px(x0 + sx, y0 + y)
      let v
      if (a < 128) v = 235 - y * 1.5 // backdrop
      else v = 0.299 * r + 0.587 * g + 0.114 * b
      lum.push(v)
      if (a >= 128) { min = Math.min(min, v); max = Math.max(max, v) }
    }
  }
  // contrast stretch the subject into most of the range
  const span = Math.max(40, max - min)
  const norm = (v) => Math.max(0, Math.min(255, ((v - min) / span) * 225 + 15))
  const rgb = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = norm(lum[Math.floor(y / S) * CW + Math.floor(x / S)])
      const t = (BAYER[y % 4][x % 4] + 0.5) / 16 // 0..1
      const level = Math.max(0, Math.min(3, Math.floor((v / 255) * 4 + (t - 0.5) * 1.15)))
      const [r, g, b] = PALETTE[level]
      const i = (y * W + x) * 3
      rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b
    }
  }
  return encodePNG(W, H, rgb)
}

const src = decodePNG(readFileSync(inPath))
mkdirSync(outDir, { recursive: true })
const cols = Math.floor(src.w / CW)
const rows = Math.floor(src.h / CH)
let n = 0
for (let ry = 0; ry < rows; ry++) {
  for (let cx = 0; cx < cols; cx++) {
    for (const mirror of [false, true]) {
      const name = `face_${String(n).padStart(2, '0')}.png`
      writeFileSync(`${outDir}/${name}`, gbify(src, cx * CW, ry * CH, mirror))
      n++
    }
  }
}
console.log(`wrote ${n} faces to ${outDir}`)
