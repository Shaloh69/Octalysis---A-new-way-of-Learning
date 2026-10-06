import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ChatPerson } from "@octa/contracts";
import { api, ApiError, putChatFile, type ChatMessage, type ChatRooms, type ChatThread } from "../lib/api";
import { useChatLive } from "../lib/chat-live";
import { toast } from "../lib/toast";
import { useDelayed } from "../lib/useDelayed";

/**
 * `/app/chat` — the class chat (instructor, approved 6 Oct 2026;
 * docs/CHAT-PLAN.md; design/templates/web/chat/SPEC.md).
 *
 * Two rooms for a student: their section's, and a private thread with the
 * instructor. The controls, against DESIGN-MANDATE.md §1:
 *
 *   Room           which conversation is shown (and its unread count goes)
 *   Message        what the class or the instructor reads; @ names a person
 *                  in the room, who sees a count on their Chat tab
 *   Attach         a screenshot or a short video, 25 MB at most (ruling 2)
 *   Delete         the student's own message: its text is gone for everyone
 *   Earlier        the 100 messages before the first one shown
 *
 * A paper open closes the chat (ruling 3), and the database enforces it: the
 * page only says why. Every read goes through the API; Supabase Realtime only
 * says WHEN (lib/chat-live.ts), with a five-second poll where there is none.
 */

/** Mirrors of CHAT_MAX_BYTES and ChatMime (@octa/contracts), for a message before the
 * upload. Only advice: the API and the bucket refuse anything else whatever this says. */
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"];

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "closed";
      message: string;
      paper: { assessmentId: string; title: string; stageId: string | null; startedAt: string } | null;
    }
  | { state: "ready"; rooms: ChatRooms };

const mb = (n: number) => (n / (1024 * 1024)).toFixed(n < 1024 * 1024 ? 2 : 1);

function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

