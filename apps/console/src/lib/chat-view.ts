import type { Avatar, ChatMessage } from "@octa/contracts";

/**
 * Pure helpers for the console chat's Messenger shape (9 Oct 2026;
 * design/templates/console/chat/SPEC.md "As remade"), the same two the student
 * app's chat has (`apps/web/src/pages/ChatPage.tsx`).
 */

/** A room's face: a generated planet seeded from its id (cosmetic, like every avatar's seed). */
export function roomFace(id: string): Avatar {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { url: null, hue: h % 360, variant: (h >>> 9) % 4, removable: false };
}

/** Same author, within five minutes, nothing deleted between: a run, drawn as one speaker. */
export function continues(prev: ChatMessage | undefined, m: ChatMessage): boolean {
  return (
    !!prev &&
    !prev.deleted &&
    !m.deleted &&
    prev.author.id === m.author.id &&
    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
  );
}

/** The page is two screens (rooms, then one room) below this much of its own width: 52rem. */
export const TWO_PANES_PX = 832;
