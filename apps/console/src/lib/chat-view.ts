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

/**
 * "Active now" or when a colleague was last seen, in words (T2). Staff about staff only: the server sends
 * no such fact about a student, so there is nothing here that could be shown for one.
 */
export function presenceWords(p: { active?: boolean | undefined; seenAt?: string | null | undefined } | null | undefined, now = Date.now()): string {
  if (!p) return "";
  if (p.active) return "Active now";
  if (!p.seenAt) return "Not seen yet";
  const min = Math.max(0, Math.round((now - Date.parse(p.seenAt)) / 60_000));
  if (min < 60) return `Last seen ${min < 2 ? "a minute" : `${min} min`} ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `Last seen ${h} h ago`;
  return `Last seen ${Math.round(h / 24)} days ago`;
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