/** The text with each @Name of someone it mentions picked out (in words and weight, not colour alone). */
function Body({ text, mentioned }: { text: string; mentioned: ChatPerson[] }): JSX.Element {
  const names = mentioned.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{text}</>;
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${esc.join("|")}))`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && names.includes(part.slice(1)) ? (
          <strong key={i} className="chat-at">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Attachment({ m }: { m: ChatMessage }): JSX.Element | null {
  if (m.attachmentRemoved && !m.attachment) {
    return <p className="chat-file-gone">Attachment removed to free storage.</p>;
  }
  const a = m.attachment;
  if (!a) return null;
  if (!a.url) {
    return (
      <p className="chat-file-gone">
        {a.name} could not be fetched just now. It will load with the next message.
      </p>
    );
  }
  const size = <span className="mono">{mb(a.bytes)} MB</span>;
  if (a.mime.startsWith("video/")) {
    return (
      <figure className="chat-file">
        <video className="chat-media" src={a.url} controls preload="metadata" aria-label={`Video: ${a.name}`} />
        <figcaption className="chat-file-cap">
          {a.name} · {size}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="chat-file">
      <a href={a.url} target="_blank" rel="noreferrer" className="chat-media-link">
        <img className="chat-media" src={a.url} alt={`Screenshot: ${a.name}`} loading="lazy" />
      </a>
      <figcaption className="chat-file-cap">
        {a.name} · {size}
      </figcaption>
    </figure>
  );
}

function Message({
  m,
  me,
  members,
  onDelete,
}: {
  m: ChatMessage;
  me: ChatPerson;
  members: Map<string, ChatPerson>;
  onDelete: (m: ChatMessage) => Promise<void>;
}): JSX.Element {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const mentionsMe = m.mentions.includes(me.id);
  const mentioned = m.mentions.map((id) => members.get(id)).filter((p): p is ChatPerson => p !== undefined);
  return (
    <li
      className={`chat-msg${m.mine ? " is-mine" : ""}${mentionsMe ? " is-for-me" : ""}${m.deleted ? " is-deleted" : ""}`}
      data-message={m.id}
    >
      <div className="chat-msg-head">
        <span className="chat-msg-author">{m.mine ? "You" : m.author.name}</span>
        {m.author.staff && <span className="chat-badge">Instructor</span>}
        {mentionsMe && <span className="chat-badge chat-badge-info">Mentions you</span>}
        <time className="chat-msg-time mono" dateTime={m.createdAt}>
          {when(m.createdAt)}
        </time>
      </div>
      {m.deleted ? (
        <p className="chat-msg-gone">Message deleted.</p>
      ) : (
        <>
          {m.body && (
            <p className="chat-msg-body">
              <Body text={m.body} mentioned={mentioned} />
            </p>
          )}
          <Attachment m={m} />
        </>
      )}
      {m.mine && !m.deleted && (
        <div className="chat-msg-tools">
          {asking ? (
            <>
              <span className="chat-msg-ask" role="status">
                Delete it for everyone?
              </span>
              <button
                type="button"
                className="chat-tool"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onDelete(m);
                  setBusy(false);
                  setAsking(false);
                }}
              >
                Delete
              </button>
              <button type="button" className="chat-tool" onClick={() => setAsking(false)}>
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              className="chat-tool"
              aria-label={`Delete your message from ${when(m.createdAt)}`}
              onClick={() => setAsking(true)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** The @ being typed just before the caret, if any. */
function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || /[\n@]/.test(query)) return null;
  return { start: at, query };
}

function Composer({
  thread,
  me,
  attachments,
  onSent,
}: {
  thread: ChatThread;
  me: ChatPerson;
  attachments: boolean;
  onSent: (m: ChatMessage) => void;
}): JSX.Element {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState<null | "uploading" | "sending">(null);
  const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
  const [pick, setPick] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const roomId = thread.room.id;

  // A new room starts with an empty composer.
  useEffect(() => {
    setText("");
    setFile(null);
    setProblem(null);
    setMq(null);
  }, [roomId]);

  const others = thread.members.filter((p) => p.id !== me.id);
  const options = mq
    ? others.filter((p) => p.name.toLowerCase().includes(mq.query.toLowerCase())).slice(0, 6)
    : [];
  const open = options.length > 0;

  const choose = (p: ChatPerson) => {
    if (!mq) return;
    const caret = area.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mq.start)}@${p.name} ${text.slice(caret)}`;
    setText(next);
    setMq(null);
    const at = mq.start + p.name.length + 2;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(at, at);
    });
  };

  const send = async () => {
    const body = text.trim();
    if (!body && !file) {
      setProblem("Write something or attach a file.");
      return;
    }
    setProblem(null);
    try {
      let attachment: { path: string; name: string } | undefined;
      if (file) {
        setSending("uploading");
        const up = await api.chatUpload(roomId, { name: file.name.slice(0, 200), mime: file.type, bytes: file.size });
        await putChatFile(up.uploadUrl, file);
        attachment = { path: up.path, name: file.name.slice(0, 200) };
      }
      setSending("sending");
      // Only the people whose @Name is still in the text.
      const mentions = others.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
      const sent = await api.chatSend(roomId, { ...(body ? { body } : {}), mentions, ...(attachment ? { attachment } : {}) });
      setText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onSent(sent);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not reach the server. Your message is still here; send it again.";
      toast.error("Message not sent", message);
    } finally {
      setSending(null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPick((i) => (i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(options[Math.min(pick, options.length - 1)]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMq(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const listId = `chat-mentions-${roomId}`;
  return (
    <form
      className="chat-compose"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor="chat-text" className="sr-only">
        Message {thread.room.title}
      </label>
      <div className="chat-compose-field">
        {open && (
          <ul className="chat-mentions" id={listId} role="listbox" aria-label="People to mention">
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === pick}
                className="chat-mention-opt"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
              >
                {p.name}
                {p.staff && <span className="chat-badge">Instructor</span>}
              </li>
            ))}
          </ul>
        )}
        <textarea
          id="chat-text"
          ref={area}
          className="field chat-text"
          rows={2}
          maxLength={4000}
          value={text}
          placeholder={
            thread.room.kind === "direct"
              ? "Message your instructor. Only the two of you read this."
              : `Message ${thread.room.title}. Type @ to mention someone.`
          }
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${options[Math.min(pick, options.length - 1)]!.id}` : undefined}
          aria-describedby="chat-compose-hint"
          onChange={(e) => {
            setText(e.target.value);
            setMq(mentionQuery(e.target.value, e.target.selectionStart));
            setPick(0);
          }}
          onKeyDown={onKey}
          onBlur={() => setMq(null)}
        />
      </div>
      {file && (
        <p className="chat-chip">
          <span className="chat-chip-name">{file.name}</span>
          <span className="mono">{mb(file.size)} MB</span>
          <button
            type="button"
            className="chat-tool"
            aria-label={`Remove ${file.name}`}
            onClick={() => {
              setFile(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Remove
          </button>
        </p>
      )}
      {problem && (
        <p className="chat-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="chat-compose-actions">
        <p id="chat-compose-hint" className="chat-compose-hint">
          Enter sends, Shift+Enter starts a new line.
          {!attachments && " Attachments are not available on this server."}
        </p>
        {attachments && (
          <label className="hud-button chat-attach">
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              accept={TYPES.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                if (!TYPES.includes(f.type)) {
                  setProblem("Attach a screenshot (PNG, JPEG, GIF, WebP) or a video (MP4, WebM, MOV).");
                  e.target.value = "";
                  return;
                }
                if (f.size > MAX_BYTES) {
                  setProblem(`That file is ${mb(f.size)} MB; the limit is 25 MB. Trim the video or send a screenshot.`);
                  e.target.value = "";
                  return;
                }
                setProblem(null);
                setFile(f);
              }}
            />
            Attach
          </label>
        )}
        <button type="submit" className="hud-button button-primary chat-send" disabled={sending !== null}>
          {sending === "uploading" ? "Uploading…" : sending === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

export function ChatPage(): JSX.Element {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [more, setMore] = useState(false);
  const [params, setParams] = useSearchParams();
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastSeen = useRef<string | null>(null);
  const shownRoom = useRef<string | null>(null);
  const slow = useDelayed(load.state === "loading", 400);
  const verySlow = useDelayed(load.state === "loading", 3000);

  const rooms = load.state === "ready" ? load.rooms.rooms : [];
  const asked = params.get("room");
  const roomId = rooms.find((r) => r.id === asked)?.id ?? rooms[0]?.id ?? null;

  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.code === "paper_open") {
      setLoad({ state: "closed", message: err.message, paper: null });
      // Which paper, and where it is: "a paper is open" alone left a student
      // guessing (6 Oct 2026, the day the chat shipped).
      void api
        .chatUnread()
        .then((u) => setLoad((l) => (l.state === "closed" ? { ...l, paper: u.paper ?? null } : l)))
        .catch(() => {});
    } else
      setLoad({
        state: "error",
        message: err instanceof ApiError ? err.message : "Could not reach the server. Check your connection and try again.",
      });
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const r = await api.chatRooms();
      setLoad({ state: "ready", rooms: r });
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  const loadThread = useCallback(async () => {
    if (!roomId) return;
    try {
      const t = await api.chatThread(roomId);
      if (shownRoom.current !== t.room.id) {
        shownRoom.current = t.room.id;
        setOlder([]);
        setMore(t.more);
      }
      setThread(t);
      const last = t.messages.at(-1)?.id ?? null;
      if (last !== lastSeen.current && document.visibilityState === "visible") {
        lastSeen.current = last;
        await api.chatRead(roomId).catch(() => {});
        setLoad((l) =>
          l.state === "ready"
            ? { ...l, rooms: { ...l.rooms, rooms: l.rooms.rooms.map((r) => (r.id === roomId ? { ...r, unread: 0, mentions: 0 } : r)) } }
            : l,
        );
      }
    } catch (err) {
      fail(err);
    }
  }, [roomId, fail]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    stick.current = true;
    lastSeen.current = null;
    void loadThread();
  }, [loadThread]);

  // Any room's change: this room's messages, and every room's counts.
  useChatLive(load.state === "ready" ? "page" : null, null, () => {
    void loadThread();
    void api
      .chatRooms()
      .then((r) => setLoad((l) => (l.state === "ready" ? { state: "ready", rooms: r } : l)))
      .catch(fail);
  });

  const messages = useMemo(() => {
    if (!thread) return [];
    const seen = new Set(thread.messages.map((m) => m.id));
    return [...older.filter((m) => !seen.has(m.id)), ...thread.messages];
  }, [older, thread]);

  // Keep the newest message in view while the reader is at the bottom.
  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, thread?.room.id]);

  const members = useMemo(() => new Map((thread?.members ?? []).map((p) => [p.id, p])), [thread]);

  if (load.state === "loading") {
    return (
      <section className="chat" aria-labelledby="chat-title" aria-busy="true">
        <header className="chat-head">
          <h1 id="chat-title" className="chat-title">
            Chat
          </h1>
        </header>
        {slow && (
          <div className="chat-grid" aria-hidden="true">
            <div className="hud-panel chat-rooms">
              <span className="skel skel-line" />
              <span className="skel skel-line" />
            </div>
            <div className="hud-panel chat-room chat-skel">
              <span className="skel skel-line" />
              <span className="skel skel-line" />
              <span className="skel skel-line" />
            </div>
          </div>
        )}
        {verySlow && (
          <p className="note" role="status">
            The server is waking up. The first visit of the day can take up to a minute.
          </p>
        )}
      </section>
    );
  }

  if (load.state === "error" || load.state === "closed") {
    const closed = load.state === "closed";
    return (
      <section className="chat" aria-labelledby="chat-title">
        <header className="chat-head">
          <h1 id="chat-title" className="chat-title">
            Chat
          </h1>
        </header>
        <div className="hud-panel chat-state" data-chat-state={load.state}>
          <h2 className="hud-caption">{closed ? "Closed while your paper is open" : "That did not load"}</h2>
          <div className="chat-state-body">
            <p>{load.message}</p>
            {closed && load.paper && (
              <p className="chat-paper" data-open-paper="">
                <span className="chat-paper-title">{load.paper.title}</span>
                <span className="chat-paper-when">
                  started <time className="mono" dateTime={load.paper.startedAt}>{when(load.paper.startedAt)}</time>
                </span>
              </p>
            )}
            {closed ? (
              <p className="note">
                Your instructor set it this way so that a paper is your own work. Finish and submit it, and the
                chat is here, with everything you missed. A moon&apos;s journey is practice and never closes it.
              </p>
            ) : null}
            {closed && load.paper?.stageId && (
              // The check route needs the assessment (?a=) and its title (?t=): the
              // first link here had neither and opened "That did not load".
              <Link
                className="hud-button button-primary"
                to={`/app/stage/${load.paper.stageId}/check?a=${encodeURIComponent(load.paper.assessmentId)}&t=${encodeURIComponent(load.paper.title)}`}
              >
                Go to {load.paper.title}
              </Link>
            )}
            <button
              type="button"
              className="hud-button"
              onClick={() => {
                setLoad({ state: "loading" });
                void loadRooms();
              }}
            >
              {closed ? "Check again" : "Try again"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const room = rooms.find((r) => r.id === roomId) ?? null;
  const me = load.rooms.me;

  return (
    <section className="chat" aria-labelledby="chat-title" data-chat="">
      <header className="chat-head">
        <h1 id="chat-title" className="chat-title">
          Chat
        </h1>
        <p className="chat-sub">Your section&apos;s room, and a private line to your instructor.</p>
      </header>

      {rooms.length === 0 ? (
        <div className="hud-panel chat-state" data-chat-state="empty">
          <h2 className="hud-caption">No room yet</h2>
          <div className="chat-state-body">
            <p>You are not on a section&apos;s roster yet, so there is no room for you. Ask your instructor to add you.</p>
          </div>
        </div>
      ) : (
        <div className="chat-grid">
          <nav className="hud-panel chat-rooms" aria-label="Rooms">
            <h2 className="hud-caption">Rooms</h2>
            <ul className="chat-room-list">
              {rooms.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="chat-room-btn"
                    aria-current={r.id === roomId ? "true" : undefined}
                    onClick={() => setParams(r.id === rooms[0]?.id ? {} : { room: r.id }, { replace: true })}
                  >
                    <span className={`chat-room-name${r.kind === "section" ? " mono" : ""}`}>{r.title}</span>
                    <span className="chat-room-sub">{r.subtitle}</span>
                    {r.unread > 0 && (
                      <span className="chat-room-count">
                        <span className="mono">{r.unread}</span> new
                        {r.mentions > 0 && (
                          <>
                            {" · "}
                            <span className="mono">{r.mentions}</span> for you
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="hud-panel chat-room" aria-labelledby="chat-room-title">
            <h2 id="chat-room-title" className={`hud-caption chat-room-title${room?.kind === "section" ? " mono" : ""}`}>
              {room?.title ?? "Room"}
            </h2>
            <p className="chat-room-about">{room?.subtitle}</p>
            <div
              ref={logRef}
              className="chat-log"
              role="log"
              aria-label={`Messages in ${room?.title ?? "this room"}`}
              tabIndex={0}
              onScroll={(e) => {
                const el = e.currentTarget;
                stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              }}
              // An image or video that loads after the scroll makes the log taller: keep
              // the newest message in view if the reader was at the bottom (seen on the
              // deployment, 6 Oct 2026: a screenshot pushed itself half out of view).
              onLoadCapture={(e) => {
                if (stick.current) e.currentTarget.scrollTop = e.currentTarget.scrollHeight;
              }}
              onLoadedMetadataCapture={(e) => {
                if (stick.current) e.currentTarget.scrollTop = e.currentTarget.scrollHeight;
              }}
            >
              {!thread || thread.room.id !== roomId ? (
                <div aria-hidden="true">
                  <span className="skel skel-line" />
                  <span className="skel skel-line" />
                </div>
              ) : (
                <>
                  {more && (
                    <button
                      type="button"
                      className="chat-tool chat-earlier"
                      onClick={async () => {
                        const first = messages[0];
                        if (!first || !roomId) return;
                        try {
                          const t = await api.chatThread(roomId, first.createdAt);
                          stick.current = false;
                          setOlder((o) => [...t.messages, ...o]);
                          setMore(t.more);
                        } catch (err) {
                          toast.error("Earlier messages did not load", err instanceof ApiError ? err.message : "Try again.");
                        }
                      }}
                    >
                      Show earlier messages
                    </button>
                  )}
                  {messages.length === 0 ? (
                    <p className="chat-empty">
                      {room?.kind === "direct"
                        ? "Only you and your instructor can read this. Ask what you would not ask in front of the class."
                        : "Nobody has written here yet. Ask the first question; someone else is wondering too."}
                    </p>
                  ) : (
                    <ol className="chat-msgs">
                      {messages.map((m) => (
                        <Message
                          key={m.id}
                          m={m}
                          me={me}
                          members={members}
                          onDelete={async (target) => {
                            try {
                              await api.chatDelete(target.id);
                              toast.success("Message deleted", "Its text is gone for everyone in the room.");
                              setOlder((o) => o.map((x) => (x.id === target.id ? { ...x, deleted: true, body: null, attachment: null } : x)));
                              await loadThread();
                            } catch (err) {
                              toast.error("Message not deleted", err instanceof ApiError ? err.message : "Try again.");
                            }
                          }}
                        />
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
            {thread && thread.room.id === roomId && (
              <Composer
                thread={thread}
                me={me}
                attachments={load.rooms.attachments}
                onSent={(m) => {
                  stick.current = true;
                  setThread((t) => (t && t.room.id === m.roomId ? { ...t, messages: [...t.messages, m] } : t));
                  lastSeen.current = m.id;
                }}
              />
            )}
          </section>
        </div>
      )}
    </section>
  );
}
