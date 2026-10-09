import { describe, it, expect } from "vitest";
import type { ChatMessage, ChatPerson } from "@octa/contracts";
import { continues, roomFace } from "../src/lib/chat-view";

const msg = (o: Partial<Omit<ChatMessage, "author">> & { author?: Partial<ChatPerson> }): ChatMessage =>
  ({
    id: "m", roomId: "r", createdAt: "2026-10-09T10:00:00.000Z", body: "hi", mentions: [], mine: false,
    deleted: false, attachment: null, attachmentRemoved: false,
    ...o,
    author: { id: "a", name: "A", staff: false, ...o.author },
  }) as ChatMessage;

describe("continues: a run of one speaker", () => {
  it("is false for the first message", () => {
    expect(continues(undefined, msg({}))).toBe(false);
  });
  it("is true for the same author within five minutes", () => {
    expect(continues(msg({}), msg({ createdAt: "2026-10-09T10:04:59.000Z" }))).toBe(true);
  });
  it("breaks at five minutes", () => {
    expect(continues(msg({}), msg({ createdAt: "2026-10-09T10:05:00.000Z" }))).toBe(false);
  });
  it("breaks on another author", () => {
    expect(continues(msg({}), msg({ author: { id: "b" } }))).toBe(false);
  });
  it("breaks on a deleted message, either side", () => {
    expect(continues(msg({ deleted: true }), msg({}))).toBe(false);
    expect(continues(msg({}), msg({ deleted: true }))).toBe(false);
  });
});

describe("roomFace: a planet seeded from the room's id", () => {
  it("is the same for the same id, and has a hue and one of four patterns", () => {
    const a = roomFace("5ec7f1a0-0000-4000-8000-00000000002a");
    expect(roomFace("5ec7f1a0-0000-4000-8000-00000000002a")).toEqual(a);
    expect(a.hue).toBeGreaterThanOrEqual(0);
    expect(a.hue).toBeLessThan(360);
    expect([0, 1, 2, 3]).toContain(a.variant);
    expect(a.url).toBeNull();
    expect(a.removable).toBe(false);
  });
  it("differs between rooms", () => {
    expect(roomFace("aaaa")).not.toEqual(roomFace("bbbb"));
  });
});
