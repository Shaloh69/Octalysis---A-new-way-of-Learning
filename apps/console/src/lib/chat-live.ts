import { useEffect, useRef } from "react";
import { supabase } from "./session";

/**
 * The console's copy of apps/web/src/lib/chat-live.ts (two apps, no shared UI
 * package): keep them in step.
 *
 * Tell a chat page WHEN to read again (docs/CHAT-PLAN.md: "every open chat
 * updates the moment a message is sent").
 *
 * On the deployment: Supabase Realtime, `postgres_changes` on chat_messages.
 * Realtime delivers a row only to a subscriber whose RLS lets them read it
 * (db/addendum-chat.sql, chat_member()), so a student is never told about a
 * room they are not in, and a student with a paper open is told nothing.
 * The event is only a signal: the page reads through the API, which signs the
 * attachments and names the authors.
 *
 * Where there is no Realtime (the local stack has plain Postgres and dev
 * tokens) or the channel fails to join, it polls every five seconds while the
 * tab is visible. "Slightly stale" is the failure mode, never "blank".
 *
 * `filter`: one room's changes (`room_id=eq.<id>`), or null for any room the
 * reader can see (the nav's mention count).
 */
const POLL_MS = 5000;
const JOIN_MS = 10_000;

export function useChatLive(key: string | null, filter: string | null, onChange: () => void, poll = true): void {
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (key === null) return;
    let timer: number | undefined;
    const startPolling = () => {
      if (!poll || timer !== undefined) return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") latest.current();
      }, POLL_MS);
    };

    const client = supabase();
    if (!client) {
      startPolling();
      return () => window.clearInterval(timer);
    }

    let joined = false;
    const channel = client
      .channel(`chat:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", ...(filter ? { filter } : {}) },
        () => latest.current(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          joined = true;
          if (timer !== undefined) {
            window.clearInterval(timer);
            timer = undefined;
          }
          // Anything sent while joining.
          latest.current();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          joined = false;
          startPolling();
        }
      });
    const fallback = window.setTimeout(() => {
      if (!joined) startPolling();
    }, JOIN_MS);

    return () => {
      window.clearTimeout(fallback);
      window.clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [key, filter, poll]);
}
