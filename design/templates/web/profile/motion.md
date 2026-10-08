# `/app/profile` — motion

No page motion of its own. The hover and press eases of `.hud-button` are the
shell's; the toasts are the app's (`lib/toast.ts`).

| What | Motion | Reduced motion |
|---|---|---|
| Choosing, positioning, using, removing | none: the stage and the ring swap, the picture appears | the same |
| The cropper's preview | repainted on a canvas as it is dragged (it follows the pointer; it is not animated) | the same |
| A toast | the app's | the app's |

`web-profile.spec.ts` gate 6 emulates the media feature and records every
animation: none longer than 1 ms.
