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
import { TabList } from "./TabList";
import type { StudioCtx } from "./context";

/**
 * Course Studio's frame (`design/templates/console/studio/SPEC.md`, as re-ruled
 * 8 Oct 2026: `docs/STUDIO-EDITOR-PLAN.md`). The editor takes the page; ONE
 * sidebar on the RIGHT holds two tabs, Outline and AI Assistant. Nothing on the
 * left.
 *
 * It chooses on the page's OWN width (a ResizeObserver): at 60rem and up the
 * sidebar is docked beside the editor and opens on demand; below it is a sheet
 * opened from the bar, and the editor is the page. The bar's two buttons open
 * the sidebar on that tab, and press again to close it.
 */

/** At this much of its own width and up, the sidebar is a pane, not a sheet. */
const DOCK_PX = 960; // 60rem

type Tab = "outline" | "ai";

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

  const [open, setOpen] = useState(true); // docked only
  const [tab, setTab] = useState<Tab>("outline");
  const [sheet, setSheet] = useState(false);
  // Widening past 60rem while the sheet is open: the pane takes over, the sheet goes.
  useEffect(() => {
    if (docked) setSheet(false);
  }, [docked]);

  const [addOpen, setAddOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  const ctx: StudioCtx = {
    subjects: subjects.data ?? undefined,
    subjectsError: subjects.error,
    content: content.data ?? undefined,
    contentError: content.error,
    reloadSubjects: subjects.reload,
    reloadContent: content.reload,
    reloadAll: () => {
      subjects.reload();
      content.reload();
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

  const toggle = (t: Tab) => {
    if (docked) {
      if (open && tab === t) setOpen(false);
      else {
        setTab(t);
        setOpen(true);
      }
    } else {
      setTab(t);
      setSheet(true);
    }
  };
  const pressed = (t: Tab) => (docked ? open && tab === t : sheet && tab === t);

  const outline = (onNavigate?: () => void) => (
    <Outline
      subjects={subjects.data?.subjects}
      stages={content.data?.stages}
      reviewing={reviewing}
      onAdd={() => setAddOpen(true)}
      {...(onNavigate ? { onNavigate } : {})}
    />
  );

  const side = (onNavigate?: () => void) => (
    <div className="st-side" data-sidebar>
      <TabList<Tab>
        tabs={[{ id: "outline", label: "Outline" }, { id: "ai", label: "AI Assistant", note: "locked" }]}
        tab={tab}
        onTab={setTab}
        label="Sidebar"
        prefix="st-side"
      />
      <div role="tabpanel" id={`st-side-panel-${tab}`} aria-labelledby={`st-side-tab-${tab}`} className="st-side-panel">
        {tab === "outline" ? outline(onNavigate) : <AiPane />}
      </div>
    </div>
  );

  return (
    <div ref={box} className="st" data-studio>
      <div ref={bar} className="st-bar" role="toolbar" aria-label="Studio panes">
        <Button
          size="sm"
          variant={pressed("outline") ? "default" : "outline"}
          aria-pressed={docked ? pressed("outline") : undefined}
          aria-haspopup={docked ? undefined : "dialog"}
          data-pane-toggle="outline"
          onClick={() => toggle("outline")}
        >
          <ListTree className="mr-1 h-4 w-4" aria-hidden="true" />
          Outline
        </Button>
        <Button
          size="sm"
          variant={pressed("ai") ? "default" : "outline"}
          aria-pressed={docked ? pressed("ai") : undefined}
          aria-haspopup={docked ? undefined : "dialog"}
          data-pane-toggle="ai"
          onClick={() => toggle("ai")}
        >
          <Bot className="mr-1 h-4 w-4" aria-hidden="true" />
          AI Assistant
          <Lock className="ml-1 h-3 w-3" aria-hidden="true" />
          <span className="sr-only"> (locked)</span>
        </Button>
      </div>

      <div className={cn("st-panes", docked && open && "has-side")}>
        <div className="st-editor">
          <ApproverProvider value={me}>
            <Outlet context={ctx} />
          </ApproverProvider>
        </div>
        {docked && open ? <aside className="st-pane st-pane-side" aria-label="Sidebar">{side()}</aside> : null}
      </div>

      {/* Below 60rem: the same sidebar as a sheet from the right, modal: focus moves in, Escape closes, focus returns. */}
      <Dialog open={sheet} onOpenChange={(o) => !o && setSheet(false)}>
        <DialogContent
          className="ease-dialog st-sheet st-sheet-right left-auto right-0 top-0 h-dvh max-h-none w-[min(22rem,calc(100vw-1.5rem))] max-w-none translate-x-0 translate-y-0 rounded-none p-4 pt-12"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            bar.current?.querySelector<HTMLElement>(`[data-pane-toggle="${tab}"]`)?.focus();
          }}
        >
          <DialogTitle className="sr-only">Sidebar</DialogTitle>
          <DialogDescription className="sr-only">The course outline and the AI Assistant. Choosing a chapter closes this panel.</DialogDescription>
          {side(() => setSheet(false))}
        </DialogContent>
      </Dialog>

      <SubjectDialog
        open={addOpen}
        subject={null}
        onClose={() => setAddOpen(false)}
        onSaved={(code) => {
          ctx.reloadSubjects();
          setSheet(false); // at 380 the sheet was open behind the dialog: the new subject is the page now
          nav(subjectPath(code));
        }}
      />
    </div>
  );
}
