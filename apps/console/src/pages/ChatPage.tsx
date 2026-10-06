import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChatAttachments, ChatMessage, ChatPerson, ChatRooms, ChatThread } from "@octa/contracts";
import { api, ApiError, putChatFile, type Roster } from "@/lib/api";
import { useChatLive } from "@/lib/chat-live";
import { useDelayed } from "@/lib/useDelayed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * `/chat` — the class chat, the instructor's side (approved 6 Oct 2026;
 * docs/CHAT-PLAN.md; design/templates/console/chat/SPEC.md).
 *
 * The same rooms and messages as the student app's `/app/chat`, in the
 * console's look. The instructor sees every section's room and every private
 * thread that has a message, and can open a thread with any student. Two tabs:
 *
 *   Conversations   rooms, a room's log, the composer (@ mentions, attach);
 *                   Remove on anyone's message (moderation, audited with the
 *                   text), Delete on one's own
 *   Attachments     ruling 2: storage is 1 GB in all, so every file still
 *                   held, oldest first, with what it costs; remove one, or
 *                   every one older than N days. The messages stay.
 *
 * Reads go through the API; Supabase Realtime says when (lib/chat-live.ts).
 */

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
const mb = (n: number) => (n / (1024 * 1024)).toFixed(n < 1024 * 1024 ? 2 : 1);

function when(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

function Body({ text, mentioned }: { text: string; mentioned: ChatPerson[] }) {
  const names = mentioned.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{text}</>;
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return (
    <>
      {text.split(new RegExp(`(@(?:${esc.join("|")}))`, "g")).map((part, i) =>
        part.startsWith("@") && names.includes(part.slice(1)) ? (
          <strong key={i} className="ch-at">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Attachment({ m }: { m: ChatMessage }) {
  if (m.attachmentRemoved && !m.attachment) return <p className="ch-gone">Attachment removed to free storage.</p>;
  const a = m.attachment;
  if (!a) return null;
  if (!a.url) return <p className="ch-gone">{a.name} could not be fetched just now.</p>;
  return (
    <figure className="ch-file">
      {a.mime.startsWith("video/") ? (
        <video className="ch-media" src={a.url} controls preload="metadata" aria-label={`Video: ${a.name}`} />
      ) : (
        <a href={a.url} target="_blank" rel="noreferrer">
          <img className="ch-media" src={a.url} alt={`Screenshot: ${a.name}`} loading="lazy" />
        </a>
      )}
      <figcaption className="ch-file-cap">
        {a.name} · <span className="num">{mb(a.bytes)} MB</span>
      </figcaption>
    </figure>
  );
}

function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]!))) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || /[\n@]/.test(query)) return null;
  return { start: at, query };
}

