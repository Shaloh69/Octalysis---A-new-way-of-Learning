# Bus Contention: motion

**One movement, on the canvas only: each bus cycle, the packet crosses the data
lines** from the module that sent it to the one that receives it (memory to the
processor for a read, an I/O module to memory for a direct-memory write), 420 ms,
sine in-out. It is the only thing that moves, and it is the lesson made visible:
one packet, one transmitter, per cycle.

- **`prefers-reduced-motion: reduce`:** no packet travels. It is drawn at the
  middle of its path, still, the moment the cycle is taken. `.bus-stage`
  carries `data-motion="still"`, and the scene never counts a tween.
- **The DOM never animates.** Every control and readout changes in place; the
  wiring, the requests and the cycle report appear at once. No CSS animation or
  transition over 1 ms runs inside the encounter, with or without the setting.
- **Run** takes one cycle every 700 ms until nobody is waiting. That is the
  student choosing time to pass, not an animation, and under reduced motion
  each cycle still lands as a cut.
- **The DOM fallback** (no canvas) has no motion at all.

Nothing here is carried by motion alone: every cycle is printed in the
readouts (control, address, data, who waits) and announced by a polite status.

Asserted: `design/specs/web-encounter-bus.spec.ts`, gate 6 — reduced motion
emulated: `data-motion="still"`, no tween counted after two cycles, no CSS
motion; and the positive control: without it, one cycle counts one tween
(`data-tweens="1"`) and still no CSS motion.
