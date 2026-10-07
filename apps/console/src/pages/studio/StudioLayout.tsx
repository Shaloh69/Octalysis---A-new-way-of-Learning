import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { Bot, ListTree, Lock } from "lucide-react";
import { api } from "@/lib/api";
import type { Identity } from "@/lib/session";
import { useAsync } from "@/lib/useAsync";
import { ApproverProvider, type Approver } from "@/lib/approval-gate";
import { reviewCount, subjectPath } from "@/lib/studio-view";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Outline } from "./Outline";
import { AiPane } from "./AiPane";
import { SubjectDialog } from "./dialogs";
import type { StudioCtx } from "./context";

/**
 * Course Studio (CS1; `design/templates/console/studio/SPEC.md`,
 * docs/COURSE-STUDIO-PLAN.md). Three panes after shadcn's sidebar-15: the
 * outline on the left, the editor in the middle (whichever view the address
 * names), the AI Assistant on the right. It takes in `/content` and the planned
 * `/assistant`.
 *
 * Each pane chooses on the page's OWN width (a ResizeObserver, as the other
 * pages do): at 60rem and up the outline is docked and the AI opens docked on
 * demand; below it both are sheets opened from the bar, and the editor is the
 * page. The bar's two buttons are the same two controls either way. The AI
 * pane starts closed at 1440 because it is locked until its app exists, and
 * the editor needs the room (a chapter's blocks beside its preview want about
 * 52rem): one press opens it.
 */

/** At this much of its own width and up, the outline is a pane, not a sheet. */
const DOCK_PX = 960; // 60rem

export function StudioLayout() {
  const identity = useOutletContext<Identity>();
  const nav = useNavigate();

  const subjects = useAsync(() => api.studioSubjects(), []);
  const content = useAsync(() => api.content(), []);

  const box = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setDocked(el.getBoundingClientRect().width >= DOCK_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [outlineShown, setOutlineShown] = useState(true); // docked only
  const [aiShown, setAiShown] = useState(false); // docked only
  const [sheet, setSheet] = useState<"outline" | "ai" | null>(null);
  // Widening past 60rem while a sheet is open: the pane takes over, the sheet goes.
  useEffect(() => {
    if (docked) setSheet(null);
  }, [docked]);

  const [addOpen, setAddOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  const reloadSubjects = subjects.reload;
  const reloadContent = content.reload;
  const ctx: StudioCtx = {
    subjects: subjects.data ?? undefined,
    subjectsError: subjects.error,
    content: content.data ?? undefined,
    contentError: content.error,
    reloadSubjects,
    reloadContent,
    reloadAll: () => {
      reloadSubjects();
      reloadContent();
    },
    addSubject: () => setAddOpen(true),
  };

  const me: Approver | null = useMemo(
    () =>
      subjects.data
        ? { userId: identity.userId, role: subjects.data.me.role, approves: subjects.data.me.approves }
        : null,
    [identity.userId, subjects.data],
  );
  const reviewing = content.data ? reviewCount(content.data.summary) : undefined;

  const outline = (onNavigate?: () => void) => (
    <Outline
      subjects={subjects.data?.subjects}
      stages={content.data?.stages}
      reviewing={reviewing}
      onAdd={() => setAddOpen(true)}
      {...(onNavigate ? { onNavigate } : {})}
    />
  );

  const outlinePressed = docked ? outlineShown : sheet === "outline";
  const aiPressed = docked ? aiShown : sheet === "ai";

  return (
    <div ref={box} className="st" data-studio>
      <div ref={bar} className="st-bar" role="toolbar" aria-label="Studio panes">
        <Button
          size="sm"
          variant={outlinePressed ? "default" : "outline"}
          aria-pressed={docked ? outlinePressed : undefined}
          aria-haspopup={docked ? undefined : "dialog"}
          data-pane-toggle="outline"
          onClick={() => (docked ? setOutlineShown((v) => !v) : setSheet("outline"))}
        >
          <ListTree className="mr-1 h-4 w-4" aria-hidden="true" />
          Outline
        </Button>
        <Button
          size="sm"
          variant={aiPressed ? "default" : "outline"}
          aria-pressed={docked ? aiPressed : undefined}
          aria-haspopup={docked ? undefined : "dialog"}
          data-pane-toggle="ai"
          onClick={() => (docked ? setAiShown((v) => !v) : setSheet("ai"))}
        >
          <Bot className="mr-1 h-4 w-4" aria-hidden="true" />
          AI Assistant
          <Lock className="ml-1 h-3 w-3" aria-hidden="true" />
          <span className="sr-only"> (locked)</span>
        </Button>
      </div>

      <div className={cn("st-panes", docked && outlineShown && "has-outline", docked && aiShown && "has-ai")}>
        {docked && outlineShown ? <aside className="st-pane st-pane-outline">{outline()}</aside> : null}
        <div className="st-editor">
          <ApproverProvider value={me}>
            <Outlet context={ctx} />
          </ApproverProvider>
        </div>
        {docked && aiShown ? <aside className="st-pane st-pane-ai"><AiPane /></aside> : null}
      </div>

      {/* Below 60rem: the same two panes as sheets, modal: focus moves in, Escape closes, focus returns. */}
      <Dialog open={sheet === "outline"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="ease-dialog st-sheet st-sheet-left left-0 top-0 h-dvh max-h-none w-[min(22rem,calc(100vw-1.5rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-4 pt-12"
                       onCloseAutoFocus={(e) => { e.preventDefault(); bar.current?.querySelector<HTMLElement>('[data-pane-toggle="outline"]')?.focus(); }}>
          <DialogTitle className="sr-only">Course outline</DialogTitle>
          <DialogDescription className="sr-only">Subjects, their books and chapters. Choosing one closes this panel.</DialogDescription>
          {outline(() => setSheet(null))}
        </DialogContent>
      </Dialog>
      <Dialog open={sheet === "ai"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent className="ease-dialog st-sheet st-sheet-right left-auto right-0 top-0 h-dvh max-h-none w-[min(22rem,calc(100vw-1.5rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-4 pt-12"
                       onCloseAutoFocus={(e) => { e.preventDefault(); bar.current?.querySelector<HTMLElement>('[data-pane-toggle="ai"]')?.focus(); }}>
          <DialogTitle className="sr-only">AI Assistant</DialogTitle>
          <DialogDescription className="sr-only">Locked until the AI Assistant app is released.</DialogDescription>
          <AiPane />
        </DialogContent>
      </Dialog>

      <SubjectDialog
        open={addOpen}
        subject={null}
        onClose={() => setAddOpen(false)}
        onSaved={(code) => {
          ctx.reloadSubjects();
          setSheet(null); // at 380 the outline sheet was open behind the dialog: the new subject is the page now
          nav(subjectPath(code));
        }}
      />
    </div>
  );
}