function Composer({
  thread, me, attachments, onSent,
}: { thread: ChatThread; me: ChatPerson; attachments: boolean; onSent: (m: ChatMessage) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState<null | "uploading" | "sending">(null);
  const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
  const [pick, setPick] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const roomId = thread.room.id;

  useEffect(() => {
    setText("");
    setFile(null);
    setProblem(null);
    setMq(null);
  }, [roomId]);

  const others = thread.members.filter((p) => p.id !== me.id);
  const options = mq ? others.filter((p) => p.name.toLowerCase().includes(mq.query.toLowerCase())).slice(0, 6) : [];
  const open = options.length > 0;
  const listId = `ch-mentions-${roomId}`;

  const choose = (p: ChatPerson) => {
    if (!mq) return;
    const caret = area.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, mq.start)}@${p.name} ${text.slice(caret)}`);
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
      const mentions = others.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id);
      const sent = await api.chatSend(roomId, { ...(body ? { body } : {}), mentions, ...(attachment ? { attachment } : {}) });
      setText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onSent(sent);
    } catch (err) {
      toast.error("Message not sent", err instanceof ApiError ? err.message : "Could not reach the server. Your message is still here; send it again.");
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

  return (
    <form className="ch-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <label htmlFor="ch-text" className="sr-only">Message {thread.room.title}</label>
      <div className="ch-compose-field">
        {open && (
          <ul className="ch-mentions" id={listId} role="listbox" aria-label="People to mention">
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === pick}
                className="ch-mention-opt"
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
        <Textarea
          id="ch-text"
          ref={area}
          rows={2}
          maxLength={4000}
          className="ch-text"
          value={text}
          placeholder={thread.room.kind === "direct" ? `Message ${thread.room.title}. Only the two of you read this.` : `Message ${thread.room.title}. Type @ to mention someone.`}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${options[Math.min(pick, options.length - 1)]!.id}` : undefined}
          aria-describedby="ch-hint"
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
        <p className="ch-chip">
          <span className="min-w-0 break-words">{file.name}</span>
          <span className="num">{mb(file.size)} MB</span>
          <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${file.name}`} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>
            Remove
          </Button>
        </p>
      )}
      {problem && <p className="ch-problem" role="alert">{problem}</p>}
      <div className="ch-actions">
        <p id="ch-hint" className="ch-hint">
          Enter sends, Shift+Enter starts a new line.{!attachments && " Attachments are not available on this server."}
        </p>
        {attachments && (
          <label className="ch-attach">
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
                  setProblem(`That file is ${mb(f.size)} MB; the limit is 25 MB.`);
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
        <Button type="submit" disabled={sending !== null} className="ch-send">
          {sending === "uploading" ? "Uploading…" : sending === "sending" ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

/** What the confirm dialog is about to do. */
type Pending =
  | { kind: "remove-message"; m: ChatMessage }
  | { kind: "remove-file"; messageId: string; name: string; bytes: number }
  | { kind: "prune"; days: number; count: number; bytes: number };

function Conversations({
  rooms, roster, onRooms, onAsk,
}: {
  rooms: ChatRooms;
  roster: Roster | null;
  onRooms: () => Promise<void>;
  onAsk: (p: Pending) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [student, setStudent] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const shownRoom = useRef<string | null>(null);
  const lastSeen = useRef<string | null>(null);

  const list = rooms.rooms;
  const asked = params.get("room");
  const roomId = asked ?? list[0]?.id ?? null;
  const room = list.find((r) => r.id === roomId) ?? (thread?.room.id === roomId ? thread.room : null);

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
      setFailed(null);
      const last = t.messages.at(-1)?.id ?? null;
      if (last !== lastSeen.current && document.visibilityState === "visible") {
        lastSeen.current = last;
        await api.chatRead(roomId).catch(() => {});
        // The rail's "N new" for this room is now 0 (the first capture still said "1 new").
        await onRooms();
      }
    } catch (err) {
      setFailed(err instanceof ApiError ? err.message : "Could not reach the server.");
    }
  }, [roomId, onRooms]);

  useEffect(() => {
    stick.current = true;
    lastSeen.current = null;
    void loadThread();
  }, [loadThread]);

  useChatLive("console", null, () => {
    void loadThread();
    void onRooms();
  });

  const messages = useMemo(() => {
    if (!thread) return [];
    const seen = new Set(thread.messages.map((m) => m.id));
    return [...older.filter((m) => !seen.has(m.id)), ...thread.messages];
  }, [older, thread]);

  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, thread?.room.id]);

  const members = useMemo(() => new Map((thread?.members ?? []).map((p) => [p.id, p])), [thread]);
  const sections = list.filter((r) => r.kind === "section");
  const threads = list.filter((r) => r.kind === "direct");
  const students = (roster?.students ?? []).filter((s) => s.userId).sort((a, b) => a.fullName.localeCompare(b.fullName));

  const roomButton = (r: (typeof list)[number]) => (
    <li key={r.id}>
      <button
        type="button"
        className="ch-room"
        aria-current={r.id === roomId ? "true" : undefined}
        onClick={() => setParams({ room: r.id }, { replace: true })}
      >
        <span className={r.kind === "section" ? "ch-room-name num" : "ch-room-name"}>{r.title}</span>
        <span className="ch-room-sub">{r.subtitle}</span>
        {r.unread > 0 && (
          <span className="ch-room-count">
            <span className="num">{r.unread}</span> new
            {r.mentions > 0 && <> · <span className="num">{r.mentions}</span> for you</>}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <div className="ch-grid">
      <nav className="ch-rooms" aria-label="Rooms">
        <h2 className="ch-h2">Sections</h2>
        <ul className="ch-room-list">{sections.map(roomButton)}</ul>
        <h2 className="ch-h2">Private threads</h2>
        {threads.length > 0 ? (
          <ul className="ch-room-list">{threads.map(roomButton)}</ul>
        ) : (
          <p className="ch-note">None yet. A thread appears here once a student writes to you, or you to them.</p>
        )}
        <form
          className="ch-open"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!student) return;
            try {
              const r = await api.chatOpenThread(student);
              await onRooms();
              setParams({ room: r.id }, { replace: true });
              setStudent("");
            } catch (err) {
              toast.error("Thread not opened", err instanceof ApiError ? err.message : "Try again.");
            }
          }}
        >
          <label htmlFor="ch-student" className="ch-label">Message a student</label>
          <div className="ch-open-row">
            <select id="ch-student" className="ch-select" value={student} onChange={(e) => setStudent(e.target.value)}>
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.userId!} value={s.userId!}>
                  {s.fullName} ({s.studentId})
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" disabled={!student}>Open</Button>
          </div>
        </form>
      </nav>

      <section className="ch-room-panel" aria-labelledby="ch-room-title">
        <header className="ch-room-head">
          <h2 id="ch-room-title" className={room?.kind === "section" ? "ch-room-title num" : "ch-room-title"}>{room?.title ?? "Room"}</h2>
          <p className="ch-room-sub">{room?.subtitle}</p>
        </header>
        <div
          ref={logRef}
          className="ch-log"
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
          {failed ? (
            <div role="alert" className="ch-failed">
              <p>That room did not load. <span className="text-ink-muted">{failed}</span></p>
              <Button size="sm" variant="outline" onClick={() => void loadThread()}>Try again</Button>
            </div>
          ) : !thread || thread.room.id !== roomId ? (
            <div aria-hidden="true" className="ch-skel">
              <span /><span /><span />
            </div>
          ) : (
            <>
              {more && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ch-earlier"
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
                </Button>
              )}
              {messages.length === 0 ? (
                <p className="ch-empty">Nothing here yet. {room?.kind === "direct" ? "Only you and this student read this thread." : "Everyone in the section reads this room."}</p>
              ) : (
                <ol className="ch-msgs">
                  {messages.map((m) => {
                    const forMe = m.mentions.includes(rooms.me.id);
                    const mentioned = m.mentions.map((id) => members.get(id)).filter((p): p is ChatPerson => p !== undefined);
                    return (
                      <li key={m.id} data-message={m.id} className={`ch-msg${m.mine ? " is-mine" : ""}${forMe ? " is-for-me" : ""}`}>
                        <div className="ch-msg-head">
                          <span className="ch-author">{m.mine ? "You" : m.author.name}</span>
                          {m.author.staff && <Badge>Instructor</Badge>}
                          {forMe && <Badge tone="info">Mentions you</Badge>}
                          <time className="ch-time num" dateTime={m.createdAt}>{when(m.createdAt)}</time>
                        </div>
                        {m.deleted ? (
                          <p className="ch-gone">Message deleted.</p>
                        ) : (
                          <>
                            {m.body && <p className="ch-body"><Body text={m.body} mentioned={mentioned} /></p>}
                            <Attachment m={m} />
                            <div className="ch-tools">
                              {m.mine ? (
                                asking === m.id ? (
                                  <>
                                    <span className="text-sm" role="status">Delete it for everyone?</span>
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      try {
                                        await api.chatDelete(m.id);
                                        setAsking(null);
                                        toast.success("Message deleted", "Its text is gone for everyone in the room.");
                                        await loadThread();
                                      } catch (err) {
                                        toast.error("Message not deleted", err instanceof ApiError ? err.message : "Try again.");
                                      }
                                    }}>Delete</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>Keep</Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="ghost" aria-label={`Delete your message from ${when(m.createdAt)}`} onClick={() => setAsking(m.id)}>Delete</Button>
                                )
                              ) : (
                                <Button size="sm" variant="ghost" aria-label={`Remove ${m.author.name}'s message from ${when(m.createdAt)}`} onClick={() => onAsk({ kind: "remove-message", m })}>
                                  Remove
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </div>
        {thread && thread.room.id === roomId && (
          <Composer
            thread={thread}
            me={rooms.me}
            attachments={rooms.attachments}
            onSent={(m) => {
              stick.current = true;
              lastSeen.current = m.id;
              setThread((t) => (t && t.room.id === m.roomId ? { ...t, messages: [...t.messages, m] } : t));
            }}
          />
        )}
      </section>
      <ConversationReload register={loadThread} />
    </div>
  );
}

