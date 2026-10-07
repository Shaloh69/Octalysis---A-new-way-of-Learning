import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import {
  ArrowDown, ArrowUp, Bold, ChevronDown, Code, Eye, FilePlus2, Italic, List, ListOrdered, Redo2, Trash2, Undo2,
} from "lucide-react";
import type { WorkingCopy } from "@octa/contracts";
import { api, ApiError, type ContentBlock, type ContentFigure } from "@/lib/api";
import {
  diffTopics, docCollisions, docToTopics, topicTitle, topicsToDoc, type PMNode, type Topic, type TopicKind,
} from "@/lib/editor-doc";
import { GateNote, useApprovalGate } from "@/lib/approval-gate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Preview } from "../../content/Preview";
import { currentTopicPos, deleteTopic, insertTopic, moveTopic, topicCount } from "./commands";
import { Studio, extensions } from "./extensions";

/**
 * The chapter as a document you click into and type in (docs/STUDIO-EDITOR-PLAN.md,
 * E1.3; instructor rulings, 8 Oct 2026): one toolbar above a page of topics,
 * autosaved as a DRAFT students never see, and Publish, which puts it live.
 *
 * Saving names the version it loaded (409 if someone else saved), keeps every
 * topic nobody changed byte for byte (`docToTopics` with its originals), and
 * never makes what a student reads change: only Publish does that, with a
 * reason, and the teacher of the subject or the admin.
 */

const AUTOSAVE_MS = 900;

interface Props {
  stageId: string;
  title: string;
  initial: WorkingCopy;
  /** The live chapter, for what Publish would change. */
  live: readonly ContentBlock[];
  figures: ReadonlyMap<string, ContentFigure>;
  /** After a publish or a discard: load everything again. */
  onChanged: () => void;
  /** A drafted chapter waiting for review also offers Send back (the page owns that dialog). */
  sendBack?: (() => void) | undefined;
}

const topicsOf = (wc: WorkingCopy): Topic[] =>
  wc.blocks.map((b) => ({ id: b.id ?? crypto.randomUUID(), kind: b.kind, body: b.body, meta: b.meta }));

const liveTopics = (live: readonly ContentBlock[]): Topic[] =>
  live.map((b) => ({ id: b.id, kind: b.kind as TopicKind, body: b.body, meta: b.meta }));

type Status = "saved" | "dirty" | "saving" | "conflict" | "error";
const STATUS_WORD: Record<Status, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  conflict: "Not saved: changed elsewhere",
  error: "Not saved",
};

