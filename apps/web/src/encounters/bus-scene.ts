import * as Phaser from "phaser";
import { GROUPS, MODULES, type BusState, type GroupId, type ModuleId } from "./bus-contention";

/**
 * Bus Contention's canvas: Figure 3.16 drawn live (Stallings ch. 3, §3.4), in
 * Phaser (GAME-DESIGN.md §10.3, stage 03: "the shared bus visibly constricting
 * is the lesson").
 *
 * This module is the ONLY importer of `phaser` in apps/web, and it is itself
 * imported only by `BusContention` through a dynamic import, so Phaser rides
 * in a chunk requested on moon 03.9 and nowhere else (§10.2; `dist/index.html`
 * is grepped for it by the encounter's spec).
 *
 * It PRESENTS the model and decides nothing: the state comes from
 * `bus-contention.ts`, every control is a DOM button beside it, and the canvas
 * is aria-hidden. A click on a module or a tap point (a DOM listener, not
 * Phaser input) is a shortcut to the same
 * handler a button calls. Colours are the page's tokens, resolved at run time
 * (no literal colour lives here); motion is one packet crossing the data lines
 * per cycle, and none under `prefers-reduced-motion`.
 */

export interface BusView {
  update(state: BusState): void;
  destroy(): void;
}

export interface BusSceneOptions {
  reduced: boolean;
  onModule(id: ModuleId): void;
  onTap(id: ModuleId, group: GroupId): void;
}

const H = 264;
const LINE_Y: Record<GroupId, number> = { control: 158, address: 194, data: 234 };
const BOX = { top: 46, h: 46 };
const TAP_DX: Record<GroupId, number> = { data: -12, address: 0, control: 12 };

/** A CSS colour (any syntax the browser knows, OKLCH included) as 0xRRGGBB. */
function toNumber(css: string): number {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d");
  if (!x) return 0;
  x.fillStyle = css;
  x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0);
}

function palette(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    ink: toNumber(v("--ink")),
    inkCss: v("--ink"),
    muted: toNumber(v("--ink-muted")),
    mutedCss: v("--ink-muted"),
    line: toNumber(v("--line-strong") || v("--line")),
    surface: toNumber(v("--surface-2")),
    surfaceCss: v("--surface-2"),
    accent: toNumber(v("--accent")),
    mono: v("--font-mono") || "monospace",
    hud: v("--font-hud") || v("--font-mono") || "monospace",
  };
}

/** Data lines drawn thicker as the bus widens: 8 lines thin, 64 thick. */
const dataThickness = (width: number) => Math.max(2, Math.round(Math.log2(width) * 2) - 3);

class BusScene extends Phaser.Scene {
  private state: BusState | null = null;
  private layer!: Phaser.GameObjects.Container;
  private shownCycle = -1;
  constructor(
    private readonly host: HTMLElement,
    private readonly opts: BusSceneOptions,
    private readonly ready: () => void,
  ) {
    super("bus");
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.scale.on("resize", () => this.draw(false));
    this.ready();
  }

  show(state: BusState): void {
    const fresh = state.cycle !== this.shownCycle && state.last !== null;
    this.state = state;
    this.shownCycle = state.cycle;
    this.draw(fresh && !this.opts.reduced);
  }

  private columns(): Record<ModuleId, { x: number; w: number }> {
    const W = this.scale.width;
    const pad = 12;
    const gap = Math.max(8, Math.min(28, W * 0.03));
    const w = Math.min(132, (W - pad * 2 - gap * (MODULES.length - 1)) / MODULES.length);
    const total = w * MODULES.length + gap * (MODULES.length - 1);
    const left = (W - total) / 2;
    const out = {} as Record<ModuleId, { x: number; w: number }>;
    MODULES.forEach((m, i) => (out[m.id] = { x: left + i * (w + gap), w }));
    return out;
  }

  /** A click at canvas coordinates: a module raises a request, a tap point toggles its wire. */
  hit(px: number, py: number): void {
    if (!this.state) return;
    const cols = this.columns();
    for (const m of MODULES) {
      const c = cols[m.id];
      if (px < c.x || px > c.x + c.w) continue;
      if (py >= BOX.top - 22 && py <= BOX.top + BOX.h) return this.opts.onModule(m.id);
      for (const g of GROUPS) if (Math.abs(py - LINE_Y[g.id]) <= 14) return this.opts.onTap(m.id, g.id);
    }
  }

