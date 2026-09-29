import { inflateSync } from "node:zlib";

/**
 * A minimal PNG reader for the vendored frame sprites: 8-bit RGBA or RGB,
 * non-interlaced, which is what Kenney's pack ships. Enough to read a
 * sprite's edge pixels in a test; not a general decoder, and it throws on
 * anything else rather than returning a wrong picture.
 */
export interface Png {
  readonly width: number;
  readonly height: number;
  /** RGBA, 0-255, row-major. */
  pixel(x: number, y: number): readonly [number, number, number, number];
}

export function readPng(buf: Buffer): Png {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9]!;
      if (depth !== 8 || data[12] !== 0) throw new Error("only 8-bit, non-interlaced PNGs");
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const channels = { 6: 4, 2: 3, 3: 1 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= channels ? out[y * stride + x - channels]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels]! : 0;
      let v: number;
      if (filter === 0) v = cur;
      else if (filter === 1) v = cur + a;
      else if (filter === 2) v = cur + b;
      else if (filter === 3) v = cur + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return {
    width,
    height,
    pixel(x, y) {
      const i = y * stride + x * channels;
      if (colorType === 6) return [out[i]!, out[i + 1]!, out[i + 2]!, out[i + 3]!];
      if (colorType === 2) return [out[i]!, out[i + 1]!, out[i + 2]!, 255];
      const p = out[i]!;
      return [palette![p * 3]!, palette![p * 3 + 1]!, palette![p * 3 + 2]!, trns?.[p] ?? 255];
    },
  };
}