export function ChapterEditor({ stageId, title, initial, live, figures, onChanged, sendBack }: Props) {
  const initialTopics = useMemo(() => topicsOf(initial), [initial]);
  const saved = useRef({ version: initial.version, hash: initial.hash, topics: initialTopics });
  const [hasDraft, setHasDraft] = useState(initial.source === "draft");
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [student, setStudent] = useState<Topic[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const timer = useRef<number | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const gate = useApprovalGate(null);

  const exts = useMemo(
    () => extensions.map((e) => (e === Studio ? Studio.extend({ addStorage: () => ({ figures }) }) : e)),
    [figures],
  );

  const flush = useCallback(
    async (editor: Editor) => {
      if (inflight.current) {
        again.current = true;
        return;
      }
      const topics = docToTopics(editor.getJSON() as PMNode, saved.current.topics);
      if (JSON.stringify(topics) === JSON.stringify(saved.current.topics)) {
        setStatus("saved");
        return;
      }
      inflight.current = true;
      setStatus("saving");
      try {
        const res = await api.saveWorkingCopy(stageId, {
          version: saved.current.version,
          blocks: topics.map((t) => ({ ...(t.id ? { id: t.id } : {}), kind: t.kind, body: t.body, meta: t.meta })),
        });
        saved.current = { version: res.version, hash: res.hash, topics };
        setHasDraft(true);
        setError(null);
        setStatus(again.current ? "dirty" : "saved");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setStatus("conflict");
          setError(e.message);
        } else {
          setStatus("error");
          setError(e instanceof Error ? e.message : "It was not saved.");
        }
      } finally {
        inflight.current = false;
        if (again.current) {
          again.current = false;
          timer.current = window.setTimeout(() => void flush(editor), 50);
        }
      }
    },
    [stageId],
  );

  const editor = useEditor(
    {
      extensions: exts,
      content: topicsToDoc(initialTopics) as unknown as Record<string, unknown>,
      shouldRerenderOnTransaction: false,
      editorProps: { attributes: { class: "ed-prose", "aria-label": "Chapter text", "data-editor": "" } },
      onUpdate: ({ editor: ed }) => {
        setWarnings(docCollisions(ed.getJSON() as PMNode));
        setStatus((s) => (s === "conflict" ? s : "dirty"));
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush(ed), AUTOSAVE_MS);
      },
    },
    [exts],
  );

  // Leaving with typing not yet saved: say so, and try once more as the page goes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (editor && !editor.isDestroyed && inflight.current === false) void flush(editor);
    },
    [editor, flush],
  );

  const ui = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            code: ed.isActive("code"),
            bullet: ed.isActive("bulletList"),
            ordered: ed.isActive("orderedList"),
            level: ed.isActive("heading", { level: 2 }) ? "2" : ed.isActive("heading", { level: 3 }) ? "3" : ed.isActive("heading", { level: 4 }) ? "4" : "p",
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
            canBold: ed.can().toggleBold(),
            canList: ed.can().toggleBulletList(),
            canHeading: ed.can().toggleHeading({ level: 2 }),
            pos: currentTopicPos(ed.state),
            count: topicCount(ed),
          }
        : null,
  });

  if (!editor || !ui) return <div className="ed-shell" aria-busy="true" />;

  const run = (f: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () => f(editor.chain().focus()).run();
  const topicAction = (f: (pos: number) => void) => () => {
    if (ui.pos !== null) f(ui.pos);
  };
  const blocked = status !== "saved" || !hasDraft || !gate.allowed || initial.stale;

  const showStudent = () => {
    setStudent(docToTopics(editor.getJSON() as PMNode, saved.current.topics));
  };

  return (
    <div className="ed-shell" data-editor-shell data-status={status}>
      <div className="ed-toolbar" role="toolbar" aria-label="Formatting and topics">
        <span className="ed-group" role="group" aria-label="History">
          <Tool label="Undo" disabled={!ui.canUndo || !!student} onClick={run((c) => c.undo())}><Undo2 className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Redo" disabled={!ui.canRedo || !!student} onClick={run((c) => c.redo())}><Redo2 className="h-4 w-4" aria-hidden="true" /></Tool>
        </span>
        <span className="ed-sep" aria-hidden="true" />
        <span className="ed-group" role="group" aria-label="Text">
          <select
            className="ed-select"
            aria-label="Paragraph style"
            value={ui.level}
            disabled={!ui.canHeading || !!student}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().setHeading({ level: Number(v) as 2 | 3 | 4 }).run();
            }}
          >
            <option value="p">Paragraph</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
          </select>
          <Tool label="Bold" pressed={ui.bold} disabled={!ui.canBold || !!student} onClick={run((c) => c.toggleBold())}><Bold className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Italic" pressed={ui.italic} disabled={!ui.canBold || !!student} onClick={run((c) => c.toggleItalic())}><Italic className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Code" pressed={ui.code} disabled={!ui.canBold || !!student} onClick={run((c) => c.toggleCode())}><Code className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Bulleted list" pressed={ui.bullet} disabled={!ui.canList || !!student} onClick={run((c) => c.toggleBulletList())}><List className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Numbered list" pressed={ui.ordered} disabled={!ui.canList || !!student} onClick={run((c) => c.toggleOrderedList())}><ListOrdered className="h-4 w-4" aria-hidden="true" /></Tool>
        </span>
        <span className="ed-sep" aria-hidden="true" />
        <span className="ed-group" role="group" aria-label="Topics">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={!!student} aria-label="Add a topic">
                <FilePlus2 className="mr-1 h-4 w-4" aria-hidden="true" />Add topic<ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(["prose", "callout", "code"] as const).map((k) => (
                <DropdownMenuItem key={k} onSelect={() => insertTopic(editor, ui.pos, k)}>
                  {k === "prose" ? "Text topic" : k === "callout" ? "Callout" : "Code listing"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tool label="Move this topic up" disabled={ui.pos === null || !!student} onClick={topicAction((p) => moveTopic(editor, p, -1))}><ArrowUp className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Move this topic down" disabled={ui.pos === null || !!student} onClick={topicAction((p) => moveTopic(editor, p, 1))}><ArrowDown className="h-4 w-4" aria-hidden="true" /></Tool>
          <Tool label="Delete this topic" disabled={ui.pos === null || ui.count <= 1 || !!student} onClick={topicAction((p) => deleteTopic(editor, p))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Tool>
        </span>
        <span className="ed-actions">
        <span className="ed-status" data-save-status={status} role="status">
          {STATUS_WORD[status]}
          {status === "saved" && hasDraft ? <span className="ed-status-sub"> · draft, not published</span> : null}
        </span>
        <Button type="button" size="sm" variant={student ? "default" : "outline"} aria-pressed={!!student} onClick={() => (student ? setStudent(null) : showStudent())}>
          <Eye className="mr-1 h-4 w-4" aria-hidden="true" />Student view
        </Button>
        {hasDraft && initial.origin !== "file" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setDiscarding(true)} disabled={status === "saving"}>Discard draft</Button>
        ) : null}
        <Button type="button" size="sm" disabled={blocked} aria-describedby={gate.reason ? "ed-gate" : undefined} onClick={() => setPublishing(true)} data-publish>
          Publish…
        </Button>
        </span>
      </div>
      {gate.reason ? <GateNote id="ed-gate" gate={gate} /> : null}

      {initial.origin === "file" ? (
        <p className="ed-banner" role="note" data-banner="file">
          <Badge tone="info">To review</Badge> This chapter was drafted from the textbook and waits for a teacher. Read it, change what needs changing, then Publish.
          {sendBack ? <Button type="button" size="sm" variant="outline" className="ml-2" onClick={sendBack}>Send back…</Button> : null}
        </p>
      ) : null}
      {initial.stale ? (
        <p className="ed-banner is-warn" role="alert" data-banner="stale">
          The published chapter changed since this draft began (someone published, or sync-content updated it), so Publish will refuse. Discard this draft and start again from the current text.
        </p>
      ) : null}
      {status === "conflict" || status === "error" ? (
        <p className="ed-banner is-warn" role="alert" data-banner="save-failed">
          {error ?? "It was not saved."} {status === "conflict" ? "Reload to read what was saved; what you typed since is still on this page until you do." : "Your typing is still on this page."}
          <Button type="button" size="sm" variant="outline" className="ml-2" onClick={onChanged}>Reload</Button>
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <div className="ed-banner is-note" role="status" data-banner="collisions">
          <p>A student would read some of this differently from how it looks here (the reader has no way to escape these):</p>
          <ul>{warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      ) : null}

      <div className="ed-canvas">
        <div className={cn("ed-page", student && "is-hidden")} hidden={!!student}>
          <EditorContent editor={editor} />
        </div>
        {student ? (
          <Preview
            blocks={student.map((t, i): ContentBlock => ({
              id: t.id ?? String(i), ordinal: i + 1, kind: t.kind, body: t.body, meta: t.meta, version: 0, updatedAt: "",
              consoleEdited: false, editable: false, source: null, historyCount: 0, lastEdit: null,
            }))}
            editing={null}
            title={title}
            heading="Student view · as a student reads it"
            figures={figures}
          />
        ) : null}
      </div>

      <PublishDialog
        open={publishing}
        stageId={stageId}
        live={live}
        draft={saved.current.topics}
        hash={saved.current.hash}
        replaces={initial.origin === "file"}
        warnings={warnings}
        onClose={() => setPublishing(false)}
        onDone={onChanged}
      />
      <DiscardDialog open={discarding} stageId={stageId} onClose={() => setDiscarding(false)} onDone={onChanged} />
    </div>
  );
}

function Tool({ label, pressed, disabled, onClick, children }: {
  label: string;
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button" size="sm" variant={pressed ? "default" : "ghost"} className="ed-tool"
      aria-label={label} title={label} aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
    >
      {children}
    </Button>
  );
}

/* ----------------------------------------------------------------- dialogs */

function PublishDialog({ open, stageId, live, draft, hash, replaces, warnings, onClose, onDone }: {
  open: boolean;
  stageId: string;
  live: readonly ContentBlock[];
  draft: readonly Topic[];
  hash: string;
  /** A drafted chapter replaces the stub rather than editing it. */
  replaces: boolean;
  warnings: readonly string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setReason("");
    setBusy(false);
    setError(null);
  }, [open]);
  const d = useMemo(() => diffTopics(liveTopics(live), draft), [live, draft, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.publishWorkingCopy(stageId, { hash, reason: reason.trim() });
      toast.success(
        `Stage ${stageId} published`,
        `${r.added} added, ${r.removed} removed, ${r.edited} changed, ${r.moved} moved. Students read it now; every replaced topic stays in History.`,
      );
      onClose();
      onDone();
    } catch (e) {
      const m = e instanceof Error ? e.message : "It was not published.";
      setError(m);
      toast.error(`Stage ${stageId} was not published`, "The dialog is still open with your reason in it.");
      setBusy(false);
    }
  }

  const none = d.added.length + d.removed.length + d.edited.length + d.moved.length === 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="ease-dialog max-w-lg max-sm:top-3 max-sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>Publish stage {stageId}?</DialogTitle>
          <DialogDescription>Students read this text from now on. Until you publish, they read what is live.</DialogDescription>
        </DialogHeader>
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink" data-publish-summary>
          <p className="mb-1 font-medium">What changes</p>
          {replaces ? (
            <p>
              Replaces the chapter&apos;s <span className="num">{d.removed.length}</span> topics with these{" "}
              <span className="num">{draft.length}</span>.
            </p>
          ) : none ? (
            <p>Nothing: this draft reads as the live chapter does.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {d.added.length > 0 ? <li><span className="num">{d.added.length}</span> added: {d.added.slice(0, 3).map((t) => topicTitle(t, 36)).join("; ")}{d.added.length > 3 ? "…" : ""}</li> : null}
              {d.edited.length > 0 ? <li><span className="num">{d.edited.length}</span> changed: {d.edited.slice(0, 3).map((e) => topicTitle(e.now, 36)).join("; ")}{d.edited.length > 3 ? "…" : ""}</li> : null}
              {d.removed.length > 0 ? <li><span className="num">{d.removed.length}</span> removed: {d.removed.slice(0, 3).map((t) => topicTitle(t, 36)).join("; ")}{d.removed.length > 3 ? "…" : ""}</li> : null}
              {d.moved.length > 0 ? <li><span className="num">{d.moved.length}</span> moved</li> : null}
            </ul>
          )}
          {warnings.length > 0 ? <p className="mt-2">Some text would read differently to a student ({warnings.length}); check the Student view first.</p> : null}
        </div>
        <Label htmlFor="publish-reason">What changed (required)</Label>
        <Textarea id="publish-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Tightened the opening and added the cache example" />
        {error ? <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">Not published. {error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void go()} disabled={reason.trim().length < 3 || busy}>{busy ? "Publishing…" : `Publish stage ${stageId}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscardDialog({ open, stageId, onClose, onDone }: { open: boolean; stageId: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
  }, [open]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await api.discardWorkingCopy(stageId);
      toast.success(`Stage ${stageId} draft discarded`, "The chapter reads as the published text again. Students saw no change.");
      onClose();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It was not discarded.");
      toast.error(`Stage ${stageId} draft was not discarded`, "Nothing changed.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="ease-dialog max-w-md max-sm:top-3 max-sm:translate-y-0">
        <DialogHeader>
          <DialogTitle>Discard this draft?</DialogTitle>
          <DialogDescription>Everything typed since the chapter was last published is thrown away.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          <li>Students saw none of it, and see no change.</li>
          <li>The editor goes back to the published text.</li>
          <li>It is recorded in the audit log, with your name and the time.</li>
        </ul>
        {error ? <p className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-ink" role="alert">Not discarded. {error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Keep the draft</Button>
          <Button onClick={() => void go()} disabled={busy}>{busy ? "Discarding…" : "Discard draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
