import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { paintCrop, panned, cropRect, type Crop, type Loaded } from "../lib/avatar-image";

/**
 * The stage a person positions a picture in before it is sent (PROFILES,
 * 8 Oct 2026). Drag the picture, or focus the stage and use the arrow keys;
 * zoom with the slider. What the circle shows is exactly what is encoded:
 * the preview and the encoder paint the same crop rectangle.
 *
 * Every control has a keyboard path (no drag-only interaction), and the
 * stage says how to use it. It owns no buttons: the page decides what
 * "Use this picture" and "Choose another" do.
 *
 * THIS FILE IS IDENTICAL IN apps/web AND apps/console
 * (`apps/web/test/avatar-parity.spec.ts`).
 */

const PREVIEW = 480; // canvas pixels: crisp at 240 CSS px on a 2x screen
const STEP = 0.06; // an arrow key moves the picture by this much of its slack

export function AvatarCropper({
  pic,
  crop,
  onChange,
}: {
  pic: Loaded;
  crop: Crop;
  onChange: (next: Crop) => void;
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const zoomId = useId();

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) paintCrop(ctx, pic, crop, PREVIEW);
  }, [pic, crop]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from) return;
    const width = stage.current?.getBoundingClientRect().width ?? 240;
    onChange(panned(pic.width, pic.height, crop, e.clientX - from.x, e.clientY - from.y, width));
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    drag.current = null;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // The arrow moves the PICTURE that way, as dragging it would.
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    // A key press is a drag worth STEP of the slack, in preview pixels.
    const { side } = cropRect(pic.width, pic.height, crop);
    const perPx = side / PREVIEW;
    const kx = (((pic.width - side) / 2) / perPx) * STEP;
    const ky = (((pic.height - side) / 2) / perPx) * STEP;
    onChange(panned(pic.width, pic.height, crop, d[0] * kx, d[1] * ky, PREVIEW));
  };

  return (
    <div className="avatar-cropper" data-cropper="">
      <div
        ref={stage}
        className="avatar-cropper-stage"
        tabIndex={0}
        role="group"
        aria-label="Position your picture: drag it, or use the arrow keys"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <canvas ref={canvas} width={PREVIEW} height={PREVIEW} aria-hidden="true" />
      </div>
      <div className="avatar-cropper-zoom">
        <label htmlFor={zoomId}>Zoom</label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={crop.zoom}
          onChange={(e) => onChange({ ...crop, zoom: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
