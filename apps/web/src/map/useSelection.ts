import { useLocation, useNavigate } from "react-router-dom";

/**
 * The map's selection lives in the URL, `/app?stage=NN`, so a bookmark, a
 * shared link and Leave planet (`/app?stage=NN`) all open the right planet,
 * and the browser's Back closes it.
 *
 *   open(id)   pushes when nothing was open, replaces when switching planets,
 *              so Back always means "close the panel", never "the planet
 *              before this one"
 *   close()    goes Back if this page opened the panel, otherwise drops the
 *              parameter in place (a deep link has no history to go back to)
 */
interface NavState {
  mapOpened?: boolean;
}

export function useSelection(): { selected: string | null; open: (id: string) => void; close: () => void } {
  const location = useLocation();
  const nav = useNavigate();
  const selected = new URLSearchParams(location.search).get("stage");
  const st = (location.state ?? {}) as NavState;

  const open = (id: string): void => {
    if (id === selected) return;
    const p = new URLSearchParams(location.search);
    p.set("stage", id);
    nav(
      { pathname: location.pathname, search: `?${p.toString()}` },
      { replace: !!selected, state: { mapOpened: selected ? !!st.mapOpened : true } },
    );
  };
  const close = (): void => {
    if (!selected) return;
    if (st.mapOpened) {
      nav(-1);
      return;
    }
    const p = new URLSearchParams(location.search);
    p.delete("stage");
    const q = p.toString();
    nav({ pathname: location.pathname, search: q ? `?${q}` : "" }, { replace: true });
  };
  return { selected, open, close };
}

/** Objectives in the syllabus's order: 06.1, 06.2 … 06.10 (the API sorts them as strings). */
export function byObjectiveId(a: { id: string }, b: { id: string }): number {
  const pa = a.id.split(".").map(Number);
  const pb = b.id.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0 && !Number.isNaN(d)) return d;
  }
  return a.id.localeCompare(b.id);
}
