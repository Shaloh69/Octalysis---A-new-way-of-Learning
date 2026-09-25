import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import type { ItemFile, ItemImportAction, ItemImportResult } from "@octa/contracts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Import items from a JSON file. `PAGE-SPECS.md` planned it; approved 25 Sep.
 *
 * DRY RUN FIRST, ALWAYS. Choosing a file runs the plan and shows, per item,
 * what would happen and why. Nothing is written until the second button, and
 * that button stays disabled while any item is invalid -- the API refuses a
 * commit with a broken row anyway, so offering one would only produce an error.
 *
 * Everything imported lands as a DRAFT, authored by whoever imported it. It
 * then goes through review like anything else; an import cannot publish, and
 * it never touches a live item. The same file shape as `content/items/NN.json`,
 * so the repo and the console describe an item the same way.
 */

const ACTION_WORDS: Record<ItemImportAction, string> = {
  create: "new",
  version: "new version",
  unchanged: "unchanged",
  refused: "refused",
  invalid: "invalid",
};

const ACTION_TONE: Record<ItemImportAction, string> = {
  create: "border-success text-success",
  version: "border-info text-info",
  unchanged: "border-line text-ink-muted",
  refused: "border-warning text-warning",
  invalid: "border-danger text-danger",
};

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<ItemFile | null>(null);
  const [plan, setPlan] = useState<ItemImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setFileName(null);
    setFile(null);
    setPlan(null);
    setProblem(null);
    if (input.current) input.current.value = "";
  }

  async function choose(f: File): Promise<void> {
    reset();
    setFileName(f.name);
    let parsed: ItemFile;
    try {
      parsed = JSON.parse(await f.text()) as ItemFile;
    } catch {
      setProblem(`${f.name} is not valid JSON. Export a file from this page to see the shape.`);
      return;
    }
    setBusy(true);
    try {
      setFile(parsed);
      setPlan(await api.importItems(parsed, true));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The file could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function commit(): Promise<void> {
    if (!file || !plan) return;
    setBusy(true);
    try {
      const done = await api.importItems(file, false);
      const made = done.counts.create + done.counts.version;
      toast.success(
        `Imported ${made} item${made === 1 ? "" : "s"} as draft${made === 1 ? "" : "s"}`,
        [
          done.counts.version ? `${done.counts.version} as new versions of existing drafts` : null,
          done.counts.refused ? `${done.counts.refused} refused` : null,
          "Nothing is live until it is reviewed.",
        ]
          .filter(Boolean)
          .join(" · "),
      );
      reset();
      onOpenChange(false);
      onImported();
    } catch (e) {
      toast.error(
        "Nothing was imported",
        e instanceof Error ? e.message : "Try the dry run again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const c = plan?.counts;
  const writable = c ? c.create + c.version : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="ease-dialog max-w-2xl max-sm:top-3 max-sm:translate-y-0 max-sm:max-h-[calc(100dvh-8rem)]"
        onPointerDownOutside={(e) => {
          if ((e.target as Element | null)?.closest?.("[data-toaster]")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Import items from JSON</DialogTitle>
          <DialogDescription>
            A file in the shape of <span className="num">content/items/NN.json</span>, or an export
            from this page. Every item lands as a <strong>draft</strong> and goes through review
            like any other. An import never changes a live item.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void choose(f);
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
            <FileUp className="h-4 w-4" aria-hidden="true" /> {fileName ? "Choose another file" : "Choose a file"}
          </Button>
          {fileName ? <span className="num min-w-0 truncate text-xs text-ink-muted">{fileName}</span> : null}
        </div>

        {busy && !plan ? (
          <div aria-busy="true" className="grid gap-2">
            <span className="skeleton-bar h-5 w-2/3" />
            <span className="skeleton-bar h-10" />
            <span className="skeleton-bar h-10" />
          </div>
        ) : null}

        {problem ? (
          <p role="alert" className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {problem}
          </p>
        ) : null}

        {plan && c ? (
          <div className="ease-swap">
            <p className="mb-2 text-sm text-ink">
              Dry run: <span className="num">{c.create}</span> would be created ·{" "}
              <span className="num">{c.version}</span> as new versions ·{" "}
              <span className="num">{c.unchanged}</span> unchanged ·{" "}
              <span className="num">{c.refused}</span> refused ·{" "}
              <span className="num">{c.invalid}</span> invalid. Nothing has been written.
            </p>
            <ul className="max-h-72 overflow-y-auto rounded-md border border-line bg-surface-0">
              {plan.rows.map((r, k) => (
                <li key={`${r.slug}-${k}`} className="border-b border-line px-3 py-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num min-w-0 text-xs font-semibold text-ink">{r.slug}</span>
                    {r.stageId ? <span className="num text-xs text-ink-muted">stage {r.stageId}</span> : null}
                    <span className={cn("ml-auto rounded-full border px-2 text-xs", ACTION_TONE[r.action])}>
                      {ACTION_WORDS[r.action]}
                    </span>
                  </div>
                  {r.reasons.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">
                      {r.reasons.map((why) => (
                        <li key={why}>{why}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            {c.invalid > 0 ? (
              <p className="mt-2 text-xs text-warning">
                Fix the invalid items and choose the file again. An import with an invalid item
                writes nothing at all.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          {plan ? (
            <Button disabled={busy || writable === 0 || (c?.invalid ?? 0) > 0} onClick={() => void commit()}>
              Import {writable} item{writable === 1 ? "" : "s"} as draft{writable === 1 ? "" : "s"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