  private draw(animate: boolean): void {
    const s = this.state;
    if (!s || !this.layer) return;
    this.layer.removeAll(true);
    this.tweens.killAll();
    const p = palette(this.host);
    const W = this.scale.width;
    const cols = this.columns();
    const g = this.add.graphics();
    this.layer.add(g);
    const last = s.last;
    const transmitting = new Set(last?.transmitters ?? []);
    const small = W < 480;

    // The three groups of lines, the full width of the bus.
    for (const grp of GROUPS) {
      const y = LINE_Y[grp.id];
      const t = grp.id === "data" ? dataThickness(s.width) : 3;
      g.fillStyle(p.ink, 1).fillRect(8, y - t / 2, W - 16, t);
      const label = this.add.text(10, y - t / 2 - 17, grp.name.toUpperCase(), {
        fontFamily: p.hud,
        fontSize: small ? "10px" : "11px",
        color: p.inkCss,
        // A chip behind the name: tap wires cross it at a phone's width.
        backgroundColor: p.surfaceCss,
        padding: { x: 3, y: 1 },
        resolution: window.devicePixelRatio || 1,
      });
      this.layer.add(label);
    }

    for (const m of MODULES) {
      const c = cols[m.id];
      const cx = c.x + c.w / 2;
      const on = s.wired[m.id];
      // Taps: one per group this module is wired to.
      for (const grp of GROUPS) {
        const x = cx + TAP_DX[grp.id];
        if (on.includes(grp.id)) {
          g.lineStyle(2, p.ink, 1).lineBetween(x, BOX.top + BOX.h, x, LINE_Y[grp.id]);
          g.fillStyle(p.ink, 1).fillCircle(x, LINE_Y[grp.id], 4);
        } else {
          g.lineStyle(1, p.muted, 1).strokeCircle(x, LINE_Y[grp.id], 4);
        }
      }
      // The module.
      const active = transmitting.has(m.id);
      g.fillStyle(p.surface, 1).fillRect(c.x, BOX.top, c.w, BOX.h);
      g.lineStyle(active ? 4 : 2, active ? p.accent : p.ink, 1).strokeRect(c.x, BOX.top, c.w, BOX.h);
      const name = this.add
        .text(cx, BOX.top + BOX.h / 2, small ? m.short : m.name, {
          fontFamily: p.hud,
          fontSize: small ? "11px" : "13px",
          color: p.inkCss,
          align: "center",
          wordWrap: { width: c.w - 8 },
          resolution: window.devicePixelRatio || 1,
        })
        .setOrigin(0.5);
      this.layer.add(name);
      // Riders: each raised request waits above its module, as passengers wait at a stop.
      const pending = s.queue.filter((q) => q.id === m.id).length;
      for (let i = 0; i < pending; i++) {
        g.fillStyle(p.ink, 1).fillRect(c.x + 4 + i * 14, BOX.top - 16, 10, 10);
      }
    }

    if (!last || last.transmitters.length === 0) return;
    const y = LINE_Y.data;
    const memX = cols.mem.x + cols.mem.w / 2;
    if (last.garbled) {
      // Overlapping signals: a jagged trace between the transmitters, no packet arrives.
      const xs = last.transmitters.map((id) => cols[id].x + cols[id].w / 2).concat(memX);
      const a = Math.min(...xs);
      const b = Math.max(...xs);
      g.lineStyle(3, p.muted, 1).beginPath();
      g.moveTo(a, y);
      for (let x = a, up = true; x <= b; x += 8, up = !up) g.lineTo(x, y + (up ? -9 : 9));
      g.strokePath();
      const t = this.add
        .text((a + b) / 2, y + 12, "garbled", { fontFamily: p.mono, fontSize: "12px", color: p.inkCss, resolution: window.devicePixelRatio || 1 })
        .setOrigin(0.5, 0);
      this.layer.add(t);
      return;
    }
    const from = last.transmitters[0]!;
    const fromX = cols[from].x + cols[from].w / 2;
    // A read comes FROM memory TO the processor; a DMA write goes from the I/O module to memory.
    const [x0, x1] = from === "cpu" ? [memX, fromX] : [fromX, memX];
    const packet = this.add.rectangle(animate ? x0 : (x0 + x1) / 2, y, 18, 12, p.accent).setStrokeStyle(2, p.ink);
    this.layer.add(packet);
    if (animate) {
      this.host.dataset.tweens = String(Number(this.host.dataset.tweens ?? "0") + 1);
      this.tweens.add({ targets: packet, x: x1, duration: 420, ease: "Sine.easeInOut" });
    }
  }
}

/** Starts the canvas in `el`; resolves once the scene can draw. */
export function mountBusScene(el: HTMLElement, opts: BusSceneOptions): Promise<BusView> {
  return new Promise((resolve, reject) => {
    let scene: BusScene | null = null;
    let game: Phaser.Game | null = null;
    const width = Math.max(200, Math.floor(el.clientWidth));
    try {
      scene = new BusScene(el, opts, () => {
        const ro = new ResizeObserver(() => game?.scale.resize(Math.max(200, Math.floor(el.clientWidth)), H));
        ro.observe(el);
        // Measured at the moment of the click, never cached: the page above the
        // canvas settles after the scene boots, and Phaser's own input keeps the
        // position it measured then, so its clicks landed off the drawing.
        const click = (e: MouseEvent) => {
          const c = el.querySelector("canvas");
          if (!c || !scene) return;
          const r = c.getBoundingClientRect();
          scene.hit(((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height);
        };
        el.addEventListener("click", click);
        resolve({
          update: (s) => scene?.show(s),
          destroy: () => {
            ro.disconnect();
            el.removeEventListener("click", click);
            game?.destroy(true);
            game = null;
            scene = null;
          },
        });
      });
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: el,
        width,
        height: H,
        transparent: true,
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.NONE },
        input: { keyboard: false, mouse: false, touch: false, gamepad: false },
        scene: [scene],
      });
    } catch (e) {
      reject(e);
    }
  });
}
