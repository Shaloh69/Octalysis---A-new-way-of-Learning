/**
 * Cropping and encoding a profile picture in the browser (PROFILES, 8 Oct 2026;
 * docs/PROFILES-PLAN.md section 2).
 *
 * The picture is cropped to a square, drawn onto a 512 x 512 canvas and
 * re-encoded as WebP before it leaves the page. Drawing on a canvas drops
 * everything that is not pixels, so a phone photo's EXIF block and its GPS
 * position never reach the server. The server does not take this on trust: it
 * checks the stored file is a WebP of 300 KB or less by its own first bytes.
 *
 * `cropRect` is pure and is what the preview AND the encoder both use, so what
 * a person sees in the circle is exactly what is sent.
 *
 * THIS FILE IS IDENTICAL IN apps/web AND apps/console: there is no shared UI
 * package, and `apps/web/test/avatar-parity.spec.ts` fails if the two differ.
 */

export const AVATAR_SIZE = 512;
export const AVATAR_MAX_BYTES = 300 * 1024;
/** A photo larger than this is refused before it is decoded (a decode of 40 MB of JPEG is a freeze). */
export const AVATAR_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

/** `zoom` is 1 or more (1 = the whole short side); `x` and `y` run -1 to 1 across the slack. */
export interface Crop {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export const NO_CROP: Crop = { zoom: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The square of the source, in source pixels, that a crop shows. */
export function cropRect(width: number, height: number, crop: Crop): { sx: number; sy: number; side: number } {
  const zoom = clamp(crop.zoom, 1, 8);
  const side = Math.min(width, height) / zoom;
  const slackX = width - side;
  const slackY = height - side;
  return {
    sx: (slackX * (clamp(crop.x, -1, 1) + 1)) / 2,
    sy: (slackY * (clamp(crop.y, -1, 1) + 1)) / 2,
    side,
  };
}

/**
 * The crop after dragging the picture by (dx, dy) preview pixels. Dragging the
 * picture right shows more of its left, so the offset moves the other way.
 */
export function panned(width: number, height: number, crop: Crop, dx: number, dy: number, preview: number): Crop {
  const { side } = cropRect(width, height, crop);
  const perPx = side / preview; // source pixels per preview pixel
  const slackX = width - side;
  const slackY = height - side;
  return {
    zoom: crop.zoom,
    x: slackX > 0 ? clamp(crop.x - (dx * perPx) / (slackX / 2), -1, 1) : 0,
    y: slackY > 0 ? clamp(crop.y - (dy * perPx) / (slackY / 2), -1, 1) : 0,
  };
}

export interface Loaded {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

/** Decode a chosen file, honouring the camera's rotation. Throws a sentence a person can act on. */
export async function loadPicture(file: File): Promise<Loaded> {
  if (!file.type.startsWith("image/")) throw new Error("That is not a picture. Choose a PNG, JPEG, WebP or GIF.");
  if (file.size > AVATAR_SOURCE_MAX_BYTES) throw new Error("That picture is too large to open. Choose one under 20 MB.");
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    throw new Error("That picture could not be opened. Choose a PNG, JPEG, WebP or GIF.");
  }
}

/** Paint the crop into any canvas, scaled to it: the preview and the encoder share this. */
export function paintCrop(ctx: CanvasRenderingContext2D, pic: Loaded, crop: Crop, size: number): void {
  const { sx, sy, side } = cropRect(pic.width, pic.height, crop);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(pic.bitmap, sx, sy, side, side, 0, 0, size, size);
}

/** 512 x 512 WebP of 300 KB or less, with no metadata. Lowers the quality until it fits. */
export async function encodeAvatar(pic: Loaded, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare pictures. Try another browser.");
  paintCrop(ctx, pic, crop, AVATAR_SIZE);
  for (const q of [0.9, 0.8, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", q));
    // A browser that cannot encode WebP hands back a PNG: say so rather than send it.
    if (!blob || blob.type !== "image/webp") {
      throw new Error("This browser cannot make WebP pictures. Try Chrome, Edge, Firefox or a recent Safari.");
    }
    if (blob.size <= AVATAR_MAX_BYTES) return blob;
  }
  throw new Error("That picture is too detailed to shrink under 300 KB. Choose a simpler one.");
}