/** Lets the page reload the open room after a moderation from the dialog. */
let reloadRoom: (() => Promise<void>) | null = null;
function ConversationReload({ register }: { register: () => Promise<void> }) {
  useEffect(() => {
    reloadRoom = register;
    return () => {
      reloadRoom = null;
    };
  }, [register]);
  return null;
}

function Storage({ data, onAsk }: { data: ChatAttachments | null; onAsk: (p: Pending) => void }) {
  const [days, setDays] = useState(30);
  if (!data) {
    return <div className="ch-skel ch-skel-table" aria-busy="true"><span /><span /><span /></div>;
  }
  const pct = Math.min(100, Math.round((data.usedBytes / data.limitBytes) * 100));
  const old = data.items.filter((i) => Date.now() - new Date(i.createdAt).getTime() > days * 86_400_000);
  return (
    <div className="ch-storage">
      <section className="ch-card" aria-labelledby="ch-usage-title">
        <h2 id="ch-usage-title" className="ch-h2">Storage</h2>
        <p className="text-sm">
          <span className="num">{mb(data.usedBytes)}</span> MB of <span className="num">{mb(data.limitBytes)}</span> MB used by
          chat attachments (<span className="num">{pct}</span>%). The free plan holds 1 GB for everything.
        </p>
        <div className="ch-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <form
          className="ch-prune"
          onSubmit={(e) => {
            e.preventDefault();
            onAsk({ kind: "prune", days, count: old.length, bytes: old.reduce((s, i) => s + i.bytes, 0) });
          }}
        >
          <label htmlFor="ch-days" className="ch-label">Remove every attachment older than</label>
          <div className="ch-open-row">
            <Input id="ch-days" type="number" min={1} max={365} value={days} className="ch-days num" onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
            <span className="text-sm">days</span>
            <Button type="submit" variant="outline" disabled={old.length === 0}>
              Remove <span className="num">{old.length}</span>
            </Button>
          </div>
          <p className="ch-note">The messages stay, marked "Attachment removed to free storage".</p>
        </form>
      </section>

      {data.items.length === 0 ? (
        <p className="ch-empty">No attachments are held. Screenshots and videos sent in chat appear here, oldest first.</p>
      ) : (
        <ul className="ch-files" aria-label="Attachments, oldest first">
          {data.items.map((i) => (
            <li key={i.messageId} className="ch-file-row">
              <span className="ch-file-name">{i.name}</span>
              <span className="ch-file-meta">
                {i.mime.startsWith("video/") ? "Video" : "Screenshot"} from {i.author} in {i.room} · <time className="num" dateTime={i.createdAt}>{when(i.createdAt)}</time>
              </span>
              <span className="num ch-file-size">{mb(i.bytes)} MB</span>
              <Button size="sm" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => onAsk({ kind: "remove-file", messageId: i.messageId, name: i.name, bytes: i.bytes })}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChatPage() {
  const [rooms, setRooms] = useState<ChatRooms | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [storage, setStorage] = useState<ChatAttachments | null>(null);
  const [tab, setTab] = useState<"conversations" | "attachments">("conversations");
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState("");
  const reasonOk = reason.trim().length >= 3;
  const slow = useDelayed(rooms === null && error === null, 400);
  const verySlow = useDelayed(rooms === null && error === null, 3000);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await api.chatRooms());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
    }
  }, []);
  const loadStorage = useCallback(async () => {
    try {
      setStorage(await api.chatAttachments());
    } catch {
      setStorage({ usedBytes: 0, limitBytes: 1024 * 1024 * 1024, items: [] });
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    void api.roster().then(setRoster).catch(() => setRoster(null));
  }, [loadRooms]);
  useEffect(() => {
    if (tab === "attachments") void loadStorage();
  }, [tab, loadStorage]);

  async function confirm() {
    if (!pending || !reasonOk) return;
    const why = reason.trim();
    setWorking(true);
    const p = pending;
    try {
      let title: string;
      let body: string;
      if (p.kind === "remove-message") {
        await api.chatDelete(p.m.id, why);
        title = `Message from ${p.m.author.name} removed`;
        body = "Its text is gone from the room and kept in the audit log.";
      } else if (p.kind === "remove-file") {
        const r = await api.chatRemoveAttachment(p.messageId, why);
        title = `${p.name} removed`;
        body = `${mb(r.bytes)} MB freed. The message stays.`;
      } else {
        const r = await api.chatPrune(p.days, why);
        title = `${r.removed} attachment${r.removed === 1 ? "" : "s"} removed`;
        body = `${mb(r.bytes)} MB freed: everything older than ${p.days} days. The messages stay.`;
      }
      // Close the dialog BEFORE the toast: a toast raised under an open Radix
      // dialog is hidden from screen readers (NEXT-SESSION §0zb.4).
      setPending(null);
      setReason("");
      toast.success(title, body);
      if (tab === "attachments") await loadStorage();
      await reloadRoom?.();
    } catch (err) {
      setPending(null);
      toast.error("Nothing was removed", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="ch">
      <header className="ch-head">
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-2xl">Chat</h1>
          <p className="text-sm text-ink-muted">
            Each section's room and a private thread with each student. Students with a paper open cannot read or post until they submit.
          </p>
        </div>
        <div role="tablist" aria-label="Chat views" className="ch-tabs">
          <button type="button" role="tab" aria-selected={tab === "conversations"} className="ch-tab" onClick={() => setTab("conversations")}>
            Conversations
          </button>
          <button type="button" role="tab" aria-selected={tab === "attachments"} className="ch-tab" onClick={() => setTab("attachments")}>
            Attachments
          </button>
        </div>
      </header>

      {error && !rooms ? (
        <div role="alert" className="ch-failed">
          <p className="text-sm">The chat did not load. <span className="text-ink-muted">{error}</span></p>
          <Button size="sm" variant="outline" onClick={() => void loadRooms()}>Try again</Button>
        </div>
      ) : !rooms ? (
        slow ? (
          <>
            <div className="ch-grid" aria-busy="true">
              <div className="ch-skel"><span /><span /><span /></div>
              <div className="ch-skel"><span /><span /><span /><span /></div>
            </div>
            {verySlow && <p className="mt-3 text-sm text-ink-muted" role="status">The server is waking up. The first request of the day can take up to a minute.</p>}
          </>
        ) : (
          <div className="ch-reserve" aria-busy="true" />
        )
      ) : tab === "conversations" ? (
        <Conversations rooms={rooms} roster={roster} onRooms={loadRooms} onAsk={setPending} />
      ) : (
        <Storage data={storage} onAsk={setPending} />
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && !working && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "remove-message"
                ? `Remove ${pending.m.author.name}'s message?`
                : pending?.kind === "remove-file"
                  ? `Remove ${pending.name}?`
                  : `Remove ${pending?.kind === "prune" ? pending.count : 0} attachments?`}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "remove-message"
                ? "Its text disappears from the room for everyone. What it said is kept in the audit log, which only staff read."
                : pending?.kind === "remove-file"
                  ? `The file (${mb(pending.bytes)} MB) is deleted from storage. The message stays, marked as having had an attachment.`
                  : pending?.kind === "prune"
                    ? `Every attachment older than ${pending.days} days, ${mb(pending.bytes)} MB in all, is deleted from storage. The messages stay. This cannot be undone.`
                    : ""}
            </DialogDescription>
          </DialogHeader>
          {pending?.kind === "remove-message" && pending.m.body && <blockquote className="ch-quote">{pending.m.body}</blockquote>}
          <form
            className="ch-reason"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <label htmlFor="ch-reason" className="ch-label">Why (recorded in the audit log)</label>
            <Input id="ch-reason" value={reason} maxLength={500} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="In a few words" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={working}>Keep it</Button>
              <Button type="submit" variant="danger" disabled={working || !reasonOk}>{working ? "Removing…" : "Remove"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
